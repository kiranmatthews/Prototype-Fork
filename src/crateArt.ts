import * as THREE from 'three';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import { prepareCrateSculpt, currentCrateSculpt, crateSculptMaterial, crateSculptGeometry } from './crateSculpt';
import { isMetalCrate, metalCrateTemplate, currentMetalCrate, prepareMetalCrate } from './crateMetal';
import { createCrateFuse, kickCrateFuse, updateCrateFuse, CRATE_FUSE_TRIANGLES, type CrateFuse } from './crateFuse';
import { rooReady } from './roofont';
import { LIFE_PORTRAITS, lifePortraitStyle, lifePortraitUrl, onLifePortraitChange, type LifePortraitStyle } from './lifePortrait';
import { prepareCrateFracture } from './crateFracture';
import { prepareCrateExplosives, currentExplosiveTemplate, createExplosiveMaterial, updateExplosiveArt, explosiveFallbackGeometry, type ExplosiveArt } from './crateExplosive';
import { currentMultihitCrate, prepareMultihitCrate, createMultihitContents, updateMultihitContents, MULTIHIT_FRUIT_TRIANGLES } from './crateMultihit';

/** One authored kit for the whole family. All six faces retain their geometry
 * at every distance. The invisible owner cube remains the gameplay collider. */
export type CrateArtKind = 'wood' | 'empty' | 'mystery' | 'life' | 'mask' | 'multihit' |
  'bouncy' | 'metalbounce' | 'metal' | 'tnt' | 'nitro' | 'bang' | 'nitrobang' | 'checkpoint';
export const CRATE_ART_KINDS: readonly CrateArtKind[] = [
  'wood', 'empty', 'mystery', 'life', 'mask', 'multihit', 'bouncy', 'metalbounce',
  'metal', 'tnt', 'nitro', 'bang', 'nitrobang', 'checkpoint',
];
type Palette = { wood: string; edge: string; ink: string; shadow: string; metal?: boolean };
const PALETTES: Record<CrateArtKind, Palette> = {
  wood: { wood: '#a85a24', edge: '#e5a04c', ink: '#ffe5a0', shadow: '#462718' },
  empty: { wood: '#a85a24', edge: '#d88f3e', ink: '#efca83', shadow: '#462718' },
  mystery: { wood: '#bc6f22', edge: '#ecad4d', ink: '#fff0a4', shadow: '#63351b' },
  life: { wood: '#a85a24', edge: '#e5a04c', ink: '#ffe8a5', shadow: '#462718' },
  mask: { wood: '#a85a24', edge: '#e5a04c', ink: '#ffe2a3', shadow: '#462718' },
  multihit: { wood: '#b55a22', edge: '#e99943', ink: '#ffe9ae', shadow: '#4e2f20' },
  bouncy: { wood: '#a85a24', edge: '#e5a04c', ink: '#fff0aa', shadow: '#462718' },
  metalbounce: { wood: '#356376', edge: '#709ba6', ink: '#fff0aa', shadow: '#182e3b', metal: true },
  metal: { wood: '#356376', edge: '#709ba6', ink: '#b6d2ce', shadow: '#182e3b', metal: true },
  tnt: { wood: '#b63827', edge: '#ec6a3b', ink: '#ffe897', shadow: '#571f23' },
  nitro: { wood: '#729728', edge: '#c4d752', ink: '#fff1a7', shadow: '#263c23' },
  bang: { wood: '#356376', edge: '#709ba6', ink: '#ffedaa', shadow: '#182e3b', metal: true },
  nitrobang: { wood: '#72d91b', edge: '#72d91b', ink: '#fff1ae', shadow: '#18382f', metal: true },
  checkpoint: { wood: '#c96b23', edge: '#ffb451', ink: '#fff2bb', shadow: '#66331d' },
};

