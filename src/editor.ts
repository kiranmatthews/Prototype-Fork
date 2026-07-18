// LEVEL EDITOR: an in-game mode over the Custom level (slot 8). The level is
// pure data (CustomLevelData) — the editor mutates that data and rebuilds the
// live level after every change, so what you edit is exactly what you play.
//
//   orbit: left-drag rotate · wheel zoom · right-drag pan
//   select: click a component · drag it to move (Shift = up/down)
//   panel: add components, edit the selection's numbers, spawn/killY,
//          export/import .json, TEST to play on the spot
//
// Everything autosaves to this browser; EXPORT shares the level as a file.

import * as THREE from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';
import {
  Level,
  CustomComponent,
  CustomLevelData,
  getCustomLevelData,
  setCustomLevelData,
  starterCustomLevel,
  migrateCustomLevel,
  groupChainOf,
  TEX_KINDS,
  LEVEL_NAMES,
  getEditData,
  persistEditData,
} from './level';

interface Hooks {
  rebuild: () => void; // dispose + reconstruct the target level from data
  exitToPlay: () => void; // leave the editor and hand control back to the game
  showMsg: (title: string, sub?: string) => void;
  restoreOriginal: () => void; // built-in override: clear it, rebuild the hand-coded level
}

// what the ADD palette spawns, at the camera's focus point — grouped, each
// with a little drawn icon so the crate language reads at a glance
type Draw = (x: CanvasRenderingContext2D) => void;
interface PalItem {
  label: string;
  icon: Draw;
  make?: (at: THREE.Vector3) => CustomComponent;
  penDraw?: 'platform' | 'pit' | 'wall' | 'rail'; // pen tool: click-to-draw a polygon (or rail path) of this type
}

const box = (x: CanvasRenderingContext2D, fill: string, frame: string): void => {
  x.fillStyle = fill;
  x.fillRect(2, 2, 14, 14);
  x.strokeStyle = frame;
  x.lineWidth = 2;
  x.strokeRect(3, 3, 12, 12);
};
const glyph = (x: CanvasRenderingContext2D, ch: string, color: string): void => {
  x.fillStyle = color;
  x.font = 'bold 11px monospace';
  x.textAlign = 'center';
  x.textBaseline = 'middle';
  x.fillText(ch, 9, 10);
};

const PALETTE_SECTIONS: { title: string; items: PalItem[] }[] = [
  {
    title: 'TERRAIN',
    items: [
      { label: 'platform', icon: (x) => { x.fillStyle = '#cfd4cf'; x.fillRect(1, 7, 16, 5); x.fillStyle = '#aeb4ae'; for (let i = 0; i < 4; i++) x.fillRect(1 + i * 4, 7 + (i % 2) * 2.5, 4, 2.5); }, make: (at) => ({ t: 'platform', p: [at.x, at.y, at.z], s: [10, 1, 10] }) },
      { label: 'ramp', icon: (x) => { x.fillStyle = '#c8b088'; x.beginPath(); x.moveTo(1, 15); x.lineTo(17, 15); x.lineTo(17, 3); x.closePath(); x.fill(); }, make: (at) => ({ t: 'ramp', p: [at.x, at.y, at.z], len: 10, rise: 4, w: 8 }) },
      { label: 'wall', icon: (x) => { x.fillStyle = '#9a8a7a'; x.fillRect(3, 3, 12, 12); x.strokeStyle = '#6a5d50'; x.lineWidth = 1; for (let r = 0; r < 3; r++) { x.strokeRect(3, 3 + r * 4, 6, 4); x.strokeRect(9, 3 + r * 4, 6, 4); } }, make: (at) => ({ t: 'wall', p: [at.x, at.y, at.z], s: [8, 4, 1] }) },
      { label: 'invis wall', icon: (x) => { x.strokeStyle = '#64d8ff'; x.lineWidth = 1.5; x.setLineDash([3, 2]); x.strokeRect(3, 3, 12, 12); x.setLineDash([]); }, make: (at) => ({ t: 'wall', p: [at.x, at.y, at.z], s: [8, 4, 1], invisible: true }) },
      { label: 'rail', icon: (x) => { x.strokeStyle = '#c8d4e2'; x.lineWidth = 2; x.beginPath(); x.moveTo(2, 6); x.lineTo(16, 6); x.stroke(); x.lineWidth = 1.5; x.beginPath(); x.moveTo(5, 6); x.lineTo(5, 14); x.moveTo(13, 6); x.lineTo(13, 14); x.stroke(); }, make: (at) => ({ t: 'rail', p: [at.x, at.y + 1, at.z], len: 12, yaw: 0 }) },
      { label: 'halfpipe', icon: (x) => { x.strokeStyle = '#aab4ba'; x.lineWidth = 2.5; x.beginPath(); x.moveTo(2, 4); x.quadraticCurveTo(2, 15, 9, 15); x.quadraticCurveTo(16, 15, 16, 4); x.stroke(); }, make: (at) => ({ t: 'pipe', p: [at.x, at.y, at.z], len: 36, axis: 'z' }) },
      { label: 'crumble', icon: (x) => { x.fillStyle = '#cf6a48'; x.fillRect(2, 7, 14, 5); x.strokeStyle = '#7a3520'; x.lineWidth = 1; x.beginPath(); x.moveTo(6, 7); x.lineTo(8, 12); x.moveTo(11, 7); x.lineTo(10, 12); x.stroke(); }, make: (at) => ({ t: 'crumble', p: [at.x, at.y + 1, at.z], s: [3, 1, 3], shake: 0.7 }) },
      { label: 'death pit', icon: (x) => { x.fillStyle = '#b0402a'; x.fillRect(2, 6, 14, 7); x.fillStyle = '#0a0a10'; x.fillRect(3.5, 7.5, 11, 4); }, make: (at) => ({ t: 'pit', p: [at.x, at.y, at.z], s: [6, 1, 6] }) },
      { label: 'rock', icon: (x) => { x.fillStyle = '#8d8678'; x.beginPath(); x.moveTo(4, 14); x.lineTo(2, 9); x.lineTo(7, 4); x.lineTo(13, 5); x.lineTo(16, 10); x.lineTo(13, 14); x.closePath(); x.fill(); x.fillStyle = '#a49c8c'; x.beginPath(); x.moveTo(7, 4); x.lineTo(13, 5); x.lineTo(10, 9); x.closePath(); x.fill(); }, make: (at) => ({ t: 'rock', p: [at.x, at.y + 1, at.z], s: [3, 2, 3], seed: Math.floor(Math.random() * 1e6) }) },
      { label: 'boulder', icon: (x) => { x.fillStyle = '#8d8678'; x.beginPath(); x.arc(9, 10, 7, 0, 7); x.fill(); x.fillStyle = '#a49c8c'; x.beginPath(); x.moveTo(5, 6); x.lineTo(12, 4); x.lineTo(13, 9); x.lineTo(6, 10); x.closePath(); x.fill(); }, make: (at) => ({ t: 'rock', p: [at.x, at.y + 2, at.z], s: [5.5, 4, 5.5], seed: Math.floor(Math.random() * 1e6) }) },
      { label: 'spire', icon: (x) => { x.fillStyle = '#8d8678'; x.beginPath(); x.moveTo(9, 2); x.lineTo(13, 12); x.lineTo(12, 16); x.lineTo(6, 16); x.lineTo(5, 11); x.closePath(); x.fill(); x.fillStyle = '#6e685c'; x.beginPath(); x.moveTo(9, 2); x.lineTo(13, 12); x.lineTo(10, 14); x.closePath(); x.fill(); }, make: (at) => ({ t: 'rock', p: [at.x, at.y + 3, at.z], s: [2.5, 6, 2.5], seed: Math.floor(Math.random() * 1e6) }) },
    ],
  },
  {
    title: 'CRATES',
    items: [
      { label: 'wood', icon: (x) => { box(x, '#b5762f', '#7a4a18'); glyph(x, '▦', '#8a5a22'); }, make: (at) => ({ t: 'crate', p: [at.x, at.y + 0.5, at.z], kind: 'wood' }) },
      { label: 'arrow', icon: (x) => { box(x, '#b5762f', '#7a4a18'); glyph(x, '↑', '#3a9a4a'); }, make: (at) => ({ t: 'crate', p: [at.x, at.y + 0.5, at.z], kind: 'bouncy' }) },
      { label: 'arrow metal', icon: (x) => { box(x, '#9aa2ac', '#666e78'); glyph(x, '↑', '#3a9a4a'); }, make: (at) => ({ t: 'crate', p: [at.x, at.y + 0.5, at.z], kind: 'metalbounce' }) },
      { label: 'TNT', icon: (x) => { box(x, '#c03a2a', '#6a180e'); glyph(x, 'T', '#ffe9d8'); }, make: (at) => ({ t: 'crate', p: [at.x, at.y + 0.5, at.z], kind: 'tnt' }) },
      { label: 'nitro', icon: (x) => { box(x, '#2fae44', '#0e4a18'); glyph(x, 'N', '#eafff0'); }, make: (at) => ({ t: 'crate', p: [at.x, at.y + 0.5, at.z], kind: 'nitro' }) },
      { label: 'mask', icon: (x) => { box(x, '#b5762f', '#7a4a18'); glyph(x, '☻', '#e89040'); }, make: (at) => ({ t: 'crate', p: [at.x, at.y + 0.5, at.z], kind: 'mask' }) },
      { label: '? crate', icon: (x) => { box(x, '#b5762f', '#7a4a18'); glyph(x, '?', '#ff8c1a'); }, make: (at) => ({ t: 'crate', p: [at.x, at.y + 0.5, at.z], kind: 'mystery' }) },
      { label: '! crate', icon: (x) => { box(x, '#b5762f', '#7a4a18'); glyph(x, '!', '#ffd934'); }, make: (at) => ({ t: 'crate', p: [at.x, at.y + 0.5, at.z], kind: 'bang' }) },
      { label: 'nitro !', icon: (x) => { box(x, '#2fae44', '#0e4a18'); glyph(x, '!', '#eafff0'); }, make: (at) => ({ t: 'crate', p: [at.x, at.y + 0.5, at.z], kind: 'nitrobang' }) },
      { label: 'metal', icon: (x) => { box(x, '#9aa2ac', '#666e78'); x.fillStyle = '#666e78'; for (const [rx, ry] of [[5, 5], [12, 5], [5, 12], [12, 12]]) x.fillRect(rx, ry, 2, 2); }, make: (at) => ({ t: 'metal', p: [at.x, at.y, at.z] }) },
      { label: 'checkpoint', icon: (x) => { box(x, '#2a5a8a', '#123049'); glyph(x, 'C', '#cfe8ff'); }, make: (at) => ({ t: 'checkpoint', p: [at.x, at.y + 0.5, at.z] }) },
    ],
  },
  {
    title: 'DRAW (pen tool)',
    items: [
      { label: 'platform', icon: (x) => { x.strokeStyle = '#cfd4cf'; x.fillStyle = 'rgba(207,212,207,0.35)'; x.lineWidth = 1.5; x.beginPath(); x.moveTo(3, 12); x.lineTo(7, 3); x.lineTo(15, 5); x.lineTo(13, 14); x.closePath(); x.fill(); x.stroke(); x.fillStyle = '#58e08a'; for (const [px, py] of [[3, 12], [7, 3], [15, 5], [13, 14]]) x.fillRect(px - 1.5, py - 1.5, 3, 3); }, penDraw: 'platform' },
      { label: 'death pit', icon: (x) => { x.strokeStyle = '#b0402a'; x.fillStyle = '#0a0a10'; x.lineWidth = 1.5; x.beginPath(); x.moveTo(3, 11); x.lineTo(8, 3); x.lineTo(16, 7); x.lineTo(12, 15); x.closePath(); x.fill(); x.stroke(); x.fillStyle = '#ff8a5e'; for (const [px, py] of [[3, 11], [8, 3], [16, 7], [12, 15]]) x.fillRect(px - 1.5, py - 1.5, 3, 3); }, penDraw: 'pit' },
      { label: 'wall', icon: (x) => { x.strokeStyle = '#9a8a7a'; x.fillStyle = 'rgba(154,138,122,0.4)'; x.lineWidth = 1.5; x.beginPath(); x.moveTo(3, 13); x.lineTo(6, 4); x.lineTo(14, 3); x.lineTo(15, 12); x.closePath(); x.fill(); x.stroke(); x.fillStyle = '#ffd75e'; for (const [px, py] of [[3, 13], [6, 4], [14, 3], [15, 12]]) x.fillRect(px - 1.5, py - 1.5, 3, 3); }, penDraw: 'wall' },
      { label: 'rail path', icon: (x) => { x.strokeStyle = '#b8a2ff'; x.lineWidth = 2; x.beginPath(); x.moveTo(2, 14); x.lineTo(7, 12); x.lineTo(11, 6); x.lineTo(16, 4); x.stroke(); x.fillStyle = '#d7c8ff'; for (const [px, py] of [[2, 14], [7, 12], [11, 6], [16, 4]]) x.fillRect(px - 1.5, py - 1.5, 3, 3); }, penDraw: 'rail' },
      { label: 'rope', icon: (x) => { x.strokeStyle = '#c2a878'; x.lineWidth = 2; x.beginPath(); x.moveTo(2, 5); x.quadraticCurveTo(9, 13, 16, 5); x.stroke(); x.fillStyle = '#6b4a2a'; x.fillRect(1, 4, 2, 8); x.fillRect(15, 4, 2, 8); }, make: (at) => ({ t: 'rope', p: [at.x, at.y + 2.5, at.z], len: 12, amp: 1.2, shake: 3 }) },
    ],
  },
  {
    title: 'CAMERA',
    items: [
      { label: 'cam node', icon: (x) => { x.fillStyle = '#ff5ad2'; x.beginPath(); x.moveTo(9, 2); x.lineTo(15, 9); x.lineTo(9, 16); x.lineTo(3, 9); x.closePath(); x.fill(); x.strokeStyle = '#ff8ae0'; x.lineWidth = 1.5; x.beginPath(); x.moveTo(9, 9); x.lineTo(17, 9); x.stroke(); }, make: (at) => ({ t: 'camnode', p: [at.x, at.y + 1.5, at.z] }) },
      { label: 'travel zone', icon: (x) => { x.strokeStyle = '#9a6cff'; x.fillStyle = 'rgba(154,108,255,0.25)'; x.lineWidth = 1.5; x.fillRect(2, 5, 14, 9); x.strokeRect(2, 5, 14, 9); glyph(x, '→', '#c9b2ff'); }, make: (at) => ({ t: 'zone', p: [at.x, at.y, at.z], s: [14, 1, 10], dir: 'E' }) },
    ],
  },
  {
    title: 'HAZARDS & THINGS',
    items: [
      { label: 'enemy', icon: (x) => { x.fillStyle = '#c03a2a'; x.beginPath(); x.arc(9, 11, 5, 0, 7); x.fill(); x.fillStyle = '#fff'; x.fillRect(6, 9, 2, 2); x.fillRect(10, 9, 2, 2); }, make: (at) => ({ t: 'enemy', p: [at.x, at.y + 0.5, at.z], range: 5, speed: 3 }) },
      { label: 'crusher', icon: (x) => { x.fillStyle = '#8f8f98'; x.fillRect(3, 2, 12, 7); glyph(x, '↓', '#2a2a30'); }, make: (at) => ({ t: 'crusher', p: [at.x, at.y, at.z], s: [4, 3, 3], cycle: 3.2, phase: 0 }) },
      { label: 'pendulum', icon: (x) => { x.strokeStyle = '#6a7078'; x.lineWidth = 1.5; x.beginPath(); x.moveTo(9, 2); x.lineTo(13, 11); x.stroke(); x.fillStyle = '#565c66'; x.beginPath(); x.arc(13.5, 13, 3, 0, 7); x.fill(); }, make: (at) => ({ t: 'pendulum', p: [at.x, at.y + 7, at.z], len: 5, amp: 1.0, speed: 1.6, phase: 0 }) },
      { label: 'wumpa', icon: (x) => { x.fillStyle = '#ff9028'; x.beginPath(); x.arc(9, 10, 5, 0, 7); x.fill(); x.fillStyle = '#3a9a4a'; x.fillRect(8, 3, 2, 3); }, make: (at) => ({ t: 'wumpa', p: [at.x, at.y + 1.2, at.z] }) },
      { label: 'crystal', icon: (x) => { x.fillStyle = '#c83af0'; x.beginPath(); x.moveTo(9, 2); x.lineTo(14, 9); x.lineTo(9, 16); x.lineTo(4, 9); x.closePath(); x.fill(); }, make: (at) => ({ t: 'crystal', p: [at.x, at.y + 0.5, at.z] }) },
      { label: 'finish gate', icon: (x) => { x.fillStyle = '#d8d8d8'; x.fillRect(3, 4, 2, 12); x.fillRect(13, 4, 2, 12); for (let i = 0; i < 4; i++) { x.fillStyle = i % 2 === 0 ? '#e8e8e8' : '#20242c'; x.fillRect(5 + i * 2, 4, 2, 3); } }, make: (at) => ({ t: 'gate', p: [at.x, at.y, at.z] }) },
      { label: 'tt clock', icon: (x) => { x.fillStyle = '#e8b53a'; x.fillRect(8, 2, 2, 3); x.beginPath(); x.arc(9, 10, 6, 0, 7); x.fill(); x.fillStyle = '#f4efdf'; x.beginPath(); x.arc(9, 10, 4.2, 0, 7); x.fill(); x.strokeStyle = '#3a3020'; x.lineWidth = 1.5; x.beginPath(); x.moveTo(9, 10); x.lineTo(9, 7); x.moveTo(9, 10); x.lineTo(12, 10); x.stroke(); }, make: (at) => ({ t: 'clock', p: [at.x, at.y, at.z] }) },
      { label: 'combo orb', icon: (x) => { x.fillStyle = 'rgba(70,232,130,0.4)'; x.fillRect(6, 2, 6, 15); x.fillRect(2, 7, 15, 6); x.fillStyle = '#46e882'; x.fillRect(7, 3, 4, 13); x.fillRect(3, 8, 13, 4); }, make: (at) => ({ t: 'comboorb', p: [at.x, at.y, at.z] }) },
    ],
  },
];

