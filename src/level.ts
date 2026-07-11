// A long linear test course structured like Crash 1's N. Sanity Beach: a wide
// "beach" intro, a funnel into corridor sections with crate/enemy rhythm,
// gaps, two grind rails over pits, checkpoints, and a fast downhill finish.
// The course runs along -Z, roughly 860 units, ~1-2 minutes of play.

import * as THREE from 'three';
import { Rail } from './rails';
import { CONST, TUNING } from './tuning';
import { sfx } from './audio';

export interface Crate {
  mesh: THREE.Mesh;
  box: THREE.Box3;
  alive: boolean;
  nitro?: boolean; // green, bobbing, touch = instant detonation
  bouncy?: boolean; // yellow arrow crate: stomp = super bounce, never breaks
  tnt?: boolean; // red TNT: solid box; stomp lights the 3-2-1 fuse, spin/slam detonates
  fuse?: number; // seconds left on a lit TNT
  mask?: boolean; // Aku crate: breaking it grants a protective mask
  mystery?: boolean; // ? crate: random reward (wumpa burst, mask, or a life)
}

export interface Enemy {
  group: THREE.Group;
  box: THREE.Box3;
  alive: boolean;
  x0: number; // patrol bounds — x for corridor levels, z for side-scroll levels
  x1: number;
  dir: number;
  speed: number;
  axis?: 'x' | 'z';
  // Spun enemies ping away ballistically and can smash what they hit.
  flungVel?: THREE.Vector3;
  flungT?: number;
  // Arena-fight enemies stay hidden until their wave is called.
  arenaWave?: number;
}

// Moving platform: slides along one axis on a sine, carrying the rider.
interface Mover {
  mesh: THREE.Mesh;
  base: THREE.Vector3;
  axisV: THREE.Vector3;
  amp: number;
  speed: number;
  phase: number;
  lastDelta: THREE.Vector3;
}

// Crumble pad: stand on it and it shakes, drops away, and (maybe) regrows.
interface Crumble {
  mesh: THREE.Mesh;
  base: THREE.Vector3;
  state: 'idle' | 'shake' | 'fall' | 'gone';
  t: number;
  regen: number | null; // seconds until it comes back; null = only on reset
}

// Timed crusher block: hangs, slams, rests, rises. Solid except when falling.
interface Crusher {
  mesh: THREE.Mesh;
  box: THREE.Box3;
  x: number;
  z: number;
  w: number;
  d: number;
  h: number;
  restY: number; // block center when it sits on the deck
  raise: number; // how far above rest it hangs
  cycle: number;
  phase: number;
  crushing: boolean;
  slammed: boolean; // edge flag for the impact thud
}

// Swinging pendulum blade across the corridor.
interface Pendulum {
  pivot: THREE.Group;
  len: number;
  amp: number;
  speed: number;
  phase: number;
  box: THREE.Box3;
  lastSign: number;
}

// Per-level look: sky gradient, fog, lights, ambient particle weather.
export interface Theme {
  skyTop: string;
  skyBottom: string;
  sunColorHex: string; // sky-dome sun disc tint ('' = no disc)
  sunU: number; // disc position on the dome (0..1 around, 0..1 down from top)
  sunV: number;
  stars: boolean;
  fog: number;
  fogNear: number;
  fogFar: number;
  hemiSky: number;
  hemiGround: number;
  hemiI: number;
  sunColor: number;
  sunI: number;
  particleColor: number;
  particleWind: [number, number, number]; // drift per second (y up = rising embers)
}

// Rolling stone hazard: patrols along the course, flattens careless riders.
export interface Stone {
  mesh: THREE.Mesh;
  box: THREE.Box3;
  x: number;
  z0: number;
  z1: number;
  dir: number;
  speed: number;
  r: number;
  chase?: boolean; // boulder-chase mode: rolls after the player instead of patrolling
}

// Floating wumpa, Crash-style: touch to collect (side-scroll levels).
export interface Pickup {
  mesh: THREE.Mesh;
  box: THREE.Box3;
  alive: boolean;
}

export interface Checkpoint {
  mesh: THREE.Mesh;
  box: THREE.Box3;
  active: boolean;
  spawnPos: THREE.Vector3;
  savedAlive: boolean[]; // crate alive-states captured when this was broken
  savedCratesBroken: number; // crate counter captured when this was broken
  savedFruit: number; // wumpa counter captured when this was broken
  savedMasks: number;
  savedPoints: number;
}

export const LEVEL_NAMES = [
  'Test Course',
  'Sideways',
  'Random',
  'The Gauntlet',
  'Boulder Dash',
  'The Flats',
  'The Warehouse',
];

export class Level {
  groundMeshes: THREE.Mesh[] = [];
  crates: Crate[] = [];
  enemies: Enemy[] = [];
  stones: Stone[] = [];
  checkpoints: Checkpoint[] = [];
  pickups: Pickup[] = [];
  rails: Rail[] = [];
  // Travel zones: rectangular regions where the course itself runs along X
  // instead of -Z (a real right-angle turn in the path). The camera never
  // yaws — the turned path is what makes those stretches side-scrolling.
  zones: { xMin: number; xMax: number; zMin: number; zMax: number; dir: 'E' | 'W' }[] = [];
  finishBox = new THREE.Box3();
  finishZ = -1005;
  endWallZ = -1021; // authored hard stop after the finish gate
  spawnPos = new THREE.Vector3(0, 0.1, 0);
  currentSpawn = new THREE.Vector3(0, 0.1, 0); // last activated checkpoint
  activeCheckpoint: Checkpoint | null = null; // owns the respawn snapshot
  walls: THREE.Box3[] = []; // solid barriers: bump = full stop, never break
  killY = -48; // per-level death height
  name = LEVEL_NAMES[0];
  // Boulder-chase machinery (Boulder Dash). player.step reports its position
  // here each step so the chase can trigger, rubber-band, and reset fairly.
  playerPos = new THREE.Vector3(0, 0, -1e9);
  chaseCam = false; // high, pulled-back framing: the player runs AT the lens
  boulder: {
    st: Stone;
    active: boolean;
    falling: boolean;
    fallV: number;
    endZ: number; // where the floor runs out — the boulder tips into the pit
    triggerZ: number; // player crossing this line starts the roll
    h0: number; // ground-height profile sampled at build time
    hStep: number;
    heights: number[];
  } | null = null;

  // --- motion toolkit ---
  movers: Mover[] = [];
  crumbles: Crumble[] = [];
  crushers: Crusher[] = [];
  pendulums: Pendulum[] = [];
  killBoxes: THREE.Box3[] = []; // touch-kill hazard volumes, rebuilt each update

  // --- set pieces ---
  // Arena lock: enter the zone, gates slam shut, survive the waves.
  arena: {
    zone: THREE.Box3;
    state: 'idle' | 'active' | 'done';
    wave: number;
    waveT: number;
    waves: Enemy[][];
    gates: { mesh: THREE.Mesh; upY: number; downY: number; box: THREE.Box3 }[];
  } | null = null;
  // Collapse wave: cross the trigger and the bridge falls away behind you.
  collapse: {
    planks: Crumble[];
    xMin: number;
    xMax: number;
    triggerZ: number;
    endZ: number;
    startZ: number;
    frontZ: number;
    speed: number;
    active: boolean;
  } | null = null;

  // --- visual pass ---
  // Default = Test Course: Sentinel-Beach morning. Brilliant turquoise zenith
  // over warm sand haze, high gold sun, jungle bounce light, drifting motes.
  theme: Theme = {
    skyTop: '#0fa3c2',
    skyBottom: '#ffe6ae',
    sunColorHex: '#fff0b8',
    sunU: 0.3,
    sunV: 0.4,
    stars: false,
    fog: 0xbfe0cd, // warm aqua haze so distance melts into the lagoon
    fogNear: 24,
    fogFar: 150,
    hemiSky: 0x9fdfe4,
    hemiGround: 0x8a6a3a,
    hemiI: 1.1,
    sunColor: 0xffe0a0,
    sunI: 1.45,
    particleColor: 0xfff0c0,
    particleWind: [0.8, -0.4, 0.3],
  };
  private scrollTexes: { tex: THREE.CanvasTexture; su: number; sv: number }[] = [];
  private ambient: { points: THREE.Points; drift: Float32Array } | null = null;

  // safe = triggered by the player's own spin/slam: breaks the world, not them
  explosions: { center: THREE.Vector3; t: number; radius: number; safe: boolean }[] = [];

  private scene: THREE.Scene;
  private root = new THREE.Group(); // everything the level owns, for disposal
  private pops: { obj: THREE.Object3D; t: number }[] = [];
  private time = 0;
  private arrowTex: THREE.CanvasTexture | null = null;
  private tntTexCache = new Map<string, THREE.CanvasTexture>();
  private maskTex: THREE.CanvasTexture | null = null;
  private mysteryTex: THREE.CanvasTexture | null = null;
  private plainTex: THREE.CanvasTexture | null = null;
  private nitroTex: THREE.CanvasTexture | null = null;
  private cpTex: THREE.CanvasTexture | null = null;

  // ---- warp-room VFX + collectathon relics (demoscene math, PS1 budget) ----
  crystalPickup: { group: THREE.Group; box: THREE.Box3; collected: boolean } | null = null;
  private crystalPlaced = false; // Random level: drop it on one mid-course deck
  private gemG: THREE.Group | null = null; // materializes when every box breaks
  private vfxT = 0; // animation clock for all the procedural magic
  private plasmaTex: THREE.CanvasTexture | null = null;
  private plasmaData: ImageData | null = null;
  private plasmaCtx: CanvasRenderingContext2D | null = null;
  private plasmaPal: Uint8Array | null = null; // 256-entry blue/cyan palette
  private plasmaFrame = 0;
  private chromeTex: THREE.CanvasTexture | null = null; // UV-scrolled fake chrome
  private glintTex: THREE.CanvasTexture | null = null;
  private flareTex: THREE.CanvasTexture | null = null; // big collection starburst
  private glowTex: THREE.CanvasTexture | null = null; // soft radial halo
  // sparkle/burst billboards: outward drift (vx/vz), spin, per-sprite tint, and
  // an optional grow-then-shrink pop for the big collection flare.
  private glints: {
    spr: THREE.Sprite;
    life: number;
    max: number;
    vx: number;
    vy: number;
    vz: number;
    spin: number;
    scale: number;
    pop: boolean;
  }[] = [];
  private glintT = 0;
  private glowRings: { mesh: THREE.Mesh; phase: number; speed: number; base: number }[] = [];
  private gateCrystalIcon: THREE.Mesh | null = null;
  private gateGemIcon: THREE.Mesh | null = null;
  private relics = { crystal: false, gem: false };
  private blastMeshes: { outer: THREE.Mesh; inner: THREE.Mesh; ex: { center: THREE.Vector3; t: number; radius: number } }[] = [];
  private blastBroken: Crate[] = []; // crates broken by blasts, for the player to tally
  private static blastGeo = new THREE.SphereGeometry(1, 10, 8);
  private static pickupGeo = new THREE.SphereGeometry(0.24, 8, 6);
  private checkerTex: THREE.CanvasTexture | null = null;

  // Subtle checker tiles (tinted by each deck's color) so ground movement
  // reads even without landmarks — crucial on the side-scroll camera.
  private checkerTexture(): THREE.CanvasTexture {
    if (this.checkerTex) return this.checkerTex;
    const canvas = document.createElement('canvas');
    canvas.width = 64;
    canvas.height = 64;
    const ctx = canvas.getContext('2d')!;
    for (let y = 0; y < 2; y++) {
      for (let x = 0; x < 2; x++) {
        ctx.fillStyle = (x + y) % 2 === 0 ? '#ffffff' : '#cfcfcf';
        ctx.fillRect(x * 32, y * 32, 32, 32);
      }
    }
    ctx.strokeStyle = 'rgba(0, 0, 0, 0.22)';
    ctx.lineWidth = 2;
    ctx.strokeRect(1, 1, 62, 62);
    this.checkerTex = new THREE.CanvasTexture(canvas);
    this.checkerTex.magFilter = THREE.NearestFilter;
    this.checkerTex.wrapS = THREE.RepeatWrapping;
    this.checkerTex.wrapT = THREE.RepeatWrapping;
    return this.checkerTex;
  }

  // Light-toned surface textures — near-white so each deck's material color
  // tints them. Organic kinds (grass/jungle/dirt/sand/wood) paint at 128px
  // with layered soft radial blobs and keep the default LinearFilter — the
  // smooth PS2 read. Man-made kinds stay 64px pixel-crisp. Cached per kind.
  private surfTexCache = new Map<string, THREE.CanvasTexture>();
  private surfaceTexture(kind: string): THREE.CanvasTexture {
    if (kind === 'checker') return this.checkerTexture();
    const cached = this.surfTexCache.get(kind);
    if (cached) return cached;
    const soft = kind === 'grass' || kind === 'jungle' || kind === 'dirt' || kind === 'sand' || kind === 'wood';
    const S = soft ? 128 : 64;
    const canvas = document.createElement('canvas');
    canvas.width = S;
    canvas.height = S;
    const ctx = canvas.getContext('2d')!;
    // Soft gradient blob, stamped at every wrapped position so tiles seam.
    const blob = (x: number, y: number, r: number, color: string): void => {
      for (const ox of [-S, 0, S]) {
        for (const oy of [-S, 0, S]) {
          const bx = x + ox;
          const by = y + oy;
          if (bx < -r || bx > S + r || by < -r || by > S + r) continue;
          const g = ctx.createRadialGradient(bx, by, r * 0.15, bx, by, r);
          g.addColorStop(0, color);
          g.addColorStop(1, 'rgba(255,255,255,0)');
          ctx.fillStyle = g;
          ctx.fillRect(bx - r, by - r, r * 2, r * 2);
        }
      }
    };
    if (kind === 'grass') {
      // meadow wash: overlapping green pools, shade, sun patches — painterly
      ctx.fillStyle = '#e6eed8';
      ctx.fillRect(0, 0, S, S);
      for (let i = 0; i < 26; i++) {
        const g = 205 + Math.floor(Math.random() * 34);
        const r = g - 24 - Math.floor(Math.random() * 14);
        blob(Math.random() * S, Math.random() * S, 14 + Math.random() * 16, `rgba(${r},${g},${g - 36},0.5)`);
      }
      for (let i = 0; i < 10; i++) blob(Math.random() * S, Math.random() * S, 10 + Math.random() * 12, 'rgba(112,138,88,0.2)');
      for (let i = 0; i < 12; i++) blob(Math.random() * S, Math.random() * S, 5 + Math.random() * 8, 'rgba(255,255,236,0.3)');
    } else if (kind === 'stone') {
      ctx.fillStyle = '#9a9a9a';
      ctx.fillRect(0, 0, 64, 64);
      for (let row = 0; row < 2; row++) {
        const off = row % 2 === 0 ? 0 : 16;
        for (let cx = -1; cx < 3; cx++) {
          const v = 215 + Math.floor(Math.random() * 25);
          ctx.fillStyle = `rgb(${v},${v},${v + 4})`;
          ctx.fillRect(cx * 32 + off + 2, row * 32 + 2, 28, 28);
          ctx.fillStyle = 'rgba(120,120,120,0.35)';
          ctx.fillRect(cx * 32 + off + 2, row * 32 + 26, 28, 4); // bottom shade
        }
      }
    } else if (kind === 'wood') {
      // sun-warmed timber: per-plank tonal wash, soft grain, shaded seams
      for (let p = 0; p < 4; p++) {
        const v = 218 + Math.floor(Math.random() * 24);
        const gr = ctx.createLinearGradient(p * 32, 0, p * 32 + 32, 0);
        gr.addColorStop(0, `rgb(${v - 10},${v - 26},${v - 46})`);
        gr.addColorStop(0.5, `rgb(${v},${v - 14},${v - 34})`);
        gr.addColorStop(1, `rgb(${v - 12},${v - 28},${v - 48})`);
        ctx.fillStyle = gr;
        ctx.fillRect(p * 32, 0, 32, S);
        ctx.strokeStyle = 'rgba(126,94,60,0.35)';
        ctx.lineWidth = 2;
        for (let g = 0; g < 3; g++) {
          const gx = p * 32 + 7 + g * 9;
          ctx.beginPath();
          ctx.moveTo(gx, 0);
          ctx.bezierCurveTo(gx + 4, S * 0.3, gx - 4, S * 0.65, gx, S);
          ctx.stroke();
        }
        blob(p * 32 + 8 + Math.random() * 16, Math.random() * S, 4 + Math.random() * 3, 'rgba(122,88,52,0.45)'); // knot
        ctx.fillStyle = 'rgba(96,72,48,0.5)';
        ctx.fillRect(p * 32, 0, 2, S); // seam
      }
    } else if (kind === 'jungle') {
      // canopy floor: deep leaf pools under sunlit tops, all soft-edged
      ctx.fillStyle = '#dbe6c4';
      ctx.fillRect(0, 0, S, S);
      for (let i = 0; i < 30; i++) {
        const g = 196 + Math.floor(Math.random() * 44);
        const b = g - 48 + Math.floor(Math.random() * 16);
        blob(Math.random() * S, Math.random() * S, 10 + Math.random() * 14, `rgba(${g - 40},${g},${b},0.55)`);
      }
      for (let i = 0; i < 14; i++) blob(Math.random() * S, Math.random() * S, 8 + Math.random() * 12, 'rgba(74,102,60,0.24)');
      for (let i = 0; i < 12; i++) blob(Math.random() * S, Math.random() * S, 4 + Math.random() * 7, 'rgba(255,255,232,0.32)');
    } else if (kind === 'dirt') {
      // trodden earth: warm soft blotches, moss creep, dry sunlit patches
      ctx.fillStyle = '#e5dabd';
      ctx.fillRect(0, 0, S, S);
      for (let i = 0; i < 16; i++) {
        const v = 198 + Math.floor(Math.random() * 36);
        blob(Math.random() * S, Math.random() * S, 12 + Math.random() * 18, `rgba(${v},${v - 20},${v - 52},0.5)`);
      }
      for (let i = 0; i < 8; i++) blob(Math.random() * S, Math.random() * S, 8 + Math.random() * 10, 'rgba(140,132,86,0.2)');
      for (let i = 0; i < 14; i++) blob(Math.random() * S, Math.random() * S, 2.5 + Math.random() * 3.5, 'rgba(122,96,62,0.4)'); // pebbles
      for (let i = 0; i < 8; i++) blob(Math.random() * S, Math.random() * S, 6 + Math.random() * 9, 'rgba(255,246,220,0.32)');
    } else if (kind === 'pavement') {
      // concrete: 32px slabs, expansion lines, speckle so aprons don't band
      for (let py = 0; py < 2; py++) {
        for (let px = 0; px < 2; px++) {
          const v = 214 + Math.floor(Math.random() * 22);
          ctx.fillStyle = `rgb(${v},${v},${v - 6})`;
          ctx.fillRect(px * 32, py * 32, 32, 32);
        }
      }
      ctx.fillStyle = 'rgba(150,150,145,0.5)';
      for (let i = 0; i < 44; i++) ctx.fillRect(Math.random() * 63, Math.random() * 63, 1.5, 1.5);
      ctx.fillStyle = 'rgba(105,105,100,0.65)'; // expansion joints
      ctx.fillRect(0, 31, 64, 2);
      ctx.fillRect(31, 0, 2, 64);
      ctx.fillRect(0, 0, 64, 1);
      ctx.fillRect(0, 0, 1, 64);
      ctx.fillStyle = 'rgba(255,255,250,0.5)'; // sun-bleached slab lips
      ctx.fillRect(0, 33, 64, 1);
      ctx.fillRect(33, 0, 1, 64);
    } else if (kind === 'asphalt') {
      // FULL-COLOUR (pair with a white material): blacktop + painted lane
      // line along one tile edge — tiled, it reads as parking-lot bays.
      ctx.fillStyle = '#3e4046';
      ctx.fillRect(0, 0, 64, 64);
      for (let i = 0; i < 120; i++) {
        const v = 44 + Math.floor(Math.random() * 46);
        ctx.fillStyle = `rgb(${v},${v + 2},${v + 6})`;
        ctx.fillRect(Math.random() * 63, Math.random() * 63, 1.5, 1.5);
      }
      ctx.strokeStyle = 'rgba(22,22,26,0.7)'; // hairline cracks
      ctx.lineWidth = 1;
      for (let i = 0; i < 3; i++) {
        ctx.beginPath();
        let px = Math.random() * 64;
        ctx.moveTo(px, 0);
        for (let s = 1; s <= 4; s++) {
          px += (Math.random() - 0.5) * 14;
          ctx.lineTo(px, s * 16);
        }
        ctx.stroke();
      }
      ctx.fillStyle = '#e8e2c8'; // worn paint stripe
      ctx.fillRect(0, 0, 64, 3);
      ctx.fillStyle = 'rgba(62,64,70,0.5)'; // scuff it back
      for (let i = 0; i < 10; i++) ctx.fillRect(Math.random() * 62, 0, 3, 2);
    } else if (kind === 'metal') {
      // brushed deck plate: lengthwise strokes, panel seams, corner rivets
      ctx.fillStyle = '#dde0e4';
      ctx.fillRect(0, 0, 64, 64);
      for (let i = 0; i < 40; i++) {
        const v = 200 + Math.floor(Math.random() * 46);
        ctx.fillStyle = `rgba(${v},${v + 2},${v + 8},0.7)`;
        ctx.fillRect(0, Math.random() * 63, 34 + Math.random() * 30, 1);
      }
      ctx.fillStyle = 'rgba(110,116,128,0.8)'; // seams
      ctx.fillRect(0, 0, 64, 2);
      ctx.fillRect(0, 0, 2, 64);
      ctx.fillStyle = 'rgba(255,255,255,0.7)';
      ctx.fillRect(0, 2, 64, 1);
      ctx.fillStyle = 'rgba(90,96,108,0.9)'; // rivets
      for (const [rx, ry] of [[6, 6], [58, 6], [6, 58], [58, 58], [32, 6], [32, 58]] as const) {
        ctx.fillRect(rx - 1, ry - 1, 3, 3);
      }
    } else if (kind === 'plank') {
      // boardwalk: 8px cross-planks, staggered butt joints, worn grain
      for (let p = 0; p < 8; p++) {
        const v = 216 + Math.floor(Math.random() * 26);
        ctx.fillStyle = `rgb(${v},${v - 18},${v - 40})`;
        ctx.fillRect(0, p * 8, 64, 8);
        ctx.fillStyle = 'rgba(110,80,50,0.8)';
        ctx.fillRect(0, p * 8, 64, 1); // seam
        ctx.fillRect(((p * 29) % 61) + 2, p * 8, 1, 8); // butt joint
        ctx.fillStyle = 'rgba(140,105,65,0.5)'; // grain scratch
        ctx.fillRect(Math.random() * 40, p * 8 + 2 + Math.random() * 4, 14 + Math.random() * 18, 1);
      }
      ctx.fillStyle = 'rgba(255,240,210,0.35)';
      for (let i = 0; i < 12; i++) ctx.fillRect(Math.random() * 60, Math.random() * 62, 3, 1);
    } else {
      // sand: warm tonal pools under soft ripple shadows
      ctx.fillStyle = '#f3ecd6';
      ctx.fillRect(0, 0, S, S);
      for (let i = 0; i < 18; i++) {
        const v = 205 + Math.floor(Math.random() * 34);
        blob(Math.random() * S, Math.random() * S, 16 + Math.random() * 20, `rgba(${v},${v - 12},${v - 40},0.35)`);
      }
      for (let i = 0; i < 8; i++) blob(Math.random() * S, Math.random() * S, 10 + Math.random() * 12, 'rgba(255,250,232,0.35)');
      ctx.strokeStyle = 'rgba(186,164,120,0.22)';
      ctx.lineWidth = 3;
      for (let i = 0; i < 5; i++) {
        ctx.beginPath();
        const y = 12 + i * 24;
        ctx.moveTo(0, y);
        ctx.bezierCurveTo(S * 0.3, y + 7, S * 0.7, y - 7, S, y);
        ctx.stroke();
      }
    }
    const tex = new THREE.CanvasTexture(canvas);
    if (!soft) tex.magFilter = THREE.NearestFilter; // crisp = man-made only
    tex.wrapS = THREE.RepeatWrapping;
    tex.wrapT = THREE.RepeatWrapping;
    this.surfTexCache.set(kind, tex);
    return tex;
  }

  // Per-deck clone of a base material with a surface texture tiled on it.
  private patterned(mat: THREE.Material, w: number, d: number, kind = 'checker'): THREE.MeshLambertMaterial {
    const m = (mat as THREE.MeshLambertMaterial).clone();
    const tex = this.surfaceTexture(kind).clone();
    const density =
      kind === 'grass' ? 8.5 // soft 128px kinds tile larger so blobs read
      : kind === 'jungle' ? 8
      : kind === 'wood' ? 3.2
      : kind === 'plank' ? 3.4
      : kind === 'sand' ? 7.5
      : kind === 'dirt' ? 7
      : kind === 'pavement' ? 6
      : kind === 'asphalt' ? 8 // one paint stripe per 8u = parking bays
      : kind === 'metal' ? 3
      : 4;
    tex.repeat.set(Math.max(1, Math.round(w / density)), Math.max(1, Math.round(d / density)));
    tex.needsUpdate = true;
    m.map = tex;
    return m;
  }

  // Shared structural materials — one per role per level (walls, blocks,
  // curbs, logs, rocks...), fixed texture repeat. Box UVs run 0..1 per face,
  // so texel size breathes with mesh size: very PS1, very cheap. kind '' = no
  // map (flat painted accents). Builders re-tint via the *Tint fields below
  // BEFORE placing geometry.
  private baseMats = new Map<string, THREE.MeshLambertMaterial>();
  private baseMat(key: string, color: number, kind = '', rx = 2, ry = 2): THREE.MeshLambertMaterial {
    let m = this.baseMats.get(key);
    if (m) return m;
    m = new THREE.MeshLambertMaterial({ color });
    if (kind !== '') {
      const tex = this.surfaceTexture(kind).clone();
      tex.repeat.set(rx, ry);
      tex.needsUpdate = true;
      m.map = tex;
    }
    this.baseMats.set(key, m);
    return m;
  }

  // Per-level structural palette (defaults suit the Test Course beach).
  private wallTint = 0xb89a70; // perimeter walls / end wall
  private blockTint = 0xc0a878; // step blocks, stair climbs
  private curbTint = 0xe8a84e; // painted deck-edge strips
  private bermTint = 0x3f8a34; // jungle strip shoulders

  // Rails come out of rails.ts plain grey; reskin every segment in the
  // warp-room chrome (cool-tinted so it reads as polished steel with a magic
  // sheen) and the posts in dark iron. Shared materials, and the chrome clone
  // rides the scrollTexes list so the bands drift — grind lines glint from
  // across the map. Visual only: rail snap logic never looks at these meshes.
  private dressRails(): void {
    const chrome = this.chromeTexture().clone();
    chrome.repeat.set(1, 5); // bands streak along the pipe
    chrome.needsUpdate = true;
    this.scrollTexes.push({ tex: chrome, su: 0.22, sv: 0.045 });
    const railMat = new THREE.MeshLambertMaterial({ map: chrome, color: 0xdce8f2, emissive: 0x46506a });
    const postMat = new THREE.MeshLambertMaterial({ color: 0x3c424e, emissive: 0x11141a });
    for (const rail of this.rails) {
      rail.object.traverse((o) => {
        const m = o as THREE.Mesh;
        if (!m.isMesh) return;
        m.material = m.geometry.type === 'CylinderGeometry' ? railMat : postMat;
      });
    }
  }