export interface CrateArtState {
  pending?: boolean; used?: boolean; hits?: number; fuse?: number;
  timeSecs?: number; boost?: 'speed' | 'balance'; run?: boolean;
}
export interface CrateArt {
  kind: CrateArtKind;
  size: number;
  root: THREE.Group;
  shell: THREE.Mesh;
  marks: THREE.Mesh<THREE.BufferGeometry, THREE.MeshStandardMaterial>;
  fuse?: THREE.Group;
  fuseFX?: CrateFuse;
  explosive?: ExplosiveArt;
  contents?: THREE.InstancedMesh;
  state: CrateArtState;
  labelKey: string;
  pulse: number;
  pulseStrength: number;
  seed: number;
  sculpted: boolean;
  ready: Promise<void>;
}
type Template = { shell: THREE.BufferGeometry; marks: THREE.BufferGeometry; material: THREE.MeshStandardMaterial };
const templates = new Map<CrateArtKind, Template>();
const labels = new Map<string, THREE.MeshStandardMaterial>();
const shardTemplates = new Map<string, THREE.BufferGeometry>();
const lifePortraits = new Map<LifePortraitStyle, HTMLImageElement>();
const lifePortraitRepaints = new Set<() => void>();
onLifePortraitChange(() => { for (const repaint of lifePortraitRepaints) repaint(); });
const lifePortraitReady = typeof Image === 'undefined' ? Promise.resolve() : Promise.all(
  (Object.keys(LIFE_PORTRAITS) as LifePortraitStyle[]).map(style => new Promise<void>(resolve => {
    const img = new Image(); img.onload = () => { lifePortraits.set(style, img); resolve(); }; img.onerror = () => resolve();
    img.src = lifePortraitUrl(style);
  })),
).then(() => {});
function shared<T extends THREE.BufferGeometry | THREE.Material | THREE.Texture>(value: T): T {
  value.userData.shared = true;
  value.userData.levelDepthFade = false;
  return value;
}
function rand(seed: number): () => number {
  let n = seed >>> 0;
  return () => ((n = Math.imul(n, 1664525) + 1013904223 >>> 0) / 4294967296);
}
function mix(a: string, b: string, t: number): string {
  return `#${new THREE.Color(a).lerp(new THREE.Color(b), t).getHexString()}`;
}

/** Atlas: stained boards, edge beams, forged metal, freshly split end grain.
 * Broad grain and painted wear are deliberate, deterministic strokes. */
