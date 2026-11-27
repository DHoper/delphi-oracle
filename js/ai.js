// 「叩問神諭」：AI 以解牌引擎的結果 R 為依據，延伸說明
// 優先順序：CONFIG.AI_ENDPOINT（DeepSeek 中繼，正式環境）→ Claude 預覽環境的 sample → 不提供
// 送給中繼的只有「解讀依據」；系統提示在 oracle-prompt.js，網站與 Worker 共用
import { CONFIG } from "./config.js";
import { oracleMessages, PROMPT_PATH } from "./oracle-prompt.js";
import { MYTH } from "./tarot/myth.js";

let samplePromise = null;
function getSample() {
  if (!samplePromise) samplePromise = (window.claude && claude.use ? claude.use("sample") : Promise.resolve(null)).catch(() => null);
  return samplePromise;
}
// 今日全殿剩餘次數（由 Worker 回報；預覽環境沒有）。不限個人次數，只有全殿每天的總數
export const aiQuota = { site: null };
// 叩問前先查今日剩餘次數，讓求問者在儀式前就知道女祭司會不會開口
export async function fetchQuota() {
  if (!CONFIG.AI_ENDPOINT) return null;
  try { const r = await fetch(CONFIG.AI_ENDPOINT + "quota"); if (!r.ok) return null; const q = await r.json(); aiQuota.site = typeof q.site === "number" ? q.site : null; return q; } catch (_) { return null; }
}
export async function aiAvailable() { return !!CONFIG.AI_ENDPOINT || !!(await getSample()); }

export function aiBasis(R) {
  return {
    問題: R.question || "（求問者沒有說出問題，只取了預兆）", 所取的預兆: R.topic.label, 牌陣: R.spread.positions.join("／"), 命運女神的目光落於: { one: "單張", time: "因果", choice: "抉擇", mind: "本心" }[R.spread.id],
    // 牌意是「看事情的眼光」；不給分數、元素與現成建議，免得 AI 照念或用吉凶口吻
    牌: R.cards.map(c => ({ 位置: c.position, 牌: `${c.name}（${c.en}）${c.orientation}`, 關鍵詞: c.keywords, 牌意: c.reading, 時機: c.timing || undefined, 牌面畫的神話: MYTH[c.id] ? `${MYTH[c.id][0]}：${MYTH[c.id][c.rev ? 2 : 1]}` : undefined })),
    神諭的傾向: R.verdict.text, 傾向說明: R.verdict.detail, 二選一比較: R.comparison ? `較有利：${R.comparison.favored}` : undefined,
    二選一說明: R.spread.id === "choice" ? "左徑是求問者心裡先想到的選擇，右徑是另一個；問題裡若寫了兩個選擇，前一個是左徑" : undefined,
    揭牌時說過的話: R.glimpses && R.glimpses.length ? R.glimpses : undefined,
    // 說法提醒：與 oracle-prompt.js 的規則相同。Worker 的系統提示要重新部署才會更新，這一欄讓新規則在部署前就生效
    說法提醒: "「神諭的傾向」是總方向，結論不可相反；「牌意」是看事情的眼光，翻成他這件事裡會發生的情形，不要照念。你是替神說話的女祭司，不拿自己的喜好當答案：不說「要是我」「換作是我」「我會選……」，不用「別……」「就……吧」這種叮嚀口氣；想提醒就說成看見的走向（「我看見你走出家門，投下那一票，回來的路上腳步是輕的」）。像神殿裡的老祭司當面說話：白話，但莊嚴、帶一點神祕，不要太現代；不用流行語、網路用語、職場口頭禪（例如硬撐、內捲、躺平、擺爛、卡關、舒適圈、搞定、跟自己過不去、放過自己、想太多）。不要用「先否定一個說法、再翻轉成另一個」的寫法，換字也算（「不是A，是B」「它不保證A，是B」「不一定A，只是B」「A不重要，B才重要」「與其A不如B」）；不用「它」「這條路」這種空主詞開句；不寫放到別的問題也通的話（例如「把該做的做完」「順其自然」），每句都要只對他這件事成立；不要替他排期限（例如「這一週內就講」）；不要叫他把事情一條條寫下來、列清單、深呼吸這類功課；不要激勵打氣，也不要評價他的能力（例如「你的本事不缺」）；段落不要用漂亮的道理收尾。結尾不必說「牌只是指出方向」。最重要：開口之前，第一行先寫〔底稿：……〕，40～80字，只給你自己看（求問者看不到）：這件事實際要做什麼、在什麼地方、牽涉哪些人、他大概在顧慮什麼；抉擇牌陣再寫明左徑、右徑各指哪個選擇。寫完底稿換行，再寫讖語與正文，每一段都照底稿裡的畫面講。每一段都要落在他問的那件事本身，把牌意翻成那件事在現實裡會發生的情形（例如問要不要去投票，就講跑一趟、排隊、站在圈票處拿不定主意、家人怎麼說、開票那晚的心情），讓人不看小標也知道在講他的事；不要只把牌義換個說法重講。不拿牌當主詞（不寫「這條路的牌面不太穩」「牌是穩的」「牌面顯示」），不用穩不穩、吉不吉、有利不利的評分口吻，直接說事情會順還是會卡、卡在哪。問到選舉、政治時，不替任何候選人、政黨或議題表態，只談他自己去不去、心裡掛著什麼。小標一字不改照牌位名寫（抉擇牌陣寫【左徑】【右徑】【神示】），他的說法放在內文。神話典故是選用的，不要用神話開頭，全文最多一句，不貼切就不提。揭牌時說過的話不要重複。抉擇牌陣：問題裡若寫了兩個選擇，前一個是左徑、後一個是右徑，用他的說法稱呼；問「要不要做某件事」時，左徑是做、右徑是不做；沒寫就說「你先想到的那個選擇」「另一個選擇」。",
    趨勢: R.trend, 牌組合: R.combos.length ? R.combos : undefined, 逆位張數: R.reversedCount, 牌陣全貌: R.synthesis && R.synthesis.length ? R.synthesis.map(x => x.text) : undefined, 注意事項: R.notes.length ? R.notes : undefined
  };
}
let sysP = null;
const systemText = () => sysP || (sysP = fetch(PROMPT_PATH).then(r => r.text()));
export const aiMessages = async R => oracleMessages(aiBasis(R), await systemText());

