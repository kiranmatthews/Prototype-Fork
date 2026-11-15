import * as THREE from 'three';
import './lab.css';

/**
 * SPRITE STACK LAB
 *
 * The game's own rider, baked by tools/sprite-stack/bake.mjs from Animation Studio clips into stacks of flat slices,
 * drawn here three ways (one quad per slice, several quads per slice, or marched as voxels) under the cameras the
 * game really uses. Everything on screen comes from the slice sheets in public/sprite-stack-lab/: there is no 3D
 * character in this page.
 */
interface ClipInfo { id: string; slug: string; label: string; group: string; studioName: string; frames: number; loop: boolean; seconds: number; offsets: [number, number, number][]; }
interface StyleInfo { palette: string[]; bytes: number; }
/** A loop of the rider as the game draws him, and the camera it was taken from (relative to the rider). */
interface Reference { file: string; frames: number; dist: number; elev: number; yaw: number; height: number; fov: number; }
interface Manifest { version: number; grid: [number, number, number]; voxel: number; sheet: { cell: [number, number]; views: string[] }; source: { studioClips: number; studioSeconds: number }; clips: ClipInfo[]; styles: Record<string, StyleInfo>; reference?: { tile: [number, number]; cols: number; clips: Record<string, Reference> }; }
/**
 * `feet` is how far the lowest drawn pixel of each frame sits above the rider's origin and `ground` the lowest of them;
 * `box` is the part of the grid the clip ever uses (x, z, then layers); `shell` marks the empty cells that touch a filled one.
 */
interface Sheet { texture: THREE.DataTexture; shell: THREE.DataTexture; data: Uint8Array; width: number; height: number; feet: Float32Array; ground: number; box: [number, number, number, number, number, number]; }
type DrawMode = 'slices' | 'voxels';

const $ = <T extends HTMLElement>(id: string): T => document.getElementById(id) as T;
const BASE = new URL('./sprite-stack-lab/', document.baseURI).href;
const clamp = (v: number, a: number, b: number): number => Math.max(a, Math.min(b, v));
const RAD = Math.PI / 180;

// ───────────────────────────── data ─────────────────────────────
const manifest = await (await fetch(`${BASE}manifest.json`)).json() as Manifest;
const [NX, NY, NZ] = manifest.grid, VOXEL = manifest.voxel;
const clipById = new Map(manifest.clips.map(c => [c.id, c]));
/** Where a stack's colour came from. Every source but the first is a test of the plan, baked by tools/sprite-stack. */
const SOURCES: Record<string, { label: string; note: string }> = {
  captured: { label: 'The 3D rider', note: 'Each cube takes its colour from the game\u2019s own rider, seen from five sides: front, left, back, right and above.' },
  'four-sides': { label: 'Four pictures only', note: 'The plan as written: four side pictures and nothing from above. The top of the head, the shoulders and the board\u2019s deck can only borrow colour from the edge of a side picture. Compare the deck with \u201cThe 3D rider\u201d.' },
  ink: { label: 'Stills repainted: ink line', note: 'A stand-in for an image model, made in code: every still repainted in flat comic colour with a bold outline, then wrapped back onto the model. An outline belongs to one picture\u2019s edge, so on the model it lands as dark smears wherever another picture looks straight at that spot.' },
  neon: { label: 'Stills repainted: glow line', note: 'A second code stand-in: a dark body with glowing edge lines painted into every still. The same thing happens: lines that hug the edge of one picture do not hug the figure from any other angle.' },
};
/** Any other style in the manifest is a repainted set someone baked with `bake.mjs build --recolour`. */
const sourceOf = (id: string): { label: string; note: string } => SOURCES[id] ?? { label: `Stills repainted: ${id}`, note: 'A repainted set of stills, wrapped back onto the model by tools/sprite-stack/bake.mjs.' };
type Look = 'plain' | 'comic' | 'neon';
const toHsv = (r: number, g: number, b: number): [number, number, number] => { r /= 255; g /= 255; b /= 255; const max = Math.max(r, g, b), d = max - Math.min(r, g, b); let h = 0; if (d) { h = max === r ? ((g - b) / d) % 6 : max === g ? (b - r) / d + 2 : (r - g) / d + 4; h /= 6; if (h < 0) h += 1; } return [h, max ? d / max : 0, max]; };
const toRgb = (h: number, s: number, v: number): [number, number, number] => { const i = Math.floor(h * 6), f = h * 6 - i, q = v * (1 - s), t = v * (1 - f * s), u = v * (1 - (1 - f) * s); const [r, g, b] = [[v, u, q], [t, v, q], [q, v, u], [q, t, v], [u, q, v], [v, q, t]][i % 6]; return [Math.round(r * 255), Math.round(g * 255), Math.round(b * 255)]; };
/** A look is a rule, not a painting: a colour mapping, an outline colour and how strongly tops and sides are told apart. */
const LOOKS: Record<Look, { label: string; note: string; outline: [number, number, number]; shade: [number, number]; paint: (r: number, g: number, b: number) => [number, number, number] }> = {
  plain: { label: 'Plain', note: 'No extra look: the colours as they are.', outline: [27, 20, 48], shade: [1.1, .9], paint: (r, g, b) => [r, g, b] },
  comic: { label: 'Comic', note: 'A rule applied while drawing: colours pulled toward three flat tones, bone warmed, blacks turned violet. Worked out from the model, so it is identical from every angle and in every frame.', outline: [27, 20, 48], shade: [1.06, .8],
    paint: (r, g, b) => {
      let [h, s, v] = toHsv(r, g, b);
      // Three tones with a short ramp between them: flat areas stay flat, and a colour near a step does not flicker across it.
      const t = Math.min(.9999, v) * 3, ramp = Math.min(1, Math.max(0, (t % 1 - .3) / .4));
      v = .26 + (Math.floor(t) + ramp * ramp * (3 - 2 * ramp)) / 3 * .74;
      if (s < .22) { h = .1; s = .1 + (1 - v) * .28; } else s = Math.min(1, s * 1.45 + .1);
      if (v < .38) { h = .7; s = .42; }
      return toRgb(h, s, v);
    } },
  neon: { label: 'Neon', note: 'Another rule: the body goes dark, anything already hot stays lit, and the outline carries the shape.', outline: [80, 240, 255], shade: [1.25, .8],
    paint: (r, g, b) => { const [h, s, v] = toHsv(r, g, b); return s > .62 && v > .72 ? toRgb(h, 1, 1) : toRgb(.68 + (h - .5) * .08, .55, .1 + v * .22); } },
};

