// 塔羅解牌引擎（不需要 AI）
// 流程：判斷問題類型 → 依類型取各牌在該位置的解讀 → 加權計分得出傾向 → 組合與趨勢 → 輸出「解讀依據」R
// R 是結構化資料：網頁依它組出文字；AI 細說也把 R 原封不動交給模型當依據，確保兩者結論一致。
// 未來姓名學、八字、紫微、星座等模組都輸出同樣形狀的 R（system、verdict、sections…），前端共用。
import { CONFIG } from "../config.js";
import { CARDS, SPREADS, WEIGHTS, TOPIC, ADVICE, SCORE_UP, SCORE_REV, COMBOS, SUBMETA, META, SUITS, SUIT_LENS } from "./data.js";

const TOPIC_NAME = { love: "愛與情感", career: "事業與學業", money: "財貨與交易", gen: "命運的全貌" };
const KW = {
  love: /感情|戀|愛|喜歡|交往|復合|曖昧|男友|女友|對象|桃花|婚|分手|另一半|伴侶|前任|暗戀|告白|約會/g,
  career: /工作|事業|職|升遷|面試|老闆|主管|同事|公司|創業|考試|學業|專案|生意|業績|錄取/g,
  money: /錢|財|投資|股|收入|薪|買房|負債|債|理財|賺|存款|基金/g
};
const LEVEL_TEXT = ["好兆頭很明顯，你想要的事正順風前進。", "門已經開了一條縫，你只要伸手就推得開。", "天平還在搖擺，會倒向哪邊，就看你的下一步。", "前面起了霧，時機還沒成熟，硬求也沒有用。", "這條路暫時走不通，先停下腳步，等更好的時機。"];
const LEVEL_DETAIL = ["整個牌面都很明亮，事情正往你希望的方向走。", "局勢站在你這邊，但結果還是要靠你親手去拿。", "牌面好壞各半；現在，你正站在岔路口。", "牌說時機還沒成熟；先解開眼前的結，比硬闖更好。", "牌在提醒你：這條路現在很難走通。換一種走法，或換個時間，也許會有不同的結果。"];
const PARENTS = ["gen", "love", "career", "money", "health", "growth"];
const levelOf = s => (s >= 2.5 ? 0 : s >= 1 ? 1 : s > -1 ? 2 : s > -2.5 ? 3 : 4);

// 外部擴充資料（data/frames.json、data/major/NN.json），沒有也能運作
export const EXT = { frames: null, cards: {} };
export async function loadExtData(base = "data/") {
  const get = u => fetch(u).then(r => (r.ok ? r.json() : null)).catch(() => null);
  const [fr, ...cards] = await Promise.all([get(base + "frames.json"), ...CARDS.map((_, i) => get(`${base}major/${String(i).padStart(2, "0")}.json`))]);
  EXT.frames = fr;
  cards.forEach((d, i) => { if (d && d.topics) EXT.cards[i] = d; });
}

export function detectTopic(q, sel) {
  if (sel && sel !== "auto") {
    const m = SUBMETA[sel];
    return { sub: PARENTS.includes(sel) ? null : sel, parent: m[0], label: m[1], source: "manual" };
  }
  const ql = q.toLowerCase();
  if (EXT.frames) {
    let best = null, n = 0;
    for (const s of EXT.frames.subs) { const m = s.re.filter(w => ql.includes(w.toLowerCase())).length; if (m > n) { n = m; best = s; } }
    if (best) return { sub: best.id, parent: best.parent, label: best.label, source: "auto" };
  }
  let p = "gen", n = 0;
  for (const k in KW) { const m = (q.match(KW[k]) || []).length; if (m > n) { n = m; p = k; } }
  return { sub: null, parent: p, label: TOPIC_NAME[p], source: "auto" };
}

const ori = c => (c.rev ? "rev" : "up");
const pick = (arr, seed, k) => arr[(seed + k * 7) % arr.length];
const nmo = c => `${CARDS[c.i][0]}${c.rev ? "逆位" : "正位"}`;

