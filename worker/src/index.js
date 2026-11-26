// 神諭塔羅：DeepSeek 中繼（Cloudflare Worker）
// - 網站只送「解讀依據」（解牌引擎的結果＋求問者的問題），系統提示由這裡組，不接受任意 messages，免得被拿去當免費的 AI 代理
// - 每日上限：每位求問者（IP 雜湊）DAILY_PER_USER 次、全站 DAILY_SITE 次，台灣時間午夜重置；超過回 429 quota_user／quota_site
// - GET /quota：回報今日剩餘次數，網站據此決定這一回用 AI 還是古法
// - DeepSeek 的 SSE 串流原樣轉回網站（OpenAI 相容格式，網站讀 choices[0].delta.content）
// - 金鑰放在 Worker 的 secret：DEEPSEEK_API_KEY（本機測試用 worker/.dev.vars，不進 git）
import { oracleMessages } from "../../js/oracle-prompt.js";
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
async function userKey(req) {
  const ip = req.headers.get("CF-Connecting-IP") || "anon";
  const h = await crypto.subtle.digest("SHA-256", new TextEncoder().encode("oracle-tarot:" + ip));
  return [...new Uint8Array(h)].slice(0, 12).map(b => b.toString(16).padStart(2, "0")).join(""); // 不存原始 IP
}
async function quota(req, env) {
  const day = twDay(), u = await userKey(req);
  const ku = `d:${day}:u:${u}`, ks = `d:${day}:site`;
  const [nu, ns] = await Promise.all([env.QUOTA.get(ku), env.QUOTA.get(ks)]).then(v => v.map(x => +x || 0));
  const lu = +env.DAILY_PER_USER || 5, ls = +env.DAILY_SITE || 100;
  // QUOTA_OFF="1"：暫時不限每日次數（仍照記次數，方便觀察用量；每分鐘防洗頻照舊）
  if (env.QUOTA_OFF === "1") return { ku, ks, nu, ns, lu, ls, unlimited: true, user: 999, site: 999 };
  return { ku, ks, nu, ns, lu, ls, user: Math.max(0, lu - nu), site: Math.max(0, ls - ns) };
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
      return json({ user: q.user, site: q.site, perUser: q.lu, perSite: q.ls, unlimited: !!q.unlimited }, 200, h);
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

    // 每日上限：先檢查再記一次
    const q = await quota(req, env);
    if (q.site <= 0) return json({ error: "quota_site", perSite: q.ls }, 429, h);
    if (q.user <= 0) return json({ error: "quota_user", perUser: q.lu }, 429, h);
    await Promise.all([env.QUOTA.put(q.ku, String(q.nu + 1), { expirationTtl: 172800 }), env.QUOTA.put(q.ks, String(q.ns + 1), { expirationTtl: 172800 })]);

    const upstream = await fetch("https://api.deepseek.com/chat/completions", {
      method: "POST",
      headers: { Authorization: `Bearer ${env.DEEPSEEK_API_KEY}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        model: env.MODEL || "deepseek-flash",
        messages: oracleMessages(basis),
        stream: true,
        thinking: { type: "disabled" }, // 不先「思考」：直接串流正文，求問者不必乾等
        max_tokens: 1600,
        temperature: 1.0
      })
    });
    if (!upstream.ok || !upstream.body) {
      const detail = await upstream.text().catch(() => "");
      console.log("deepseek error", upstream.status, detail.slice(0, 300));
      return json({ error: upstream.status === 429 ? "rate_limited" : "upstream" }, upstream.status === 429 ? 429 : 502, h);
    }
    return new Response(upstream.body, { status: 200, headers: { ...h, "Content-Type": "text/event-stream; charset=utf-8", "Cache-Control": "no-cache", "X-Quota-User": q.unlimited ? "-1" : String(q.user - 1), "Access-Control-Expose-Headers": "X-Quota-User" } });
  }
};
