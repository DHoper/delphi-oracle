// 火盆火焰與火星（Canvas 2D，加法混色）
// - 火焰位置取自 .ph-brazier（之後換成火盆素材，位置不變）
// - power：儀式階段的火勢（求問 1、洗牌 1.6、神諭 2）
// - burst(x, y, n)：落牌、翻牌時噴出的火星
export function createFire(canvas, stage, { reduced }) {
  const ctx = canvas.getContext("2d");
  let W = 0, H = 0, dpr = 1, sources = [], power = 1, powerT = 1, green = 0, greenT = 0;
  const mix = (a, b, t) => a.map((v, i) => Math.round(v + (b[i] - v) * t)).join(",");
  const parts = [], emb = [];
  function resize() {
    dpr = Math.min(devicePixelRatio || 1, 2); W = canvas.clientWidth; H = canvas.clientHeight;
    canvas.width = W * dpr; canvas.height = H * dpr; ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    const sr = stage.getBoundingClientRect();
    sources = [...stage.querySelectorAll("[data-fire]")].map(el => { const r = el.getBoundingClientRect(); return { x: r.left - sr.left + r.width / 2, y: r.top - sr.top + r.height * 0.06, w: r.width, sparks: el.dataset.fire === "sparks", altar: el.dataset.fire === "altar" }; }).filter(s => s.w > 0);
  }
  resize(); new ResizeObserver(resize).observe(canvas);

  function spawn(x, y, o = {}) {
    parts.push({ x, y, vx: (Math.random() - 0.5) * (o.spread || 0.6), vy: -(o.up || 0.6) - Math.random() * (o.up || 0.6), life: 1, decay: 0.006 + Math.random() * 0.012, size: 0.8 + Math.random() * (o.size || 1.6), hue: (o.hue != null ? o.hue : 30) + Math.random() * 20, g: o.down ? 0.05 : 0, glint: Math.random() < 0.14 });
  }
  const noise = (t, s) => Math.sin(t * 1.7 + s) * 0.5 + Math.sin(t * 3.1 + s * 2.3) * 0.3 + Math.sin(t * 7.3 + s * 5.1) * 0.2;

  function frame(t) {
    power += (powerT - power) * 0.04; green += (greenT - green) * 0.03;
    const cIn = mix([255, 238, 190], [215, 255, 215], green), cMid = mix([255, 160, 60], [60, 220, 120], green), cOut = mix([200, 60, 20], [20, 120, 60], green), cHalo = mix([255, 170, 70], [80, 230, 140], green);
    ctx.clearRect(0, 0, W, H);
    ctx.globalCompositeOperation = "lighter";
    const ts = reduced ? 0 : t / 1000;
    sources.forEach((s, i) => {
      const fw = s.w * 0.42 * (0.85 + 0.15 * power), fh = fw * (1.5 + 0.45 * power);
      // 光暈
      const flick = s.sparks ? 0.55 + 0.45 * Math.abs(noise(ts * 1.6, i * 7)) : 1;
      const g = ctx.createRadialGradient(s.x, s.y - fh * 0.3, 0, s.x, s.y - fh * 0.3, fh * 2.4 * flick);
      g.addColorStop(0, `rgba(${cHalo},${0.1 * power})`); g.addColorStop(1, `rgba(${cHalo},0)`);
      ctx.fillStyle = g; ctx.fillRect(s.x - fh * 2.4, s.y - fh * 2.7, fh * 4.8, fh * 4.8);
      // 祭壇之火：不畫成一整團火焰，而是拆成細件——貼著桌面的一層暖光、上升的細碎餘燼、幾縷細短捲曲的火舌、偶爾竄高的火星
      if (s.altar) {
        const base = ctx.createRadialGradient(s.x, s.y, 0, s.x, s.y, s.w * 0.55);
        base.addColorStop(0, `rgba(${cIn},${0.22 * power})`); base.addColorStop(0.4, `rgba(${cMid},${0.12 * power})`); base.addColorStop(1, `rgba(${cOut},0)`);
        ctx.save(); ctx.translate(s.x, s.y); ctx.scale(1, 0.22); ctx.translate(-s.x, -s.y); ctx.fillStyle = base; ctx.beginPath(); ctx.arc(s.x, s.y, s.w * 0.55, 0, 7); ctx.fill(); ctx.restore();
        if (!reduced) {
          const n = Math.min(14, Math.round(3.5 * power + Math.random() * 2));
          for (let k = 0; k < n; k++) {
            const g = (Math.random() + Math.random() + Math.random() - 1.5) / 1.5; // 近似常態：中間密、兩側疏
            emb.push({ x: s.x + g * s.w * 0.24, y: s.y - Math.random() * 3, vx: (Math.random() - 0.5) * 0.25, vy: -(0.45 + Math.random() * 1.1) * Math.sqrt(power), life: 1, d: 0.012 + Math.random() * 0.02, r: 0.7 + Math.random() * 1.6, ph: Math.random() * 7, wisp: Math.random() < 0.16, green });
          }
          if (Math.random() < 0.05 * power) emb.push({ x: s.x + (Math.random() - 0.5) * s.w * 0.2, y: s.y - 4, vx: (Math.random() - 0.5) * 0.8, vy: -(2.2 + Math.random() * 1.8) * Math.sqrt(power), life: 1, d: 0.01, r: 1.1, ph: 0, spark: true, green });
        }
      }
      if (!reduced && !s.altar && Math.random() < 0.18 * power) spawn(s.x + (Math.random() - 0.5) * fw * 0.6, s.y - fh * 0.4, { up: 0.5 * power, hue: 30 + green * 100 });
    });
    // 餘燼：白→金→橙→暗紅，越往上越小越淡；火舌是細短的弧線，隨上升左右捲動
    if (emb.length > 420) emb.splice(0, emb.length - 420);
    for (let i = emb.length - 1; i >= 0; i--) {
      const e = emb[i]; e.ph += 0.09; e.x += e.vx + Math.sin(e.ph + ts * 2) * 0.22; e.y += e.vy; e.vy *= 0.993; e.life -= e.d;
      if (e.life <= 0) { emb.splice(i, 1); continue; }
      const L = e.life, hot = e.green ? [140 + 80 * L, 255, 160 + 60 * L] : [255, 140 + 110 * L, 40 + 170 * L * L];
      const col = `rgba(${hot[0] | 0},${hot[1] | 0},${hot[2] | 0},${Math.min(1, L * 1.3) * (e.spark ? 1 : 0.85)})`;
      if (e.wisp) {
        const len = 7 + 9 * L, bend = Math.sin(e.ph * 1.7) * 4;
        ctx.strokeStyle = col; ctx.lineWidth = 0.6 + 0.9 * L; ctx.lineCap = "round";
        ctx.beginPath(); ctx.moveTo(e.x, e.y + len * 0.5); ctx.quadraticCurveTo(e.x + bend, e.y, e.x - bend * 0.4, e.y - len * 0.5); ctx.stroke();
      } else if (e.spark) {
        ctx.strokeStyle = col; ctx.lineWidth = 0.9; ctx.beginPath(); ctx.moveTo(e.x, e.y); ctx.lineTo(e.x - e.vx * 2.5, e.y - e.vy * 2.5); ctx.stroke();
      } else {
        ctx.fillStyle = col; ctx.beginPath(); ctx.arc(e.x, e.y, e.r * (0.45 + 0.55 * L), 0, 7); ctx.fill();
      }
    }
    for (let i = parts.length - 1; i >= 0; i--) {
      const p = parts[i];
      p.x += p.vx + Math.sin(ts * 2 + i) * 0.15; p.y += p.vy; p.vy = p.vy * 0.995 + p.g; p.life -= p.decay;
      if (p.life <= 0) { parts.splice(i, 1); continue; }
      // 火星：沿飛行方向的短刻線；少數是十字閃光（與畫面中的金色星點一致）
      const col = `hsla(${p.hue},100%,${62 + p.life * 25}%,${p.life})`;
      if (p.glint) {
        const r = (p.size + 1.5) * p.life * 1.6; ctx.strokeStyle = col; ctx.lineWidth = 0.8;
        ctx.beginPath(); ctx.moveTo(p.x - r, p.y); ctx.lineTo(p.x + r, p.y); ctx.moveTo(p.x, p.y - r); ctx.lineTo(p.x, p.y + r); ctx.stroke();
      } else {
        const sp = Math.hypot(p.vx, p.vy) || 1, L = 2.5 + sp * 3.2 * p.life;
        ctx.strokeStyle = col; ctx.lineWidth = Math.max(0.6, p.size * 0.55 * p.life);
        ctx.beginPath(); ctx.moveTo(p.x, p.y); ctx.lineTo(p.x - p.vx / sp * L, p.y - p.vy / sp * L); ctx.stroke();
      }
    }
    ctx.globalCompositeOperation = "source-over";
  }
  return {
    frame, resize,
    set(o) { if (o.power != null) powerT = o.power; if (o.green != null) greenT = o.green; },
    // 微塵流：從 (x0,y0) 緩緩飄向 (x1,y1)，沿途微微擺盪，抵達時熄滅（命運三女神的目光自蛇眼垂落）
    stream(x0, y0, x1, y1, n = 10) {
      if (reduced) return;
      for (let i = 0; i < n; i++) {
        const T = 70 + Math.random() * 50, sx = x0 + (Math.random() - 0.5) * 16, sy = y0 + (Math.random() - 0.5) * 8, tx = x1 + (Math.random() - 0.5) * 30, ty = y1 + (Math.random() - 0.5) * 12;
        parts.push({ x: sx, y: sy, vx: (tx - sx) / T, vy: (ty - sy) / T, life: 1, decay: 1 / T, size: 0.6 + Math.random() * 1.1, hue: 40 + Math.random() * 10, g: 0, glint: Math.random() < 0.25 });
      }
    },
    burst(x, y, n = 24, o = {}) { if (reduced) return; for (let i = 0; i < n; i++) spawn(x + (Math.random() - 0.5) * (o.w || 0), y, { spread: o.spread || 3, up: o.down ? -0.4 : o.up || 1.6, size: 2, hue: o.hue, down: o.down }); }
  };
}
