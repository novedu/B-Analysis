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
  const barFill = $('.bar i');
  const note = $('.note');
  const chips = $('.chips');
  const btnStart = $('[data-a="start"]');
  const btnDownload = $('[data-a="download"]');
  const btnCopy = $('[data-a="copy"]');

  let data = null;
  let cancelled = false;
  let running = false;
  let startedAt = 0;

  function setRow(k, state, text) {
    const r = rows[k];
    if (!r) return;
    if (state) r.dataset.state = state;
    if (text != null) r.querySelector('.val').textContent = text;
  }

  function setProgress(i, state) {
    const pct = Math.min(100, (i / ORDER.length) * 100);
    barFill.style.width = `${pct}%`;
    if (state) $('.bar').dataset.state = state;
  }

  function markDone(k) {
    const r = rows[k];
    if (r && r.dataset.state !== 'done') r.dataset.state = 'done';
  }

  function reset() {
    data = null;
    cancelled = false;
    ORDER.forEach((k) => setRow(k, '', '待开始'));
    setProgress(0, 'idle');
    note.className = 'note';
    note.textContent = '约需 1–3 分钟，取决于你的数据量。过程中请不要关闭或刷新本页。';
    chips.hidden = true;
    btnStart.hidden = false;
    btnStart.disabled = false;
    btnStart.textContent = '开始导出';
    btnDownload.hidden = true;
    btnCopy.hidden = true;
  }

  async function start() {
    if (running) { cancelled = true; btnStart.textContent = '正在停止…'; return; }
    running = true;
    cancelled = false;
    data = null;
    startedAt = Date.now();
    chips.hidden = true;
    btnDownload.hidden = true;
    btnCopy.hidden = true;
    btnStart.textContent = '停止';
    btnStart.disabled = false;
    note.className = 'note';
    note.textContent = '正在连接…';
    ORDER.forEach((k) => setRow(k, '', '等待'));
    setProgress(0, 'run');

    let idx = 0;
    const onProgress = (key, msg) => {
      const i = ORDER.indexOf(key);
      if (i < 0) return;
      for (let k = 0; k < i; k++) markDone(ORDER[k]);
      if (i >= idx) {
        idx = i;
        setRow(key, 'run', msg);
        setProgress(i + 0.5, 'run');
      } else {
        setRow(key, 'run', msg);
      }
      note.textContent = '正在采集…';
    };

    let result;
    try {
      result = await window.BiliCollector.collect({ onProgress, isCancelled: () => cancelled });
    } catch (e) {
      running = false;
      setProgress(0, 'err');
      note.className = 'note err';
      note.textContent = '采集中断：' + (e && e.message ? e.message : e);
      btnStart.textContent = '重新开始';
      return;
    }

    running = false;
    const secs = Math.round((Date.now() - startedAt) / 1000);
    const dur = secs > 60 ? `${Math.floor(secs / 60)} 分 ${secs % 60} 秒` : `${secs} 秒`;

    if (result.diag && result.diag.fatal) {
      setProgress(0, 'err');
      note.className = 'note err';
      note.textContent = result.diag.fatal + '。请确认已在当前浏览器登录 B 站。';
      btnStart.textContent = '重试';
      btnStart.disabled = false;
      return;
    }

    data = result;
    const h = result.history.length;
    const f = result.followings.length;
    const fav = Object.values(result.favorites).reduce((n, v) => n + v.length, 0);
    const tv = result.toview.length;

    ORDER.forEach((k) => setRow(k, 'done', '完成'));
    setRow('history', 'done', `${h} 条`);
    setRow('following', 'done', `${f} 个`);
    setRow('favorite', 'done', `${fav} 条`);
    setRow('toview', 'done', `${tv} 条`);
    setProgress(ORDER.length, 'done');

    $('[data-c="history"]').textContent = h.toLocaleString();
    $('[data-c="following"]').textContent = f.toLocaleString();
    $('[data-c="favorite"]').textContent = fav.toLocaleString();
    chips.hidden = false;

    note.className = 'note';
    note.textContent = cancelled
      ? `已停止，用时 ${dur}。当前结果可以下载。`
      : `完成，用时 ${dur}。数据只在本机，未上传。`;

    btnStart.hidden = true;
    btnDownload.hidden = false;
    btnCopy.hidden = false;
  }

  function filename() {
    const d = new Date().toISOString().slice(0, 10);
    return `bilibili-data-${d}.json`;
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
      note.textContent = '已复制到剪贴板。';
    } catch (e) {
      const ta = document.createElement('textarea');
      ta.value = text;
      ta.style.cssText = 'position:fixed;opacity:0';
      document.body.appendChild(ta);
      ta.select();
      document.execCommand('copy');
      ta.remove();
      note.textContent = '已复制到剪贴板。';
    }
  }

  root.addEventListener('click', (e) => {
    const t = e.target.closest('[data-a]');
    if (!t) return;
    const a = t.dataset.a;
    if (a === 'toggle') {
      const willShow = panel.hidden;
      panel.hidden = !willShow;
      if (willShow && !data && !running) reset();
    } else if (a === 'close') {
      panel.hidden = true;
    } else if (a === 'start') {
      start();
    } else if (a === 'download') {
      download();
    } else if (a === 'copy') {
      copy();
    } else if (a === 'about') {
      e.preventDefault();
      try { chrome.runtime.openOptionsPage(); } catch (err) { window.open('https://www.bilibili.com', '_blank'); }
    }
  });

  $('.x').dataset.a = 'close';
})();