const CRATE_KINDS = ['wood', 'bouncy', 'metalbounce', 'nitro', 'tnt', 'mask', 'mystery', 'bang', 'nitrobang'] as const;

// components that grow draggable resize handles on double-click
const RESIZABLE = new Set(['platform', 'rock', 'wall', 'pit', 'crumble', 'crusher', 'ramp', 'rail', 'rope', 'zone', 'pipe', 'enemy', 'pendulum']);

// A resize handle: lives at `pos`, drags along `dir` (world space, outward),
// and `apply` rewrites the component from its grab-time snapshot given the
// travel distance — pure from `orig`, so re-applying while dragging is stable.
interface HandleDef {
  pos: THREE.Vector3;
  dir: THREE.Vector3;
  apply?: (orig: CustomComponent, c: CustomComponent, d: number) => void;
  vtx?: number; // polygon vertex index: drags on the ground plane instead of an axis
}
const HANDLE_GEO = new THREE.BoxGeometry(0.55, 0.55, 0.55);
// invisible fat hit-sphere around every handle: click targets stay forgiving
// even when the visible box is a few pixels at distance
const HANDLE_HIT_GEO = new THREE.SphereGeometry(1.0, 8, 6);
const NODE_COLOR = 0xffd75e; // resting node
const NODE_SEL_COLOR = 0x4da6ff; // selected node (Figma blue)

// grid rounding + structural copies, used all over the editor
const snapHalf = (v: number): number => Math.round(v * 2) / 2;
const deepClone = <T>(v: T): T => JSON.parse(JSON.stringify(v)) as T;

export class Editor {
  active = false;
  targetCourse = 7; // which level this session edits: 7 = custom sandbox, else a built-in's override
  private resetBtn: HTMLButtonElement | null = null; // "start over" / "restore original" — label swaps by target
  data: CustomLevelData;
  // SELECTION is an ordered set of component indices; the LAST one is the
  // primary (it drives the props panel, snapping, and align actions).
  private sel: number[] = [];
  private camera: THREE.PerspectiveCamera;
  private dom: HTMLElement;
  private scene: THREE.Scene;
  private getLevel: () => Level;
  private hooks: Hooks;
  private controls: OrbitControls | null = null;
  private panel!: HTMLElement;
  private propsEl!: HTMLElement;
  private raycaster = new THREE.Raycaster();
  private pointer = new THREE.Vector2();
  private selBoxes: THREE.Box3Helper[] = [];
  private spawnMarker: THREE.Group | null = null;
  private snap = true;
  // drag state — a grab on any selected component moves the WHOLE selection
  private dragging = false;
  private dragPlane = new THREE.Plane();
  private dragStart = new THREE.Vector3(); // plane hit at drag start
  private dragOrig: [number, number, number] = [0, 0, 0]; // grabbed comp at drag start
  private dragSel: { idx: number; p: [number, number, number] }[] = [];
  private dragVertical = false;
  private downAt: { x: number; y: number } | null = null;
  // marquee (shift-drag on empty space): screen-space rubber band
  private marquee: { x0: number; y0: number; x1: number; y1: number } | null = null;
  private marqueeEl: HTMLDivElement | null = null;
  // copy/paste — survives entering/leaving the editor within a session
  private clipboard: CustomComponent[] = [];
  private pasteBump = 0;
  private lastPasteKey = '';
  private hoverAt = 0;
  // nudge coalescing: a burst of arrow taps is ONE undo step
  private lastCoalesce = '';
  private lastCommitT = 0;
  // outliner (the layers pop-out): every component is a row, groups are
  // expandable nodes. Locks live per component (lk) — locked = untouchable.
  private layersEl: HTMLElement | null = null;
  private closedGroups = new Set<number>(); // collapsed outliner nodes
  private renaming: { kind: 'group' | 'item'; id: number } | null = null;
  private marqueeAdd = false; // shift-marquee adds; plain marquee replaces
  private marqueeNodes = false; // node mode: the sweep selects NODES of the edited shape
  private camSaveAt = 0;
  // PEN TOOL: click-to-draw polygon platforms / pits / walls
  private drawing: { t: 'platform' | 'pit' | 'wall' | 'rail'; y: number; pts: THREE.Vector3[] } | null = null;
  private selVtxs = new Set<number>(); // nodes picked in resize mode (shift/cmd adds, marquee sweeps) — props batch-edit their shared values
  private drawVis: THREE.Group | null = null;
  // pop-out side panels (item picker / layers) + view cluster + space-pan
  private popWrap: HTMLElement | null = null;
  private popAdd: HTMLElement | null = null;
  private popLayers: HTMLElement | null = null;
  private tabAdd: HTMLButtonElement | null = null;
  private tabLayers: HTMLButtonElement | null = null;
  private spaceHeld = false;
  // resize-handle state (enter by double-clicking a component)
  private resizeIdx = -1;
  private hdlDefs: HandleDef[] = [];
  private handleGroup: THREE.Group | null = null;
  private handleMeshes: THREE.Mesh[] = []; // visible boxes, one per handle def
  private handleHits: THREE.Mesh[] = []; // invisible fat twins: the forgiving click targets
  private hdlDrag: {
    i: number;
    lineO: THREE.Vector3;
    lineD: THREE.Vector3;
    t0: number;
    orig: CustomComponent;
    vtx?: number; // polygon vertex drag: uses `plane` instead of the axis line
    plane?: THREE.Plane;
  } | null = null;
  private lastLiveRebuild = 0;
  private resizeHintShown = false;

  constructor(
    scene: THREE.Scene,
    camera: THREE.PerspectiveCamera,
    dom: HTMLElement,
    getLevel: () => Level,
    hooks: Hooks,
  ) {
    this.scene = scene;
    this.camera = camera;
    this.dom = dom;
    this.getLevel = getLevel;
    this.hooks = hooks;
    this.data = getCustomLevelData();
    this.buildPanel();
    dom.addEventListener('pointerdown', this.onDown);
    dom.addEventListener('pointermove', this.onMove);
    dom.addEventListener('pointerup', this.onUp);
    dom.addEventListener('dblclick', this.onDbl);
    window.addEventListener('keydown', this.onKey);
    window.addEventListener('keyup', this.onKeyUp);
  }

  enter(target = 7): void {
    if (this.active) return;
    this.active = true;
    this.targetCourse = target;
    localStorage.setItem('protoEditorTarget', String(target)); // refresh lands on the same level
    this.data = migrateCustomLevel(getEditData(target));
    // fresh history per target: switching levels must not undo across them
    this.lastCommitted = JSON.stringify(this.data);
    this.undoStack.length = 0;
    this.redoStack.length = 0;
    this.controls = new OrbitControls(this.camera, this.dom);
    this.controls.enableDamping = true;
    this.controls.dampingFactor = 0.12;
    // FIGMA pointer rules: LEFT is for selecting and moving things (marquee
    // on empty space) — never the camera. Orbit = right-drag, pan = middle
    // or space-drag, zoom = wheel.
    this.controls.mouseButtons.LEFT = -1 as unknown as THREE.MOUSE;
    this.controls.mouseButtons.MIDDLE = THREE.MOUSE.PAN;
    this.controls.mouseButtons.RIGHT = THREE.MOUSE.ROTATE;
    // refresh-proof: come back exactly where you were looking
    let restored = false;
    try {
      const cam = JSON.parse(localStorage.getItem('protoEditorCam') ?? 'null') as {
        p: number[];
        t: number[];
      } | null;
      if (cam && cam.p?.length === 3 && cam.t?.length === 3) {
        this.camera.position.set(cam.p[0], cam.p[1], cam.p[2]);
        this.controls.target.set(cam.t[0], cam.t[1], cam.t[2]);
        restored = true;
      }
    } catch {
      /* fresh view below */
    }
    if (!restored) {
      this.controls.target.set(this.data.spawn[0], this.data.spawn[1], this.data.spawn[2] - 6);
      this.camera.position.set(this.data.spawn[0] + 16, this.data.spawn[1] + 26, this.data.spawn[2] + 26);
    }
    localStorage.setItem('protoEditorOpen', '1'); // refresh lands back in the editor
    if (this.resetBtn) this.resetBtn.textContent = target === 7 ? 'start over' : 'restore original';
    document.body.classList.add('ed-active'); // hides the play HUD under the tools
    this.panel.style.display = 'block';
    if (this.popWrap) this.popWrap.style.display = 'block';
    this.setPop((localStorage.getItem('protoEditorPop') as 'add' | 'layers' | '') ?? 'add');
    this.select(-1);
    this.renderLayers();
    this.refreshSpawnMarker();
    this.setGhostsVisible(true);
    const editing = target === 7 ? 'CUSTOM SANDBOX' : `EDITING: ${LEVEL_NAMES[target].toUpperCase()}`;
    this.hooks.showMsg(editing, 'drag = select & move · RIGHT-drag = orbit · space = pan');
  }

  exit(): void {
    if (!this.active) return;
    this.active = false;
    this.saveCam();
    localStorage.removeItem('protoEditorOpen');
    localStorage.removeItem('protoEditorTarget');
    this.controls?.dispose();
    this.controls = null;
    document.body.classList.remove('ed-active');
    this.panel.style.display = 'none';
    if (this.popWrap) this.popWrap.style.display = 'none';
    this.select(-1);
    this.cancelDraw();
    this.marquee = null;
    this.hideMarquee();
    this.dragging = false;
    this.dragSel = [];
    this.spaceHeld = false;
    this.dom.style.cursor = '';
    this.setGhostsVisible(false);
    if (this.spawnMarker) {
      this.scene.remove(this.spawnMarker);
      this.spawnMarker = null;
    }
  }

  update(): void {
    this.controls?.update();
    // keep resize handles a steady on-screen size at any zoom; selected
    // nodes read a step bigger, and the invisible hit targets track along
    this.handleMeshes.forEach((m, i) => {
      const base = THREE.MathUtils.clamp(this.camera.position.distanceTo(m.position) * 0.022, 0.7, 3);
      const def = this.hdlDefs[i];
      const selected = def?.vtx !== undefined && this.selVtxs.has(def.vtx);
      m.scale.setScalar(base * (selected ? 1.35 : 1));
      const hit = this.handleHits[i];
      if (hit) hit.scale.setScalar(base);
    });
    // periodic camera save: a refresh mid-edit comes back to this exact view
    const now = performance.now();
    if (this.active && now - this.camSaveAt > 1500) {
      this.camSaveAt = now;
      this.saveCam();
    }
  }

  private saveCam(): void {
    if (!this.controls) return;
    try {
      localStorage.setItem(
        'protoEditorCam',
        JSON.stringify({
          p: this.camera.position.toArray().map((v) => +v.toFixed(2)),
          t: this.controls.target.toArray().map((v) => +v.toFixed(2)),
        }),
      );
    } catch {
      /* storage full: skip */
    }
  }

  // the primary selection (last picked) — or -1
  private get selected(): number {
    return this.sel.length ? this.sel[this.sel.length - 1] : -1;
  }

  get selectedIndex(): number {
    return this.selected;
  }

  get selection(): number[] {
    return [...this.sel];
  }

  // test/debug hook: what would a click at these client coords select?
  pickAt(clientX: number, clientY: number): number {
    return this.pick({ clientX, clientY } as PointerEvent);
  }

  // Adopt a full level (drag-dropped file / shared JSON) as the working data.
  importLevel(d: CustomLevelData): void {
    // enforce the one-crystal rule on imported files too (keep the last)
    const lastCrystal = d.components.map((c) => c.t).lastIndexOf('crystal');
    d.components = d.components.filter((c, i) => c.t !== 'crystal' || i === lastCrystal);
    this.data = migrateCustomLevel(d);
    this.select(-1);
    this.commit();
  }

  // main calls this after every rebuild so the highlight tracks fresh meshes
  onLevelRebuilt(): void {
    const kept = this.sel.filter((i) => i < this.data.components.length);
    if (kept.length !== this.sel.length) this.setSelection(kept);
    else this.refreshSelectionBox();
    if (this.resizeIdx >= this.data.components.length) this.resizeIdx = -1;
    this.refreshHandles();
    this.refreshSpawnMarker();
    this.setGhostsVisible(this.active);
  }

  // invisible walls (and future collider-only pieces) render as ghosts while
  // editing, vanish in play
  private setGhostsVisible(on: boolean): void {
    this.getLevel().pickRoot.traverse((o) => {
      if (o.userData.editorGhost) o.visible = on;
    });
  }

  // ---- data mutation + history ----

  private undoStack: string[] = [];
  private redoStack: string[] = [];
  private lastCommitted = '';

  // `coalesce`: edits sharing a key within a second merge into ONE undo step
  // (arrow-key nudge bursts, held number spinners)
  private commit(rebuild = true, coalesce = ''): void {
    const now = JSON.stringify(this.data);
    const t = performance.now();
    const chained = coalesce !== '' && coalesce === this.lastCoalesce && t - this.lastCommitT < 1000;
    if (this.lastCommitted && now !== this.lastCommitted && !chained) {
      this.undoStack.push(this.lastCommitted);
      if (this.undoStack.length > 100) this.undoStack.shift();
      this.redoStack.length = 0; // a fresh edit forks history
    }
    this.lastCoalesce = coalesce;
    this.lastCommitT = t;
    this.lastCommitted = now;
    this.pruneGroups();
    this.renderLayers();
    if (this.targetCourse === 7) setCustomLevelData(this.data); // keep the sandbox cache fresh
    persistEditData(this.targetCourse, now); // routes to the sandbox or the level's override slot
    if (rebuild) this.hooks.rebuild();
  }

  // swap in a history state WITHOUT recording it as a new edit
  private applyState(json: string): void {
    this.data = migrateCustomLevel(JSON.parse(json) as CustomLevelData);
    this.lastCommitted = json;
    if (this.targetCourse === 7) setCustomLevelData(this.data);
    persistEditData(this.targetCourse, json);
    this.select(-1);
    this.hooks.rebuild();
  }

  undo(): void {
    const prev = this.undoStack.pop();
    if (!prev) return;
    this.redoStack.push(JSON.stringify(this.data));
    this.applyState(prev);
  }

  redo(): void {
    const next = this.redoStack.pop();
    if (!next) return;
    this.undoStack.push(JSON.stringify(this.data));
    this.applyState(next);
  }

  private addComponent(c: CustomComponent): void {
    // ONE crystal / gate / clock / combo orb per level: a new one replaces the old
    if (c.t === 'crystal' || c.t === 'gate' || c.t === 'clock' || c.t === 'comboorb') {
      this.data.components = this.data.components.filter((o) => o.t !== c.t);
    }
    this.data.components.push(c);
    this.commit();
    this.select(this.data.components.length - 1);
  }

  // append a batch (duplicate/paste) as ONE undo step and select the copies.
  // The one-crystal / one-gate rules hold: one in the batch replaces the level's.
  private addBatch(batch: CustomComponent[]): void {
    if (batch.length === 0) return;
    let clean = batch;
    for (const t of ['crystal', 'gate', 'clock', 'comboorb'] as const) {
      const last = clean.map((c) => c.t).lastIndexOf(t);
      if (last >= 0) {
        clean = clean.filter((c, i) => c.t !== t || i === last);
        this.data.components = this.data.components.filter((o) => o.t !== t);
      }
    }
    if (clean.length === 0) return;
    const start = this.data.components.length;
    this.data.components.push(...clean);
    this.commit();
    this.setSelection(clean.map((_, i) => start + i));
  }

  private deleteSelected(): void {
    if (this.sel.length === 0) return;
    // the gate + run-mode activators are level furniture like the spawn
    // point — move them, never delete them (a load would regrow them anyway)
    const KEEP = new Set(['gate', 'clock', 'comboorb']);
    const dying = [...this.sel].filter((i) => !KEEP.has(this.data.components[i].t)).sort((a, b) => b - a);
    if (dying.length < this.sel.length)
      this.hooks.showMsg('GATE & ACTIVATORS STAY', 'every level keeps its gate, stopwatch and combo orb — move them instead');
    if (dying.length === 0) return;
    for (const i of dying) this.data.components.splice(i, 1);
    this.select(-1);
    this.commit();
  }

