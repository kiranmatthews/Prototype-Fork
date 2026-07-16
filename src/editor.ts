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
} from './level';

interface Hooks {
  rebuild: () => void; // dispose + reconstruct the custom level from data
  exitToPlay: () => void; // leave the editor and hand control back to the game
  showMsg: (title: string, sub?: string) => void;
}

// what the ADD palette spawns, at the camera's focus point — grouped, each
// with a little drawn icon so the crate language reads at a glance
type Draw = (x: CanvasRenderingContext2D) => void;
interface PalItem {
  label: string;
  icon: Draw;
  make: (at: THREE.Vector3) => CustomComponent;
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
    title: 'HAZARDS & THINGS',
    items: [
      { label: 'enemy', icon: (x) => { x.fillStyle = '#c03a2a'; x.beginPath(); x.arc(9, 11, 5, 0, 7); x.fill(); x.fillStyle = '#fff'; x.fillRect(6, 9, 2, 2); x.fillRect(10, 9, 2, 2); }, make: (at) => ({ t: 'enemy', p: [at.x, at.y + 0.5, at.z], range: 5, speed: 3 }) },
      { label: 'crusher', icon: (x) => { x.fillStyle = '#8f8f98'; x.fillRect(3, 2, 12, 7); glyph(x, '↓', '#2a2a30'); }, make: (at) => ({ t: 'crusher', p: [at.x, at.y, at.z], s: [4, 3, 3], cycle: 3.2, phase: 0 }) },
      { label: 'pendulum', icon: (x) => { x.strokeStyle = '#6a7078'; x.lineWidth = 1.5; x.beginPath(); x.moveTo(9, 2); x.lineTo(13, 11); x.stroke(); x.fillStyle = '#565c66'; x.beginPath(); x.arc(13.5, 13, 3, 0, 7); x.fill(); }, make: (at) => ({ t: 'pendulum', p: [at.x, at.y + 7, at.z], len: 5, amp: 1.0, speed: 1.6, phase: 0 }) },
      { label: 'wumpa', icon: (x) => { x.fillStyle = '#ff9028'; x.beginPath(); x.arc(9, 10, 5, 0, 7); x.fill(); x.fillStyle = '#3a9a4a'; x.fillRect(8, 3, 2, 3); }, make: (at) => ({ t: 'wumpa', p: [at.x, at.y + 1.2, at.z] }) },
      { label: 'crystal', icon: (x) => { x.fillStyle = '#c83af0'; x.beginPath(); x.moveTo(9, 2); x.lineTo(14, 9); x.lineTo(9, 16); x.lineTo(4, 9); x.closePath(); x.fill(); }, make: (at) => ({ t: 'crystal', p: [at.x, at.y + 0.5, at.z] }) },
    ],
  },
];

const CRATE_KINDS = ['wood', 'bouncy', 'metalbounce', 'nitro', 'tnt', 'mask', 'mystery', 'bang', 'nitrobang'] as const;

// components that grow draggable resize handles on double-click
const RESIZABLE = new Set(['platform', 'rock', 'wall', 'pit', 'crumble', 'crusher', 'ramp', 'rail', 'pipe', 'enemy', 'pendulum']);

// A resize handle: lives at `pos`, drags along `dir` (world space, outward),
// and `apply` rewrites the component from its grab-time snapshot given the
// travel distance — pure from `orig`, so re-applying while dragging is stable.
interface HandleDef {
  pos: THREE.Vector3;
  dir: THREE.Vector3;
  apply: (orig: CustomComponent, c: CustomComponent, d: number) => void;
}
const HANDLE_GEO = new THREE.BoxGeometry(0.55, 0.55, 0.55);

