// 內殿全景的 WebGL 繪製：巨蟒的頭緩緩擺動，並處理眨眼。
//
// 全景圖是一張畫，頭沒有獨立圖層，所以另外準備兩樣東西（都由同一張全景圖產生）：
//   plate：把頭抹去、補上頭後方景物的版本（只裁下頭部附近一塊）
//   mask ：R＝頭的範圍（移動層），G＝底圖改用 plate 的範圍（比頭略大，越靠近頸部支點越小）
// 每一格：底圖＝原圖，在 G 範圍內換成 plate（頭移開時露出的是頭後方的景物，而不是頭的殘影）；
// 再把原圖中的頭以頸部為支點旋轉後疊上（R 範圍）。柱子、橫樑完全不動，不會被扭曲。
// 眼瞼：閉眼版只取雙眼一塊，跟著頭一起轉，uLid 為 0 睜眼、1 闔眼。
// WebGL 不可用時回傳 null，由呼叫端退回靜態圖。
const VERT = "attribute vec2 a;varying vec2 v;void main(){v=a*.5+.5;v.y=1.-v.y;gl_Position=vec4(a,0,1);}";
const FRAG = `precision mediump float;
varying vec2 v;
uniform sampler2D uScene,uLids,uPlate,uMask,uBody;
uniform float uTime,uSlither;
uniform vec4 uRect,uLidRect;
uniform vec2 uPivot;
uniform float uAng,uBob,uAsp,uLid,uGlow;
bool inside(vec2 u){return u.x>0.&&u.x<1.&&u.y>0.&&u.y<1.;}
void main(){
  vec2 p=v;
  vec4 col=texture2D(uScene,p);
  // 蛇身：只在蛇身遮罩內，沿身軀流過一道緩慢的波（幾個像素），再讓一抹金光沿鱗片滑過——像牠在殿中緩緩盤動
  float bm=texture2D(uBody,p).r;
  if(bm>.01){
    vec2 off=vec2(sin(p.y*38.-uTime*1.15)+.5*sin(p.x*21.+uTime*.7),cos(p.x*31.-uTime*.95))*.0016*uSlither;
    float bm2=texture2D(uBody,p+off).r;
    col.rgb=mix(col.rgb,texture2D(uScene,p+off).rgb,bm*bm2);
    float lum=dot(col.rgb,vec3(.3,.59,.11));
    float band=pow(max(0.,sin((p.x*2.4+p.y*4.1)*6.2831-uTime*.55)),14.);
    col.rgb+=bm*band*smoothstep(.15,.55,lum)*vec3(1.,.78,.42)*.22*uSlither;
  }
  vec2 rp=(p-uRect.xy)/uRect.zw;
  if(inside(rp)){ float ring=texture2D(uMask,rp).g; col.rgb=mix(col.rgb,texture2D(uPlate,rp).rgb,ring); }
  // 畫面上的 p 顯示的是原圖中旋轉前的 q
  vec2 d=(p-uPivot)*vec2(uAsp,1.);
  float c=cos(uAng),s=sin(uAng);
  vec2 q=uPivot+vec2(c*d.x+s*d.y,-s*d.x+c*d.y)/vec2(uAsp,1.);
  q.y-=uBob;
  vec2 rq=(q-uRect.xy)/uRect.zw;
  if(inside(rq)){
    float core=texture2D(uMask,rq).r;
    if(core>.001){
      vec4 h=texture2D(uScene,q);
      vec2 lu=(q-uLidRect.xy)/uLidRect.zw;
      if(uLid>0.&&inside(lu)){vec4 l=texture2D(uLids,lu);h.rgb=mix(h.rgb,l.rgb,l.a*uLid);}
      // 神諭降下時雙眼放光：只提亮眼睛一帶原本就亮的金色
      if(uGlow>0.&&inside(lu)){float lum=dot(h.rgb,vec3(.3,.59,.11));h.rgb+=uGlow*smoothstep(.35,.8,lum)*vec3(1.,.72,.32)*.95;}
      col.rgb=mix(col.rgb,h.rgb,core);
    }
  }
  gl_FragColor=col;
}`;

