// 地縫升起的神聖煙霧（WebGL 片段著色器）
// - 主煙柱：從地縫位置升起，隨儀式階段調整濃度（intensity）
// - 攪動：手指／滑鼠經過時，附近的煙被捲動
// - 湧煙（burst）：換立繪時在女祭司身上湧起一團煙，遮住切換
// - 薄霧（mist）：翻牌時石桌上方的一層薄霧
const FRAG = `
precision mediump float;
uniform vec2 uRes; uniform float uTime; uniform vec2 uSrc; uniform float uInt;
uniform vec2 uMouse; uniform float uStir; uniform vec2 uBurstPos; uniform float uBurst;
uniform float uMistY; uniform float uMist; uniform float uGreen;
float h(vec2 p){return fract(sin(dot(p,vec2(127.1,311.7)))*43758.5453);}
float n(vec2 p){vec2 i=floor(p),f=fract(p);f=f*f*(3.-2.*f);
 return mix(mix(h(i),h(i+vec2(1,0)),f.x),mix(h(i+vec2(0,1)),h(i+vec2(1,1)),f.x),f.y);}
float fbm(vec2 p){float v=0.,a=.5;for(int i=0;i<5;i++){v+=a*n(p);p=p*2.03+vec2(1.7,9.2);a*=.5;}return v;}
void main(){
 vec2 uv=gl_FragCoord.xy/uRes; float asp=uRes.x/uRes.y;
 vec2 p=vec2(uv.x*asp,uv.y);
 vec2 m=vec2(uMouse.x*asp,1.-uMouse.y); vec2 d=p-m; float fall=exp(-dot(d,d)*28.);
 p+=vec2(-d.y,d.x)*fall*.55*uStir;
 vec2 s=vec2(uSrc.x*asp,1.-uSrc.y); float dy=p.y-s.y;
 float sway=sin(dy*5.+uTime*.7)*.05*max(dy,0.);
 float w=.05+max(dy,0.)*.42;
 float plume=smoothstep(w,0.,abs(p.x-s.x-sway))*smoothstep(-.03,.06,dy)*smoothstep(1.05,.15,dy);
 vec2 q=vec2(p.x,p.y-uTime*.075);
 float f=fbm(q*3.2+vec2(fbm(q*1.6+uTime*.04),fbm(q*1.7-uTime*.035)));
 vec2 b=vec2(uBurstPos.x*asp,1.-uBurstPos.y); float bd=length((p-b)*vec2(1.,.7));
 float burst=uBurst*smoothstep(.55,0.,bd);
 float mist=uMist*smoothstep(.12,0.,abs(uv.y-(1.-uMistY)))*.8;
 float wisp=smoothstep(.42,.95,f)*1.4+smoothstep(.62,1.,fbm(q*7.+uTime*.1))*.6;
 float dens=(plume*uInt*.55+burst*1.2+mist*.8)*wisp;
 float a=clamp(dens,0.,.62);
 vec3 col=mix(vec3(.30,.25,.19),vec3(.86,.76,.58),f);
 col=mix(col,mix(vec3(.08,.30,.16),vec3(.55,1.,.7),f),uGreen);
 // 線刻：以順著煙流彎曲的細線表現密度——越濃線越粗，再墊一層很淡的柔煙
 vec2 dir=vec2(cos(.95+f*.7),sin(.95+f*.7));
 float st=abs(fract((dot(gl_FragCoord.xy,dir)+f*26.)/4.6)-.5)*2.;
 float ln=smoothstep(a*1.5+.1,a*1.5-.06,st);
 a=clamp(ln*min(1.,a*2.4)*.8+a*.16,0.,.7);
 gl_FragColor=vec4(col*a,a);
}`;
const VERT = "attribute vec2 a;void main(){gl_Position=vec4(a,0,1);}";

