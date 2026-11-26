# 叩問神諭：DeepSeek 中繼（Cloudflare Worker）

- 網址：https://delphi-oracle-ai.oracle-tarot.workers.dev/（填在 `js/config.js` 的 `AI_ENDPOINT`）
- 模型：`deepseek-flash`（舊名 `deepseek-v4-flash` 會自動轉過來），關閉「思考」直接串流正文
- 網站只送 `{ basis }`（解牌引擎整理的解讀依據）；系統提示在 `js/oracle-prompt.js`，網站與 Worker 共用
- 防濫用：只接受 `ALLOWED_ORIGINS` 與 localhost 的來源；每個 IP 每分鐘 6 次；依據 JSON 上限 8000 字
- Claude 預覽（artifact）的來源不在白名單，網站會自動改用 Claude 細說

## 金鑰
- 線上：Worker secret `DEEPSEEK_API_KEY`（`npx wrangler secret put DEEPSEEK_API_KEY`）
- 本機測試：`worker/.dev.vars`（已列入 .gitignore，不可提交）

## 常用指令（在 worker/ 底下）
- 本機測試：`npx wrangler dev --port 8787`
- 部署：`npx wrangler deploy`
- 看即時紀錄：`npx wrangler tail`
- 換網站網址時：改 `wrangler.toml` 的 `ALLOWED_ORIGINS` 再部署
