// 女祭司的系統提示只有一份：ai/oracle-system.txt（完整人設說明見根目錄 AI人設.md）。
// 網站（Claude 預覽）與 Cloudflare Worker 都讀這一份：Worker 每 5 分鐘到網站重抓一次，
// 所以改提示詞只要推上 GitHub，不必重新部署 Worker（網站抓不到時，Worker 用部署時打包進去的那一份）。
export const PROMPT_PATH = "ai/oracle-system.txt";
export const oracleMessages = (basis, system) => [
  { role: "system", content: system },
  { role: "user", content: "解讀依據：\n" + JSON.stringify(basis, null, 1) }
];