export function createSmoke(canvas, { reduced }) {
  const gl = canvas.getContext("webgl", { premultipliedAlpha: true, alpha: true, antialias: false });
  const st = { green: 0, greenT: 0, int: 0.55, intT: 0.55, burst: 0, mist: 0, mistT: 0, mistY: 0.5, src: [0.2, 0.9], burstPos: [0.2, 0.6], mouse: [-1, -1], stir: 0 };
  if (!gl) return { set() {}, burst() {}, frame() {}, state: st, ok: false };
  const sh = (t, s) => { const o = gl.createShader(t); gl.shaderSource(o, s); gl.compileShader(o); return o; };
  const pr = gl.createProgram();
  gl.attachShader(pr, sh(gl.VERTEX_SHADER, VERT)); gl.attachShader(pr, sh(gl.FRAGMENT_SHADER, FRAG));
  gl.linkProgram(pr); gl.useProgram(pr);
  const buf = gl.createBuffer(); gl.bindBuffer(gl.ARRAY_BUFFER, buf);
  gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 1, -1, -1, 1, 1, 1]), gl.STATIC_DRAW);
  const loc = gl.getAttribLocation(pr, "a"); gl.enableVertexAttribArray(loc); gl.vertexAttribPointer(loc, 2, gl.FLOAT, false, 0, 0);
  const U = {}; ["uRes", "uTime", "uSrc", "uInt", "uMouse", "uStir", "uBurstPos", "uBurst", "uMistY", "uMist", "uGreen"].forEach(k => (U[k] = gl.getUniformLocation(pr, k)));
  gl.enable(gl.BLEND); gl.blendFunc(gl.ONE, gl.ONE_MINUS_SRC_ALPHA);

  // 手機省效能：以 0.5 倍解析度渲染
  const scale = Math.min(window.devicePixelRatio || 1, 2) * (innerWidth < 700 ? 0.45 : 0.6);
  function resize() { canvas.width = Math.round(canvas.clientWidth * scale); canvas.height = Math.round(canvas.clientHeight * scale); gl.viewport(0, 0, canvas.width, canvas.height); }
  resize(); new ResizeObserver(resize).observe(canvas);

  let lastMouse = null;
  canvas.parentElement.addEventListener("pointermove", e => {
    const r = canvas.getBoundingClientRect(); const x = (e.clientX - r.left) / r.width, y = (e.clientY - r.top) / r.height;
    if (lastMouse) st.stir = Math.min(1, st.stir + Math.hypot(x - lastMouse[0], y - lastMouse[1]) * 6);
    lastMouse = [x, y]; st.mouse = [x, y];
  }, { passive: true });

  function frame(t) {
    st.int += (st.intT - st.int) * 0.03; st.mist += (st.mistT - st.mist) * 0.04;
    st.burst *= 0.965; st.green += (st.greenT - st.green) * 0.03; st.stir *= 0.94;
    gl.uniform2f(U.uRes, canvas.width, canvas.height); gl.uniform1f(U.uTime, reduced ? 3 : t / 1000);
    gl.uniform2f(U.uSrc, st.src[0], st.src[1]); gl.uniform1f(U.uInt, st.int);
    gl.uniform2f(U.uMouse, st.mouse[0], st.mouse[1]); gl.uniform1f(U.uStir, st.stir);
    gl.uniform2f(U.uBurstPos, st.burstPos[0], st.burstPos[1]); gl.uniform1f(U.uBurst, st.burst);
    gl.uniform1f(U.uMistY, st.mistY); gl.uniform1f(U.uMist, st.mist); gl.uniform1f(U.uGreen, st.green);
    gl.clearColor(0, 0, 0, 0); gl.clear(gl.COLOR_BUFFER_BIT); gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);
  }
  return {
    ok: true, state: st, frame,
    set(o) { if (o.intensity != null) st.intT = o.intensity; if (o.mist != null) st.mistT = o.mist; if (o.mistY != null) st.mistY = o.mistY; if (o.src) st.src = o.src; if (o.green != null) st.greenT = o.green; },
    burst(pos, amt = 1) { st.burstPos = pos; st.burst = Math.max(st.burst, amt); }
  };
}