const sheets = new Map<string, Promise<Sheet>>();
/** A clip's slice sheet: one row per frame, one tile per layer, grey value = palette index. */
const loadSheet = (style: string, clip: ClipInfo): Promise<Sheet> => {
  const key = `${style}/${clip.slug}`;
  let pending = sheets.get(key);
  if (!pending) {
    pending = (async () => {
      const blob = await (await fetch(`${BASE}${key}.png`)).blob();
      const bitmap = await createImageBitmap(blob, { colorSpaceConversion: 'none', premultiplyAlpha: 'none' });
      const canvas = document.createElement('canvas'); canvas.width = bitmap.width; canvas.height = bitmap.height;
      const ctx = canvas.getContext('2d', { willReadFrequently: true })!; ctx.drawImage(bitmap, 0, 0);
      const rgba = ctx.getImageData(0, 0, bitmap.width, bitmap.height).data, data = new Uint8Array(bitmap.width * bitmap.height);
      for (let i = 0; i < data.length; i++) data[i] = rgba[i * 4];
      const texture = new THREE.DataTexture(data, bitmap.width, bitmap.height, THREE.RedFormat, THREE.UnsignedByteType);
      texture.minFilter = texture.magFilter = THREE.NearestFilter; texture.unpackAlignment = 1; texture.needsUpdate = true;
      const W = bitmap.width, feet = new Float32Array(clip.frames), box: Sheet['box'] = [NX, 0, NZ, 0, NY, 0], shellData = new Uint8Array(data.length);
      for (let f = 0; f < clip.frames; f++) {
        let low = NY;
        for (let j = 0; j < NY; j++) for (let k = 0; k < NZ; k++) {
          const row = (f * NZ + k) * W + j * NX;
          for (let i = 0; i < NX; i++) {
            const o = row + i;
            if (data[o]) { if (j < low) low = j; if (i < box[0]) box[0] = i; if (i > box[1]) box[1] = i; if (k < box[2]) box[2] = k; if (k > box[3]) box[3] = k; if (j < box[4]) box[4] = j; if (j > box[5]) box[5] = j; }
            else if ((i > 0 && data[o - 1]) || (i < NX - 1 && data[o + 1]) || (k > 0 && data[o - W]) || (k < NZ - 1 && data[o + W]) || (j > 0 && data[o - NX]) || (j < NY - 1 && data[o + NX])) shellData[o] = 255;
          }
        }
        feet[f] = (clip.offsets[f][1] - NY / 2 + low) * VOXEL;
      }
      const shell = new THREE.DataTexture(shellData, W, bitmap.height, THREE.RedFormat, THREE.UnsignedByteType);
      shell.minFilter = shell.magFilter = THREE.NearestFilter; shell.unpackAlignment = 1; shell.needsUpdate = true;
      return { texture, shell, data, width: W, height: bitmap.height, feet, ground: Math.min(...feet), box };
    })();
    sheets.set(key, pending);
  }
  return pending;
};
const palettes = new Map<string, { texture: THREE.DataTexture; rgb: Uint8Array }>();
/** A style's palette with a look's colour rule applied: 255 colours, entry 0 empty. */
const paletteOf = (style: string, look: Look) => {
  const key = `${style}/${look}`;
  let hit = palettes.get(key);
  if (!hit) {
    const rgb = new Uint8Array(256 * 3), rgba = new Uint8Array(256 * 4);
    manifest.styles[style].palette.forEach((hex, n) => { const v = parseInt(hex.slice(1), 16), i = n + 1, c = LOOKS[look].paint(v >> 16, v >> 8 & 255, v & 255); rgb.set(c, i * 3); rgba.set([...c, 255], i * 4); });
    const texture = new THREE.DataTexture(rgba, 256, 1, THREE.RGBAFormat, THREE.UnsignedByteType);
    texture.minFilter = texture.magFilter = THREE.NearestFilter; texture.needsUpdate = true;
    hit = { texture, rgb }; palettes.set(key, hit);
  }
  return hit;
};

// ───────────────────────────── scene ─────────────────────────────
const canvas = $<HTMLCanvasElement>('stage');
const renderer = new THREE.WebGLRenderer({ canvas, antialias: false, powerPreference: 'high-performance' });
renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 1.5)); // squares this size gain nothing from more
const scene = new THREE.Scene();
scene.background = new THREE.Color('#15122a'); scene.fog = new THREE.Fog('#15122a', 30, 80);
const camera = new THREE.PerspectiveCamera(49, 1, .1, 220);
scene.add(new THREE.HemisphereLight('#dfe6ff', '#2a2440', 2.2));
const sun = new THREE.DirectionalLight('#fff1d6', 1.6); sun.position.set(-6, 11, 7); scene.add(sun);

const paint = (size: number, draw: (c: CanvasRenderingContext2D, s: number) => void): THREE.CanvasTexture => {
  const el = document.createElement('canvas'); el.width = el.height = size; draw(el.getContext('2d')!, size);
  const t = new THREE.CanvasTexture(el); t.colorSpace = THREE.SRGBColorSpace; t.wrapS = t.wrapT = THREE.RepeatWrapping; t.magFilter = THREE.NearestFilter; return t;
};
// Floor: one-metre tiles, every fifth line brighter, so speed and scale can be read.
const floorTexture = paint(320, (c, s) => {
  c.fillStyle = '#211c3d'; c.fillRect(0, 0, s, s);
  for (let i = 0; i < 5; i++) for (let j = 0; j < 5; j++) if ((i + j) % 2) { c.fillStyle = '#251f45'; c.fillRect(i * 64, j * 64, 64, 64); }
  c.strokeStyle = '#3a3168'; c.lineWidth = 2; for (let i = 0; i <= 5; i++) { c.beginPath(); c.moveTo(i * 64, 0); c.lineTo(i * 64, s); c.moveTo(0, i * 64); c.lineTo(s, i * 64); c.stroke(); }
  c.strokeStyle = '#5b4fa0'; c.lineWidth = 4; c.strokeRect(0, 0, s, s);
});
floorTexture.repeat.set(32, 32);
const floor = new THREE.Mesh(new THREE.PlaneGeometry(160, 160), new THREE.MeshLambertMaterial({ map: floorTexture }));
floor.rotation.x = -Math.PI / 2; scene.add(floor);

// A few crates and blocks at the game's sizes: something to judge scale against, stand on and pass behind.
interface Solid { min: THREE.Vector3; max: THREE.Vector3; }
const solids: Solid[] = [];
const crateTexture = paint(64, (c, s) => {
  c.fillStyle = '#c96f2a'; c.fillRect(0, 0, s, s); c.fillStyle = '#e08a3c'; c.fillRect(8, 8, s - 16, s - 16);
  c.strokeStyle = '#8a4517'; c.lineWidth = 6; c.strokeRect(3, 3, s - 6, s - 6); c.lineWidth = 5; c.beginPath(); c.moveTo(8, 8); c.lineTo(s - 8, s - 8); c.moveTo(s - 8, 8); c.lineTo(8, s - 8); c.stroke();
});
const crateMaterial = new THREE.MeshLambertMaterial({ map: crateTexture }), stoneMaterial = new THREE.MeshLambertMaterial({ color: '#4a4470' });
const addBox = (x: number, y: number, z: number, w: number, h: number, d: number, material: THREE.Material): void => {
  const mesh = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), material); mesh.position.set(x, y + h / 2, z); scene.add(mesh);
  solids.push({ min: new THREE.Vector3(x - w / 2, y, z - d / 2), max: new THREE.Vector3(x + w / 2, y + h, z + d / 2) });
};
const CR = 1.152;
for (const [x, y, z] of [[4, 0, -6], [4 + CR, 0, -6], [4, CR, -6], [-5, 0, -9], [-5, 0, -9 - CR], [-5 - CR, 0, -9], [9, 0, 2]] as const) addBox(x, y, z, CR, CR, CR, crateMaterial);
addBox(-8, 0, 3, 5, 1.4, 4, stoneMaterial); addBox(-12.5, 0, 3, 4, 2.8, 4, stoneMaterial); addBox(0, 0, -16, 14, .6, 3, stoneMaterial);
const groundUnder = (x: number, z: number, feet: number, radius = .35): number => {
  let y = 0;
  for (const s of solids) if (x > s.min.x - radius && x < s.max.x + radius && z > s.min.z - radius && z < s.max.z + radius && s.max.y <= feet + .45 && s.max.y > y) y = s.max.y;
  return y;
};

