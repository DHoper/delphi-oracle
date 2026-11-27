// 「叩問神諭」：AI 以解牌引擎的結果 R 為依據，延伸說明
// 優先順序：CONFIG.AI_ENDPOINT（DeepSeek 中繼，正式環境）→ Claude 預覽環境的 sample → 不提供
// 送給中繼的只有「解讀依據」；系統提示在 oracle-prompt.js，網站與 Worker 共用
import { CONFIG } from "./config.js";
import { oracleMessages } from "./oracle-prompt.js";
import { MYTH } from "./tarot/myth.js";

let samplePromise = null;
function getSample() {
  if (!samplePromise) samplePromise = (window.claude && claude.use ? claude.use("sample") : Promise.resolve(null)).catch(() => null);
  return samplePromise;
}
// 今日剩餘次數（由 Worker 回報；預覽環境沒有）
export const aiQuota = { user: null };
// 叩問前先查今日剩餘次數，讓求問者在儀式前就知道女祭司會不會開口
export async function fetchQuota() {
  if (!CONFIG.AI_ENDPOINT) return null;
  try { const r = await fetch(CONFIG.AI_ENDPOINT + "quota"); if (!r.ok) return null; const q = await r.json(); aiQuota.user = q.unlimited ? null : Math.min(q.user, q.site); return q; } catch (_) { return null; }
}
export async function aiAvailable() { return !!CONFIG.AI_ENDPOINT || !!(await getSample()); }

export function aiBasis(R) {
  return {
    問題: R.question || "（求問者沒有說出問題，只取了預兆）", 所取的預兆: R.topic.label, 牌陣: R.spread.positions.join("／"), 命運女神的目光落於: { one: "此刻", time: "因果", choice: "抉擇", mind: "本心" }[R.spread.id],
    牌: R.cards.map(c => ({ 位置: c.position, 牌: `${c.name}（${c.en}）${c.orientation}`, 牌面畫的神話: MYTH[c.id] ? `${MYTH[c.id][0]}：${MYTH[c.id][c.rev ? 2 : 1]}` : undefined, 元素: c.element, 關鍵詞: c.keywords, 吉凶分數: c.score, 此位置的解讀: c.reading, 建議: c.advice, 時機: c.timing || undefined })),
    引擎判斷: R.verdict.text, 判斷說明: R.verdict.detail, 二選一比較: R.comparison ? `較有利：${R.comparison.favored}` : undefined,
    二選一說明: R.spread.id === "choice" ? "左徑是求問者心裡先想到的選擇，右徑是另一個；問題裡若寫了兩個選擇，前一個是左徑" : undefined,
    揭牌時說過的話: R.glimpses && R.glimpses.length ? R.glimpses : undefined,
    // 說法提醒：與 oracle-prompt.js 的規則相同。Worker 的系統提示要重新部署才會更新，這一欄讓新規則在部署前就生效
    說法提醒: "像神殿裡的老祭司當面說話：白話，但莊嚴、帶一點神祕，不要太現代；不用流行語、網路用語、職場口頭禪（例如硬撐、內捲、躺平、擺爛、卡關、舒適圈、搞定）。不要用「不是A，是B」「不是A，而是B」「與其A不如B」這類句型；不要替他排期限（例如「這一週內就講」）；不要叫他把事情一條條寫下來、列清單、深呼吸這類功課；不要激勵打氣，也不要評價他的能力（例如「你的本事不缺」）；段落不要用漂亮的道理收尾。結尾不必說「牌只是指出方向」。神話典故是選用的，不要用神話開頭，全文最多一句，不貼切就不提。揭牌時說過的話不要重複。抉擇牌陣：問題裡若寫了兩個選擇，前一個是左徑、後一個是右徑，用他的說法稱呼；沒寫就說「你先想到的那個選擇」「另一個選擇」。",
    趨勢: R.trend, 牌組合: R.combos.length ? R.combos : undefined, 逆位張數: R.reversedCount, 牌陣全貌: R.synthesis && R.synthesis.length ? R.synthesis.map(x => x.text) : undefined, 注意事項: R.notes.length ? R.notes : undefined
  };
}
export const aiMessages = R => oracleMessages(aiBasis(R));

async function viaEndpoint(R, onText) {
  const res = await fetch(CONFIG.AI_ENDPOINT, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ basis: aiBasis(R) }) });
  if (!res.ok || !res.body) {
    let info = {}; try { info = await res.json(); } catch (_) {}
    throw Object.assign(new Error("http"), { code: info.error || (res.status === 429 ? "rate_limited" : "http"), info });
  }
  const left = res.headers.get("X-Quota-User"); if (left != null) aiQuota.user = +left < 0 ? null : +left;
  const rd = res.body.getReader(), dec = new TextDecoder(); let buf = "", txt = "";
  for (;;) {
    const { done, value } = await rd.read(); if (done) break;
    buf += dec.decode(value, { stream: true }); const lines = buf.split("\n"); buf = lines.pop();
    for (const l of lines) {
      const m = l.match(/^data:\s*(.*)$/); if (!m || m[1] === "[DONE]") continue;
      try { const j = JSON.parse(m[1]); const d = j.choices?.[0]?.delta?.content; if (d) { txt += d; onText(txt); } } catch (_) {}
    }
  }
  return txt;
}
async function viaSample(R, onText) {
  const sample = await getSample();
  if (!sample) throw Object.assign(new Error("unavailable"), { code: "unavailable" });
  const prompt = aiMessages(R).map(m => m.content).join("\n\n");
  let out = "";
  await sample(prompt, { cache: false, onText: ({ text }) => { if (text !== "Thinking...") { out = text; onText(text); } } });
  return out;
}

/** 串流細說；onText(全文) 每次收到新文字時呼叫 */
export async function aiReading(R, onText) {
  if (CONFIG.AI_ENDPOINT) {
    try { return await viaEndpoint(R, onText); }
    catch (e) {
      // 中繼連不上（例如在 Claude 預覽的沙盒裡）就改用 Claude；速率限制則照實回報
      if (e.code === "rate_limited" || /^quota_/.test(e.code || "") || !(await getSample())) throw e;
    }
  }
  return viaSample(R, onText);
}