function atlas(kind: CrateArtKind): THREE.CanvasTexture {
  const p = PALETTES[kind], canvas = document.createElement('canvas');
  canvas.width = canvas.height = 512;
  const c = canvas.getContext('2d')!;
  for (let tile = 0; tile < 4; tile++) {
    c.save(); c.translate(tile % 2 * 256, Math.floor(tile / 2) * 256);
    const metal = tile === 2 || p.metal && tile < 2;
    const base = tile === 2 ? '#426575' : tile === 3 ? '#e9bb76' : tile === 1 ? p.edge : p.wood;
    const gradient = c.createLinearGradient(0, 0, 256, 0);
    gradient.addColorStop(0, mix(base, '#201a23', .35));
    gradient.addColorStop(.15, base); gradient.addColorStop(.55, mix(base, '#fff1be', .11));
    gradient.addColorStop(.85, base); gradient.addColorStop(1, mix(base, '#2d1a1a', .32));
    c.fillStyle = gradient; c.fillRect(0, 0, 256, 256);
    const r = rand(911 + tile * 103);
    if (!metal) {
      for (let i = 0; i < 15; i++) {
        const x = 12 + r() * 232, bend = (r() - .5) * 28;
        c.lineWidth = i % 3 === 0 ? 3.0 : 1.25;
        c.strokeStyle = i % 3 === 0 ? mix(base, '#3b2018', .38) : mix(base, '#ffe5a2', .22);
        c.beginPath(); c.moveTo(x, -8);
        c.bezierCurveTo(x + bend, 70, x - bend, 180, x + bend * .3, 265); c.stroke();
      }
      for (let i = 0; i < 2; i++) {
        const x = 65 + r() * 125, y = 45 + r() * 170;
        for (let ring = 0; ring < 3; ring++) {
          c.strokeStyle = mix(base, '#40231a', .42 - ring * .08); c.lineWidth = 2;
          c.beginPath(); c.ellipse(x, y, 5 + ring * 5, 12 + ring * 12, -.12, 0, Math.PI * 2); c.stroke();
        }
      }
    } else {
      c.strokeStyle = mix(base, '#d4e6dc', .23); c.lineWidth = 1.2;
      for (let i = 0; i < 9; i++) { const x = r() * 240 + 8, y = r() * 256; c.beginPath(); c.moveTo(x, y); c.lineTo(x + 3, y + 24); c.stroke(); }
    }
    // Chiselled highlights and a few long end cracks: texture follows each part.
    c.fillStyle = metal ? '#adc4be' : tile === 3 ? '#f7d8a0' : '#f1be73';
    for (let i = 0; i < 10; i++) {
      const left = i % 2 === 0, x = left ? 5 : 247, y = r() * 245;
      c.beginPath(); c.moveTo(x, y); c.lineTo(x + (left ? 5 : -5), y + 2); c.lineTo(x, y + 6 + r() * 13); c.fill();
    }
    if (!metal) for (const x of [37, 179]) {
      c.strokeStyle = mix(base, '#3b2119', .55); c.lineWidth = 2;
      c.beginPath(); c.moveTo(x, 0); c.lineTo(x + 2, 17); c.lineTo(x - 3, 31); c.stroke();
    }
    if (tile === 1 && (kind === 'tnt' || kind === 'nitro')) {
      c.fillStyle = '#f3cf66'; c.fillRect(0, 22, 256, 26); c.fillRect(0, 208, 256, 26);
      if (kind === 'nitro') {
        c.fillStyle = '#293c29';
        for (const y of [22, 208]) for (let x = -32; x < 256; x += 64) {
          c.beginPath(); c.moveTo(x, y); c.lineTo(x + 28, y); c.lineTo(x + 54, y + 26); c.lineTo(x + 26, y + 26); c.fill();
        }
      }
    }
    c.restore();
  }
  const tex = shared(new THREE.CanvasTexture(canvas));
  tex.colorSpace = THREE.SRGBColorSpace; tex.anisotropy = 4;
  return tex;
}