// ───────────────────────────── the stack ─────────────────────────────
const SHARED = /* glsl */`
uniform sampler2D uSheet; uniform sampler2D uShell; uniform sampler2D uPalette; uniform vec2 uSheetSize; uniform vec3 uGrid; uniform float uFrame;
// The slice sheet is the volume: column block = layer, row block = frame.
vec2 sheetAt(vec3 c) { return vec2(c.y * uGrid.x + c.x + .5, uFrame * uGrid.z + c.z + .5) / uSheetSize; }
bool outside(vec3 c) { return c.x < 0. || c.y < 0. || c.z < 0. || c.x >= uGrid.x || c.y >= uGrid.y || c.z >= uGrid.z; }
float voxelAt(vec3 c) { return outside(c) ? 0. : floor(texture2D(uSheet, sheetAt(c)).r * 255. + .5); }
// One cube out from the figure: the cells its outline is drawn in.
float shellAt(vec3 c) { return outside(c) ? 0. : step(.5, texture2D(uShell, sheetAt(c)).r); }
vec3 colourOf(float i) { return texture2D(uPalette, vec2((i + .5) / 256., .5)).rgb; }
`;
const uniforms = {
  uSheet: { value: null as THREE.Texture | null }, uShell: { value: null as THREE.Texture | null }, uPalette: { value: null as THREE.Texture | null }, uSheetSize: { value: new THREE.Vector2(1, 1) },
  uBox: { value: new THREE.Vector4(0, 0, NX, NZ) }, uLayers: { value: new THREE.Vector2(0, NY - 1) }, // only the part of the grid the clip uses is drawn
  uGrid: { value: new THREE.Vector3(NX, NY, NZ) }, uFrame: { value: 0 }, uVoxel: { value: VOXEL }, uSub: { value: 1 }, uExplode: { value: 1 },
  uShade: { value: new THREE.Vector2(1.1, .9) }, uOutline: { value: new THREE.Vector3() }, uPush: { value: 0 }, uCamLocal: { value: new THREE.Vector3() },
};
/**
 * The outline is the stack drawn a second time, one cube fatter, in one colour, and pushed away from the camera along
 * each sight line: the coloured stack covers it everywhere except round the figure's edge and where a limb stands
 * clear of the body. It is found from the model while drawing, so it is right from every angle.
 */
const outlineUniforms = { ...uniforms, uPush: { value: 2.5 * VOXEL } };
// One quad per slice (or several per slice, spread through its thickness): the classic technique, drawn in 3D.
const sliceGeometry = new THREE.InstancedBufferGeometry();
sliceGeometry.setAttribute('position', new THREE.Float32BufferAttribute([0, 0, 0, 1, 0, 0, 0, 0, 1, 1, 0, 1], 3));
sliceGeometry.setAttribute('uv', new THREE.Float32BufferAttribute([0, 0, 1, 0, 0, 1, 1, 1], 2));
sliceGeometry.setIndex([0, 2, 1, 1, 2, 3]); sliceGeometry.instanceCount = NY;
const sliceShaders = {
  side: THREE.DoubleSide,
  vertexShader: /* glsl */`
    uniform vec3 uGrid; uniform vec4 uBox; uniform vec2 uLayers; uniform float uVoxel, uSub, uExplode, uPush;
    varying vec2 vCell; varying float vLayer;
    void main() {
      float id = float(gl_InstanceID), layer = floor(id / uSub), within = (mod(id, uSub) + .5) / uSub;
      vCell = mix(uBox.xy, uBox.zw, uv); vLayer = layer;
      vec3 p = vec3(vCell.x - uGrid.x * .5, layer * uExplode + within - uGrid.y * .5, vCell.y - uGrid.z * .5) * uVoxel;
      vec4 mv = modelViewMatrix * vec4(p, 1.);
      mv.xyz += normalize(mv.xyz) * uPush; // further along the same sight line: same place on screen, deeper
      gl_Position = layer < uLayers.x || layer > uLayers.y ? vec4(2., 2., 2., 1.) : projectionMatrix * mv; // empty layers are not drawn at all
    }`,
  fragmentShader: /* glsl */`
    ${SHARED}
    uniform vec2 uShade; uniform vec3 uOutline; varying vec2 vCell; varying float vLayer;
    void main() {
      vec3 c = vec3(floor(vCell.x), vLayer, floor(vCell.y));
      #ifdef OUTLINE
        if (shellAt(c) < .5) discard;
        gl_FragColor = vec4(uOutline, 1.);
      #else
        float i = voxelAt(c); if (i < .5) discard;
        // A pixel with nothing above it is a top face and catches the light; a roofed one is side wall.
        gl_FragColor = vec4(colourOf(i) * (voxelAt(c + vec3(0., 1., 0.)) < .5 ? uShade.x : uShade.y), 1.);
      #endif
    }`,
};
const sliceMesh = new THREE.Mesh(sliceGeometry, new THREE.ShaderMaterial({ uniforms, ...sliceShaders })); sliceMesh.frustumCulled = false;
const sliceOutline = new THREE.Mesh(sliceGeometry, new THREE.ShaderMaterial({ uniforms: outlineUniforms, defines: { OUTLINE: 1 }, ...sliceShaders })); sliceOutline.frustumCulled = false;
// The same data marched as voxels: what the stack turns into when it must hold up edge-on.
const voxelShaders = {
  side: THREE.BackSide,
  vertexShader: /* glsl */`
    uniform vec3 uGrid; uniform float uVoxel; varying vec3 vLocal;
    void main() { vLocal = position / uVoxel + uGrid * .5; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.); }`,
  fragmentShader: /* glsl */`
    ${SHARED}
    uniform mat4 projectionMatrix; uniform mat4 modelViewMatrix; uniform vec3 uCamLocal, uOutline; uniform vec4 uBox; uniform vec2 uShade, uLayers; uniform float uVoxel, uPush;
    varying vec3 vLocal;
    void main() {
      vec3 ro = uCamLocal, rd = normalize(vLocal - uCamLocal), inv = 1. / (rd + vec3(1e-6) * (1. - abs(sign(rd))));
      vec3 bmin = vec3(uBox.x, uLayers.x - 1., uBox.y), bmax = vec3(uBox.z, uLayers.y + 2., uBox.w); // march only through the part in use
      vec3 a = (bmin - ro) * inv, b = (bmax - ro) * inv, lo = min(a, b), hi = max(a, b);
      float tn = max(max(lo.x, lo.y), lo.z), tf = min(min(hi.x, hi.y), hi.z);
      if (tf <= max(tn, 0.)) discard;
      float t = max(tn, 0.);
      vec3 p = ro + rd * (t + 1e-3), cell = clamp(floor(p), bmin, bmax - 1.), stepv = sign(rd) + (1. - abs(sign(rd))), delta = abs(inv);
      vec3 next = t + (cell + max(stepv, 0.) - p) * inv;
      vec3 n = tn > 0. ? (lo.x >= lo.y && lo.x >= lo.z ? vec3(-stepv.x, 0., 0.) : lo.y >= lo.z ? vec3(0., -stepv.y, 0.) : vec3(0., 0., -stepv.z)) : vec3(0., 1., 0.);
      for (int k = 0; k < 200; k++) {
        #ifdef OUTLINE
          float i = shellAt(cell);
        #else
          float i = voxelAt(cell);
        #endif
        if (i > .5) {
          vec4 eye = modelViewMatrix * vec4((ro + rd * t - uGrid * .5) * uVoxel, 1.);
          eye.xyz += normalize(eye.xyz) * uPush;
          vec4 clip = projectionMatrix * eye;
          gl_FragDepth = clip.z / clip.w * .5 + .5;
          #ifdef OUTLINE
            gl_FragColor = vec4(uOutline, 1.);
          #else
            gl_FragColor = vec4(colourOf(i) * (n.y > .5 ? uShade.x : n.y < -.5 ? uShade.y * .8 : abs(n.x) > .5 ? uShade.y * 1.04 : uShade.y * .94), 1.);
          #endif
          return;
        }
        if (next.x < next.y && next.x < next.z) { t = next.x; next.x += delta.x; cell.x += stepv.x; n = vec3(-stepv.x, 0., 0.); }
        else if (next.y < next.z) { t = next.y; next.y += delta.y; cell.y += stepv.y; n = vec3(0., -stepv.y, 0.); }
        else { t = next.z; next.z += delta.z; cell.z += stepv.z; n = vec3(0., 0., -stepv.z); }
        if (any(lessThan(cell, bmin)) || any(greaterThanEqual(cell, bmax))) break;
      }
      discard;
    }`,
};
const voxelGeometry = new THREE.BoxGeometry(NX * VOXEL, NY * VOXEL, NZ * VOXEL);
const voxelMesh = new THREE.Mesh(voxelGeometry, new THREE.ShaderMaterial({ uniforms, ...voxelShaders })); voxelMesh.frustumCulled = false;
const voxelOutline = new THREE.Mesh(voxelGeometry, new THREE.ShaderMaterial({ uniforms: outlineUniforms, defines: { OUTLINE: 1 }, ...voxelShaders })); voxelOutline.frustumCulled = false;
const inverse = new THREE.Matrix4();
voxelMesh.onBeforeRender = voxelOutline.onBeforeRender = (_r, _s, cam) => { inverse.copy(voxelMesh.matrixWorld).invert(); uniforms.uCamLocal.value.copy(cam.position).applyMatrix4(inverse).divideScalar(VOXEL).add(new THREE.Vector3(NX / 2, NY / 2, NZ / 2)); };
/** `rider` sits at the feet and turns with the facing; `stack` carries each frame's own offset inside it. */
const rider = new THREE.Group(), stack = new THREE.Group(); stack.add(sliceMesh, sliceOutline, voxelMesh, voxelOutline); rider.add(stack); scene.add(rider);
/** The grind study rides a rail the capture does not include: a stand-in, shown while the board is up on it. */
const rail = new THREE.Group();
{ const steel = new THREE.MeshLambertMaterial({ color: '#8f8ab8' }), bar = new THREE.Mesh(new THREE.BoxGeometry(.12, .12, 7), steel); bar.position.y = .72; rail.add(bar);
  for (const z of [-3, 0, 3]) { const leg = new THREE.Mesh(new THREE.BoxGeometry(.1, .66, .1), steel); leg.position.set(0, .33, z); rail.add(leg); } }