  constructor(scene: THREE.Scene, courseId = 0) {
    this.scene = scene;
    scene.add(this.root);
    this.name = LEVEL_NAMES[courseId] ?? LEVEL_NAMES[0];
    if (courseId === 1) this.buildSideways();
    else if (courseId === 2) this.buildRandom();
    else if (courseId === 3) this.buildGauntlet();
    else if (courseId === 4) this.buildBoulderDash();
    else if (courseId === 5) this.buildFlats();
    else if (courseId === 6) this.buildWarehouse();
    else this.buildTestCourse();
    this.dressRails(); // every builder is done adding rails by now
    this.buildAmbient(); // theme is set by the builder above
  }

  dispose(): void {
    const disposeMat = (x: THREE.Material): void => {
      const map = (x as THREE.MeshLambertMaterial).map;
      if (map) map.dispose();
      x.dispose();
    };
    this.root.traverse((o) => {
      const m = o as THREE.Mesh;
      if (m.geometry) m.geometry.dispose();
      const mat = m.material as THREE.Material | THREE.Material[] | undefined;
      if (Array.isArray(mat)) mat.forEach(disposeMat);
      else if (mat) disposeMat(mat);
    });
    this.scene.remove(this.root);
  }

  get totalCrates(): number {
    return this.crates.filter((c) => !c.nitro && !c.bouncy && !c.tnt).length;
  }

  zoneAt(x: number, z: number): { dir: 'E' | 'W' } | null {
    for (const zn of this.zones) {
      if (x >= zn.xMin && x <= zn.xMax && z >= zn.zMin && z <= zn.zMax) return zn;
    }
    return null;
  }

  update(dt: number): void {
    this.updateVfx(dt);
    // Spun-away enemies: ballistic tumble; anything they hit, breaks.
    for (const e of this.enemies) {
      if (e.flungT === undefined || !e.flungVel) continue;
      e.flungT += dt;
      e.flungVel.y -= 30 * dt;
      e.group.position.addScaledVector(e.flungVel, dt);
      e.group.rotation.x += 9 * dt;
      e.group.rotation.y += 5 * dt;
      for (const c of this.crates) {
        if (!c.alive || c.bouncy) continue;
        if (e.group.position.distanceTo(c.mesh.position) < 1.5) {
          if (c.nitro || c.tnt) this.detonate(c);
          else {
            this.breakCrate(c);
            this.blastBroken.push(c); // player tallies it like blast debris
          }
        }
      }
      if (e.flungT > 1.4) {
        e.flungT = undefined;
        e.flungVel = undefined;
        e.group.visible = false;
      }
    }

    // Rolling stones: back and forth along the course, always turning.
    for (const st of this.stones) {
      if (st.chase) continue; // the boulder has its own brain below
      st.mesh.position.z += st.dir * st.speed * dt;
      if (st.mesh.position.z < st.z1) {
        st.mesh.position.z = st.z1;
        st.dir = 1;
      } else if (st.mesh.position.z > st.z0) {
        st.mesh.position.z = st.z0;
        st.dir = -1;
      }
      st.mesh.rotation.x -= (st.dir * st.speed * dt) / st.r;
      st.box.setFromCenterAndSize(
        st.mesh.position,
        new THREE.Vector3(st.r * 1.7, st.r * 2, st.r * 1.7),
      );
    }

    // THE BOULDER. Waits behind the spawn until the player bolts, then rolls
    // +Z after them — rubber-banding so it stays scary but beatable. It fills
    // the corridor wall to wall (no dodging sideways), crushes crates, sets
    // off explosives, flattens enemies, and finally tips into the end pit.
    const b = this.boulder;
    if (b) {
      const st = b.st;
      const p = st.mesh.position;
      if (!b.active && !b.falling && this.playerPos.z > b.triggerZ) {
        b.active = true;
        sfx.play('crunch', 0.9, 0.55);
      }
      if (b.active) {
        const gap = this.playerPos.z - p.z; // how far ahead the runner is
        // Rubber-band around the tunable base speed (ratios preserved).
        const base = TUNING.boulderSpeed;
        let sp = base;
        if (gap < -2) sp = base * 1.36; // it already passed you: let it thunder off
        else if (gap < 14) sp = base * 0.84; // right on your heels: a sliver of mercy
        else if (gap > 50) sp = base * 1.28; // never let it fall out of frame
        st.speed = sp;
        p.z += sp * dt;
        p.y = this.boulderGroundY(p.z) + st.r * 0.92;
        st.mesh.rotation.x += (sp * dt) / st.r;
        // Wall-to-wall kill box: you outrun a boulder, you don't sidestep it.
        st.box.setFromCenterAndSize(p, new THREE.Vector3(12.5, st.r * 1.9, st.r * 1.4));
        for (const c of this.crates) {
          if (!c.alive) continue;
          const cp = c.mesh.position;
          if (Math.abs(cp.z - p.z) < st.r + 0.8 && Math.abs(cp.x - p.x) < st.r + 0.8) {
            if (c.nitro || c.tnt) this.detonate(c);
            else this.breakCrate(c);
          }
        }
        for (const e of this.enemies) {
          if (e.alive && Math.abs(e.group.position.z - p.z) < st.r + 0.8) this.killEnemy(e);
        }
        if (p.z >= b.endZ) {
          b.active = false;
          b.falling = true;
          st.box.makeEmpty();
        }
      } else if (b.falling) {
        b.fallV += 32 * dt;
        p.y -= b.fallV * dt;
        p.z += 5 * dt; // tips forward into the pit
        st.mesh.rotation.x += 2 * dt;
        if (p.y < this.killY - 20) b.falling = false;
      }
    }

    // Moving platforms: sine slide along one axis; the player reads lastDelta
    // at the top of their step so they ride along.
    for (const m of this.movers) {
      const s = Math.sin(this.time * m.speed + m.phase) * m.amp;
      m.lastDelta
        .copy(m.base)
        .addScaledVector(m.axisV, s)
        .sub(m.mesh.position);
      m.mesh.position.add(m.lastDelta);
    }

    // Crumble pads: shake, drop, (maybe) regrow.
    for (const c of this.crumbles) {
      if (c.state === 'idle') continue;
      c.t += dt;
      if (c.state === 'shake') {
        c.mesh.position.x = c.base.x + Math.sin(c.t * 55) * 0.06;
        c.mesh.position.y = c.base.y - c.t * 0.25;
        if (c.t > 0.35) {
          c.state = 'fall';
          c.t = 0;
          if (Math.abs(c.base.z - this.playerPos.z) < 45) sfx.play('crunch', 0.45, 0.9);
        }
      } else if (c.state === 'fall') {
        c.mesh.position.y -= 30 * c.t * dt;
        c.mesh.rotation.x += 1.6 * dt;
        c.mesh.rotation.z += 0.9 * dt;
        if (c.t > 1.1) {
          c.state = 'gone';
          c.t = 0;
          c.mesh.visible = false;
          c.mesh.position.y = c.base.y - 400; // park far below any raycast
        }
      } else if (c.state === 'gone' && c.regen !== null && c.t > c.regen) {
        c.state = 'idle';
        c.mesh.visible = true;
        c.mesh.position.copy(c.base);
        c.mesh.rotation.set(0, 0, 0);
      }
    }

    // Crushers: hang -> slam -> rest -> rise, on a loop.
    for (const cr of this.crushers) {
      const t = (this.time + cr.phase) % cr.cycle;
      const f = t / cr.cycle;
      let y: number;
      cr.crushing = false;
      if (f < 0.38) {
        y = cr.restY + cr.raise; // hanging, shadow of doom below
        cr.slammed = false;
      } else if (f < 0.46) {
        y = cr.restY + cr.raise * (1 - (f - 0.38) / 0.08); // the slam
        cr.crushing = true;
      } else if (f < 0.7) {
        y = cr.restY; // resting: a solid wall
        if (!cr.slammed) {
          cr.slammed = true;
          if (Math.abs(cr.z - this.playerPos.z) < 45) sfx.play('crunch', 0.8, 0.5);
        }
      } else {
        y = cr.restY + cr.raise * ((f - 0.7) / 0.3); // slow menacing rise
      }
      cr.mesh.position.y = y;
      cr.box.setFromCenterAndSize(
        new THREE.Vector3(cr.x, y, cr.z),
        new THREE.Vector3(cr.w, cr.h, cr.d),
      );
    }

    // Pendulum blades: swing across the corridor; the bob is a kill box.
    this.killBoxes.length = 0;
    for (const pd of this.pendulums) {
      const a = Math.sin(this.time * pd.speed + pd.phase) * pd.amp;
      pd.pivot.rotation.z = a;
      const bx = pd.pivot.position.x + Math.sin(a) * pd.len;
      const by = pd.pivot.position.y - Math.cos(a) * pd.len;
      pd.box.setFromCenterAndSize(
        new THREE.Vector3(bx, by, pd.pivot.position.z),
        new THREE.Vector3(2.0, 2.0, 1.6),
      );
      this.killBoxes.push(pd.box);
      const sign = Math.sign(a) || 1;
      if (sign !== pd.lastSign) {
        pd.lastSign = sign;
        const dz = Math.abs(pd.pivot.position.z - this.playerPos.z);
        const dx = Math.abs(pd.pivot.position.x - this.playerPos.x);
        if (dz < 26 && dx < 26) sfx.play('woosh', 0.28, 1.25);
      }
    }

    // Arena lock: gates up, waves in, gates down when the pit is clear.
    const ar = this.arena;
    if (ar) {
      if (ar.state === 'idle' && ar.zone.containsPoint(this.playerPos)) {
        ar.state = 'active';
        ar.wave = 0;
        ar.waveT = 0.4;
        for (const g of ar.gates) this.walls.push(g.box);
        sfx.play('railLand', 0.9, 0.6);
      }
      if (ar.state === 'active') {
        if (ar.waveT > 0) {
          // countdown, then the wave drops in
          ar.waveT -= dt;
          if (ar.waveT <= 0) {
            for (const e of ar.waves[ar.wave]) {
              e.alive = true;
              e.group.visible = true;
              e.group.scale.setScalar(1);
            }
            sfx.play('enemyDown', 0.6, 1.2);
            ar.waveT = 0;
          }
        } else if (!ar.waves[ar.wave].some((e) => e.alive)) {
          ar.wave++;
          if (ar.wave >= ar.waves.length) {
            ar.state = 'done';
            for (const g of ar.gates) {
              const i = this.walls.indexOf(g.box);
              if (i >= 0) this.walls.splice(i, 1);
            }
            sfx.play('lifeGet', 0.9);
          } else {
            ar.waveT = 0.7; // breather before the next wave
          }
        }
      }
      // gate meshes chase their target height
      for (const g of ar.gates) {
        const target = ar.state === 'active' ? g.upY : g.downY;
        g.mesh.position.y += THREE.MathUtils.clamp(target - g.mesh.position.y, -9 * dt, 9 * dt);
      }
    }

    // Collapse wave: once triggered, the bridge falls away toward the exit —
    // slightly slower than a committed sprint, so hesitation is what kills.
    const cw = this.collapse;
    if (cw) {
      if (
        !cw.active &&
        this.playerPos.z < cw.triggerZ &&
        this.playerPos.z > cw.endZ &&
        this.playerPos.x > cw.xMin &&
        this.playerPos.x < cw.xMax
      ) {
        cw.active = true;
        cw.frontZ = cw.startZ;
      }
      if (cw.active) {
        cw.frontZ -= cw.speed * dt;
        for (const p of cw.planks) {
          if (p.state === 'idle' && p.base.z > cw.frontZ) {
            p.state = 'shake';
            p.t = 0;
          }
        }
        if (cw.frontZ < cw.endZ - 10) cw.active = false; // spent
      }
    }

    // Scrolling pit textures (water/lava) drift forever.
    for (const s of this.scrollTexes) {
      s.tex.offset.x = (s.tex.offset.x + s.su * dt) % 1;
      s.tex.offset.y = (s.tex.offset.y + s.sv * dt) % 1;
    }

    // Ambient weather: leaves/embers/dust drifting in a box around the player.
    if (this.ambient) {
      const pts = this.ambient.points;
      const attr = pts.geometry.attributes.position as THREE.BufferAttribute;
      const drift = this.ambient.drift;
      const [wx, wy, wz] = this.theme.particleWind;
      const px = this.playerPos.x;
      const py = this.playerPos.y;
      const pz = this.playerPos.z;
      const R = 34;
      const RY = 18;
      for (let i = 0; i < attr.count; i++) {
        let x = attr.getX(i) + (wx + drift[i * 3]) * dt + Math.sin(this.time * 0.9 + i) * 0.5 * dt;
        let y = attr.getY(i) + (wy + drift[i * 3 + 1]) * dt;
        let z = attr.getZ(i) + (wz + drift[i * 3 + 2]) * dt;
        // wrap into the box around the player
        if (x < px - R) x += R * 2;
        else if (x > px + R) x -= R * 2;
        if (y < py - 6) y += RY + 6;
        else if (y > py + RY) y -= RY + 6;
        if (z < pz - R) z += R * 2;
        else if (z > pz + R) z -= R * 2;
        attr.setXYZ(i, x, y, z);
      }
      attr.needsUpdate = true;
    }

    for (const e of this.enemies) {
      if (!e.alive) continue;
      if (e.axis === 'z') {
        // side-scroll patrol: back and forth across the screen
        e.group.position.z += e.dir * e.speed * dt;
        if (e.group.position.z > e.x1) {
          e.group.position.z = e.x1;
          e.dir = -1;
        } else if (e.group.position.z < e.x0) {
          e.group.position.z = e.x0;
          e.dir = 1;
        }
        e.group.rotation.y = e.dir > 0 ? 0 : Math.PI;
      } else {
        e.group.position.x += e.dir * e.speed * dt;
        if (e.group.position.x > e.x1) {
          e.group.position.x = e.x1;
          e.dir = -1;
        } else if (e.group.position.x < e.x0) {
          e.group.position.x = e.x0;
          e.dir = 1;
        }
        e.group.rotation.y = e.dir > 0 ? Math.PI / 2 : -Math.PI / 2;
      }
      e.box.setFromCenterAndSize(
        e.group.position.clone().add(new THREE.Vector3(0, 0.55, 0)),
        new THREE.Vector3(1.3, 1.1, 1.3),
      );
    }
    // Floating wumpa bob in place.
    for (const p of this.pickups) {
      if (!p.alive) continue;
      p.mesh.position.y =
        (p.mesh.userData.baseY as number) + Math.sin(this.time * 3 + p.mesh.position.z * 0.7) * 0.12;
      p.mesh.rotation.y += dt * 2;
    }
    // Unbroken checkpoint boxes idle-spin so they read as special.
    for (const c of this.checkpoints) {
      if (!c.active) c.mesh.rotation.y += dt * 1.2;
    }
    // Nitro crates bob menacingly.
    this.time += dt;
    for (const c of this.crates) {
      if (!c.nitro) continue;
      c.mesh.position.y =
        (c.mesh.userData.baseY as number) + Math.sin(this.time * 4 + c.mesh.position.z) * 0.12;
    }
    // Lit TNT fuses: pulse faster and faster, then blow.
    for (const c of this.crates) {
      if (!c.tnt || !c.alive || c.fuse === undefined) continue;
      c.fuse -= dt;
      const digit = Math.max(1, Math.ceil(c.fuse));
      if (c.mesh.userData.digit !== digit) {
        c.mesh.userData.digit = digit;
        (c.mesh.material as THREE.MeshLambertMaterial).map = this.tntTexture(String(digit));
        sfx.play(digit % 2 === 0 ? 'tntCount2' : 'tntCount', 0.7);
      }
      const urgency = 6 + (CONST.tntFuse - c.fuse) * 6;
      c.mesh.scale.setScalar(1 + Math.abs(Math.sin(this.time * urgency)) * 0.06);
      if (c.fuse <= 0) this.detonate(c);
    }

    // Expanding blasts: chain explosives, break crates, kill enemies.
    for (const ex of this.explosions) {
      ex.t += dt;
      if (ex.t <= CONST.blastGrow + 0.05) {
        const r = ex.radius * Math.min(1, ex.t / CONST.blastGrow);
        for (const c of this.crates) {
          if (!c.alive || c.bouncy) continue;
          if (c.mesh.position.distanceTo(ex.center) < r + 0.6) {
            if (c.nitro || c.tnt) this.detonate(c);
            else {
              this.breakCrate(c);
              this.blastBroken.push(c);
            }
          }
        }
        for (const e of this.enemies) {
          if (e.alive && e.group.position.distanceTo(ex.center) < r + 0.8) this.killEnemy(e);
        }
      }
    }
    for (let i = this.blastMeshes.length - 1; i >= 0; i--) {
      const b = this.blastMeshes[i];
      const r = Math.max(0.01, b.ex.radius * Math.min(1, b.ex.t / CONST.blastGrow));
      b.outer.scale.setScalar(r);
      b.inner.scale.setScalar(r * 0.55);
      const fade = Math.max(0, 1 - b.ex.t / 0.6);
      (b.outer.material as THREE.MeshBasicMaterial).opacity = 0.55 * fade;
      (b.inner.material as THREE.MeshBasicMaterial).opacity = 0.9 * fade;
      if (b.ex.t > 0.6) {
        this.root.remove(b.outer);
        this.root.remove(b.inner);
        (b.outer.material as THREE.Material).dispose();
        (b.inner.material as THREE.Material).dispose();
        this.blastMeshes.splice(i, 1);
      }
    }
    for (let i = this.explosions.length - 1; i >= 0; i--) {
      if (this.explosions[i].t > 0.7) this.explosions.splice(i, 1);
    }

    // Quick scale-pop for broken crates / squashed enemies.
    for (let i = this.pops.length - 1; i >= 0; i--) {
      const p = this.pops[i];
      p.t -= dt;
      const s = Math.max(p.t / 0.12, 0.001);
      p.obj.scale.setScalar(s);
      if (p.t <= 0) {
        p.obj.visible = false;
        this.pops.splice(i, 1);
      }
    }
  }

  breakCrate(crate: Crate): void {
    crate.alive = false;
    this.pops.push({ obj: crate.mesh, t: 0.12 });
    sfx.play(Math.random() < 0.5 ? 'crateBreak1' : 'crateBreak2', 0.8);
  }

  lightFuse(c: Crate): void {
    if (c.alive && c.tnt && c.fuse === undefined) c.fuse = CONST.tntFuse;
  }

  // Blow up a nitro/TNT box: expanding blast that chains neighbors, breaks
  // normal crates, kills enemies, and (checked player-side) kills the rider.
  // safe=true (the player spun/slammed it themselves) spares the rider — but
  // anything it CHAINS detonates unsafe, so popping a stack up close is a risk.
  detonate(c: Crate, safe = false): void {
    if (!c.alive) return;
    c.alive = false;
    c.fuse = undefined;
    c.mesh.visible = false;
    const center = c.mesh.position.clone();
    const radius = c.tnt ? TUNING.tntRadius : TUNING.nitroRadius;
    const ex = { center, t: 0, radius, safe };
    this.explosions.push(ex);
    sfx.play('tntBoom', 0.9);
    const outer = new THREE.Mesh(
      Level.blastGeo,
      new THREE.MeshBasicMaterial({ color: 0xff7a28, transparent: true, opacity: 0.55 }),
    );
    const inner = new THREE.Mesh(
      Level.blastGeo,
      new THREE.MeshBasicMaterial({ color: 0xfff2c8, transparent: true, opacity: 0.9 }),
    );
    outer.position.copy(center);
    inner.position.copy(center);
    outer.scale.setScalar(0.01);
    inner.scale.setScalar(0.01);
    this.root.add(outer);
    this.root.add(inner);
    this.blastMeshes.push({ outer, inner, ex });
  }

  consumeBlastBroken(): Crate[] {
    const b = this.blastBroken;
    this.blastBroken = [];
    return b;
  }

  killEnemy(enemy: Enemy, fling?: THREE.Vector3): void {
    enemy.alive = false;
    if (fling) {
      // ping away instead of popping; update() flies it into whatever lines up
      enemy.flungVel = fling.clone();
      enemy.flungT = 0;
      sfx.play('fruitSpun', 0.8); // the "spun away" zing
    } else {
      this.pops.push({ obj: enemy.group, t: 0.12 });
      sfx.play('enemyDown', 0.7);
    }
  }

  // Broken (spun/stomped) like a normal box; banks the respawn point and a
  // snapshot of exactly which crates are broken + the counter at this moment.
  activateCheckpoint(cp: Checkpoint, cratesBroken: number, fruit = 0, masks = 0, points = 0): void {
    cp.active = true;
    cp.savedAlive = this.crates.map((c) => c.alive);
    cp.savedCratesBroken = cratesBroken;
    cp.savedFruit = fruit;
    cp.savedMasks = masks;
    cp.savedPoints = points;
    this.currentSpawn.copy(cp.spawnPos);
    this.activeCheckpoint = cp;
    cp.mesh.scale.setScalar(1);
    this.pops.push({ obj: cp.mesh, t: 0.12 }); // break it like a crate
    sfx.play('lifeGet', 0.8);
  }

  private restoreTntFace(c: Crate): void {
    if (c.tnt && c.mesh.userData.digit !== undefined) {
      c.mesh.userData.digit = undefined;
      (c.mesh.material as THREE.MeshLambertMaterial).map = this.tntTexture('TNT');
    }
  }

  // Soft reset (death): restore the crate world to the last checkpoint's
  // snapshot — boxes broken before it stay broken, boxes broken after it come
  // back; banked checkpoints stay consumed. Hard reset (R / new run) revives
  // everything and relights every checkpoint box.
  reset(hard: boolean): void {
    // Hard reset re-seats the crystal and clears the materialized gem; a soft
    // (death) respawn keeps them — Crash rules, once it's yours it's yours.
    if (hard) {
      if (this.crystalPickup) {
        this.crystalPickup.collected = false;
        this.crystalPickup.group.visible = true;
      }
      if (this.gemG) {
        this.root.remove(this.gemG);
        this.gemG = null;
      }
      this.relics = { crystal: true, gem: true };
      this.setRelics(false, false);
    }
    this.pops.length = 0;
    this.explosions.length = 0;
    this.blastBroken.length = 0;
    for (const b of this.blastMeshes) {
      this.root.remove(b.outer);
      this.root.remove(b.inner);
      (b.outer.material as THREE.Material).dispose();
      (b.inner.material as THREE.Material).dispose();
    }
    this.blastMeshes.length = 0;

    if (!hard && this.activeCheckpoint) {
      const snap = this.activeCheckpoint.savedAlive;
      this.crates.forEach((c, i) => {
        c.alive = snap[i];
        c.mesh.visible = snap[i];
        c.mesh.scale.setScalar(1);
        c.fuse = undefined;
        this.restoreTntFace(c);
      });
    } else {
      for (const c of this.crates) {
        c.alive = true;
        c.mesh.visible = true;
        c.mesh.scale.setScalar(1);
        c.fuse = undefined;
        this.restoreTntFace(c);
      }
    }

    for (const e of this.enemies) {
      e.alive = e.arenaWave === undefined; // arena waves wait to be called
      e.group.visible = e.alive;
      e.group.scale.setScalar(1);
      e.group.rotation.set(0, 0, 0);
      e.flungT = undefined;
      e.flungVel = undefined;
      if (e.axis === 'z') e.group.position.z = (e.x0 + e.x1) / 2;
      else e.group.position.x = (e.x0 + e.x1) / 2;
      e.group.position.y = e.group.userData.baseY as number;
      e.dir = 1;
      e.box.makeEmpty();
    }

    for (const st of this.stones) {
      st.mesh.position.set(st.x, st.mesh.position.y, (st.z0 + st.z1) / 2);
      st.dir = 1;
    }

    // Floating wumpa always comes back (the fruit counter reverts with the
    // checkpoint snapshot, so it stays collectable).
    for (const p of this.pickups) {
      p.alive = true;
      p.mesh.visible = true;
    }

    for (const cp of this.checkpoints) {
      cp.mesh.scale.setScalar(1);
      if (hard) {
        cp.active = false;
        cp.mesh.visible = true;
      } else {
        cp.mesh.visible = !cp.active; // consumed checkpoints stay broken
      }
    }

    if (hard) {
      this.activeCheckpoint = null;
      this.currentSpawn.copy(this.spawnPos);
    }

    // Crumble pads grow back whole; the collapse wave re-arms.
    for (const c of this.crumbles) {
      c.state = 'idle';
      c.t = 0;
      c.mesh.visible = true;
      c.mesh.position.copy(c.base);
      c.mesh.rotation.set(0, 0, 0);
    }
    if (this.collapse) {
      this.collapse.active = false;
      this.collapse.frontZ = this.collapse.startZ;
    }

    // Arena: unlock, sink the gates, waves back on standby.
    if (this.arena) {
      const ar = this.arena;
      ar.state = 'idle';
      ar.wave = 0;
      ar.waveT = 0;
      for (const g of ar.gates) {
        const i = this.walls.indexOf(g.box);
        if (i >= 0) this.walls.splice(i, 1);
        g.mesh.position.y = g.downY;
      }
    }

    // Boulder: back to its mark a fair headstart behind wherever you respawn,
    // waiting for you to move before it rolls again.
    if (this.boulder) {
      const b = this.boulder;
      b.active = false;
      b.falling = false;
      b.fallV = 0;
      b.triggerZ = this.currentSpawn.z + 5;
      const bz = this.currentSpawn.z - 39;
      b.st.mesh.position.set(0, this.boulderGroundY(bz) + b.st.r * 0.92, bz);
      b.st.mesh.rotation.set(0, 0, 0);
      b.st.mesh.visible = true;
      b.st.box.makeEmpty();
    }
  }

  // ---------------------------------------------------------------- build --

