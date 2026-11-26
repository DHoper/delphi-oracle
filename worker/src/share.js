// 分享：把一則神諭（牌陣代碼、讖語、女祭司之言、可選的所問）存進 KV，換一個短連結
// - POST /share          網站送來內容與一張 1200×630 的預覽圖（JPEG base64），回傳 { id, url }
// - GET  /s/:id          給 LINE、Facebook、Threads 爬蟲看的頁面：這則神諭專屬的 og 標題、摘錄、預覽圖；真人瀏覽會轉到網站 ?s=id
// - GET  /s/:id.json     網站讀取這則神諭（朋友點開時用，不再呼叫 AI、不吃次數）
// - GET  /s/:id.jpg      預覽圖
const esc = s => String(s || "").replace(/[&<>"']/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
const ABC = "23456789abcdefghijkmnpqrstuvwxyzABCDEFGHJKLMNPQRSTUVWXYZ";
const newId = () => [...crypto.getRandomValues(new Uint8Array(8))].map(b => ABC[b % ABC.length]).join("");
const TTL = 60 * 60 * 24 * 365; // 一年
const twDay = () => new Date(Date.now() + 8 * 3600e3).toISOString().slice(0, 10);

export async function handleShare(req, env, url, cors, json) {
  const site = env.SITE_URL || "https://dhoper.github.io/delphi-oracle/";
  // 建立分享
  if (req.method === "POST" && url.pathname === "/share") {
    if (cors["Access-Control-Allow-Origin"] !== req.headers.get("Origin")) return json({ error: "origin_not_allowed" }, 403, cors);
    if (env.RL) { const { success } = await env.RL.limit({ key: "share:" + (req.headers.get("CF-Connecting-IP") || "anon") }); if (!success) return json({ error: "rate_limited" }, 429, cors); }
    const dayKey = `d:${twDay()}:share`, n = +(await env.QUOTA.get(dayKey)) || 0;
    if (n >= (+env.DAILY_SHARE || 400)) return json({ error: "quota_share" }, 429, cors);
    let b; try { const raw = await req.text(); if (raw.length > 700000) return json({ error: "too_large" }, 413, cors); b = JSON.parse(raw); } catch (_) { return json({ error: "bad_json" }, 400, cors); }
    if (!/^[0-9a-z]{6,24}$/.test(b.code || "")) return json({ error: "bad_code" }, 400, cors);
    const clip = (s, n) => String(s || "").replace(/\r/g, "").slice(0, n); // 保留空行：讖語與正文靠空行分段
    const rec = { code: b.code, omen: clip(b.omen, 40), text: clip(b.text, 1600), question: clip(b.question, 60), verdict: clip(b.verdict, 60), cards: clip(b.cards, 120), t: Date.now() };
    let img = null;
    if (typeof b.og === "string" && b.og.startsWith("data:image/jpeg;base64,")) {
      const bin = atob(b.og.slice(23)); if (bin.length > 450000) return json({ error: "image_too_large" }, 413, cors);
      img = Uint8Array.from(bin, c => c.charCodeAt(0));
    }
    const id = newId();
    await Promise.all([
      env.QUOTA.put("s:" + id, JSON.stringify(rec), { expirationTtl: TTL }),
      img ? env.QUOTA.put("o:" + id, img, { expirationTtl: TTL }) : null,
      env.QUOTA.put(dayKey, String(n + 1), { expirationTtl: 172800 })
    ]);
    return json({ id, url: `${url.origin}/s/${id}` }, 200, cors);
  }
  const m = url.pathname.match(/^\/s\/([0-9a-zA-Z]{8})(\.json|\.jpg)?$/);
  if (req.method === "GET" && m) {
    const [, id, ext] = m;
    if (ext === ".jpg") {
      const img = await env.QUOTA.get("o:" + id, "arrayBuffer");
      if (!img) return Response.redirect(site + "og.jpg", 302);
      return new Response(img, { headers: { "Content-Type": "image/jpeg", "Cache-Control": "public, max-age=31536000, immutable", "Access-Control-Allow-Origin": "*" } });
    }
    const rec = await env.QUOTA.get("s:" + id, "json");
    if (ext === ".json") return new Response(JSON.stringify(rec || { error: "not_found" }), { status: rec ? 200 : 404, headers: { "Content-Type": "application/json; charset=utf-8", "Access-Control-Allow-Origin": "*", "Cache-Control": "public, max-age=300" } });
    // 預覽頁：爬蟲讀 og 標籤；真人立刻轉到網站
    const to = rec ? `${site}?s=${id}` : site;
    const title = rec ? `神諭塔羅｜${rec.omen || rec.verdict || "一則神諭"}` : "神諭塔羅";
    const body = rec ? (rec.text || "").split(/\n\s*\n/).map(x => x.trim()).filter(Boolean) : [];
    const excerpt = rec ? ((body.length > 1 && body[0] === rec.omen ? body[1] : body[0]) || rec.verdict || "").replace(/\*\*|【[^】]{1,8}】/g, "").replace(/\s+/g, "").slice(0, 78) + "……" : "在巨蟒皮同的凝視下取一枚預兆，抽出你的牌。";
    const desc = rec && rec.cards ? `${rec.cards}｜${excerpt}` : excerpt;
    const html = `<!doctype html><html lang="zh-Hant"><head><meta charset="utf-8">
<title>${esc(title)}</title><meta name="description" content="${esc(desc)}">
<meta property="og:type" content="article"><meta property="og:site_name" content="神諭塔羅">
<meta property="og:title" content="${esc(title)}"><meta property="og:description" content="${esc(desc)}">
<meta property="og:url" content="${esc(url.origin + url.pathname)}">
<meta property="og:image" content="${esc(url.origin + "/s/" + id + ".jpg")}"><meta property="og:image:width" content="1200"><meta property="og:image:height" content="630">
<meta name="twitter:card" content="summary_large_image">
<meta http-equiv="refresh" content="0;url=${esc(to)}">
<style>body{background:#060508;color:#f3d48b;font:16px/1.8 serif;text-align:center;padding:3em 1em}</style>
</head><body><p>神殿之門正在開啟……</p><p><a style="color:#f3d48b" href="${esc(to)}">沒有自動前往的話，請點這裡</a></p>
<script>location.replace(${JSON.stringify(to)})</script></body></html>`;
    return new Response(html, { headers: { "Content-Type": "text/html; charset=utf-8", "Cache-Control": "public, max-age=600" } });
  }
  return null;
}