function cardText(c, t, k, seed) {
  const d = EXT.cards[c.i];
  if (t.sub && d && d.topics[t.sub]) return { text: pick(d.topics[t.sub][ori(c)], seed, k), level: "子題" };
  const ti = { love: 0, career: 2, money: 4 }[t.parent];
  if (ti !== undefined) return { text: TOPIC[c.i][ti + (c.rev ? 1 : 0)], level: "主題" };
  const m = META[c.i];
  if (m.arcana === "minor" && SUIT_LENS[t.parent]) return { text: (c.rev ? CARDS[c.i][4] : CARDS[c.i][3]) + SUIT_LENS[t.parent][m.suit][c.rev ? 1 : 0], level: "主題" };
  return { text: c.rev ? CARDS[c.i][4] : CARDS[c.i][3], level: "基本牌義" };
}
const cardAdvice = (c, k, seed) => (EXT.cards[c.i] && EXT.cards[c.i].advice ? pick(EXT.cards[c.i].advice[ori(c)], seed, k + 3) : ADVICE[c.i][c.rev ? 1 : 0]);
const cardTiming = c => (EXT.cards[c.i] && EXT.cards[c.i].timing ? EXT.cards[c.i].timing[ori(c)] : null);
const score = c => (EXT.cards[c.i] && EXT.cards[c.i].score ? EXT.cards[c.i].score[ori(c)] : c.rev ? SCORE_REV[c.i] : SCORE_UP[c.i]);

/** @returns 解讀依據 R */
export function buildReading({ question, topicSel, spread, picked, seed }) {
  const t = detectTopic(question, topicSel), pos = SPREADS[spread].positions, w = WEIGHTS[spread];
  const cards = picked.map((c, k) => {
    const r = cardText(c, t, k, seed);
    return { position: pos[k], id: c.i, name: CARDS[c.i][0], en: CARDS[c.i][1], orientation: c.rev ? "逆位" : "正位", rev: c.rev, keywords: CARDS[c.i][2], arcana: META[c.i].arcana === "major" ? "大阿爾克那" : `小阿爾克那・${SUITS[META[c.i].suit].zh}`, element: { fire: "火", water: "水", air: "風", earth: "土" }[META[c.i].element], score: score(c), weight: w[k], reading: r.text, source: r.level, advice: cardAdvice(c, k, seed), timing: cardTiming(c) };
  });
  const R = { system: "tarot", seed, question, topic: t, spread: { id: spread, positions: pos }, cards, combos: [], notes: [] };
  R.dignity = dignities(picked, spread);
  R.dignity.forEach(d => { if (d.k !== undefined) cards[d.k].score = +(cards[d.k].score * d.mult).toFixed(2); });
  if (spread === "choice") {
    const d = cards[0].score - cards[1].score;
    R.comparison = { favored: d >= 1 ? "左徑" : d <= -1 ? "右徑" : "相當", diff: d };
    const a = cards[0].score, b = cards[1].score;
    R.verdict = {
      level: Math.abs(d) >= 1 ? 1 : 2,
      text: d >= 1 ? "左徑的光比較亮。" : d <= -1 ? "右徑的光比較亮。" : "兩條路差不多亮，答案在第三張牌裡。",
      detail: `左徑上是${nmo(picked[0])}，右徑上是${nmo(picked[1])}；` + (a < 0 && b < 0 ? "兩條路現在都有荊棘，" + (Math.abs(d) >= 1 ? "只是其中一條比較好走。" : "很難分出高下。") : a > 0 && b > 0 ? "兩條路都走得通，" + (Math.abs(d) >= 1 ? "但其中一條更順。" : "各有各的好。") : Math.abs(d) >= 1 ? "兩條路的狀況明顯不同。" : "兩條路各有得失。")
    };
  } else {
    const s = cards.reduce((a, c) => a + c.score * c.weight, 0), lv = levelOf(s);
    const fv = t.sub && EXT.frames && EXT.frames.verdicts && EXT.frames.verdicts[t.sub];
    R.verdict = { level: lv, score: +s.toFixed(2), text: fv ? fv[lv] : LEVEL_TEXT[lv], detail: LEVEL_DETAIL[lv] };
  }
  if (spread === "time") { const a = cards[1].score, b = cards[2].score; R.trend = b > a ? "上升" : b < a ? "下降" : "持平"; }
  const ids = picked.map(c => c.i);
  R.combos = COMBOS.filter(([p]) => p.every(x => ids.includes(x))).map(c => c[1]);
  R.reversedCount = picked.filter(c => c.rev).length;
  const key = spread === "choice" ? cards[2] : cards[cards.length - 1];
  R.advice = [key.advice];
  if (cards.length > 1 && spread !== "choice" && cards[1] !== key) R.advice.push(cards[1].advice);
  R.timing = key.timing;
  if (t.sub && EXT.frames && EXT.frames.notes && EXT.frames.notes[t.sub]) R.notes.push(EXT.frames.notes[t.sub]);
  R.synthesis = synthesize(R, picked, seed);
  // 神諭語氣：0–1 祝福、2 中性、3–4 警示（決定女祭司的立繪）
  R.tone = R.verdict.level <= 1 ? "bless" : R.verdict.level >= 3 ? "warn" : "neutral";
  return R;
}