  private buildTestCourse(): void {
    // Sentinel-Beach morning: saturated jungle greens, sandstone banks, warm
    // gold sand. Textures are near-white, so these tints carry the look.
    const matA = new THREE.MeshLambertMaterial({ color: 0x5da84e });
    const matB = new THREE.MeshLambertMaterial({ color: 0x4c9a44 });
    const matRamp = new THREE.MeshLambertMaterial({ color: 0xd0a86e });
    const matBeach = new THREE.MeshLambertMaterial({ color: 0xf0d092 });
    const matPlaza = new THREE.MeshLambertMaterial({ color: 0xb0a08a }); // rail-yard stonework
    const matFinish = new THREE.MeshLambertMaterial({ color: 0xd0b070 });

    // --- decks (N. Sanity flow: beach -> funnel -> corridors -> finish) ---
    this.slab('beach', 14, -40, 0, 20, matBeach, false, 0, 'sand');

    // --- practice pen: walled rail playground east of the beach ---
    const penMesh = new THREE.Mesh(
      new THREE.BoxGeometry(30, 1, 54),
      this.patterned(new THREE.MeshLambertMaterial({ color: 0x7cb45a }), 30, 54, 'grass'),
    );
    penMesh.position.set(25, -0.5, -13);
    penMesh.name = 'practice pen';
    this.root.add(penMesh);
    this.groundMeshes.push(penMesh);
    // Perimeter walls (also backstop the beach so you can't fall off the start).
    this.wall(15, 15, 52, 1, 0, 5, 0.7); // north, behind spawn: curb-high so the camera sees out
    this.wall(-10.5, -13, 1, 54, 0); // west edge of the beach
    this.wall(40.5, -13, 1, 54, 0); // east edge of the pen
    this.wall(25, -40.5, 30, 1, 0); // south edge of the pen
    this.ramp('funnel slope', -40, 0, -80, -5, 14, matRamp);
    this.jungle('corridor A', -80, -153, -5, 12, matA, { dips: [-112] });
    // gap 1: -153 .. -162 (rebalanced for the slower feel)
    this.jungle('corridor B', -162, -235, -5.5, 12, matB, { dips: [-222] });
    this.ramp('big slope', -235, -5.5, -275, -13, 12, matRamp);
    // gap 2: -275 .. -288 (carry speed)
    this.jungle('corridor C', -288, -350, -13, 12, matA);
    // rail 1 pit: -350 .. -410
    this.jungle('rail 1 landing', -410, -465, -13, 12, matB, { dips: [-445] });
    this.ramp('kicker', -465, -13, -475, -10.2, 12, matRamp);
    // gap 3: -475 .. -488 (kicker lip + drop to the landing)
    this.jungle('corridor D', -488, -575, -13, 12, matA);
    this.crystal(0, -12.4, -530); // the level crystal, dead on the main route
    // rail 2 pit: -575 .. -655
    this.jungle('rail 2 landing', -655, -710, -13.5, 12, matB);
    // Halfpipe: plain terrain under the normal skate/slope physics — carve up
    // the transition, the steepness bleeds your speed, and whatever crests the
    // near-vertical lip converts into (mostly upward) air. The walls
    // approximate a radius-7.3 quarter-pipe; lips are grindable rails.
    this.slab('halfpipe floor', -710, -770, -13.5, 6, matRamp, false, 0, 'pavement');
    const profile: [number, number, number, number][] = [
      // xIn, xOut, yBase, yTop — circle points, steepening toward the lip
      [3.0, 4.8, -13.5, -13.27],
      [4.8, 6.3, -13.27, -12.71],
      [6.3, 7.5, -12.71, -11.95],
      [7.5, 8.7, -11.95, -10.76],
      [8.7, 9.6, -10.76, -9.32],
      [9.6, 10.3, -9.32, -7.4],
    ];
    for (const [xIn, xOut, yBase, yTop] of profile) {
      for (const side of [1, -1]) {
        this.bank(
          'halfpipe wall',
          -710,
          -770,
          side * xIn,
          side * xOut,
          yBase,
          yTop,
          matRamp,
        );
      }
    }
    // rail yard entry deck, then a pit crossed by three parallel rails
    this.slab('rail yard entry', -770, -778, -13.5, 14, matPlaza, true, 0, 'stone');
    // pit: -778 .. -850
    this.slab('rail yard landing', -850, -885, -13.5, 14, matPlaza, true, 0, 'stone');
    this.berms(-850, -885, -13.5, 14);
    this.ramp('final downhill', -885, -13.5, -940, -22, 12, matRamp);
    // gap 4: -940 .. -953 (fast, downhill speed carries you)
    this.jungle('finish run', -953, -1025, -22, 12, matFinish);

    // --- death pit floor (visual only, below killY) ---
    this.pitPlane('lava', -60, 0, -420);

    // --- grind rails ---
    const rail1 = new Rail([
      new THREE.Vector3(0, -12, -346),
      new THREE.Vector3(0, -11, -380),
      new THREE.Vector3(0, -11.8, -414),
    ]);
    // S-curve rail: the balance test.
    const rail2 = new Rail([
      new THREE.Vector3(0, -11.8, -571),
      new THREE.Vector3(2.5, -11, -595),
      new THREE.Vector3(-2.5, -10.5, -620),
      new THREE.Vector3(0, -11.5, -659),
    ]);
    // Halfpipe lip rails along both top edges.
    const lipL = new Rail([new THREE.Vector3(-10.4, -7.2, -712), new THREE.Vector3(-10.4, -7.2, -766)]);
    const lipR = new Rail([new THREE.Vector3(10.4, -7.2, -712), new THREE.Vector3(10.4, -7.2, -766)]);
    // Rail yard: three parallel rails over the pit — jump between them.
    const yardL = new Rail([new THREE.Vector3(-3.5, -12.6, -776), new THREE.Vector3(-3.5, -12.6, -852)]);
    const yardC = new Rail([new THREE.Vector3(0, -12.6, -776), new THREE.Vector3(0, -12.6, -852)]);
    const yardR = new Rail([new THREE.Vector3(3.5, -12.6, -776), new THREE.Vector3(3.5, -12.6, -852)]);
    // Practice pen rails: straight, zigzag, and a high line.
    const penStraight = new Rail([new THREE.Vector3(18, 1, -2), new THREE.Vector3(18, 1, -32)]);
    const penZigzag = new Rail([
      new THREE.Vector3(26, 1.2, 2),
      new THREE.Vector3(30, 1.6, -10),
      new THREE.Vector3(24, 1.4, -22),
      new THREE.Vector3(28, 1.2, -34),
    ]);
    const penHigh = new Rail([new THREE.Vector3(35, 2.8, -4), new THREE.Vector3(35, 2.8, -30)]);

    for (const rail of [rail1, rail2, lipL, lipR, yardL, yardC, yardR, penStraight, penZigzag, penHigh]) {
      this.rails.push(rail);
      this.root.add(rail.object);
    }

    // --- crates ---
    // Beach: one dead-ahead (bump = full stop now: spin it or hop on it).
    this.crate(0, 0, -25);
    this.crate(-3, -5, -95, 'mask');
    this.crate(2.5, -13.5, -872, 'mask');
    this.crate(5, 0, -32);
    this.crate(6.5, 0, -32);
    // Corridor A: full-width wall — spin through, or jump on top to bounce.
    for (let i = 0; i < 9; i++) this.crate(-5.2 + i * 1.3, -5, -100);
    this.crate(-4.5, -5, -132);
    this.crate(-4.5, -3.8, -132); // stack
    this.crate(4.5, -5, -145);
    this.crate(4.5, -3.8, -145); // stack
    // Corridor B: a 4-story step string on the right with crate rewards.
    this.stepBlock(4, -192, 4, 6, -5.5, -3.3);
    this.crate(4, -3.3, -192);
    this.stepBlock(4, -199, 4, 6, -5.5, -1.1);
    this.crate(4, -1.1, -199);
    this.stepBlock(4, -206, 4, 6, -3, 1.1);
    this.crate(4, 1.1, -206);
    this.stepBlock(4, -213, 4, 6, -1, 3.3);
    this.crate(4, 3.3, -213);
    // Corridor B: risky edge lines between the enemies.
    this.crate(5, -5.5, -205);
    this.crate(5, -5.5, -208);
    this.crate(-5, -5.5, -222);
    this.crate(-5, -5.5, -195, 'mask');
    // Corridor C: center cluster + risky pair before the first rail.
    this.crate(-1.5, -13, -315);
    this.crate(0, -13, -315);
    this.crate(1.5, -13, -315);
    this.crate(0, -11.8, -315); // stack
    this.crate(5.2, -13, -330);
    this.crate(5.2, -13, -333);
    this.crate(-5, -13, -322, 'mask');
    // Rail 1 entry flanks.
    this.crate(-2.4, -13, -342);
    this.crate(2.4, -13, -342);
    // Corridor D: second full-width wall + edge stacks.
    for (let i = 0; i < 9; i++) this.crate(-5.2 + i * 1.3, -13, -520);
    this.crate(-4.8, -13, -565);
    this.crate(-4.8, -11.8, -565); // stack
    this.crate(4.8, -13, -565);
    this.crate(4.8, -11.8, -565); // stack
    this.crate(4.8, -13, -545, 'mask');
    // Rail 2 entry flanks.
    this.crate(-2.4, -13, -567);
    this.crate(2.4, -13, -567);
    // Practice pen toys — including a mask row for testing triple-mask mode.
    this.crate(22, 0, -6, 'mask');
    this.crate(25, 0, -6, 'mask');
    this.crate(28, 0, -6, 'mask');
    this.crate(14, 0, -20);
    this.crate(31, 0, -28);
    this.crate(37, 0, -12, 'bouncy');
    this.towerClimb(-8, 0, 4, 34); // staggered tower: four stories, crates up top
    this.stairClimb(10, 0, 7, 13, 7); // flush guarded stair: seven stories, hard to fall off
    // Motion-toolkit sandbox: ride the mover, hop the crumble pads, time the
    // crusher, duck the pendulum guarding the beach-pen doorway.
    this.mover(20, 1.2, -36, 3.2, 3.2, 'x', 3.2, 0.9);
    this.crumblePad(26, 1.2, -30, 3, 3);
    this.crumblePad(26, 1.2, -26, 3, 3);
    this.crusher(24, 0, 8, 4.5, 3, 3.4, 0);
    this.pendulum(14, 7, 8, 5.2, 1.0, 1.7);
    // Halfpipe: bouncy arrow crate launches you up to the lip rails.
    this.crate(-2.2, -13.5, -735, 'bouncy');
    this.crate(0, -13.5, -755); // wumpa snack on the floor line
    this.crate(2.2, -13.5, -745, 'mask');
    // Rail yard: crates and nitro at grind height above the rails.
    // Center rail: two smashables, then a nitro you must jump, then a snack.
    this.crate(0, -12.8, -790);
    this.crate(0, -12.8, -800);
    this.crate(0, -12.8, -815, 'nitro');
    this.crate(0, -12.8, -835);
    // Left rail: nitro early, then safe smashables.
    this.crate(-3.5, -12.8, -795, 'nitro');
    this.crate(-3.5, -12.8, -820);
    this.crate(-3.5, -12.8, -828);
    // Right rail: smashable, nitro, smashable.
    this.crate(3.5, -12.8, -788);
    this.crate(3.5, -12.8, -822, 'nitro');
    this.crate(3.5, -12.8, -840);
    // Corridor D: a big mixed explosive block off the left lane — spin the
    // TNT to pop it (your own pop is safe, the chained nitro blast is NOT).
    this.crate(-2.6, -13, -530, 'tnt');
    this.crate(-2.6, -11.8, -530, 'nitro');
    this.crate(-1.3, -13, -530, 'tnt');
    this.crate(-3.9, -13, -530);
    // Rail yard landing: a bouncy crate off the racing line, and a 2x2 nitro
    // block guarding the left side.
    this.crate(2.5, -13.5, -868, 'bouncy');
    this.crate(-3, -13.5, -866, 'nitro');
    this.crate(-4.3, -13.5, -866, 'nitro');
    this.crate(-3, -12.3, -866, 'nitro');
    this.crate(-4.3, -12.3, -866, 'nitro');
    // Final downhill: offset dodge crates (thread between them at speed).
    this.crate(-2.2, this.downhillY(-905), -905);
    this.crate(2.2, this.downhillY(-925), -925);

    // --- jungle furniture: fallen logs (hop them) + rolling stones ---
    this.log(-6, 1.2, -5, -145); // corridor A, cleared by the gap-1 flight
    this.log(2.0, 5.8, -5.5, -228); // corridor B, right half
    this.log(-5.8, -2.0, -13, -430); // rail 1 landing, left half
    this.log(2.0, 5.8, -13, -560); // corridor D, right half
    this.stone(32, 0, -6, -34, 7); // practice pen patroller
    this.stone(4, -5.5, -200, -230, 6); // corridor B, off the racing line

    // --- ? crates ---
    this.crate(24, 0, -18, 'mystery');
    this.crate(4, -5, -118, 'mystery');
    this.crate(-4, -13, -345, 'mystery');
    this.crate(-3, -13, -558, 'mystery');
    this.crate(5, -13.5, -874, 'mystery');

    // --- enemies (patrolling across the corridor) ---
    this.enemy(-3.5, 3.5, -5, -120, 5);
    this.enemy(-4, 4, -5, -138, 7);
    this.enemy(-4, 4, -5.5, -200, 6);
    this.enemy(-4, 4, -5.5, -215, 8);
    this.enemy(-3, 3, -5.5, -228, 5);
    this.enemy(-4.5, 4.5, -13, -340, 9);
    this.enemy(-4, 4, -13, -445, 7);
    this.enemy(-4.5, 4.5, -13, -540, 8);
    this.enemy(-4, 4, -13, -562, 6);
    this.enemy(-4, 4, -13.5, -690, 7);

    // --- checkpoints ---
    this.checkpoint(-5.5, -185);
    this.checkpoint(-13, -425);
    this.checkpoint(-13.5, -670);
    this.checkpoint(-13.5, -862);

    // --- extra enemy guarding the rail yard landing ---
    this.enemy(-4, 4, -13.5, -876, 6);

    // --- dressing: tropical fringe off the play space (visual only) ---
    // west beach edge + spawn surrounds
    this.palm(-13, 0, -4, 5.6, 0.14);
    this.palm(-15, 0, -19, 4.6, -0.09);
    this.palm(-12.6, 0, -33, 5.9, 0.1);
    this.palm(-14, 0, 9, 4.3, 0.05);
    this.fern(-8.6, 0, 5, 1.2);
    this.fern(-8.9, 0, -13);
    this.broadleaf(-8.3, 0, -34, 1.2);
    this.flowers(-7.6, 0, 12);
    this.flowers(-8.2, 0, -20);
    this.rock(-8.6, 0, 13, 1.4);
    // east of the practice pen
    this.palm(43.5, 0, -2, 5.4, -0.12);
    this.palm(45, 0, -21, 4.6, 0.08);
    this.palm(43.2, 0, -37, 5.7, -0.06);
    this.fern(38.9, 0, 3, 1.1);
    this.flowers(39.4, 0, -37);
    // halfpipe surrounds (lips at x ±10.3 — everything sits outside them)
    this.palm(13.6, -13.5, -716, 5.4, -0.1);
    this.palm(14.6, -13.5, -741, 4.7, 0.12);
    this.palm(13.4, -13.5, -763, 5.8, -0.07);
    this.palm(-13.8, -13.5, -722, 5.2, 0.1);
    this.palm(-14.6, -13.5, -748, 4.5, -0.1);
    this.palm(-13.4, -13.5, -768, 5.6, 0.06);
    this.fern(-12.2, -13.5, -732, 1.3);
    this.fern(12.4, -13.5, -754, 1.2);
    this.rock(12.8, -13.5, -708, 1.6);
    this.rock(-12.6, -13.5, -772, 1.9);
    this.flowers(-12.4, -13.5, -712);
    // rail-yard landing fringe
    this.palm(9.4, -13.5, -858, 4.9, -0.1);
    this.palm(-9.6, -13.5, -876, 5.3, 0.1);
    this.fern(-8.9, -13.5, -856, 1.2);
    // finish deck, behind the gate
    this.palm(4.6, -22, -1014, 4.8, -0.12);
    this.palm(-4.6, -22, -1017, 5.2, 0.1);
    this.broadleaf(7.4, -22, -1008, 1.3);
    this.broadleaf(-7.6, -22, -1010, 1.1);
    this.flowers(6.8, -22, -1013);

    // --- finish gate + end wall ---
    this.finishGate(-22, this.finishZ);
    this.endWall(-22);
  }

  // Deck height along the final downhill ramp (for crate placement).
  private downhillY(z: number): number {
    return THREE.MathUtils.mapLinear(z, -885, -940, -13.5, -22);
  }

  // The "Sideways" level is an L-shaped course now: a corridor intro heading
  // down -Z, a right-angle turn onto a stretch that runs along +X — which the
  // fixed camera therefore sees side-on (real side-scroll platforming, no
  // camera move) — then a second corner back onto -Z for the finish.
  private buildSideways(): void {
    // Coral dusk: vaporwave warmed toward the tropics — lavender concrete,
    // lush turf, hot-pink platforms under a coral horizon band.
    this.wallTint = 0x7a5a9a;
    this.blockTint = 0x8a6aa8;
    this.curbTint = 0xff79c8;
    const matA = new THREE.MeshLambertMaterial({ color: 0xa898c8 });
    const matGround = new THREE.MeshLambertMaterial({ color: 0x62a878 });
    const matPlat = new THREE.MeshLambertMaterial({ color: 0xc87ab0 });
    const matStone = new THREE.MeshLambertMaterial({ color: 0x8a7ab8 });

    this.killY = -20;
    this.finishZ = -104;
    this.endWallZ = -116;
    this.theme = {
      skyTop: '#2a1650',
      skyBottom: '#ff8a70',
      sunColorHex: '#ffc0a0',
      sunU: 0.35,
      sunV: 0.3,
      stars: true, // first stars over a coral horizon
      fog: 0x9a5464, // rose haze to match the coral band
      fogNear: 20,
      fogFar: 120,
      hemiSky: 0xd8a8c0,
      hemiGround: 0x3a2840,
      hemiI: 1.05,
      sunColor: 0xffa888,
      sunI: 1.2,
      particleColor: 0xffc8a8,
      particleWind: [0.8, -0.3, 0.3],
    };

    // the turned stretch: path runs +X between the two corner decks
    this.zones = [{ xMin: 9, xMax: 146, zMin: -62, zMax: -38, dir: 'E' }];

    // cliff backdrop behind the sideways stretch, and the pit below it —
    // a giant stone-block silhouette going violet into the dusk
    const cliff = new THREE.Mesh(
      new THREE.BoxGeometry(200, 60, 1.5),
      this.patterned(new THREE.MeshLambertMaterial({ color: 0x3a2a5c }), 200, 60, 'stone'),
    );
    cliff.position.set(88, 8, -64);
    this.root.add(cliff);
    this.pitPlane('void', -24, 80, -60, 900);

    // corridor intro heading down -Z
    this.slab('start', 16, -12, 0, 10, matA, false);
    this.wall(0, 17, 12, 1, 0, 5, 0.7); // behind spawn: low curb, full-height collider
    this.crate(0, 0, -3, 'mask');
    this.fruitRow(-16, -22, 1.3, 4);
    this.slab('approach', -12, -38, 0, 10, matGround, true, 0, 'grass');
    this.crate(0, 0, -24);
    this.crate(0, 1.2, -24); // stack: spin, bounce, or headbutt
    this.enemy(-3, 3, 0, -31, 4);

    // CORNER 1: the path right-angles east; a wall dead ahead sells the turn
    this.slab('corner', -38, -56, 0, 18, matA, false, 4);
    this.wall(4, -57.5, 18, 1.5, 0);
    this.rock(11.5, 0, -54, 1.8); // tucked corner dressing, off the racing line
    this.rock(-3.8, 0, -55, 1.2);
    this.crystal(70, 0.4, -47); // mid east-stretch, on the main line

    // the sideways stretch: everything below runs along +X at the z band -47
    const CZ = -47;
    this.slabX('ruin walk', 13, 34, 0, 9, matGround, CZ, 'grass');
    this.crate(24, 0, CZ);
    this.crate(24, 1.2, CZ);
    this.crate(24, 2.4, CZ, 'mask'); // crown the stack
    this.fruitRowX(15, 21, 1.3, 4, CZ);
    // ascending floating platforms over the pit
    this.slabX('plat A', 40, 50, 1.5, 9, matPlat, CZ);
    this.crate(45, 1.5, CZ, 'tnt');
    this.slabX('plat B', 56, 66, 3, 9, matPlat, CZ);
    this.crate(58, 3, CZ, 'mystery');
    this.checkpoint(3, CZ, 61);
    // big pit: grind the rail across (fruit lines it), or hop the pads
    const pitRail = new Rail([new THREE.Vector3(66, 3.9, CZ), new THREE.Vector3(90, 3.3, CZ)]);
    this.rails.push(pitRail);
    this.root.add(pitRail.object);
    this.fruitRowX(70, 86, 5.2, 5, CZ);
    this.slabX('pit pad', 74, 80, 3, 9, matPlat, CZ);
    // landing shelf: nitro squats the lane, crab patrols the screen
    this.slabX('mid shelf', 90, 108, 3.2, 9, matGround, CZ, 'grass');
    this.crate(98, 3.2, CZ, 'nitro');
    this.enemy(94, 106, 3.2, CZ, 5);
    // split: bounce the arrow crate up to the high ledge, or run the TNT road
    this.crate(107, 3.2, CZ, 'bouncy');
    this.slabX('high ledge', 110, 128, 8.4, 9, matPlat, CZ);
    this.crate(118, 8.4, CZ, 'mask');
    this.fruitRowX(112, 126, 9.7, 6, CZ);
    this.slabX('low road', 110, 132, 2.8, 9, matStone, CZ, 'stone');
    this.crate(117, 2.8, CZ, 'tnt');
    this.crate(124, 2.8, CZ, 'tnt');
    // rejoin before the second corner
    this.slabX('rejoin', 136, 146, 3.6, 9, matGround, CZ, 'grass');
    this.checkpoint(3.6, CZ, 141);

    // CORNER 2: the path turns back south toward the gate
    this.slab('corner 2', -38, -56, 3.6, 18, matA, false, 152);
    this.wall(161.5, -47, 1.5, 18, 3.6);
    this.rock(158.5, 3.6, -54.5, 1.6);
    this.wall(152, -37, 18, 1.5, 3.6); // north lip of the corner

    // corridor finish at the far end of the L
    this.slab('descent', -56, -70, 3.6, 10, matPlat, true, 152);
    this.slab('step down', -74, -84, 1.6, 10, matPlat, true, 152);
    this.slab('final run', -88, -120, 0, 12, matStone, true, 152, 'stone');
    this.crate(149, 0, -91, 'mask');
    this.crate(152, 0, -94);
    this.crate(152, 1.2, -94);
    this.crate(152, 2.4, -94); // tower: spin through or bounce up
    this.enemy(148, 156, 0, -99, 5);
    this.fruitRow(-90, -96, 1.4, 4, 149);
    this.finishGate(0, this.finishZ, 152);
    this.endWall(0, 152);

    // --- dressing: hanging gardens off the floating decks (visual only) ---
    const VZ = CZ + 4.4; // south lip of the sideways decks, facing the camera
    this.vine(16, -0.05, VZ, 2.4);
    this.vine(30, -0.05, VZ, 3.0);
    this.vine(43, 1.45, VZ, 2.2);
    this.vine(60, 2.95, VZ, 2.6);
    this.vine(77, 2.95, VZ, 2.0);
    this.vine(94, 3.15, VZ, 3.2);
    this.vine(104, 3.15, VZ, 2.4);
    this.vine(114, 8.35, VZ, 3.4);
    this.vine(124, 8.35, VZ, 2.8);
    this.vine(128, 2.75, VZ, 2.2);
    this.vine(140, 3.55, VZ, 2.6);
    // corner decks: planters + blooms tucked against the turn walls
    this.planter(0.5, 0, -54.6);
    this.planter(8.5, 0, -55);
    this.flowers(4.5, 0, -54.8);
    this.fern(-3.6, 0, -54.9, 1.1);
    this.planter(147.5, 3.6, -54.6);
    this.planter(158, 3.6, -52.5);
    this.flowers(154, 3.6, -54.6);
    // finish stretch: dusk palms behind the gate
    this.palm(147.6, 0, -110, 4.9, 0.1);
    this.palm(156.4, 0, -112, 5.3, -0.1);
  }

  // Build-time ground probe: what the terrain actually is at (x, z). Used to
  // seat crates/enemies/checkpoints on wavy floors. Falls back to the given y.
  private floorY(x: number, z: number, fallback: number): number {
    const ray = new THREE.Raycaster(new THREE.Vector3(x, fallback + 6, z), new THREE.Vector3(0, -1, 0), 0, 14);
    const hits = ray.intersectObjects(this.groundMeshes, false);
    if (hits.length === 0) return fallback;
    return Math.abs(hits[0].point.y - fallback) <= 1.1 ? hits[0].point.y : fallback;
  }

  // Wavy jungle floor strip: a heightfield with rolling bumps, optional
  // non-lethal dips to hop, and firm berm walls (with grindable lips) along
  // both sides so you can't fall off sideways. Deterministic per strip.
  private jungle(
    name: string,
    z0: number,
    z1: number,
    baseY: number,
    width: number,
    mat: THREE.Material,
    opts: { amp?: number; dips?: number[]; berms?: boolean; tex?: string } = {},
    cx = 0,
  ): void {
    const depth = Math.abs(z1 - z0);
    const cz = (z0 + z1) / 2;
    const amp = opts.amp ?? 0.35;
    const segZ = Math.max(8, Math.round(depth / 3));
    const segX = 4;
    const geo = new THREE.PlaneGeometry(width, depth, segX, segZ);
    geo.rotateX(-Math.PI / 2);
    const pos = geo.attributes.position as THREE.BufferAttribute;
    const phase = (Math.abs(z0) * 0.37) % (Math.PI * 2); // deterministic
    for (let i = 0; i < pos.count; i++) {
      const lx = pos.getX(i);
      const lz = pos.getZ(i);
      const wz = cz + lz;
      // fade the wave to zero near both strip ends: flush joins, clean jumps
      const edge = Math.min(1, (depth / 2 - Math.abs(lz)) / 5);
      let h =
        amp *
        edge *
        (Math.sin(wz * 0.55 + phase) * 0.55 +
          Math.sin(wz * 0.21 + lx * 0.45 + phase * 1.7) * 0.45 +
          Math.sin(lx * 0.9 + wz * 0.13 + phase * 0.6) * 0.3);
      if (opts.dips) {
        for (const dz of opts.dips) {
          const d = wz - dz;
          h -= 2.4 * Math.exp(-(d * d) / (2 * 2.2 * 2.2)) * edge;
        }
      }
      pos.setY(i, h);
    }
    geo.computeVertexNormals();
    const mesh = new THREE.Mesh(geo, this.patterned(mat, width, depth, opts.tex ?? 'jungle'));
    mesh.position.set(cx, baseY, cz);
    mesh.name = name;
    this.root.add(mesh);
    this.groundMeshes.push(mesh);
    if (opts.berms !== false) this.berms(z0, z1, baseY, width, cx);
  }

  // Firm raised edges: visible ridge + solid collider + a grindable lip rail.
  private berms(z0: number, z1: number, baseY: number, width: number, cx = 0): void {
    const depth = Math.abs(z1 - z0);
    const mat = this.baseMat('berm', this.bermTint, 'jungle', 1, 8);
    for (const side of [-1, 1]) {
      const x = cx + side * (width / 2 - 0.45);
      const berm = new THREE.Mesh(new THREE.BoxGeometry(0.9, 1.5, depth), mat);
      berm.position.set(x, baseY + 0.55, (z0 + z1) / 2);
      this.root.add(berm);
      // Collider matches the VISUAL (1.5 tall). It used to be 3 tall — an
      // invisible extension that swallowed the lip rail above it, so grinding
      // the lip fought the wall push every frame and glitched you off.
      this.walls.push(
        new THREE.Box3().setFromCenterAndSize(
          berm.position.clone(),
          new THREE.Vector3(0.9, 1.5, depth),
        ),
      );
      const lip = new Rail(
        [new THREE.Vector3(x, baseY + 1.35, z0), new THREE.Vector3(x, baseY + 1.35, z1)],
        false,
      );
      this.rails.push(lip);
    }
  }

  // ---------------------------------------------------------- motion kit --

  moverDelta(id: number): THREE.Vector3 {
    return this.movers[id]?.lastDelta ?? new THREE.Vector3();
  }

  touchCrumble(id: number): void {
    const c = this.crumbles[id];
    if (c && c.state === 'idle') {
      c.state = 'shake';
      c.t = 0;
    }
  }

  // Moving platform sliding along one axis on a sine.
  private mover(
    x: number,
    topY: number,
    z: number,
    w: number,
    d: number,
    axis: 'x' | 'y' | 'z',
    amp: number,
    speed: number,
    phase = 0,
  ): void {
    const mesh = new THREE.Mesh(
      new THREE.BoxGeometry(w, 0.8, d),
      this.patterned(
        new THREE.MeshLambertMaterial({ color: 0x8a96c8, emissive: 0x141c38 }),
        w,
        d,
        'metal', // riveted hover-plate
      ),
    );
    mesh.position.set(x, topY - 0.4, z);
    mesh.name = 'moving platform';
    mesh.userData.moverId = this.movers.length;
    this.root.add(mesh);
    this.groundMeshes.push(mesh);
    const axisV = axis === 'x' ? new THREE.Vector3(1, 0, 0) : axis === 'y' ? new THREE.Vector3(0, 1, 0) : new THREE.Vector3(0, 0, 1);
    this.movers.push({
      mesh,
      base: mesh.position.clone(),
      axisV,
      amp,
      speed,
      phase,
      lastDelta: new THREE.Vector3(),
    });
  }