/** Low-poly chamfered timber with three independent sections. No LOD swaps. */
function timber(width: number, length: number, depth: number, seed: number, tile: number, split = false): THREE.BufferGeometry {
  const r = rand(seed), bevel = Math.min(width * .16, depth * .30, .018);
  const corners = [
    [-width / 2 + bevel, depth / 2], [width / 2 - bevel, depth / 2],
    [width / 2, depth / 2 - bevel], [width / 2, -depth / 2 + bevel],
    [width / 2 - bevel, -depth / 2], [-width / 2 + bevel, -depth / 2],
    [-width / 2, -depth / 2 + bevel], [-width / 2, depth / 2 - bevel],
  ];
  const rings: THREE.Vector3[][] = [];
  for (let ring = 0; ring < 4; ring++) {
    const t = ring / 3, bow = Math.sin(t * Math.PI) * (r() - .5) * .022;
    rings.push(corners.map(([x, z], k) => new THREE.Vector3(
      x + bow + (ring > 0 && ring < 3 ? (r() - .5) * .006 : 0),
      (t - .5) * length + (split && ring === 3 ? [0, -.12, -.035, -.09, 0, -.15, -.025, -.08][k] * length : 0),
      z + Math.sin(t * Math.PI) * .005,
    )));
  }
  const pos: number[] = [], uv: number[] = [], color: number[] = [];
  const emit = (a: THREE.Vector3, b: THREE.Vector3, d: THREE.Vector3, shade: number, end = false) => {
    const useTile = end && split ? 3 : tile;
    for (const v of [a, b, d]) {
      pos.push(v.x, v.y, v.z);
      const u = THREE.MathUtils.clamp(v.x / width + .5, .025, .975);
      const t = THREE.MathUtils.clamp(end ? v.z / depth + .5 : v.y / length + .5, .025, .975);
      uv.push((useTile % 2 + u) / 2, (1 - Math.floor(useTile / 2) + t) / 2);
      color.push(shade, shade, shade);
    }
  };
  for (let ring = 0; ring < 3; ring++) for (let k = 0; k < 8; k++) {
    const a = rings[ring][k], b = rings[ring][(k + 1) % 8], d = rings[ring + 1][k], e = rings[ring + 1][(k + 1) % 8];
    const shade = k === 0 ? 1 : k === 4 ? .69 : k % 2 ? 1.12 : .86;
    emit(a, b, d, shade); emit(b, e, d, shade);
  }
  for (let k = 1; k < 7; k++) {
    emit(rings[0][0], rings[0][k + 1], rings[0][k], .8, true);
    emit(rings[3][0], rings[3][k], rings[3][k + 1], 1.08, true);
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  g.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2));
  g.setAttribute('color', new THREE.Float32BufferAttribute(color, 3));
  g.computeVertexNormals();
  return g;
}
const faces = [
  new THREE.Quaternion(),
  new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 1, 0), Math.PI / 2),
  new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 1, 0), Math.PI),
  new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 1, 0), -Math.PI / 2),
  new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(1, 0, 0), -Math.PI / 2),
  new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(1, 0, 0), Math.PI / 2),
];
function mapTile(g: THREE.BufferGeometry, tile: number, shade = 1): THREE.BufferGeometry {
  const uv = g.getAttribute('uv'), colors = new Float32Array(g.getAttribute('position').count * 3).fill(shade);
  for (let i = 0; i < uv.count; i++) uv.setXY(i, (tile % 2 + .04 + uv.getX(i) * .92) / 2, (1 - Math.floor(tile / 2) + .04 + uv.getY(i) * .92) / 2);
  g.setAttribute('color', new THREE.BufferAttribute(colors, 3));
  return g.index ? g.toNonIndexed() : g;
}
function merge(pieces: THREE.BufferGeometry[]): THREE.BufferGeometry {
  const result = mergeGeometries(pieces)!;
  for (const piece of pieces) piece.dispose();
  result.computeBoundingBox(); result.computeBoundingSphere();
  return shared(result);
}
function template(kind: CrateArtKind): Template {
  const existing = templates.get(kind); if (existing) return existing;
  const pieces: THREE.BufferGeometry[] = [], marks: THREE.BufferGeometry[] = [];
  const p = PALETTES[kind], braced = kind === 'wood' || kind === 'empty';
  const reinforced = p.metal || kind === 'multihit';
  // Recessed interior closes the seams and gives them stable contact shadow.
  pieces.push(mapTile(new THREE.BoxGeometry(.81, .81, .81), 0, .42));
  for (let face = 0; face < 6; face++) {
    const q = faces[face];
    const add = (g: THREE.BufferGeometry, x: number, y: number, z: number, angle = 0) => {
      g.rotateZ(angle).translate(x, y, z).applyQuaternion(q); pieces.push(g);
    };
    for (let i = 0; i < 4; i++)
      add(timber(.191, .79, .075, 112 + face * 23 + i * 7, 0), (i - 1.5) * .198, 0, .417);
    for (const side of [-1, 1]) {
      add(timber(.137, .994, .105, 320 + face * 13 + side, 1), side * .429, 0, .444);
      add(timber(.137, .74, .105, 567 + face * 41 + side, 1), 0, side * .429, .444, Math.PI / 2);
    }
    if (braced && face < 4) for (const side of [-1, 1])
      add(timber(.10, .99, .043, 708 + face * 12 + side, 1), 0, 0, .472, side * Math.PI / 4);
    if (reinforced) {
      for (const x of [-.412, .412]) for (const y of [-.412, .412])
        add(timber(.178, .178, .025, 191, 2), x, y, .486);
      if (kind === 'metal') add(timber(.115, .73, .034, 713 + face, 2), 0, 0, .477, Math.PI / 2);
    }
    for (const x of [-.429, .429]) for (const y of [-.429, .429]) {
      const bolt = new THREE.CylinderGeometry(.026, .031, .014, 6, 1).rotateX(Math.PI / 2);
      add(mapTile(bolt, 2, 1.05), x, y, reinforced ? .509 : .501);
    }
    // Decals remain flush to timber, above its slight sculpted bow. The four
    // upright faces are distinct UV placements; the top/bottom use a seal.
    {
      const mark = new THREE.PlaneGeometry(face < 4 ? .63 : .38, face < 4 ? .63 : .38).toNonIndexed();
      const uv = mark.getAttribute('uv');
      for (let i = 0; i < uv.count; i++) uv.setX(i, uv.getX(i) * .5 + (face < 4 ? 0 : .5));
      mark.translate(0, 0, braced ? .503 : .461).applyQuaternion(q); marks.push(mark);
    }
  }
  const material = shared(new THREE.MeshStandardMaterial({ map: atlas(kind), vertexColors: true,
    roughness: p.metal ? .48 : .76, metalness: p.metal ? .48 : .04, color: 0xffffff }));
  material.name = `Crate ${kind} · stained timber and forged hardware`;
  const value = { shell: merge(pieces), marks: marks.length ? merge(marks) : shared(new THREE.BufferGeometry()), material };
  templates.set(kind, value); return value;
}