rail.visible = false; rider.add(rail);
// ───────────────────────────── side by side ─────────────────────────────
// The game's own rider, captured from the chase camera, next to the stack drawn from that same camera at the same moment.
for (const mesh of [sliceMesh, sliceOutline, voxelMesh, voxelOutline]) mesh.layers.enable(1);
const versusCamera = new THREE.PerspectiveCamera(); versusCamera.layers.set(1);
const versusEl = $('versus'), versusSlot = $('versus-slot'), versusReal = $<HTMLCanvasElement>('versus-real').getContext('2d')!;
const referenceImages = new Map<string, HTMLImageElement>();
const referenceImage = (file: string): HTMLImageElement | null => {
  let image = referenceImages.get(file);
  if (!image) { image = new Image(); image.src = `${BASE}${file}`; referenceImages.set(file, image); }
  return image.complete && image.naturalWidth ? image : null;
};
const versusEye = new THREE.Vector3(), versusFocus = new THREE.Vector3();
const drawVersus = (ref: Reference, sheet: Sheet): void => {
  const { tile: [w, h], cols } = manifest.reference!, image = referenceImage(ref.file);
  if (image) { const n = Math.min(ref.frames - 1, Math.floor(state.phase * ref.frames)); versusReal.drawImage(image, (n % cols) * w, Math.floor(n / cols) * h, w, h, 0, 0, w, h); }
  $('versus-count').textContent = `${state.clip.frames} poses`;
  // The stack stands on its clip's lowest frame, so the camera drops by the same amount to stay level with the capture.
  const e = ref.elev * RAD, y = ref.yaw * RAD, reach = ref.dist * Math.cos(e);
  rider.updateMatrixWorld(true);
  versusFocus.set(0, ref.height - sheet.ground, 0); versusEye.set(-Math.sin(y) * reach, ref.height - sheet.ground + ref.dist * Math.sin(e), -Math.cos(y) * reach);
  versusCamera.position.copy(versusEye.applyMatrix4(rider.matrixWorld)); versusCamera.lookAt(versusFocus.applyMatrix4(rider.matrixWorld));
  const slot = versusSlot.getBoundingClientRect(), stage = canvas.getBoundingClientRect();
  versusCamera.fov = ref.fov; versusCamera.aspect = slot.width / Math.max(1, slot.height); versusCamera.updateProjectionMatrix();
  const x = slot.left - stage.left, bottom = stage.bottom - slot.bottom;
  renderer.setScissorTest(true); renderer.setViewport(x, bottom, slot.width, slot.height); renderer.setScissor(x, bottom, slot.width, slot.height);
  renderer.render(scene, versusCamera);
  renderer.setScissorTest(false); renderer.setViewport(0, 0, stage.width, stage.height);
};

const blob = new THREE.Mesh(new THREE.CircleGeometry(.62, 24), new THREE.MeshBasicMaterial({ color: '#07060f', transparent: true, opacity: .42, depthWrite: false }));
blob.rotation.x = -Math.PI / 2; scene.add(blob);

