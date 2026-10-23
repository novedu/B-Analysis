/**
 * collector.js —— 只读采集器
 * 只调用 B 站公开接口，不涉及任何写操作（不点赞、不评论、不关注）。
 * 所有请求都带 credentials: 'include'，复用当前浏览器登录态，不接触 Cookie 本身。
 */
(() => {
  const API = 'https://api.bilibili.com';
  const PACE = 700; // 每次请求间隔，避免触发风控

  const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

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

        // 风控 / 限流：退避后重试
        if (res.status === 412 || json.code === -412 || json.code === -352) {
          last = json;
          await sleep(4000 * (attempt + 1));
          continue;
        }

        return json; // 业务错误，直接返回让上层记录
      }
      return last;
    };
  }

  async function collect({ onProgress = () => {}, isCancelled = () => false } = {}) {
    const api = makeApi(isCancelled);
    const out = {
      schemaVersion: 1,
      generator: 'b-fenxi/0.1.0',
      exportedAt: new Date().toISOString(),
      account: null,
      history: [],
      followings: [],
      favorites: {},
      toview: [],
      diag: {}
    };

    // ---------- 0. 登录态 ----------
    const nav = await api('/x/web-interface/nav');
    if (nav.code !== 0) {
      out.diag.fatal = `未登录或接口异常（${nav.code} ${nav.message || ''}）`;
      return out;
    }
    const mid = nav.data.mid;
    out.account = { mid, uname: nav.data.uname };

    // ---------- 1. 观看历史（游标分页，平台只保留约 1200 条） ----------
    const seenH = new Set();
    let cur = { max: 0, view_at: 0, business: '' };
    for (let i = 0; i < 300; i++) {
      if (isCancelled()) { out.diag.historyStop = '用户取消'; break; }
      const j = await api('/x/web-interface/history/cursor', {
        max: cur.max, view_at: cur.view_at, business: cur.business, ps: 20
      });
      if (j.code !== 0) { out.diag.historyStop = `${j.code} ${j.message || ''}`; break; }

      const list = (j.data && j.data.list) || [];
      if (!list.length) { out.diag.historyStop = '空页'; break; }

      let added = 0;
      for (const it of list) {
        const h = it.history || {};
        const bvid = h.bvid || it.bvid || (h.oid ? `oid_${h.oid}` : null);
        if (!bvid || seenH.has(bvid)) continue;
        seenH.add(bvid);
        added++;
        out.history.push({
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
      onProgress('history', `${out.history.length} 条`, out.history.length);
      if (!added) { out.diag.historyStop = '本页无新增'; break; }

      const c = (j.data && j.data.cursor) || {};
      if (c.max === cur.max && c.view_at === cur.view_at) { out.diag.historyStop = '游标未前进'; break; }
      cur = { max: c.max, view_at: c.view_at, business: c.business };
    }

    // ---------- 2. 关注（正序 + 倒序，突破单方向 1000 条上限） ----------
    const seenF = new Set();
    for (const order of ['desc', 'asc']) {
      for (let pn = 1; pn <= 20; pn++) {
        if (isCancelled()) { out.diag.followingStop = '用户取消'; break; }
        const j = await api('/x/relation/followings', {
          vmid: mid, pn, ps: 50, order, order_type: 'attention'
        });
        if (j.code !== 0) { out.diag.followingStop = `${order}/${pn}: ${j.code}`; break; }

        const list = (j.data && j.data.list) || [];
        if (!list.length) break;

        let added = 0;
        for (const u of list) {
          if (seenF.has(u.mid)) continue;
          seenF.add(u.mid);
          added++;
          out.followings.push({
            mid: u.mid,
            uname: u.uname,
            sign: u.sign || '',
            official: (u.official_verify && u.official_verify.desc) || '',
            vip: (u.vip && u.vip.vipStatus) || 0,
            mtime: u.mtime
          });
        }
        onProgress('following', `${out.followings.length} 个`, out.followings.length);
        if (list.length < 50 || !added) break;
      }
    }

    // ---------- 3. 收藏夹（先列夹子，再逐个翻） ----------
    const fl = await api('/x/v3/fav/folder/created/list-all', { up_mid: mid });
    if (fl.code === 0 && fl.data) {
      const folders = fl.data.list || [];
      for (const f of folders) {
        if (isCancelled()) break;
        const items = [];
        for (let pn = 1; pn <= 40; pn++) {
          const j = await api('/x/v3/fav/resource/list', {
            media_id: f.id, pn, ps: 20, platform: 'web'
          });
          if (j.code !== 0) break;
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
        out.favorites[f.title || String(f.id)] = items;
        const total = Object.values(out.favorites).reduce((n, v) => n + v.length, 0);
        onProgress('favorite', `${Object.keys(out.favorites).length} 个夹子`, total);
      }
    } else {
      out.diag.favStop = `${fl.code} ${fl.message || ''}`;
    }

    // ---------- 4. 稍后再看 ----------
    const tv = await api('/x/v2/history/toview', {});
    if (tv.code === 0 && tv.data && tv.data.list) {
      out.toview = tv.data.list.map((it) => ({
        bvid: it.bvid,
        title: it.title,
        author: (it.owner && it.owner.name) || '',
        duration: it.duration,
        add_at: it.add_at,
        progress: it.progress
      }));
    }
    onProgress('toview', `${out.toview.length} 条`, out.toview.length);

    out.diag.history = out.history.length;
    out.diag.followings = out.followings.length;
    out.diag.favorites = Object.values(out.favorites).reduce((n, v) => n + v.length, 0);
    out.diag.toview = out.toview.length;
    return out;
  }

  window.BiliCollector = { collect };
})();