  private duplicateSelected(): void {
    if (this.sel.length === 0) return;
    const copies = this.sel.map((i) => {
      const copy = deepClone(this.data.components[i]);
      copy.p = [copy.p[0] + 3, copy.p[1], copy.p[2] + 3];
      return copy;
    });
    this.remapGroups(copies); // fresh group wiring for the copies
    this.addBatch(copies);
  }

  // ---- clipboard ----

  copySelected(): void {
    if (this.sel.length === 0) return;
    this.clipboard = this.sel.map(
      (i) => deepClone(this.data.components[i]),
    );
    this.pasteBump = 0;
    this.lastPasteKey = '';
    this.hooks.showMsg(`COPIED ${this.clipboard.length}`, 'paste with ⌘V — lands at the camera focus');
  }

  cutSelected(): void {
    if (this.sel.length === 0) return;
    this.copySelected();
    this.deleteSelected();
  }

  // paste keeps the group's exact layout and heights; its X/Z centroid moves
  // to the camera focus. Pasting again at the same focus stacks with a bump
  // so repeats never land invisibly on top of each other.
  paste(): void {
    if (this.clipboard.length === 0) return;
    const t = this.controls ? this.controls.target : new THREE.Vector3();
    let cx = 0;
    let cz = 0;
    for (const c of this.clipboard) {
      cx += c.p[0];
      cz += c.p[2];
    }
    cx /= this.clipboard.length;
    cz /= this.clipboard.length;
    const key = `${Math.round(t.x)},${Math.round(t.z)}`;
    if (key === this.lastPasteKey) this.pasteBump += 2;
    else {
      this.pasteBump = 0;
      this.lastPasteKey = key;
    }
    let dx = t.x - cx + this.pasteBump;
    let dz = t.z - cz + this.pasteBump;
    if (this.snap) {
      dx = snapHalf(dx);
      dz = snapHalf(dz);
    }
    const copies = this.clipboard.map((c) => {
      const copy = deepClone(c);
      copy.p = [copy.p[0] + dx, copy.p[1], copy.p[2] + dz];
      return copy;
    });
    this.remapGroups(copies); // fresh group wiring for the batch
    this.addBatch(copies);
  }

  // ---- locks (per component; the outliner toggles them) ----

  private isLockedIdx(idx: number): boolean {
    return !!this.data.components[idx]?.lk;
  }

  // ---- groups (nesting: a group's parent is another group) ----

  private chainOf(idx: number): number[] {
    const c = this.data.components[idx];
    return c ? groupChainOf(c, this.data) : [];
  }

  private rootGroupOf(idx: number): number | undefined {
    const chain = this.chainOf(idx);
    return chain.length ? chain[chain.length - 1] : undefined;
  }

  private groupMembers(gid: number): number[] {
    const out: number[] = [];
    for (let i = 0; i < this.data.components.length; i++) {
      if (this.chainOf(i).includes(gid)) out.push(i);
    }
    return out;
  }

  // a click on a grouped component means the whole (outermost) group —
  // minus anything on a locked layer
  private expandToGroup(idx: number): number[] {
    if (idx < 0) return [];
    const root = this.rootGroupOf(idx);
    const all = root === undefined ? [idx] : this.groupMembers(root);
    return all.filter((i) => !this.isLockedIdx(i));
  }

  private nextGroupId(): number {
    return (this.data.groups ?? []).reduce((m, g) => Math.max(m, g.id), -1) + 1;
  }

  // ⌘G: bundle the selection. Fully-selected existing groups nest INTO the
  // new group; loose components join it directly (a component that's only
  // partially group-selected is pulled out of its old group — Figma rules).
  groupSelection(): void {
    if (this.sel.length < 2) return;
    if (!this.data.groups) this.data.groups = [];
    const G = this.nextGroupId();
    const selSet = new Set(this.sel);
    // read the WHOLE plan before mutating: reparenting mid-loop would send
    // later chain walks through the half-built new group
    const rootOf = new Map<number, number | undefined>();
    for (const idx of this.sel) rootOf.set(idx, this.rootGroupOf(idx));
    const fullRoots = new Set<number>();
    for (const idx of this.sel) {
      const r = rootOf.get(idx);
      if (
        r !== undefined &&
        !fullRoots.has(r) &&
        this.groupMembers(r).every((m) => selSet.has(m) || this.isLockedIdx(m))
      ) {
        fullRoots.add(r);
      }
    }
    // fully-selected groups nest whole; everything else joins directly
    for (const idx of this.sel) {
      const r = rootOf.get(idx);
      if (r === undefined || !fullRoots.has(r)) this.data.components[idx].grp = G;
    }
    for (const r of fullRoots) {
      const g = this.data.groups.find((x) => x.id === r);
      if (g) g.parent = G;
    }
    this.data.groups.push({ id: G });
    this.commit();
    this.hooks.showMsg(`GROUPED ${this.sel.length}`, 'a "!" crate in a group wires its outline crates');
  }

  // ⌘⇧G: dissolve the selection's outermost group(s) one level
  ungroupSelection(): void {
    if (!this.data.groups) return;
    const roots = new Set<number>();
    for (const idx of this.sel) {
      const r = this.rootGroupOf(idx);
      if (r !== undefined) roots.add(r);
    }
    if (roots.size === 0) return;
    for (const r of roots) {
      for (const c of this.data.components) if (c.grp === r) c.grp = undefined;
      for (const g of this.data.groups) if (g.parent === r) g.parent = undefined;
      this.data.groups = this.data.groups.filter((g) => g.id !== r);
    }
    this.commit();
    this.hooks.showMsg('UNGROUPED');
  }

  // drop group entries no component chain references (post delete/ungroup)
  private pruneGroups(): void {
    if (!this.data.groups || this.data.groups.length === 0) return;
    const used = new Set<number>();
    for (const c of this.data.components) {
      for (const id of groupChainOf(c, this.data)) used.add(id);
    }
    this.data.groups = this.data.groups.filter((g) => used.has(g.id));
  }

  // pasted/duplicated components get a FRESH copy of their group structure
  // (same wiring within the batch, no leash back to the originals)
  private remapGroups(copies: CustomComponent[]): void {
    if (!this.data.groups) return;
    const referenced = new Set<number>();
    for (const c of copies) for (const id of groupChainOf(c, this.data)) referenced.add(id);
    if (referenced.size === 0) return;
    const map = new Map<number, number>();
    let next = this.nextGroupId();
    for (const id of referenced) map.set(id, next++);
    for (const id of referenced) {
      const src = this.data.groups.find((g) => g.id === id);
      const parent = src?.parent !== undefined && map.has(src.parent) ? map.get(src.parent) : undefined;
      this.data.groups.push(parent !== undefined ? { id: map.get(id)!, parent } : { id: map.get(id)! });
    }
    for (const c of copies) {
      if (c.grp !== undefined && map.has(c.grp)) c.grp = map.get(c.grp);
    }
  }

  // ---- selection + picking ----

  private select(idx: number): void {
    this.setSelection(idx < 0 ? [] : [idx]);
  }

  private setSelection(list: number[]): void {
    this.selVtxs.clear(); // node picks don't survive a selection change
    const seen = new Set<number>();
    const valid: number[] = [];
    for (const i of list) {
      if (i >= 0 && i < this.data.components.length && !seen.has(i)) {
        seen.add(i);
        valid.push(i);
      }
    }
    // resize handles only make sense on a lone component
    if (valid.length !== 1 || valid[0] !== this.resizeIdx) this.setResize(-1);
    this.sel = valid;
    this.refreshSelectionBox();
    this.renderProps();
    this.renderLayers(); // outliner rows highlight the live selection
  }

  private objectsFor(idx: number): THREE.Object3D[] {
    const out: THREE.Object3D[] = [];
    for (const child of this.getLevel().pickRoot.children) {
      if (child.userData.editorIdx === idx) out.push(child);
    }
    return out;
  }

  private boxFor(idx: number): THREE.Box3 | null {
    const objs = this.objectsFor(idx);
    if (objs.length === 0) return null;
    const box = new THREE.Box3();
    for (const o of objs) box.expandByObject(o);
    return box;
  }

  private refreshSelectionBox(): void {
    for (const b of this.selBoxes) this.scene.remove(b);
    this.selBoxes = [];
    for (const idx of this.sel) {
      const box = this.boxFor(idx);
      if (!box) continue;
      box.expandByScalar(0.15);
      // primary pops bright green; the rest of the selection reads softer
      const primary = idx === this.selected;
      const helper = new THREE.Box3Helper(box, new THREE.Color(primary ? 0x58e08a : 0x2f9a86));
      this.scene.add(helper);
      this.selBoxes.push(helper);
    }
    // one blue hull per fully-selected group: the "this moves as a unit" read
    const roots = new Set<number>();
    for (const idx of this.sel) {
      const r = this.rootGroupOf(idx);
      if (r !== undefined) roots.add(r);
    }
    for (const r of roots) {
      const members = this.groupMembers(r);
      if (!members.every((m) => this.sel.includes(m) || this.isLockedIdx(m))) continue;
      const hull = new THREE.Box3();
      let any = false;
      for (const m of members) {
        const b = this.boxFor(m);
        if (b) {
          hull.union(b);
          any = true;
        }
      }
      if (!any) continue;
      hull.expandByScalar(0.32);
      const helper = new THREE.Box3Helper(hull, new THREE.Color(0x5aa9ff));
      this.scene.add(helper);
      this.selBoxes.push(helper);
    }
  }

  // F: frame the selection (or the whole level) in the orbit view
  private frameSelection(): void {
    if (!this.controls) return;
    const box = new THREE.Box3();
    let any = false;
    const idxs = this.sel.length ? this.sel : this.data.components.map((_, i) => i);
    for (const idx of idxs) {
      const b = this.boxFor(idx);
      if (b) {
        box.union(b);
        any = true;
      }
    }
    if (!any) return;
    const cen = box.getCenter(new THREE.Vector3());
    const size = box.getSize(new THREE.Vector3()).length();
    const dist = THREE.MathUtils.clamp(size * 1.1 + 6, 10, 120);
    const dir = new THREE.Vector3().subVectors(this.camera.position, this.controls.target).normalize();
    if (dir.lengthSq() < 0.5) dir.set(0.45, 0.7, 0.55).normalize();
    this.controls.target.copy(cen);
    this.camera.position.copy(cen).addScaledVector(dir, dist);
  }

  // arrow keys: nudge the selection one grid step, mapped to the camera view
  // (up = away from you). A burst of taps coalesces into one undo step.
  private nudge(fwd: number, right: number, up: number): void {
    if (this.sel.length === 0 || !this.controls) return;
    const step = this.snap ? 0.5 : 0.25;
    const f = new THREE.Vector3().subVectors(this.controls.target, this.camera.position);
    f.y = 0;
    if (f.lengthSq() < 1e-6) f.set(0, 0, -1);
    f.normalize();
    // snap "forward" to the dominant world axis so nudges stay on-grid
    if (Math.abs(f.x) > Math.abs(f.z)) f.set(Math.sign(f.x), 0, 0);
    else f.set(0, 0, Math.sign(f.z));
    const r = new THREE.Vector3(-f.z, 0, f.x); // forward rotated to screen-right
    const d = new THREE.Vector3()
      .addScaledVector(f, fwd * step)
      .addScaledVector(r, right * step)
      .setY(up * step);
    for (const idx of this.sel) {
      const c = this.data.components[idx];
      c.p = [c.p[0] + d.x, c.p[1] + d.y, c.p[2] + d.z];
    }
    this.commit(true, 'nudge');
  }

  private pick(e: PointerEvent): number {
    const r = this.dom.getBoundingClientRect();
    this.pointer.set(((e.clientX - r.left) / r.width) * 2 - 1, -((e.clientY - r.top) / r.height) * 2 + 1);
    this.raycaster.setFromCamera(this.pointer, this.camera);
    // A commit rebuilds the level synchronously; a click landing before the
    // next render (the 2nd half of a double-click) would raycast fresh meshes
    // with identity matrices — everything "at the origin" — and mis-pick.
    const root = this.getLevel().pickRoot;
    root.updateMatrixWorld(true);
    const hits = this.raycaster.intersectObjects(root.children, true);
    for (const h of hits) {
      let o: THREE.Object3D | null = h.object;
      while (o) {
        if (o.userData.editorIdx !== undefined) {
          const idx = o.userData.editorIdx as number;
          // locked layers are click-through: keep walking the deeper hits
          if (this.isLockedIdx(idx)) break;
          return idx;
        }
        o = o.parent;
      }
    }
    return -1;
  }

  private groundPoint(e: PointerEvent, plane: THREE.Plane, out: THREE.Vector3): boolean {
    const r = this.dom.getBoundingClientRect();
    this.pointer.set(((e.clientX - r.left) / r.width) * 2 - 1, -((e.clientY - r.top) / r.height) * 2 + 1);
    this.raycaster.setFromCamera(this.pointer, this.camera);
    return this.raycaster.ray.intersectPlane(plane, out) !== null;
  }

  // ---- resize handles (double-click a component) ----

  private setResize(idx: number): void {
    this.resizeIdx = idx;
    if (idx >= 0) this.materializeDims(this.data.components[idx]);
    this.refreshHandles();
  }

  // fill defaulted dimensions in, so handle math (and its grab snapshot) is concrete
  private materializeDims(c: CustomComponent): void {
    if (c.t === 'platform') c.s = c.s ?? [8, 1, 8];
    else if (c.t === 'rock') c.s = c.s ?? [3, 2, 3];
    else if (c.t === 'wall') c.s = c.s ?? [8, 4, 1];
    else if (c.t === 'pit') c.s = c.s ?? [6, 1, 6];
    else if (c.t === 'crumble') c.s = c.s ?? [3, 1, 3];
    else if (c.t === 'crusher') c.s = c.s ?? [4, 3, 3];
    else if (c.t === 'ramp') {
      c.len = c.len ?? 10;
      c.rise = c.rise ?? 4;
      c.w = c.w ?? 8;
    } else if (c.t === 'rail') c.len = c.len ?? 12;
    else if (c.t === 'pipe') c.len = c.len ?? 36;
    else if (c.t === 'enemy') c.range = c.range ?? 5;
    else if (c.t === 'pendulum') c.len = c.len ?? 5;
  }