// ───────────────────────────── state ─────────────────────────────
const state = {
  style: 'captured', look: 'plain' as Look, mode: 'slices' as DrawMode, sub: 1, explode: 1, outline: false, turntable: false, versus: false, phase: 0,
  preview: null as ClipInfo | null, paused: false, rate: 1,
  cam: { preset: 'foot', elev: 37, dist: 6.5, ahead: 3.2, yaw: 0, fov: 49 },
  clip: clipById.get('player.idle') ?? manifest.clips[0], time: 0, frame: 0, sheet: null as Sheet | null,
};
const CAMERAS: Record<string, { label: string; note: string; elev: number; dist: number; ahead: number; fov: number }> = {
  // Measured in the running game on Powderkeg Peak (camera height and distance from the rider, pitch of the lens).
  foot: { label: 'On foot', note: 'The chase camera: 5.1 m up, 5.2 m back, lens pitched 25° down.', elev: 37, dist: 6.5, ahead: 3.2, fov: 49 },
  board: { label: 'On the board', note: 'The board camera: 5.6 m up, 4.5 m back, lens pitched 33° down.', elev: 44, dist: 6.3, ahead: 2.3, fov: 54 },
  side: { label: 'Side-on rows', note: 'The side camera of the ledge rows and bonus rooms: 3.2 m up, 16.4 m away, 7° down.', elev: 7, dist: 16.5, ahead: 0, fov: 49 },
  classic: { label: 'Classic top-down', note: 'Where sprite stacking comes from: a long lens looking down at 55°.', elev: 55, dist: 15, ahead: 0, fov: 26 },
};
const body = { pos: new THREE.Vector3(0, 0, 4), vel: new THREE.Vector3(), yaw: Math.PI, grounded: true, board: false, doubled: false, spin: 0, landing: 0, action: null as ClipInfo | null, actionTime: 0 };
const keys = new Set<string>();

const need = (id: string): ClipInfo => clipById.get(id) ?? manifest.clips[0];
const CLIPS = { idle: need('player.idle'), walk: need('player.walk'), run: need('player.run'), jump: need('player.jump'), fall: need('player.fall'), land: need('player.land'),
  roll: need('player.skate-study.basic-rolling'), ollie: need('player.skate-study.basic-ollie'), kick: need('player.skate-study.flip-kick'), indy: need('player.skate-study.grab-indy') };
/** Travelling studies (a grind along its rail) are shown in place: their sideways drift is dropped, their height kept. */
const travels = (clip: ClipInfo): boolean => { const xs = clip.offsets.map(o => o[0]), zs = clip.offsets.map(o => o[2]); return Math.max(...xs) - Math.min(...xs) > 22 || Math.max(...zs) - Math.min(...zs) > 22; };

const setClip = (clip: ClipInfo, restart = false): void => {
  if (state.clip !== clip || restart) { state.clip = clip; state.time = 0; }
  void loadSheet(state.style, clip).then(sheet => { if (state.clip === clip) state.sheet = sheet; });
};
const applyFrame = (): void => {
  const clip = state.clip, sheet = state.sheet; if (!sheet) return;
  const span = clip.seconds, u = clip.loop ? ((state.time % span) + span) % span / span : clamp(state.time / span, 0, .9999);
  const frame = Math.min(clip.frames - 1, Math.floor(u * clip.frames));
  state.frame = frame; state.phase = u;
  uniforms.uSheet.value = sheet.texture; uniforms.uShell.value = sheet.shell; uniforms.uSheetSize.value.set(sheet.width, sheet.height); uniforms.uFrame.value = frame;
  const [i0, i1, k0, k1, j0, j1] = sheet.box; // one cube of margin all round, for the outline
  uniforms.uBox.value.set(Math.max(0, i0 - 1), Math.max(0, k0 - 1), Math.min(NX, i1 + 2), Math.min(NZ, k1 + 2)); uniforms.uLayers.value.set(Math.max(0, j0 - 1), Math.min(NY - 1, j1 + 1));
  uniforms.uPalette.value = paletteOf(state.style, state.look).texture;
  const [ox, oy, oz] = clip.offsets[frame], still = travels(clip);
  // Each clip stands on its own lowest frame; a free-play jump or fall rides the sandbox's height frame by frame instead.
  const air = !state.preview && !body.board && !body.grounded;
  stack.position.set(still ? 0 : ox * VOXEL, oy * VOXEL - (air ? sheet.feet[frame] : sheet.ground), still ? 0 : oz * VOXEL);
  rail.visible = still && sheet.feet[frame] - sheet.ground > .5 && sheet.feet[frame] - sheet.ground < 1.2;
};

// ───────────────────────────── play ─────────────────────────────
const JUMP = 14, DOUBLE = 11, GRAVITY = 34.5, RUN = 9, WALK = 3.4, BOARD = 12; // the game's own jump, gravity and speeds
const pressed = (...codes: string[]): boolean => codes.some(c => keys.has(c));
/** Presses are queued as they happen, so a quick tap between two frames is never lost. */
const taps = new Set<string>();
const tapped = (code: string): boolean => taps.delete(code);
const stepBody = (dt: number): void => {
  const fwd = new THREE.Vector3(-Math.sin(state.cam.yaw), 0, -Math.cos(state.cam.yaw)), right = new THREE.Vector3(-fwd.z, 0, fwd.x);
  const ix = (pressed('KeyD', 'ArrowRight') ? 1 : 0) - (pressed('KeyA', 'ArrowLeft') ? 1 : 0), iz = (pressed('KeyW', 'ArrowUp') ? 1 : 0) - (pressed('KeyS', 'ArrowDown') ? 1 : 0);
  const wish = fwd.clone().multiplyScalar(iz).addScaledVector(right, ix), moving = wish.lengthSq() > 0;
  if (moving) { wish.normalize(); state.preview = null; }
  if (tapped('KeyB')) { body.board = !body.board; body.action = null; state.preview = null; }
  const top = body.board ? BOARD : pressed('ShiftLeft', 'ShiftRight') ? WALK : RUN;
  const target = body.board ? new THREE.Vector3(Math.sin(body.yaw), 0, Math.cos(body.yaw)).multiplyScalar(moving || body.vel.length() > 1 ? top : 0) : wish.clone().multiplyScalar(top);
  if (body.board && moving) body.yaw += Math.atan2(Math.sin(Math.atan2(wish.x, wish.z) - body.yaw), Math.cos(Math.atan2(wish.x, wish.z) - body.yaw)) * Math.min(1, dt * 3.2);
  const grip = body.grounded ? (body.board ? 2.2 : 14) : 3;
  body.vel.x += (target.x - body.vel.x) * Math.min(1, grip * dt); body.vel.z += (target.z - body.vel.z) * Math.min(1, grip * dt);
  if (!body.board && moving) body.yaw += Math.atan2(Math.sin(Math.atan2(wish.x, wish.z) - body.yaw), Math.cos(Math.atan2(wish.x, wish.z) - body.yaw)) * Math.min(1, dt * 14);
  if (tapped('Space')) {
    state.preview = null;
    if (body.board) { if (!body.action) { body.action = CLIPS.ollie; body.actionTime = 0; } }
    else if (body.grounded) { body.vel.y = JUMP; body.grounded = false; body.doubled = false; }
    else if (!body.doubled) { body.vel.y = DOUBLE; body.doubled = true; state.time = 0; }
  }
  if (tapped('KeyF')) { state.preview = null; if (body.board) { if (!body.action) { body.action = CLIPS.kick; body.actionTime = 0; } } else body.spin = .3; }
  if (tapped('KeyQ') && body.board && !body.action) { body.action = CLIPS.indy; body.actionTime = 0; state.preview = null; }
  taps.clear();
  // Move, then settle against the crates and blocks.
  body.pos.x += body.vel.x * dt; body.pos.z += body.vel.z * dt;
  for (const s of solids) {
    if (body.pos.y > s.max.y - .3) continue;
    const r = .42, px = clamp(body.pos.x, s.min.x, s.max.x), pz = clamp(body.pos.z, s.min.z, s.max.z), dx = body.pos.x - px, dz = body.pos.z - pz, d = Math.hypot(dx, dz);
    if (d >= r) continue;
    if (d > 1e-4) { body.pos.x = px + dx / d * r; body.pos.z = pz + dz / d * r; }
    else { const ex = Math.min(body.pos.x - s.min.x, s.max.x - body.pos.x), ez = Math.min(body.pos.z - s.min.z, s.max.z - body.pos.z); if (ex < ez) body.pos.x = body.pos.x - s.min.x < s.max.x - body.pos.x ? s.min.x - r : s.max.x + r; else body.pos.z = body.pos.z - s.min.z < s.max.z - body.pos.z ? s.min.z - r : s.max.z + r; }
  }
  body.pos.x = clamp(body.pos.x, -60, 60); body.pos.z = clamp(body.pos.z, -60, 60);
  const ground = groundUnder(body.pos.x, body.pos.z, body.pos.y);
  if (body.grounded && ground < body.pos.y - .05) body.grounded = false;
  if (!body.grounded) {
    body.vel.y -= GRAVITY * dt; body.pos.y += body.vel.y * dt;
    if (body.vel.y <= 0 && body.pos.y <= ground) { body.pos.y = ground; body.vel.y = 0; body.grounded = true; body.landing = .4; }
  } else body.pos.y = ground;
  body.spin = Math.max(0, body.spin - dt); body.landing = Math.max(0, body.landing - dt);
};
const chooseClip = (dt: number): void => {
  if (state.preview) { setClip(state.preview); state.time += dt * state.rate; if (!state.preview.loop && state.time > state.preview.seconds + .7) state.time = 0; return; }
  const speed = Math.hypot(body.vel.x, body.vel.z);
  if (body.board) {
    if (body.action) { body.actionTime += dt * state.rate; setClip(body.action); state.time = body.actionTime; if (body.actionTime >= body.action.seconds) body.action = null; return; }
    setClip(CLIPS.roll); state.time += dt * state.rate; return;
  }
  if (!body.grounded) { const clip = body.vel.y > 1.5 ? CLIPS.jump : CLIPS.fall; setClip(clip); state.time += dt * state.rate; return; }
  if (body.landing > 0 && speed < 2) { setClip(CLIPS.land); state.time = (.4 - body.landing) * 2.2; return; }
  const clip = speed < .4 ? CLIPS.idle : speed < 5 ? CLIPS.walk : CLIPS.run;
  setClip(clip);
  // Feet keep pace with the ground: the cycle is played at the speed it was made for.
  state.time += dt * state.rate * (clip === CLIPS.walk ? clamp(speed / WALK, .5, 1.6) : clip === CLIPS.run ? clamp(speed / RUN, .6, 1.2) : 1);
};