export class Editor {
  active = false;
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
  // layers: new components land on the active layer; locked layers are
  // untouchable (no pick, no marquee, no select-all)
  private activeLayer = 0;
  private layersEl: HTMLElement | null = null;
  private renamingLayer = -1;
  private camSaveAt = 0;
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
  private handleMeshes: THREE.Mesh[] = [];
  private hdlDrag: {
    i: number;
    lineO: THREE.Vector3;
    lineD: THREE.Vector3;
    t0: number;
    orig: CustomComponent;
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

  enter(): void {
    if (this.active) return;
    this.active = true;
    this.data = migrateCustomLevel(getCustomLevelData());
    if (!this.data.layers!.some((l) => l.id === this.activeLayer)) this.activeLayer = this.data.layers![0].id;
    if (!this.lastCommitted) this.lastCommitted = JSON.stringify(this.data);
    this.controls = new OrbitControls(this.camera, this.dom);
    this.controls.enableDamping = true;
    this.controls.dampingFactor = 0.12;
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
    document.body.classList.add('ed-active'); // hides the play HUD under the tools
    this.panel.style.display = 'block';
    if (this.popWrap) this.popWrap.style.display = 'block';
    this.setPop((localStorage.getItem('protoEditorPop') as 'add' | 'layers' | '') ?? 'add');
    this.select(-1);
    this.renderLayers();
    this.refreshSpawnMarker();
    this.setGhostsVisible(true);
    this.hooks.showMsg('LEVEL EDITOR', 'click select · shift-click/shift-drag = multi · ⌘G group');
  }

  exit(): void {
    if (!this.active) return;
    this.active = false;
    this.saveCam();
    localStorage.removeItem('protoEditorOpen');
    this.controls?.dispose();
    this.controls = null;
    document.body.classList.remove('ed-active');
    this.panel.style.display = 'none';
    if (this.popWrap) this.popWrap.style.display = 'none';
    this.select(-1);
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
    // keep resize handles a steady on-screen size at any zoom
    for (const m of this.handleMeshes) {
      m.scale.setScalar(THREE.MathUtils.clamp(this.camera.position.distanceTo(m.position) * 0.022, 0.7, 3));
    }
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
    if (!this.data.layers!.some((l) => l.id === this.activeLayer)) this.activeLayer = this.data.layers![0].id;
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
    setCustomLevelData(this.data);
    try {
      localStorage.setItem('protoCustomLevel', now);
    } catch {
      /* storage full: the working copy still lives in memory */
    }
    if (rebuild) this.hooks.rebuild();
  }

  // swap in a history state WITHOUT recording it as a new edit
  private applyState(json: string): void {
    this.data = migrateCustomLevel(JSON.parse(json) as CustomLevelData);
    if (!this.data.layers!.some((l) => l.id === this.activeLayer)) this.activeLayer = this.data.layers![0].id;
    this.lastCommitted = json;
    setCustomLevelData(this.data);
    try {
      localStorage.setItem('protoCustomLevel', json);
    } catch {
      /* ignore */
    }
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
    // ONE crystal per level: placing a new one replaces the old
    if (c.t === 'crystal') {
      this.data.components = this.data.components.filter((o) => o.t !== 'crystal');
    }
    if (this.activeLayer !== 0) c.layer = this.activeLayer; // new pieces land on the active layer
    this.data.components.push(c);
    this.commit();
    this.select(this.data.components.length - 1);
  }

  // append a batch (duplicate/paste) as ONE undo step and select the copies.
  // The one-crystal rule holds: a crystal in the batch replaces the level's.
  private addBatch(batch: CustomComponent[]): void {
    if (batch.length === 0) return;
    const lastCrystal = batch.map((c) => c.t).lastIndexOf('crystal');
    const clean = batch.filter((c, i) => c.t !== 'crystal' || i === lastCrystal);
    if (lastCrystal >= 0) {
      this.data.components = this.data.components.filter((o) => o.t !== 'crystal');
    }
    const start = this.data.components.length;
    this.data.components.push(...clean);
    this.commit();
    this.setSelection(clean.map((_, i) => start + i));
  }

  private deleteSelected(): void {
    if (this.sel.length === 0) return;
    const dying = [...this.sel].sort((a, b) => b - a);
    for (const i of dying) this.data.components.splice(i, 1);
    this.select(-1);
    this.commit();
  }

  private duplicateSelected(): void {
    if (this.sel.length === 0) return;
    const copies = this.sel.map((i) => {
      const copy = JSON.parse(JSON.stringify(this.data.components[i])) as CustomComponent;
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
      (i) => JSON.parse(JSON.stringify(this.data.components[i])) as CustomComponent,
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
      dx = Math.round(dx * 2) / 2;
      dz = Math.round(dz * 2) / 2;
    }
    const copies = this.clipboard.map((c) => {
      const copy = JSON.parse(JSON.stringify(c)) as CustomComponent;
      copy.p = [copy.p[0] + dx, copy.p[1], copy.p[2] + dz];
      return copy;
    });
    this.remapGroups(copies); // fresh group wiring for the batch
    this.addBatch(copies);
  }

  // ---- layers ----

  private layerOf(c: CustomComponent): number {
    return c.layer ?? 0;
  }

  private isLockedIdx(idx: number): boolean {
    const c = this.data.components[idx];
    if (!c) return false;
    const l = this.data.layers?.find((L) => L.id === this.layerOf(c));
    return !!l?.locked;
  }

  private nextLayerId(): number {
    return (this.data.layers ?? []).reduce((m, l) => Math.max(m, l.id), -1) + 1;
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
      face(new THREE.Vector3(1, 0, 0), mid.clone().setX(mid.x + s[0] / 2), 0, 0.5);
      face(new THREE.Vector3(-1, 0, 0), mid.clone().setX(mid.x - s[0] / 2), 0, 0.5);
      face(new THREE.Vector3(0, 0, 1), mid.clone().setZ(mid.z + s[2] / 2), 2, 0.5);
      face(new THREE.Vector3(0, 0, -1), mid.clone().setZ(mid.z - s[2] / 2), 2, 0.5);
      face(new THREE.Vector3(0, 1, 0), P.clone().setY(P.y + s[1]), 1, 0.5, false); // grows up from the base
    } else if (c.t === 'pit' || c.t === 'crumble' || c.t === 'crusher') {
      const s = c.s!;
      const y = c.t === 'crusher' ? P.y + 1.2 : P.y;
      const at = (x: number, z: number): THREE.Vector3 => new THREE.Vector3(P.x + x, y, P.z + z);
      face(new THREE.Vector3(1, 0, 0), at(s[0] / 2, 0), 0, 1);
      face(new THREE.Vector3(-1, 0, 0), at(-s[0] / 2, 0), 0, 1);
      face(new THREE.Vector3(0, 0, 1), at(0, s[2] / 2), 2, 1);
      face(new THREE.Vector3(0, 0, -1), at(0, -s[2] / 2), 2, 1);
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
    } else if (c.t === 'rail') {
      const u = loc(0, 0, 1); // (sin yaw, 0, cos yaw): the rail's run
      const len = c.len!;
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
        new THREE.MeshBasicMaterial({ color: 0xffd75e, depthTest: false, transparent: true, opacity: 0.92 }),
      );
      m.renderOrder = 999; // draw on top: grabbable even inside geometry
      m.position.copy(def.pos);
      m.userData.hdl = i;
      g.add(m);
      this.handleMeshes.push(m);
    });
    this.scene.add(g);
    this.handleGroup = g;
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
    // resize handles grab first — they float over everything else
    if (this.resizeIdx >= 0 && this.handleMeshes.length > 0) {
      this.setRay(e);
      this.handleGroup?.updateMatrixWorld(true); // may not have rendered yet
      const hits = this.raycaster.intersectObjects(this.handleMeshes, false);
      if (hits.length > 0) {
        const i = hits[0].object.userData.hdl as number;
        const def = this.hdlDefs[i];
        const lineO = def.pos.clone();
        const lineD = def.dir.clone();
        const t0 = this.axisT(lineO, lineD);
        if (t0 !== null) {
          this.hdlDrag = {
            i,
            lineO,
            lineD,
            t0,
            orig: JSON.parse(JSON.stringify(this.data.components[this.resizeIdx])) as CustomComponent,
          };
          if (this.controls) this.controls.enabled = false;
          this.downAt = null;
          return;
        }
      }
    }
    this.downAt = { x: e.clientX, y: e.clientY };
    const hit = this.pick(e);
    // shift-drag on EMPTY space: marquee box-select (adds to the selection)
    if (hit < 0 && e.shiftKey) {
      this.marquee = { x0: e.clientX, y0: e.clientY, x1: e.clientX, y1: e.clientY };
      this.showMarquee();
      if (this.controls) this.controls.enabled = false;
      return;
    }
    // dragging starts only from an ALREADY selected component — first click
    // selects, second grab moves (keeps orbit usable everywhere else). A grab
    // with ctrl/cmd held is a toggle-click, never a move.
    const plainGrab = !e.ctrlKey && !e.metaKey;
    if (hit >= 0 && this.sel.includes(hit) && plainGrab) {
      let grabbed = hit;
      // alt-drag clones: the copies come along, the originals stay put
      if (e.altKey) {
        const order = [...this.sel];
        const start = this.data.components.length;
        const copies = order.map(
          (i) => JSON.parse(JSON.stringify(this.data.components[i])) as CustomComponent,
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
    // resize-handle drag: re-apply from the grab snapshot at the new travel
    if (this.hdlDrag && this.resizeIdx >= 0) {
      this.setRay(e);
      const t = this.axisT(this.hdlDrag.lineO, this.hdlDrag.lineD);
      if (t === null) return;
      let d = t - this.hdlDrag.t0;
      if (this.snap) d = Math.round(d * 2) / 2;
      const c = this.data.components[this.resizeIdx];
      this.hdlDefs[this.hdlDrag.i].apply(this.hdlDrag.orig, c, d);
      // handles + panel track live; geometry rebuilds on a light throttle
      const defs = this.handleDefsFor(c);
      defs.forEach((df, j) => this.handleMeshes[j]?.position.copy(df.pos));
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
      const over = this.raycaster.intersectObjects(this.handleMeshes, false).length > 0;
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
      nx = Math.round(nx * 2) / 2;
      ny = Math.round(ny * 2) / 2;
      nz = Math.round(nz * 2) / 2;
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
      this.marquee = null;
      this.hideMarquee();
      if (this.controls) this.controls.enabled = true;
      // a real sweep adds everything it touched (whole groups come along);
      // a sub-click shift-tap on empty space falls through to click logic
      if (!clickish) {
        const hits = this.marqueePick(m).flatMap((i) => this.expandToGroup(i));
        this.setSelection([...this.sel, ...hits]);
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
      if (this.controls) this.controls.mouseButtons.LEFT = THREE.MOUSE.ROTATE;
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
          const at = this.controls ? this.controls.target.clone() : new THREE.Vector3();
          if (this.snap) {
            at.x = Math.round(at.x * 2) / 2;
            at.y = Math.round(at.y * 2) / 2;
            at.z = Math.round(at.z * 2) / 2;
          }
          this.addComponent(p.make(at));
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
      h('<div class="ed-dim">new pieces land on the ● active layer<br>🔒 = click-through (safe from edits)</div>'),
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
      this.data.spawn = [Math.round(t.x * 2) / 2, Math.round(t.y * 2) / 2 + 0.6, Math.round(t.z * 2) / 2];
      this.commit();
      this.buildPanelLevelRefresh?.();
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
    const mk = (label: string, fn: () => void): void => {
      const b = h(`<button class="ed-btn">${label}</button>`) as HTMLButtonElement;
      b.addEventListener('click', () => {
        fn();
        b.blur();
      });
      file.appendChild(b);
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
    mk('start over', () => {
      this.data = starterCustomLevel();
      this.select(-1);
      this.commit();
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
      h('<div class="ed-dim">add pieces + layers: tabs on the LEFT edge<br>orbit: drag · zoom: wheel · pan: right-drag<br>HOLD SPACE = grabby-hand pan<br>X/Y/Z (bottom-left) = hard view snaps<br>move: drag selected (shift = height)<br>alt-drag selected = drag out a copy<br>shift-click = add to selection<br>shift-drag empty = box select · ⌘A = all<br>⌘G = group · ⌘⇧G = ungroup (groups click as one)<br>⌘C copy · ⌘V paste at focus · ⌘X cut<br>arrows = nudge (shift↑↓ = height) · F = frame<br>double-click = resize handles (esc = done)<br>del = delete · ⌘D = duplicate<br>⌘Z = undo · ⌘⇧Z = redo<br><br>outline crates: ghost boxes that a "!" crate in the SAME GROUP turns real when hit</div>'),
    );

    document.body.appendChild(panel);
    this.panel = panel;
    this.injectStyle();
  }

  private buildPanelLevelRefresh: (() => void) | null = null;

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

  // ---- layers panel ----

  private renderLayers(): void {
    if (!this.layersEl) return;
    const layers = this.data.layers ?? [];
    this.layersEl.innerHTML = '';
    const counts = new Map<number, number>();
    for (const c of this.data.components) {
      counts.set(this.layerOf(c), (counts.get(this.layerOf(c)) ?? 0) + 1);
    }
    for (const L of layers) {
      const row = document.createElement('div');
      row.className = 'ed-layerrow' + (L.id === this.activeLayer ? ' ed-layer-active' : '');
      // lock toggle: locked layers can't be picked, marqueed, or edited
      const lock = document.createElement('button');
      lock.className = 'ed-lbtn';
      lock.textContent = L.locked ? '🔒' : '🔓';
      lock.title = L.locked ? 'unlock layer' : 'lock layer';
      lock.addEventListener('click', () => {
        L.locked = !L.locked;
        if (L.locked) this.setSelection(this.sel.filter((i) => !this.isLockedIdx(i)));
        this.commit(false); // pure metadata: no geometry rebuild needed
        this.renderLayers();
      });
      row.appendChild(lock);
      // name: click = make active · rename via ✎ (inline input)
      if (this.renamingLayer === L.id) {
        const input = document.createElement('input');
        input.className = 'ed-layername-input';
        input.value = L.name;
        input.addEventListener('keydown', (ev) => {
          if (ev.code === 'Enter') input.blur();
          ev.stopPropagation(); // typing guard: editor hotkeys stay out
        });
        input.addEventListener('blur', () => {
          L.name = input.value.trim() || L.name;
          this.renamingLayer = -1;
          this.commit(false);
          this.renderLayers();
        });
        row.appendChild(input);
        setTimeout(() => {
          input.focus();
          input.select();
        }, 0);
      } else {
        const name = document.createElement('button');
        name.className = 'ed-layername';
        name.textContent = `${L.id === this.activeLayer ? '● ' : ''}${L.name}`;
        name.title = 'click: make active — new pieces land here';
        name.addEventListener('click', () => {
          this.activeLayer = L.id;
          this.renderLayers();
        });
        row.appendChild(name);
      }
      const n = document.createElement('span');
      n.className = 'ed-layercount';
      n.textContent = String(counts.get(L.id) ?? 0);
      row.appendChild(n);
      const ren = document.createElement('button');
      ren.className = 'ed-lbtn';
      ren.textContent = '✎';
      ren.title = 'rename layer';
      ren.addEventListener('click', () => {
        this.renamingLayer = L.id;
        this.renderLayers();
      });
      row.appendChild(ren);
      // delete: only an EMPTY non-last layer (no surprise data loss)
      if ((counts.get(L.id) ?? 0) === 0 && layers.length > 1) {
        const del = document.createElement('button');
        del.className = 'ed-lbtn ed-danger';
        del.textContent = '✕';
        del.title = 'delete empty layer';
        del.addEventListener('click', () => {
          this.data.layers = layers.filter((x) => x.id !== L.id);
          if (this.activeLayer === L.id) this.activeLayer = this.data.layers[0].id;
          this.commit(false);
          this.renderLayers();
        });
        row.appendChild(del);
      }
      this.layersEl.appendChild(row);
    }
    const actions = document.createElement('div');
    actions.className = 'ed-grid';
    const add = document.createElement('button');
    add.className = 'ed-btn';
    add.textContent = '+ layer';
    add.addEventListener('click', () => {
      const id = this.nextLayerId();
      this.data.layers = [...layers, { id, name: `layer ${id}` }];
      this.activeLayer = id;
      this.renamingLayer = id; // name it right away
      this.commit(false);
      this.renderLayers();
      add.blur();
    });
    actions.appendChild(add);
    const assign = document.createElement('button');
    assign.className = 'ed-btn';
    assign.textContent = 'selection → layer';
    assign.title = 'move the selected pieces onto the active layer';
    assign.addEventListener('click', () => {
      if (this.sel.length === 0) return;
      for (const i of this.sel) {
        const c = this.data.components[i];
        if (this.activeLayer === 0) delete c.layer;
        else c.layer = this.activeLayer;
      }
      this.commit(false);
      this.renderLayers();
      assign.blur();
    });
    actions.appendChild(assign);
    this.layersEl.appendChild(actions);
  }

  // a labelled number field that commits on change
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
    };
    if (c.t === 'platform' || c.t === 'wall') {
      sizeRow(0, 'width');
      sizeRow(1, 'height');
      sizeRow(2, 'depth');
      if (c.t === 'platform') num('yaw °', () => c.yaw ?? 0, (v) => (c.yaw = v), 15);
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
    } else if (c.t === 'crumble') {
      sizeRow(0, 'width');
      sizeRow(2, 'depth');
      num('shake', () => c.shake ?? 0.7, (v) => (c.shake = Math.max(0, v)), 0.1);
      colorRow();
    } else if (c.t === 'ramp') {
      num('length', () => c.len ?? 10, (v) => (c.len = Math.max(1, v)));
      num('rise', () => c.rise ?? 4, (v) => (c.rise = v));
      num('width', () => c.w ?? 8, (v) => (c.w = Math.max(1, v)));
      num('yaw °', () => c.yaw ?? 0, (v) => (c.yaw = v), 15);
      colorRow();
    } else if (c.t === 'rail') {
      num('length', () => c.len ?? 12, (v) => (c.len = Math.max(1, v)));
      num('yaw °', () => c.yaw ?? 0, (v) => (c.yaw = v), 15);
    } else if (c.t === 'pipe') {
      num('length', () => c.len ?? 36, (v) => (c.len = Math.max(6, v)), 2);
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
    } else if (c.t === 'enemy') {
      num('patrol ±x', () => c.range ?? 5, (v) => (c.range = Math.max(0.5, v)));
      num('speed', () => c.speed ?? 3, (v) => (c.speed = Math.max(0.5, v)));
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
    }
    const row = document.createElement('div');
    row.className = 'ed-grid';
    // ROTATE 90°: yaw for the spinnable, dimension-swap for the axis-bound
    const rotatable = ['platform', 'ramp', 'rail'].includes(c.t);
    const swappable = ['wall', 'crumble', 'pit', 'crusher'].includes(c.t);
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
      .ed-row input, .ed-select {
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
      .ed-layer-active { background: rgba(88, 224, 138, 0.08); }
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
      .ed-layer-active .ed-layername { color: #58e08a; }
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
