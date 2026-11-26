// 火盆火焰與火星（Canvas 2D，加法混色）
// - 火焰位置取自 .ph-brazier（之後換成火盆素材，位置不變）
// - power：儀式階段的火勢（求問 1、洗牌 1.6、神諭 2）
// - burst(x, y, n)：落牌、翻牌時噴出的火星
export function createFire(canvas, stage, { reduced }) {
  const ctx = canvas.getContext("2d");
  let W = 0, H = 0, dpr = 1, sources = [], power = 1, powerT = 1, green = 0, greenT = 0;
  const mix = (a, b, t) => a.map((v, i) => Math.round(v + (b[i] - v) * t)).join(",");
  const parts = [];
  function resize() {
    dpr = Math.min(devicePixelRatio || 1, 2); W = canvas.clientWidth; H = canvas.clientHeight;
    canvas.width = W * dpr; canvas.height = H * dpr; ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    const sr = stage.getBoundingClientRect();
    sources = [...stage.querySelectorAll("[data-fire]")].map(el => { const r = el.getBoundingClientRect(); return { x: r.left - sr.left + r.width / 2, y: r.top - sr.top + r.height * 0.06, w: r.width, sparks: el.dataset.fire === "sparks" }; }).filter(s => s.w > 0);
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
      // 火舌：以線刻筆觸畫成——一束由盆口升起、彼此交纏的弧線，像銅版畫裡的火焰，而不是柔光球
      if (!s.sparks) {
        // 柔和的火心（墊在線條下，讓線束讀起來是火）
        const core = ctx.createRadialGradient(s.x, s.y - fh * 0.25, 0, s.x, s.y - fh * 0.25, fw * 0.75);
        core.addColorStop(0, `rgba(${cMid},.35)`); core.addColorStop(1, `rgba(${cOut},0)`);
        ctx.fillStyle = core; ctx.fillRect(s.x - fw, s.y - fh, fw * 2, fh * 1.2);
        const N = 19, lw = Math.max(0.9, fw / 30);
        const grad = ctx.createLinearGradient(0, s.y, 0, s.y - fh * 1.15);
        grad.addColorStop(0, `rgba(${cIn},.95)`); grad.addColorStop(0.5, `rgba(${cMid},.8)`); grad.addColorStop(1, `rgba(${cOut},0)`);
        ctx.strokeStyle = grad; ctx.lineCap = "round";
        // 三道火舌，各自搖曳；每條線向最近的火舌尖收攏
        const tongues = [-0.28, 0, 0.3].map((c, j) => ({ x: s.x + c * fw + noise(ts * 1.9, j * 4 + i) * fw * 0.22, h: fh * [0.7, 1.05, 0.78][j] * (0.85 + 0.25 * Math.abs(noise(ts * 2.4, j * 2 + i))) }));
        for (let k = 0; k < N; k++) {
          const u = k / (N - 1) - 0.5, T = tongues[u < -0.17 ? 0 : u > 0.17 ? 2 : 1];
          const bx = s.x + u * fw * 1.05, f = 0.55 + 0.45 * ((k * 37) % 10) / 10, tipx = T.x + (bx - T.x) * 0.12, tipy = s.y - T.h * f;
          const cx = bx + (tipx - bx) * 0.2 + noise(ts * 2.8, k * 1.7 + i) * fw * 0.18, cy = s.y - T.h * f * 0.5;
          ctx.lineWidth = lw * (1.15 - Math.abs(u));
          ctx.beginPath(); ctx.moveTo(bx, s.y + fw * 0.1 - u * u * fw * 0.5); ctx.quadraticCurveTo(cx, cy, tipx, tipy); ctx.stroke();
        }
        // 脫離火舌、往上飄散的短筆
        for (let k = 0; k < 5; k++) {
          const ph = (ts * (0.9 + k * 0.13) + k / 5) % 1, x = s.x + noise(ts + k * 3, i + k) * fw * 0.4, y = s.y - fh * (0.75 + ph * 0.7);
          ctx.lineWidth = lw * 0.8 * (1 - ph); ctx.strokeStyle = `rgba(${cMid},${(1 - ph) * 0.7})`;
          ctx.beginPath(); ctx.moveTo(x, y); ctx.quadraticCurveTo(x + fw * 0.06, y - fh * 0.08, x - fw * 0.02, y - fh * 0.16); ctx.stroke();
        }
      }
      if (!reduced && Math.random() < 0.18 * power) spawn(s.x + (Math.random() - 0.5) * fw * 0.6, s.y - fh * 0.4, { up: 0.5 * power, hue: 30 + green * 100 });
    });
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
    burst(x, y, n = 24, o = {}) { if (reduced) return; for (let i = 0; i < n; i++) spawn(x + (Math.random() - 0.5) * (o.w || 0), y, { spread: o.spread || 3, up: o.down ? -0.4 : o.up || 1.6, size: 2, hue: o.hue, down: o.down }); }
  };
}