// ───────────────────────────── camera ─────────────────────────────
const focus = new THREE.Vector3(0, 1.2, 4);
const placeCamera = (dt: number): void => {
  const cam = state.cam, mid = new THREE.Vector3(body.pos.x, body.pos.y + 1.2, body.pos.z);
  focus.lerp(mid, 1 - Math.exp(-dt * 9));
  const back = new THREE.Vector3(Math.sin(cam.yaw), 0, Math.cos(cam.yaw)), e = cam.elev * RAD;
  camera.position.copy(focus).addScaledVector(back, cam.dist * Math.cos(e)).add(new THREE.Vector3(0, cam.dist * Math.sin(e), 0));
  camera.position.y = Math.max(.25, camera.position.y);
  camera.lookAt(focus.clone().addScaledVector(back, -cam.ahead));
  if (camera.fov !== cam.fov) { camera.fov = cam.fov; camera.updateProjectionMatrix(); }
};

// ───────────────────────────── panels ─────────────────────────────
const viewsCanvas = $<HTMLCanvasElement>('views'), slicesCanvas = $<HTMLCanvasElement>('slices');
const SCALE = 2, GAP = 6;
viewsCanvas.width = (NX * 3 + NZ * 2 + GAP * 4) * SCALE; viewsCanvas.height = NY * SCALE;
const TILES_X = 12, TILES_Y = Math.ceil(NY / TILES_X);
let drawn = '';
/** The frame from its four sides and from above, and the frame as the slice sheet the stack is drawn from. */
const drawPanels = (): void => {
  const sheet = state.sheet; if (!sheet) return;
  const key = `${state.style}/${state.look}/${state.clip.slug}/${state.frame}`; if (key === drawn) return; drawn = key;
  const { rgb } = paletteOf(state.style, state.look), data = sheet.data, f = state.frame, W = sheet.width;
  const at = (i: number, j: number, k: number): number => data[(f * NZ + k) * W + j * NX + i];
  const ctx = viewsCanvas.getContext('2d')!; ctx.clearRect(0, 0, viewsCanvas.width, viewsCanvas.height);
  const blit = (w: number, h: number, x0: number, pick: (u: number, v: number) => number): void => {
    const img = new ImageData(w, h);
    for (let v = 0; v < h; v++) for (let u = 0; u < w; u++) { const i = pick(u, v); if (i) img.data.set([rgb[i * 3], rgb[i * 3 + 1], rgb[i * 3 + 2], 255], (v * w + u) * 4); }
    const tmp = document.createElement('canvas'); tmp.width = w; tmp.height = h; tmp.getContext('2d')!.putImageData(img, 0, 0);
    ctx.imageSmoothingEnabled = false; ctx.drawImage(tmp, x0 * SCALE, (NY - h) * SCALE, w * SCALE, h * SCALE);
  };
  const first = (n: number, read: (d: number) => number): number => { for (let d = 0; d < n; d++) { const i = read(d); if (i) return i; } return 0; };
  blit(NX, NY, 0, (u, v) => first(NZ, d => at(u, NY - 1 - v, NZ - 1 - d)));                                   // front
  blit(NZ, NY, NX + GAP, (u, v) => first(NX, d => at(NX - 1 - d, NY - 1 - v, NZ - 1 - u)));                   // left
  blit(NX, NY, NX + NZ + GAP * 2, (u, v) => first(NZ, d => at(NX - 1 - u, NY - 1 - v, d)));                   // back
  blit(NZ, NY, NX * 2 + NZ + GAP * 3, (u, v) => first(NX, d => at(d, NY - 1 - v, u)));                        // right
  blit(NX, NZ, NX * 2 + NZ * 2 + GAP * 4, (u, v) => first(NY, d => at(u, NY - 1 - d, v)));                    // top
  // The slices, feet first, cropped to the part of the slice this clip ever uses.
  const [i0, i1, k0, k1] = sheet.box, tw = i1 - i0 + 1, td = k1 - k0 + 1, cw = TILES_X * (tw + 1) + 1, ch = TILES_Y * (td + 1) + 1;
  if (slicesCanvas.width !== cw || slicesCanvas.height !== ch) { slicesCanvas.width = cw; slicesCanvas.height = ch; }
  const sctx = slicesCanvas.getContext('2d')!, simg = sctx.createImageData(cw, ch);
  for (let j = 0; j < NY; j++) {
    const tx = (j % TILES_X) * (tw + 1) + 1, ty = Math.floor(j / TILES_X) * (td + 1) + 1;
    for (let k = 0; k < td; k++) for (let i = 0; i < tw; i++) {
      const v = at(i0 + i, j, k0 + k), o = ((ty + k) * cw + tx + i) * 4;
      if (v) simg.data.set([rgb[v * 3], rgb[v * 3 + 1], rgb[v * 3 + 2], 255], o); else simg.data.set([255, 255, 255, 14], o);
    }
  }
  sctx.putImageData(simg, 0, 0);
};

