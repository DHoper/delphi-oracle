// 神諭塔羅：DeepSeek 中繼（Cloudflare Worker）
// - 網站只送「解讀依據」（解牌引擎的結果），系統提示由這裡組，不接受任意 messages，免得被拿去當免費的 AI 代理
// - DeepSeek 的 SSE 串流原樣轉回網站（OpenAI 相容格式，網站讀 choices[0].delta.content）
// - 金鑰放在 Worker 的 secret：DEEPSEEK_API_KEY（本機測試用 worker/.dev.vars，不進 git）
import { oracleMessages } from "../../js/oracle-prompt.js";

const MAX_BASIS = 8000; // 解讀依據 JSON 的長度上限（三張牌的依據約 2–3 千字）

function cors(req, env) {
  const origin = req.headers.get("Origin") || "";
  const allow = (env.ALLOWED_ORIGINS || "").split(",").map(s => s.trim()).filter(Boolean);
  const ok = allow.includes(origin) || /^http:\/\/(localhost|127\.0\.0\.1)(:\d+)?$/.test(origin);
  return {
    "Access-Control-Allow-Origin": ok ? origin : allow[0] || "null",
    "Access-Control-Allow-Methods": "POST, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type",
    "Access-Control-Max-Age": "86400",
    Vary: "Origin"
  };
}
const json = (obj, status, headers) => new Response(JSON.stringify(obj), { status, headers: { ...headers, "Content-Type": "application/json; charset=utf-8" } });

export default {
  async fetch(req, env) {
    const h = cors(req, env);
    if (req.method === "OPTIONS") return new Response(null, { status: 204, headers: h });
    if (req.method !== "POST") return json({ error: "method_not_allowed" }, 405, h);
    if (h["Access-Control-Allow-Origin"] !== req.headers.get("Origin")) return json({ error: "origin_not_allowed" }, 403, h);

    // 速率限制：每個 IP 每分鐘數次（wrangler.toml 的 ratelimits）
    if (env.RL) {
      const ip = req.headers.get("CF-Connecting-IP") || "anon";
      const { success } = await env.RL.limit({ key: ip });
      if (!success) return json({ error: "rate_limited" }, 429, h);
    }

    let basis;
    try {
      const raw = await req.text();
      if (raw.length > MAX_BASIS) return json({ error: "too_large" }, 413, h);
      basis = JSON.parse(raw).basis;
    } catch (_) { return json({ error: "bad_json" }, 400, h); }
    if (!basis || typeof basis !== "object" || !Array.isArray(basis.牌) || !basis.牌.length || basis.牌.length > 10) return json({ error: "bad_basis" }, 400, h);

    const upstream = await fetch("https://api.deepseek.com/chat/completions", {
      method: "POST",
      headers: { Authorization: `Bearer ${env.DEEPSEEK_API_KEY}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        model: env.MODEL || "deepseek-flash",
        messages: oracleMessages(basis),
        stream: true,
        thinking: { type: "disabled" }, // 不先「思考」：直接串流正文，求問者不必乾等
        max_tokens: 1400,
        temperature: 1.0
      })
    });
    if (!upstream.ok || !upstream.body) {
      const detail = await upstream.text().catch(() => "");
      console.log("deepseek error", upstream.status, detail.slice(0, 300));
      return json({ error: upstream.status === 429 ? "rate_limited" : "upstream" }, upstream.status === 429 ? 429 : 502, h);
    }
    return new Response(upstream.body, { status: 200, headers: { ...h, "Content-Type": "text/event-stream; charset=utf-8", "Cache-Control": "no-cache" } });
  }
};