  private handleDefsFor(c: CustomComponent): HandleDef[] {
    // drawn shapes: every node is a handle, dragged freely on the ground
    // plane (the axis machinery below is for box faces). Rails are open
    // 2+ node paths; polygons need 3+.
    const isPoly = c.pts && c.pts.length >= 3 && (c.t === 'platform' || c.t === 'wall' || c.t === 'pit');
    const isPath = c.pts && c.pts.length >= 2 && c.t === 'rail';
    if (c.pts && (isPoly || isPath)) {
      const y =
        c.t === 'wall'
          ? c.p[1] + (c.s?.[1] ?? 4)
          : c.t === 'platform'
            ? c.p[1] + (c.s?.[1] ?? 1) / 2
            : c.p[1] + 0.15;
      // rail nodes ride their own height offsets (climbing grind lines)
      return c.pts.map((pt, i) => ({
        pos: new THREE.Vector3(
          c.p[0] + pt[0],
          c.t === 'rail' ? c.p[1] + (pt[3] ?? 0) + 0.1 : y,
          c.p[2] + pt[1],
        ),
        dir: new THREE.Vector3(0, 1, 0),
        vtx: i,
      }));
    }
    const defs: HandleDef[] = [];
    const P = new THREE.Vector3(c.p[0], c.p[1], c.p[2]);
    const UP = new THREE.Vector3(0, 1, 0);
    const yaw = THREE.MathUtils.degToRad(c.yaw ?? 0);
    const loc = (x: number, y: number, z: number): THREE.Vector3 =>
      new THREE.Vector3(x, y, z).applyAxisAngle(UP, yaw);
    // drag a box face outward: s[idx] grows and (if anchored) the component
    // center shifts by half, so the OPPOSITE face stays where it was
    const face = (u: THREE.Vector3, at: THREE.Vector3, idx: number, min: number, anchor = true): void => {
      defs.push({
        pos: at,
        dir: u,
        apply: (orig, cc, d) => {
          const os = orig.s!;
          const v = Math.max(min, os[idx] + d);
          const ns: [number, number, number] = [os[0], os[1], os[2]];
          ns[idx] = v;
          cc.s = ns;
          const g = anchor ? (v - os[idx]) / 2 : 0;
          cc.p = [orig.p[0] + u.x * g, orig.p[1] + u.y * g, orig.p[2] + u.z * g];
        },
      });
    };
    // length-ish scalar (rail/pipe len, ramp w, enemy range); recenter keeps
    // the far end planted while this end follows the handle
    const span = (
      u: THREE.Vector3,
      at: THREE.Vector3,
      key: 'len' | 'w' | 'range',
      min: number,
      recenter: boolean,
    ): void => {
      defs.push({
        pos: at,
        dir: u,
        apply: (orig, cc, d) => {
          const v = Math.max(min, (orig[key] as number) + d);
          cc[key] = v;
          const g = recenter ? (v - (orig[key] as number)) / 2 : 0;
          cc.p = [orig.p[0] + u.x * g, orig.p[1] + u.y * g, orig.p[2] + u.z * g];
        },
      });
    };
    if (c.t === 'platform' || c.t === 'rock') {
      const s = c.s!;
      face(loc(1, 0, 0), P.clone().addScaledVector(loc(1, 0, 0), s[0] / 2), 0, 0.5);
      face(loc(-1, 0, 0), P.clone().addScaledVector(loc(-1, 0, 0), s[0] / 2), 0, 0.5);
      face(loc(0, 0, 1), P.clone().addScaledVector(loc(0, 0, 1), s[2] / 2), 2, 0.5);
      face(loc(0, 0, -1), P.clone().addScaledVector(loc(0, 0, -1), s[2] / 2), 2, 0.5);
      face(new THREE.Vector3(0, 1, 0), P.clone().setY(P.y + s[1] / 2), 1, 0.5);
      face(new THREE.Vector3(0, -1, 0), P.clone().setY(P.y - s[1] / 2), 1, 0.5);
    } else if (c.t === 'wall') {
      const s = c.s!;
      const mid = P.clone().setY(P.y + s[1] / 2); // p is the BASE center
      const ux = loc(1, 0, 0); // handles ride the SPUN faces
      const uz = loc(0, 0, 1);
      face(ux, mid.clone().addScaledVector(ux, s[0] / 2), 0, 0.5);
      face(ux.clone().negate(), mid.clone().addScaledVector(ux, -s[0] / 2), 0, 0.5);
      face(uz, mid.clone().addScaledVector(uz, s[2] / 2), 2, 0.5);
      face(uz.clone().negate(), mid.clone().addScaledVector(uz, -s[2] / 2), 2, 0.5);
      face(new THREE.Vector3(0, 1, 0), P.clone().setY(P.y + s[1]), 1, 0.5, false); // grows up from the base
    } else if (c.t === 'pit' || c.t === 'crumble' || c.t === 'crusher' || c.t === 'zone') {
      const s = c.s ?? [14, 1, 10];
      const y = c.t === 'crusher' ? P.y + 1.2 : c.t === 'zone' ? P.y + 0.5 : P.y;
      const mid = P.clone().setY(y);
      const ux = loc(1, 0, 0); // spun pits/crumbles keep handles on their faces (crusher/zone yaw = 0)
      const uz = loc(0, 0, 1);
      face(ux, mid.clone().addScaledVector(ux, s[0] / 2), 0, 1);
      face(ux.clone().negate(), mid.clone().addScaledVector(ux, -s[0] / 2), 0, 1);
      face(uz, mid.clone().addScaledVector(uz, s[2] / 2), 2, 1);
      face(uz.clone().negate(), mid.clone().addScaledVector(uz, -s[2] / 2), 2, 1);
    } else if (c.t === 'ramp') {
      const len = c.len!;
      const rise = c.rise!;
      const w = c.w!;
      const zl = loc(0, 0, 1); // toward the LOW end
      const xl = loc(1, 0, 0);
      span(zl, P.clone().addScaledVector(zl, len / 2).setY(P.y + 0.2), 'len', 1, true);
      span(zl.clone().negate(), P.clone().addScaledVector(zl, -len / 2).setY(P.y + rise), 'len', 1, true);
      span(xl, P.clone().addScaledVector(xl, w / 2).setY(P.y + rise / 2), 'w', 1, true);
      span(xl.clone().negate(), P.clone().addScaledVector(xl, -w / 2).setY(P.y + rise / 2), 'w', 1, true);
      defs.push({
        pos: P.clone().addScaledVector(zl, -len / 2).setY(P.y + rise + 0.4),
        dir: new THREE.Vector3(0, 1, 0),
        apply: (orig, cc, d) => {
          cc.rise = orig.rise! + d;
        },
      });
    } else if (c.t === 'rail' || c.t === 'rope') {
      const u = loc(0, 0, 1); // (sin yaw, 0, cos yaw): the run of the line
      const len = c.len ?? 12;
      span(u, P.clone().addScaledVector(u, len / 2), 'len', 1, true);
      span(u.clone().negate(), P.clone().addScaledVector(u, -len / 2), 'len', 1, true);
    } else if (c.t === 'pipe') {
      const u = (c.axis ?? 'z') === 'z' ? new THREE.Vector3(0, 0, 1) : new THREE.Vector3(1, 0, 0);
      const len = c.len!;
      span(u, P.clone().addScaledVector(u, len / 2).setY(P.y + 1.2), 'len', 6, true);
      span(u.clone().negate(), P.clone().addScaledVector(u, -len / 2).setY(P.y + 1.2), 'len', 6, true);
    } else if (c.t === 'enemy') {
      const r = c.range!;
      span(new THREE.Vector3(1, 0, 0), new THREE.Vector3(P.x + r, P.y + 0.4, P.z), 'range', 0.5, false);
      span(new THREE.Vector3(-1, 0, 0), new THREE.Vector3(P.x - r, P.y + 0.4, P.z), 'range', 0.5, false);
    } else if (c.t === 'pendulum') {
      defs.push({
        pos: P.clone().setY(P.y - c.len!),
        dir: new THREE.Vector3(0, -1, 0),
        apply: (orig, cc, d) => {
          cc.len = Math.max(1, orig.len! + d);
        },
      });
    }
    return defs;
  }

  private refreshHandles(): void {
    if (this.handleGroup) {
      this.scene.remove(this.handleGroup);
      this.handleGroup = null;
    }
    this.handleMeshes = [];
    this.handleHits = [];
    this.hdlDefs = [];
    if (!this.active || this.resizeIdx < 0) return;
    const c = this.data.components[this.resizeIdx];
    if (!c) {
      this.resizeIdx = -1;
      return;
    }
    this.hdlDefs = this.handleDefsFor(c);
    if (this.hdlDefs.length === 0) {
      this.resizeIdx = -1;
      return;
    }
    const g = new THREE.Group();
    this.hdlDefs.forEach((def, i) => {
      const m = new THREE.Mesh(
        HANDLE_GEO,
        new THREE.MeshBasicMaterial({ color: NODE_COLOR, depthTest: false, transparent: true, opacity: 0.92 }),
      );
      m.renderOrder = 999; // draw on top: grabbable even inside geometry
      m.position.copy(def.pos);
      m.userData.hdl = i;
      g.add(m);
      this.handleMeshes.push(m);
      // fat invisible twin: the actual click target (forgiving at any zoom)
      const hit = new THREE.Mesh(
        HANDLE_HIT_GEO,
        new THREE.MeshBasicMaterial({ transparent: true, opacity: 0, depthTest: false, depthWrite: false }),
      );
      hit.position.copy(def.pos);
      hit.userData.hdl = i;
      g.add(hit);
      this.handleHits.push(hit);
    });
    this.scene.add(g);
    this.handleGroup = g;
    this.tintHandles();
  }

  // selected nodes read Figma-blue (their size bump lives in update(), which
  // owns handle scale for constant screen size)
  private tintHandles(): void {
    this.handleMeshes.forEach((m, i) => {
      const isNode = this.hdlDefs[i]?.vtx !== undefined;
      const selected = isNode && this.selVtxs.has(this.hdlDefs[i].vtx!);
      (m.material as THREE.MeshBasicMaterial).color.setHex(selected ? NODE_SEL_COLOR : NODE_COLOR);
    });
  }

  private setRay(e: { clientX: number; clientY: number }): void {
    const r = this.dom.getBoundingClientRect();
    this.pointer.set(((e.clientX - r.left) / r.width) * 2 - 1, -((e.clientY - r.top) / r.height) * 2 + 1);
    this.raycaster.setFromCamera(this.pointer, this.camera);
  }

  // travel along the handle's axis line to the point nearest the pointer ray
  private axisT(lineO: THREE.Vector3, lineD: THREE.Vector3): number | null {
    const ray = this.raycaster.ray;
    const w0 = new THREE.Vector3().subVectors(lineO, ray.origin);
    const b = lineD.dot(ray.direction);
    const denom = 1 - b * b;
    if (Math.abs(denom) < 1e-4) return null; // axis points straight at the camera
    return (b * ray.direction.dot(w0) - lineD.dot(w0)) / denom;
  }

  private onDbl = (e: MouseEvent): void => {
    if (!this.active || this.spaceHeld) return;
    if (this.drawing) {
      // double-click closes the shape (the extra click's duplicate point is
      // deduped in finishDraw)
      this.finishDraw();
      return;
    }
    const hit = this.pick(e as PointerEvent);
    if (hit >= 0 && RESIZABLE.has(this.data.components[hit].t)) {
      this.select(hit);
      this.setResize(hit);
      if (!this.resizeHintShown) {
        this.resizeHintShown = true;
        this.hooks.showMsg('RESIZE MODE', 'drag the gold handles · esc or click away = done');
      }
    } else {
      this.setResize(-1);
      if (hit >= 0) this.hooks.showMsg('FIXED SIZE', `a ${this.data.components[hit].t} can't be resized`);
    }
  };

  // ---- pointer handlers ----

  private onDown = (e: PointerEvent): void => {
    if (!this.active || e.button !== 0) return;
    // space-hand: the pointer belongs to the pan — no picking, no marquee
    if (this.spaceHeld) {
      this.downAt = null;
      this.dom.style.cursor = 'grabbing';
      return;
    }
    // PEN TOOL: every click drops a vertex; clicking the first point closes
    // (rails are OPEN paths — they finish on Enter/double-click instead)
    if (this.drawing) {
      this.downAt = null;
      const pt = this.drawPlanePoint(e);
      if (!pt) return;
      if (
        this.drawing.t !== 'rail' &&
        this.drawing.pts.length >= 3 &&
        pt.distanceTo(this.drawing.pts[0]) < 1.0
      ) {
        this.finishDraw();
        return;
      }
      this.drawing.pts.push(pt);
      this.updateDrawVis();
      return;
    }
    // resize handles grab first — they float over everything else
    if (this.resizeIdx >= 0 && this.handleMeshes.length > 0) {
      this.setRay(e);
      this.handleGroup?.updateMatrixWorld(true); // may not have rendered yet
      const hits = this.raycaster.intersectObjects([...this.handleMeshes, ...this.handleHits], false);
      if (hits.length > 0) {
        const i = hits[0].object.userData.hdl as number;
        const def = this.hdlDefs[i];
        const lineO = def.pos.clone();
        const lineD = def.dir.clone();
        // shape node — Figma rules: shift/cmd-click toggles it in the node
        // selection (no drag), plain click on an unselected node selects
        // just it, and dragging any selected node moves them all. The props
        // panel batch-edits whatever's selected.
        if (def.vtx !== undefined) {
          if (e.shiftKey || e.metaKey || e.ctrlKey) {
            if (this.selVtxs.has(def.vtx)) this.selVtxs.delete(def.vtx);
            else this.selVtxs.add(def.vtx);
            this.tintHandles();
            this.renderProps();
            this.downAt = null;
            return;
          }
          if (!this.selVtxs.has(def.vtx)) this.selVtxs = new Set([def.vtx]);
          this.tintHandles();
          this.renderProps();
          this.hdlDrag = {
            i,
            lineO,
            lineD,
            t0: 0,
            orig: deepClone(this.data.components[this.resizeIdx]),
            vtx: def.vtx,
            plane: new THREE.Plane(new THREE.Vector3(0, 1, 0), -def.pos.y),
          };
          if (this.controls) this.controls.enabled = false;
          this.downAt = null;
          return;
        }
        const t0 = this.axisT(lineO, lineD);
        if (t0 !== null) {
          this.hdlDrag = {
            i,
            lineO,
            lineD,
            t0,
            orig: deepClone(this.data.components[this.resizeIdx]),
          };
          if (this.controls) this.controls.enabled = false;
          this.downAt = null;
          return;
        }
      }
    }
    this.downAt = { x: e.clientX, y: e.clientY };
    const hit = this.pick(e);
    // FIGMA rules — drag on EMPTY space is the marquee box-select: plain
    // replaces the selection, shift adds to it. (The camera lives on the
    // right/middle buttons and space-drag now.) In NODE mode the marquee
    // sweeps the shape's nodes instead of components.
    if (hit < 0) {
      this.marquee = { x0: e.clientX, y0: e.clientY, x1: e.clientX, y1: e.clientY };
      this.marqueeAdd = e.shiftKey;
      this.marqueeNodes =
        this.resizeIdx >= 0 && !!this.data.components[this.resizeIdx]?.pts;
      this.showMarquee();
      if (this.controls) this.controls.enabled = false;
      return;
    }
    // ctrl/cmd-grab is a toggle-click, never a move
    const plainGrab = !e.ctrlKey && !e.metaKey;
    // shift-grab on something OUTSIDE the selection = additive toggle on up
    if (hit >= 0 && plainGrab && !(e.shiftKey && !this.sel.includes(hit))) {
      // grab-to-move, no select-first needed: grabbing an unselected piece
      // selects it (with its group) and the drag starts immediately
      if (!this.sel.includes(hit)) this.setSelection(this.expandToGroup(hit));
      if (!this.sel.includes(hit)) return; // locked (or filtered): no drag
      let grabbed = hit;
      // alt-drag clones: the copies come along, the originals stay put
      if (e.altKey) {
        const order = [...this.sel];
        const start = this.data.components.length;
        const copies = order.map(
          (i) => deepClone(this.data.components[i]),
        );
        this.remapGroups(copies); // clones get their own group wiring
        grabbed = start + order.indexOf(hit);
        this.addBatch(copies); // selects the clones (one undo step)
        if (grabbed >= this.data.components.length) grabbed = this.selected; // crystal filtered
      }
      const c = this.data.components[grabbed];
      this.dragVertical = e.shiftKey;
      this.dragPlane = this.dragVertical
        ? new THREE.Plane().setFromNormalAndCoplanarPoint(
            new THREE.Vector3().subVectors(this.camera.position, new THREE.Vector3(...c.p)).setY(0).normalize(),
            new THREE.Vector3(...c.p),
          )
        : new THREE.Plane(new THREE.Vector3(0, 1, 0), -c.p[1]);
      if (this.groundPoint(e, this.dragPlane, this.dragStart)) {
        this.dragging = true;
        this.dragOrig = [...c.p] as [number, number, number];
        // the grabbed one leads; every selected component keeps its offset
        this.dragSel = this.sel.map((idx) => ({
          idx,
          p: [...this.data.components[idx].p] as [number, number, number],
        }));
        // move the grabbed item to the selection tail so snapping tracks IT
        if (grabbed !== this.selected) {
          this.sel = [...this.sel.filter((i) => i !== grabbed), grabbed];
          this.refreshSelectionBox();
        }
        if (this.controls) this.controls.enabled = false;
      }
    }
  };

  // ---- pen tool (draw polygon platforms / pits / walls) ----

  startDraw(t: 'platform' | 'pit' | 'wall' | 'rail'): void {
    this.cancelDraw();
    this.select(-1);
    const y = this.controls ? snapHalf(this.controls.target.y) : 0;
    this.drawing = { t, y, pts: [] };
    this.dom.style.cursor = 'crosshair';
    this.hooks.showMsg(
      `DRAW ${t.toUpperCase()}`,
      t === 'rail'
        ? 'click to drop nodes · Enter or double-click to finish · esc = cancel'
        : 'click to drop points · click the FIRST point (or Enter) to close · esc = cancel',
    );
  }

  private cancelDraw(): void {
    this.drawing = null;
    if (this.drawVis) {
      this.scene.remove(this.drawVis);
      this.drawVis = null;
    }
    if (this.active) this.dom.style.cursor = '';
  }

  // preview: the outline so far, vertex dots, a rubber segment to the cursor,
  // and a green "close here" marker on the first point
  private updateDrawVis(cursor?: THREE.Vector3): void {
    if (this.drawVis) {
      this.scene.remove(this.drawVis);
      this.drawVis = null;
    }
    const d = this.drawing;
    if (!d || (d.pts.length === 0 && !cursor)) return;
    const g = new THREE.Group();
    const color = d.t === 'pit' ? 0xff6a3a : d.t === 'wall' ? 0xffd75e : 0x58e08a;
    const linePts = [...d.pts];
    if (cursor) linePts.push(cursor);
    if (linePts.length >= 2) {
      g.add(
        new THREE.Line(
          new THREE.BufferGeometry().setFromPoints(linePts),
          new THREE.LineBasicMaterial({ color }),
        ),
      );
    }
    d.pts.forEach((pt, i) => {
      const dot = new THREE.Mesh(
        new THREE.SphereGeometry(i === 0 ? 0.42 : 0.28, 8, 6),
        new THREE.MeshBasicMaterial({ color: i === 0 ? 0x58e08a : color, depthTest: false }),
      );
      dot.renderOrder = 998;
      dot.position.copy(pt);
      g.add(dot);
    });
    this.scene.add(g);
    this.drawVis = g;
  }

  private drawPlanePoint(e: PointerEvent): THREE.Vector3 | null {
    const d = this.drawing!;
    const plane = new THREE.Plane(new THREE.Vector3(0, 1, 0), -d.y);
    const out = new THREE.Vector3();
    if (!this.groundPoint(e, plane, out)) return null;
    if (this.snap) {
      out.x = snapHalf(out.x);
      out.z = snapHalf(out.z);
    }
    out.y = d.y;
    return out;
  }