export function createTemple(canvas, { reduced }) {
  const gl = canvas.getContext("webgl", { premultipliedAlpha: false, alpha: false });
  if (!gl) return null;
  const sh = (t, s) => { const o = gl.createShader(t); gl.shaderSource(o, s); gl.compileShader(o); return gl.getShaderParameter(o, gl.COMPILE_STATUS) ? o : null; };
  const vs = sh(gl.VERTEX_SHADER, VERT), fs = sh(gl.FRAGMENT_SHADER, FRAG);
  if (!vs || !fs) return null;
  const pr = gl.createProgram(); gl.attachShader(pr, vs); gl.attachShader(pr, fs); gl.linkProgram(pr);
  if (!gl.getProgramParameter(pr, gl.LINK_STATUS)) return null;
  gl.useProgram(pr);
  gl.bindBuffer(gl.ARRAY_BUFFER, gl.createBuffer());
  gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 1, -1, -1, 1, 1, 1]), gl.STATIC_DRAW);
  const loc = gl.getAttribLocation(pr, "a"); gl.enableVertexAttribArray(loc); gl.vertexAttribPointer(loc, 2, gl.FLOAT, false, 0, 0);
  const U = {}; ["uScene", "uLids", "uPlate", "uMask", "uBody", "uTime", "uSlither", "uRect", "uLidRect", "uPivot", "uAng", "uBob", "uAsp", "uLid", "uGlow"].forEach(k => (U[k] = gl.getUniformLocation(pr, k)));
  const tex = [0, 1, 2, 3, 4].map(i => {
    const t = gl.createTexture(); gl.activeTexture(gl.TEXTURE0 + i); gl.bindTexture(gl.TEXTURE_2D, t);
    [gl.TEXTURE_WRAP_S, gl.TEXTURE_WRAP_T].forEach(k => gl.texParameteri(gl.TEXTURE_2D, k, gl.CLAMP_TO_EDGE));
    [gl.TEXTURE_MIN_FILTER, gl.TEXTURE_MAG_FILTER].forEach(k => gl.texParameteri(gl.TEXTURE_2D, k, gl.LINEAR));
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, 1, 1, 0, gl.RGBA, gl.UNSIGNED_BYTE, new Uint8Array([0, 0, 0, 0]));
    return t;
  });
  ["uScene", "uLids", "uPlate", "uMask", "uBody"].forEach((k, i) => gl.uniform1i(U[k], i));
  const load = (src, i) => new Promise(res => {
    const im = new Image();
    im.onload = () => { gl.activeTexture(gl.TEXTURE0 + i); gl.bindTexture(gl.TEXTURE_2D, tex[i]); gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, im); res(im); };
    im.onerror = () => res(null); im.src = src;
  });

  let ready = false, sc = null, lid = 0, lidT = 0, lidRate = 10, k = 1, kT = 1, last = 0, glow = 0, glowT = 0, glowRate = 1;
  function resize() {
    const dpr = Math.min(devicePixelRatio || 1, 2), w = Math.round(canvas.clientWidth * dpr), h = Math.round(canvas.clientHeight * dpr);
    if (w && h && (canvas.width !== w || canvas.height !== h)) { canvas.width = w; canvas.height = h; gl.viewport(0, 0, w, h); }
  }
  return {
    /** s：{ img, lids, plate, mask, ar, lid:[left,top,width](%), rect:[x,y,w,h](%), pivot:[x,y](%), amp } */
    async set(s) {
      sc = s; ready = false; canvas.classList.remove("ready");
      const [a, b, c, d] = await Promise.all([load(s.img, 0), load(s.lids, 1), load(s.plate, 2), load(s.mask, 3), s.body ? load(s.body, 4) : Promise.resolve(null)]);
      if (sc !== s || !a || !c || !d) return;
      const lw = s.lid[2] / 100, lh = b ? lw * (b.height / b.width) * s.ar : 0;
      gl.uniform4f(U.uLidRect, s.lid[0] / 100, s.lid[1] / 100, lw, lh);
      gl.uniform4f(U.uRect, ...s.rect.map(x => x / 100));
      gl.uniform2f(U.uPivot, s.pivot[0] / 100, s.pivot[1] / 100);
      gl.uniform1f(U.uAsp, s.ar);
      ready = true; canvas.classList.add("ready");
    },
    /** 眼瞼：v 0–1，ms 為過渡時間 */
    lid(v, ms = 90) { lidT = v; lidRate = 1000 / Math.max(16, ms); },
    get lidValue() { return lidT; },
    /** 雙眼放光：v 0–1，ms 為過渡時間（亮起與熄滅都要慢，才像神性而非故障） */
    glow(v, ms = 1200) { glowT = v; glowRate = 1000 / Math.max(16, ms); },
    /** 擺動幅度倍率：1 平常；洗牌時加大；神諭降下時幾乎靜止、直直盯著 */
    sway(m) { kT = m; },
    frame(t) {
      if (!ready) return;
      resize();
      const dt = Math.min(0.05, (t - last) / 1000 || 0.016); last = t;
      lid += Math.sign(lidT - lid) * Math.min(Math.abs(lidT - lid), dt * lidRate);
      k += (kT - k) * Math.min(1, dt * 1.2);
      const s = reduced ? 0 : t / 1000, amp = reduced ? 0 : sc.amp * k;
      // 三個不相干的週期疊加，擺動不會規律得像鐘擺
      const ang = amp * (Math.sin(s * 0.5) * 0.75 + Math.sin(s * 0.21 + 1.3) * 0.4 + Math.sin(s * 1.07 + 0.4) * 0.12);
      gl.uniform1f(U.uAng, ang); gl.uniform1f(U.uBob, amp * 0.05 * Math.sin(s * 0.8 + 0.6));
      glow += Math.sign(glowT - glow) * Math.min(Math.abs(glowT - glow), dt * glowRate);
      gl.uniform1f(U.uLid, lid); gl.uniform1f(U.uGlow, glow);
      gl.uniform1f(U.uTime, reduced ? 0 : t / 1000); gl.uniform1f(U.uSlither, reduced ? 0 : 0.6 + 0.4 * k);
      gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);
    }
  };
}