  // Crumble pad: plank that shakes and drops when stood on.
  private crumblePad(x: number, topY: number, z: number, w: number, d: number, regen: number | null = 3): Crumble {
    const mesh = new THREE.Mesh(
      new THREE.BoxGeometry(w, 0.5, d),
      this.patterned(new THREE.MeshLambertMaterial({ color: 0xa8845c }), w, d, 'wood'),
    );
    mesh.position.set(x, topY - 0.25, z);
    mesh.name = 'crumble pad';
    mesh.userData.crumbleId = this.crumbles.length;
    this.root.add(mesh);
    this.groundMeshes.push(mesh);
    const c: Crumble = { mesh, base: mesh.position.clone(), state: 'idle', t: 0, regen };
    this.crumbles.push(c);
    return c;
  }

  // Timed crusher block over the path.
  private crusher(x: number, deckY: number, z: number, w: number, d: number, cycle = 3.2, phase = 0, h = 3, raise = 4.4): void {
    const mesh = new THREE.Mesh(
      new THREE.BoxGeometry(w, h, d),
      this.patterned(new THREE.MeshLambertMaterial({ color: 0x8f8f98 }), w, h, 'stone'),
    );
    const restY = deckY + h / 2 - 0.1;
    mesh.position.set(x, restY + raise, z);
    mesh.name = 'crusher';
    this.root.add(mesh);
    this.crushers.push({
      mesh,
      box: new THREE.Box3(),
      x,
      z,
      w,
      d,
      h,
      restY,
      raise,
      cycle,
      phase,
      crushing: false,
      slammed: false,
    });
  }

  // Pendulum blade swinging across the corridor between two posts.
  private pendulum(x: number, pivotY: number, z: number, len: number, amp = 1.0, speed = 1.6, phase = 0): void {
    const mat = new THREE.MeshLambertMaterial({ color: 0x6a7078 });
    const pivot = new THREE.Group();
    pivot.position.set(x, pivotY, z);
    const arm = new THREE.Mesh(new THREE.BoxGeometry(0.22, len, 0.22), mat);
    arm.position.y = -len / 2;
    pivot.add(arm);
    const bob = new THREE.Mesh(new THREE.SphereGeometry(0.95, 10, 8), new THREE.MeshLambertMaterial({ color: 0x565c66, emissive: 0x16181c }));
    bob.position.y = -len;
    pivot.add(bob);
    this.root.add(pivot);
    // gallows: two posts + a crossbeam so the thing reads at speed
    const postMat = this.baseMat('gallows', 0x8a6a48, 'wood', 1, 2);
    const postH = len + 2.5;
    for (const side of [-1, 1]) {
      const post = new THREE.Mesh(new THREE.BoxGeometry(0.6, postH, 0.6), postMat);
      post.position.set(x + side * (len + 1.2), pivotY - postH / 2 + 0.8, z);
      this.root.add(post);
    }
    const beam = new THREE.Mesh(new THREE.BoxGeometry((len + 1.2) * 2 + 0.6, 0.5, 0.7), postMat);
    beam.position.set(x, pivotY + 0.3, z);
    this.root.add(beam);
    this.pendulums.push({ pivot, len, amp, speed, phase, box: new THREE.Box3(), lastSign: 1 });
  }

  // ---------------------------------------------------------- visual kit --

  // Animated pit floor: scrolling water, lava, or drifting void haze. Water
  // paints soft at 128 (lagoon two-tone + caustics); lava/void stay crisp.
  private pitPlane(kind: 'water' | 'lava' | 'void', y: number, cx: number, cz: number, size = 1400): void {
    const canvas = document.createElement('canvas');
    const S = kind === 'water' ? 128 : 64;
    canvas.width = S;
    canvas.height = S;
    const ctx = canvas.getContext('2d')!;
    let su = 0.004;
    let sv = 0.002;
    if (kind === 'water') {
      ctx.fillStyle = '#2b8a96';
      ctx.fillRect(0, 0, S, S);
      const pool = (px: number, py: number, r: number, color: string): void => {
        for (const ox of [-S, 0, S]) {
          for (const oy of [-S, 0, S]) {
            const bx = px + ox;
            const by = py + oy;
            if (bx < -r || bx > S + r || by < -r || by > S + r) continue;
            const g = ctx.createRadialGradient(bx, by, r * 0.2, bx, by, r);
            g.addColorStop(0, color);
            g.addColorStop(1, 'rgba(255,255,255,0)');
            ctx.fillStyle = g;
            ctx.fillRect(bx - r, by - r, r * 2, r * 2);
          }
        }
      };
      for (let i = 0; i < 12; i++) pool(Math.random() * S, Math.random() * S, 16 + Math.random() * 20, 'rgba(23,105,128,0.5)'); // deep pools
      for (let i = 0; i < 10; i++) pool(Math.random() * S, Math.random() * S, 10 + Math.random() * 16, 'rgba(94,196,196,0.45)'); // shallows
      ctx.strokeStyle = 'rgba(214,246,240,0.4)'; // caustic arcs
      ctx.lineWidth = 2.5;
      for (let i = 0; i < 6; i++) {
        ctx.beginPath();
        const yy = 10 + i * 20;
        ctx.moveTo(0, yy);
        ctx.bezierCurveTo(S * 0.28, yy + 8, S * 0.72, yy - 8, S, yy);
        ctx.stroke();
      }
      for (let i = 0; i < 8; i++) pool(Math.random() * S, Math.random() * S, 3 + Math.random() * 4, 'rgba(232,255,250,0.5)'); // sparkle
      su = 0.008;
      sv = 0.004;
    } else if (kind === 'lava') {
      ctx.fillStyle = '#1c0a08';
      ctx.fillRect(0, 0, 64, 64);
      // sparse thin veins at partial alpha: the chase cam fills the frame
      // with this plane, so crust must dominate and embers stay accents
      ctx.strokeStyle = 'rgba(255,106,34,0.6)';
      ctx.lineWidth = 1;
      for (let i = 0; i < 3; i++) {
        ctx.beginPath();
        ctx.moveTo(Math.random() * 64, 0);
        let px = Math.random() * 64;
        for (let s = 1; s <= 4; s++) {
          px += (Math.random() - 0.5) * 26;
          ctx.lineTo(px, s * 16);
        }
        ctx.stroke();
      }
      ctx.fillStyle = 'rgba(90,38,24,0.7)'; // cooled crust plates
      for (let i = 0; i < 9; i++) {
        ctx.beginPath();
        ctx.ellipse(Math.random() * 64, Math.random() * 64, 6 + Math.random() * 9, 4 + Math.random() * 6, Math.random() * 3, 0, 7);
        ctx.fill();
      }
      ctx.fillStyle = '#ffb050';
      for (let i = 0; i < 6; i++) ctx.fillRect(Math.random() * 62, Math.random() * 62, 2, 2);
      su = 0.0035;
      sv = 0.0018;
    } else {
      ctx.fillStyle = '#0c0a12';
      ctx.fillRect(0, 0, 64, 64);
      ctx.fillStyle = 'rgba(60,50,80,0.5)';
      for (let i = 0; i < 8; i++) {
        ctx.beginPath();
        ctx.ellipse(Math.random() * 64, Math.random() * 64, 8 + Math.random() * 10, 5 + Math.random() * 6, 0, 0, 7);
        ctx.fill();
      }
      su = 0.0016;
      sv = 0.001;
    }
    const tex = new THREE.CanvasTexture(canvas);
    if (kind !== 'water') tex.magFilter = THREE.NearestFilter; // water blends
    tex.wrapS = THREE.RepeatWrapping;
    tex.wrapT = THREE.RepeatWrapping;
    // one tile per ~14u: veins/waves read as surface detail, not spaghetti,
    // even when the tilted boulder-chase camera fills the frame with the pit
    tex.repeat.set(size / 14, size / 14);
    const mesh = new THREE.Mesh(
      new THREE.PlaneGeometry(size, size),
      new THREE.MeshBasicMaterial({ map: tex }),
    );
    mesh.rotation.x = -Math.PI / 2;
    mesh.position.set(cx, y, cz);
    this.root.add(mesh);
    this.scrollTexes.push({ tex, su, sv });
  }

  // Ambient weather: a wrapping cloud of leaves/embers/dust near the player.
  private buildAmbient(): void {
    if (window.location.search.includes('lite')) return; // headless smoke mode
    const N = 130;
    const pos = new Float32Array(N * 3);
    const drift = new Float32Array(N * 3);
    for (let i = 0; i < N; i++) {
      pos[i * 3] = (Math.random() - 0.5) * 68;
      pos[i * 3 + 1] = Math.random() * 20 - 4;
      pos[i * 3 + 2] = (Math.random() - 0.5) * 68;
      drift[i * 3] = (Math.random() - 0.5) * 1.2;
      drift[i * 3 + 1] = (Math.random() - 0.5) * 0.5;
      drift[i * 3 + 2] = (Math.random() - 0.5) * 1.2;
    }
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
    const mat = new THREE.PointsMaterial({
      color: this.theme.particleColor,
      size: 0.28,
      transparent: true,
      opacity: 0.6,
      depthWrite: false,
    });
    const points = new THREE.Points(geo, mat);
    points.frustumCulled = false;
    this.root.add(points);
    this.ambient = { points, drift };
  }

  // A fallen log across (part of) the path: hop it. Solid, never breaks.
  private log(x0: number, x1: number, y: number, z: number): void {
    const len = Math.abs(x1 - x0);
    const geo = new THREE.CylinderGeometry(0.55, 0.55, len, 8);
    geo.rotateZ(Math.PI / 2);
    const mesh = new THREE.Mesh(geo, this.baseMat('log', 0x96683c, 'wood', 2, 1));
    const gy = this.floorY((x0 + x1) / 2, z, y);
    mesh.position.set((x0 + x1) / 2, gy + 0.55, z);
    this.root.add(mesh);
    this.walls.push(
      new THREE.Box3().setFromCenterAndSize(
        mesh.position.clone(),
        new THREE.Vector3(len, 1.1, 1.1),
      ),
    );
  }

  // ------------------------------------------------------- tropical decor --
  // Everything below is pure dressing: added to root only, never a collider,
  // never a groundMesh, so it cannot touch physics or floorY probes. Blades
  // and clusters bake into one buffer each — a whole palm is three meshes.