  private finishDraw(): void {
    const d = this.drawing;
    if (!d) return;
    // drop consecutive duplicates (a double-click leaves one behind)
    const pts = d.pts.filter(
      (pt, i) => i === 0 || pt.distanceToSquared(d.pts[i - 1]) > 0.01,
    );
    const minPts = d.t === 'rail' ? 2 : 3;
    if (pts.length < minPts) {
      this.hooks.showMsg(`NEED ${minPts}+ POINTS`, 'shape cancelled');
      this.cancelDraw();
      return;
    }
    let cx = 0;
    let cz = 0;
    for (const pt of pts) {
      cx += pt.x;
      cz += pt.z;
    }
    cx = snapHalf(cx / pts.length);
    cz = snapHalf(cz / pts.length);
    const rel = pts.map((pt) => [snapHalf(pt.x - cx), snapHalf(pt.z - cz)] as [number, number]);
    if (d.t === 'rail') {
      // open path — no closing, no box dims; grind height is the draw plane
      this.addComponent({ t: 'rail', p: [cx, d.y + 1, cz], pts: rel });
    } else {
      const s: [number, number, number] = [1, d.t === 'wall' ? 4 : 1, 1];
      this.addComponent({ t: d.t, p: [cx, d.y, cz], s, pts: rel });
    }
    this.cancelDraw();
  }

  // ---- marquee (screen-space rubber band) ----

  private showMarquee(): void {
    if (!this.marqueeEl) {
      const el = document.createElement('div');
      el.className = 'ed-marquee';
      document.body.appendChild(el);
      this.marqueeEl = el;
    }
    const m = this.marquee;
    if (!m) return;
    const x = Math.min(m.x0, m.x1);
    const y = Math.min(m.y0, m.y1);
    this.marqueeEl.style.display = 'block';
    this.marqueeEl.style.left = `${x}px`;
    this.marqueeEl.style.top = `${y}px`;
    this.marqueeEl.style.width = `${Math.abs(m.x1 - m.x0)}px`;
    this.marqueeEl.style.height = `${Math.abs(m.y1 - m.y0)}px`;
  }

  private hideMarquee(): void {
    if (this.marqueeEl) this.marqueeEl.style.display = 'none';
  }

  // every component whose screen-projected bounds touch the marquee rect
  private marqueePick(m: { x0: number; y0: number; x1: number; y1: number }): number[] {
    const rx0 = Math.min(m.x0, m.x1);
    const ry0 = Math.min(m.y0, m.y1);
    const rx1 = Math.max(m.x0, m.x1);
    const ry1 = Math.max(m.y0, m.y1);
    const r = this.dom.getBoundingClientRect();
    const camDir = this.camera.getWorldDirection(new THREE.Vector3());
    const out: number[] = [];
    const v = new THREE.Vector3();
    for (let idx = 0; idx < this.data.components.length; idx++) {
      if (this.isLockedIdx(idx)) continue; // locked layers ignore the marquee
      const box = this.boxFor(idx);
      if (!box) continue;
      // skip anything behind the camera — projection would mirror it
      if (v.copy(box.getCenter(new THREE.Vector3())).sub(this.camera.position).dot(camDir) < 0) continue;
      let sx0 = Infinity;
      let sy0 = Infinity;
      let sx1 = -Infinity;
      let sy1 = -Infinity;
      for (let corner = 0; corner < 8; corner++) {
        v.set(
          corner & 1 ? box.max.x : box.min.x,
          corner & 2 ? box.max.y : box.min.y,
          corner & 4 ? box.max.z : box.min.z,
        ).project(this.camera);
        const px = r.left + ((v.x + 1) / 2) * r.width;
        const py = r.top + ((1 - v.y) / 2) * r.height;
        sx0 = Math.min(sx0, px);
        sy0 = Math.min(sy0, py);
        sx1 = Math.max(sx1, px);
        sy1 = Math.max(sy1, py);
      }
      const touches = sx1 >= rx0 && sx0 <= rx1 && sy1 >= ry0 && sy0 <= ry1;
      // a component whose projection CONTAINS the whole rect wasn't lassoed —
      // you swept a box on top of it (else any sweep grabs the floor too)
      const swallows = sx0 <= rx0 && sy0 <= ry0 && sx1 >= rx1 && sy1 >= ry1;
      if (touches && !swallows) out.push(idx);
    }
    return out;
  }

  private onMove = (e: PointerEvent): void => {
    if (!this.active) return;
    if (this.spaceHeld) return; // panning: OrbitControls owns the pointer
    // pen tool: rubber-band the next segment to the cursor
    if (this.drawing) {
      const now = performance.now();
      if (now - this.hoverAt > 33) {
        this.hoverAt = now;
        const pt = this.drawPlanePoint(e);
        this.updateDrawVis(pt ?? undefined);
      }
      return;
    }
    // resize-handle drag: re-apply from the grab snapshot at the new travel
    if (this.hdlDrag && this.resizeIdx >= 0) {
      // shape node: chase the pointer on the ground plane. Dragging a node
      // that's part of a multi-node selection carries the whole selection
      // along by the same delta (Figma).
      if (this.hdlDrag.vtx !== undefined && this.hdlDrag.plane) {
        const hit = new THREE.Vector3();
        if (!this.groundPoint(e, this.hdlDrag.plane, hit)) return;
        const c = this.data.components[this.resizeIdx];
        const orig = this.hdlDrag.orig;
        if (!c.pts || !orig.pts) return;
        const o = orig.pts[this.hdlDrag.vtx];
        const dx = hit.x - c.p[0] - o[0];
        const dz = hit.z - c.p[2] - o[1];
        const targets =
          this.selVtxs.has(this.hdlDrag.vtx) && this.selVtxs.size > 1
            ? [...this.selVtxs]
            : [this.hdlDrag.vtx];
        for (const vi of targets) {
          const op = orig.pts[vi];
          if (!op) continue;
          const nt = [...op] as [number, number, number, number]; // radius + height ride along
          nt[0] = this.snap ? snapHalf(op[0] + dx) : op[0] + dx;
          nt[1] = this.snap ? snapHalf(op[1] + dz) : op[1] + dz;
          c.pts[vi] = nt;
        }
        const defs2 = this.handleDefsFor(c);
        defs2.forEach((df, j) => {
          this.handleMeshes[j]?.position.copy(df.pos);
          this.handleHits[j]?.position.copy(df.pos);
        });
        this.hdlDefs = defs2;
        this.renderProps();
        const now2 = performance.now();
        if (now2 - this.lastLiveRebuild > 90) {
          this.lastLiveRebuild = now2;
          this.hooks.rebuild();
        }
        return;
      }
      this.setRay(e);
      const t = this.axisT(this.hdlDrag.lineO, this.hdlDrag.lineD);
      if (t === null) return;
      let d = t - this.hdlDrag.t0;
      if (this.snap) d = snapHalf(d);
      const c = this.data.components[this.resizeIdx];
      this.hdlDefs[this.hdlDrag.i].apply!(this.hdlDrag.orig, c, d);
      // handles + panel track live; geometry rebuilds on a light throttle
      const defs = this.handleDefsFor(c);
      defs.forEach((df, j) => {
        this.handleMeshes[j]?.position.copy(df.pos);
        this.handleHits[j]?.position.copy(df.pos);
      });
      this.hdlDefs = defs;
      this.renderProps();
      const now = performance.now();
      if (now - this.lastLiveRebuild > 90) {
        this.lastLiveRebuild = now;
        this.hooks.rebuild();
      }
      return;
    }
    // marquee: track the corner
    if (this.marquee) {
      this.marquee.x1 = e.clientX;
      this.marquee.y1 = e.clientY;
      this.showMarquee();
      return;
    }
    // hovering a handle: show it's grabbable
    if (this.resizeIdx >= 0 && !this.dragging && this.handleMeshes.length > 0) {
      this.setRay(e);
      const over =
        this.raycaster.intersectObjects([...this.handleMeshes, ...this.handleHits], false).length > 0;
      if (over) {
        this.dom.style.cursor = 'grab';
        return;
      }
    }
    // idle hover: a pointer cursor says "this is selectable" (throttled)
    if (!this.dragging && !this.downAt) {
      const now = performance.now();
      if (now - this.hoverAt > 80) {
        this.hoverAt = now;
        const over = this.pick(e);
        this.dom.style.cursor = over >= 0 ? (this.sel.includes(over) ? 'move' : 'pointer') : '';
      }
    }
    if (!this.dragging || this.sel.length === 0) return;
    const hit = new THREE.Vector3();
    if (!this.groundPoint(e, this.dragPlane, hit)) return;
    // the grabbed component's target snaps to the grid; the rest of the
    // selection follows by the SAME delta so the group's layout never warps
    let nx = this.dragOrig[0];
    let ny = this.dragOrig[1];
    let nz = this.dragOrig[2];
    if (this.dragVertical) {
      ny = this.dragOrig[1] + (hit.y - this.dragStart.y);
    } else {
      nx = this.dragOrig[0] + (hit.x - this.dragStart.x);
      nz = this.dragOrig[2] + (hit.z - this.dragStart.z);
    }
    if (this.snap) {
      nx = snapHalf(nx);
      ny = snapHalf(ny);
      nz = snapHalf(nz);
    }
    const gdx = nx - this.dragOrig[0];
    const gdy = ny - this.dragOrig[1];
    const gdz = nz - this.dragOrig[2];
    let moved = false;
    for (const entry of this.dragSel) {
      const c = this.data.components[entry.idx];
      if (!c) continue;
      const tx = entry.p[0] + gdx;
      const ty = entry.p[1] + gdy;
      const tz = entry.p[2] + gdz;
      const dx = tx - c.p[0];
      const dy = ty - c.p[1];
      const dz = tz - c.p[2];
      if (dx || dy || dz) {
        // live-preview: shift the tagged visuals; physics catches up on release
        for (const o of this.objectsFor(entry.idx)) o.position.add(new THREE.Vector3(dx, dy, dz));
        c.p = [tx, ty, tz];
        moved = true;
      }
    }
    if (moved) {
      this.refreshSelectionBox();
      this.renderProps();
    }
  };

  private onUp = (e: PointerEvent): void => {
    if (!this.active) return;
    if (this.drawing) return; // pen tool owns the pointer (vertices drop on down)
    if (this.spaceHeld) {
      this.dom.style.cursor = 'grab';
      this.downAt = null;
      return;
    }
    if (this.hdlDrag) {
      this.hdlDrag = null;
      if (this.controls) this.controls.enabled = true;
      this.commit(); // one undo step for the whole handle stretch
      return;
    }
    const clickish =
      this.downAt !== null &&
      Math.hypot(e.clientX - this.downAt.x, e.clientY - this.downAt.y) < 5 &&
      e.button === 0;
    if (this.marquee) {
      const m = this.marquee;
      const nodesMode = this.marqueeNodes;
      this.marquee = null;
      this.marqueeNodes = false;
      this.hideMarquee();
      if (this.controls) this.controls.enabled = true;
      // a real sweep adds everything it touched (whole groups come along);
      // a sub-click shift-tap on empty space falls through to click logic
      if (!clickish) {
        if (nodesMode && this.resizeIdx >= 0) {
          // node mode: the box selects the shape's NODES (screen-projected)
          const r = this.dom.getBoundingClientRect();
          const x0 = Math.min(m.x0, m.x1);
          const x1 = Math.max(m.x0, m.x1);
          const y0 = Math.min(m.y0, m.y1);
          const y1 = Math.max(m.y0, m.y1);
          const picked = new Set<number>(this.marqueeAdd ? this.selVtxs : []);
          for (const def of this.hdlDefs) {
            if (def.vtx === undefined) continue;
            const s = def.pos.clone().project(this.camera);
            const sx = r.left + ((s.x + 1) / 2) * r.width;
            const sy = r.top + ((1 - s.y) / 2) * r.height;
            if (sx >= x0 && sx <= x1 && sy >= y0 && sy <= y1) picked.add(def.vtx);
          }
          this.selVtxs = picked;
          this.tintHandles();
          this.renderProps();
          this.downAt = null;
          return;
        }
        const hits = this.marqueePick(m).flatMap((i) => this.expandToGroup(i));
        this.setSelection(this.marqueeAdd ? [...this.sel, ...hits] : hits);
        this.downAt = null;
        return;
      }
    }
    if (this.dragging) {
      this.dragging = false;
      this.dragSel = [];
      if (this.controls) this.controls.enabled = true;
      if (!clickish) {
        this.commit(); // rebuild: colliders/rails regenerate at the new spot
        this.downAt = null;
        return;
      }
      // grab-with-no-movement is just a click — fall through
    }
    // plain click: select / deselect · modifier-click: toggle in/out.
    // Groups select as a unit — the click lands on the whole group.
    if (clickish) {
      const hit = this.pick(e);
      const unit = this.expandToGroup(hit);
      if (e.shiftKey || e.metaKey || e.ctrlKey) {
        if (hit >= 0) {
          const allIn = unit.every((i) => this.sel.includes(i));
          if (allIn) this.setSelection(this.sel.filter((i) => !unit.includes(i)));
          else this.setSelection([...this.sel, ...unit]);
        }
      } else {
        this.setSelection(unit);
      }
    }
    this.downAt = null;
  };

  private onKey = (e: KeyboardEvent): void => {
    if (!this.active) return;
    const typing = (e.target as HTMLElement)?.tagName === 'INPUT' || (e.target as HTMLElement)?.tagName === 'SELECT';
    if (typing) return;
    // HOLD SPACE: grabby hand — left-drag pans the canvas (Figma rules)
    if (e.code === 'Space') {
      e.preventDefault();
      if (!this.spaceHeld && !this.dragging && !this.hdlDrag) {
        this.spaceHeld = true;
        if (this.controls) this.controls.mouseButtons.LEFT = THREE.MOUSE.PAN;
        this.dom.style.cursor = 'grab';
      }
      return;
    }
    const cmd = e.metaKey || e.ctrlKey;
    // pen tool: Enter closes the shape, Escape abandons it
    if (this.drawing) {
      if (e.code === 'Enter') this.finishDraw();
      else if (e.code === 'Escape') this.cancelDraw();
      return;
    }
    if (e.code === 'Escape') {
      // step out: resize mode first, then the selection itself
      if (this.resizeIdx >= 0) this.setResize(-1);
      else this.select(-1);
    }
    if (e.code === 'Delete' || e.code === 'Backspace') this.deleteSelected();
    if (e.code === 'KeyD' && cmd) {
      e.preventDefault();
      this.duplicateSelected();
    }
    if (e.code === 'KeyC' && cmd) {
      e.preventDefault();
      this.copySelected();
    }
    if (e.code === 'KeyX' && cmd) {
      e.preventDefault();
      this.cutSelected();
    }
    if (e.code === 'KeyV' && cmd) {
      e.preventDefault();
      this.paste();
    }
    if (e.code === 'KeyA' && cmd) {
      e.preventDefault();
      this.setSelection(this.data.components.map((_, i) => i).filter((i) => !this.isLockedIdx(i)));
    }
    if (e.code === 'KeyG' && cmd) {
      e.preventDefault();
      if (e.shiftKey) this.ungroupSelection();
      else this.groupSelection();
    }
    if (e.code === 'KeyF' && !cmd) this.frameSelection();
    // arrows nudge the selection a grid step (shift+up/down = height)
    if (e.code.startsWith('Arrow') && this.sel.length > 0) {
      e.preventDefault();
      if (e.code === 'ArrowUp') this.nudge(e.shiftKey ? 0 : 1, 0, e.shiftKey ? 1 : 0);
      else if (e.code === 'ArrowDown') this.nudge(e.shiftKey ? 0 : -1, 0, e.shiftKey ? -1 : 0);
      else if (e.code === 'ArrowLeft') this.nudge(0, -1, 0);
      else if (e.code === 'ArrowRight') this.nudge(0, 1, 0);
    }
    // Cmd+Z / Cmd+Shift+Z (mac) — Ctrl works too
    if (e.code === 'KeyZ' && cmd) {
      e.preventDefault();
      if (e.shiftKey) this.redo();
      else this.undo();
    }
  };

  private onKeyUp = (e: KeyboardEvent): void => {
    if (e.code === 'Space' && this.spaceHeld) {
      this.spaceHeld = false;
      // left goes back to being the SELECT button (disabled on the camera)
      if (this.controls) this.controls.mouseButtons.LEFT = -1 as unknown as THREE.MOUSE;
      if (this.active) this.dom.style.cursor = '';
    }
  };

  // ---- spawn marker ----

  private refreshSpawnMarker(): void {
    if (!this.active) return;
    if (!this.spawnMarker) {
      const g = new THREE.Group();
      const pole = new THREE.Mesh(
        new THREE.CylinderGeometry(0.08, 0.08, 3.2, 6),
        new THREE.MeshLambertMaterial({ color: 0xf2f2f2 }),
      );
      pole.position.y = 1.6;
      const flag = new THREE.Mesh(
        new THREE.ConeGeometry(0.7, 1.4, 4),
        new THREE.MeshLambertMaterial({ color: 0x58e08a, emissive: 0x1c5a34 }),
      );
      flag.position.y = 3.4;
      g.add(pole, flag);
      this.spawnMarker = g;
      this.scene.add(g);
    }
    this.spawnMarker.position.set(this.data.spawn[0], this.data.spawn[1], this.data.spawn[2]);
  }