function icon(c: CanvasRenderingContext2D, kind: CrateArtKind, value: string, top: boolean): void {
  if (kind === 'tnt' || kind === 'nitro') return; // No lettering on either explosive bundle.
  const p = PALETTES[kind];
  c.fillStyle = p.ink; c.strokeStyle = p.shadow; c.lineJoin = 'round'; c.lineWidth = 13;
  const text = (s: string, size: number, y = 139) => {
    c.font = `400 ${size}px Roo, Arial Black, Arial, sans-serif`; c.textAlign = 'center'; c.textBaseline = 'middle';
    c.strokeText(s, 128, y); c.fillText(s, 128, y);
  };
  if (top) {
    if (kind === 'checkpoint') { text('C', 174); return; }
    if (kind === 'bouncy' || kind === 'metalbounce') return;
    c.lineWidth = 8; c.beginPath(); c.arc(128, 128, 89, 0, Math.PI * 2); c.stroke();
  }
  if (value === 'used') { text('✓', 170); return; }
  if (/^\d+s$/.test(value)) { text(value.slice(0, -1), 174); return; }
  if (value === 'speed') { text('»', 205); return; }
  if (value === 'balance') { text('=', 182); return; }
  if (kind === 'life') {
    const portrait = lifePortraits.get(lifePortraitStyle());
    if (portrait) { c.drawImage(portrait, 9, 10, 238, 238); return; }
    c.beginPath(); c.moveTo(128, 214); c.bezierCurveTo(75, 174, 20, 135, 35, 77);
    c.bezierCurveTo(48, 24, 108, 28, 128, 73); c.bezierCurveTo(148, 28, 210, 24, 222, 77);
    c.bezierCurveTo(237, 135, 181, 174, 128, 214); c.closePath(); c.stroke(); c.fill();
  } else if (kind === 'mask') {
    // The game's protection reward is a bone: retain its familiar crossbones.
    for (const angle of [-.72, .72]) {
      c.save(); c.translate(128, 128); c.rotate(angle);
      c.beginPath(); c.moveTo(-16, -70); c.bezierCurveTo(-54, -106, -6, -119, 0, -92);
      c.bezierCurveTo(8, -120, 53, -105, 16, -70); c.lineTo(16, 70);
      c.bezierCurveTo(53, 105, 8, 120, 0, 92); c.bezierCurveTo(-6, 119, -54, 106, -16, 70);
      c.closePath(); c.stroke(); c.fill(); c.restore();
    }
  } else if (kind === 'bouncy' || kind === 'metalbounce') {
    c.beginPath(); c.moveTo(128, 21); c.lineTo(220, 106); c.lineTo(164, 106); c.lineTo(164, 181);
    c.lineTo(91, 181); c.lineTo(91, 106); c.lineTo(36, 106); c.closePath(); c.stroke(); c.fill();
    c.fillRect(92, 201, 72, 16);
  } else if (kind === 'multihit') {
    // The remaining fruit are visible through real cage slats.
    return;
  } else if (kind === 'nitrobang') { text('!', 164, 115); c.fillStyle = p.ink; c.fillRect(59, 208, 138, 9); }
  else if (kind === 'checkpoint') text('C', 198);
  else if (kind === 'bang') text('!', 190);
  else if (kind === 'mystery') text('?', 196);
}
function labelMaterial(kind: CrateArtKind, value: string): THREE.MeshStandardMaterial {
  const key = `${kind}:${value}`, cached = labels.get(key); if (cached) return cached;
  const canvas = document.createElement('canvas'); canvas.width = 512; canvas.height = 256;
  const c = canvas.getContext('2d')!;
  const paint = () => {
  c.clearRect(0, 0, 512, 256);
  for (let top = 0; top < 2; top++) {
    c.save(); c.translate(top * 256, 0); icon(c, kind, value, !!top);
    // Subtle missing paint follows fixed little strokes, never temporal noise.
    c.globalCompositeOperation = 'destination-out'; c.fillStyle = '#000';
    const r = rand(501); for (let i = 0; i < 25; i++) { const x = r() * 256, y = r() * 256; c.fillRect(x, y, 1 + r() * 3, 1 + r() * 4); }
    c.restore();
  }
  };
  paint();
  const map = shared(new THREE.CanvasTexture(canvas)); map.colorSpace = THREE.SRGBColorSpace; map.anisotropy = 4;
  const repaint = () => { paint(); map.needsUpdate = true; };
  if (kind === 'life') lifePortraitRepaints.add(repaint);
  void Promise.all([rooReady, lifePortraitReady]).then(repaint);
  const material = shared(new THREE.MeshStandardMaterial({ map, alphaTest: .35, roughness: .83, metalness: 0,
    polygonOffset: true, polygonOffsetFactor: -1, polygonOffsetUnits: -1 }));
  labels.set(key, material); return material;
}
function labelValue(kind: CrateArtKind, s: CrateArtState): string {
  if (s.used) return 'used';
  if (s.timeSecs) return `${s.timeSecs}s`;
  if (s.boost) return s.boost;
  if (s.run) return 'blank';
  if (kind === 'multihit') return 'blank';
  return kind;
}
export function setCrateArtState(art: CrateArt, state: CrateArtState): void {
  art.state = state; art.root.visible = !state.pending;
  if (art.contents) updateMultihitContents(art.contents, state.hits ?? 5, art.pulse, 0);
  if (art.kind === 'tnt' || art.kind === 'nitro') { art.marks.visible = false; art.labelKey = 'blank'; return; }
  // Spent Nitro switches use the exact ordinary steel material. Keep their
  // authored kind so checkpoint restoration can re-arm the green switch.
  const spentNitro = art.kind === 'nitrobang' && !!state.used;
  const kind = spentNitro ? 'metal' : art.kind;
  const key = spentNitro ? 'metal' : labelValue(kind, state);
  art.marks.visible = !spentNitro && key !== 'blank' && (!['wood', 'empty', 'metal', 'multihit'].includes(kind) || !!state.timeSecs || !!state.boost);
  if (art.labelKey !== key) { art.labelKey = key; art.marks.material = labelMaterial(kind, key); }
  if (art.sculpted) {
    const material = crateSculptMaterial(kind, key, art.marks.material.map);
    if (material) art.shell.material = material;
  }
}