const button = (label: string, pressedState: boolean, on: () => void, title = ''): HTMLButtonElement => {
  const el = document.createElement('button'); el.type = 'button'; el.textContent = label; el.setAttribute('aria-pressed', String(pressedState)); if (title) el.title = title; el.addEventListener('click', () => { shown = ''; on(); }); return el;
};
const refresh = (): void => {
  const cams = $('camera-buttons'); cams.replaceChildren(...Object.entries(CAMERAS).map(([id, c]) => button(c.label, state.cam.preset === id, () => { Object.assign(state.cam, { preset: id, elev: c.elev, dist: c.dist, ahead: c.ahead, fov: c.fov }); refresh(); })));
  $('camera-note').textContent = CAMERAS[state.cam.preset]?.note ?? 'A free angle: drag the view to turn it, use the slider to tilt it.';
  $<HTMLInputElement>('elevation').value = String(Math.round(state.cam.elev)); $('elevation-value').textContent = `${Math.round(state.cam.elev)}°`;
  const draw: [string, DrawMode, number, string][] = [['Slices', 'slices', 1, 'One flat quad per slice: the classic technique'], ['Slices ×4', 'slices', 4, 'Each slice drawn four times through its thickness'], ['Slices ×8', 'slices', 8, 'Each slice drawn eight times through its thickness'], ['Voxels', 'voxels', 1, 'The same data marched as solid cubes']];
  $('draw-buttons').replaceChildren(...draw.map(([label, mode, sub, title]) => button(label, state.mode === mode && (mode === 'voxels' || state.sub === sub), () => { state.mode = mode; state.sub = sub; refresh(); }, title)));
  $('draw-note').textContent = state.mode === 'voxels' ? 'The same slices drawn as solid cubes by the graphics card. Holds at any angle, but it is no longer sprite stacking.'
    : state.sub === 1 ? `Each slice drawn once: ${NY} flat layers. This is the classic technique.` : `Every slice drawn ${state.sub} times through its thickness: ${NY * state.sub} flat layers.`;
  const sources = [...Object.keys(SOURCES).filter(id => manifest.styles[id]), ...Object.keys(manifest.styles).filter(id => !SOURCES[id])];
  $('style-buttons').replaceChildren(...sources.map(id => button(sourceOf(id).label, state.style === id, () => { state.style = id; state.sheet = null; setClip(state.clip); refresh(); })));
  $('style-note').textContent = sourceOf(state.style).note;
  $('look-buttons').replaceChildren(...(Object.keys(LOOKS) as Look[]).map(id => button(LOOKS[id].label, state.look === id, () => { state.look = id; state.outline = id !== 'plain'; refresh(); })));
  $('look-note').textContent = LOOKS[state.look].note;
  const groups = new Map<string, ClipInfo[]>(); for (const c of manifest.clips) groups.set(c.group, [...(groups.get(c.group) ?? []), c]);
  $('clip-buttons').replaceChildren(
    button('Free play', !state.preview, () => { state.preview = null; refresh(); }, 'Back to moving the rider yourself'),
    ...[...groups.entries()].flatMap(([group, list]) => { const head = document.createElement('span'); head.className = 'group'; head.textContent = group; return [head, ...list.map(c => button(c.label, state.preview === c, () => { state.preview = c; setClip(c, true); refresh(); }, c.studioName))]; }),
  );
  $<HTMLInputElement>('outline').checked = state.outline; $<HTMLInputElement>('turntable').checked = state.turntable; $<HTMLInputElement>('versus-toggle').checked = state.versus;
  for (const el of document.querySelectorAll<HTMLButtonElement>('[data-show]')) el.setAttribute('aria-pressed', String(el.dataset.show === shown));
  $('pause').setAttribute('aria-pressed', String(state.paused)); $('pause').textContent = state.paused ? 'Play' : 'Pause';
  uniforms.uSub.value = state.sub; uniforms.uShade.value.set(...LOOKS[state.look].shade); uniforms.uOutline.value.set(...LOOKS[state.look].outline).divideScalar(255);
  sliceMesh.visible = state.mode === 'slices'; voxelMesh.visible = state.mode === 'voxels'; sliceGeometry.instanceCount = NY * state.sub;
  sliceOutline.visible = state.outline && sliceMesh.visible; voxelOutline.visible = state.outline && voxelMesh.visible;
};
/** The "show me" buttons of the short answer: each sets the stage up to show one finding. */
type Setup = { cam: string; yaw?: number; dist?: number; ahead?: number; mode: DrawMode; sub?: number; style: string; look: Look; clip?: string; explode?: number; rate?: number; versus?: boolean };
const SHOWS: Record<string, Setup> = {
  chase: { cam: 'foot', mode: 'slices', sub: 4, style: 'captured', look: 'plain' },
  'side-thin': { cam: 'side', mode: 'slices', sub: 1, style: 'captured', look: 'plain', dist: 9 },
  'side-solid': { cam: 'side', mode: 'voxels', style: 'captured', look: 'plain', dist: 9 },
  'top-missing': { cam: 'board', yaw: .7, dist: 5.2, ahead: -.2, mode: 'slices', sub: 4, style: 'four-sides', look: 'plain', clip: 'player.skate-study.basic-rolling' },
  'top-present': { cam: 'board', yaw: .7, dist: 5.2, ahead: -.2, mode: 'slices', sub: 4, style: 'captured', look: 'plain', clip: 'player.skate-study.basic-rolling' },
  painted: { cam: 'foot', yaw: 2.5, dist: 5, mode: 'slices', sub: 4, style: 'ink', look: 'plain', clip: 'player.idle' },
  rules: { cam: 'foot', yaw: 2.5, dist: 5, mode: 'slices', sub: 4, style: 'captured', look: 'comic', clip: 'player.idle' },
  neon: { cam: 'foot', yaw: 2.5, dist: 5, mode: 'slices', sub: 4, style: 'captured', look: 'neon', clip: 'player.run' },
  versus: { cam: 'foot', yaw: .9, mode: 'slices', sub: 4, style: 'captured', look: 'plain', clip: 'player.run', rate: .25, versus: true },
};
let shown = '';
const show = (id: string): void => {
  const setup = SHOWS[id], cam = CAMERAS[setup.cam]; shown = id;
  Object.assign(state.cam, { preset: setup.cam, elev: cam.elev, dist: setup.dist ?? cam.dist, ahead: setup.ahead ?? cam.ahead, fov: cam.fov, yaw: setup.yaw ?? 0 });
  Object.assign(state, { mode: setup.mode, sub: setup.sub ?? 1, look: setup.look, outline: setup.look !== 'plain', explode: setup.explode ?? 1, rate: setup.rate ?? 1, paused: false, turntable: false, versus: setup.versus ?? false });
  if (manifest.styles[setup.style] && state.style !== setup.style) { state.style = setup.style; state.sheet = null; }
  state.preview = setup.clip ? clipById.get(setup.clip) ?? null : null;
  if (!state.preview) { body.board = false; body.action = null; }
  setClip(state.preview ?? state.clip, Boolean(state.preview));
  $<HTMLInputElement>('explode').value = String(state.explode); $('explode-value').textContent = 'stacked'; $<HTMLSelectElement>('rate').value = String(state.rate);
  refresh();
};
for (const el of document.querySelectorAll<HTMLButtonElement>('[data-show]')) el.addEventListener('click', () => show(el.dataset.show!));
$<HTMLInputElement>('elevation').addEventListener('input', e => { state.cam.elev = Number((e.target as HTMLInputElement).value); state.cam.preset = 'free'; refresh(); });
$<HTMLInputElement>('explode').addEventListener('input', e => { state.explode = Number((e.target as HTMLInputElement).value); $('explode-value').textContent = state.explode === 1 ? 'stacked' : `×${state.explode.toFixed(1)}`; });
$<HTMLInputElement>('outline').addEventListener('change', e => { state.outline = (e.target as HTMLInputElement).checked; refresh(); });
$<HTMLInputElement>('turntable').addEventListener('change', e => { state.turntable = (e.target as HTMLInputElement).checked; });
$<HTMLInputElement>('versus-toggle').addEventListener('change', e => { state.versus = (e.target as HTMLInputElement).checked; });
$<HTMLSelectElement>('rate').addEventListener('change', e => { state.rate = Number((e.target as HTMLSelectElement).value); });
$('pause').addEventListener('click', () => { state.paused = !state.paused; refresh(); });
$('step').addEventListener('click', () => { state.paused = true; state.time = (((state.frame + 1) % state.clip.frames) + .5) / state.clip.frames * state.clip.seconds; refresh(); });