  // ---- panel ----

  private buildPanel(): void {
    const panel = document.createElement('div');
    panel.className = 'ed-panel';
    panel.style.display = 'none';
    const h = (html: string): HTMLElement => {
      const d = document.createElement('div');
      d.innerHTML = html;
      return d.firstElementChild as HTMLElement;
    };
    panel.appendChild(h('<div class="ed-title">LEVEL EDITOR</div>'));

    // selection properties FIRST — what you just clicked is always in view
    panel.appendChild(h('<div class="ed-sect">SELECTION</div>'));
    this.propsEl = h('<div class="ed-props"><div class="ed-dim">click a component…</div></div>');
    panel.appendChild(this.propsEl);

    // ---- left-side pop-outs: the item picker and the layers panel live in
    // their own tabs so the inspector stays short ----
    const wrap = h('<div class="ed-popwrap" style="display:none"></div>');
    const tabs = h('<div class="ed-tabs"></div>');
    this.tabAdd = h('<button class="ed-tab">▦<span>ADD</span></button>') as HTMLButtonElement;
    this.tabLayers = h('<button class="ed-tab">≡<span>LAYERS</span></button>') as HTMLButtonElement;
    this.tabAdd.addEventListener('click', () => this.setPop(this.popAdd?.style.display === 'block' ? '' : 'add'));
    this.tabLayers.addEventListener('click', () =>
      this.setPop(this.popLayers?.style.display === 'block' ? '' : 'layers'),
    );
    tabs.appendChild(this.tabAdd);
    tabs.appendChild(this.tabLayers);
    wrap.appendChild(tabs);

    // item picker pop-out: grouped, icon + label per component
    const popAdd = h('<div class="ed-pop" style="display:none"></div>');
    popAdd.appendChild(h('<div class="ed-title">ADD</div>'));
    for (const sect of PALETTE_SECTIONS) {
      popAdd.appendChild(h(`<div class="ed-sect">${sect.title}</div>`));
      const pal = h('<div class="ed-grid"></div>');
      for (const p of sect.items) {
        const b = h('<button class="ed-btn ed-palbtn"></button>') as HTMLButtonElement;
        const cv = document.createElement('canvas');
        cv.width = 18;
        cv.height = 18;
        const ctx = cv.getContext('2d');
        if (ctx) p.icon(ctx);
        b.appendChild(cv);
        const lab = document.createElement('span');
        lab.textContent = p.label;
        b.appendChild(lab);
        b.addEventListener('click', () => {
          if (p.penDraw) {
            this.startDraw(p.penDraw);
            b.blur();
            return;
          }
          const at = this.controls ? this.controls.target.clone() : new THREE.Vector3();
          if (this.snap) {
            at.set(snapHalf(at.x), snapHalf(at.y), snapHalf(at.z));
          }
          this.addComponent(p.make!(at));
          b.blur();
        });
        pal.appendChild(b);
      }
      popAdd.appendChild(pal);
    }
    this.popAdd = popAdd;
    wrap.appendChild(popAdd);

    // layers pop-out
    const popLayers = h('<div class="ed-pop" style="display:none"></div>');
    popLayers.appendChild(h('<div class="ed-title">LAYERS</div>'));
    this.layersEl = h('<div class="ed-layers"></div>');
    popLayers.appendChild(this.layersEl);
    popLayers.appendChild(
      h('<div class="ed-dim">every piece is a row · groups expand with ▸<br>click a name to select it in the world<br>🔒 = click-through (safe from edits)<br>⌘G groups the selection · ✎ renames</div>'),
    );
    this.popLayers = popLayers;
    wrap.appendChild(popLayers);

    // hard view snaps, bottom-left: X/Y/Z aim the orbit camera straight down
    // that axis (click again = the opposite side)
    const views = h('<div class="ed-views"></div>');
    for (const ax of ['x', 'y', 'z'] as const) {
      const vb = h(`<button class="ed-viewbtn">${ax.toUpperCase()}</button>`) as HTMLButtonElement;
      vb.title = `snap view down ${ax.toUpperCase()} (again = other side)`;
      vb.addEventListener('click', () => {
        this.snapView(ax);
        vb.blur();
      });
      views.appendChild(vb);
    }
    wrap.appendChild(views);

    document.body.appendChild(wrap);
    this.popWrap = wrap;

    // level settings
    panel.appendChild(h('<div class="ed-sect">LEVEL</div>'));
    const lvl = h('<div class="ed-props"></div>');
    lvl.appendChild(this.numRow('spawn x', () => this.data.spawn[0], (v) => (this.data.spawn[0] = v)));
    lvl.appendChild(this.numRow('spawn y', () => this.data.spawn[1], (v) => (this.data.spawn[1] = v)));
    lvl.appendChild(this.numRow('spawn z', () => this.data.spawn[2], (v) => (this.data.spawn[2] = v)));
    lvl.appendChild(this.numRow('kill y', () => this.data.killY, (v) => (this.data.killY = v)));
    const spawnHere = h('<button class="ed-btn">spawn = camera focus</button>') as HTMLButtonElement;
    spawnHere.addEventListener('click', () => {
      if (!this.controls) return;
      const t = this.controls.target;
      this.data.spawn = [snapHalf(t.x), snapHalf(t.y) + 0.6, snapHalf(t.z)];
      this.commit();
      spawnHere.blur();
    });
    lvl.appendChild(spawnHere);
    const snapBtn = h('<button class="ed-btn">grid snap: ON</button>') as HTMLButtonElement;
    snapBtn.addEventListener('click', () => {
      this.snap = !this.snap;
      snapBtn.textContent = `grid snap: ${this.snap ? 'ON' : 'OFF'}`;
      snapBtn.blur();
    });
    lvl.appendChild(snapBtn);
    panel.appendChild(lvl);

    // file ops
    panel.appendChild(h('<div class="ed-sect">FILE</div>'));
    const file = h('<div class="ed-grid"></div>');
    const mk = (label: string, fn: () => void): HTMLButtonElement => {
      const b = h(`<button class="ed-btn">${label}</button>`) as HTMLButtonElement;
      b.addEventListener('click', () => {
        fn();
        b.blur();
      });
      file.appendChild(b);
      return b;
    };
    mk('export', () => {
      const blob = new Blob([JSON.stringify(this.data, null, 1)], { type: 'application/json' });
      const a = document.createElement('a');
      a.href = URL.createObjectURL(blob);
      a.download = `level-${this.data.name.replace(/\s+/g, '')}.json`;
      a.click();
      setTimeout(() => URL.revokeObjectURL(a.href), 5000);
      this.hooks.showMsg('LEVEL EXPORTED', 'drop the file into the chat to share it');
    });
    const filePick = document.createElement('input');
    filePick.type = 'file';
    filePick.accept = '.json,application/json';
    filePick.style.display = 'none';
    filePick.addEventListener('change', () => {
      const f = filePick.files && filePick.files[0];
      if (f)
        f.text().then((txt) => {
          try {
            const d = JSON.parse(txt) as CustomLevelData;
            if (d.v !== 1 || !Array.isArray(d.components)) throw new Error('bad');
            this.data = d;
            this.select(-1);
            this.commit();
            this.hooks.showMsg('LEVEL IMPORTED', d.name);
          } catch {
            this.hooks.showMsg('BAD LEVEL FILE');
          }
        });
      filePick.value = '';
    });
    file.appendChild(filePick);
    mk('import', () => filePick.click());
    // Sandbox: blank slate. Built-in override: hand back the original design
    // (clears the override, which syncs as a reset). Label swaps in enter().
    this.resetBtn = mk('start over', () => {
      if (this.targetCourse === 7) {
        this.data = starterCustomLevel();
        this.select(-1);
        this.commit();
      } else {
        this.hooks.restoreOriginal();
      }
    });
    mk('undo ⌘Z', () => this.undo());
    mk('redo ⌘⇧Z', () => this.redo());
    panel.appendChild(file);

    // play
    const test = h('<button class="ed-btn ed-test">▶ TEST (play it)</button>') as HTMLButtonElement;
    test.addEventListener('click', () => {
      this.hooks.exitToPlay();
      test.blur();
    });
    panel.appendChild(test);
    panel.appendChild(
      h('<div class="ed-dim">add pieces + layers: tabs on the LEFT edge<br>select: click · drag empty space = box select<br>move: just drag a piece (shift = height)<br>alt-drag = drag out a copy · shift-click = add<br>orbit: RIGHT-drag · pan: middle or SPACE-drag<br>zoom: wheel · X/Y/Z (bottom-left) = view snaps<br>⌘A = all · ⌘G = group · ⌘⇧G = ungroup<br>⌘C copy · ⌘V paste at focus · ⌘X cut<br>arrows = nudge (shift↑↓ = height) · F = frame<br>double-click = resize handles (esc = done)<br>del = delete · ⌘D = duplicate<br>⌘Z = undo · ⌘⇧Z = redo<br><br>outline crates: ghost boxes that a "!" crate in the SAME GROUP turns real when hit</div>'),
    );

    document.body.appendChild(panel);
    this.panel = panel;
    this.injectStyle();
  }

  // one pop-out at a time (photoshop-dock rules); '' closes both
  private setPop(which: 'add' | 'layers' | ''): void {
    if (this.popAdd) this.popAdd.style.display = which === 'add' ? 'block' : 'none';
    if (this.popLayers) this.popLayers.style.display = which === 'layers' ? 'block' : 'none';
    this.tabAdd?.classList.toggle('ed-tab-on', which === 'add');
    this.tabLayers?.classList.toggle('ed-tab-on', which === 'layers');
    try {
      localStorage.setItem('protoEditorPop', which);
    } catch {
      /* ignore */
    }
    if (which === 'layers') this.renderLayers();
  }

  // aim the orbit camera straight down a world axis at the current focus,
  // keeping the zoom. Already on that axis? Flip to the opposite side.
  snapView(axis: 'x' | 'y' | 'z'): void {
    if (!this.controls) return;
    const t = this.controls.target;
    const off = new THREE.Vector3().subVectors(this.camera.position, t);
    const d = Math.max(6, off.length());
    const u = { x: new THREE.Vector3(1, 0, 0), y: new THREE.Vector3(0, 1, 0), z: new THREE.Vector3(0, 0, 1) }[
      axis
    ];
    const along = off.dot(u) / d; // how aligned are we already?
    const sign = along > 0.98 ? -1 : 1; // second press = other side
    const pos = t.clone().addScaledVector(u, d * sign);
    // a perfectly vertical view gimbal-locks OrbitControls: lean a hair
    if (axis === 'y') pos.z += d * 0.02;
    this.camera.position.copy(pos);
    this.camera.lookAt(t);
    this.saveCam();
  }

  // ---- outliner (the layers pop-out): items + groups as a tree ----

  private itemLabel(idx: number): string {
    const c = this.data.components[idx];
    if (!c) return '?';
    if (c.nm) return c.nm;
    if (c.pts && c.pts.length >= 3) return `${c.t} · drawn`;
    if (c.t === 'crate') return `crate · ${c.kind ?? 'wood'}${c.outline ? ' (outline)' : ''}`;
    if (c.t === 'wall' && c.invisible) return 'invis wall';
    if (c.t === 'clock') return 'tt clock';
    if (c.t === 'comboorb') return 'combo orb';
    if (c.t === 'camnode') {
      // show the node's position in the chain: "cam node 2/5"
      const nodes = this.data.components.filter((o) => o.t === 'camnode');
      return `cam node ${nodes.indexOf(c) + 1}/${nodes.length}`;
    }
    return c.t;
  }

  private groupLabel(gid: number): string {
    return this.data.groups?.find((g) => g.id === gid)?.nm ?? `group ${gid}`;
  }

  // inline rename input, shared by group and item rows
  private renameField(current: string, done: (v: string) => void): HTMLInputElement {
    const input = document.createElement('input');
    input.className = 'ed-layername-input';
    input.value = current;
    input.addEventListener('keydown', (ev) => {
      if (ev.code === 'Enter') input.blur();
      ev.stopPropagation(); // typing guard: editor hotkeys stay out
    });
    input.addEventListener('blur', () => {
      this.renaming = null;
      done(input.value.trim());
      this.commit(false);
      this.renderLayers();
    });
    setTimeout(() => {
      input.focus();
      input.select();
    }, 0);
    return input;
  }

  private renderLayers(): void {
    if (!this.layersEl) return;
    this.layersEl.innerHTML = '';
    const groups = this.data.groups ?? [];
    const childGroups = (parent: number | undefined): number[] =>
      groups.filter((g) => g.parent === parent).map((g) => g.id);
    const directItems = (gid: number | undefined): number[] => {
      const out: number[] = [];
      this.data.components.forEach((c, i) => {
        if (c.grp === gid) out.push(i);
      });
      return out;
    };

    const itemRow = (idx: number, depth: number): HTMLElement => {
      const c = this.data.components[idx];
      const row = document.createElement('div');
      row.className = 'ed-layerrow' + (this.sel.includes(idx) ? ' ed-layer-sel' : '');
      row.style.paddingLeft = `${4 + depth * 12}px`;
      const lock = document.createElement('button');
      lock.className = 'ed-lbtn' + (c.lk ? ' ed-lockon' : '');
      lock.textContent = c.lk ? '🔒' : '🔓';
      lock.title = c.lk ? 'unlock' : 'lock (click-through, edit-proof)';
      lock.addEventListener('click', (ev) => {
        ev.stopPropagation();
        if (c.lk) delete c.lk;
        else c.lk = true;
        if (c.lk) this.setSelection(this.sel.filter((i) => i !== idx));
        this.commit(false);
      });
      row.appendChild(lock);
      if (this.renaming?.kind === 'item' && this.renaming.id === idx) {
        row.appendChild(
          this.renameField(this.itemLabel(idx), (v) => {
            if (v) c.nm = v;
            else delete c.nm;
          }),
        );
      } else {
        const name = document.createElement('button');
        name.className = 'ed-layername';
        name.textContent = this.itemLabel(idx);
        name.title = 'click: select this piece';
        name.addEventListener('click', () => {
          if (!this.isLockedIdx(idx)) this.setSelection([idx]);
        });
        row.appendChild(name);
      }
      const tag = document.createElement('span');
      tag.className = 'ed-layercount';
      tag.textContent = `#${idx}`;
      row.appendChild(tag);
      const ren = document.createElement('button');
      ren.className = 'ed-lbtn';
      ren.textContent = '✎';
      ren.title = 'rename';
      ren.addEventListener('click', (ev) => {
        ev.stopPropagation();
        this.renaming = { kind: 'item', id: idx };
        this.renderLayers();
      });
      row.appendChild(ren);
      return row;
    };

    const groupNode = (gid: number, depth: number, host: HTMLElement): void => {
      const members = this.groupMembers(gid);
      const open = !this.closedGroups.has(gid);
      const row = document.createElement('div');
      const allSel = members.length > 0 && members.every((m) => this.sel.includes(m) || this.isLockedIdx(m));
      row.className = 'ed-layerrow ed-grouprow' + (allSel ? ' ed-layer-sel' : '');
      row.style.paddingLeft = `${4 + depth * 12}px`;
      const caret = document.createElement('button');
      caret.className = 'ed-lbtn ed-caret';
      caret.textContent = open ? '▾' : '▸';
      caret.title = open ? 'collapse' : 'expand';
      caret.addEventListener('click', (ev) => {
        ev.stopPropagation();
        if (open) this.closedGroups.add(gid);
        else this.closedGroups.delete(gid);
        this.renderLayers();
      });
      row.appendChild(caret);
      const allLocked = members.length > 0 && members.every((m) => this.isLockedIdx(m));
      const lock = document.createElement('button');
      lock.className = 'ed-lbtn' + (allLocked ? ' ed-lockon' : '');
      lock.textContent = allLocked ? '🔒' : '🔓';
      lock.title = allLocked ? 'unlock group' : 'lock whole group';
      lock.addEventListener('click', (ev) => {
        ev.stopPropagation();
        for (const m of members) {
          if (allLocked) delete this.data.components[m].lk;
          else this.data.components[m].lk = true;
        }
        if (!allLocked) this.setSelection(this.sel.filter((i) => !members.includes(i)));
        this.commit(false);
      });
      row.appendChild(lock);
      if (this.renaming?.kind === 'group' && this.renaming.id === gid) {
        row.appendChild(
          this.renameField(this.groupLabel(gid), (v) => {
            const g = this.data.groups?.find((x) => x.id === gid);
            if (g) {
              if (v) g.nm = v;
              else delete g.nm;
            }
          }),
        );
      } else {
        const name = document.createElement('button');
        name.className = 'ed-layername ed-groupname';
        name.textContent = this.groupLabel(gid);
        name.title = 'click: select the whole group';
        name.addEventListener('click', () => {
          this.setSelection(members.filter((m) => !this.isLockedIdx(m)));
        });
        row.appendChild(name);
      }
      const n = document.createElement('span');
      n.className = 'ed-layercount';
      n.textContent = String(members.length);
      row.appendChild(n);
      const ren = document.createElement('button');
      ren.className = 'ed-lbtn';
      ren.textContent = '✎';
      ren.title = 'rename group';
      ren.addEventListener('click', (ev) => {
        ev.stopPropagation();
        this.renaming = { kind: 'group', id: gid };
        this.renderLayers();
      });
      row.appendChild(ren);
      host.appendChild(row);
      if (!open) return;
      for (const sub of childGroups(gid)) groupNode(sub, depth + 1, host);
      for (const idx of directItems(gid)) host.appendChild(itemRow(idx, depth + 1));
    };

    // root groups first, then loose items — every piece is a row somewhere
    for (const gid of childGroups(undefined)) groupNode(gid, 0, this.layersEl);
    for (const idx of directItems(undefined)) this.layersEl.appendChild(itemRow(idx, 0));
    if (this.data.components.length === 0) {
      const empty = document.createElement('div');
      empty.className = 'ed-dim';
      empty.textContent = 'nothing yet — add pieces from the ▦ ADD tab';
      this.layersEl.appendChild(empty);
    }
  }