  // Bake transformed copies of a geometry into one smooth-shaded buffer.
  private static mergeGeos(parts: { geo: THREE.BufferGeometry; m: THREE.Matrix4 }[]): THREE.BufferGeometry {
    const pos: number[] = [];
    const norm: number[] = [];
    const uv: number[] = [];
    const v = new THREE.Vector3();
    const nm = new THREE.Matrix3();
    for (const part of parts) {
      const g = part.geo.index ? part.geo.toNonIndexed() : part.geo;
      nm.getNormalMatrix(part.m);
      const p = g.attributes.position as THREE.BufferAttribute;
      const n = g.attributes.normal as THREE.BufferAttribute;
      const u = g.attributes.uv as THREE.BufferAttribute;
      for (let i = 0; i < p.count; i++) {
        v.fromBufferAttribute(p, i).applyMatrix4(part.m);
        pos.push(v.x, v.y, v.z);
        v.fromBufferAttribute(n, i).applyNormalMatrix(nm).normalize();
        norm.push(v.x, v.y, v.z);
        uv.push(u.getX(i), u.getY(i));
      }
      if (g !== part.geo) g.dispose();
    }
    const out = new THREE.BufferGeometry();
    out.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
    out.setAttribute('normal', new THREE.Float32BufferAttribute(norm, 3));
    out.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2));
    return out;
  }

  // One leaf blade: a narrow plane arched up then drooped, tapered to the
  // tip, running +X from the origin. Smooth vertex normals do the shading.
  private static bladeGeo(len: number, wid: number, droop: number): THREE.BufferGeometry {
    const g = new THREE.PlaneGeometry(len, wid, 4, 1);
    g.rotateX(-Math.PI / 2);
    g.translate(len / 2, 0, 0);
    const p = g.attributes.position as THREE.BufferAttribute;
    for (let i = 0; i < p.count; i++) {
      const t = p.getX(i) / len;
      p.setY(i, len * (0.32 * Math.sin(t * 2.2) - droop * t * t));
      p.setZ(i, p.getZ(i) * (1 - 0.7 * t));
    }
    g.computeVertexNormals();
    return g;
  }

  // Fan `count` copies of a blade around the origin; consumes the blade.
  private static fanGeo(blade: THREE.BufferGeometry, count: number, tilt: number): THREE.BufferGeometry {
    const parts: { geo: THREE.BufferGeometry; m: THREE.Matrix4 }[] = [];
    const e = new THREE.Euler();
    const q = new THREE.Quaternion();
    const one = new THREE.Vector3(1, 1, 1);
    for (let i = 0; i < count; i++) {
      e.set(0, (i / count) * Math.PI * 2 + i * 0.7, tilt + (i % 2) * 0.16);
      q.setFromEuler(e);
      parts.push({
        geo: blade,
        m: new THREE.Matrix4().compose(new THREE.Vector3(0, (i % 3) * 0.05, 0), q, one),
      });
    }
    const out = Level.mergeGeos(parts);
    blade.dispose();
    return out;
  }

  // Soft-painted decor canvases (128px, LinearFilter). Per level, like
  // surfTexCache, so dispose() frees them with everything else level-owned.
  private decorTexCache = new Map<string, THREE.CanvasTexture>();
  private decorTexture(kind: 'leaf' | 'moss'): THREE.CanvasTexture {
    const cached = this.decorTexCache.get(kind);
    if (cached) return cached;
    const S = 128;
    const canvas = document.createElement('canvas');
    canvas.width = S;
    canvas.height = S;
    const ctx = canvas.getContext('2d')!;
    const blob = (x: number, y: number, r: number, color: string): void => {
      const g = ctx.createRadialGradient(x, y, r * 0.15, x, y, r);
      g.addColorStop(0, color);
      g.addColorStop(1, 'rgba(255,255,255,0)');
      ctx.fillStyle = g;
      ctx.fillRect(x - r, y - r, r * 2, r * 2);
    };
    if (kind === 'leaf') {
      // two-tone frond: lit rib band shading darker toward both edges
      const gr = ctx.createLinearGradient(0, 0, 0, S);
      gr.addColorStop(0, '#c6dda2');
      gr.addColorStop(0.5, '#f0f7d6');
      gr.addColorStop(1, '#b9d494');
      ctx.fillStyle = gr;
      ctx.fillRect(0, 0, S, S);
      ctx.strokeStyle = 'rgba(120,150,80,0.35)'; // veins sweeping tipward
      ctx.lineWidth = 2;
      for (let i = 0; i < 9; i++) {
        const y0 = 8 + i * 14;
        ctx.beginPath();
        ctx.moveTo(0, y0);
        ctx.quadraticCurveTo(S * 0.55, y0 + (i % 2 === 0 ? 9 : -9), S, y0);
        ctx.stroke();
      }
      for (let i = 0; i < 6; i++) blob(Math.random() * S, Math.random() * S, 12 + Math.random() * 14, 'rgba(255,255,238,0.22)');
    } else {
      // moss: grey-green stone under soft growth pads (near-white, tintable)
      ctx.fillStyle = '#e2e4d6';
      ctx.fillRect(0, 0, S, S);
      for (let i = 0; i < 14; i++) {
        const v = 200 + Math.floor(Math.random() * 30);
        blob(Math.random() * S, Math.random() * S, 12 + Math.random() * 16, `rgba(${v - 26},${v},${v - 40},0.45)`);
      }
      for (let i = 0; i < 8; i++) blob(Math.random() * S, Math.random() * S, 8 + Math.random() * 10, 'rgba(128,132,118,0.3)');
      for (let i = 0; i < 6; i++) blob(Math.random() * S, Math.random() * S, 5 + Math.random() * 7, 'rgba(255,255,240,0.3)');
    }
    const tex = new THREE.CanvasTexture(canvas);
    this.decorTexCache.set(kind, tex);
    return tex;
  }

  // Shared decor materials — one per role per level, tinted at first call.
  private decorMats = new Map<string, THREE.MeshLambertMaterial>();
  private decorMat(key: string, color: number, tex: 'leaf' | 'moss' | '' = '', double = false): THREE.MeshLambertMaterial {
    let m = this.decorMats.get(key);
    if (m) return m;
    m = new THREE.MeshLambertMaterial({ color });
    if (tex !== '') m.map = this.decorTexture(tex);
    if (double) m.side = THREE.DoubleSide;
    this.decorMats.set(key, m);
    return m;
  }

  // Tropical dressing is pure garnish: '?lite' (headless smoke) skips ALL of
  // it — software rendering can't afford the fill rate, and slow frames
  // desync the suite's wall-clock input scripting.
  private readonly liteDecor = window.location.search.includes('lite');

  // Jak-era palm: bowed trunk, merged frond crown, coconut cluster — three
  // meshes on shared geometry. h scales the whole tree; lean > 0 tips the
  // top toward -x (the trunk's baked bow runs +x, so leans read as S-curves).
  private static palmTrunkGeo: THREE.BufferGeometry | null = null;
  private static palmCrownGeo: THREE.BufferGeometry | null = null;
  private static coconutGeo: THREE.BufferGeometry | null = null;
  private palm(x: number, y: number, z: number, h = 4.8, lean = 0.12): void {
    if (this.liteDecor) return;
    if (!Level.palmTrunkGeo) {
      const g = new THREE.CylinderGeometry(0.13, 0.3, 4.8, 7, 6);
      g.translate(0, 2.4, 0);
      const p = g.attributes.position as THREE.BufferAttribute;
      for (let i = 0; i < p.count; i++) {
        const t = p.getY(i) / 4.8;
        p.setX(i, p.getX(i) + 0.85 * t * t); // bow toward +x
      }
      Level.palmTrunkGeo = g;
    }
    if (!Level.palmCrownGeo) Level.palmCrownGeo = Level.fanGeo(Level.bladeGeo(2.7, 0.62, 0.72), 8, 0.08);
    if (!Level.coconutGeo) {
      const nut = new THREE.SphereGeometry(0.17, 7, 5);
      Level.coconutGeo = Level.mergeGeos([
        { geo: nut, m: new THREE.Matrix4().makeTranslation(0.17, 0, 0.03) },
        { geo: nut, m: new THREE.Matrix4().makeTranslation(-0.1, 0.05, 0.15) },
        { geo: nut, m: new THREE.Matrix4().makeTranslation(-0.06, -0.03, -0.15) },
      ]);
      nut.dispose();
    }
    const g = new THREE.Group();
    g.add(new THREE.Mesh(Level.palmTrunkGeo, this.baseMat('palmTrunk', 0xb08556, 'wood', 1, 3)));
    const two = Math.abs(Math.round(x + z)) % 2 === 0;
    const crown = new THREE.Mesh(
      Level.palmCrownGeo,
      this.decorMat(two ? 'frondA' : 'frondB', two ? 0x3fa04a : 0x5cae3c, 'leaf', true),
    );
    crown.position.set(0.85, 4.72, 0);
    crown.rotation.y = x * 1.7 + z * 0.4; // deterministic twist per tree
    g.add(crown);
    const nuts = new THREE.Mesh(Level.coconutGeo, this.decorMat('coconut', 0x7a5a34));
    nuts.position.set(0.85, 4.45, 0);
    g.add(nuts);
    g.scale.setScalar(h / 4.8);
    g.position.set(x, y, z);
    g.rotation.z = lean;
    this.root.add(g);
  }

  // Fern tuft: six arcing blades in one buffer.
  private static fernGeoCache: THREE.BufferGeometry | null = null;
  private fern(x: number, y: number, z: number, s = 1): void {
    if (this.liteDecor) return;
    if (!Level.fernGeoCache) Level.fernGeoCache = Level.fanGeo(Level.bladeGeo(1.15, 0.3, 0.95), 6, 0.7);
    const m = new THREE.Mesh(Level.fernGeoCache, this.decorMat('fern', 0x4a9a40, 'leaf', true));
    m.scale.setScalar(s);
    m.rotation.y = x * 2.1 + z * 0.6;
    m.position.set(x, y + 0.02, z);
    this.root.add(m);
  }

  // Broadleaf plant: five wide paddles. Key/color per role (jungle, succulent).
  private static leafGeoCache: THREE.BufferGeometry | null = null;
  private broadleaf(x: number, y: number, z: number, s = 1, key = 'leafy', color = 0x3e8e46): void {
    if (this.liteDecor) return;
    if (!Level.leafGeoCache) Level.leafGeoCache = Level.fanGeo(Level.bladeGeo(1.5, 0.95, 0.5), 5, 0.5);
    const m = new THREE.Mesh(Level.leafGeoCache, this.decorMat(key, color, 'leaf', true));
    m.scale.setScalar(s);
    m.rotation.y = x * 1.9 + z * 0.8;
    m.position.set(x, y + 0.02, z);
    this.root.add(m);
  }

  // Hanging vine spill: nine down-turned blades in one buffer; len scales it.
  private static vineGeoCache: THREE.BufferGeometry | null = null;
  private vine(x: number, y: number, z: number, len = 2.6): void {
    if (this.liteDecor) return;
    if (!Level.vineGeoCache) {
      const blade = Level.bladeGeo(1.0, 0.3, 0.85);
      const parts: { geo: THREE.BufferGeometry; m: THREE.Matrix4 }[] = [];
      const q = new THREE.Quaternion();
      for (let i = 0; i < 9; i++) {
        q.setFromEuler(new THREE.Euler(0, i * 2.4, -0.95 - (i % 3) * 0.3));
        parts.push({
          geo: blade,
          m: new THREE.Matrix4().compose(
            new THREE.Vector3(0, -i * 0.34, 0),
            q.clone(),
            new THREE.Vector3().setScalar(1 - i * 0.05),
          ),
        });
      }
      Level.vineGeoCache = Level.mergeGeos(parts);
      blade.dispose();
    }
    const m = new THREE.Mesh(Level.vineGeoCache, this.decorMat('vine', 0x55a848, 'leaf', true));
    m.scale.set(0.9, len / 3.4, 0.9);
    m.rotation.y = x * 1.3 + z;
    m.position.set(x, y, z);
    this.root.add(m);
  }

  // Flower dots: a bright six-berry cluster, one buffer, coral/orange/pink.
  private static flowerGeoCache: THREE.BufferGeometry | null = null;
  private flowers(x: number, y: number, z: number): void {
    if (this.liteDecor) return;
    if (!Level.flowerGeoCache) {
      const bud = new THREE.SphereGeometry(0.09, 6, 5);
      const parts: { geo: THREE.BufferGeometry; m: THREE.Matrix4 }[] = [];
      for (let i = 0; i < 6; i++) {
        const a = (i / 6) * Math.PI * 2;
        parts.push({
          geo: bud,
          m: new THREE.Matrix4().makeTranslation(
            Math.cos(a) * (0.12 + (i % 3) * 0.09),
            0.1 + (i % 3) * 0.09,
            Math.sin(a) * (0.12 + (i % 2) * 0.11),
          ),
        });
      }
      Level.flowerGeoCache = Level.mergeGeos(parts);
      bud.dispose();
    }
    const keys = [['bloomA', 0xff5a48], ['bloomB', 0xff9a2e], ['bloomC', 0xf84a8e]] as const;
    const [key, color] = keys[Math.abs(Math.round(x * 3 + z * 5)) % 3];
    const m = new THREE.Mesh(Level.flowerGeoCache, this.decorMat(key, color));
    m.position.set(x, y, z);
    this.root.add(m);
  }

  // Deck planter: terracotta pot with a fern spilling out.
  private static potGeo: THREE.CylinderGeometry | null = null;
  private planter(x: number, y: number, z: number): void {
    if (this.liteDecor) return;
    if (!Level.potGeo) Level.potGeo = new THREE.CylinderGeometry(0.52, 0.38, 0.6, 9);
    const pot = new THREE.Mesh(Level.potGeo, this.decorMat('pot', 0xc86a42));
    pot.position.set(x, y + 0.3, z);
    this.root.add(pot);
    this.fern(x, y + 0.55, z, 0.9);
  }

  // Rounded mossy boulder: squashed sphere, soft shading. Visual only.
  private static rockGeo: THREE.SphereGeometry | null = null;
  private rock(x: number, y: number, z: number, s = 1.6): void {
    if (!Level.rockGeo) Level.rockGeo = new THREE.SphereGeometry(1, 10, 8);
    const m = new THREE.Mesh(Level.rockGeo, this.decorMat('mossRock', 0xa8b090, 'moss'));
    m.scale.set(s, s * 0.6, s * 0.82);
    m.rotation.y = x * 1.3 + z * 0.7; // deterministic tumble
    m.position.set(x, y + s * 0.4, z);
    this.root.add(m);
  }

  // Rolling stone hazard patrolling the course between z0 (near) and z1 (far).
  private stone(x: number, y: number, z0: number, z1: number, speed: number, r = 0.9): void {
    const mesh = new THREE.Mesh(
      new THREE.SphereGeometry(r, 10, 8),
      this.baseMat('rock', 0xa08a70, 'dirt', 2, 2),
    );
    mesh.position.set(x, this.floorY(x, (z0 + z1) / 2, y) + r, (z0 + z1) / 2);
    this.root.add(mesh);
    this.stones.push({ mesh, box: new THREE.Box3(), x, z0: Math.max(z0, z1), z1: Math.min(z0, z1), dir: 1, speed, r });
  }

  // Flat deck. z0 is the near (higher z) edge, z1 the far edge, topY the
  // surface height the player rides on. cx offsets the deck laterally.
  private slab(
    name: string,
    z0: number,
    z1: number,
    topY: number,
    width: number,
    mat: THREE.Material,
    grindEdges = true,
    cx = 0,
    tex = 'checker',
  ): THREE.Mesh {
    const depth = Math.abs(z1 - z0);
    const mesh = new THREE.Mesh(
      new THREE.BoxGeometry(width, 1, depth),
      this.patterned(mat, width, depth, tex),
    );
    mesh.position.set(cx, topY - 0.5, (z0 + z1) / 2);
    mesh.name = name;
    this.root.add(mesh);
    this.groundMeshes.push(mesh);
    this.curbs(z0, z1, topY, width, cx);
    if (grindEdges) this.edgeRails(z0, topY, z1, topY, width, cx);
    return mesh;
  }

  // The curb lines themselves are grindable: invisible rails along both deck
  // edges, THPS ledge-style.
  private edgeRails(z0: number, y0: number, z1: number, y1: number, width: number, cx = 0): void {
    for (const side of [-1, 1]) {
      const x = cx + side * (width / 2 - 0.15);
      const rail = new Rail(
        [new THREE.Vector3(x, y0 + 0.05, z0), new THREE.Vector3(x, y1 + 0.05, z1)],
        false,
      );
      this.rails.push(rail);
    }
  }

  // Flat deck running along X (for turned, side-scrolling stretches).
  // x0 < x1; depth is the deck's size along z, centered on cz.
  private slabX(
    name: string,
    x0: number,
    x1: number,
    topY: number,
    depth: number,
    mat: THREE.Material,
    cz: number,
    tex = 'checker',
  ): THREE.Mesh {
    const len = Math.abs(x1 - x0);
    const mesh = new THREE.Mesh(
      new THREE.BoxGeometry(len, 1, depth),
      this.patterned(mat, len, depth, tex),
    );
    mesh.position.set((x0 + x1) / 2, topY - 0.5, cz);
    mesh.name = name;
    this.root.add(mesh);
    this.groundMeshes.push(mesh);
    return mesh;
  }

  private fruitRowX(x0: number, x1: number, y: number, n: number, z: number): void {
    for (let i = 0; i < n; i++) {
      this.pickup(THREE.MathUtils.lerp(x0, x1, n === 1 ? 0 : i / (n - 1)), y, z);
    }
  }

  // Sloped deck between two top-surface edge lines (z0,y0) -> (z1,y1).
  private ramp(name: string, z0: number, y0: number, z1: number, y1: number, width: number, mat: THREE.Material, cx = 0, tex = 'stone'): void {
    const dy = y1 - y0;
    const dz = z1 - z0;
    const len = Math.hypot(dy, dz);
    const dyn = dy / len;
    const dzn = dz / len;
    // Box local +Z under rotation.x = a maps to (0, -sin a, cos a). The course
    // runs toward -Z, so align local +Z with the *reverse* travel direction.
    const alpha = Math.atan2(dyn, -dzn);
    const mesh = new THREE.Mesh(
      new THREE.BoxGeometry(width, 1, len),
      this.patterned(mat, width, len, tex),
    );
    mesh.rotation.x = alpha;
    const normal = new THREE.Vector3(0, -dzn, dyn);
    mesh.position
      .set(cx, (y0 + y1) / 2, (z0 + z1) / 2)
      .addScaledVector(normal, -0.5);
    mesh.name = name;
    this.root.add(mesh);
    this.groundMeshes.push(mesh);
  }

  // Arbitrary sloped ground quad (a→b→c→d, roughly planar) — the building
  // block for curved bowl corners that no axis-aligned helper can express.
  // Winding is fixed so the face normal points UP: the ground ray reads face
  // normals, and a downward one would invert the slope physics.
  private quadFace(
    name: string,
    a: [number, number, number],
    b: [number, number, number],
    c: [number, number, number],
    d: [number, number, number],
    mat: THREE.Material,
    tex = 'pavement',
  ): void {
    const va = new THREE.Vector3(...a);
    const vb = new THREE.Vector3(...b);
    const vc = new THREE.Vector3(...c);
    const vd = new THREE.Vector3(...d);
    const n = vb.clone().sub(va).cross(vc.clone().sub(va));
    const verts = n.y >= 0 ? [va, vb, vc, va, vc, vd] : [va, vc, vb, va, vd, vc];
    const pos = new Float32Array(verts.length * 3);
    const uv = new Float32Array(verts.length * 2);
    verts.forEach((v, i) => {
      pos.set([v.x, v.y, v.z], i * 3);
      uv.set([v.x / 3, v.z / 3], i * 2);
    });
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
    geo.setAttribute('uv', new THREE.BufferAttribute(uv, 2));
    geo.computeVertexNormals();
    const mesh = new THREE.Mesh(geo, this.patterned(mat, 6, 6, tex));
    mesh.name = name;
    this.root.add(mesh);
    this.groundMeshes.push(mesh);
  }

  // Side-banked surface (halfpipe wall): top face runs from (xIn, yBase) up to
  // (xOut, yTop), constant along z. Box rotated about Z so a downward ray sees
  // the slope.
  private bank(
    name: string,
    z0: number,
    z1: number,
    xIn: number,
    xOut: number,
    yBase: number,
    yTop: number,
    mat: THREE.Material,
    tex = 'pavement',
  ): THREE.Mesh {
    const dx = xOut - xIn;
    const dy = yTop - yBase;
    const len = Math.hypot(dx, dy);
    const alpha = Math.atan2(dy, dx); // local +X maps to (cos a, sin a, 0)
    const depth = Math.abs(z1 - z0);
    const mesh = new THREE.Mesh(new THREE.BoxGeometry(len, 1, depth), this.patterned(mat, len, depth, tex));
    mesh.rotation.z = alpha;
    const normal = new THREE.Vector3(-dy / len, dx / len, 0);
    if (normal.y < 0) normal.negate();
    mesh.position
      .set((xIn + xOut) / 2, (yBase + yTop) / 2, (z0 + z1) / 2)
      .addScaledVector(normal, -0.5);
    mesh.name = name;
    this.root.add(mesh);
    this.groundMeshes.push(mesh);
    return mesh;
  }

  // Solid barrier: visual box + collider. Bump = full stop, never breaks.
  // visH: the VISIBLE wall height — the collider always stands the full h.
  // Spawn-side back walls use a low visH curb so the trailing camera sees
  // over them instead of eating a face full of bricks.
  private wall(cx: number, cz: number, w: number, d: number, baseY: number, h = 5, visH = h): void {
    const mesh = new THREE.Mesh(
      new THREE.BoxGeometry(w, visH, d),
      this.baseMat('wall', this.wallTint, 'stone', 3, 1),
    );
    mesh.position.set(cx, baseY + visH / 2, cz);
    this.root.add(mesh);
    this.walls.push(
      new THREE.Box3().setFromCenterAndSize(
        new THREE.Vector3(cx, baseY + h / 2, cz),
        new THREE.Vector3(w, h, d),
      ),
    );
  }

  // Solid raised platform: walkable top, solid sides (jump up onto it).
  private stepBlock(x: number, z: number, w: number, d: number, baseY: number, topY: number): void {
    const h = topY - baseY;
    const mesh = new THREE.Mesh(
      new THREE.BoxGeometry(w, h, d),
      this.baseMat('step', this.blockTint, 'stone', 2, 2),
    );
    mesh.position.set(x, baseY + h / 2, z);
    mesh.name = 'step block';
    this.root.add(mesh);
    this.groundMeshes.push(mesh);
    // Side collider stops a hair below the top so standing on it doesn't shove.
    this.walls.push(
      new THREE.Box3(
        new THREE.Vector3(x - w / 2, baseY - 1, z - d / 2),
        new THREE.Vector3(x + w / 2, topY - 0.2, z + d / 2),
      ),
    );
  }

  // Crash-style temple stair: staggered solid columns strung into a real
  // multi-story climb (each step ~2.6 up, small hop between). Returns where
  // the top block ends so the course can continue at height.
  private towerClimb(
    zStart: number,
    baseY: number,
    stories: number,
    xCenter = 0,
  ): { endZ: number; topY: number } {
    let y = baseY;
    let z = zStart;
    for (let i = 0; i < stories; i++) {
      y += 2.6;
      const x = xCenter + (i % 2 === 0 ? -2.2 : 2.2);
      this.stepBlock(x, z - 2.5, 5, 5, y - 9, y);
      if (i % 2 === 1 || i === stories - 1) this.crate(x, y, z - 2.5);
      z -= 7;
    }
    return { endZ: z, topY: y };
  }

  // Flush staircase: steps butt directly against each other (no gap to fall
  // through) with guard rails along both sides — the safe way to gain real
  // height. Bonk the riser, hop up, repeat.
  private stairClimb(
    zStart: number,
    baseY: number,
    stories: number,
    xCenter = 0,
    width = 8,
  ): { endZ: number; topY: number } {
    const depth = 5;
    let y = baseY;
    let z = zStart;
    for (let i = 0; i < stories; i++) {
      y += 2.6;
      this.stepBlock(xCenter, z - depth / 2, width, depth, y - 10, y);
      // guard rails so you can't slip off the sides
      for (const side of [-1, 1]) {
        this.wall(xCenter + side * (width / 2 + 0.3), z - depth / 2, 0.6, depth, y, 1.6);
      }
      if (i % 2 === 1) this.crate(xCenter, y, z - depth / 2);
      z -= depth;
    }
    return { endZ: z, topY: y };
  }

  // Painted edge strips so deck borders read at speed. Visual only — the
  // per-level accent tint (THPS painted-curb energy) is set by each builder.
  private curbs(z0: number, z1: number, topY: number, width: number, cx = 0): void {
    const mat = this.baseMat('curb', this.curbTint);
    const depth = Math.abs(z1 - z0);
    for (const side of [-1, 1]) {
      const curb = new THREE.Mesh(new THREE.BoxGeometry(0.35, 0.22, depth), mat);
      curb.position.set(cx + side * (width / 2 - 0.2), topY + 0.11, (z0 + z1) / 2);
      this.root.add(curb);
    }
  }

  private crate(x: number, deckY: number, z: number, kind?: 'nitro' | 'bouncy' | 'tnt' | 'mask' | 'mystery'): void {
    const size = 0.96; // uniform crate size (was 1.2; checkpoints matched at 1.4)
    let mat: THREE.MeshLambertMaterial;
    if (kind === 'nitro') {
      mat = new THREE.MeshLambertMaterial({ color: 0xffffff, emissive: 0x0c3a16, map: this.nitroTexture() });
    } else if (kind === 'bouncy') {
      mat = new THREE.MeshLambertMaterial({ color: 0xffffff, map: this.arrowTexture() });
    } else if (kind === 'tnt') {
      mat = new THREE.MeshLambertMaterial({ color: 0xffffff, map: this.tntTexture('TNT') });
    } else if (kind === 'mask') {
      mat = new THREE.MeshLambertMaterial({ color: 0xffffff, map: this.maskTexture() });
    } else if (kind === 'mystery') {
      mat = new THREE.MeshLambertMaterial({ color: 0xffffff, map: this.mysteryTexture() });
    } else {
      mat = new THREE.MeshLambertMaterial({ color: 0xffffff, map: this.plainTexture() });
    }
    // Seat the box: on top of an existing crate at this spot (stacks), else
    // on the actual terrain (wavy jungle floors), else at the given height.
    let base = deckY;
    let onStack = false;
    for (const other of this.crates) {
      const p = other.mesh.position;
      if (Math.abs(p.x - x) < 0.6 && Math.abs(p.z - z) < 0.6) {
        const top = p.y + size / 2;
        if (Math.abs(deckY - top) < 0.9) {
          base = top;
          onStack = true;
        }
      }
    }
    if (!onStack) base = this.floorY(x, z, deckY);
    const mesh = new THREE.Mesh(new THREE.BoxGeometry(size, size, size), mat);
    mesh.position.set(x, base + size / 2, z);
    mesh.userData.baseY = mesh.position.y;
    if (!kind) mesh.rotation.y = 0.15;
    this.root.add(mesh);
    const box = new THREE.Box3().setFromCenterAndSize(
      mesh.position.clone(),
      new THREE.Vector3(size, size, size),
    );
    this.crates.push({
      mesh,
      box,
      alive: true,
      nitro: kind === 'nitro',
      bouncy: kind === 'bouncy',
      tnt: kind === 'tnt',
      mask: kind === 'mask',
      mystery: kind === 'mystery',
    });
    // Classic Crash formation: every arrow crate carries a breakable fruit
    // crate floating above it — bounce off the arrow, headbutt the reward.
    if (kind === 'bouncy') {
      this.crate(x, base + size + 3.2, z);
    }
  }

  // Classic PSX crate face: light planked wood, beveled frame, corner studs.
  // Every crate variant draws its icon over this base (drawn per reference
  // rips of the original series' crate sheet, recreated by hand).
  private crateWood(ctx: CanvasRenderingContext2D, brace: boolean): void {
    ctx.fillStyle = '#b5762f';
    ctx.fillRect(0, 0, 32, 32);
    // plank seams + grain flecks
    ctx.fillStyle = '#94601f';
    ctx.fillRect(0, 10, 32, 1);
    ctx.fillRect(0, 21, 32, 1);
    ctx.fillRect(6, 5, 4, 1);
    ctx.fillRect(20, 15, 5, 1);
    ctx.fillRect(9, 26, 5, 1);
    if (brace) {
      // X brace
      ctx.strokeStyle = '#8a5a22';
      ctx.lineWidth = 3;
      ctx.beginPath();
      ctx.moveTo(3, 3);
      ctx.lineTo(29, 29);
      ctx.moveTo(29, 3);
      ctx.lineTo(3, 29);
      ctx.stroke();
    }
    // beveled frame + corner studs
    ctx.fillStyle = '#8a5a22';
    ctx.fillRect(0, 0, 32, 3);
    ctx.fillRect(0, 29, 32, 3);
    ctx.fillRect(0, 0, 3, 32);
    ctx.fillRect(29, 0, 3, 32);
    ctx.fillStyle = '#d19b4a';
    ctx.fillRect(0, 0, 32, 1);
    ctx.fillRect(0, 0, 1, 32);
    ctx.fillStyle = '#6e4517';
    for (const [cx, cy] of [[1, 1], [27, 1], [1, 27], [27, 27]] as const) {
      ctx.fillRect(cx, cy, 4, 4);
    }
  }

  // Outlined icon text, chunky PSX style.
  private crateLabel(
    ctx: CanvasRenderingContext2D,
    text: string,
    px: number,
    fill: string,
    outline: string,
    x = 16,
    y = 18,
  ): void {
    ctx.font = `bold ${px}px monospace`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillStyle = outline;
    for (const [ox, oy] of [[-1, 0], [1, 0], [0, -1], [0, 1]] as const) {
      ctx.fillText(text, x + ox, y + oy);
    }
    ctx.fillStyle = fill;
    ctx.fillText(text, x, y);
  }

  private makeTex(draw: (ctx: CanvasRenderingContext2D) => void): THREE.CanvasTexture {
    const canvas = document.createElement('canvas');
    canvas.width = 32;
    canvas.height = 32;
    draw(canvas.getContext('2d')!);
    const tex = new THREE.CanvasTexture(canvas);
    tex.magFilter = THREE.NearestFilter;
    return tex;
  }

  // Plain wooden crate: planks + X brace, nothing else.
  private plainTexture(): THREE.CanvasTexture {
    if (!this.plainTex) this.plainTex = this.makeTex((ctx) => this.crateWood(ctx, true));
    return this.plainTex;
  }

  // Big orange '?' on plain wood.
  private mysteryTexture(): THREE.CanvasTexture {
    if (!this.mysteryTex)
      this.mysteryTex = this.makeTex((ctx) => {
        this.crateWood(ctx, false);
        this.crateLabel(ctx, '?', 22, '#ff8c1a', '#5a2d08', 16, 17);
      });
    return this.mysteryTex;
  }

  // Aku mask on wood: orange face, feathered headdress band, heavy brows.
  private maskTexture(): THREE.CanvasTexture {
    if (!this.maskTex)
      this.maskTex = this.makeTex((ctx) => {
        this.crateWood(ctx, false);
        // feathers
        for (const [fx, fc] of [[8, '#c03a2a'], [13, '#3a9a4a'], [18, '#c03a2a']] as const) {
          ctx.fillStyle = fc;
          ctx.fillRect(fx, 3, 4, 5);
        }
        // face
        ctx.fillStyle = '#e89040';
        ctx.fillRect(8, 7, 16, 20);
        ctx.fillStyle = '#5a2d12';
        ctx.fillRect(8, 7, 16, 3); // brow band
        ctx.fillRect(10, 13, 4, 5); // eyes
        ctx.fillRect(18, 13, 4, 5);
        ctx.fillRect(11, 22, 10, 3); // grin
        ctx.fillStyle = '#ffffff';
        ctx.fillRect(12, 23, 2, 1); // teeth glints
        ctx.fillRect(17, 23, 2, 1);
      });
    return this.maskTex;
  }

  // Classic red TNT face; lit fuses swap it for big 3 / 2 / 1 digits.
  private tntTexture(label: string): THREE.CanvasTexture {
    const cached = this.tntTexCache.get(label);
    if (cached) return cached;
    const tex = this.makeTex((ctx) => {
      ctx.fillStyle = '#c23a30';
      ctx.fillRect(0, 0, 32, 32);
      ctx.fillStyle = '#8f2018';
      ctx.fillRect(0, 10, 32, 1);
      ctx.fillRect(0, 21, 32, 1);
      ctx.fillRect(0, 0, 32, 3);
      ctx.fillRect(0, 29, 32, 3);
      ctx.fillRect(0, 0, 3, 32);
      ctx.fillRect(29, 0, 3, 32);
      ctx.fillStyle = '#e06a52';
      ctx.fillRect(0, 0, 32, 1);
      ctx.fillRect(0, 0, 1, 32);
      if (label.length > 1) this.crateLabel(ctx, label, 12, '#ffffff', '#3a0c08', 16, 17);
      else this.crateLabel(ctx, label, 24, '#ffe84a', '#3a0c08', 16, 17);
    });
    this.tntTexCache.set(label, tex);
    return tex;
  }

  // Green NITRO: jittery goo crate, hazard-striped frame.
  private nitroTexture(): THREE.CanvasTexture {
    if (!this.nitroTex)
      this.nitroTex = this.makeTex((ctx) => {
        ctx.fillStyle = '#2fae44';
        ctx.fillRect(0, 0, 32, 32);
        ctx.fillStyle = '#1c7a2c';
        ctx.fillRect(0, 0, 32, 3);
        ctx.fillRect(0, 29, 32, 3);
        ctx.fillRect(0, 0, 3, 32);
        ctx.fillRect(29, 0, 3, 32);
        // hazard notches on the frame
        ctx.fillStyle = '#0e4a18';
        for (let x = 0; x < 32; x += 8) {
          ctx.fillRect(x, 0, 4, 3);
          ctx.fillRect(x + 4, 29, 4, 3);
        }
        ctx.fillStyle = '#7ce890';
        ctx.fillRect(0, 0, 32, 1);
        ctx.fillRect(0, 0, 1, 32);
        this.crateLabel(ctx, 'NITRO', 9, '#eafff0', '#0e4a18', 16, 16);
        this.crateLabel(ctx, '!', 12, '#ffe84a', '#0e4a18', 16, 25);
      });
    return this.nitroTex;
  }

  // Chunky green up-arrow on wood (the super-bounce crate).
  private arrowTexture(): THREE.CanvasTexture {
    if (!this.arrowTex)
      this.arrowTex = this.makeTex((ctx) => {
        this.crateWood(ctx, false);
        ctx.fillStyle = '#1c6a28';
        ctx.beginPath();
        ctx.moveTo(16, 4);
        ctx.lineTo(28, 17);
        ctx.lineTo(21, 17);
        ctx.lineTo(21, 29);
        ctx.lineTo(11, 29);
        ctx.lineTo(11, 17);
        ctx.lineTo(4, 17);
        ctx.closePath();
        ctx.fill();
        ctx.fillStyle = '#3fae4a';
        ctx.beginPath();
        ctx.moveTo(16, 6);
        ctx.lineTo(26, 16);
        ctx.lineTo(20, 16);
        ctx.lineTo(20, 28);
        ctx.lineTo(12, 28);
        ctx.lineTo(12, 16);
        ctx.lineTo(6, 16);
        ctx.closePath();
        ctx.fill();
      });
    return this.arrowTex;
  }

  // Blue checkpoint crate with the classic 'C'.
  private cpTexture(): THREE.CanvasTexture {
    if (!this.cpTex)
      this.cpTex = this.makeTex((ctx) => {
        ctx.fillStyle = '#4aa0e0';
        ctx.fillRect(0, 0, 32, 32);
        ctx.fillStyle = '#2a6ba0';
        ctx.fillRect(0, 10, 32, 1);
        ctx.fillRect(0, 21, 32, 1);
        ctx.fillRect(0, 0, 32, 3);
        ctx.fillRect(0, 29, 32, 3);
        ctx.fillRect(0, 0, 3, 32);
        ctx.fillRect(29, 0, 3, 32);
        ctx.fillStyle = '#9fd4ff';
        ctx.fillRect(0, 0, 32, 1);
        ctx.fillRect(0, 0, 1, 32);
        this.crateLabel(ctx, 'C', 22, '#ffffff', '#123049', 16, 17);
      });
    return this.cpTex;
  }

  // -------------------------------------------- warp-room VFX + relics --

  // Diagonal magenta/white bands; scrolled through the crystal's UVs every
  // frame = cheap fake chrome (texture-coordinate animation, no reflections).
  private chromeTexture(): THREE.CanvasTexture {
    if (this.chromeTex) return this.chromeTex;
    const canvas = document.createElement('canvas');
    canvas.width = 32;
    canvas.height = 32;
    const ctx = canvas.getContext('2d')!;
    for (let y = 0; y < 32; y++) {
      for (let x = 0; x < 32; x++) {
        const band = (Math.sin((x + y * 2) * 0.55) + Math.sin((x - y) * 0.23)) * 0.5;
        const t = band * 0.5 + 0.5;
        const r = Math.floor(150 + 105 * t);
        const g = Math.floor(40 + 160 * t * t);
        const b = Math.floor(200 + 55 * t);
        ctx.fillStyle = `rgb(${r},${g},${b})`;
        ctx.fillRect(x, y, 1, 1);
      }
    }
    this.chromeTex = new THREE.CanvasTexture(canvas);
    this.chromeTex.magFilter = THREE.NearestFilter;
    this.chromeTex.wrapS = THREE.RepeatWrapping;
    this.chromeTex.wrapT = THREE.RepeatWrapping;
    return this.chromeTex;
  }

  // Sharp 4-point twinkle for the additive sparkle billboards. Drawn WHITE so
  // a per-sprite material colour tints it (purple crystal glints, cyan gem).
  private glintTexture(): THREE.CanvasTexture {
    if (this.glintTex) return this.glintTex;
    const canvas = document.createElement('canvas');
    canvas.width = 64;
    canvas.height = 64;
    const ctx = canvas.getContext('2d')!;
    ctx.clearRect(0, 0, 64, 64);
    // long thin diamond arms: taper from the hot centre to sharp points
    const arm = (len: number, w: number, a: number) => {
      ctx.fillStyle = `rgba(255,255,255,${a})`;
      ctx.beginPath(); // vertical spindle
      ctx.moveTo(32, 32 - len);
      ctx.lineTo(32 + w, 32);
      ctx.lineTo(32, 32 + len);
      ctx.lineTo(32 - w, 32);
      ctx.closePath();
      ctx.fill();
      ctx.beginPath(); // horizontal spindle
      ctx.moveTo(32 - len, 32);
      ctx.lineTo(32, 32 - w);
      ctx.lineTo(32 + len, 32);
      ctx.lineTo(32, 32 + w);
      ctx.closePath();
      ctx.fill();
    };
    arm(30, 6, 0.5);
    arm(30, 2.5, 0.9);
    // white-hot core
    const cg = ctx.createRadialGradient(32, 32, 0, 32, 32, 9);
    cg.addColorStop(0, 'rgba(255,255,255,1)');
    cg.addColorStop(1, 'rgba(255,255,255,0)');
    ctx.fillStyle = cg;
    ctx.fillRect(20, 20, 24, 24);
    this.glintTex = new THREE.CanvasTexture(canvas);
    this.glintTex.magFilter = THREE.NearestFilter;
    return this.glintTex;
  }

  // The big collection flash: a blazing white core with long anamorphic rays
  // (the lens-flare starbursts in the reference). White; tinted per burst.
  private flareTexture(): THREE.CanvasTexture {
    if (this.flareTex) return this.flareTex;
    const canvas = document.createElement('canvas');
    canvas.width = 128;
    canvas.height = 128;
    const ctx = canvas.getContext('2d')!;
    ctx.clearRect(0, 0, 128, 128);
    ctx.translate(64, 64);
    // eight rays, cardinals long, diagonals shorter — additive so they streak
    ctx.fillStyle = 'rgba(255,255,255,0.85)';
    for (let k = 0; k < 8; k++) {
      const len = k % 2 === 0 ? 62 : 34;
      const w = k % 2 === 0 ? 3.5 : 2;
      ctx.save();
      ctx.rotate((k * Math.PI) / 4);
      ctx.beginPath();
      ctx.moveTo(0, -6);
      ctx.lineTo(w, 0);
      ctx.lineTo(0, len);
      ctx.lineTo(-w, 0);
      ctx.closePath();
      ctx.fill();
      ctx.restore();
    }
    // fat radial core
    const g = ctx.createRadialGradient(0, 0, 0, 0, 0, 30);
    g.addColorStop(0, 'rgba(255,255,255,1)');
    g.addColorStop(0.4, 'rgba(255,255,255,0.7)');
    g.addColorStop(1, 'rgba(255,255,255,0)');
    ctx.fillStyle = g;
    ctx.beginPath();
    ctx.arc(0, 0, 30, 0, Math.PI * 2);
    ctx.fill();
    this.flareTex = new THREE.CanvasTexture(canvas);
    this.flareTex.magFilter = THREE.LinearFilter;
    return this.flareTex;
  }

  // Soft round halo — the pink/cyan glow that hangs around the pickups. White,
  // tinted by the sprite material.
  private glowTexture(): THREE.CanvasTexture {
    if (this.glowTex) return this.glowTex;
    const canvas = document.createElement('canvas');
    canvas.width = 64;
    canvas.height = 64;
    const ctx = canvas.getContext('2d')!;
    const g = ctx.createRadialGradient(32, 32, 0, 32, 32, 32);
    g.addColorStop(0, 'rgba(255,255,255,0.62)');
    g.addColorStop(0.3, 'rgba(255,255,255,0.3)');
    g.addColorStop(1, 'rgba(255,255,255,0)');
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, 64, 64);
    this.glowTex = new THREE.CanvasTexture(canvas);
    this.glowTex.magFilter = THREE.LinearFilter;
    return this.glowTex;
  }

  // Flat additive ring; pulses + spins in update (radial-wave magic circle).
  private glowRing(x: number, y: number, z: number, r: number, color: number, upright = false): THREE.Mesh {
    const mesh = new THREE.Mesh(
      new THREE.RingGeometry(r * 0.62, r, 20),
      new THREE.MeshBasicMaterial({
        color,
        transparent: true,
        opacity: 0.45,
        blending: THREE.AdditiveBlending,
        side: THREE.DoubleSide,
        depthWrite: false,
      }),
    );
    mesh.position.set(x, y, z);
    if (!upright) mesh.rotation.x = -Math.PI / 2;
    this.root.add(mesh);
    this.glowRings.push({ mesh, phase: Math.random() * 6, speed: 1.6 + Math.random(), base: 1 });
    return mesh;
  }

  private spawnGlint(
    x: number,
    y: number,
    z: number,
    scale = 1,
    opts: {
      tex?: THREE.CanvasTexture;
      color?: number;
      vx?: number;
      vy?: number;
      vz?: number;
      life?: number;
      pop?: boolean;
    } = {},
  ): void {
    let slot = this.glints.find((g) => g.life <= 0);
    if (!slot && this.glints.length < 48) {
      const spr = new THREE.Sprite(
        new THREE.SpriteMaterial({
          map: this.glintTexture(),
          transparent: true,
          blending: THREE.AdditiveBlending,
          depthWrite: false,
        }),
      );
      spr.visible = false;
      this.root.add(spr);
      slot = { spr, life: 0, max: 0.6, vx: 0, vy: 0, vz: 0, spin: 0, scale: 1, pop: false };
      this.glints.push(slot);
    }
    if (!slot) return;
    const mat = slot.spr.material as THREE.SpriteMaterial;
    mat.map = opts.tex ?? this.glintTexture();
    mat.color.setHex(opts.color ?? 0xffffff);
    mat.needsUpdate = true;
    slot.max = opts.life ?? 0.4 + Math.random() * 0.45;
    slot.life = slot.max;
    slot.vx = opts.vx ?? 0;
    slot.vy = opts.vy ?? 0.4 + Math.random() * 0.8;
    slot.vz = opts.vz ?? 0;
    slot.spin = (Math.random() - 0.5) * 4;
    slot.scale = scale;
    slot.pop = opts.pop ?? false;
    slot.spr.position.set(x, y, z);
    slot.spr.visible = true;
  }

  // COLLECTION GLIMMER (Crash relic pickup): a blazing white-cored starburst at
  // the pickup, then a shower of small purple/cyan twinkles that fan outward
  // and fade — recreated from the reference capture.
  private glimmerBurst(pos: THREE.Vector3, hue: number): void {
    // central flares: big flash that pops up then shrinks fast
    for (let i = 0; i < 3; i++) {
      this.spawnGlint(
        pos.x + (Math.random() - 0.5) * 0.8,
        pos.y + (Math.random() - 0.5) * 0.8,
        pos.z + (Math.random() - 0.5) * 0.8,
        7 + Math.random() * 3,
        { tex: this.flareTexture(), color: i === 0 ? 0xffffff : hue, vy: 0.3, life: 0.45, pop: true },
      );
    }
    // dispersing sparkle shower: fan outward across a wide radius, staggered
    for (let i = 0; i < 26; i++) {
      const ang = Math.random() * Math.PI * 2;
      const spd = 2.5 + Math.random() * 6;
      this.spawnGlint(
        pos.x + (Math.random() - 0.5) * 1.5,
        pos.y + (Math.random() - 0.2) * 1.5,
        pos.z + (Math.random() - 0.5) * 1.5,
        1.1 + Math.random() * 1.4,
        {
          color: hue,
          vx: Math.cos(ang) * spd,
          vz: Math.sin(ang) * spd,
          vy: 1 + Math.random() * 3,
          life: 0.5 + Math.random() * 0.7,
        },
      );
    }
  }

  // ---- collectible geometry (reference-accurate) ----------------------------

  // Tall purple crystal shard: a stretched hexagonal bipyramid with a hot inner
  // core streak and a pink glow halo (Crash coloured-gem look).
  private crystalMesh(scale = 1): THREE.Group {
    const g = new THREE.Group();
    const R = 0.55 * scale;
    const H = 1.05 * scale; // half-height of each pyramid
    const shellMat = new THREE.MeshPhongMaterial({
      color: 0x9a34d8,
      emissive: 0x50128f,
      emissiveIntensity: 0.4,
      specular: 0xffffff,
      shininess: 70,
      flatShading: true,
      transparent: true,
      opacity: 0.92,
    });
    // two 6-sided cones base-to-base = bipyramid; flat facets catch the sun's
    // specular per-face and it sweeps as the crystal spins (the canned glint)
    const top = new THREE.Mesh(new THREE.ConeGeometry(R, H, 6), shellMat);
    top.position.y = H / 2;
    g.add(top);
    const bot = new THREE.Mesh(new THREE.ConeGeometry(R, H, 6), shellMat);
    bot.rotation.z = Math.PI;
    bot.position.y = -H / 2;
    g.add(bot);
    // hot inner streak: a slim bright bipyramid, additive
    const coreMat = new THREE.MeshBasicMaterial({
      color: 0xffcbff,
      transparent: true,
      opacity: 0.7,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
    });
    const ctop = new THREE.Mesh(new THREE.ConeGeometry(R * 0.42, H * 0.95, 6), coreMat);
    ctop.position.y = H / 2;
    g.add(ctop);
    const cbot = new THREE.Mesh(new THREE.ConeGeometry(R * 0.42, H * 0.95, 6), coreMat);
    cbot.rotation.z = Math.PI;
    cbot.position.y = -H / 2;
    g.add(cbot);
    // pink glow halo (billboard), brightest low
    const halo = new THREE.Sprite(
      new THREE.SpriteMaterial({
        map: this.glowTexture(),
        transparent: true,
        blending: THREE.AdditiveBlending,
        depthWrite: false,
      }),
    );
    (halo.material as THREE.SpriteMaterial).color.setHex(0xd83af0);
    halo.scale.set(2.9 * scale, 3.8 * scale, 1);
    halo.position.y = -0.2 * scale;
    g.add(halo);
    return g;
  }

  // Clear brilliant-cut diamond: octagonal table + crown facets over a pointed
  // pavilion, silvery-white with a cool glow (Crash clear-gem look).
  private gemMesh(scale = 1): THREE.Group {
    const g = new THREE.Group();
    const girdle = 0.72 * scale;
    const table = 0.4 * scale;
    const crownH = 0.42 * scale;
    const pavH = 0.8 * scale;
    const mat = new THREE.MeshPhongMaterial({
      color: 0xdcefff,
      emissive: 0x243a52,
      emissiveIntensity: 0.25,
      specular: 0xffffff,
      shininess: 100,
      flatShading: true,
      transparent: true,
      opacity: 0.86,
    });
    // crown: 8-sided frustum, wide girdle at the bottom, narrow table on top
    const crown = new THREE.Mesh(new THREE.CylinderGeometry(table, girdle, crownH, 8), mat);
    crown.position.y = crownH / 2;
    g.add(crown);
    // pavilion: 8-sided cone to a point below the girdle
    const pav = new THREE.Mesh(new THREE.ConeGeometry(girdle, pavH, 8), mat);
    pav.rotation.z = Math.PI; // apex down
    pav.position.y = -pavH / 2;
    g.add(pav);
    // faint white sparkle core
    const core = new THREE.Mesh(
      new THREE.OctahedronGeometry(0.3 * scale),
      new THREE.MeshBasicMaterial({
        color: 0xffffff,
        transparent: true,
        opacity: 0.4,
        blending: THREE.AdditiveBlending,
        depthWrite: false,
      }),
    );
    core.scale.y = 1.4;
    g.add(core);
    const halo = new THREE.Sprite(
      new THREE.SpriteMaterial({
        map: this.glowTexture(),
        transparent: true,
        blending: THREE.AdditiveBlending,
        depthWrite: false,
      }),
    );
    // faint cool aura only — the reference gem is clean silver, no glow blob
    (halo.material as THREE.SpriteMaterial).color.setHex(0x5c86a8);
    halo.scale.set(1.7 * scale, 1.6 * scale, 1);
    g.add(halo);
    return g;
  }

  // The crystal: Crash 2/3 style pickup on the main route. Faceted octahedron
  // wearing the scrolling chrome, magic ring at its base, glints in update.
  private crystal(x: number, y: number, z: number): void {
    const g = this.crystalMesh(1);
    g.position.set(x, y + 1.05, z);
    g.userData.baseY = y + 1.05;
    this.root.add(g);
    this.glowRing(x, y + 0.12, z, 1.5, 0xd06aff);
    this.crystalPickup = {
      group: g,
      box: new THREE.Box3().setFromCenterAndSize(
        new THREE.Vector3(x, y + 1.0, z),
        new THREE.Vector3(2.0, 2.8, 2.0),
      ),
      collected: false,
    };
    this.crystalPlaced = true;
  }

  collectCrystal(): void {
    const c = this.crystalPickup;
    if (!c) return;
    c.collected = true;
    c.group.visible = false;
    this.glimmerBurst(c.group.position, 0xc83af0);
  }

  // All boxes broken: the gem materializes over the player, THPS-photo style.
  awardGem(pos: THREE.Vector3): void {
    if (this.gemG) return;
    const g = this.gemMesh(1);
    g.position.set(pos.x, pos.y + 3.2, pos.z);
    g.userData.baseY = pos.y + 3.2;
    this.root.add(g);
    this.gemG = g;
    // no magic ring on the gem — the reference is a clean spinning diamond
    this.glimmerBurst(g.position, 0x9fe0ff);
  }

  // The finish gate mirrors your relic haul: earned icons light up and spin.
  setRelics(crystal: boolean, gem: boolean): void {
    if (crystal === this.relics.crystal && gem === this.relics.gem) return;
    this.relics = { crystal, gem };
    const style = (icon: THREE.Mesh | null, earned: boolean, emissive: number): void => {
      if (!icon) return;
      const m = icon.material as THREE.MeshLambertMaterial;
      if (earned) {
        m.color.set(0xffffff);
        m.emissive.set(emissive);
        m.emissiveIntensity = 0.85;
        m.opacity = 1;
      } else {
        m.color.set(0x2a2f3a);
        m.emissive.set(0x000000);
        m.opacity = 0.4;
      }
    };
    style(this.gateCrystalIcon, crystal, 0xc03fe0);
    style(this.gateGemIcon, gem, 0x20c8e0);
  }

  // 256-entry blue -> cyan -> white palette for the plasma (palette cycling:
  // the field is static-ish maths; the LOOKUP slides, so it always moves).
  private plasmaSetup(): void {
    if (this.plasmaTex) return;
    const pal = new Uint8Array(256 * 3);
    for (let i = 0; i < 256; i++) {
      const t = i / 255;
      const w = Math.sin(t * Math.PI); // bright mid-band
      pal[i * 3] = Math.floor(18 + 90 * t * t + 60 * w * t);
      pal[i * 3 + 1] = Math.floor(40 + 170 * t);
      pal[i * 3 + 2] = Math.floor(120 + 135 * Math.min(1, t * 1.4));
    }
    this.plasmaPal = pal;
    const canvas = document.createElement('canvas');
    canvas.width = 48;
    canvas.height = 48;
    this.plasmaCtx = canvas.getContext('2d')!;
    this.plasmaData = this.plasmaCtx.createImageData(48, 48);
    this.plasmaTex = new THREE.CanvasTexture(canvas);
    this.plasmaTex.magFilter = THREE.NearestFilter; // chunky PS1 texels
  }

  // Classic demoscene plasma: three drifting sine bands + one radial ripple,
  // summed (interference), palette-cycled. 48x48, every third frame.
  private updatePlasma(): void {
    if (!this.plasmaTex || !this.plasmaData || !this.plasmaCtx || !this.plasmaPal) return;
    const t = this.vfxT;
    const d = this.plasmaData.data;
    const pal = this.plasmaPal;
    let i = 0;
    for (let y = 0; y < 48; y++) {
      for (let x = 0; x < 48; x++) {
        const dx = x - 24;
        const dy = y - 24;
        const v =
          Math.sin(x * 0.32 + t * 1.3) +
          Math.sin(y * 0.27 - t * 0.9) +
          Math.sin((x + y) * 0.17 + t * 0.6) +
          Math.sin(Math.sqrt(dx * dx + dy * dy) * 0.55 - t * 2.2);
        const idx = (Math.floor((v + 4) * 31.9 + t * 26) & 255) * 3;
        d[i] = pal[idx];
        d[i + 1] = pal[idx + 1];
        d[i + 2] = pal[idx + 2];
        d[i + 3] = 255;
        i += 4;
      }
    }
    this.plasmaCtx.putImageData(this.plasmaData, 0, 0);
    this.plasmaTex.needsUpdate = true;
  }

  // Per-frame VFX tick: plasma, chrome scroll, bobs, spins, rings, glints.
  private updateVfx(dt: number): void {
    this.vfxT += dt;
    this.plasmaFrame++;
    if (this.plasmaFrame % 3 === 0) this.updatePlasma();
    // fake chrome = UV scroll + a sine wobble (texture-coordinate distortion),
    // so the bands swim liquidly across the facets instead of gliding straight
    if (this.chromeTex) {
      this.chromeTex.offset.x = (this.vfxT * 0.34 + Math.sin(this.vfxT * 2.7) * 0.08) % 1;
      this.chromeTex.offset.y = (this.vfxT * 0.11 + Math.cos(this.vfxT * 1.9) * 0.06) % 1;
    }
    const bobSpin = (g: THREE.Group | null, rate: number): void => {
      if (!g || !g.visible) return;
      g.position.y = (g.userData.baseY as number) + Math.sin(this.vfxT * 2.1) * 0.22;
      g.rotation.y += rate * dt;
    };
    if (this.crystalPickup && !this.crystalPickup.collected) bobSpin(this.crystalPickup.group, 1.7);
    bobSpin(this.gemG, 2.4);
    // gate relic icons: earned ones spin and bob, ghosts sit still
    if (this.gateCrystalIcon && this.relics.crystal) this.gateCrystalIcon.rotation.y += 2.2 * dt;
    if (this.gateGemIcon && this.relics.gem) this.gateGemIcon.rotation.y += 2.2 * dt;
    // magic rings: radial pulse + slow spin
    for (const r of this.glowRings) {
      const p = 1 + 0.16 * Math.sin(this.vfxT * r.speed + r.phase);
      r.mesh.scale.setScalar(p);
      r.mesh.rotation.z += 0.5 * dt;
      (r.mesh.material as THREE.MeshBasicMaterial).opacity = 0.3 + 0.2 * Math.sin(this.vfxT * r.speed * 1.3 + r.phase);
    }
    // ambient glints drip off whatever magic is live (tinted to the pickup)
    this.glintT -= dt;
    if (this.glintT <= 0) {
      this.glintT = 0.2;
      const anchors: { p: THREE.Vector3; c: number }[] = [];
      if (this.crystalPickup && !this.crystalPickup.collected)
        anchors.push({ p: this.crystalPickup.group.position, c: 0xd863f2 });
      if (this.gemG) anchors.push({ p: this.gemG.position, c: 0xaee6ff });
      if (this.gateCrystalIcon && this.relics.crystal)
        anchors.push({ p: this.gateCrystalIcon.position, c: 0xd863f2 });
      if (this.gateGemIcon && this.relics.gem) anchors.push({ p: this.gateGemIcon.position, c: 0xaee6ff });
      if (anchors.length > 0) {
        const a = anchors[Math.floor(Math.random() * anchors.length)];
        this.spawnGlint(
          a.p.x + (Math.random() - 0.5) * 1.6,
          a.p.y + (Math.random() - 0.5) * 1.9,
          a.p.z + (Math.random() - 0.5) * 1.6,
          0.9 + Math.random() * 0.5,
          { color: a.c, vy: 0.5 + Math.random() * 0.7 },
        );
      }
    }
    for (const g of this.glints) {
      if (g.life <= 0) continue;
      g.life -= dt;
      if (g.life <= 0) {
        g.spr.visible = false;
        continue;
      }
      // drift outward + up; the shower decelerates as it fans (air drag feel)
      g.spr.position.x += g.vx * dt;
      g.spr.position.y += g.vy * dt;
      g.spr.position.z += g.vz * dt;
      const drag = Math.max(0, 1 - 2.2 * dt);
      g.vx *= drag;
      g.vz *= drag;
      const prog = 1 - g.life / g.max;
      // pop flares grow fast then shrink; sparkles ease in-out; both fade at end
      const k = g.pop ? (prog < 0.25 ? prog / 0.25 : 1 - (prog - 0.25) / 0.75) : Math.sin(prog * Math.PI);
      const s = g.scale * k;
      g.spr.scale.set(s, s, 1);
      (g.spr.material as THREE.SpriteMaterial).rotation += g.spin * dt;
    }
  }

  private enemyGroup(): THREE.Group {
    const group = new THREE.Group();
    const body = new THREE.Mesh(
      new THREE.BoxGeometry(1, 0.9, 1.1),
      new THREE.MeshLambertMaterial({ color: 0xa03a3a }),
    );
    body.position.y = 0.55;
    group.add(body);
    const eyeMat = new THREE.MeshBasicMaterial({ color: 0xffffff });
    for (const side of [-0.22, 0.22]) {
      const eye = new THREE.Mesh(new THREE.BoxGeometry(0.14, 0.14, 0.1), eyeMat);
      eye.position.set(side, 0.75, 0.56);
      group.add(eye);
    }
    this.root.add(group);
    return group;
  }

  private enemy(x0: number, x1: number, deckY: number, z: number, speed: number): void {
    const group = this.enemyGroup();
    // snap to real ground (wavy jungle floors), then remember it for resets
    const gy = this.floorY((x0 + x1) / 2, z, deckY);
    group.position.set((x0 + x1) / 2, gy, z);
    group.userData.baseY = gy;
    this.enemies.push({ group, box: new THREE.Box3(), alive: true, x0, x1, dir: 1, speed });
  }

  // Floating collectable wumpa.
  private pickup(x: number, y: number, z: number): void {
    const mesh = new THREE.Mesh(
      Level.pickupGeo,
      new THREE.MeshLambertMaterial({ color: 0xff9028, emissive: 0x4a2006 }),
    );
    mesh.position.set(x, y, z);
    mesh.userData.baseY = y;
    this.root.add(mesh);
    this.pickups.push({
      mesh,
      alive: true,
      box: new THREE.Box3().setFromCenterAndSize(
        mesh.position.clone(),
        new THREE.Vector3(1.2, 1.5, 1.2),
      ),
    });
  }

  private fruitRow(z0: number, z1: number, y: number, n: number, x = 0): void {
    for (let i = 0; i < n; i++) {
      this.pickup(x, y, THREE.MathUtils.lerp(z0, z1, n === 1 ? 0 : i / (n - 1)));
    }
  }

  // A distinct blue box that sits on the deck like a normal crate. Spin or
  // stomp it (bumping is a wall) to bank the checkpoint; its trigger matches
  // the box, so it can be dodged rather than being an unmissable gate.
  private checkpoint(deckY: number, z: number, x = 0): void {
    const size = 0.96; // same footprint as every other crate now
    const gy = this.floorY(x, z, deckY);
    const mesh = new THREE.Mesh(
      new THREE.BoxGeometry(size, size, size),
      new THREE.MeshLambertMaterial({ color: 0xffffff, emissive: 0x123049, map: this.cpTexture() }),
    );
    mesh.position.set(x, gy + size / 2, z);
    this.root.add(mesh);
    const box = new THREE.Box3().setFromCenterAndSize(
      mesh.position.clone(),
      new THREE.Vector3(size, size, size),
    );
    this.checkpoints.push({
      mesh,
      box,
      active: false,
      spawnPos: new THREE.Vector3(x, gy + 0.1, z),
      savedAlive: [],
      savedCratesBroken: 0,
      savedFruit: 0,
      savedMasks: 0,
      savedPoints: 0,
    });
  }

  // Level 4, "The Gauntlet": everything the toolkit can do in one long run —
  // jungle approach, terraced climb with a scaffold-rail bypass, a high ridge
  // with real gaps, a kicker launch, a halfpipe alley, a right-angle turn
  // across floating ruins, a downhill slalom, a rail canyon, a crate maze,
  // vine bridges, and a rolling-stone finale. Roughly 1.5x the Test Course.
  private buildGauntlet(): void {
    // Terracotta canyon dusk: scrub greens against warm clay rock.
    this.wallTint = 0xa86048;
    this.blockTint = 0xb07050;
    this.curbTint = 0xe89a4a;
    this.bermTint = 0x6a5a34;
    const matSand = new THREE.MeshLambertMaterial({ color: 0xd8b276 });
    const matJungle = new THREE.MeshLambertMaterial({ color: 0x71a048 });
    const matJungle2 = new THREE.MeshLambertMaterial({ color: 0x62933f });
    const matStone = new THREE.MeshLambertMaterial({ color: 0xa87a5c });
    const matRamp = new THREE.MeshLambertMaterial({ color: 0xba8a56 });
    const matPlat = new THREE.MeshLambertMaterial({ color: 0xb09a6e });
    const matWood = new THREE.MeshLambertMaterial({ color: 0xa87848 });
    const matFinish = new THREE.MeshLambertMaterial({ color: 0xc9a86a });

    this.killY = -34;
    this.finishZ = -1200;
    this.endWallZ = -1212;
    this.theme = {
      skyTop: '#4a1c22',
      skyBottom: '#ffa060',
      sunColorHex: '#ffd890',
      sunU: 0.72,
      sunV: 0.3,
      stars: false,
      fog: 0xc06a40, // canyon dust — distance goes to warm terracotta
      fogNear: 25,
      fogFar: 155,
      hemiSky: 0xf0b088,
      hemiGround: 0x50241a,
      hemiI: 1.0,
      sunColor: 0xffb868,
      sunI: 1.5,
      particleColor: 0xffd0a0,
      particleWind: [1.1, -0.5, 0.3],
    };

    // river far below everything
    this.pitPlane('water', -44, 70, -620, 1900);

    // --- A: walled start + jungle approach ---------------------------------
    this.slab('start', 14, -30, 0, 20, matSand, false, 0, 'sand');
    this.wall(0, 15, 22, 1, 0, 5, 0.7); // behind spawn: low curb, full-height collider
    this.wall(-10.5, -8, 1, 46, 0);
    this.wall(10.5, -8, 1, 46, 0);
    this.crate(3, 0, -12);
    this.crate(4.5, 0, -12);
    this.crate(3.75, 1.2, -12); // little pyramid
    this.crate(-4, 0, -20, 'mask');
    this.fruitRow(-6, -24, 1.3, 5, -1);
    this.jungle('approach A', -30, -95, 0, 12, matJungle, { dips: [-60] });
    this.log(1.5, 5.5, 0, -70);
    this.crate(-3, 0, -48);
    this.crate(2, 0, -82, 'mystery');
    this.enemy(-3.5, 3.5, 0, -55, 5);
    this.enemy(-4, 4, 0, -85, 6);
    this.jungle('approach B', -95, -150, 0, 12, matJungle2, { dips: [-130] });
    for (let i = 0; i < 8; i++) this.crate(-4.6 + i * 1.3, 0, -115); // crate fence
    this.crate(4.8, 0, -115, 'tnt'); // pop the fence from the flank
    this.stone(-3, 0, -100, -145, 6);
    this.crate(-4, 0, -140, 'bouncy');
    this.checkpoint(0, -143);

    // --- B: terraced climb (0 -> +9) with a scaffold-rail bypass ------------
    this.ramp('terrace ramp 1', -150, 0, -175, 3, 12, matRamp);
    this.jungle('terrace 1', -175, -215, 3, 12, matJungle);
    this.crate(0, 3, -190);
    this.crate(0, 4.2, -190); // stack
    this.crate(-4.5, 3, -205, 'nitro');
    this.log(2, 5.8, 3, -183);
    this.enemy(-4, 4, 3, -198, 6);
    this.ramp('terrace ramp 2', -215, 3, -240, 6, 12, matRamp);
    this.jungle('terrace 2', -240, -280, 6, 12, matJungle2, { dips: [-262] });
    this.crate(2.6, 6, -256);
    this.crate(3.9, 6, -256, 'tnt');
    this.crate(5.2, 6, -256);
    this.crate(-5, 6, -268, 'mask');
    this.enemy(-4, 4, 6, -250, 5);
    this.enemy(-3.5, 3.5, 6, -270, 7);
    this.checkpoint(6, -276);
    this.ramp('terrace ramp 3', -280, 6, -300, 9, 10, matRamp);
    const scaffold = new Rail([
      new THREE.Vector3(5, 1.4, -152),
      new THREE.Vector3(5, 4.6, -215),
      new THREE.Vector3(5, 7.6, -280),
      new THREE.Vector3(5, 10.4, -302),
    ]);
    this.rails.push(scaffold);
    this.root.add(scaffold.object);

    // --- C: high ridge with two gaps and a bypass rail ----------------------
    this.jungle('ridge A', -300, -347, 9, 11, matJungle);
    this.checkpoint(9, -308);
    this.crate(-3, 9, -320);
    this.crate(-3, 10.2, -320); // stack
    this.fruitRow(-315, -338, 10.3, 5);
    // gap: -347 .. -355 (rebalanced)
    this.jungle('ridge B', -355, -400, 9, 11, matJungle2, { dips: [-380] });
    this.stone(3.2, 9, -362, -396, 8);
    this.crate(-4, 9, -370, 'mystery');
    this.log(-5.4, -2, 9, -388);
    const bypass = new Rail([new THREE.Vector3(-4, 10.2, -396), new THREE.Vector3(-4, 10.4, -421)]);
    this.rails.push(bypass);
    this.root.add(bypass.object);
    // gap: -400 .. -416 (long: carry speed, grind the bypass line, or trust
    // the crumble pads — they won't hold long)
    this.crumblePad(1.5, 9, -404, 4, 4.6);
    this.crumblePad(-1.5, 9, -410.5, 4, 4.6);
    this.jungle('ridge C', -416, -450, 9, 11, matJungle);
    this.enemy(-4, 4, 9, -432, 7);
    this.crate(4.5, 9, -440, 'mask');
    this.crate(-2, 9, -425);
    this.crate(2, 9, -425);
    this.checkpoint(9, -445, -3.5);

    // --- D: kicker launch off the ridge, 8 units down to the pipe deck ------
    this.ramp('ridge kicker', -450, 9, -460, 11, 10, matRamp);
    // flight gap: -460 .. -470 (rebalanced — kicker + 8u drop still clears it)
    this.fruitRow(-464, -469, 13.5, 3);
    this.jungle('drop landing', -470, -540, 3, 13, matJungle2, { dips: [-518] });
    this.crate(-5, 3, -500, 'mystery');
    this.crate(5, 3, -520, 'bouncy');
    this.stepBlock(5, -527, 4, 6, 3, 8.2);
    this.crate(5, 8.2, -527, 'mask'); // bounce up for it
    this.enemy(-4, 4, 3, -510, 6);
    this.checkpoint(3, -534, -4);
    // elevator up to a lookout shelf — drop onto the halfpipe lip from it
    this.mover(-5, 8.5, -528, 3.4, 3.4, 'y', 4.6, 0.55);
    this.slab('lookout', -534, -539, 13, 5, matPlat, false, -5, 'stone');
    this.crate(-5, 13, -537, 'mystery');
    this.fruitRow(-535, -538, 14.3, 2, -5);

    // --- E: halfpipe alley ---------------------------------------------------
    const hpBase = 3;
    this.slab('gauntlet pipe', -540, -595, hpBase, 6, matStone, false, 0, 'stone');
    const profile: [number, number, number, number][] = [
      [3.0, 4.8, 0, 0.23],
      [4.8, 6.3, 0.23, 0.79],
      [6.3, 7.5, 0.79, 1.55],
      [7.5, 8.7, 1.55, 2.74],
      [8.7, 9.6, 2.74, 4.18],
      [9.6, 10.3, 4.18, 6.1],
    ];
    for (const [xIn, xOut, dBase, dTop] of profile) {
      for (const side of [1, -1]) {
        this.bank(
          'pipe wall',
          -540,
          -595,
          side * xIn,
          side * xOut,
          hpBase + dBase,
          hpBase + dTop,
          matRamp,
        );
      }
    }
    const lipL = new Rail([
      new THREE.Vector3(-10.4, hpBase + 6.3, -542),
      new THREE.Vector3(-10.4, hpBase + 6.3, -593),
    ]);
    const lipR = new Rail([
      new THREE.Vector3(10.4, hpBase + 6.3, -542),
      new THREE.Vector3(10.4, hpBase + 6.3, -593),
    ]);
    for (const r of [lipL, lipR]) {
      this.rails.push(r);
      this.root.add(r.object);
    }
    this.crate(-2.2, hpBase, -560, 'bouncy');
    this.crate(2.2, hpBase, -575);
    this.crystal(0, hpBase + 0.4, -567); // pipe-alley centre: ride through it
    this.pickup(-7, hpBase + 3.4, -555);
    this.pickup(7, hpBase + 3.4, -580);
    this.slab('pipe exit', -595, -615, hpBase, 14, matStone, true, 0, 'stone');

    // --- F: the turn — floating ruins running east ---------------------------
    this.slab('corner east', -615, -635, 3, 20, matPlat, false, 4, 'stone');
    this.wall(4, -636.5, 20, 1.5, 3);
    this.wall(-6.5, -625, 1.5, 20, 3);
    this.zones.push({ xMin: 9, xMax: 141, zMin: -635, zMax: -615, dir: 'E' });
    const CZ = -625;
    this.slabX('ruin walk', 13, 36, 3, 9, matPlat, CZ);
    this.crate(24, 3, CZ);
    this.crate(24, 4.2, CZ); // stack
    this.fruitRowX(15, 33, 4.3, 5, CZ);
    this.slabX('ruin pad A', 44, 56, 4.5, 9, matPlat, CZ);
    this.crate(50, 4.5, CZ, 'tnt');
    this.slabX('ruin pad B', 62, 74, 6, 9, matPlat, CZ);
    this.crate(64, 6, CZ, 'mystery');
    this.checkpoint(6, CZ, 69);
    const pitRail = new Rail([new THREE.Vector3(74, 6.9, CZ), new THREE.Vector3(100, 6.3, CZ)]);
    this.rails.push(pitRail);
    this.root.add(pitRail.object);
    this.fruitRowX(78, 96, 8.2, 5, CZ);
    this.mover(84, 5.4, CZ, 6, 7, 'x', 6, 0.55); // ferry pad under the rail
    this.slabX('ruin shelf', 100, 118, 6, 9, matJungle, CZ);
    this.crate(108, 6, CZ, 'nitro');
    this.enemy(103, 115, 6, CZ, 5);
    // split: bounce up to the high fruit ledge, or run the TNT low road
    this.crate(117, 6, CZ, 'bouncy');
    this.slabX('high ledge', 120, 134, 10.5, 9, matPlat, CZ);
    this.crate(127, 10.5, CZ, 'mask');
    this.fruitRowX(122, 132, 11.8, 5, CZ);
    this.slabX('low road', 120, 134, 5.4, 9, matStone, CZ);
    this.crate(126, 5.4, CZ, 'tnt');
    this.crate(131, 5.4, CZ, 'tnt');
    this.slabX('rejoin', 136, 141.5, 6, 9, matPlat, CZ);

    // --- G: corner back south, then the downhill slalom ----------------------
    this.slab('corner south', -615, -635, 6, 20, matPlat, false, 152, 'stone');
    this.wall(162.5, -625, 1.5, 20, 6);
    this.wall(152, -613.5, 20, 1.5, 6);
    const dhY = (z: number): number => THREE.MathUtils.mapLinear(z, -635, -705, 6, -4);
    this.ramp('gauntlet downhill', -635, 6, -705, -4, 12, matRamp, 152);
    this.crate(149, dhY(-655), -655);
    this.crate(155, dhY(-668), -668);
    this.crate(149.5, dhY(-681), -681, 'nitro');
    this.crate(154.5, dhY(-692), -692, 'nitro');
    this.fruitRow(-648, -662, dhY(-655) + 1.3, 4, 152);
    this.fruitRow(-676, -690, dhY(-683) + 1.3, 4, 152);
    this.jungle('runout', -705, -760, -4, 12, matJungle, { dips: [-730] }, 152);
    // twin crushers guard the runout, alternating: read the rhythm, pick a side
    this.crusher(149.3, -4, -718, 5.6, 3, 3.4, 0);
    this.crusher(154.7, -4, -736, 5.6, 3, 3.4, 1.7);
    this.crate(152, -4, -748);
    this.crate(152, -2.8, -748); // stack
    this.enemy(148, 156, -4, -752, 6);
    this.checkpoint(-4, -757, 152);

    // --- H: rail canyon — S-curve line left, rail-hop chain right ------------
    this.slab('canyon ledge', -760, -775, -4, 14, matStone, true, 152, 'stone');
    // pit: -775 .. -860
    const sCurve = new Rail([
      new THREE.Vector3(149, -3, -772),
      new THREE.Vector3(147, -2.2, -800),
      new THREE.Vector3(151.5, -2.6, -830),
      new THREE.Vector3(149.5, -3.4, -858),
    ]);
    const chainA = new Rail([
      new THREE.Vector3(155.5, -3, -772),
      new THREE.Vector3(155.5, -3.4, -814),
    ]);
    const chainB = new Rail([
      new THREE.Vector3(158, -3.1, -822),
      new THREE.Vector3(158, -3.6, -858),
    ]);
    for (const r of [sCurve, chainA, chainB]) {
      this.rails.push(r);
      this.root.add(r.object);
    }
    this.crate(155.5, -2.6, -795); // smash it or get knocked into the pit
    this.crate(149.5, -2.9, -850, 'mask'); // floats at grind height on the S-curve
    this.fruitRow(-782, -808, -1.4, 4, 147.5);
    this.fruitRow(-826, -852, -1.8, 4, 158);
    this.slab('canyon landing', -860, -885, -4, 14, matStone, true, 152, 'stone');
    this.berms(-860, -885, -4, 14, 152);
    // ARENA: land off the rails and the gates slam shut — two waves to clear
    this.buildArena(152, -4, -861, -884, 14);
    this.checkpoint(-4, -890, 152);

    // --- I: crate maze --------------------------------------------------------
    this.slab('crate maze', -885, -960, -4, 18, matSand, false, 152, 'sand');
    this.wall(142.9, -922.5, 1.2, 75, -4);
    this.wall(161.1, -922.5, 1.2, 75, -4);
    // row 1: pass on the right (or spin the TNT)
    for (let i = 0; i < 9; i++) this.crate(144 + i * 1.3, -4, -900, i === 3 ? 'tnt' : undefined);
    this.crate(159, -4, -895, 'mystery');
    this.enemy(155.5, 160, -4, -907, 4);
    // row 2: pass on the left (nitro in the wall — no spinning through blind)
    for (let i = 0; i < 9; i++) this.crate(149.7 + i * 1.3, -4, -915, i === 5 ? 'nitro' : undefined);
    this.enemy(144, 148.5, -4, -922, 4);
    // row 3: full width — bounce over it, or blow the TNT posts
    this.crate(152, -4, -925, 'bouncy');
    for (let i = 0; i < 14; i++) {
      this.crate(143.6 + i * 1.3, -4, -930, i === 4 || i === 9 ? 'tnt' : undefined);
    }
    this.crate(145, -4, -940, 'mystery');
    this.crate(152, -4, -950, 'mask');
    this.fruitRow(-892, -898, -2.7, 3, 158);
    this.fruitRow(-908, -914, -2.7, 3, 145.5);
    this.checkpoint(-4, -955, 152);

    // --- J: vine bridges — pick a lane over the long pit ----------------------
    // left is broken mid-span, center is mined, right is logged. Edges grind.
    // pit: -960 .. -1050
    this.slab('bridge left A', -960, -998, -4, 3.2, matWood, true, 146.5, 'wood');
    this.slab('bridge left B', -1010, -1050, -4, 3.2, matWood, true, 146.5, 'wood');
    // center bridge: planks that collapse in a wave behind you once you
    // commit past the trigger — sprint, don't sightsee
    const planks: Crumble[] = [];
    for (let i = 0; i < 12; i++) {
      planks.push(this.crumblePad(152, -4, -963.7 - i * 7.5, 3.2, 7.3, null));
    }
    this.collapse = {
      planks,
      xMin: 149.6,
      xMax: 154.4,
      triggerZ: -974,
      endZ: -1050,
      startZ: -958,
      frontZ: -958,
      speed: 15,
      active: false,
    };
    this.slab('bridge right', -960, -1050, -4, 3.2, matWood, true, 157.5, 'wood');
    this.log(155.9, 159.1, -4, -980);
    this.log(155.9, 159.1, -4, -1022);
    this.fruitRow(-966, -1044, -2.7, 8, 146.5);
    this.fruitRow(-970, -1040, -2.7, 6, 157.5);
    this.slab('bridge landing', -1050, -1075, -4, 14, matStone, true, 152, 'stone');
    this.checkpoint(-4, -1070, 152);

    // --- K: stone gauntlet + finish -------------------------------------------
    this.jungle('gauntlet A', -1075, -1133, -4, 11, matJungle2, { dips: [-1102] }, 152);
    this.stone(149.5, -4, -1080, -1102, 10);
    this.stone(154.5, -4, -1080, -1102, 13);
    // twin pendulum blades close out the stretch, out of phase
    this.pendulum(152, 2.0, -1112, 4.6, 1.15, 1.8);
    this.pendulum(152, 2.0, -1122, 4.6, 1.15, 1.5, Math.PI);
    // gap: -1133 .. -1139 (rebalanced)
    this.jungle('gauntlet B', -1139, -1185, -4, 11, matJungle, {}, 152);
    this.enemy(148.5, 155.5, -4, -1160, 7);
    this.enemy(149, 155, -4, -1175, 9);
    this.fruitRow(-1148, -1180, -2.6, 6, 152);
    this.slab('finish run', -1185, -1215, -4, 14, matFinish, true, 152, 'stone');
    this.finishGate(-4, this.finishZ, 152);
    this.endWall(-4, 152);

    // --- dressing: hardy palms + succulents on the fringes (visual only) ---
    this.palm(-13, 0, 2, 4.6, 0.18);
    this.palm(13.5, 0, -6, 5.2, -0.12);
    this.palm(-8.2, 0, -58, 4.4, 0.1);
    this.palm(8.4, 0, -104, 4.8, -0.08);
    this.palm(-8.2, 3, -196, 4.3, 0.12);
    this.palm(8.2, 6, -252, 4.9, -0.1);
    this.palm(-8, 9, -318, 4.4, 0.1);
    this.palm(8, 9, -430, 4.6, -0.12);
    this.broadleaf(-4.9, 0, -40, 1.1, 'succulent', 0x9ab060);
    this.broadleaf(4.9, 0, -92, 1.0, 'succulent', 0x9ab060);
    this.broadleaf(-4.9, 3, -180, 1.2, 'succulent', 0x9ab060);
    this.broadleaf(4.9, 6, -246, 1.0, 'succulent', 0x9ab060);
    this.broadleaf(-4.8, 9, -312, 1.1, 'succulent', 0x9ab060);
    this.broadleaf(4.8, 3, -488, 1.2, 'succulent', 0x9ab060);
    this.fern(-5.9, 3, -498, 1.1);
    this.fern(4.9, 0, -68, 1.2);
    this.rock(-8.4, 0, -20, 1.7);
    this.rock(13, 0, -14, 1.3);
    this.flowers(-4.4, 0, -32);
    // crate-maze rim + finish
    this.palm(140.4, -4, -898, 4.7, 0.1);
    this.palm(163.6, -4, -912, 5.1, -0.1);
    this.palm(140.6, -4, -934, 4.4, 0.08);
    this.palm(163.4, -4, -948, 4.9, -0.08);
    this.rock(140.8, -4, -952, 1.5);
    this.palm(146.4, -4, -1206, 4.8, 0.1);
    this.palm(157.6, -4, -1209, 5.2, -0.1);
    this.broadleaf(147, -4, -1191, 1.1, 'succulent', 0x9ab060);
    this.flowers(157, -4, -1192);
  }

  // Arena lock: two gates and two waves of critters on an enclosed deck.
  // Trigger zone sits well inside the gates so nobody gets pinched at entry.
  private buildArena(cx: number, deckY: number, zNear: number, zFar: number, width: number): void {
    const gates: { mesh: THREE.Mesh; upY: number; downY: number; box: THREE.Box3 }[] = [];
    for (const gz of [zNear, zFar]) {
      const mesh = new THREE.Mesh(
        new THREE.BoxGeometry(width, 3.6, 1),
        this.patterned(new THREE.MeshLambertMaterial({ color: 0x8a6034 }), width, 3.6, 'wood'),
      );
      const upY = deckY + 1.7;
      const downY = deckY - 2.7;
      mesh.position.set(cx, downY, gz);
      this.root.add(mesh);
      gates.push({
        mesh,
        upY,
        downY,
        box: new THREE.Box3().setFromCenterAndSize(
          new THREE.Vector3(cx, deckY + 1.8, gz),
          new THREE.Vector3(width, 4.2, 1.3),
        ),
      });
    }
    const mkWave = (idx: number, defs: [number, number, number, number][]): Enemy[] =>
      defs.map(([x0, x1, z, speed]) => {
        this.enemy(x0, x1, deckY, z, speed);
        const e = this.enemies[this.enemies.length - 1];
        e.arenaWave = idx;
        e.alive = false;
        e.group.visible = false;
        return e;
      });
    const zm = (zNear + zFar) / 2;
    this.arena = {
      zone: new THREE.Box3(
        new THREE.Vector3(cx - width / 2, deckY - 2, zFar + 5),
        new THREE.Vector3(cx + width / 2, deckY + 4, zNear - 5),
      ),
      state: 'idle',
      wave: 0,
      waveT: 0,
      waves: [
        mkWave(0, [
          [cx - 5, cx + 5, zm + 4, 6],
          [cx - 4, cx + 4, zm - 5, 5],
        ]),
        mkWave(1, [
          [cx - 5, cx + 5, zm + 6, 8],
          [cx - 5, cx + 5, zm, 7],
          [cx - 4, cx + 4, zm - 6, 9],
        ]),
      ],
      gates,
    };
  }

  // Level 6, "The Flats": a gigantic featureless slab for movement testing.
  // No gaps, no hazards, no finish — walls only at the far perimeter, so
  // there is nothing to fall off. Marker posts along the axes give bearings.
  private buildFlats(): void {
    // Tropical resort noon over an endless blacktop lot: high sun, turquoise
    // horizon haze, parking-bay stripes to give the eye a texel scale.
    const mat = new THREE.MeshLambertMaterial({ color: 0xffffff }); // asphalt is full-colour
    this.killY = -60;
    this.finishZ = -1e9; // no finish gate: endless test slab
    this.endWallZ = -2100;
    this.theme = {
      skyTop: '#159ecd',
      skyBottom: '#c9f0e4',
      sunColorHex: '#fff8dc',
      sunU: 0.68,
      sunV: 0.14,
      stars: false,
      fog: 0xbee8dd, // turquoise haze
      fogNear: 70,
      fogFar: 320,
      hemiSky: 0xeafcff,
      hemiGround: 0x94a294,
      hemiI: 1.2,
      sunColor: 0xfff6dc,
      sunI: 1.55,
      particleColor: 0xffffff,
      particleWind: [0.5, -0.3, 0.2],
    };
    this.slab('the flats', 2100, -2100, 0, 4200, mat, false, 0, 'asphalt');
    // perimeter walls, two kilometres out in every direction
    this.wall(0, 2098, 4200, 4, 0, 8);
    this.wall(0, -2098, 4200, 4, 0, 8);
    this.wall(2098, 0, 4, 4200, 0, 8);
    this.wall(-2098, 0, 4, 4200, 0, 8);
    // bearing markers along both axes (visual only — nothing to bump into)
    const postMat = new THREE.MeshLambertMaterial({ color: 0x5a6470 });
    for (let d = 50; d <= 400; d += 50) {
      const h = 2 + d / 100;
      for (const [x, z] of [
        [d, 0],
        [-d, 0],
        [0, d],
        [0, -d],
      ]) {
        const post = new THREE.Mesh(new THREE.BoxGeometry(0.8, h, 0.8), postMat);
        post.position.set(x, h / 2, z);
        this.root.add(post);
      }
    }

    // --- rail garden: practice lines just south of spawn -------------------
    const V = (x: number, y: number, z: number): THREE.Vector3 => new THREE.Vector3(x, y, z);
    // flat starter rail (0.9 above the deck: crates on the line DO clip a
    // grinder, same as the Test Course rail yard)
    const flatRail = new Rail([V(5, 0.9, -25), V(5, 0.9, -85)]);
    // sloped rail: grind it up to a high dismount (or bomb it back down)
    const slopeRail = new Rail([V(12, 0.9, -25), V(12, 6.5, -95)]);
    // three staggered parallel rails — hop rail-to-rail without touching down
    const parA = new Rail([V(-6, 0.9, -25), V(-6, 0.9, -110)]);
    const parB = new Rail([V(-10, 0.9, -40), V(-10, 0.9, -125)]);
    const parC = new Rail([V(-14, 0.9, -55), V(-14, 0.9, -140)]);
    for (const r of [flatRail, slopeRail, parA, parB, parC]) {
      this.rails.push(r);
      this.root.add(r.object);
    }
    // crates in the lanes between the parallel rails (smash practice)
    for (let z = -48; z >= -108; z -= 12) {
      this.crate(-8, 0, z);
      this.crate(-12, 0, z + 6);
    }
    // crates ON the center rail line: plain ones punish slow grinds, the
    // mask crate always pops (grind-through reward)
    this.crate(-10, 0, -70);
    this.crate(-10, 0, -100, 'mask');
    // arrow crates with their classic floating fruit crate above
    this.crate(9, 0, -40, 'bouncy');
    this.crate(-2, 0, -60, 'bouncy');
    // a TNT and a nitro for blast testing, well apart
    this.crate(16, 0, -60, 'tnt');
    this.crate(20, 0, -75, 'nitro');
    this.crystal(0, 0.4, -45); // test crystal between the lanes

    // --- ramp staircase: seven ramps of increasing steepness ---------------
    // grades 0.15 (8.5 deg) up to 1.9 (62 deg): walk, roll, and pump tests.
    const matRampF = new THREE.MeshLambertMaterial({ color: 0xaab4ba }); // skatepark concrete
    const grades = [0.15, 0.3, 0.5, 0.75, 1.0, 1.4, 1.9];
    for (let i = 0; i < grades.length; i++) {
      const x = 38 + i * 12;
      const len = 8;
      this.ramp(`test ramp ${i + 1}`, -40, 0, -40 - len, grades[i] * len, 5, matRampF, x, 'pavement');
    }

    // --- dressing: resort avenues, well clear of every test lane -----------
    // (nothing within 30u of the rail garden / ramp block: x -20..115, z 0..-160)
    for (let i = 0; i < 6; i++) {
      const z = 45 - i * 62;
      this.palm(-78, 0, z, 5 + (i % 3) * 0.6, i % 2 === 0 ? 0.12 : -0.1);
      this.palm(150, 0, z - 20, 5.3 - (i % 2) * 0.5, i % 2 === 0 ? -0.1 : 0.12);
    }
    for (let i = 0; i < 5; i++) {
      this.palm(-60 + i * 45, 0, 64, 4.8 + (i % 2) * 0.7, 0.1 - (i % 3) * 0.08);
    }
    // planter islands
    for (const [ix, iz] of [[-78, -400], [150, -400], [-140, 70]] as const) {
      this.rock(ix, 0, iz, 2.2);
      this.palm(ix + 2.5, 0, iz + 2, 5.8, -0.12);
      this.fern(ix - 2.2, 0, iz - 1.5, 1.3);
      this.fern(ix + 1.8, 0, iz - 2.6, 1.1);
      this.flowers(ix - 1.5, 0, iz + 2.2);
      this.planter(ix + 4, 0, iz - 1);
    }
  }

  // Level 6, "The Warehouse": one enclosed room where everything connects.
  // The floor rolls up into a giant quarter-pipe bowl on all four walls —
  // curved pool corners included — and the middle is packed: full halfpipe,
  // sunken octagonal bowl, spine, funbox, kickers, rollers, rail lines.
  // Endless sandbox: no gate, no pit, just transitions to work.
  private buildWarehouse(): void {
    const matFloor = new THREE.MeshLambertMaterial({ color: 0xffffff }); // asphalt is full-colour
    const matTrans = new THREE.MeshLambertMaterial({ color: 0xb4bcc2 }); // masonite/concrete transitions
    this.wallTint = 0x6a5a48; // warehouse brick above the coping
    this.blockTint = 0xb08d5e; // plywood boxes
    this.killY = -40;
    this.finishZ = -1e9; // sandbox: session over when YOU say so
    this.endWallZ = -70;
    this.spawnPos.set(0, 0.1, 52);
    this.currentSpawn.copy(this.spawnPos);
    this.theme = {
      skyTop: '#151820', // rafters lost in the dark
      skyBottom: '#333947',
      sunColorHex: '#ffd9a0', // skylight shaft
      sunU: 0.5,
      sunV: 0.28,
      stars: false,
      fog: 0x252932,
      fogNear: 45,
      fogFar: 240,
      hemiSky: 0x9aa4b8, // cool skylight fill
      hemiGround: 0x3a342c,
      hemiI: 0.9,
      sunColor: 0xffc880, // warm sodium key
      sunI: 1.35,
      particleColor: 0xcabb9a, // drifting dust
      particleWind: [0.2, -0.05, 0.1],
    };

    const W = 44; // room half-extent, x
    const D = 64; // room half-extent, z
    const R = 10; // perimeter transition radius — THPS-warehouse mellow
    const LIP = 6.1;
    // circle profile, wall-relative: [distance from wall, height]
    const P: [number, number][] = [
      [10, 0],
      [7.5, 0.23],
      [5.5, 0.79],
      [3.8, 1.55],
      [2.2, 2.74],
      [0.95, 4.18],
      [0, 6.1],
    ];
    const V = (x: number, y: number, z: number): THREE.Vector3 => new THREE.Vector3(x, y, z);
    const addRail = (a: THREE.Vector3, b: THREE.Vector3): void => {
      const r = new Rail([a, b]);
      this.rails.push(r);
      this.root.add(r.object);
    };

    // --- the giant enclosing bowl -----------------------------------------
    // Straight transitions along all four walls (corners carry the curve).
    for (let i = 0; i < P.length - 1; i++) {
      const [w0, y0] = P[i];
      const [w1, y1] = P[i + 1];
      this.bank('bowl wall E', -(D - R), D - R, W - w0, W - w1, y0, y1, matTrans);
      this.bank('bowl wall W', -(D - R), D - R, -(W - w0), -(W - w1), y0, y1, matTrans);
      this.ramp('bowl wall N', D - w0, y0, D - w1, y1, (W - R) * 2, matTrans, 0, 'pavement');
      this.ramp('bowl wall S', -(D - w0), y0, -(D - w1), y1, (W - R) * 2, matTrans, 0, 'pavement');
    }
    // Curved pool corners: quarter-cone patches rising from the floor point
    // to the lip arc — full profile resolution and 5 arc steps, so the scoop
    // grinds and rides as one seamless curve.
    for (const sx of [1, -1]) {
      for (const sz of [1, -1]) {
        const ccx = sx * (W - R);
        const ccz = sz * (D - R);
        for (let i = 0; i < P.length - 1; i++) {
          const r0 = R - P[i][0];
          const y0 = P[i][1];
          const r1 = R - P[i + 1][0];
          const y1 = P[i + 1][1];
          for (let j = 0; j < 5; j++) {
            const a0 = (j / 5) * (Math.PI / 2);
            const a1 = ((j + 1) / 5) * (Math.PI / 2);
            this.quadFace(
              'bowl corner',
              [ccx + sx * Math.cos(a0) * r0, y0, ccz + sz * Math.sin(a0) * r0],
              [ccx + sx * Math.cos(a0) * r1, y1, ccz + sz * Math.sin(a0) * r1],
              [ccx + sx * Math.cos(a1) * r1, y1, ccz + sz * Math.sin(a1) * r1],
              [ccx + sx * Math.cos(a1) * r0, y0, ccz + sz * Math.sin(a1) * r0],
              matTrans,
            );
          }
        }
      }
    }
    // ONE continuous coping loop: four straight lips joined by quarter arcs,
    // so a grind carries around the corners instead of dying at a seam.
    const lr = R - 0.1;
    const loop: THREE.Vector3[] = [];
    const arc = (ccx: number, ccz: number, a0: number): void => {
      for (let j = 1; j <= 5; j++) {
        const a = a0 + (Math.PI / 2) * (j / 5);
        loop.push(V(ccx + Math.cos(a) * lr, LIP + 0.05, ccz + Math.sin(a) * lr));
      }
    };
    loop.push(V(W - 0.1, LIP + 0.05, -(D - R)));
    loop.push(V(W - 0.1, LIP + 0.05, D - R));
    arc(W - R, D - R, 0); // NE
    loop.push(V(-(W - R), LIP + 0.05, D - 0.1));
    arc(-(W - R), D - R, Math.PI / 2); // NW
    loop.push(V(-(W - 0.1), LIP + 0.05, -(D - R)));
    arc(-(W - R), -(D - R), Math.PI); // SW
    loop.push(V(W - R, LIP + 0.05, -(D - 0.1)));
    arc(W - R, -(D - R), Math.PI * 1.5); // SE, closes next to the start
    const loopRail = new Rail(loop);
    this.rails.push(loopRail);
    this.root.add(loopRail.object);
    // FLAT DECK behind every lip — grind exits and coping stalls land on
    // boards, not inside the wall. Walls move outward to make the room.
    const DECK = 3;
    const WX = W + DECK;
    const WZ = D + DECK;
    this.slab('bowl deck E', D - R, -(D - R), LIP, DECK, matTrans, false, W + DECK / 2, 'plank');
    this.slab('bowl deck W', D - R, -(D - R), LIP, DECK, matTrans, false, -(W + DECK / 2), 'plank');
    this.slab('bowl deck N', WZ, D, LIP, (W - R) * 2, matTrans, false, 0, 'plank');
    this.slab('bowl deck S', -D, -WZ, LIP, (W - R) * 2, matTrans, false, 0, 'plank');
    // corner deck fans: arc -> outer wall square, flat at lip height
    for (const sx of [1, -1]) {
      for (const sz of [1, -1]) {
        const ccx = sx * (W - R);
        const ccz = sz * (D - R);
        const spread = R + DECK; // wall square, corner-local
        for (let j = 0; j < 5; j++) {
          const a0 = (j / 5) * (Math.PI / 2);
          const a1 = ((j + 1) / 5) * (Math.PI / 2);
          const bnd = (a: number): [number, number] => {
            const t = Math.min(
              spread / Math.max(Math.abs(Math.cos(a)), 1e-4),
              spread / Math.max(Math.abs(Math.sin(a)), 1e-4),
            );
            return [ccx + sx * Math.cos(a) * t, ccz + sz * Math.sin(a) * t];
          };
          const [bx0, bz0] = bnd(a0);
          const [bx1, bz1] = bnd(a1);
          this.quadFace(
            'bowl deck corner',
            [ccx + sx * Math.cos(a0) * R, LIP, ccz + sz * Math.sin(a0) * R],
            [ccx + sx * Math.cos(a1) * R, LIP, ccz + sz * Math.sin(a1) * R],
            [bx1, LIP, bz1],
            [bx0, LIP, bz0],
            matTrans,
            'plank',
          );
        }
      }
    }
    // brick above the coping, sealing the room
    this.wall(0, WZ + 0.7, WX * 2 + 4, 1.5, LIP, 10);
    this.wall(0, -(WZ + 0.7), WX * 2 + 4, 1.5, LIP, 10);
    this.wall(WX + 0.7, 0, 1.5, WZ * 2 + 4, LIP, 10);
    this.wall(-(WX + 0.7), 0, 1.5, WZ * 2 + 4, LIP, 10);

    // --- floor: strips around the sunken bowl footprint --------------------
    const bx = 20; // bowl center
    const bz = -22;
    const BRIM = 13; // bowl rim radius (octagon)
    this.slab('floor north', D, bz + BRIM, 0, W * 2, matFloor, false, 0, 'asphalt');
    this.slab('floor south', bz - BRIM, -D, 0, W * 2, matFloor, false, 0, 'asphalt');
    this.slab('floor west', bz + BRIM, bz - BRIM, 0, bx - BRIM + W, matFloor, false, (bx - BRIM - W) / 2, 'asphalt');
    this.slab('floor east', bz + BRIM, bz - BRIM, 0, W - bx - BRIM, matFloor, false, (W + bx + BRIM) / 2, 'asphalt');
    // octagon-to-square apron: 8 flat quads seal the bowl surround exactly
    const sq = (a: number): [number, number] => {
      const c = Math.cos(a);
      const s = Math.sin(a);
      const t = BRIM / Math.max(Math.abs(c), Math.abs(s));
      return [bx + c * t, bz + s * t];
    };
    for (let j = 0; j < 8; j++) {
      const a0 = (j / 8) * Math.PI * 2;
      const a1 = ((j + 1) / 8) * Math.PI * 2;
      const [qx0, qz0] = sq(a0);
      const [qx1, qz1] = sq(a1);
      this.quadFace(
        'bowl apron',
        [bx + Math.cos(a0) * BRIM, 0, bz + Math.sin(a0) * BRIM],
        [bx + Math.cos(a1) * BRIM, 0, bz + Math.sin(a1) * BRIM],
        [qx1, 0, qz1],
        [qx0, 0, qz0],
        matFloor,
        'asphalt',
      );
    }

    // --- sunken octagonal pool bowl ----------------------------------------
    const BR: [number, number][] = [
      [13, 0],
      [10.6, -1.5],
      [8.2, -2.7],
    ];
    for (let i = 0; i < BR.length - 1; i++) {
      const [r0, y0] = BR[i];
      const [r1, y1] = BR[i + 1];
      for (let j = 0; j < 8; j++) {
        const a0 = (j / 8) * Math.PI * 2;
        const a1 = ((j + 1) / 8) * Math.PI * 2;
        this.quadFace(
          'pool bowl',
          [bx + Math.cos(a0) * r0, y0, bz + Math.sin(a0) * r0],
          [bx + Math.cos(a0) * r1, y1, bz + Math.sin(a0) * r1],
          [bx + Math.cos(a1) * r1, y1, bz + Math.sin(a1) * r1],
          [bx + Math.cos(a1) * r0, y0, bz + Math.sin(a1) * r0],
          matTrans,
        );
      }
    }
    this.slab('pool floor', bz + 7.7, bz - 7.7, -2.7, 15.4, matTrans, false, bx, 'pavement');
    this.crystal(bx, -1.6, bz); // dive for it

    // --- full halfpipe (west side) ------------------------------------------
    const HP: [number, number, number, number][] = [
      [3.0, 4.8, 0, 0.23],
      [4.8, 6.3, 0.23, 0.79],
      [6.3, 7.5, 0.79, 1.55],
      [7.5, 8.7, 1.55, 2.74],
      [8.7, 9.6, 2.74, 4.18],
      [9.6, 10.3, 4.18, 6.1],
    ];
    const hpx = -24;
    for (const [xi, xo, yb, yt] of HP) {
      for (const s of [1, -1]) {
        this.bank('halfpipe wall', -40, -8, hpx + s * xi, hpx + s * xo, yb, yt, matTrans);
      }
    }
    addRail(V(hpx + 10.3, LIP + 0.05, -8), V(hpx + 10.3, LIP + 0.05, -40));
    addRail(V(hpx - 10.3, LIP + 0.05, -8), V(hpx - 10.3, LIP + 0.05, -40));

    // --- spine (hit it travelling either way along z) -----------------------
    this.ramp('spine south', 19, 0, 14.5, 2.2, 10, matTrans, 0, 'pavement');
    this.ramp('spine north', 10, 0, 14.5, 2.2, 10, matTrans, 0, 'pavement');
    addRail(V(-5, 2.35, 14.5), V(5, 2.35, 14.5));

    // --- funbox with rail over the top ---------------------------------------
    this.stepBlock(0, 38, 12, 10, 0, 1.5);
    this.ramp('funbox south', 46, 0, 43, 1.5, 12, matTrans, 0, 'pavement');
    this.ramp('funbox north', 30, 0, 33, 1.5, 12, matTrans, 0, 'pavement');
    this.bank('funbox east', 33, 43, 8.5, 6, 0, 1.5, matTrans);
    this.bank('funbox west', 33, 43, -8.5, -6, 0, 1.5, matTrans);
    addRail(V(0, 2.1, 47), V(0, 2.1, 29));

    // --- kicker row (drop in off the north wall, launch into the room) -------
    // Exact single-face quads: a box ramp's 1-thick back edge is itself a
    // ridable sliver that catches riders at the lip; a quad has no back.
    for (const [kx, kh] of [
      [-14, 2.4],
      [-24, 3.2],
      [-34, 4.2],
    ] as const) {
      this.quadFace(
        `kicker ${kx}`,
        [kx - 2, 0, 45],
        [kx + 2, 0, 45],
        [kx + 2, kh, 41.5],
        [kx - 2, kh, 41.5],
        matTrans,
        'pavement',
      );
    }

    // --- roller hums along the east lane -------------------------------------
    for (let k = 0; k < 3; k++) {
      const z0 = 26 - k * 8;
      this.ramp(`roller ${k + 1} up`, z0, 0, z0 - 2.2, 0.9, 5, matTrans, 30, 'pavement');
      this.ramp(`roller ${k + 1} down`, z0 - 4.4, 0, z0 - 2.2, 0.9, 5, matTrans, 30, 'pavement');
    }

    // --- street tier (from the iso reference): a second vertical level -------
    // Elevated deck along the south end: quarter-pipe face into the room,
    // stair set with handrail at the east end, bank at the west end, ledge
    // and drop rails — every void underneath sealed with visible walls.
    this.slab('street deck', -41, -53, 3.2, 48, matTrans, true, -10, 'plank');
    this.ramp('street qp a', -36.4, 0, -38.1, 0.9, 40, matTrans, -14, 'pavement');
    this.ramp('street qp b', -38.1, 0.9, -39.7, 2.2, 40, matTrans, -14, 'pavement');
    this.ramp('street qp c', -39.7, 2.2, -41, 3.2, 40, matTrans, -14, 'pavement');
    this.stepBlock(11, -39.8, 6, 2.4, 0, 2.3);
    this.stepBlock(11, -37.4, 6, 2.4, 0, 1.5);
    this.stepBlock(11, -35, 6, 2.4, 0, 0.75);
    addRail(V(11, 3.6, -41.5), V(11, 0.8, -33.5)); // handrail down the set
    this.bank('street bank', -53, -41, -38.5, -34, 0, 3.2, matTrans);
    addRail(V(-30, 3.35, -41.15), V(2, 3.35, -41.15)); // deck-edge ledge
    addRail(V(4, 3.35, -41), V(4, 0.9, -33)); // drop rail off the deck
    this.wall(14.3, -47, 0.6, 12.6, 0, 2.7); // seal the under-deck void
    this.wall(-10, -53.3, 48.6, 0.6, 0, 2.7);
    this.wall(7, -41.3, 2.4, 0.6, 0, 2.7); // slot between QP face and stairs
    this.crate(-24, 3.2, -47); // deck loot
    this.crate(-24, 4.2, -47, 'mystery');

    // --- center pyramid with an overtop rail ---------------------------------
    this.ramp('pyramid n', -18, 0, -22, 1.8, 12, matTrans, -3, 'pavement');
    this.ramp('pyramid s', -30, 0, -26, 1.8, 12, matTrans, -3, 'pavement');
    this.bank('pyramid e', -26, -22, 3, 1, 0, 1.8, matTrans);
    this.bank('pyramid w', -26, -22, -9, -7, 0, 1.8, matTrans);
    this.slab('pyramid top', -22, -26, 1.8, 8, matTrans, false, -3, 'pavement');
    addRail(V(-3, 2.3, -16.5), V(-3, 2.3, -31.5));

    // --- manual pads (curb-height: roll up, pop off) --------------------------
    this.slab('manual pad a', -42.5, -46.5, 0.7, 8, matTrans, true, 29, 'pavement');
    this.slab('manual pad b', -48, -51.5, 1.0, 8, matTrans, true, 29, 'pavement');

    // --- solid backs: no more skating through ramp bellies --------------------
    // Backs sit 0.7 behind the riding face: flush colliders clip riders near
    // the lip, and the 0.7 slot is narrower than the player, so it can't be
    // entered — solid from outside, invisible to anyone on the face.
    this.wall(hpx - 11.7, -24, 0.6, 32, 0, 6.1); // halfpipe outer backs
    this.wall(hpx + 11.7, -24, 0.6, 32, 0, 6.1);
    this.wall(-14, 40.4, 4, 0.5, 0, 2.4); // kicker backboards (tall-edge side)
    this.wall(-24, 40.4, 4, 0.5, 0, 3.2);
    this.wall(-34, 40.4, 4, 0.5, 0, 4.2);

    // --- rail lines -----------------------------------------------------------
    addRail(V(-10, 0.9, 44), V(-10, 0.9, 24)); // flat ledge line near spawn
    addRail(V(12, 3.2, 26), V(12, 0.9, 4)); // sloped line off the kicker side
    addRail(V(-38, 0.9, 20), V(-38, 0.9, -4)); // west wall approach line

    // --- crates & relics -------------------------------------------------------
    for (let i = 0; i < 5; i++) this.crate(-6 + i * 3, 0, 24);
    this.crate(-10, 0, 34, 'mystery');
    this.crate(11, 0, -31, 'mask'); // tucked on the pool apron
    this.crate(-8, 0, -24, 'bouncy'); // by the halfpipe entry (classic stack spawns above)
    this.crate(30, 0, 36, 'tnt');
    this.crate(30, 0, 42, 'nitro');
    this.crate(-34, 0, 30);
    this.crate(-34, 1, 30);
    this.crate(-34, 2, 30, 'mystery'); // corner stack: spin the base out
    this.checkpoint(0, 8, 14);

    // --- warehouse dressing (pure visual, skipped in lite) --------------------
    if (!this.liteDecor) {
      const beamMat = new THREE.MeshLambertMaterial({ color: 0x4a3f34 });
      const lightMat = new THREE.MeshLambertMaterial({ color: 0xffe9b8, emissive: 0xffc86a });
      const beamGeo = new THREE.BoxGeometry(W * 2 - 2, 0.6, 0.8);
      const lampGeo = new THREE.BoxGeometry(1.6, 0.5, 0.8);
      for (let z = -48; z <= 48; z += 24) {
        const beam = new THREE.Mesh(beamGeo, beamMat);
        beam.position.set(0, 15, z);
        this.root.add(beam);
        for (const lx of [-22, 0, 22]) {
          const lamp = new THREE.Mesh(lampGeo, lightMat);
          lamp.position.set(lx, 14.3, z);
          this.root.add(lamp);
        }
      }
      // high window strips: glowing panes on the long walls
      const paneMat = new THREE.MeshLambertMaterial({ color: 0xbfd8e8, emissive: 0x5a7688 });
      const paneGeo = new THREE.BoxGeometry(0.3, 2.6, 7);
      for (const sx of [1, -1]) {
        for (let z = -50; z <= 50; z += 20) {
          const pane = new THREE.Mesh(paneGeo, paneMat);
          pane.position.set(sx * (W + 3.2), 11.5, z);
          this.root.add(pane);
        }
      }
    }
  }

  // Level 5, "Boulder Dash": the Crash 2 chase. You spawn at the FAR end of
  // the corridor and sprint back TOWARD the camera (hold down + X to skate)
  // while a boulder thunders after you. It crushes crates, detonates
  // explosives, and flattens anything slower than it — then tips into the
  // pit at the end. Jump the same pit and cruise to the gate.
  private buildBoulderDash(): void {
    // Deep jungle under a lava sky: rich greens lit warm amber, so the
    // corridor reads lush even while everything behind you is on fire.
    const matJungle = new THREE.MeshLambertMaterial({ color: 0x4f9440 });
    const matJungle2 = new THREE.MeshLambertMaterial({ color: 0x5aa048 });
    const matSand = new THREE.MeshLambertMaterial({ color: 0xd2bc7e });
    const matRamp = new THREE.MeshLambertMaterial({ color: 0x6f9a50 });

    this.chaseCam = true;
    this.killY = -30;
    this.finishZ = 8;
    this.endWallZ = -470; // the far-end clamp doubles as the wall behind spawn
    this.spawnPos.set(0, 0.1, -448);
    this.currentSpawn.copy(this.spawnPos);
    this.theme = {
      skyTop: '#14322a',
      skyBottom: '#c85f28',
      sunColorHex: '#ff8a4a',
      sunU: 0.5,
      sunV: 0.42,
      stars: false,
      fog: 0x4c3c22, // amber-green murk under the canopy
      fogNear: 21,
      fogFar: 130,
      hemiSky: 0xd8b878, // warm amber sky light keeps the greens green
      hemiGround: 0x22381e,
      hemiI: 1.0,
      sunColor: 0xffa055,
      sunI: 1.25,
      particleColor: 0xff9a52,
      particleWind: [0.3, 1.4, 0.2], // rising embers
    };

    // the floor of the world is lava — very motivating
    this.pitPlane('lava', -40, 0, -220, 1200);

    // spawn deck — open behind, so you can SEE the thing waiting for you
    this.slab('chase start', -440, -458, 0, 14, matSand, false, 0, 'sand');
    this.wall(-7.5, -449, 1, 18, 0);
    this.wall(7.5, -449, 1, 18, 0);

    this.jungle('chase A', -377, -440, 0, 12, matJungle, { dips: [-410] });
    this.fruitRow(-434, -390, 1.3, 8);
    this.log(0.5, 5.5, 0, -396);
    this.crate(-4.5, 0, -420, 'nitro');
    // gap 1: -371 .. -377 (rebalanced — clearable mid-chase)
    this.jungle('chase B', -300, -371, 0, 12, matJungle2, { dips: [-330] });
    this.crate(-1.3, 0, -350, 'tnt');
    this.crate(1.3, 0, -350, 'tnt'); // swerve or hop the pair
    this.log(-5.5, -0.5, 0, -318);
    this.fruitRow(-362, -306, 1.3, 8);
    this.checkpoint(0, -308, -3.5);
    this.ramp('chase rise', -285, 2, -300, 0, 12, matRamp);
    this.jungle('chase C', -212, -285, 2, 12, matJungle, { dips: [-240] });
    this.crate(-3.2, 2, -260, 'nitro');
    this.crate(3.2, 2, -260, 'nitro'); // thread the middle
    this.crystal(0, 2.4, -250); // grab it WHILE fleeing — right up the middle
    this.log(-5.5, -1.5, 2, -228);
    this.fruitRow(-278, -222, 3.3, 8);
    // gap 2: -207 .. -212 (rebalanced)
    this.jungle('chase D', -130, -207, 2, 12, matJungle2, { dips: [-160] });
    this.crate(0, 2, -182, 'tnt');
    this.crate(-2.6, 2, -176, 'tnt');
    this.crate(2.6, 2, -170, 'tnt'); // staggered minefield: weave it
    this.enemy(-4, 4, 2, -150, 6);
    this.fruitRow(-198, -140, 3.3, 8);
    this.checkpoint(2, -138, 3.5);
    this.ramp('chase drop', -112, 0, -130, 2, 12, matRamp);
    this.jungle('chase E', -42, -112, 0, 13, matJungle, { dips: [-75] });
    this.log(0.5, 6, 0, -95);
    this.crate(-4.8, 0, -60, 'nitro');
    this.fruitRow(-106, -52, 1.3, 8);
    // the boulder pit: -35 .. -42 — you jump it; the boulder tips in
    this.slab('escape', 14, -35, 0, 14, matSand, true, 0, 'sand');
    this.wall(-7.5, -9, 1, 46, 0);
    this.wall(7.5, -9, 1, 46, 0);
    this.crate(-3, 0, -20, 'mask');
    this.crate(3, 0, -16, 'mystery');
    this.crate(0, 0, -24);
    this.fruitRow(-28, -12, 1.3, 5);
    this.finishGate(0, this.finishZ);
    // no end-wall mesh — the far clamp sits invisibly behind the spawn deck

    this.buildChaseBoulder(-487, -44);

    // --- dressing: jungle walls tight outside the 12u corridor (visual only,
    // x ±7.5 clears the ±6 deck edge) + canopy palms bowing over the lane ---
    const strips: [number, number, number][] = [
      [0, -388, -434],
      [0, -306, -366],
      [2, -218, -280],
      [2, -136, -202],
      [0, -48, -108],
    ];
    let k = 0;
    for (const [sy, zn, zf] of strips) {
      for (let z = zn; z >= zf; z -= 16) {
        const side = k % 2 === 0 ? 1 : -1;
        if (k % 3 === 2) this.broadleaf(side * 7.6, sy, z, 1.35);
        else this.fern(side * 7.5, sy, z, 1.45);
        if (k % 4 === 1) this.fern(-side * 7.7, sy, z - 5, 1.25);
        k++;
      }
    }
    this.palm(7.9, 0, -400, 7.4, 0.45);
    this.palm(-7.9, 0, -330, 7.2, -0.45);
    this.palm(7.9, 2, -250, 7.6, 0.42);
    this.palm(-7.9, 2, -168, 7.3, -0.42);
    this.palm(7.9, 0, -84, 7.5, 0.44);
    this.palm(-7.9, 0, -60, 7.1, -0.4);
    // escape deck: the beach you were sprinting for
    this.palm(-6.4, 0, -1, 5.4, 0.1);
    this.palm(6.4, 0, -3, 5.8, -0.1);
    this.flowers(-6.4, 0, -28);
    this.fern(6.6, 0, -30, 1.2);
  }

  // The chase boulder: a boulder-sized Stone that rolls +Z after the player.
  private buildChaseBoulder(startZ: number, endZ: number): void {
    const r = 4.3;
    const geo = new THREE.SphereGeometry(r, 16, 12);
    const posAttr = geo.attributes.position as THREE.BufferAttribute;
    const v = new THREE.Vector3();
    for (let i = 0; i < posAttr.count; i++) {
      v.fromBufferAttribute(posAttr, i);
      const lump = 1 + 0.07 * Math.sin(v.x * 2.1) * Math.sin(v.y * 2.7 + 1.3) * Math.sin(v.z * 1.9 + 2.6);
      v.multiplyScalar(lump);
      posAttr.setXYZ(i, v.x, v.y, v.z);
    }
    geo.computeVertexNormals();
    const mesh = new THREE.Mesh(geo, this.baseMat('boulder', 0x8a7660, 'dirt', 3, 2));
    this.root.add(mesh);
    const st: Stone = {
      mesh,
      box: new THREE.Box3(),
      x: 0,
      z0: startZ,
      z1: startZ,
      dir: 1,
      speed: 25,
      r,
      chase: true,
    };
    this.stones.push(st);
    // Ground profile sampled once at build time; gaps carry the last height,
    // so the big fella rolls right over them.
    const h0 = startZ - 12;
    const hStep = 3;
    const heights: number[] = [];
    let prev = 0;
    for (let z = h0; z <= 20; z += hStep) {
      prev = this.floorY(0, z, prev);
      heights.push(prev);
    }
    this.boulder = {
      st,
      active: false,
      falling: false,
      fallV: 0,
      endZ,
      triggerZ: this.spawnPos.z + 5,
      h0,
      hStep,
      heights,
    };
    mesh.position.set(0, this.boulderGroundY(startZ) + r * 0.92, startZ);
  }

  private boulderGroundY(z: number): number {
    const b = this.boulder;
    if (!b) return 0;
    const t = (z - b.h0) / b.hStep;
    const i = Math.max(0, Math.min(b.heights.length - 2, Math.floor(t)));
    const f = Math.max(0, Math.min(1, t - i));
    return b.heights[i] * (1 - f) + b.heights[i + 1] * f;
  }

  // Crude seedless random course: flats with random furniture, gaps, slopes,
  // rails over pits, kickers, step blocks — and the camera occasionally
  // swings sideways for a stretch. Re-select "Random" to reroll.
  private buildRandom(): void {
    const mats = [0x87939a, 0x74838a, 0x7a99a0, 0x7f9884].map(
      (c) => new THREE.MeshLambertMaterial({ color: c }),
    );
    const mat = () => mats[Math.floor(Math.random() * mats.length)];
    // Jungle night: deep teal dark, moonlit decks, warm fireflies adrift.
    this.theme = {
      skyTop: '#0a2a34',
      skyBottom: '#1e6a5e',
      sunColorHex: '#c8f2dc', // low moon
      sunU: 0.25,
      sunV: 0.48,
      stars: true,
      fog: 0x16403e,
      fogNear: 24,
      fogFar: 132,
      hemiSky: 0x64b0a4,
      hemiGround: 0x18302a,
      hemiI: 1.0,
      sunColor: 0x9ae8cc,
      sunI: 1.15,
      particleColor: 0xffd86e, // fireflies
      particleWind: [0.3, 0.25, 0.2],
    };
    let z = 14;
    let y = 0;
    let minY = 0;
    let dist = 0;
    let lastGap = false;
    let cpDue = 170;
    let xc = 0; // course centerline: a sideways jog shifts everything after it
    let jogDone = false;
    this.slab('start', z, z - 30, y, 14, mat(), true, xc);
    z -= 30;
    while (dist < 800) {
      const roll = Math.random();
      if (!jogDone && !lastGap && dist > 150 && dist < 600 && roll < 0.12) {
        // SIDEWAYS JOG: the path right-angles east across floating pads, then
        // turns south again — the fixed camera sees the stretch side-on.
        const JOG = 70;
        this.slab('corner', z, z - 16, y, 16, mat(), false, xc + 3);
        this.wall(xc + 3, z - 17.5, 16, 1.5, y);
        this.zones.push({ xMin: xc + 9, xMax: xc + JOG - 9, zMin: z - 16, zMax: z, dir: 'E' });
        const cz = z - 8;
        for (let px = xc + 11; px + 9 <= xc + JOG - 8; px += 14) {
          this.slabX('side pad', px, px + 9, y, 9, mat(), cz);
          if (Math.random() < 0.4) this.crate(px + 4.5, y, cz);
          if (Math.random() < 0.5) this.fruitRowX(px + 2, px + 7, y + 1.3, 3, cz);
        }
        this.slab('corner', z, z - 16, y, 16, mat(), false, xc + JOG - 3);
        this.wall(xc + JOG + 6.5, z - 8, 1.5, 16, y);
        xc += JOG - 3;
        z -= 16;
        dist += 50;
        cpDue -= 16;
        lastGap = false;
        jogDone = true;
      } else if (roll < 0.34 || lastGap) {
        // flat deck with random furniture
        const len = 28 + Math.random() * 22;
        const w = 10 + Math.random() * 4;
        this.slab('deck', z, z - len, y, w, mat(), true, xc);
        if (!this.crystalPlaced && dist > 300) this.crystal(xc, y + 0.4, z - len * 0.5);
        const crates = Math.floor(Math.random() * 3);
        for (let i = 0; i < crates; i++) {
          this.crate(xc + Math.round(Math.random() * 8 - 4), y, z - 6 - Math.random() * (len - 12));
        }
        if (Math.random() < 0.5) this.enemy(xc - 3.5, xc + 3.5, y, z - len / 2, 3 + Math.random() * 5);
        if (Math.random() < 0.35) this.crate(xc + (Math.random() < 0.5 ? -4 : 4), y, z - len * 0.7, 'nitro');
        if (Math.random() < 0.22) this.crate(xc + (Math.random() < 0.5 ? -3 : 3), y, z - len * 0.4, 'tnt');
        if (Math.random() < 0.22) this.crate(xc + (Math.random() < 0.5 ? -2 : 2), y, z - len * 0.3, 'mask');
        if (Math.random() < 0.15) this.crate(xc + (Math.random() < 0.5 ? -3 : 3), y, z - len * 0.55, 'mystery');
        if (Math.random() < 0.25) this.fruitRow(z - 8, z - len + 8, y + 1.4, 4, xc);
        if (Math.random() < 0.3) {
          const bx = xc + (Math.random() < 0.5 ? -2.5 : 2.5);
          this.stepBlock(bx, z - len * 0.5, 4, 5, y, y + 2.2);
          this.crate(bx, y + 2.2, z - len * 0.5);
        }
        if (cpDue <= 0) {
          this.checkpoint(y, z - len + 6, xc);
          cpDue = 200 + Math.random() * 80;
        }
        z -= len;
        dist += len;
        cpDue -= len;
        lastGap = false;
      } else if (roll < 0.49) {
        // gap over the void (rebalanced for the slower feel: 7-11u)
        const len = 7 + Math.random() * 4;
        z -= len;
        dist += len;
        lastGap = true;
      } else if (roll < 0.64) {
        // slope (downhill-biased)
        const len = 28 + Math.random() * 12;
        const dy = Math.random() < 0.65 ? -(3 + Math.random() * 5) : 2 + Math.random() * 2.5;
        this.ramp('slope', z, y, z - len, y + dy, 10, mat(), xc);
        z -= len;
        y += dy;
        minY = Math.min(minY, y);
        dist += len;
        cpDue -= len;
        lastGap = false;
      } else if (roll < 0.82) {
        // rail over a pit (always follows solid ground)
        const len = 36 + Math.random() * 20;
        const rail = new Rail([
          new THREE.Vector3(xc, y + 0.9, z + 4),
          new THREE.Vector3(xc + Math.round(Math.random() * 5 - 2.5), y + 1.1, z - len / 2),
          new THREE.Vector3(xc, y + 0.9, z - len - 4),
        ]);
        this.rails.push(rail);
        this.root.add(rail.object);
        z -= len;
        dist += len;
        lastGap = true;
      } else if (roll < 0.9) {
        // flush temple stair over the void
        const t = this.stairClimb(z - 2, y, 4, xc);
        dist += z - t.endZ + 4;
        z = t.endZ - 4;
        y = t.topY;
        lastGap = true; // force a solid deck right after the top block
      } else {
        // kicker lip into a gap (rebalanced: 7-10u gap after the lip)
        this.ramp('kicker', z, y, z - 10, y + 2.4, 10, mat(), xc);
        z -= 10 + 7 + Math.random() * 3;
        dist += 20;
        minY = Math.min(minY, y);
        lastGap = true;
      }
    }
    if (lastGap) {
      this.slab('landing', z, z - 30, y, 12, mat(), true, xc);
      z -= 30;
    }
    this.slab('finish run', z, z - 45, y, 14, mat(), true, xc);
    if (!this.crystalPlaced) this.crystal(xc, y + 0.4, z - 10); // fallback: pre-gate
    this.finishZ = z - 30;
    this.endWallZ = z - 42;
    this.finishGate(y, this.finishZ, xc);
    this.endWall(y, xc);
    this.killY = minY - 26;
    this.pitPlane('void', minY - 34, 0, z / 2, 1400);
  }

  private endWall(deckY: number, cx = 0): void {
    const wall = new THREE.Mesh(
      new THREE.BoxGeometry(14, 4, 1),
      this.baseMat('wall', this.wallTint, 'stone', 3, 1),
    );
    wall.position.set(cx, deckY + 2, this.endWallZ - 1);
    this.root.add(wall);
  }

  private finishGate(deckY: number, z: number, cx = 0): void {
    this.finishBox.setFromCenterAndSize(
      new THREE.Vector3(cx, deckY + 15, z),
      new THREE.Vector3(14, 30, 2),
    );
    const postMat = new THREE.MeshLambertMaterial({ color: 0xd8d8d8 });
    for (const side of [-1, 1]) {
      const post = new THREE.Mesh(new THREE.BoxGeometry(0.5, 7, 0.5), postMat);
      post.position.set(cx + side * 5.5, deckY + 3.5, z);
      this.root.add(post);
    }
    const canvas = document.createElement('canvas');
    canvas.width = 64;
    canvas.height = 16;
    const ctx = canvas.getContext('2d')!;
    for (let y = 0; y < 2; y++) {
      for (let x = 0; x < 8; x++) {
        ctx.fillStyle = (x + y) % 2 === 0 ? '#e8e8e8' : '#20242c';
        ctx.fillRect(x * 8, y * 8, 8, 8);
      }
    }
    const tex = new THREE.CanvasTexture(canvas);
    tex.magFilter = THREE.NearestFilter;
    const banner = new THREE.Mesh(
      new THREE.BoxGeometry(11.5, 1.2, 0.2),
      new THREE.MeshBasicMaterial({ map: tex }),
    );
    banner.position.set(cx, deckY + 6.4, z);
    this.root.add(banner);

    // Warp portal: the demoscene plasma plane hangs between the posts, framed
    // by a pulsing additive ring — Crash warp room meets iTunes visualizer.
    this.plasmaSetup();
    const portal = new THREE.Mesh(
      new THREE.PlaneGeometry(10.4, 5.4),
      new THREE.MeshBasicMaterial({
        map: this.plasmaTex!,
        transparent: true,
        opacity: 0.85,
        side: THREE.DoubleSide,
        depthWrite: false,
      }),
    );
    portal.position.set(cx, deckY + 3.1, z - 0.35);
    this.root.add(portal);
    this.glowRing(cx, deckY + 3.1, z - 0.25, 3.6, 0x66eaff, true);

    // Relic scoreboard: crystal + gem icons over the gate — dark ghosts until
    // earned, then they light up and spin (see setRelics).
    const iconMat = (): THREE.MeshLambertMaterial =>
      new THREE.MeshLambertMaterial({
        map: this.chromeTexture(),
        color: 0x2a2f3a,
        transparent: true,
        opacity: 0.4,
        flatShading: true,
      });
    const cIcon = new THREE.Mesh(new THREE.OctahedronGeometry(0.55), iconMat());
    cIcon.scale.y = 1.5;
    cIcon.position.set(cx - 1.7, deckY + 8.1, z);
    this.root.add(cIcon);
    this.gateCrystalIcon = cIcon;
    const gIcon = new THREE.Mesh(new THREE.OctahedronGeometry(0.55), iconMat());
    gIcon.scale.set(1.25, 0.7, 1.25);
    gIcon.position.set(cx + 1.7, deckY + 8.1, z);
    this.root.add(gIcon);
    this.gateGemIcon = gIcon;
    this.relics = { crystal: true, gem: true }; // force the ghost restyle below
    this.setRelics(false, false);
  }
}