// Keys go to the stage while it has focus or the pointer; dragging turns the camera.
const GAME_KEYS = new Set(['KeyW', 'KeyA', 'KeyS', 'KeyD', 'ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'Space', 'KeyF', 'KeyB', 'KeyQ', 'ShiftLeft', 'ShiftRight']);
window.addEventListener('keydown', e => { const t = e.target as HTMLElement; if (t.closest('input, select, textarea') || (t.closest('button') && e.code === 'Space')) return; if (GAME_KEYS.has(e.code)) { if (!e.repeat && !keys.has(e.code)) taps.add(e.code); keys.add(e.code); e.preventDefault(); } });
window.addEventListener('keyup', e => keys.delete(e.code)); window.addEventListener('blur', () => keys.clear());
let drag: { x: number; yaw: number } | null = null;
canvas.addEventListener('pointerdown', e => { drag = { x: e.clientX, yaw: state.cam.yaw }; canvas.setPointerCapture(e.pointerId); canvas.focus(); });
canvas.addEventListener('pointermove', e => { if (drag) state.cam.yaw = drag.yaw - (e.clientX - drag.x) * .008; });
canvas.addEventListener('pointerup', () => { drag = null; }); canvas.addEventListener('pointercancel', () => { drag = null; });
for (const el of document.querySelectorAll<HTMLButtonElement>('[data-hold]')) { // on-screen pad for touch
  const code = el.dataset.hold!; const down = (e: Event): void => { if (!keys.has(code)) taps.add(code); keys.add(code); e.preventDefault(); }, up = (): void => { keys.delete(code); };
  el.addEventListener('pointerdown', down); el.addEventListener('pointerup', up); el.addEventListener('pointerleave', up); el.addEventListener('pointercancel', up);
}

// ───────────────────────────── numbers ─────────────────────────────
const frames = manifest.clips.reduce((a, c) => a + c.frames, 0), bakedBytes = Object.values(manifest.styles)[0].bytes;
const at12 = Math.round(manifest.source.studioSeconds * 12);
$('n-clips').textContent = `${manifest.clips.length} of ${manifest.source.studioClips}`;
$('n-frames').textContent = `${frames}`;
$('n-size').textContent = `${Math.round(bakedBytes / 1024)} KB`;
$('n-grid').textContent = `${NX} × ${NZ} px, ${NY} slices`;
$('n-all-frames').textContent = at12.toLocaleString('en-GB');
$('n-all-stills').textContent = (at12 * 5).toLocaleString('en-GB');
$('n-all-memory').textContent = `${Math.round(at12 * NX * NY * NZ / 1048576)} MB`;

// ───────────────────────────── loop ─────────────────────────────
const resize = (): void => { const w = canvas.clientWidth, h = canvas.clientHeight; if (canvas.width !== Math.round(w * renderer.getPixelRatio()) || canvas.height !== Math.round(h * renderer.getPixelRatio())) { renderer.setSize(w, h, false); camera.aspect = w / Math.max(1, h); camera.updateProjectionMatrix(); } };
for (const clip of Object.values(CLIPS)) void loadSheet(state.style, clip);
setClip(state.clip); refresh();
let last = performance.now(), turn = 0, panelClock = 0, fpsClock = 0, fpsFrames = 0;
let fpsLast = performance.now();
const tick = (now: number): void => {
  const dt = Math.min(.05, (now - last) / 1000); last = now;
  resize();
  if (!state.paused) { stepBody(dt); chooseClip(dt); if (state.turntable) turn += dt * 1.1; }
  applyFrame();
  uniforms.uExplode.value = state.mode === 'slices' ? state.explode : 1;
  const spin = body.spin > 0 ? (1 - body.spin / .3) * Math.PI * 4 : 0;
  rider.position.copy(body.pos); rider.rotation.y = body.yaw + spin + turn;
  // Pulled apart, the stack grows from the feet, so the slices can be seen one by one.
  sliceMesh.position.y = sliceOutline.position.y = state.mode === 'slices' ? (state.explode - 1) * NY * VOXEL * .5 : 0;
  blob.position.set(body.pos.x, groundUnder(body.pos.x, body.pos.z, body.pos.y) + .02, body.pos.z); blob.scale.setScalar(clamp(1 - (body.pos.y - blob.position.y) * .12, .45, 1));
  placeCamera(dt);
  renderer.render(scene, camera);
  const reference = state.versus && state.sheet ? manifest.reference?.clips[state.clip.id] : undefined;
  versusEl.hidden = !reference;
  if (reference && state.sheet) drawVersus(reference, state.sheet);
  panelClock += dt; if (panelClock > .09) { panelClock = 0; drawPanels(); }
  $('hud-clip').textContent = `${state.clip.label} · frame ${state.frame + 1}/${state.clip.frames}`;
  $('hud-draw').textContent = state.mode === 'voxels' ? 'solid cubes' : `${NY * state.sub} layers`;
  fpsFrames++; fpsClock += (now - fpsLast) / 1000; fpsLast = now; if (fpsClock >= .75) { $('hud-fps').textContent = `${Math.round(fpsFrames / fpsClock)} fps`; fpsClock = 0; fpsFrames = 0; }
  requestAnimationFrame(tick);
};
requestAnimationFrame(tick);
document.documentElement.dataset.ready = 'true';
(window as unknown as Record<string, unknown>).__stackLab = { state, body, manifest, keys };