  // a labelled number field that commits on change
  // texture dropdown: the surface-kind list shared with the game builder
  private texRow(get: () => string | undefined, set: (v: string | undefined) => void): HTMLElement {
    const row = document.createElement('div');
    row.className = 'ed-row';
    const lab = document.createElement('label');
    lab.textContent = 'texture';
    const sel = document.createElement('select');
    for (const k of TEX_KINDS) {
      const opt = document.createElement('option');
      opt.value = k;
      opt.textContent = k;
      sel.appendChild(opt);
    }
    sel.value = get() ?? 'checker';
    sel.addEventListener('change', () => {
      set(sel.value === 'checker' ? undefined : sel.value);
      this.commit();
    });
    row.appendChild(lab);
    row.appendChild(sel);
    return row;
  }

  // Rotate the whole selection 90° about its center — the way you turn a
  // stretch of course sideways for a side-scroll zone. Positions orbit the
  // pivot; yaw-capable items add the turn; drawn shapes rotate their node
  // coordinates; pipes flip axis; zones swap footprint AND remap their
  // travel direction so the side-scroll follows the rotated geometry.
  private rotateSelection(deg: 90 | -90): void {
    const comps = this.sel.map((i) => this.data.components[i]);
    if (comps.length === 0) return;
    let cx = 0;
    let cz = 0;
    for (const c of comps) {
      cx += c.p[0];
      cz += c.p[2];
    }
    cx /= comps.length;
    cz /= comps.length;
    // R(+90) about +Y sends (x, z) -> (z, -x); R(-90) sends it to (-z, x) —
    // the same transform three.js applies for rotation.y, so positions and
    // per-item yaw stay in perfect agreement.
    const rot = (x: number, z: number): [number, number] =>
      deg === 90 ? [z, -x] : [-z, x];
    const yawable = new Set(['platform', 'ramp', 'wall', 'crumble', 'rock', 'rail', 'rope', 'enemy', 'pendulum', 'pit', 'gate']);
    for (const c of comps) {
      const [rx, rz] = rot(c.p[0] - cx, c.p[2] - cz);
      c.p = [Math.round((cx + rx) * 100) / 100, c.p[1], Math.round((cz + rz) * 100) / 100];
      if (c.pts) {
        c.pts = c.pts.map((pt) => {
          const [nx, nz] = rot(pt[0], pt[1]);
          const out = [...pt] as typeof pt;
          out[0] = Math.round(nx * 100) / 100;
          out[1] = Math.round(nz * 100) / 100;
          return out;
        });
      } else if (c.t === 'pipe') {
        c.axis = (c.axis ?? 'z') === 'z' ? 'x' : 'z';
      } else if (c.t === 'zone') {
        if (c.s) c.s = [c.s[2], c.s[1], c.s[0]];
        const map: Record<'E' | 'W' | 'N' | 'S', 'E' | 'W' | 'N' | 'S'> =
          deg === 90 ? { W: 'N', N: 'E', E: 'S', S: 'W' } : { E: 'N', N: 'W', W: 'S', S: 'E' };
        c.dir = map[c.dir ?? 'E'];
      } else if (c.t === 'crusher') {
        if (c.s) c.s = [c.s[2], c.s[1], c.s[0]];
      } else if (yawable.has(c.t)) {
        c.yaw = ((((c.yaw ?? 0) + deg) % 360) + 360) % 360;
      }
    }
    this.commit();
    this.renderProps();
  }

  private numRow(label: string, get: () => number, set: (v: number) => void, step = 0.5): HTMLElement {
    const row = document.createElement('div');
    row.className = 'ed-row';
    const lab = document.createElement('label');
    lab.textContent = label;
    const input = document.createElement('input');
    input.type = 'number';
    input.step = String(step);
    input.value = String(get());
    input.addEventListener('change', () => {
      const v = parseFloat(input.value);
      if (isFinite(v)) {
        set(v);
        // spinner-arrow bursts on one field merge into a single undo step
        this.commit(true, `num:${label}`);
      }
      input.value = String(get());
    });
    row.appendChild(lab);
    row.appendChild(input);
    return row;
  }

  // properties for the current selection, generated per component type
  private renderProps(): void {
    this.propsEl.innerHTML = '';
    if (this.sel.length === 0 || !this.data.components[this.selected]) {
      this.propsEl.innerHTML =
        '<div class="ed-dim">click a component…<br>shift-click adds · shift-drag empty space = box select</div>';
      return;
    }
    // MULTI-selection: a group toolkit instead of per-type fields
    if (this.sel.length > 1) {
      const counts = new Map<string, number>();
      for (const i of this.sel) {
        const t = this.data.components[i].t;
        counts.set(t, (counts.get(t) ?? 0) + 1);
      }
      const parts = [...counts.entries()]
        .map(([t, n]) => (n > 1 ? `${t} ×${n}` : t))
        .join(' · ');
      const head = document.createElement('div');
      head.className = 'ed-selhead';
      head.textContent = `${this.sel.length} selected`;
      this.propsEl.appendChild(head);
      const list = document.createElement('div');
      list.className = 'ed-dim ed-sellist';
      list.textContent = parts;
      this.propsEl.appendChild(list);
      const grid = document.createElement('div');
      grid.className = 'ed-grid';
      const mkBtn = (label: string, fn: () => void, danger = false): void => {
        const b = document.createElement('button');
        b.className = danger ? 'ed-btn ed-danger' : 'ed-btn';
        b.textContent = label;
        b.addEventListener('click', () => {
          fn();
          b.blur();
        });
        grid.appendChild(b);
      };
      mkBtn('copy ⌘C', () => this.copySelected());
      mkBtn('duplicate ⌘D', () => this.duplicateSelected());
      mkBtn('rotate ⟲ 90°', () => this.rotateSelection(90));
      mkBtn('rotate ⟳ 90°', () => this.rotateSelection(-90));
      mkBtn('group ⌘G', () => this.groupSelection());
      if (this.sel.some((i) => this.chainOf(i).length > 0)) {
        mkBtn('ungroup ⌘⇧G', () => this.ungroupSelection());
      }
      mkBtn('match height', () => {
        // align the group to the PRIMARY's y — the fast way to level a row
        const y = this.data.components[this.selected].p[1];
        for (const i of this.sel) this.data.components[i].p[1] = y;
        this.commit();
      });
      mkBtn('delete', () => this.deleteSelected(), true);
      this.propsEl.appendChild(grid);
      // SHARED variables (Figma): every field that applies to ALL selected
      // pieces shows once — the value displayed is the primary's, typing
      // batch-writes it to the whole selection.
      const all = this.sel.map((i) => this.data.components[i]);
      const prim = this.data.components[this.selected];
      const shared = document.createElement('div');
      shared.className = 'ed-dim';
      shared.textContent = `shared values (apply to all ${this.sel.length}):`;
      this.propsEl.appendChild(shared);
      const brow = (label: string, get: () => number, set: (cc: CustomComponent, v: number) => void, step = 0.5): void =>
        void this.propsEl.appendChild(
          this.numRow(label, get, (v) => all.forEach((cc) => set(cc, v)), step),
        );
      brow('x', () => prim.p[0], (cc, v) => (cc.p[0] = v));
      brow('y', () => prim.p[1], (cc, v) => (cc.p[1] = v));
      brow('z', () => prim.p[2], (cc, v) => (cc.p[2] = v));
      if (all.every((cc) => cc.s)) {
        brow('width', () => prim.s![0], (cc, v) => (cc.s![0] = Math.max(0.2, v)));
        brow('height', () => prim.s![1], (cc, v) => (cc.s![1] = Math.max(0.2, v)));
        brow('depth', () => prim.s![2], (cc, v) => (cc.s![2] = Math.max(0.2, v)));
      }
      const yawable = new Set(['platform', 'ramp', 'wall', 'pit', 'crumble', 'rock', 'pendulum', 'enemy', 'rail', 'gate']);
      if (all.every((cc) => yawable.has(cc.t) && !cc.pts)) {
        brow('yaw °', () => prim.yaw ?? 0, (cc, v) => (cc.yaw = v), 15);
      }
      if (all.every((cc) => cc.len !== undefined)) {
        brow('length', () => prim.len!, (cc, v) => (cc.len = Math.max(1, v)));
      }
      if (all.every((cc) => cc.t === 'enemy')) {
        brow('speed', () => prim.speed ?? 3, (cc, v) => (cc.speed = Math.max(0.5, v)));
        brow('patrol range', () => prim.range ?? 5, (cc, v) => (cc.range = Math.max(0.5, v)));
      }
      if (all.every((cc) => cc.t === 'camnode')) {
        brow('corner radius', () => prim.radius ?? 0, (cc, v) => (cc.radius = Math.max(0, v)));
      }
      const colorable = new Set(['platform', 'ramp', 'wall', 'crumble', 'rock']);
      if (all.every((cc) => colorable.has(cc.t))) {
        const row = document.createElement('div');
        row.className = 'ed-row';
        const lab = document.createElement('label');
        lab.textContent = 'color';
        const input = document.createElement('input');
        input.type = 'color';
        input.value = prim.color ?? '#ffffff';
        input.addEventListener('change', () => {
          for (const cc of all) cc.color = input.value;
          this.commit();
        });
        row.appendChild(lab);
        row.appendChild(input);
        this.propsEl.appendChild(row);
        // batch texture: one pick re-surfaces the whole selection
        this.propsEl.appendChild(
          this.texRow(
            () => prim.tex,
            (v) => {
              for (const cc of all) cc.tex = v;
            },
          ),
        );
      }
      const hint = document.createElement('div');
      hint.className = 'ed-dim';
      hint.textContent =
        'drag any selected piece to move the group · arrows nudge · a "!" crate grouped with outline crates becomes their switch';
      this.propsEl.appendChild(hint);
      return;
    }
    const c = this.data.components[this.selected];
    const head = document.createElement('div');
    head.className = 'ed-selhead';
    const inGroup = this.chainOf(this.selected).length > 0;
    head.textContent = `#${this.selected} · ${c.t}${inGroup ? ' · in group' : ''}`;
    this.propsEl.appendChild(head);
    const num = (label: string, get: () => number, set: (v: number) => void, step = 0.5): void =>
      void this.propsEl.appendChild(this.numRow(label, get, set, step));
    num('x', () => c.p[0], (v) => (c.p[0] = v));
    num('y', () => c.p[1], (v) => (c.p[1] = v));
    num('z', () => c.p[2], (v) => (c.p[2] = v));
    const sizeRow = (idx: number, label: string): void => {
      if (!c.s) c.s = [8, 1, 8];
      num(label, () => c.s![idx], (v) => (c.s![idx] = Math.max(0.2, v)));
    };
    const colorRow = (): void => {
      const row = document.createElement('div');
      row.className = 'ed-row';
      const lab = document.createElement('label');
      lab.textContent = 'color';
      const input = document.createElement('input');
      input.type = 'color';
      input.value = c.color ?? '#ffffff';
      input.addEventListener('change', () => {
        c.color = input.value;
        this.commit();
      });
      row.appendChild(lab);
      row.appendChild(input);
      this.propsEl.appendChild(row);
      // TEXTURE: every paintable surface picks from the shared kind list —
      // the tint above colors the texture, so the two knobs compose
      this.propsEl.appendChild(
        this.texRow(
          () => c.tex,
          (v) => (c.tex = v),
        ),
      );
    };
    // Figma-style node editing: with a shape in resize mode, grabbing a node
    // selects it and its CORNER RADIUS is editable here. Rounds the visual,
    // the collision, the kill footprint, and the grind line alike.
    const nodeRows = (): void => {
      if (!c.pts) return;
      const picked = [...this.selVtxs].filter((i) => i >= 0 && i < c.pts!.length);
      if (this.resizeIdx === this.selected && picked.length > 0) {
        // one field batch-edits every selected node (Figma). Values shown are
        // WORLD coordinates; writing x/z to a multi-selection aligns the
        // nodes onto that line. Rails also expose per-node height — grind
        // lines climb and dive; polygons stay planar (collision needs it).
        const tag = picked.length > 1 ? `${picked.length} nodes` : `node ${picked[0] + 1}`;
        const mutate = (vi: number, mut: (nt: [number, number, number, number]) => void): void => {
          const nt = [...c.pts![vi]] as [number, number, number, number];
          if (nt[2] === undefined) nt[2] = 0; // radius slot (0 = square corner)
          mut(nt);
          c.pts![vi] = nt;
        };
        num(`${tag} · x`, () => c.p[0] + c.pts![picked[0]][0], (v) => {
          for (const vi of picked) mutate(vi, (nt) => (nt[0] = v - c.p[0]));
        });
        if (c.t === 'rail') {
          num(`${tag} · y`, () => c.p[1] + (c.pts![picked[0]][3] ?? 0), (v) => {
            for (const vi of picked) mutate(vi, (nt) => (nt[3] = v - c.p[1]));
          });
        }
        num(`${tag} · z`, () => c.p[2] + c.pts![picked[0]][1], (v) => {
          for (const vi of picked) mutate(vi, (nt) => (nt[1] = v - c.p[2]));
        });
        num(`${tag} · radius`, () => c.pts![picked[0]][2] ?? 0, (v) => {
          for (const vi of picked) mutate(vi, (nt) => (nt[2] = Math.max(0, v)));
        });
      } else {
        const tip = document.createElement('div');
        tip.className = 'ed-dim';
        tip.textContent =
          'double-click, then grab a node (shift adds · drag empty space = box-select nodes): edit its position + corner radius here';
        this.propsEl.appendChild(tip);
      }
    };
    if (c.pts && c.pts.length >= 3 && c.t !== 'rail') {
      // drawn polygon: the outline is edited with the vertex handles
      const note = document.createElement('div');
      note.className = 'ed-dim';
      note.textContent = `drawn polygon · ${c.pts.length} points — double-click to drag the corners`;
      this.propsEl.appendChild(note);
      if (c.t !== 'pit') {
        num(
          c.t === 'wall' ? 'height' : 'thickness',
          () => c.s?.[1] ?? (c.t === 'wall' ? 4 : 1),
          (v) => {
            if (!c.s) c.s = [1, 1, 1];
            c.s[1] = Math.max(0.2, v);
          },
        );
        colorRow();
      }
      nodeRows();
    } else if (c.t === 'platform' || c.t === 'wall') {
      sizeRow(0, 'width');
      sizeRow(1, 'height');
      sizeRow(2, 'depth');
      num('yaw °', () => c.yaw ?? 0, (v) => (c.yaw = v), 15); // platforms AND walls spin freely now
      if (c.t === 'wall' && c.invisible) {
        const note = document.createElement('div');
        note.className = 'ed-dim';
        note.textContent = 'invisible in play (ghost here)';
        this.propsEl.appendChild(note);
      } else {
        colorRow();
      }
    } else if (c.t === 'pit') {
      sizeRow(0, 'width');
      sizeRow(2, 'depth');
      num('yaw °', () => c.yaw ?? 0, (v) => (c.yaw = v), 15);
    } else if (c.t === 'crumble') {
      sizeRow(0, 'width');
      sizeRow(2, 'depth');
      num('fall delay', () => c.shake ?? 0.7, (v) => (c.shake = Math.max(0, v)), 0.1);
      num('fall speed', () => c.speed ?? 30, (v) => (c.speed = Math.max(2, v)), 5);
      num('yaw °', () => c.yaw ?? 0, (v) => (c.yaw = v), 15);
      colorRow();
    } else if (c.t === 'ramp') {
      num('length', () => c.len ?? 10, (v) => (c.len = Math.max(1, v)));
      num('rise', () => c.rise ?? 4, (v) => (c.rise = v));
      num('width', () => c.w ?? 8, (v) => (c.w = Math.max(1, v)));
      num('yaw °', () => c.yaw ?? 0, (v) => (c.yaw = v), 15);
      colorRow();
    } else if (c.t === 'rail') {
      if (c.pts && c.pts.length >= 2) {
        const note = document.createElement('div');
        note.className = 'ed-dim';
        note.textContent = `rail path · ${c.pts.length} nodes — double-click to drag them`;
        this.propsEl.appendChild(note);
        nodeRows();
      } else {
        num('length', () => c.len ?? 12, (v) => (c.len = Math.max(1, v)));
        num('yaw °', () => c.yaw ?? 0, (v) => (c.yaw = v), 15);
      }
    } else if (c.t === 'gate') {
      num('yaw °', () => c.yaw ?? 0, (v) => (c.yaw = v), 15);
      const note = document.createElement('div');
      note.className = 'ed-dim';
      note.textContent = 'finish gate — crossing its plane ends the run (one per level; yaw turns it with the course)';
      this.propsEl.appendChild(note);
    } else if (c.t === 'clock') {
      const note = document.createElement('div');
      note.className = 'ed-dim';
      note.textContent = 'time-trial activator — skating through the stopwatch starts a timed run to the gate (one per level, lives near spawn)';
      this.propsEl.appendChild(note);
    } else if (c.t === 'comboorb') {
      const note = document.createElement('div');
      note.className = 'ed-dim';
      note.textContent = 'combo-run activator — skating through the green plus starts a one-combo run to the gem at the gate (one per level, lives near spawn)';
      this.propsEl.appendChild(note);
    } else if (c.t === 'zone') {
      sizeRow(0, 'width');
      sizeRow(2, 'depth');
      const dirBtn = document.createElement('button');
      dirBtn.className = 'ed-btn';
      const dirLabel = (d: string): string =>
        d === 'E'
          ? 'side-scroll → (east)'
          : d === 'W'
            ? 'side-scroll ← (west)'
            : d === 'N'
              ? 'run AT the camera'
              : 'normal corridor (south)';
      dirBtn.textContent = dirLabel(c.dir ?? 'E');
      dirBtn.addEventListener('click', () => {
        const cycle: Record<string, 'E' | 'W' | 'N' | 'S'> = { E: 'W', W: 'N', N: 'S', S: 'E' };
        c.dir = cycle[c.dir ?? 'E'];
        this.commit();
        this.renderProps();
      });
      this.propsEl.appendChild(dirBtn);
      const note = document.createElement('div');
      note.className = 'ed-dim';
      note.textContent =
        'inside this region the course TURNS: east/west = classic side-scroll, camera holds its corridor view · run-at-camera = boulder-chase framing, forward charges the lens';
      this.propsEl.appendChild(note);
    } else if (c.t === 'rope') {
      num('length', () => c.len ?? 12, (v) => (c.len = Math.max(2, v)));
      num('yaw °', () => c.yaw ?? 0, (v) => (c.yaw = v), 15);
      num('sag', () => c.amp ?? 1.2, (v) => (c.amp = Math.max(0.1, v)), 0.1);
      num('break secs', () => c.shake ?? 3, (v) => (c.shake = Math.max(0.2, v)), 0.2);
      const note = document.createElement('div');
      note.className = 'ed-dim';
      note.textContent =
        'a grindable rope strung between posts: it sags under a grind, snaps after the break time, and restrings itself';
      this.propsEl.appendChild(note);
    } else if (c.t === 'pipe') {
      num('length', () => c.len ?? 36, (v) => (c.len = Math.max(6, v)), 2);
      num('flat half', () => c.w ?? 3, (v) => (c.w = Math.max(1, v)));
      num('wall radius', () => c.rise ?? 6, (v) => (c.rise = Math.max(2, v)));
      const axisBtn = document.createElement('button');
      axisBtn.className = 'ed-btn';
      axisBtn.textContent = `axis: along ${c.axis ?? 'z'}`;
      axisBtn.addEventListener('click', () => {
        c.axis = (c.axis ?? 'z') === 'z' ? 'x' : 'z';
        this.commit();
        this.renderProps();
      });
      this.propsEl.appendChild(axisBtn);
    } else if (c.t === 'crate') {
      const sel = document.createElement('select');
      sel.className = 'ed-select';
      for (const k of CRATE_KINDS) {
        const o = document.createElement('option');
        o.value = k;
        o.textContent = k === 'metalbounce' ? 'arrow (metal)' : k === 'bouncy' ? 'arrow (wood)' : k;
        if ((c.kind ?? 'wood') === k) o.selected = true;
        sel.appendChild(o);
      }
      sel.addEventListener('change', () => {
        c.kind = sel.value as CustomComponent['kind'];
        this.commit();
        this.renderProps();
      });
      this.propsEl.appendChild(sel);
      if (c.kind === 'bang') {
        const note = document.createElement('div');
        note.className = 'ed-dim';
        note.textContent =
          'metal switch: hit it in play to materialize the OUTLINE crates in its group (⌘G). ungrouped = fires all ungrouped outlines. never breaks, not counted';
        this.propsEl.appendChild(note);
      } else {
        // outline state: any crate can start as a pass-through ghost
        const row = document.createElement('div');
        row.className = 'ed-row';
        const lab = document.createElement('label');
        lab.textContent = 'outline';
        const chk = document.createElement('input');
        chk.type = 'checkbox';
        chk.checked = !!c.outline;
        chk.addEventListener('change', () => {
          if (chk.checked) c.outline = true;
          else delete c.outline;
          this.commit();
        });
        row.appendChild(lab);
        row.appendChild(chk);
        this.propsEl.appendChild(row);
        if (c.outline) {
          const note = document.createElement('div');
          note.className = 'ed-dim';
          note.textContent = 'ghost (no collision) until a "!" crate in its group is hit';
          this.propsEl.appendChild(note);
        }
      }
    } else if (c.t === 'rock') {
      this.materializeDims(c); // rocks default 3×2×3, not the platform 8×1×8
      sizeRow(0, 'width');
      sizeRow(1, 'height');
      sizeRow(2, 'depth');
      num('yaw °', () => c.yaw ?? 0, (v) => (c.yaw = v), 15);
      const shuffle = document.createElement('button');
      shuffle.className = 'ed-btn';
      shuffle.textContent = 'reshuffle shape';
      shuffle.addEventListener('click', () => {
        c.seed = Math.floor(Math.random() * 1e6);
        this.commit();
        shuffle.blur();
      });
      this.propsEl.appendChild(shuffle);
      colorRow();
    } else if (c.t === 'camnode') {
      num('corner radius', () => c.radius ?? 0, (v) => (c.radius = Math.max(0, v)));
      const note = document.createElement('div');
      note.className = 'ed-dim';
      note.textContent =
        'camera lane: nodes chain in order (see LAYERS). In play, the camera and the controls steer along the line — hold forward through winding corridors, Crash 3 style. 2+ nodes = live. Corner radius rounds the turn AT this node.';
      this.propsEl.appendChild(note);
      const chain = document.createElement('button');
      chain.className = 'ed-btn';
      chain.textContent = '+ chain next node';
      chain.addEventListener('click', () => {
        // continue the lane: step onward along the last segment's direction
        const nodes: number[] = [];
        this.data.components.forEach((o, i) => {
          if (o.t === 'camnode') nodes.push(i);
        });
        const lastIdx = nodes[nodes.length - 1];
        const last = this.data.components[lastIdx];
        const prev = nodes.length > 1 ? this.data.components[nodes[nodes.length - 2]] : null;
        let dx = 0;
        let dz = -6;
        if (prev) {
          const l = Math.hypot(last.p[0] - prev.p[0], last.p[2] - prev.p[2]) || 1;
          dx = ((last.p[0] - prev.p[0]) / l) * 6;
          dz = ((last.p[2] - prev.p[2]) / l) * 6;
        }
        this.addComponent({ t: 'camnode', p: [last.p[0] + dx, last.p[1], last.p[2] + dz] });
        chain.blur();
      });
      this.propsEl.appendChild(chain);
    } else if (c.t === 'enemy') {
      const alongZ = (((c.yaw ?? 0) % 180) + 180) % 180 >= 45 && (((c.yaw ?? 0) % 180) + 180) % 180 < 135;
      num(alongZ ? 'patrol ±z' : 'patrol ±x', () => c.range ?? 5, (v) => (c.range = Math.max(0.5, v)));
      num('speed', () => c.speed ?? 3, (v) => (c.speed = Math.max(0.5, v)));
      const axisBtn = document.createElement('button');
      axisBtn.className = 'ed-btn';
      axisBtn.textContent = `patrol: along ${alongZ ? 'Z' : 'X'}`;
      axisBtn.title = 'the walk is axis-bound — rotation comes in 90° steps';
      axisBtn.addEventListener('click', () => {
        c.yaw = alongZ ? 0 : 90;
        this.commit();
        this.renderProps();
      });
      this.propsEl.appendChild(axisBtn);
    } else if (c.t === 'crusher') {
      sizeRow(0, 'width');
      sizeRow(2, 'depth');
      num('cycle s', () => c.cycle ?? 3.2, (v) => (c.cycle = Math.max(0.5, v)), 0.2);
      num('phase', () => c.phase ?? 0, (v) => (c.phase = v), 0.2);
    } else if (c.t === 'pendulum') {
      num('arm len', () => c.len ?? 5, (v) => (c.len = Math.max(1, v)));
      num('swing amp', () => c.amp ?? 1.0, (v) => (c.amp = Math.max(0.1, v)), 0.1);
      num('speed', () => c.speed ?? 1.6, (v) => (c.speed = Math.max(0.2, v)), 0.1);
      num('phase', () => c.phase ?? 0, (v) => (c.phase = v), 0.2);
      num('yaw °', () => c.yaw ?? 0, (v) => (c.yaw = v), 15); // spins the whole gallows + swing plane
    }
    const row = document.createElement('div');
    row.className = 'ed-grid';
    // ROTATE 90°: yaw for the spinnable, dimension-swap for the axis-bound
    // (drawn polygons keep their authored outline — no 90° tricks)
    const rotatable =
      ['platform', 'ramp', 'rail', 'wall', 'pit', 'crumble', 'rock', 'pendulum', 'enemy', 'gate'].includes(c.t) && !c.pts;
    const swappable = ['crusher'].includes(c.t) && !c.pts;
    if (rotatable || swappable || c.t === 'pipe') {
      const rot = document.createElement('button');
      rot.className = 'ed-btn';
      rot.textContent = 'rotate 90°';
      rot.addEventListener('click', () => {
        if (rotatable) c.yaw = ((c.yaw ?? 0) + 90) % 360;
        else if (c.t === 'pipe') c.axis = (c.axis ?? 'z') === 'z' ? 'x' : 'z';
        else if (c.s) c.s = [c.s[2], c.s[1], c.s[0]];
        else c.s = [8, 1, 8];
        this.commit();
        this.renderProps();
      });
      row.appendChild(rot);
    }
    const dup = document.createElement('button');
    dup.className = 'ed-btn';
    dup.textContent = 'duplicate';
    dup.addEventListener('click', () => this.duplicateSelected());
    const cpy = document.createElement('button');
    cpy.className = 'ed-btn';
    cpy.textContent = 'copy ⌘C';
    cpy.addEventListener('click', () => this.copySelected());
    const del = document.createElement('button');
    del.className = 'ed-btn ed-danger';
    del.textContent = 'delete';
    del.addEventListener('click', () => this.deleteSelected());
    row.appendChild(dup);
    row.appendChild(cpy);
    row.appendChild(del);
    this.propsEl.appendChild(row);
  }