export function createCrateArt(kind: CrateArtKind, size = 1): CrateArt {
  if (kind === 'tnt' || kind === 'nitro') {
    const nitro = kind === 'nitro', root = new THREE.Group(); root.scale.setScalar(size);
    root.name = nitro ? 'Glowing Nitro stick bundle · no fuse' : 'TNT stick bundle with animated braid';
    root.userData.crateArt = true; root.userData.editorGhost = true;
    const asset = currentExplosiveTemplate(), explosive = createExplosiveMaterial(nitro);
    const shell = new THREE.Mesh(asset?.geometry ?? explosiveFallbackGeometry(), explosive?.material ?? new THREE.MeshStandardMaterial({ color: nitro ? 0x79df16 : 0xc93216, roughness: .82 }));
    shell.castShadow = shell.receiveShadow = true; root.add(shell);
    const marks = new THREE.Mesh(shared(new THREE.BufferGeometry()), shared(new THREE.MeshStandardMaterial())); marks.visible = false;
    const art: CrateArt = { kind, size, root, shell, marks, state: {}, labelKey: 'blank', pulse: 0, pulseStrength: 0, seed: 0, sculpted: false, explosive, ready: Promise.resolve() };
    if (!nitro) { art.fuseFX = createCrateFuse(); art.fuse = art.fuseFX.root; root.add(art.fuse); }
    if (!asset && typeof window !== 'undefined') art.ready = prepareCrateExplosives().then(loaded => {
      shell.material.dispose(); shell.geometry = loaded.geometry; art.explosive = createExplosiveMaterial(nitro)!;
      shell.material = art.explosive.material;
    }).catch(error => console.warn('Explosive sculpt could not load; retaining playable stick bundle', error));
    art.ready = art.ready.then(() => prepareCrateFracture(kind));
    return art;
  }
  const t = template(kind), metal = isMetalCrate(kind), sculpt = kind === 'multihit' ? currentMultihitCrate() : currentCrateSculpt();
  const root = new THREE.Group(); root.name = `Crafted ${kind} crate`;
  root.userData.crateArt = true; root.userData.editorGhost = true;
  const shell = new THREE.Mesh(metal ? metalCrateTemplate().geometry : crateSculptGeometry(kind) ?? t.shell,
    metal ? metalCrateTemplate().material : sculpt?.material ?? t.material); shell.name = 'Six-sided sculpted shell';
  shell.castShadow = shell.receiveShadow = true;
  const marks = new THREE.Mesh(metal || sculpt ? shared(new THREE.BufferGeometry()) : t.marks, labelMaterial(kind, kind === 'multihit' ? 'blank' : kind));
  marks.name = 'Painted gameplay marks · four sides and lid seals'; marks.receiveShadow = true;
  root.add(shell, marks); root.scale.setScalar(size);
  const art: CrateArt = { kind, size, root, shell, marks, state: {}, labelKey: '', pulse: 0, pulseStrength: 0, seed: 0,
    sculpted: metal || !!sculpt, ready: Promise.resolve() };
  if (kind === 'multihit') { art.contents = createMultihitContents(); root.add(art.contents); }
  setCrateArtState(art, kind === 'multihit' ? { hits: 5 } : {});
  if (!metal && !sculpt && typeof window !== 'undefined') art.ready = (kind === 'multihit' ? prepareMultihitCrate() : prepareCrateSculpt()).then(asset => {
    art.shell.geometry = crateSculptGeometry(kind) ?? asset.geometry; art.sculpted = true;
    art.marks.geometry = shared(new THREE.BufferGeometry());
    setCrateArtState(art, art.state);
  }).catch(error => console.warn('Crate sculpt could not load; retaining playable fallback', error));
  if (metal && !currentMetalCrate() && typeof window !== 'undefined') art.ready = prepareMetalCrate().then(asset => {
    art.shell.geometry = asset.geometry;
    setCrateArtState(art, art.state);
  }).catch(error => console.warn('Metal sculpt could not load; retaining playable fallback', error));
  art.ready = Promise.all([art.ready, rooReady, lifePortraitReady]).then(() => prepareCrateFracture(kind));
  return art;
}
export function pulseCrateArt(art: CrateArt, strength = 1): void {
  art.pulse = .38; art.pulseStrength = strength;
  if (art.fuseFX) kickCrateFuse(art.fuseFX, strength);
}
export function updateCrateArt(art: CrateArt, dt: number, time: number): void {
  art.pulse = Math.max(0, art.pulse - dt);
  const age = .38 - art.pulse;
  const recoil = art.pulse > 0 ? -Math.sin(age * 24) * Math.exp(-age * 10) * .19 * art.pulseStrength : 0;
  let sy = 1 + recoil, sx = 1 - recoil * .45;
  let yaw = 0, roll = 0;
  if (art.kind === 'nitro' && !art.state.pending) {
    const cycle = (time + art.seed) % 2.7;
    if (cycle < .24) { const twitch = Math.sin(cycle / .24 * Math.PI); sy -= twitch * .045; sx += twitch * .02; roll = Math.sin(cycle * 74) * twitch * .018; }
  }
  if (art.kind === 'tnt' && art.state.fuse !== undefined) {
    const urgency = 3 - art.state.fuse, beat = Math.abs(Math.sin(time * (7 + urgency * 5)));
    sy += beat * .035; sx -= beat * .016; yaw = Math.sin(time * 41) * urgency * .004;
  }
  if (art.fuseFX) updateCrateFuse(art.fuseFX, art.state.fuse, time, dt);
  if (art.explosive) updateExplosiveArt(art.explosive, art.state.fuse, time + art.seed);
  if (art.contents) updateMultihitContents(art.contents, art.state.hits ?? 5, art.pulse, time + art.seed);
  if (art.state.used && art.kind !== 'nitrobang') sy *= .91;
  art.root.scale.set(art.size * sx, art.size * sy, art.size * sx);
  art.root.position.y = (sy - 1) * art.size * .5;
  art.root.rotation.set(0, yaw, roll);
}