// ---------------- 整體牌陣的判讀 ----------------
// 依據：
// - 元素尊貴（Elemental Dignities）：金色黎明會《Book T》的規則——同元素相強；火與風、水與土相友；
//   火與土、風與水溫和相合；火與水、風與土相剋。三張牌時，中間一張受左右兩張影響，兩側皆相剋則大受削弱。
// - 花色主導、大牌比例、宮廷牌、逆位比例、重複的數字：現代偉特體系常用的整體觀察法。
const EL_ZH = { fire: "火", water: "水", air: "風", earth: "土" };
const EL_REALM = { fire: "意志與行動", water: "情感與關係", air: "思慮與言語", earth: "身體、財貨與日常" };
const rel = (a, b) => (a === b ? "same" : (a === "fire" && b === "water") || (a === "water" && b === "fire") || (a === "air" && b === "earth") || (a === "earth" && b === "air") ? "contrary" : (a === "fire" && b === "air") || (a === "air" && b === "fire") || (a === "water" && b === "earth") || (a === "earth" && b === "water") ? "friend" : "mild");
const REL_FX = { same: 1.25, friend: 1.15, mild: 1, contrary: 0.6 };
const nm = c => `${CARDS[c.i][0]}${c.rev ? "逆位" : "正位"}`;

function dignities(picked, spread) {
  if (picked.length !== 3 || spread === "choice") return [];
  const el = picked.map(c => META[c.i].element), out = [];
  const L = rel(el[1], el[0]), Rr = rel(el[1], el[2]);
  const mult = +(Math.sqrt(REL_FX[L] * REL_FX[Rr])).toFixed(2);
  if (L === "contrary" && Rr === "contrary") out.push({ k: 1, mult: 0.5, kind: "weak", text: `${nm(picked[1])}夾在兩張相剋的牌中間（${el[0] === el[2] ? `兩邊的${EL_ZH[el[0]]}` : `${EL_ZH[el[0]]}和${EL_ZH[el[2]]}`}都剋它的${EL_ZH[el[1]]}），它的力量被大大削弱，不管是好是壞，都只剩一半。` });
  else if (L === "contrary" || Rr === "contrary") { const o = L === "contrary" ? 0 : 2; out.push({ k: 1, mult, kind: "strain", text: `${nm(picked[o])}與${nm(picked[1])}相剋（${EL_ZH[el[o]]}與${EL_ZH[el[1]]}），兩股力量彼此拉扯，中間這張牌的意思打了折扣。` }); }
  else if ((L === "same" || L === "friend") && (Rr === "same" || Rr === "friend")) out.push({ k: 1, mult, kind: "strong", text: `三張牌的元素彼此相合（${el.map(e => EL_ZH[e]).join("、")}），力量順暢地流過整個牌陣；中間的${nm(picked[1])}因此特別有力。` });
  return out;
}

