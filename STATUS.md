# 接口验证记录

B 站接口并非公开 API，随时可能变更。这里记录每次验证的时间和结果，方便判断插件是否已过期。

## 最近一次验证

| 项目 | 结果 |
|---|---|
| 日期 | 2026-10-23 |
| 环境 | Chrome 140 / macOS |
| 采集结果 | 观看历史约 1200 条 · 关注 1800+ 个 · 收藏 250+ 条 · 稍后再看若干 |
| 结论 | 全部通过 |

## 各接口状态

| 接口 | 用途 | 状态 | 备注 |
|---|---|---|---|
| `/x/web-interface/nav` | 登录态 | ✅ | 未登录返回 `-101` |
| `/x/web-interface/history/cursor` | 观看历史 | ✅ | 游标分页，约 1200 条上限 |
| `/x/relation/followings` | 关注列表 | ✅ | 单向 1000 条上限，需正序+倒序 |
| `/x/v3/fav/folder/created/list-all` | 收藏夹列表 | ✅ | |
| `/x/v3/fav/resource/list` | 收藏夹内容 | ✅ | |
| `/x/v2/history/toview` | 稍后再看 | ✅ | |
| `/x/v2/history` | 观看历史（旧） | ❌ 已废弃 | 返回 `code: 0` + 空列表，看起来像"没有数据" |
| `/x/web-interface/search/history` | 搜索历史 | ❌ 不存在 | 404，服务端不下发 |
| `/x/space/wbi/arc/search` | 用户投稿 | ⚠️ | 需 wbi 签名，否则 `-352` |

## 常见错误码

| code | 含义 | 处理 |
|---|---|---|
| `-101` | 未登录 | 在 bilibili.com 登录后重试 |
| `-352` | 风控校验失败 | 等待 5–10 分钟后重试，勿提高频率 |
| `-412` / HTTP 412 | 请求被拦截 | 同上 |
| `-999` | 返回非 JSON（通常是 404 页面） | 接口路径可能已变更 |

## 如果插件失效了怎么排查

1. 打开 B 站任意页面，F12 → Console
2. 手动跑一次，看返回的 `code`：
   ```js
   fetch('/x/web-interface/history/cursor?max=0&view_at=0&business=&ps=20', { credentials: 'include' })
     .then(r => r.text()).then(t => console.log(t.slice(0, 300)))
   ```
3. 对照上面的错误码表；如果是 `-999` 或 404，说明路径变了，提 issue
