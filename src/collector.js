/**
 * collector.js —— 只读采集器（支持断点续跑）
 *
 * 设计要点：
 * 1. 全部状态集中在一个可序列化的对象里，随时可以存下来、下次接着跑。
 * 2. 每个阶段自己记进度（游标 / 页码 / 第几个收藏夹），失败后只补没跑完的部分。
 * 3. 不碰 Cookie，只用 credentials: 'include' 复用登录态。
 */
(() => {
  const API = 'https://api.bilibili.com';
  const PACE = (typeof window !== 'undefined' && window.__BFX_PACE__) ?? 700;

  const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

  // 错误码 → 人话
  const HINTS = {
    '-101': '请先在 bilibili.com 登录，然后再试。',
    '-352': '被 B 站风控拦住了，等 5–10 分钟再试，期间别反复重试。',
    '-412': '请求被拦截（412），等几分钟再试。',
    '-999': '接口返回了非 JSON（多半是 404），路径可能已变更，欢迎提 issue。',
    '-998': '网络请求失败，检查网络后重试。',
    '-1': '已取消。'
  };

  function explain(code) {
    return HINTS[String(code)] || `接口返回 ${code}，可对照 STATUS.md 排查。`;
  }

  function emptyState() {
    return {
      version: 1,
      account: null,
      history: { items: [], cursor: { max: 0, view_at: 0, business: '' }, done: false },
      followings: { items: [], order: 'desc', page: 1, done: false },
      favorites: { folders: null, map: {}, index: 0, done: false },
      toview: { items: [], done: false },
      errors: []
    };
  }

  function makeApi(isCancelled) {
    return async function api(path, params = {}) {
      const url = `${API}${path}?${new URLSearchParams(params)}`;
      let last = { code: -999, message: '未知错误' };

      for (let attempt = 0; attempt < 3; attempt++) {
        if (isCancelled()) return { code: -1, message: '已取消' };

        let res;
        try {
          res = await fetch(url, { credentials: 'include' });
        } catch (e) {
          last = { code: -998, message: '网络错误' };
          await sleep(1500 * (attempt + 1));
          continue;
        }

        const text = await res.text();
        let json;
        try {
          json = JSON.parse(text);
        } catch (e) {
          json = { code: -999, message: `HTTP ${res.status} 返回非 JSON` };
        }

        if (json.code === 0) {
          await sleep(PACE);
          return json;
        }

        if (res.status === 412 || json.code === -412 || json.code === -352) {
          last = json;
          await sleep(4000 * (attempt + 1));
          continue;
        }
        return json;
      }
      return last;
    };
  }

  /**
   * @param {object}   opts
   * @param {object}   opts.state        上次保存的状态（可选）
   * @param {function} opts.onProgress   (key, text) => void
   * @param {function} opts.onCheckpoint (state) => void  每完成一页回调一次
   * @param {function} opts.isCancelled  () => boolean
   */
  async function collect({ state, onProgress = () => {}, onCheckpoint = () => {}, isCancelled = () => false } = {}) {
    const st = state || emptyState();
    const api = makeApi(isCancelled);
    const fail = (phase, code, message) => {
      st.errors.push({ phase, code, message: message || '' });
    };
    const save = () => onCheckpoint(st);

    // ---------- 0. 登录态 ----------
    if (!st.account) {
      const nav = await api('/x/web-interface/nav');
      if (nav.code !== 0) {
        fail('auth', nav.code, nav.message);
        st.account = null;
        return st;
      }
      st.account = { mid: nav.data.mid, uname: nav.data.uname };
      save();
    }
    const mid = st.account.mid;

    // ---------- 1. 观看历史 ----------
    if (!st.history.done) {
      const seen = new Set(st.history.items.map((x) => x.bvid));
      for (let i = 0; i < 300; i++) {
        if (isCancelled()) break;
        const c0 = st.history.cursor;
        const j = await api('/x/web-interface/history/cursor', {
          max: c0.max, view_at: c0.view_at, business: c0.business, ps: 20
        });
        if (j.code !== 0) { fail('history', j.code, j.message); break; }

        const list = (j.data && j.data.list) || [];
        if (!list.length) { st.history.done = true; save(); break; }

        let added = 0;
        for (const it of list) {
          const h = it.history || {};
          const bvid = h.bvid || it.bvid || (h.oid ? `oid_${h.oid}` : null);
          if (!bvid || seen.has(bvid)) continue;
          seen.add(bvid);
          added++;
          st.history.items.push({
            bvid,
            title: it.title,
            author: it.author_name,
            author_mid: it.author_mid,
            view_at: it.view_at,
            duration: it.duration,
            progress: it.progress,
            tname: it.tname || it.tag_name || null,
            business: h.business || ''
          });
        }

        const c = (j.data && j.data.cursor) || {};
        if (c.max === c0.max && c.view_at === c0.view_at) { st.history.done = true; save(); break; }
        st.history.cursor = { max: c.max, view_at: c.view_at, business: c.business };
        onProgress('history', `${st.history.items.length} 条`);
        save();
        if (!added) { st.history.done = true; save(); break; }
      }
      if (isCancelled()) return st;
    }

    // ---------- 2. 关注（正序 + 倒序） ----------
    if (!st.followings.done) {
      const seen = new Set(st.followings.items.map((x) => x.mid));
      let order = st.followings.order;
      let page = st.followings.page;

      while (true) {
        if (isCancelled()) return st;
        const j = await api('/x/relation/followings', {
          vmid: mid, pn: page, ps: 50, order, order_type: 'attention'
        });
        if (j.code !== 0) { fail('followings', j.code, j.message); break; }

        const list = (j.data && j.data.list) || [];
        if (!list.length) {
          if (order === 'desc') { order = 'asc'; page = 1; st.followings.order = order; st.followings.page = page; continue; }
          st.followings.done = true; save(); break;
        }

        let added = 0;
        for (const u of list) {
          if (seen.has(u.mid)) continue;
          seen.add(u.mid);
          added++;
          st.followings.items.push({
            mid: u.mid,
            uname: u.uname,
            sign: u.sign || '',
            official: (u.official_verify && u.official_verify.desc) || '',
            vip: (u.vip && u.vip.vipStatus) || 0,
            mtime: u.mtime
          });
        }

        onProgress('following', `${st.followings.items.length} 个`);
        page += 1;
        if (page > 20 || list.length < 50 || !added) {
          if (order === 'desc') { order = 'asc'; page = 1; }
          else { st.followings.done = true; }
        }
        st.followings.order = order;
        st.followings.page = page;
        save();
        if (st.followings.done) break;
      }
    }

    // ---------- 3. 收藏夹 ----------
    if (!st.favorites.done) {
      if (!st.favorites.folders) {
        const fl = await api('/x/v3/fav/folder/created/list-all', { up_mid: mid });
        if (fl.code !== 0) {
          fail('favorites', fl.code, fl.message);
          return st;   // 不标记完成，下次续跑会重试
        } else {
          st.favorites.folders = ((fl.data && fl.data.list) || []).map((f) => ({ id: f.id, title: f.title }));
          save();
        }
      }

      const folders = st.favorites.folders || [];
      for (; st.favorites.index < folders.length; st.favorites.index++) {
        if (isCancelled()) return st;
        const f = folders[st.favorites.index];
        if (st.favorites.map[f.title]) continue;

        const items = [];
        let aborted = false;
        for (let pn = 1; pn <= 40; pn++) {
          const j = await api('/x/v3/fav/resource/list', { media_id: f.id, pn, ps: 20, platform: 'web' });
          if (j.code !== 0) { fail('favorites', j.code, j.message); aborted = true; break; }
          const medias = (j.data && j.data.medias) || [];
          if (!medias.length) break;
          for (const m of medias) {
            items.push({
              bvid: m.bvid,
              title: m.title,
              upper: (m.upper && m.upper.name) || '',
              upper_mid: (m.upper && m.upper.mid) || 0,
              duration: m.duration,
              fav_time: m.fav_time,
              pubtime: m.pubtime
            });
          }
          if (!j.data.has_more) break;
        }
        if (aborted) return st;   // 该夹子没抓完，不写入、不标记完成
        st.favorites.map[f.title] = items;
        onProgress('favorite', `${Object.keys(st.favorites.map).length} 个夹子`);
        save();
      }
      st.favorites.done = true;
      save();
    }

    // ---------- 4. 稍后再看 ----------
    if (!st.toview.done) {
      const tv = await api('/x/v2/history/toview', {});
      if (tv.code === 0 && tv.data && tv.data.list) {
        st.toview.items = tv.data.list.map((it) => ({
          bvid: it.bvid,
          title: it.title,
          author: (it.owner && it.owner.name) || '',
          duration: it.duration,
          add_at: it.add_at,
          progress: it.progress
        }));
      } else if (tv.code !== 0) {
        fail('toview', tv.code, tv.message);
        return st;   // 不标记完成，下次续跑会重试
      }
      st.toview.done = true;
      onProgress('toview', `${st.toview.items.length} 条`);
      save();
    }

    return st;
  }

  // 把内部状态转成对外文档化的 JSON 结构
  function toOutput(st) {
    const favTotal = Object.values(st.favorites.map).reduce((n, v) => n + v.length, 0);
    return {
      schemaVersion: 1,
      generator: 'b-fenxi/0.2.1',
      exportedAt: new Date().toISOString(),
      account: st.account,
      history: st.history.items,
      followings: st.followings.items,
      favorites: st.favorites.map,
      toview: st.toview.items,
      diag: {
        history: st.history.items.length,
        followings: st.followings.items.length,
        favorites: favTotal,
        toview: st.toview.items.length,
        errors: st.errors
      }
    };
  }

  // 还有哪些阶段没跑完（用于续跑提示）
  function pending(st) {
    if (!st) return [];
    const out = [];
    if (!st.history.done) out.push('history');
    if (!st.followings.done) out.push('following');
    if (!st.favorites.done) out.push('favorite');
    if (!st.toview.done) out.push('toview');
    return out;
  }

  window.BiliCollector = { collect, toOutput, emptyState, explain, pending };
})();
