// Runs inside the game page (Animation Studio open). Poses the real rider with a studio clip at a given time and
// captures it from six orthographic directions, colour and depth, in the rider's own frame.
// `reference` renders him as the game draws him, for a side-by-side with the stack.
// Exposed as window.__stackCapture = { setup, measure, frame, reference, restore }.
(() => {
  const S = {};
  const setup = async (opts) => {
    const g = window.__game, p = g.player;
    const url = performance.getEntriesByType('resource').map(e => e.name).find(n => /\/deps\/three\.js(\?|$)/.test(n));
    const T = url ? await import(/* @vite-ignore */ url) : null;
    if (!T || !(g.scene instanceof T.Scene)) throw new Error('could not adopt the app\'s own three.js module: ' + url);
    if (!g.animationStudio?.isOpen) { await g.openAnimationStudio(); await new Promise(r => setTimeout(r, 2500)); }
    const studio = g.animationStudio, diag = studio.diagnostics; diag.pause();
    Object.assign(S, { g, p, T, studio, diag, opts });
    // The rider alone, under one fixed, view-independent light: the same surface must read the same from every side.
    const cap = new T.Scene();
    cap.add(new T.HemisphereLight(0xffffff, 0x7d8494, opts.hemi ?? 2.4), new T.AmbientLight(0xffffff, opts.ambient ?? .7));
    const key = new T.DirectionalLight(0xffffff, opts.key ?? .9); key.position.set(.25, 1, .35); cap.add(key, key.target);
    S.cap = cap; S.home = p.group.parent;
    S.hidden = []; p.group.traverse(o => { if (/RadialSpinSmear|shadow|Shadow|trail|Trail|scribble/i.test(o.name) && o.visible) { o.visible = false; S.hidden.push(o); } });
    // Depth is read from the colour pass's own depth buffer, so it is exactly the surface that was drawn (the rider's
    // bones stretch in their own shaders; an override material would draw them somewhere else).
    S.quadScene = new T.Scene(); S.quadCam = new T.OrthographicCamera(-1, 1, 1, -1, 0, 1);
    S.packMat = new T.ShaderMaterial({ uniforms: { tDepth: { value: null } }, depthTest: false, depthWrite: false,
      vertexShader: 'varying vec2 vUv; void main(){ vUv = uv; gl_Position = vec4(position.xy, 0., 1.); }',
      fragmentShader: 'uniform sampler2D tDepth; varying vec2 vUv; void main(){ float d = min(texture2D(tDepth, vUv).x, .9999999); vec3 e = fract(d * vec3(1., 255., 65025.)); e -= e.yzz * vec3(1. / 255., 1. / 255., 0.); gl_FragColor = vec4(e, 1.); }' });
    S.quadScene.add(new T.Mesh(new T.PlaneGeometry(2, 2), S.packMat));
    S.cam = new T.OrthographicCamera(-1, 1, 1, -1, .1, 10);
    S.targets = new Map();
    return { clips: studio.getDocument().clips.map(c => ({ id: c.id, name: c.name, duration: c.duration, loop: c.loop?.mode ?? c.loopMode ?? null, speed: c.playbackSpeed ?? 1, start: c.range?.start ?? 0, end: c.range?.end ?? c.duration })) };
  };
  const pose = (clipId, time) => {
    const { diag, studio, p } = S;
    if (diag.getState().clipId !== clipId && !diag.selectClip(clipId)) throw new Error('no clip ' + clipId);
    diag.pause(); diag.seek(time); studio.frame(0);
    p.group.updateMatrixWorld(true);
  };
  /** The rider's frame: origin at the group, axes from its world rotation (scale dropped). */
  const frameOf = () => {
    const { T, p } = S, m = p.group.matrixWorld, o = new T.Vector3().setFromMatrixPosition(m);
    const x = new T.Vector3().setFromMatrixColumn(m, 0).normalize(), y = new T.Vector3().setFromMatrixColumn(m, 1).normalize(), z = new T.Vector3().setFromMatrixColumn(m, 2).normalize();
    return { o, x, y, z };
  };
  const measure = (clipId, times) => {
    const { T, p } = S, out = { min: [1e9, 1e9, 1e9], max: [-1e9, -1e9, -1e9] }, v = new T.Vector3();
    for (const t of times) {
      pose(clipId, t); const f = frameOf();
      p.group.traverse(o => {
        if (!o.isMesh || !o.visible) return; let vis = true; for (let q = o; q && q !== p.group.parent; q = q.parent) if (!q.visible) { vis = false; break; } if (!vis) return;
        const g = o.geometry; if (!g?.attributes?.position) return; if (!g.boundingBox) g.computeBoundingBox(); const b = g.boundingBox; if (b.isEmpty() || !isFinite(b.min.x + b.max.x + b.min.y + b.max.y + b.min.z + b.max.z)) return;
        for (let i = 0; i < 8; i++) { v.set(i & 1 ? b.max.x : b.min.x, i & 2 ? b.max.y : b.min.y, i & 4 ? b.max.z : b.min.z).applyMatrix4(o.matrixWorld).sub(f.o); const l = [v.dot(f.x), v.dot(f.y), v.dot(f.z)]; if (!isFinite(l[0] + l[1] + l[2])) { out.bad = (out.bad ?? 0) + 1; out.badName = o.name; continue; } for (let k = 0; k < 3; k++) { out.min[k] = Math.min(out.min[k], l[k]); out.max[k] = Math.max(out.max[k], l[k]); } }
      });
    }
    return out;
  };
  const target = (w, h) => { const k = `${w}x${h}`; if (!S.targets.has(k)) { const { T } = S, rt = new T.WebGLRenderTarget(w, h, { depthBuffer: true }); rt.texture.colorSpace = T.SRGBColorSpace; rt.depthTexture = new T.DepthTexture(w, h); rt.depthTexture.type = T.UnsignedIntType; rt.depthTexture.minFilter = rt.depthTexture.magFilter = T.NearestFilter; const dt = new T.WebGLRenderTarget(w, h, { depthBuffer: false, minFilter: T.NearestFilter, magFilter: T.NearestFilter }); S.targets.set(k, [rt, dt]); } return S.targets.get(k); };
  const b64 = (u8) => { let s = ''; const n = 0x8000; for (let i = 0; i < u8.length; i += n) s += String.fromCharCode.apply(null, u8.subarray(i, i + n)); return btoa(s); };
  /**
   * Capture one pose. `box` = { c:[x,y,z] centre, e:[ex,ey,ez] half-extents } in the rider's frame (metres); `px` = pixels per metre.
   * Views: 0 from +Z looking −Z, 1 from +X, 2 from −Z, 3 from −X, 4 from above, 5 from below. `dep` holds the depth buffer
   * as three bytes (d = r/255 + g/255² + b/255³, 0 at the near plane, 1 at the far plane and on empty pixels).
   */
  const frame = (clipId, time, box, px) => {
    const { T, p, g, cap, cam } = S; pose(clipId, time);
    const f = frameOf(), R = 4, C = f.o.clone().addScaledVector(f.x, box.c[0]).addScaledVector(f.y, box.c[1]).addScaledVector(f.z, box.c[2]);
    const dirs = [
      { d: f.z.clone().negate(), r: f.x.clone(), u: f.y.clone(), hw: box.e[0], hh: box.e[1] },
      { d: f.x.clone().negate(), r: f.z.clone().negate(), u: f.y.clone(), hw: box.e[2], hh: box.e[1] },
      { d: f.z.clone(), r: f.x.clone().negate(), u: f.y.clone(), hw: box.e[0], hh: box.e[1] },
      { d: f.x.clone(), r: f.z.clone(), u: f.y.clone(), hw: box.e[2], hh: box.e[1] },
      { d: f.y.clone().negate(), r: f.x.clone(), u: f.z.clone().negate(), hw: box.e[0], hh: box.e[2] },
      { d: f.y.clone(), r: f.x.clone(), u: f.z.clone(), hw: box.e[0], hh: box.e[2] },
    ];
    const r = g.renderer, keep = { rt: r.getRenderTarget(), clear: r.getClearColor(new T.Color()), alpha: r.getClearAlpha(), auto: r.autoClear, shadow: r.shadowMap.enabled };
    const parent = p.group.parent; cap.add(p.group); r.shadowMap.enabled = false; r.autoClear = true;
    const out = [];
    try {
      for (const v of dirs) {
        const w = Math.round(v.hw * 2 * px), h = Math.round(v.hh * 2 * px), [rt, dt] = target(w, h);
        cam.left = -v.hw; cam.right = v.hw; cam.top = v.hh; cam.bottom = -v.hh; cam.near = .05; cam.far = R * 2; cam.updateProjectionMatrix();
        cam.position.copy(C).addScaledVector(v.d, -R); cam.up.copy(v.u); cam.lookAt(C); cam.updateMatrixWorld(true);
        r.setClearColor(0x000000, 0); r.setRenderTarget(rt); r.clear(); r.render(cap, cam);
        const col = new Uint8Array(w * h * 4); r.readRenderTargetPixels(rt, 0, 0, w, h, col);
        S.packMat.uniforms.tDepth.value = rt.depthTexture; r.setRenderTarget(dt); r.clear(); r.render(S.quadScene, S.quadCam);
        const dep = new Uint8Array(w * h * 4); r.readRenderTargetPixels(dt, 0, 0, w, h, dep);
        out.push({ w, h, near: cam.near, far: cam.far, col: b64(col), dep: b64(dep) });
      }
    } finally { (parent ?? S.home).add(p.group); r.setRenderTarget(keep.rt); r.setClearColor(keep.clear, keep.alpha); r.autoClear = keep.auto; r.shadowMap.enabled = keep.shadow; }
    return { views: out, R };
  };
  /**
   * The rider as the game draws him, one tile per time, for a side-by-side with his stack. The camera sits `o.dist`
   * metres from a point `o.height` above his origin, `o.elev` degrees up and `o.yaw` degrees round from straight behind
   * (toward his left-hand side as the lab's camera turns). Each tile is rendered at twice its size and scaled down.
   * Returns one WebP: tiles of `o.w` by `o.h` in `o.cols` columns on `o.background`.
   */
  const reference = (clipId, times, o) => {
    const { T, p, g, cap } = S, r = g.renderer, W = o.w * 2, H = o.h * 2, [rt] = target(W, H);
    const cam = S.viewCam ?? (S.viewCam = new T.PerspectiveCamera()); cam.fov = o.fov; cam.aspect = o.w / o.h; cam.near = .1; cam.far = 60; cam.updateProjectionMatrix();
    const sheet = document.createElement('canvas'); sheet.width = o.cols * o.w; sheet.height = Math.ceil(times.length / o.cols) * o.h;
    const ctx = sheet.getContext('2d'); ctx.fillStyle = o.background; ctx.fillRect(0, 0, sheet.width, sheet.height); ctx.imageSmoothingQuality = 'high';
    const tile = document.createElement('canvas'); tile.width = W; tile.height = H; const tctx = tile.getContext('2d'), image = tctx.createImageData(W, H), px = new Uint8Array(W * H * 4);
    const keep = { rt: r.getRenderTarget(), clear: r.getClearColor(new T.Color()), alpha: r.getClearAlpha(), auto: r.autoClear, shadow: r.shadowMap.enabled };
    const e = o.elev * Math.PI / 180, y = o.yaw * Math.PI / 180;
    r.shadowMap.enabled = false; r.autoClear = true;
    try {
      for (const [n, time] of times.entries()) {
        pose(clipId, time);
        const f = frameOf(), focus = f.o.clone().addScaledVector(f.y, o.height), parent = p.group.parent;
        cam.position.copy(focus).addScaledVector(f.x, -Math.sin(y) * o.dist * Math.cos(e)).addScaledVector(f.y, o.dist * Math.sin(e)).addScaledVector(f.z, -Math.cos(y) * o.dist * Math.cos(e));
        cam.up.copy(f.y); cam.lookAt(focus); cam.updateMatrixWorld(true);
        cap.add(p.group);
        try { r.setClearColor(0x000000, 0); r.setRenderTarget(rt); r.clear(); r.render(cap, cam); r.readRenderTargetPixels(rt, 0, 0, W, H, px); }
        finally { (parent ?? S.home).add(p.group); }
        for (let row = 0; row < H; row++) image.data.set(px.subarray((H - 1 - row) * W * 4, (H - row) * W * 4), row * W * 4);
        tctx.putImageData(image, 0, 0);
        ctx.drawImage(tile, 0, 0, W, H, (n % o.cols) * o.w, Math.floor(n / o.cols) * o.h, o.w, o.h);
      }
    } finally { r.setRenderTarget(keep.rt); r.setClearColor(keep.clear, keep.alpha); r.autoClear = keep.auto; r.shadowMap.enabled = keep.shadow; }
    return sheet.toDataURL('image/webp', o.quality ?? .9);
  };
  const restore = () => { for (const o of S.hidden ?? []) o.visible = true; };
  window.__stackCapture = { setup, measure, frame, reference, restore };
})();