const NUM_MEAN = ["", "開端與種子", "平衡、抉擇與相對", "成長、表達與合作", "穩定、結構與停留", "衝突、失去與變動", "和諧、給予與過渡", "考驗、評估與內省", "推進、力量與精熟", "將近圓滿，獨自收成", "一個循環的終點，也是下一輪的起點"];
const COURT_MEAN = { 11: ["侍者", "訊息、學習與剛起步的事"], 12: ["騎士", "行動、變動與追尋"], 13: ["皇后", "內在的成熟與涵養"], 14: ["國王", "外在的掌控與擔當"] };
const COURT_TRAIT = { fire: "熱情而果敢", water: "溫柔而善感", air: "敏銳而直言", earth: "務實而可靠" };
const V = (arr, seed, k = 0) => arr[(seed + k * 5) % arr.length];

function synthesize(R, picked, seed) {
  const out = [], n = picked.length, M = picked.map(c => META[c.i]);
  const majors = M.filter(m => m.arcana === "major").length;
  const S = s => out.push(s);
  // 大牌比例（只用大牌的牌組時每張都是大牌，這段觀察沒有意義，略過）
  if (CONFIG.MAJOR_ONLY) {}
  else if (n === 1) {
    if (majors) S({ kind: "major", text: V(["抽到的是一張大牌，今天不是普通的一天，有更大的力量在推動你。", "這一張就是大牌，表示這件事不小，是命運給你的一道指示。"], seed) });
    else S({ kind: "element", text: `這是一張${SUITS[M[0].suit].zh}，屬${EL_ZH[M[0].element]}，今天的事情，重心落在${EL_REALM[M[0].element]}上。` });
  } else if (majors === n) S({ kind: "major", text: V(["三張都是大牌，這件事不簡單，背後有命運在推動；你能做的是順應和選擇，沒辦法完全掌控。", "全部都是大牌，這是人生的一道關口，比平常的起起落落重要得多。"], seed) });
  else if (majors === n - 1 && n > 2) S({ kind: "major", text: "大牌佔了多數，這件事牽動的比表面看起來更深；有些部分已經不是你一個人能左右的。" });
  else if (majors === 0) S({ kind: "major", text: V(["牌裡沒有大牌，這件事屬於日常層面，結果大多握在你自己手上。", "沒有大牌出現，命運沒有重重壓下來，這件事你可以親手調整。"], seed) });
  else if (majors === 1 && n > 2) { const k = M.findIndex(m => m.arcana === "major"); S({ kind: "pivot", cards: [k], text: `${nm(picked[k])}是唯一的大牌，也是整件事的關鍵；另外兩張牌，都繞著它轉。` }); }
  // 花色主導
  if (n > 1) {
    const cnt = {}; M.forEach(m => m.suit && (cnt[m.suit] = (cnt[m.suit] || 0) + 1));
    const top = Object.entries(cnt).sort((a, b) => b[1] - a[1])[0];
    if (top && top[1] >= 2) { const su = SUITS[top[0]]; S({ kind: "element", cards: M.map((m, k) => (m.suit === top[0] ? k : -1)).filter(k => k >= 0), text: `${top[1] === n ? "三張全是" : "兩張是"}${su.zh}，${EL_ZH[su.element]}元素主導這次的牌，這件事的重心在${EL_REALM[su.element]}。` }); }
    // 重複的數字
    const byRank = {}; M.forEach((m, k) => m.rank && (byRank[m.rank] = [...(byRank[m.rank] || []), k]));
    for (const r in byRank) if (byRank[r].length >= 2) {
      const ks = byRank[r];
      S({ kind: "number", cards: ks, text: r > 10 ? `${ks.length === 3 ? "三" : "兩"}張${COURT_MEAN[r][0]}同時出現，牌在一再提醒你留意：${COURT_MEAN[r][1]}。` : `數字${"〇一二三四五六七八九十"[r]}重複出現，牌在反覆說同一件事：${NUM_MEAN[r]}。` });
    }
  }
  // 宮廷牌：可能是求問者自己的一面，或身邊的人
  M.forEach((m, k) => { if (m.court) S({ kind: "court", cards: [k], text: `${nm(picked[k])}是一張宮廷牌，它可能是你現在的某一面，也可能是你身邊一位${COURT_TRAIT[m.element]}的人（不分男女），在這件事裡扮演某個角色。` }); });
  // 元素尊貴
  R.dignity.forEach(d => S({ kind: "dignity", cards: [0, 1, 2], text: d.text }));
  // 逆位比例
  const rv = picked.filter(c => c.rev).length;
  if (n > 1 && rv === n) S({ kind: "rev", cards: picked.map((_, k) => k), text: "所有牌都是逆位，力量全都往內收、卡住了，或還沒成形。現在別硬推，先安頓好你心裡的事。" });
  else if (n > 1 && rv >= 2) S({ kind: "rev", cards: picked.map((c, k) => (c.rev ? k : -1)).filter(k => k >= 0), text: `這次有 ${rv} 張牌是逆位，力量卡住了，很多事還悶在心裡，或是還沒準備好。先別急著要結果，靜下心來再說。` });
  else if (n > 2 && rv === 0) S({ kind: "rev", text: "三張都是正位，力量暢通，沒有被擋住的地方；該做的，就是往前走。" });
  return out;
}

