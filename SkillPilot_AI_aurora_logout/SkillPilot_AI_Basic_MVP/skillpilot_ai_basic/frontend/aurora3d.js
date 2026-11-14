"use strict";
/* =========================================================
   SkillPilot AI — AURORA FX
   · Three.js: holographic AI orb + rotating neural network + glowing particles
               + 3D career roadmap (roadmap page)
   · CSS/JS:   floating glass skill cards, tilt cards, scroll reveals,
               cinematic page transitions
   Purely visual. It never touches the API, database or app state:
   script.js calls three guarded hooks (AuroraFX.view / .page / .rendered).
   If Three.js can't load (offline, blocked) the CSS fallback orb is shown.
   ========================================================= */
(function () {
  const root = document.documentElement;
  const reduce = window.matchMedia && matchMedia("(prefers-reduced-motion: reduce)").matches;
  const $ = (s, r = document) => r.querySelector(s);
  const $$ = (s, r = document) => [...r.querySelectorAll(s)];
  root.classList.add("fx");

  /* ---------- shared pointer state ---------- */
  const pt = { x: 0, y: 0 };          // target, -1..1
  const pm = { x: 0, y: 0 };          // smoothed
  let uiRaf = 0;
  function uiTick() {
    uiRaf = 0;
    pm.x += (pt.x - pm.x) * 0.12; pm.y += (pt.y - pm.y) * 0.12;
    const stage = $("#hero-stage");
    if (stage && curView === "landing") { stage.style.setProperty("--mx", pm.x.toFixed(3)); stage.style.setProperty("--my", pm.y.toFixed(3)); }
    if (Math.abs(pt.x - pm.x) > 0.002 || Math.abs(pt.y - pm.y) > 0.002) uiRaf = requestAnimationFrame(uiTick);
  }
  window.addEventListener("pointermove", e => {
    pt.x = (e.clientX / window.innerWidth) * 2 - 1; pt.y = -((e.clientY / window.innerHeight) * 2 - 1);
    if (!uiRaf && !reduce) uiRaf = requestAnimationFrame(uiTick);
  }, { passive: true });

  /* =========================================================
     Public hooks
     ========================================================= */
  let curView = null, curPage = null, three = null, main = null, roadApi = null, pendingRoad = null, threeState = "loading";
  const FX = (window.AuroraFX = {
    state: () => ({ view: curView, page: curPage, three: threeState, webgl: root.classList.contains("webgl") }),
    view(id) {
      const first = curView === null, changed = id !== curView;
      curView = id; if (!changed) return;
      const el = $("#view-" + id);
      if (el && !reduce) { el.classList.remove("view-enter"); void el.offsetWidth; el.classList.add("view-enter"); setTimeout(() => el.classList.remove("view-enter"), 1000); }
      const c = $("#fx-curtain");
      if (c && !first && !reduce) { c.classList.remove("go"); void c.offsetWidth; c.classList.add("go"); setTimeout(() => c.classList.remove("go"), 1000); }
      if (main) main.kick();
    },
    page(page, changed) {
      curPage = page;
      if (page !== "roadmap" && roadApi) roadApi.unmount();
      if (!changed || reduce) return;
      const el = $("#page-" + page); if (!el) return;
      el.classList.remove("page-enter"); void el.offsetWidth; el.classList.add("page-enter");
      setTimeout(() => el.classList.remove("page-enter"), 1100);
    },
    rendered(page, data) {
      curPage = page;
      if (page === "roadmap" && data) { pendingRoad = data; mountRoad(); } else if (roadApi) roadApi.unmount();
    }
  });

  /* =========================================================
     Tilt + cursor spotlight on cards (delegated, lazy)
     ========================================================= */
  const TILT = ".stat,.kpi,.tile,.track-card,.agent-list li,.next-card,.readiness,.radar-card,.assess-card,.note-card,.t-card,.steps li,.float-card,.sim,.hero-stats li";
  let tEl = null, tRect = null, tx = 0, ty = 0, tRaf = 0;
  function tiltApply() {
    tRaf = 0; if (!tEl) return;
    if (!tRect) tRect = tEl.getBoundingClientRect();
    const r = tRect, px = Math.min(1, Math.max(0, (tx - r.left) / r.width)), py = Math.min(1, Math.max(0, (ty - r.top) / r.height));
    const max = Math.min(8, 2600 / Math.max(r.width, r.height));
    tEl.style.setProperty("--ry", ((px - 0.5) * max * 2).toFixed(2) + "deg");
    tEl.style.setProperty("--rx", ((0.5 - py) * max * 2).toFixed(2) + "deg");
    tEl.style.setProperty("--gx", (px * 100).toFixed(1) + "%"); tEl.style.setProperty("--gy", (py * 100).toFixed(1) + "%");
  }
  function tiltRelease() {
    if (!tEl) return; tEl.classList.remove("is-tilting");
    tEl.style.setProperty("--rx", "0deg"); tEl.style.setProperty("--ry", "0deg"); tEl = null; tRect = null;
  }
  if (!reduce) {
    document.addEventListener("pointermove", e => {
      if (e.pointerType === "touch") return;
      const el = e.target.closest ? e.target.closest(TILT) : null;
      if (el !== tEl) { tiltRelease(); tEl = el; tRect = null; if (el) el.classList.add("tilt", "is-tilting"); }
      if (!el) return; tx = e.clientX; ty = e.clientY;
      if (!tRaf) tRaf = requestAnimationFrame(tiltApply);
    }, { passive: true });
    document.addEventListener("pointerleave", tiltRelease);
    window.addEventListener("scroll", () => { tRect = null; }, { passive: true });
    window.addEventListener("blur", tiltRelease);
  }

  /* =========================================================
     Scroll reveals (landing sections)
     ========================================================= */
  (function reveals() {
    const sel = ".section-title,.lead-sm,.try-copy,.sim,.steps li,.agent-list li,.tile,.track-card,.cta-inner";
    const els = $$(sel, $("#view-landing"));
    els.forEach(el => { el.classList.add("reveal"); const sib = el.parentElement ? [...el.parentElement.children].indexOf(el) : 0; el.style.setProperty("--i", Math.min(sib, 6)); });
    if (reduce || !("IntersectionObserver" in window)) { els.forEach(el => el.classList.remove("reveal")); return; }
    const io = new IntersectionObserver(entries => entries.forEach(en => {
      if (!en.isIntersecting) return; const el = en.target; el.classList.add("in"); io.unobserve(el);
      setTimeout(() => el.classList.remove("reveal", "in"), 1500); // hand transform back to tilt
    }), { threshold: 0.12, rootMargin: "0px 0px -6% 0px" });
    els.forEach(el => io.observe(el));
  })();

  /* hero orb pulse on click */
  document.addEventListener("click", e => { if (main && e.target.closest && e.target.closest("#hero-stage")) main.boost(); });

  /* =========================================================
     Three.js loading (local vendor copy first, then CDNs)
     ========================================================= */
  const SOURCES = [
    "vendor/three.min.js",
    "https://cdnjs.cloudflare.com/ajax/libs/three.js/r128/three.min.js",
    "https://cdn.jsdelivr.net/npm/three@0.128.0/build/three.min.js"
  ];
  function loadThree(done) {
    let i = 0, finished = false;
    const fin = ok => { if (!finished) { finished = true; done(ok); } };
    (function next() {
      if (window.THREE) return fin(true);
      if (i >= SOURCES.length) return fin(false);
      const s = document.createElement("script"); s.src = SOURCES[i++]; s.async = true;
      s.onload = () => (window.THREE ? fin(true) : next()); s.onerror = next;
      document.head.appendChild(s);
    })();
  }

  /* ---------- shaders (shared) ---------- */
  const GLSL_AURORA = `
    vec3 aur(float t){
      t = fract(t) * 5.0;
      vec3 a = vec3(.545,.361,.965), b = vec3(.231,.510,.965), c = vec3(.133,.827,.933), d = vec3(.957,.447,.714), e = vec3(.851,.275,.937);
      float f = smoothstep(0.0, 1.0, fract(t));
      if (t < 1.0) return mix(a, b, f);
      if (t < 2.0) return mix(b, c, f);
      if (t < 3.0) return mix(c, d, f);
      if (t < 4.0) return mix(d, e, f);
      return mix(e, a, f);
    }`;
  const GLOW_VS = `
    attribute float aSize; attribute float aPhase; attribute vec3 aColor;
    uniform float uTime; uniform float uScale; uniform float uBoost;
    varying vec3 vColor; varying float vA;
    void main(){
      vec4 mv = modelViewMatrix * vec4(position, 1.0);
      float tw = 0.78 + 0.22 * sin(uTime * 1.7 + aPhase * 6.2831);
      gl_PointSize = aSize * uScale * tw * (1.0 + uBoost * 0.45) / (-mv.z);
      vColor = aColor; vA = tw;
      gl_Position = projectionMatrix * mv;
    }`;
  const GLOW_FS = `
    varying vec3 vColor; varying float vA; uniform float uAlpha;
    void main(){
      float r = length(gl_PointCoord - 0.5);
      if (r > 0.5) discard;
      float g = 1.0 - r * 2.0; g = g * g;
      gl_FragColor = vec4(vColor * (0.55 + g * 1.5), g * uAlpha * vA);
    }`;
  const DUST_VS = `
    attribute float aSize; attribute float aPhase; attribute vec3 aColor; attribute float aSpeed;
    uniform float uTime; uniform float uScale; uniform vec2 uMouse;
    varying vec3 vColor; varying float vA;
    void main(){
      vec3 p = position;
      p.y = mod(p.y + uTime * aSpeed + 9.0, 18.0) - 9.0;
      p.x += sin(uTime * 0.3 + aPhase * 6.2831) * 0.35;
      p.z += cos(uTime * 0.25 + aPhase * 9.0) * 0.35;
      vec2 dd = p.xy - uMouse; float f = exp(-dot(dd, dd) * 0.5);
      p.xy += normalize(dd + vec2(0.0001)) * f * 0.75;
      vec4 mv = modelViewMatrix * vec4(p, 1.0);
      float tw = 0.6 + 0.4 * sin(uTime * 1.3 + aPhase * 20.0);
      gl_PointSize = aSize * uScale * tw / (-mv.z);
      vColor = aColor;
      vA = tw * smoothstep(-9.0, -6.5, p.y) * (1.0 - smoothstep(6.5, 9.0, p.y));
      gl_Position = projectionMatrix * mv;
    }`;
  const SHELL_VS = `
    varying vec3 vN; varying vec3 vV; varying vec3 vP;
    void main(){
      vec4 mv = modelViewMatrix * vec4(position, 1.0);
      vN = normalize(normalMatrix * normal); vV = -mv.xyz; vP = position;
      gl_Position = projectionMatrix * mv;
    }`;
  const SHELL_FS = `
    uniform float uTime; uniform float uBoost;
    varying vec3 vN; varying vec3 vV; varying vec3 vP;
    ${GLSL_AURORA}
    void main(){
      float f = 1.0 - max(dot(normalize(vN), normalize(vV)), 0.0);
      float rim = pow(f, 2.2);
      vec3 irid = aur(f * 0.9 + vP.y * 0.22 + vP.x * 0.12 + uTime * 0.05);
      float scan = 0.5 + 0.5 * sin(vP.y * 34.0 - uTime * 1.5);
      float bands = smoothstep(0.82, 1.0, scan) * 0.22;
      vec3 col = irid * (rim * 1.55 + 0.16) + bands * vec3(0.45, 0.9, 1.0) + uBoost * 0.25;
      float a = rim * 0.92 + 0.07 + bands * 0.55 + uBoost * 0.12;
      gl_FragColor = vec4(col, a);
    }`;

  function mulberry(a) { return function () { a |= 0; a = (a + 0x6D2B79F5) | 0; let t = Math.imul(a ^ (a >>> 15), 1 | a); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }; }
  const PAL_HEX = [0x8b5cf6, 0x3b82f6, 0x22d3ee, 0xf472b6, 0xd946ef];

  function glowFactory(THREE, shared) {
    return function glowMat(alpha) {
      return new THREE.ShaderMaterial({
        uniforms: { uTime: shared.uTime, uScale: shared.uScale, uBoost: shared.uBoost, uAlpha: { value: alpha } },
        vertexShader: GLOW_VS, fragmentShader: GLOW_FS, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending
      });
    };
  }
  function pointGeo(THREE, pos, col, size, phase) {
    const g = new THREE.BufferGeometry();
    g.setAttribute("position", new THREE.BufferAttribute(pos, 3));
    g.setAttribute("aColor", new THREE.BufferAttribute(col, 3));
    g.setAttribute("aSize", new THREE.BufferAttribute(size, 1));
    g.setAttribute("aPhase", new THREE.BufferAttribute(phase, 1));
    return g;
  }

  /* =========================================================
     MAIN SCENE — orb + neural network + particles
     ========================================================= */
  function startMain(THREE) {
    const canvas = $("#fx-canvas"); if (!canvas) return null;
    let renderer;
    try { renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: true, powerPreference: "high-performance" }); } catch (e) { return null; }
    if (!renderer.getContext || !renderer.getContext()) return null;
    renderer.setClearColor(0x000000, 0);
    let dpr = Math.min(window.devicePixelRatio || 1, 1.5);

    const scene = new THREE.Scene();
    const camera = new THREE.PerspectiveCamera(40, 1, 0.1, 100);
    camera.position.set(0, 0, 9);
    const TAN = Math.tan(THREE.MathUtils.degToRad(20)), HALF = 9 * TAN;
    const shared = { uTime: { value: 0 }, uScale: { value: 1 }, uBoost: { value: 0 } };
    const glowMat = glowFactory(THREE, shared);
    const PAL = PAL_HEX.map(h => new THREE.Color(h));
    const mobile = Math.min(window.innerWidth, window.innerHeight) < 700;
    const R = 1.5;
    let W = 1, H = 1;

    /* --- dust particles --- */
    const PN = mobile ? 520 : 1250, rngP = mulberry(11);
    const pPos = new Float32Array(PN * 3), pCol = new Float32Array(PN * 3), pSize = new Float32Array(PN), pPhase = new Float32Array(PN), pSpeed = new Float32Array(PN);
    for (let i = 0; i < PN; i++) {
      pPos[i * 3] = (rngP() * 2 - 1) * 9; pPos[i * 3 + 1] = (rngP() * 2 - 1) * 9; pPos[i * 3 + 2] = -5 + rngP() * 8.5;
      const c = PAL[Math.floor(rngP() * PAL.length)]; pCol[i * 3] = c.r; pCol[i * 3 + 1] = c.g; pCol[i * 3 + 2] = c.b;
      pSize[i] = 0.035 + Math.pow(rngP(), 3) * 0.16; pPhase[i] = rngP(); pSpeed[i] = 0.04 + rngP() * 0.16;
    }
    const pGeo = pointGeo(THREE, pPos, pCol, pSize, pPhase);
    pGeo.setAttribute("aSpeed", new THREE.BufferAttribute(pSpeed, 1));
    const uMouse = { value: new THREE.Vector2(99, 99) };
    const dust = new THREE.Points(pGeo, new THREE.ShaderMaterial({
      uniforms: { uTime: shared.uTime, uScale: shared.uScale, uMouse, uAlpha: { value: 0.85 } },
      vertexShader: DUST_VS, fragmentShader: GLOW_FS, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending
    }));
    dust.frustumCulled = false; scene.add(dust);

    /* --- orb --- */
    const orb = new THREE.Group(); scene.add(orb);
    const shell = new THREE.Mesh(new THREE.SphereGeometry(R, 64, 48), new THREE.ShaderMaterial({
      uniforms: { uTime: shared.uTime, uBoost: shared.uBoost }, vertexShader: SHELL_VS, fragmentShader: SHELL_FS,
      transparent: true, depthWrite: false, blending: THREE.AdditiveBlending
    }));
    shell.renderOrder = 3; orb.add(shell);

    const core = new THREE.Points(pointGeo(THREE, new Float32Array([0, 0, 0]), new Float32Array([0.55, 0.4, 1]), new Float32Array([R * 2.7]), new Float32Array([0.3])), glowMat(0.5));
    core.frustumCulled = false; core.renderOrder = 1; orb.add(core);

    const cortex = new THREE.LineSegments(new THREE.WireframeGeometry(new THREE.IcosahedronGeometry(R * 0.97, 2)),
      new THREE.LineBasicMaterial({ color: 0x6d5bff, transparent: true, opacity: 0.13, blending: THREE.AdditiveBlending, depthWrite: false }));
    cortex.renderOrder = 1; orb.add(cortex);

    /* neural network (two hemispheres, k-nearest links, travelling signals) */
    const net = new THREE.Group(); net.renderOrder = 2; orb.add(net);
    const rng = mulberry(7), N = mobile ? 48 : 72, nodes = [];
    for (let i = 0; i < N; i++) {
      const y = 1 - (2 * (i + 0.5)) / N, r = Math.sqrt(1 - y * y), th = i * 2.399963, rad = 0.36 + 0.52 * Math.pow(rng(), 0.6);
      let x = Math.cos(th) * r * rad; const yy = y * rad * 0.9, z = Math.sin(th) * r * rad;
      x += (x >= 0 ? 1 : -1) * 0.07;
      nodes.push([x * R, yy * R, z * R]);
    }
    const edgeSet = new Set(), edges = [];
    for (let i = 0; i < N; i++) {
      const d = nodes.map((n, j) => [j, (n[0] - nodes[i][0]) ** 2 + (n[1] - nodes[i][1]) ** 2 + (n[2] - nodes[i][2]) ** 2]).filter(a => a[0] !== i).sort((a, b) => a[1] - b[1]);
      for (let k = 0; k < 3; k++) { const j = d[k][0], key = i < j ? i + "-" + j : j + "-" + i; if (!edgeSet.has(key)) { edgeSet.add(key); edges.push([i, j]); } }
    }
    const lPos = new Float32Array(edges.length * 6), lCol = new Float32Array(edges.length * 6);
    edges.forEach(([a, b], e) => {
      for (let k = 0; k < 3; k++) { lPos[e * 6 + k] = nodes[a][k]; lPos[e * 6 + 3 + k] = nodes[b][k]; }
      const ca = PAL[a % 5], cb = PAL[b % 5];
      lCol[e * 6] = ca.r; lCol[e * 6 + 1] = ca.g; lCol[e * 6 + 2] = ca.b; lCol[e * 6 + 3] = cb.r; lCol[e * 6 + 4] = cb.g; lCol[e * 6 + 5] = cb.b;
    });
    const lGeo = new THREE.BufferGeometry();
    lGeo.setAttribute("position", new THREE.BufferAttribute(lPos, 3)); lGeo.setAttribute("color", new THREE.BufferAttribute(lCol, 3));
    net.add(new THREE.LineSegments(lGeo, new THREE.LineBasicMaterial({ vertexColors: true, transparent: true, opacity: 0.5, blending: THREE.AdditiveBlending, depthWrite: false })));

    const nPos = new Float32Array(N * 3), nCol = new Float32Array(N * 3), nSize = new Float32Array(N), nPhase = new Float32Array(N);
    nodes.forEach((n, i) => { nPos.set(n, i * 3); const c = PAL[i % 5]; nCol[i * 3] = c.r; nCol[i * 3 + 1] = c.g; nCol[i * 3 + 2] = c.b; nSize[i] = 0.09 + rng() * 0.1; nPhase[i] = rng(); });
    const nodePts = new THREE.Points(pointGeo(THREE, nPos, nCol, nSize, nPhase), glowMat(1)); nodePts.frustumCulled = false; net.add(nodePts);

    const M = mobile ? 24 : 42, pulses = [], sPos = new Float32Array(M * 3), sCol = new Float32Array(M * 3), sSize = new Float32Array(M).fill(0.17), sPhase = new Float32Array(M);
    for (let i = 0; i < M; i++) { pulses.push({ e: Math.floor(rng() * edges.length), t: rng(), sp: 0.25 + rng() * 0.55 }); sCol[i * 3] = 0.8; sCol[i * 3 + 1] = 0.97; sCol[i * 3 + 2] = 1; sPhase[i] = rng(); }
    const sGeo = pointGeo(THREE, sPos, sCol, sSize, sPhase);
    const pulsePts = new THREE.Points(sGeo, glowMat(1)); pulsePts.frustumCulled = false; net.add(pulsePts);

    /* orbit rings with satellites */
    const rings = [];
    [[1.38, 1.15, 0.09, 0], [1.66, -0.55, -0.06, 2], [1.95, 0.35, 0.045, 3]].forEach(([rad, tilt, spd, ci], k) => {
      const pivot = new THREE.Group(); pivot.rotation.x = Math.PI / 2 + tilt * 0.5; pivot.rotation.y = tilt;
      const ring = new THREE.Mesh(new THREE.TorusGeometry(rad * R / 1.5, 0.007, 8, 180), new THREE.MeshBasicMaterial({ color: PAL_HEX[ci], transparent: true, opacity: 0.5, blending: THREE.AdditiveBlending, depthWrite: false }));
      pivot.add(ring);
      const sats = [];
      for (let s = 0; s < 2; s++) {
        const c = PAL[(ci + s * 2 + 1) % 5];
        const sp = new THREE.Points(pointGeo(THREE, new Float32Array([0, 0, 0]), new Float32Array([c.r, c.g, c.b]), new Float32Array([0.2]), new Float32Array([k * 0.3 + s * 0.5])), glowMat(1));
        sp.frustumCulled = false; pivot.add(sp); sats.push(sp);
      }
      pivot.renderOrder = 4; orb.add(pivot); rings.push({ pivot, rad: rad * R / 1.5, spd, sats, a: k * 2 });
    });

    /* --- sizing --- */
    function resize() {
      W = window.innerWidth; H = window.innerHeight;
      renderer.setPixelRatio(dpr); renderer.setSize(W, H, false);
      camera.aspect = W / H; camera.updateProjectionMatrix();
      shared.uScale.value = (H * dpr) / (2 * TAN);
      dust.scale.x = Math.min(1.5, Math.max(0.4, camera.aspect / 1.78));
    }
    resize();
    let rzT = 0; window.addEventListener("resize", () => { clearTimeout(rzT); rzT = setTimeout(() => { resize(); if (!animate) draw(0.016, true); }, 80); });

    /* --- orb anchoring: follows the hero stage / auth panel in screen space --- */
    const cur = { x: 0, y: 0, s: 0 };
    function target() {
      const sel = curView === "landing" ? "#hero-stage" : curView === "auth" ? ".auth-orb" : null, el = sel && $(sel);
      if (el) {
        const r = el.getBoundingClientRect();
        if (r.width > 0 && r.bottom > -120 && r.top < H + 120) {
          const k = (2 * HALF) / H;
          return { x: (r.left + r.width / 2 - W / 2) * k, y: -(r.top + r.height / 2 - H / 2) * k, s: (Math.min(r.width, r.height) * 0.5 * k * (curView === "landing" ? 0.92 : 1)) / R };
        }
      }
      return { x: cur.x, y: cur.y, s: 0 };
    }

    let animate = !reduce, t = 0, last = performance.now(), frames = 0, acc = 0, tuned = 0, running = false, raf = 0, snap = true;
    function draw(dt, force) {
      t += dt; shared.uTime.value = t;
      const tg = target(), ease = snap || force ? 1 : 1 - Math.pow(0.0015, dt);
      cur.x += (tg.x - cur.x) * ease; cur.y += (tg.y - cur.y) * ease; cur.s += (tg.s - cur.s) * ease; snap = false;
      const show = cur.s > 0.02; orb.visible = show;
      if (show) {
        orb.position.set(cur.x, cur.y, 0); orb.scale.setScalar(cur.s);
        const breathe = 1 + Math.sin(t * 0.9) * 0.012;
        orb.scale.multiplyScalar(breathe); orb.position.y += Math.sin(t * 0.7) * 0.07;
        orb.rotation.y += dt * (0.12 + pm.x * 0.9);
        orb.rotation.x += (-pm.y * 0.35 - orb.rotation.x) * Math.min(1, dt * 2.5);
        net.rotation.y += dt * 0.22; net.rotation.x = Math.sin(t * 0.21) * 0.16;
        cortex.rotation.y -= dt * 0.1; cortex.rotation.z += dt * 0.04;
        rings.forEach((rg, i) => {
          rg.a += dt * (0.5 + i * 0.22); rg.pivot.rotation.z += dt * rg.spd;
          rg.sats.forEach((s, k) => { const a = rg.a + k * Math.PI; s.position.set(Math.cos(a) * rg.rad, Math.sin(a) * rg.rad, 0); });
        });
        for (let i = 0; i < M; i++) {
          const p = pulses[i]; p.t += dt * p.sp; if (p.t >= 1) { p.t = 0; p.e = Math.floor(Math.random() * edges.length); }
          const e = edges[p.e], a = nodes[e[0]], b = nodes[e[1]];
          sPos[i * 3] = a[0] + (b[0] - a[0]) * p.t; sPos[i * 3 + 1] = a[1] + (b[1] - a[1]) * p.t; sPos[i * 3 + 2] = a[2] + (b[2] - a[2]) * p.t;
        }
        sGeo.attributes.position.needsUpdate = true;
      }
      shared.uBoost.value *= Math.pow(0.05, dt);
      // dust follows the pointer & scroll
      uMouse.value.set((pt.x * HALF * camera.aspect) / dust.scale.x, pt.y * HALF);
      dust.rotation.y = pm.x * 0.08; dust.rotation.x = -pm.y * 0.05; dust.position.y = (window.scrollY || 0) * 0.0018;
      camera.position.x += (pm.x * 0.3 - camera.position.x) * Math.min(1, dt * 2); camera.position.y += (pm.y * 0.2 - camera.position.y) * Math.min(1, dt * 2);
      camera.lookAt(0, 0, 0);
      renderer.render(scene, camera);
    }
    function loop(now) {
      raf = requestAnimationFrame(loop);
      const raw = now - last; last = now; if (raw > 250) return;           // tab was hidden
      draw(Math.min(raw / 1000, 0.05), false);
      if (!root.classList.contains("webgl")) root.classList.add("webgl");
      // adaptive quality: drop pixel ratio / particles when the machine struggles
      if (tuned < 3) {
        acc += raw; frames++;
        if (frames === 90) {
          const avg = acc / frames; acc = 0; frames = 0;
          if (avg > 24) { tuned++; if (dpr > 1) { dpr = 1; resize(); } else { pGeo.setDrawRange(0, Math.floor(PN * (tuned === 2 ? 0.5 : 0.7))); } } else tuned = 3;
        }
      }
    }
    function start() { if (!running && animate) { running = true; last = performance.now(); raf = requestAnimationFrame(loop); } }
    if (animate) start(); else { for (let i = 0; i < 3; i++) draw(0.016, true); root.classList.add("webgl"); }
    canvas.addEventListener("webglcontextlost", e => { e.preventDefault(); cancelAnimationFrame(raf); running = false; root.classList.remove("webgl"); });
    canvas.addEventListener("webglcontextrestored", () => { start(); });
    return { kick() { snap = false; if (!animate) draw(0.016, true); }, boost() { shared.uBoost.value = 1; } };
  }

  /* =========================================================
     3D CAREER ROADMAP (second renderer, roadmap page only)
     ========================================================= */
  function createRoad(THREE) {
    const canvas = document.createElement("canvas"); canvas.setAttribute("aria-hidden", "true");
    let renderer;
    try { renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: true }); } catch (e) { return null; }
    if (!renderer.getContext || !renderer.getContext()) return null;
    renderer.setClearColor(0x000000, 0);
    const dpr = Math.min(window.devicePixelRatio || 1, 1.75); renderer.setPixelRatio(dpr);
    const scene = new THREE.Scene(), camera = new THREE.PerspectiveCamera(42, 1, 0.1, 100);
    const TAN = Math.tan(THREE.MathUtils.degToRad(21));
    const shared = { uTime: { value: 0 }, uScale: { value: 1 }, uBoost: { value: 0 } };
    const glowMat = glowFactory(THREE, shared);
    const rootG = new THREE.Group(), world = new THREE.Group(); scene.add(rootG); rootG.add(world);

    /* static environment: floor grid + dust */
    const grid = new THREE.GridHelper(16, 32, 0x6a5cff, 0x2a2676);
    grid.position.y = -0.9; grid.material.transparent = true; grid.material.opacity = 0.32; grid.material.depthWrite = false; rootG.add(grid);
    const rg = mulberry(5), DN = 160, dPos = new Float32Array(DN * 3), dCol = new Float32Array(DN * 3), dSize = new Float32Array(DN), dPh = new Float32Array(DN);
    for (let i = 0; i < DN; i++) {
      dPos[i * 3] = (rg() * 2 - 1) * 8; dPos[i * 3 + 1] = -0.6 + rg() * 5; dPos[i * 3 + 2] = (rg() * 2 - 1) * 5;
      const c = new THREE.Color(PAL_HEX[Math.floor(rg() * 5)]); dCol[i * 3] = c.r; dCol[i * 3 + 1] = c.g; dCol[i * 3 + 2] = c.b; dSize[i] = 0.03 + rg() * 0.06; dPh[i] = rg();
    }
    const dust = new THREE.Points(pointGeo(THREE, dPos, dCol, dSize, dPh), glowMat(0.8)); dust.frustumCulled = false; rootG.add(dust);

    let labelsEl = null, stage = null, nodes = [], pilot = null, tCur = 0, data = null, grow = 0, camBase = new THREE.Vector3(0, 3, 9), lookAt = new THREE.Vector3(0, 1.1, 0), dragYaw = 0, dragging = false, lastX = 0;
    const tmp = new THREE.Vector3();

    function clearWorld() {
      while (world.children.length) {
        const o = world.children.pop();
        o.traverse(n => { if (n.geometry) n.geometry.dispose(); if (n.material) n.material.dispose(); });
      }
      nodes = []; pilot = null;
    }
    function fit() {
      if (!stage) return;
      const w = stage.clientWidth || 600, h = stage.clientHeight || 360;
      renderer.setSize(w, h, false); camera.aspect = w / h; camera.updateProjectionMatrix();
      shared.uScale.value = (h * dpr) / (2 * TAN);
      const m = (data ? data.items.length : 5) + 1, span = Math.min(10, 1.7 * m + 1.5);
      const widen = Math.max(1, 1.55 / camera.aspect);                  // narrow screens pull the camera back
      camBase.set(0, 2.5 + m * 0.1, (span * 0.72 + 3.6) * widen); lookAt.set(0, 1.15, 0);
    }
    function build(d) {
      data = d; clearWorld();
      const items = d.items, n = items.length, m = n + 1, span = Math.min(10, 1.7 * m + 1.5);
      const pts = [];
      for (let i = 0; i < m; i++) { const f = i / (m - 1); pts.push(new THREE.Vector3((f - 0.5) * span, 0.1 + f * 2.1 + Math.sin(i * 1.15) * 0.4, Math.cos(i * 1.15 + 0.7) * 1.5)); }
      const curve = new THREE.CatmullRomCurve3(pts, false, "catmullrom", 0.5);
      let cur = items.findIndex(it => !d.done[it.skill]); if (cur < 0) cur = n;
      tCur = cur / (m - 1);
      const sub = (a, b, rad, color, op) => {
        const S = 24, p = []; for (let k = 0; k <= S; k++) p.push(curve.getPoint(a + (b - a) * (k / S)));
        const g = new THREE.TubeGeometry(new THREE.CatmullRomCurve3(p), S * 4, rad, 8, false);
        const mesh = new THREE.Mesh(g, new THREE.MeshBasicMaterial({ color, transparent: true, opacity: op, blending: THREE.AdditiveBlending, depthWrite: false }));
        world.add(mesh);
      };
      if (tCur > 0.001) { sub(0, tCur, 0.045, 0x4fe3ff, 0.95); sub(0, tCur, 0.13, 0x22d3ee, 0.16); }
      if (tCur < 0.999) sub(tCur, 1, 0.03, 0x7a6cff, 0.5);

      labelsEl.innerHTML = "";
      const addLabel = (text, cls, skill) => {
        const b = document.createElement("button"); b.type = "button"; b.className = "r3d-label " + cls;
        b.setAttribute("aria-label", skill ? "Go to step: " + skill : "Career goal: " + text);
        b.innerHTML = "<i></i>"; b.appendChild(document.createTextNode(text));
        if (skill) b.addEventListener("click", () => {
          const el = $$("#roadmap-list .t-item").find(x => x.dataset.skill === skill);
          if (el) { el.scrollIntoView({ behavior: reduce ? "auto" : "smooth", block: "center" }); el.classList.remove("flash"); void el.offsetWidth; el.classList.add("flash"); }
        });
        labelsEl.appendChild(b); return b;
      };
      items.forEach((it, i) => {
        const done = !!d.done[it.skill], isCur = i === cur, p = pts[i], g = new THREE.Group(); g.position.copy(p);
        let mesh;
        if (done) {
          mesh = new THREE.Mesh(new THREE.IcosahedronGeometry(0.2, 1), new THREE.MeshBasicMaterial({ color: 0x4fe3ff }));
          const r = new THREE.Mesh(new THREE.TorusGeometry(0.34, 0.012, 8, 48), new THREE.MeshBasicMaterial({ color: 0x22d3ee, transparent: true, opacity: 0.7, blending: THREE.AdditiveBlending })); r.rotation.x = Math.PI / 2; g.add(r);
        } else if (isCur) {
          mesh = new THREE.Mesh(new THREE.SphereGeometry(0.27, 24, 18), new THREE.MeshBasicMaterial({ color: 0xff5fc8 }));
          const beam = new THREE.Mesh(new THREE.CylinderGeometry(0.025, 0.025, 2.4, 8, 1, true), new THREE.MeshBasicMaterial({ color: 0xf472b6, transparent: true, opacity: 0.45, blending: THREE.AdditiveBlending, depthWrite: false })); beam.position.y = 1.2; g.add(beam);
          const pr = new THREE.Mesh(new THREE.TorusGeometry(0.42, 0.014, 8, 56), new THREE.MeshBasicMaterial({ color: 0xf472b6, transparent: true, opacity: 0.8, blending: THREE.AdditiveBlending, depthWrite: false })); pr.rotation.x = Math.PI / 2; g.add(pr); g.userData.pulse = pr;
        } else {
          mesh = new THREE.Mesh(new THREE.IcosahedronGeometry(0.18, 1), new THREE.MeshBasicMaterial({ color: 0x8b7cff, wireframe: true, transparent: true, opacity: 0.85 }));
        }
        g.add(mesh);
        const c = done ? [0.2, 0.9, 1] : isCur ? [1, 0.37, 0.78] : [0.55, 0.49, 1];
        const halo = new THREE.Points(pointGeo(THREE, new Float32Array([0, 0, 0]), new Float32Array(c), new Float32Array([isCur ? 1.1 : 0.7]), new Float32Array([i * 0.37])), glowMat(isCur ? 0.9 : 0.55)); halo.frustumCulled = false; g.add(halo);
        world.add(g);
        nodes.push({ g, base: p.y, ph: i * 0.8, mesh, label: addLabel(it.skill, done ? "done" : isCur ? "cur" : "", it.skill) });
      });
      // goal
      const gp = pts[m - 1], gg = new THREE.Group(); gg.position.copy(gp);
      const gm = new THREE.Mesh(new THREE.IcosahedronGeometry(0.36, 0), new THREE.MeshBasicMaterial({ color: 0xf0a8ff, wireframe: true }));
      const gi = new THREE.Mesh(new THREE.IcosahedronGeometry(0.17, 1), new THREE.MeshBasicMaterial({ color: 0xffffff }));
      const gh = new THREE.Points(pointGeo(THREE, new Float32Array([0, 0, 0]), new Float32Array([0.9, 0.5, 1]), new Float32Array([1.7]), new Float32Array([0.2])), glowMat(0.9)); gh.frustumCulled = false;
      gg.add(gm, gi, gh); world.add(gg);
      nodes.push({ g: gg, base: gp.y, ph: 3, mesh: gm, spin: true, label: addLabel("Goal · " + (d.career || "Career"), "goal", null) });
      // pilot (a light that travels along the completed path)
      if (tCur > 0.001) { pilot = new THREE.Points(pointGeo(THREE, new Float32Array([0, 0, 0]), new Float32Array([1, 1, 1]), new Float32Array([0.5]), new Float32Array([0])), glowMat(1)); pilot.frustumCulled = false; world.add(pilot); }
      world.userData.curve = curve;
      grow = 0; fit();
    }

    /* interaction */
    const pointerOn = e => { const r = stage.getBoundingClientRect(); return { x: ((e.clientX - r.left) / r.width) * 2 - 1, y: -(((e.clientY - r.top) / r.height) * 2 - 1) }; };
    const local = { x: 0, y: 0 };
    function bind(el) {
      el.addEventListener("pointermove", e => {
        const p = pointerOn(e); local.x = p.x; local.y = p.y;
        if (dragging) { dragYaw = Math.max(-1.2, Math.min(1.2, dragYaw + (e.clientX - lastX) * 0.006)); lastX = e.clientX; }
      });
      el.addEventListener("pointerleave", () => { local.x = 0; local.y = 0; dragging = false; });
      el.addEventListener("pointerdown", e => { if (e.target.closest(".r3d-label")) return; dragging = true; lastX = e.clientX; el.style.cursor = "grabbing"; });
      window.addEventListener("pointerup", () => { dragging = false; el.style.cursor = ""; });
    }

    let running = false, raf = 0, last = performance.now(), t = 0, visible = true, io = null, ro = null, lx = 0, ly = 0;
    function frame(now) {
      if (!running) return;
      raf = requestAnimationFrame(frame);
      const raw = now - last; last = now; if (raw > 250) return;
      const dt = Math.min(raw / 1000, 0.05); t += dt; shared.uTime.value = t;
      grow = Math.min(1, grow + dt * 1.3); const ge = 1 - Math.pow(1 - grow, 3); world.scale.setScalar(0.55 + 0.45 * ge);
      lx += (local.x - lx) * Math.min(1, dt * 4); ly += (local.y - ly) * Math.min(1, dt * 4);
      if (!dragging) dragYaw *= Math.pow(0.35, dt);
      rootG.rotation.y = lx * 0.42 + dragYaw + Math.sin(t * 0.25) * 0.08; rootG.rotation.x = -ly * 0.1;
      camera.position.copy(camBase); camera.lookAt(lookAt);
      nodes.forEach(nd => {
        nd.g.position.y = nd.base + Math.sin(t * 1.3 + nd.ph) * 0.07;
        if (nd.spin) { nd.mesh.rotation.y += dt * 0.9; nd.mesh.rotation.x += dt * 0.5; } else nd.mesh.rotation.y += dt * 0.6;
        const pu = nd.g.userData.pulse; if (pu) { const s = 1 + ((t * 0.9) % 1) * 0.9; pu.scale.set(s, s, s); pu.material.opacity = 0.8 * (1 - ((t * 0.9) % 1)); }
      });
      if (pilot && world.userData.curve) { const f = (t * 0.16) % 1; pilot.position.copy(world.userData.curve.getPoint(tCur * f)); }
      renderer.render(scene, camera);
      // project labels
      const w = stage.clientWidth, h = stage.clientHeight; rootG.updateMatrixWorld(true);
      nodes.forEach(nd => {
        nd.g.getWorldPosition(tmp); tmp.y += 0.1; tmp.project(camera);
        const x = (tmp.x * 0.5 + 0.5) * w, y = (-tmp.y * 0.5 + 0.5) * h - 30;
        nd.label.style.transform = "translate(" + x.toFixed(1) + "px," + y.toFixed(1) + "px) translate(-50%,-100%)";
        nd.label.style.opacity = tmp.z < 1 ? "1" : "0";
      });
    }
    function run() { if (running || !stage || !visible || reduce && false) return; running = true; last = performance.now(); raf = requestAnimationFrame(frame); }
    function halt() { running = false; cancelAnimationFrame(raf); }

    return {
      mount(box, d) {
        stage = $(".road3d-stage", box); labelsEl = $(".r3d-labels", box);
        if (canvas.parentNode !== stage) { stage.insertBefore(canvas, stage.firstChild); bind(stage); }
        if (io) io.disconnect(); if (ro) ro.disconnect();
        build(d);
        if ("IntersectionObserver" in window) { io = new IntersectionObserver(es => { visible = es[0].isIntersecting; visible ? run() : halt(); }); io.observe(stage); }
        if ("ResizeObserver" in window) { ro = new ResizeObserver(fit); ro.observe(stage); }
        if (reduce) { grow = 1; world.scale.setScalar(1); fit(); camera.position.copy(camBase); camera.lookAt(lookAt); renderer.render(scene, camera); rootG.updateMatrixWorld(true); nodes.forEach(nd => { nd.g.getWorldPosition(tmp); tmp.project(camera); nd.label.style.transform = "translate(" + ((tmp.x * 0.5 + 0.5) * stage.clientWidth).toFixed(1) + "px," + ((-tmp.y * 0.5 + 0.5) * stage.clientHeight - 30).toFixed(1) + "px) translate(-50%,-100%)"; }); }
        else run();
      },
      unmount() { halt(); if (io) io.disconnect(); if (ro) ro.disconnect(); stage = null; }
    };
  }

  function mountRoad() {
    if (!pendingRoad || threeState !== "ready" || !root.classList.contains("fx")) return;
    const page = $("#page-roadmap"), list = page && $("#roadmap-list"); if (!list) return;
    if (!roadApi) { roadApi = createRoad(three); if (!roadApi) { threeState = "no-webgl"; return; } }
    let box = $("#road3d", page);
    if (!box) {
      box = document.createElement("article"); box.className = "card road3d"; box.id = "road3d";
      box.innerHTML = '<div class="road3d-head"><h2>Your 3D flight path</h2><ul class="legend"><li><span class="dot st-verified"></span>Done</li><li><span class="dot st-gap"></span>Up next</li><li><span class="dot st-declared"></span>Ahead</li></ul></div><div class="road3d-stage"><div class="r3d-labels"></div><p class="road3d-hint">Move your mouse, or drag to orbit. Click a label to jump to its step.</p></div>';
      page.insertBefore(box, list);
    }
    roadApi.mount(box, pendingRoad);
  }

  /* =========================================================
     Boot
     ========================================================= */
  loadThree(ok => {
    if (!ok) { threeState = "failed"; return; }
    three = window.THREE;
    try { main = startMain(three); } catch (err) { console.warn("[AuroraFX] main scene failed, using CSS fallback.", err); main = null; }
    threeState = main ? "ready" : "no-webgl";
    if (threeState === "ready" && curPage === "roadmap") mountRoad();
  });
})();