/** Source-sized splinters reuse the intact palette, with pale jagged cut ends. */
export function crateShardAsset(kind: CrateArtKind, variant: number): { geometry: THREE.BufferGeometry; material: THREE.MeshStandardMaterial } {
  const metal = !!PALETTES[kind].metal;
  const key = `${metal ? 'metal' : 'wood'}:${variant % 5}`;
  let geometry = shardTemplates.get(key);
  if (!geometry) {
    const v = variant % 5;
    geometry = v === 4 ? merge([
      mapTile(new THREE.CylinderGeometry(.031, .035, .018, 6), 2),
      mapTile(new THREE.CylinderGeometry(.008, .004, .095, 5).translate(0, -.05, 0), 2),
    ]) : shared(timber(v === 3 ? .055 : .10 + v * .025, v === 3 ? .18 : .36 + v * .13, .045 + v * .007, 83 + v * 17, metal ? 2 : v % 2, !metal));
    geometry.computeBoundingSphere(); shardTemplates.set(key, geometry);
  }
  return { geometry, material: template(kind).material };
}
export function crateArtPalette(kind: CrateArtKind): { paint: THREE.Color; dust: THREE.Color; metal: boolean } {
  return { paint: new THREE.Color(PALETTES[kind].edge), dust: new THREE.Color(PALETTES[kind].metal ? '#9bb7bb' : '#dfb77e'), metal: !!PALETTES[kind].metal };
}
export function crateArtStats(kind: CrateArtKind): { triangles: number; shellDraws: number; shared: boolean } {
  if (kind === 'tnt' || kind === 'nitro') {
    const geometry = currentExplosiveTemplate()?.geometry ?? explosiveFallbackGeometry();
    return { triangles: (geometry.index?.count ?? geometry.getAttribute('position').count) / 3 + (kind === 'tnt' ? CRATE_FUSE_TRIANGLES : 0), shellDraws: kind === 'tnt' ? 3 : 1, shared: true };
  }
  const authored = isMetalCrate(kind) ? metalCrateTemplate() : kind === 'multihit' ? currentMultihitCrate() : currentCrateSculpt();
  const contentsTriangles = kind === 'multihit' ? MULTIHIT_FRUIT_TRIANGLES * 5 : 0;
  if (authored) { const geometry = isMetalCrate(kind) ? authored.geometry : crateSculptGeometry(kind)!;
    return { triangles: (geometry.index?.count ?? geometry.getAttribute('position').count) / 3 + contentsTriangles, shellDraws: kind === 'multihit' ? 2 : 1, shared: true }; }
  const t = template(kind);
  return { triangles: (t.shell.getAttribute('position').count + (t.marks.getAttribute('position')?.count ?? 0)) / 3 + contentsTriangles,
    shellDraws: kind === 'multihit' ? 2 : ['wood', 'empty', 'metal'].includes(kind) ? 1 : 2, shared: t.shell.userData.shared === true };
}
