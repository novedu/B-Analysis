/**
 * content.js —— 悬浮入口 + 采集面板
 * 全部 UI 挂在 Shadow DOM 里，样式与宿主页面完全隔离。
 */
(() => {
  if (window.__BFX_MOUNTED__) return;
  window.__BFX_MOUNTED__ = true;

  const CSS = `
  :host{ all: initial; }
  *{ box-sizing: border-box; margin: 0; padding: 0; }
  .wrap{
    position: fixed; right: 22px; bottom: 22px; z-index: 2147483646;
    font: 13px/1.5 -apple-system, BlinkMacSystemFont, "PingFang SC", "Hiragino Sans GB", "Microsoft YaHei", sans-serif;
    color: #10141a; -webkit-font-smoothing: antialiased;
    --ink:#10141a; --muted:#71767f; --line:#edeff2; --bg:#fff; --soft:#f7f8fa;
    --accent:#fb7299; --accent2:#00aeec;
  }
  @media (prefers-color-scheme: dark){
    .wrap{ --ink:#e9ecf1; --muted:#98a0ab; --line:#262b33; --bg:#171a20; --soft:#1e2229; }
  }

  /* ---------- 悬浮按钮 ---------- */
  .pill{
    display:flex; align-items:center; gap:9px; height:46px; padding:0 18px 0 15px;
    border:0; border-radius:23px; cursor:pointer;
    background:linear-gradient(135deg,#12161c,#2a313d); color:#fff;
    font-size:13px; font-weight:600; letter-spacing:.2px;
    box-shadow:0 10px 30px -10px rgba(18,22,28,.6), inset 0 0 0 1px rgba(255,255,255,.07);
    transition:transform .2s cubic-bezier(.2,.8,.2,1), box-shadow .2s;
  }
  .pill:hover{ transform:translateY(-2px); box-shadow:0 16px 38px -12px rgba(18,22,28,.7), inset 0 0 0 1px rgba(255,255,255,.12); }
  .pill:active{ transform:translateY(0) scale(.98); }
  .pill svg{ flex:0 0 auto; }
  .pill.hide{ display:none; }

  /* ---------- 面板 ---------- */
  .panel{
    position:absolute; right:0; bottom:58px; width:348px;
    background:var(--bg); border-radius:20px; overflow:hidden;
    border:1px solid var(--line);
    box-shadow:0 30px 70px -20px rgba(16,24,40,.38), 0 6px 18px -8px rgba(16,24,40,.2);
    animation:pop .24s cubic-bezier(.2,.8,.2,1) both;
    transform-origin:bottom right;
  }
  .panel[hidden]{ display:none; }
  @keyframes pop{ from{ opacity:0; transform:translateY(10px) scale(.97); } to{ opacity:1; transform:none; } }

  .accent{ height:3px; background:linear-gradient(90deg,#fb7299,#ff9ec0 45%,#00aeec); }

  .head{ display:flex; align-items:flex-start; justify-content:space-between; padding:16px 18px 12px; }
  .head h1{ font-size:14px; font-weight:650; letter-spacing:-.2px; color:var(--ink); }
  .head p{ font-size:11.5px; color:var(--muted); margin-top:3px; }
  .x{
    width:26px; height:26px; border:0; border-radius:8px; background:transparent; color:var(--muted);
    font-size:17px; line-height:1; cursor:pointer; transition:.15s;
  }
  .x:hover{ background:var(--soft); color:var(--ink); }

  .body{ padding:0 18px; }
  .row{ display:flex; align-items:center; gap:9px; padding:7px 0; font-size:12.5px; }
  .dot{ width:6px; height:6px; border-radius:50%; background:#d5d9df; flex:0 0 auto; transition:.2s; }
  .row[data-state="run"] .dot{ background:var(--accent); animation:pulse 1.1s infinite; }
  .row[data-state="done"] .dot{ background:#12b76a; animation:none; }
  .row[data-state="err"] .dot{ background:#f04438; animation:none; }
  .row .name{ color:var(--ink); }
  .row .val{ margin-left:auto; color:var(--muted); font-variant-numeric:tabular-nums; font-size:12px; }
  @keyframes pulse{ 0%,100%{ opacity:.35; transform:scale(.85); } 50%{ opacity:1; transform:scale(1); } }

  .bar{ height:4px; border-radius:2px; background:var(--soft); overflow:hidden; margin:12px 0 0; }
  .bar i{
    display:block; height:100%; width:0%; min-width:0;
    background:linear-gradient(90deg,#fb7299,#ff9ec0 45%,#00aeec);
    border-radius:2px; transition:width .45s cubic-bezier(.2,.8,.2,1), background .3s;
  }
  .bar[data-state="done"] i{ background:linear-gradient(90deg,#12b76a,#4ade80); }
  .bar[data-state="err"] i{ background:#f04438; }
  .note{ font-size:11.5px; color:var(--muted); padding:10px 0 14px; line-height:1.6; }
  .note.err{ color:#d92d20; }
  .relink{
    display:inline-block; margin:-4px 0 12px; font-size:11.5px; color:var(--muted);
    text-decoration:none; border-bottom:1px dashed #c9ced6;
  }
  .relink:hover{ color:var(--accent); border-color:var(--accent); }
  .relink[hidden]{ display:none; }

  .chips{ display:grid; grid-template-columns:repeat(3,1fr); gap:8px; padding:2px 0 12px; }
  .chip{ background:var(--soft); border-radius:11px; padding:9px 10px; }
  .chip b{ display:block; font-size:15px; font-weight:650; color:var(--ink); font-variant-numeric:tabular-nums; letter-spacing:-.3px; }
  .chip span{ font-size:10.5px; color:var(--muted); }
  .chips[hidden]{ display:none; }

  .actions{ display:flex; gap:8px; padding:0 18px 14px; }
  .btn{
    flex:1; height:38px; border:0; border-radius:11px; cursor:pointer;
    font:inherit; font-size:13px; font-weight:600; transition:.16s;
  }
  .btn.primary{
    background:linear-gradient(135deg,#fb7299,#ff8fb0); color:#fff;
    box-shadow:0 8px 20px -8px rgba(251,114,153,.85);
  }
  .btn.primary:hover{ transform:translateY(-1px); box-shadow:0 12px 26px -8px rgba(251,114,153,.9); }
  .btn.primary:active{ transform:scale(.985); }
  .btn.ghost{ background:var(--soft); color:var(--ink); }
  .btn.ghost:hover{ background:#eceef2; }
  @media (prefers-color-scheme: dark){ .btn.ghost:hover{ background:#252a33; } }
  .btn[disabled]{ opacity:.45; cursor:default; transform:none !important; box-shadow:none; }
  .btn[hidden]{ display:none; }

  .foot{
    display:flex; align-items:center; justify-content:space-between;
    padding:10px 18px 13px; border-top:1px solid var(--line);
    font-size:11px; color:var(--muted);
  }
  .foot a{ color:var(--muted); text-decoration:none; border-bottom:1px dashed #c9ced6; }
  .foot a:hover{ color:var(--accent); border-color:var(--accent); }
  `;

  const HTML = `
  <div class="wrap">
    <section class="panel" hidden>
      <div class="accent"></div>
      <div class="head">
        <div>
          <h1>导出我的 B 站数据</h1>
          <p>只读采集 · 数据不出本机</p>
        </div>
        <button class="x" title="收起">×</button>
      </div>
      <div class="body">
        <div class="rows">
          <div class="row" data-k="history"><i class="dot"></i><span class="name">观看历史</span><span class="val">待开始</span></div>
          <div class="row" data-k="following"><i class="dot"></i><span class="name">关注列表</span><span class="val">待开始</span></div>
          <div class="row" data-k="favorite"><i class="dot"></i><span class="name">收藏夹</span><span class="val">待开始</span></div>
          <div class="row" data-k="toview"><i class="dot"></i><span class="name">稍后再看</span><span class="val">待开始</span></div>
        </div>
        <div class="bar"><i></i></div>
        <p class="note">约需 1–3 分钟，取决于你的数据量。过程中请不要关闭或刷新本页。</p>
        <a class="relink" data-a="restart" href="#" hidden>重新开始</a>
        <div class="chips" hidden>
          <div class="chip"><b data-c="history">0</b><span>条历史</span></div>
          <div class="chip"><b data-c="following">0</b><span>个关注</span></div>
          <div class="chip"><b data-c="favorite">0</b><span>条收藏</span></div>
        </div>
      </div>
      <div class="actions">
        <button class="btn primary" data-a="start">开始导出</button>
        <button class="btn ghost" data-a="download" hidden>下载 JSON</button>
        <button class="btn ghost" data-a="copy" hidden>复制</button>
      </div>
      <div class="foot">
        <span>仅访问 api.bilibili.com</span>
        <a href="#" data-a="about">说明与免责</a>
      </div>
    </section>

    <button class="pill" data-a="toggle">
      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" aria-hidden="true">
        <path d="M2.4 12c3.7-4.7 9.5-6.5 14-4.2 2.3 1.2 3.9 3.1 4.5 5.3-3.7 4.7-9.5 6.5-14 4.2C4.6 16.1 3 14.2 2.4 12Z" fill="#fff" opacity=".95"/>
        <path d="M21.2 12.1c1.2-1.4 2-3.1 2.3-4.9-1.7.4-3.2 1.3-4.4 2.5.9.7 1.6 1.5 2.1 2.4Z" fill="#fb7299"/>
        <circle cx="8.4" cy="10.9" r="1.15" fill="#12161c"/>
      </svg>
      <span>导出我的数据</span>
    </button>
  </div>`;

  const CKPT = 'bfx-ckpt-v1';

  const host = document.createElement('div');
  host.id = 'bfx-host';
  const root = host.attachShadow({ mode: 'open' });
  root.innerHTML = `<style>${CSS}</style>${HTML}`;
  (document.body || document.documentElement).appendChild(host);

  const $ = (s) => root.querySelector(s);
  const panel = $('.panel');
  const rows = {
    history: $('.row[data-k="history"]'),
    following: $('.row[data-k="following"]'),
    favorite: $('.row[data-k="favorite"]'),
    toview: $('.row[data-k="toview"]')
  };
  const ORDER = ['history', 'following', 'favorite', 'toview'];
  const LABEL = { history: '观看历史', following: '关注列表', favorite: '收藏夹', toview: '稍后再看' };
  const barFill = $('.bar i');
  const note = $('.note');
  const chips = $('.chips');
  const btnStart = $('[data-a="start"]');
  const btnDownload = $('[data-a="download"]');
  const btnCopy = $('[data-a="copy"]');
  const linkRestart = $('[data-a="restart"]');

  let st = null;
  let running = false;
  let cancelled = false;
  let startedAt = 0;

  // ---------- 断点存取 ----------
  function loadCkpt() {
    try {
      const raw = sessionStorage.getItem(CKPT);
      if (!raw) return null;
      const s = JSON.parse(raw);
      return s && s.version === 1 ? s : null;
    } catch (e) { return null; }
  }
  function saveCkpt(s) {
    try { sessionStorage.setItem(CKPT, JSON.stringify(s)); } catch (e) { /* 超出配额就算了 */ }
  }
  function clearCkpt() {
    try { sessionStorage.removeItem(CKPT); } catch (e) {}
  }

  // ---------- 渲染 ----------
  function counts(s) {
    if (!s) return { history: 0, following: 0, favorite: 0, toview: 0 };
    return {
      history: s.history.items.length,
      following: s.followings.items.length,
      favorite: Object.values(s.favorites.map).reduce((n, v) => n + v.length, 0),
      toview: s.toview.items.length
    };
  }

  function paint(s) {
    if (!s) return;
    const c = counts(s);
    const done = {
      history: s.history.done,
      following: s.followings.done,
      favorite: s.favorites.done,
      toview: s.toview.done
    };
    ORDER.forEach((k) => {
      const n = c[k];
      const unit = k === 'following' ? ' 个' : ' 条';
      if (done[k]) setRow(k, 'done', n + unit);
      else if (n > 0) setRow(k, 'run', n + unit);
      else setRow(k, '', '等待');
    });
    const finished = ORDER.filter((k) => done[k]).length;
    setProgress(finished, finished === ORDER.length ? 'done' : 'run');
  }

  function setRow(k, state, text) {
    const r = rows[k];
    if (!r) return;
    if (state) r.dataset.state = state;
    if (text != null) r.querySelector('.val').textContent = text;
  }

  function setProgress(i, state) {
    barFill.style.width = `${Math.min(100, (i / ORDER.length) * 100)}%`;
    if (state) $('.bar').dataset.state = state;
  }

  function setNote(text, isErr) {
    note.className = isErr ? 'note err' : 'note';
    note.textContent = text;
  }

  // ---------- 初始态 ----------
  function showIdle() {
    st = loadCkpt();
    btnDownload.hidden = true;
    btnCopy.hidden = true;
    chips.hidden = true;
    btnStart.hidden = false;
    btnStart.disabled = false;

    if (st) {
      paint(st);
      const p = window.BiliCollector.pending(st);
      if (p.length) {
        btnStart.textContent = '继续导出';
        const c = counts(st);
        setNote(`上次中断在「${LABEL[p[0]]}」。已存：历史 ${c.history} 条 · 关注 ${c.following} 个 · 收藏 ${c.favorite} 条。点继续只补没跑完的部分。`);
        linkRestart.hidden = false;
      } else {
        btnStart.textContent = '开始导出';
        setProgress(0, 'idle');
      }
    } else {
      ORDER.forEach((k) => setRow(k, '', '待开始'));
      btnStart.textContent = '开始导出';
      setProgress(0, 'idle');
      setNote('约需 1–3 分钟，取决于你的数据量。过程中请不要关闭或刷新本页。');
      linkRestart.hidden = true;
    }
  }

  // ---------- 开始 / 继续 ----------
  async function start() {
    if (running) { cancelled = true; btnStart.textContent = '正在停止…'; return; }

    running = true;
    cancelled = false;
    startedAt = Date.now();
    chips.hidden = true;
    btnDownload.hidden = true;
    btnCopy.hidden = true;
    btnStart.textContent = '停止';
    btnStart.disabled = false;
    linkRestart.hidden = true;
    setNote('正在连接…');
    setProgress(0, 'run');

    const base = st && window.BiliCollector.pending(st).length ? st : null;

    try {
      st = await window.BiliCollector.collect({
        state: base,
        onProgress: (k, msg) => {
          if (rows[k]) setRow(k, 'run', msg);
          setNote('正在采集…');
        },
        onCheckpoint: (s) => { st = s; saveCkpt(s); },
        isCancelled: () => cancelled
      });
    } catch (e) {
      running = false;
      setNote('采集中断：' + ((e && e.message) || e) + '。已采集的部分保留，可以点「继续导出」接着跑。', true);
      btnStart.textContent = '继续导出';
      return;
    }

    running = false;
    const secs = Math.round((Date.now() - startedAt) / 1000);
    const dur = secs > 60 ? `${Math.floor(secs / 60)} 分 ${secs % 60} 秒` : `${secs} 秒`;
    const pend = window.BiliCollector.pending(st);
    const errs = (st.errors || []);
    const c = counts(st);

    paint(st);

    // 完成
    if (!pend.length && !errs.length) {
      clearCkpt();
      const out = window.BiliCollector.toOutput(st);
      window.__BFX_LAST__ = out;
      data = out;

      $('[data-c="history"]').textContent = c.history.toLocaleString();
      $('[data-c="following"]').textContent = c.following.toLocaleString();
      $('[data-c="favorite"]').textContent = c.favorite.toLocaleString();
      chips.hidden = false;

      setNote(cancelled ? `已停止，用时 ${dur}。当前结果可以下载。` : `完成，用时 ${dur}。数据只在本机，未上传。`);
      btnStart.hidden = true;
      btnDownload.hidden = false;
      btnCopy.hidden = false;
      return;
    }

    // 有阶段没跑完
    const first = errs[firstErrorIndex(errs)] || errs[0];
    const hint = first ? window.BiliCollector.explain(first.code) : '还有阶段未完成。';
    const phaseName = first ? LABEL[first.phase] || first.phase : LABEL[pend[0]];

    setNote(`「${phaseName}」没跑完：${hint} 已采集的部分保留，处理后点「继续导出」。`, true);
    btnStart.textContent = '继续导出';
    linkRestart.hidden = false;
    if (c.history + c.following + c.favorite + c.toview > 0) {
      data = window.BiliCollector.toOutput(st);
      window.__BFX_LAST__ = data;
      btnDownload.hidden = false;
      btnCopy.hidden = false;
    }
  }

  function firstErrorIndex(errs) {
    return errs.length ? 0 : -1;
  }

  // ---------- 导出 ----------
  function filename() {
    return `bilibili-data-${new Date().toISOString().slice(0, 10)}.json`;
  }

  function download() {
    if (!data) return;
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename();
    document.body.appendChild(a);
    a.click();
    a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 10000);
  }

  async function copy() {
    if (!data) return;
    const text = JSON.stringify(data);
    try {
      await navigator.clipboard.writeText(text);
      setNote('已复制到剪贴板。');
    } catch (e) {
      const ta = document.createElement('textarea');
      ta.value = text;
      ta.style.cssText = 'position:fixed;opacity:0';
      document.body.appendChild(ta);
      ta.select();
      document.execCommand('copy');
      ta.remove();
      setNote('已复制到剪贴板。');
    }
  }

  function restart() {
    if (running) return;
    clearCkpt();
    st = null;
    data = null;
    showIdle();
  }

  // ---------- 事件 ----------
  root.addEventListener('click', (e) => {
    const t = e.target.closest('[data-a]');
    if (!t) return;
    const a = t.dataset.a;
    if (a === 'toggle') {
      const willShow = panel.hidden;
      panel.hidden = !willShow;
      if (willShow && !running) showIdle();
    } else if (a === 'close') {
      panel.hidden = true;
    } else if (a === 'start') {
      start();
    } else if (a === 'download') {
      download();
    } else if (a === 'copy') {
      copy();
    } else if (a === 'restart') {
      e.preventDefault();
      restart();
    } else if (a === 'about') {
      e.preventDefault();
      try { chrome.runtime.openOptionsPage(); } catch (err) {}
    }
  });

  $('.x').dataset.a = 'close';

  // 首次挂载时不自动展开；有断点时给按钮加个提示点
  const ck = loadCkpt();
  if (ck && window.BiliCollector.pending(ck).length) {
    $('[data-a="toggle"] span').textContent = '继续导出';
  }
})();