// 女祭司開口前先寫一行〔底稿：……〕替自己把這件事想成現實畫面（求問者看不到）：
// 底稿還沒寫完前不顯示任何字，寫完就整行拿掉；模型沒寫底稿時原樣顯示
export function stripDraft(t) {
  const s = String(t || ""), lead = s.replace(/^\s+/, "");
  if (!lead) return "";
  if (!lead.startsWith("〔")) return s;
  if (lead.length < 3 && "〔底稿".startsWith(lead)) return "";
  if (!lead.startsWith("〔底稿")) return s;
  const end = lead.indexOf("〕");
  return end < 0 ? "" : lead.slice(end + 1).replace(/^\s+/, "").replace(/^讖語[:：]\s*/, "");
}
async function viaEndpoint(R, onText0) {
  const onText = t => onText0(stripDraft(t));
  const res = await fetch(CONFIG.AI_ENDPOINT, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ basis: aiBasis(R) }) });
  if (!res.ok || !res.body) {
    let info = {}; try { info = await res.json(); } catch (_) {}
    throw Object.assign(new Error("http"), { code: info.error || (res.status === 429 ? "rate_limited" : "http"), info });
  }
  const left = res.headers.get("X-Quota-Site"); if (left != null) aiQuota.site = +left;
  const rd = res.body.getReader(), dec = new TextDecoder(); let buf = "", txt = "";
  for (;;) {
    const { done, value } = await rd.read(); if (done) break;
    buf += dec.decode(value, { stream: true }); const lines = buf.split("\n"); buf = lines.pop();
    for (const l of lines) {
      const m = l.match(/^data:\s*(.*)$/); if (!m || m[1] === "[DONE]") continue;
      try { const j = JSON.parse(m[1]); const d = j.choices?.[0]?.delta?.content; if (d) { txt += d; onText(txt); } } catch (_) {}
    }
  }
  return stripDraft(txt);
}
async function viaSample(R, onText0) {
  const onText = t => onText0(stripDraft(t));
  const sample = await getSample();
  if (!sample) throw Object.assign(new Error("unavailable"), { code: "unavailable" });
  const prompt = (await aiMessages(R)).map(m => m.content).join("\n\n");
  let out = "";
  await sample(prompt, { cache: false, onText: ({ text }) => { if (text !== "Thinking...") { out = text; onText(text); } } });
  return stripDraft(out);
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