/** 把 R 組成段落（每段標明對應的牌，供解讀與牌互相高亮） */
export function readingParagraphs(R) {
  const C = R.cards, b = c => `<b>${c.name}${c.orientation}</b>`, out = [];
  const P = (cards, html, kind = "p") => out.push({ cards, html, kind });
  const id = R.spread.id;
  const sd = R.seed || 0, v = (a, k) => a[(sd + k * 3) % a.length];
  if (id === "one") P([0], `${v(["今天抽到的是", "火光中，浮現出", "巨蟒的目光落在"], 0)}${b(C[0])}。${C[0].reading}`);
  else if (id === "time") {
    P([], "往昔・此刻・將臨", "h");
    P([0], `${v(["先看過去。", "回到起點。", "這件事的根，埋在過去。"], 1)}${b(C[0])}是它的源頭。${C[0].reading}`);
    P([1], `${v(["那股力量一路延續到現在。", "接著來到現在。", "現在，"], 2)}${b(C[1])}反映出你眼前的處境。${C[1].reading}`);
    P([2], `如果照現在的步調走下去，在前面等著你的是${b(C[2])}。${C[2].reading}` + (R.trend === "下降" ? "牌在提醒：步調如果不調整，情況會慢慢往下走。" : R.trend === "上升" ? "運勢正在往上走；愈往前，天色愈亮。" : ""));
  } else if (id === "choice") {
    P([], "兩條路", "h");
    P([0], `左徑上出現的是${b(C[0])}。${C[0].reading}`);
    P([1], `右徑上出現的是${b(C[1])}。${C[1].reading}`);
    P([2], `不管你選哪一條路，${b(C[2])}都有一句話要告訴你。${C[2].reading}`);
  } else {
    P([], "身・心・靈", "h");
    P([0], `「身」是你在現實生活中的狀態，這裡出現了${b(C[0])}：${C[0].reading}`);
    P([1], `「心」是你的情感和想法，這裡出現了${b(C[1])}：${C[1].reading}`);
    P([2], `「靈」是你心底更深的渴望，${b(C[2])}在這裡輕聲說：${C[2].reading}`);
  }
  if (R.combos.length) { P([], "牌與牌的呼應", "h"); R.combos.forEach(x => P(C.map((_, k) => k), x, "combo")); }
  if (R.synthesis && R.synthesis.length) { P([], "牌陣全貌", "h"); R.synthesis.forEach(x => P(x.cards || [], x.text, "synth")); }
  P([], "神諭給你的建議", "h");
  P([], R.advice[0] + (R.advice[1] ? "另外，" + R.advice[1] : ""));
  if (R.timing) { P([], "時機", "h"); P([], R.timing); }
  R.notes.forEach(n => P([], n, "note"));
  return out;
}

export function readingPlainText(R) {
  const tmp = document.createElement("div");
  const body = readingParagraphs(R).map(p => { tmp.innerHTML = p.html; return tmp.textContent; }).join("\n");
  return (R.question ? `你的問題：${R.question}\n` : "") + R.cards.map(c => `${c.position}：${c.name}${c.orientation}`).join("　") + `\n\n${R.verdict.text}${R.verdict.detail}\n\n` + body;
}
