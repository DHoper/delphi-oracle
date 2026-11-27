// 神諭塔羅：DeepSeek 中繼（Cloudflare Worker）
// - 網站只送「解讀依據」（解牌引擎的結果＋求問者的問題），系統提示由這裡組，不接受任意 messages，免得被拿去當免費的 AI 代理
// - 每日上限：不限個人次數，全站每天 DAILY_TOTAL 次（預設 200，需求方 11-27 定），台灣時間午夜重置；超過回 429 quota_site
//   舊的 DAILY_PER_USER／DAILY_SITE／QUOTA_OFF 不再讀取（後台若還留著也不影響）
// - GET /quota：回報今日剩餘次數，網站據此決定這一回用 AI 還是古法
// - DeepSeek 的 SSE 串流原樣轉回網站（OpenAI 相容格式，網站讀 choices[0].delta.content）
// - 金鑰放在 Worker 的 secret：DEEPSEEK_API_KEY（本機測試用 worker/.dev.vars，不進 git）
import { oracleMessages, PROMPT_PATH } from "../../js/oracle-prompt.js";
import BUNDLED_SYSTEM from "../../ai/oracle-system.txt"; // 打包時以文字匯入（esbuild --loader:.txt=text；wrangler.toml 的 rules）

// 系統提示：每 5 分鐘到網站抓一次 ai/oracle-system.txt，改提示詞只要推上 GitHub；抓不到就用打包的那份
let sys = { t: 0, text: "" };
async function systemPrompt(env) {
  if (sys.text && Date.now() - sys.t < 300e3) return sys.text;
  try {
    const r = await fetch(new URL(PROMPT_PATH, env.SITE_URL || "https://dhoper.github.io/delphi-oracle/").href, { cf: { cacheTtl: 300 } });
    const t = r.ok ? await r.text() : "";
    if (t.length > 800 && t.includes("皮媞亞")) sys = { t: Date.now(), text: t };
  } catch (_) {}
  return sys.text || BUNDLED_SYSTEM;
}
import { handleShare } from "./share.js";

const MAX_BASIS = 9000; // 解讀依據 JSON 的長度上限（三張牌的依據約 2–3 千字）

function cors(req, env) {
  const origin = req.headers.get("Origin") || "";
  const allow = (env.ALLOWED_ORIGINS || "").split(",").map(s => s.trim()).filter(Boolean);
  const ok = allow.includes(origin) || /^http:\/\/(localhost|127\.0\.0\.1)(:\d+)?$/.test(origin);
  return {
    "Access-Control-Allow-Origin": ok ? origin : allow[0] || "null",
    "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type",
    "Access-Control-Max-Age": "86400",
    Vary: "Origin"
  };
}
const json = (obj, status, headers) => new Response(JSON.stringify(obj), { status, headers: { ...headers, "Content-Type": "application/json; charset=utf-8", "Cache-Control": "no-store" } });

// 台灣日期（UTC+8），每日次數以此分日
const twDay = () => new Date(Date.now() + 8 * 3600e3).toISOString().slice(0, 10);
async function quota(req, env) {
  const ks = `d:${twDay()}:site`;
  const ns = +(await env.QUOTA.get(ks)) || 0, ls = +env.DAILY_TOTAL || 200;
  return { ks, ns, ls, site: Math.max(0, ls - ns) };
}

export default {
  async fetch(req, env) {
    const h = cors(req, env);
    if (req.method === "OPTIONS") return new Response(null, { status: 204, headers: h });
    const url = new URL(req.url);
    // 分享連結（預覽頁與圖片給社群爬蟲讀，不檢查來源）
    if (url.pathname === "/share" || url.pathname.startsWith("/s/")) { const r = await handleShare(req, env, url, h, json); if (r) return r; }
    if (h["Access-Control-Allow-Origin"] !== req.headers.get("Origin")) return json({ error: "origin_not_allowed" }, 403, h);
    if (req.method === "GET" && url.pathname === "/quota") {
      const q = await quota(req, env);
      return json({ site: q.site, perSite: q.ls, perUser: 0 }, 200, h);
    }
    if (req.method !== "POST") return json({ error: "method_not_allowed" }, 405, h);

    // 速率限制：每個 IP 每分鐘數次（wrangler.toml 的 ratelimits）
    if (env.RL) {
      const { success } = await env.RL.limit({ key: req.headers.get("CF-Connecting-IP") || "anon" });
      if (!success) return json({ error: "rate_limited" }, 429, h);
    }

    let basis;
    try {
      const raw = await req.text();
      if (raw.length > MAX_BASIS) return json({ error: "too_large" }, 413, h);
      basis = JSON.parse(raw).basis;
    } catch (_) { return json({ error: "bad_json" }, 400, h); }
    if (!basis || typeof basis !== "object" || !Array.isArray(basis.牌) || !basis.牌.length || basis.牌.length > 10) return json({ error: "bad_basis" }, 400, h);
    // 求問者的問題：限字數、去掉換行，避免藉長文塞指令
    const qmax = +env.QUESTION_MAX || 60;
    if (typeof basis.問題 === "string") basis.問題 = basis.問題.replace(/\s+/g, " ").trim().slice(0, qmax);

    delete basis.說法提醒; // 網站過渡期附的規則摘要；新版 Worker 直接讀完整提示詞，不需要
    // 每日上限：先檢查再記一次
    const q = await quota(req, env);
    if (q.site <= 0) return json({ error: "quota_site", perSite: q.ls }, 429, h);
    await env.QUOTA.put(q.ks, String(q.ns + 1), { expirationTtl: 172800 });

    const upstream = await fetch("https://api.deepseek.com/chat/completions", {
      method: "POST",
      headers: { Authorization: `Bearer ${env.DEEPSEEK_API_KEY}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        model: env.MODEL || "deepseek-flash",
        messages: oracleMessages(basis, await systemPrompt(env)),
        stream: true,
        thinking: { type: "disabled" }, // 不先「思考」：直接串流正文，求問者不必乾等
        max_tokens: 1600,
        temperature: 0.8
      })
    });
    if (!upstream.ok || !upstream.body) {
      const detail = await upstream.text().catch(() => "");
      console.log("deepseek error", upstream.status, detail.slice(0, 300));
      return json({ error: upstream.status === 429 ? "rate_limited" : "upstream" }, upstream.status === 429 ? 429 : 502, h);
    }
    return new Response(upstream.body, { status: 200, headers: { ...h, "Content-Type": "text/event-stream; charset=utf-8", "Cache-Control": "no-cache", "X-Quota-Site": String(Math.max(0, q.site - 1)), "Access-Control-Expose-Headers": "X-Quota-Site" } });
  }
};