  private injectStyle(): void {
    const css = document.createElement('style');
    css.textContent = `
      .ed-panel {
        position: fixed; right: 10px; top: 10px; bottom: 10px; width: 228px;
        overflow-y: auto; z-index: 60; padding: 10px;
        font: 11px ui-monospace, Menlo, Consolas, monospace; color: #cdd6e4;
        background: rgba(16, 20, 30, 0.92); border: 1px solid #3a4152;
        border-radius: 10px;
      }
      .ed-title { font-weight: bold; letter-spacing: 1px; color: #58e08a; margin-bottom: 8px; }
      .ed-sect { color: #8fa2c0; letter-spacing: 1px; font-size: 10px; margin: 10px 0 4px; border-bottom: 1px solid #2a3142; padding-bottom: 2px; }
      .ed-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 4px; }
      .ed-btn {
        font: 10px ui-monospace, Menlo, Consolas, monospace;
        background: #1c2230; color: #9fb0c8; border: 1px solid #3a4152;
        border-radius: 6px; padding: 5px 4px; cursor: pointer;
      }
      .ed-btn:hover { background: #262e42; color: #d5e0f0; }
      .ed-palbtn {
        display: flex; align-items: center; gap: 6px; text-align: left;
        padding: 3px 6px;
      }
      .ed-palbtn canvas { flex: 0 0 18px; image-rendering: pixelated; }
      .ed-row input[type=color] { padding: 0; height: 22px; }
      .ed-danger { color: #ff8484; }
      .ed-test { width: 100%; margin-top: 10px; color: #58e08a; font-weight: bold; padding: 8px; }
      .ed-row { display: grid; grid-template-columns: 80px 1fr; gap: 6px; align-items: center; margin: 3px 0; }
      .ed-row label { color: #9fb0c8; }
      .ed-row input, .ed-row select, .ed-select {
        width: 100%; font: 11px ui-monospace, Menlo, Consolas, monospace;
        background: #10141e; color: #d5e0f0; border: 1px solid #3a4152;
        border-radius: 4px; padding: 3px 5px;
      }
      .ed-selhead { color: #ffd75e; margin: 4px 0; }
      .ed-dim { color: #6b7890; margin-top: 8px; line-height: 1.5; }
      .ed-sellist { margin: 0 0 6px; }
      /* editing: the play HUD gets out of the tools' way (build stamp stays) */
      body.ed-active [class^="hud-"]:not(.hud-build),
      body.ed-active [class*=" hud-"]:not(.hud-build) { display: none !important; }
      .ed-tabs {
        position: fixed; left: 10px; top: 120px; z-index: 60;
        display: flex; flex-direction: column; gap: 6px;
      }
      .ed-tab {
        font: 10px ui-monospace, Menlo, Consolas, monospace;
        background: rgba(16, 20, 30, 0.92); color: #9fb0c8;
        border: 1px solid #3a4152; border-radius: 8px; cursor: pointer;
        padding: 7px 6px; display: flex; flex-direction: column;
        align-items: center; gap: 3px; width: 44px;
      }
      .ed-tab span { letter-spacing: 1px; font-size: 8px; }
      .ed-tab:hover { background: #262e42; color: #d5e0f0; }
      .ed-tab-on { background: #1c2a22; color: #58e08a; border-color: #2f6a48; }
      .ed-pop {
        position: fixed; left: 62px; top: 120px; z-index: 60; width: 212px;
        max-height: calc(100vh - 190px); overflow-y: auto; padding: 10px;
        font: 11px ui-monospace, Menlo, Consolas, monospace; color: #cdd6e4;
        background: rgba(16, 20, 30, 0.94); border: 1px solid #3a4152;
        border-radius: 10px;
      }
      .ed-views {
        position: fixed; left: 10px; bottom: 26px; z-index: 60;
        display: flex; gap: 5px;
      }
      .ed-viewbtn {
        font: bold 11px ui-monospace, Menlo, Consolas, monospace;
        background: rgba(16, 20, 30, 0.92); color: #9fb0c8;
        border: 1px solid #3a4152; border-radius: 7px; cursor: pointer;
        width: 30px; height: 26px;
      }
      .ed-viewbtn:hover { background: #262e42; color: #58e08a; }
      .ed-layerrow {
        display: flex; align-items: center; gap: 4px; margin: 2px 0;
        padding: 2px 3px; border-radius: 5px;
      }
      .ed-layer-sel { background: rgba(88, 224, 138, 0.12); }
      .ed-grouprow { border-top: 1px solid rgba(58, 65, 82, 0.5); }
      .ed-groupname { color: #8fd4ff; }
      .ed-caret { width: 14px; }
      .ed-lockon { opacity: 1; color: #ffd75e; }
      .ed-lbtn {
        font: 10px ui-monospace, Menlo, Consolas, monospace;
        background: none; border: none; color: #9fb0c8; cursor: pointer;
        padding: 1px 2px;
      }
      .ed-lbtn:hover { color: #d5e0f0; }
      .ed-layername {
        flex: 1; text-align: left; font: 11px ui-monospace, Menlo, Consolas, monospace;
        background: none; border: none; color: #cdd6e4; cursor: pointer; padding: 2px;
        overflow: hidden; text-overflow: ellipsis; white-space: nowrap;
      }
      .ed-layername-input {
        flex: 1; font: 11px ui-monospace, Menlo, Consolas, monospace;
        background: #10141e; color: #d5e0f0; border: 1px solid #3a4152;
        border-radius: 4px; padding: 1px 4px; min-width: 0;
      }
      .ed-layercount { color: #6b7890; font-size: 10px; }
      .ed-layers .ed-grid { margin-top: 4px; }
      .ed-marquee {
        position: fixed; display: none; z-index: 55; pointer-events: none;
        border: 1px dashed #58e08a; background: rgba(88, 224, 138, 0.10);
        border-radius: 2px;
      }
    `;
    document.head.appendChild(css);
  }
}
