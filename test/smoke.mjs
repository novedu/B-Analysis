/**
 * 冒烟测试：用假的 fetch 跑一遍完整采集，再模拟"中断 → 续跑"，比对两次结果是否一致。
 * 运行：node test/smoke.mjs
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
globalThis.window = { __BFX_PACE__: 0 };
eval(fs.readFileSync(path.join(ROOT, 'src/collector.js'), 'utf8'));
const { collect, toOutput, pending } = window.BiliCollector;

// ---------- 假数据 ----------
const hist = (n, off = 0) => Array.from({ length: n }, (_, i) => ({
  title: `v${off + i}`,
  author_name: 'up',
  author_mid: 1,
  view_at: 1700000000 + off + i,
  duration: 300,
  progress: 100,
  tname: '日常',
  history: { bvid: `BVhist${off + i}`, oid: off + i, business: 'archive' }
}));

const follow = (from, to) => Array.from({ length: to - from }, (_, i) => ({
  mid: from + i, uname: `u${from + i}`, sign: '', official_verify: null, vip: null, mtime: 1600000000 + from + i
}));

function makeFetch({ failAfter = Infinity } = {}) {
  let calls = 0;
  return async (url) => {
    calls++;
    if (calls > failAfter) return { status: 200, text: async () => JSON.stringify({ code: -998, message: '模拟中断' }) };
    const u = new URL(url);
    const p = u.pathname;
    let body = { code: 0, data: {} };

    if (p.endsWith('/x/web-interface/nav')) {
      body.data = { mid: 42, uname: 'tester' };
    } else if (p.endsWith('/history/cursor')) {
      const max = Number(u.searchParams.get('max'));
      if (max === 0) body.data = { list: hist(20), cursor: { max: 20, view_at: 2, business: 'archive' } };
      else if (max === 20) body.data = { list: hist(5, 20), cursor: { max: 25, view_at: 3, business: 'archive' } };
      else body.data = { list: [], cursor: {} };
    } else if (p.endsWith('/relation/followings')) {
      const order = u.searchParams.get('order');
      const pn = Number(u.searchParams.get('pn'));
      if (order === 'desc' && pn === 1) body.data = { list: follow(1, 51) };
      else if (order === 'desc' && pn === 2) body.data = { list: follow(51, 71) };
      else if (order === 'asc' && pn === 1) body.data = { list: follow(21, 71) }; // 全重复
      else body.data = { list: [] };
    } else if (p.endsWith('/v3/fav/folder/created/list-all')) {
      body.data = { list: [{ id: 1, title: '技术' }, { id: 2, title: '出行' }] };
    } else if (p.endsWith('/v3/fav/resource/list')) {
      const id = u.searchParams.get('media_id');
      body.data = { medias: [{ bvid: `BVfav${id}a`, title: 'f1', upper: { name: 'x', mid: 2 }, duration: 60, fav_time: 1, pubtime: 1 },
                             { bvid: `BVfav${id}b`, title: 'f2', upper: { name: 'x', mid: 2 }, duration: 60, fav_time: 1, pubtime: 1 }], has_more: false };
    } else if (p.endsWith('/history/toview')) {
      body.data = { list: [{ bvid: 'BVtv1', title: 't1', owner: { name: 'o' }, duration: 60, add_at: 1, progress: -1 }] };
    }
    return { status: 200, text: async () => JSON.stringify(body) };
  };
}

let pass = 0, fail = 0;
const eq = (name, a, b) => {
  const ok = JSON.stringify(a) === JSON.stringify(b);
  console.log(`${ok ? '✓' : '✗'} ${name}${ok ? '' : `  期望 ${JSON.stringify(b)}，实际 ${JSON.stringify(a)}`}`);
  ok ? pass++ : fail++;
};

// ---------- 用例 1：完整跑一遍 ----------
globalThis.fetch = makeFetch();
let ckpt1 = null;
let st = await collect({ onCheckpoint: (s) => { ckpt1 = s; } });
let out = toOutput(st);
eq('历史条数', out.diag.history, 25);
eq('关注条数（desc+asc 去重）', out.diag.followings, 70);
eq('收藏条数', out.diag.favorites, 4);
eq('稍后再看', out.diag.toview, 1);
eq('无错误', out.diag.errors.length, 0);
eq('全部阶段完成', pending(ckpt1).length, 0);

// ---------- 用例 2：中途断网 → 续跑 ----------
globalThis.fetch = makeFetch({ failAfter: 3 });
let ckpt2 = null;
let st2 = await collect({ onCheckpoint: (s) => { ckpt2 = s; } });
eq('中断后仍有错误记录', st2.errors.length > 0, true);
eq('中断后有未完成阶段', pending(st2).length > 0, true);

globalThis.fetch = makeFetch();
let st3 = await collect({ state: st2, onCheckpoint: () => {} });
let out3 = toOutput(st3);
eq('续跑后历史条数', out3.diag.history, 25);
eq('续跑后关注条数', out3.diag.followings, 70);
eq('续跑后收藏条数', out3.diag.favorites, 4);
eq('续跑后全部完成', pending(st3).length, 0);

// ---------- 用例 3：错误码解释 ----------
const { explain } = window.BiliCollector;
eq('explain(-101) 含"登录"', explain(-101).includes('登录'), true);
eq('explain(-352) 含"风控"', explain(-352).includes('风控'), true);
eq('未知码有兜底', explain(-777).includes('-777'), true);

console.log(`\n${fail === 0 ? '全部通过' : '有失败'}：${pass} passed, ${fail} failed`);
process.exit(fail === 0 ? 0 : 1);
