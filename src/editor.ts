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
    ],
  },
  {
    title: 'CRATES',
    items: [
      { label: 'wood', icon: (x) => { box(x, '#b5762f', '#7a4a18'); glyph(x, '▦', '#8a5a22'); }, make: (at) => ({ t: 'crate', p: [at.x, at.y + 0.5, at.z], kind: 'wood' }) },
      { label: 'arrow', icon: (x) => { box(x, '#b5762f', '#7a4a18'); glyph(x, '↑', '#3a9a4a'); }, make: (at) => ({ t: 'crate', p: [at.x, at.y + 0.5, at.z], kind: 'bouncy' }) },
      { label: 'TNT', icon: (x) => { box(x, '#c03a2a', '#6a180e'); glyph(x, 'T', '#ffe9d8'); }, make: (at) => ({ t: 'crate', p: [at.x, at.y + 0.5, at.z], kind: 'tnt' }) },
      { label: 'nitro', icon: (x) => { box(x, '#2fae44', '#0e4a18'); glyph(x, 'N', '#eafff0'); }, make: (at) => ({ t: 'crate', p: [at.x, at.y + 0.5, at.z], kind: 'nitro' }) },
      { label: 'mask', icon: (x) => { box(x, '#b5762f', '#7a4a18'); glyph(x, '☻', '#e89040'); }, make: (at) => ({ t: 'crate', p: [at.x, at.y + 0.5, at.z], kind: 'mask' }) },
      { label: '? crate', icon: (x) => { box(x, '#b5762f', '#7a4a18'); glyph(x, '?', '#ff8c1a'); }, make: (at) => ({ t: 'crate', p: [at.x, at.y + 0.5, at.z], kind: 'mystery' }) },
      { label: '! crate', icon: (x) => { box(x, '#b5762f', '#7a4a18'); glyph(x, '!', '#ffd934'); }, make: (at) => ({ t: 'crate', p: [at.x, at.y + 0.5, at.z], kind: 'bang' }) },
      { label: 'nitro !', icon: (x) => { box(x, '#2fae44', '#0e4a18'); glyph(x, '!', '#eafff0'); }, make: (at) => ({ t: 'crate', p: [at.x, at.y + 0.5, at.z], kind: 'nitrobang' }) },
      { label: 'metal', icon: (x) => { box(x, '#9aa2ac', '#666e78'); x.fillStyle = '#666e78'; for (const [rx, ry] of [[5, 5], [12, 5], [5, 12], [12, 12]]) x.fillRect(rx, ry, 2, 2); }, make: (at) => ({ t: 'metal', p: [at.x, at.y, at.z] }) },
      { label: 'outline', icon: (x) => { x.strokeStyle = '#f2e2b0'; x.lineWidth = 1.5; x.setLineDash([3, 2]); x.strokeRect(3, 3, 12, 12); x.setLineDash([]); }, make: (at) => ({ t: 'outline', p: [at.x, at.y, at.z] }) },
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

const CRATE_KINDS = ['wood', 'bouncy', 'nitro', 'tnt', 'mask', 'mystery', 'bang', 'nitrobang'] as const;

// components that grow draggable resize handles on double-click
const RESIZABLE = new Set(['platform', 'wall', 'pit', 'crumble', 'crusher', 'ramp', 'rail', 'pipe', 'enemy', 'pendulum']);

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
  private selected = -1;
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
  private selBox: THREE.Box3Helper | null = null;
  private spawnMarker: THREE.Group | null = null;
  private snap = true;
  // drag state
  private dragging = false;
  private dragPlane = new THREE.Plane();
  private dragStart = new THREE.Vector3(); // plane hit at drag start
  private dragOrig: [number, number, number] = [0, 0, 0];
  private dragVertical = false;
  private downAt: { x: number; y: number } | null = null;
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
  }

  enter(): void {
    if (this.active) return;
    this.active = true;
    this.data = getCustomLevelData();
    if (!this.lastCommitted) this.lastCommitted = JSON.stringify(this.data);
    this.controls = new OrbitControls(this.camera, this.dom);
    this.controls.enableDamping = true;
    this.controls.dampingFactor = 0.12;
    this.controls.target.set(this.data.spawn[0], this.data.spawn[1], this.data.spawn[2] - 6);
    this.camera.position.set(this.data.spawn[0] + 16, this.data.spawn[1] + 26, this.data.spawn[2] + 26);
    this.panel.style.display = 'block';
    this.select(-1);
    this.refreshSpawnMarker();
    this.setGhostsVisible(true);
    this.hooks.showMsg('LEVEL EDITOR', 'click to select · drag to move · shift-drag = height');
  }

  exit(): void {
    if (!this.active) return;
    this.active = false;
    this.controls?.dispose();
    this.controls = null;
    this.panel.style.display = 'none';
    this.select(-1);
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
  }

  get selectedIndex(): number {
    return this.selected;
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
    this.data = d;
    this.select(-1);
    this.commit();
  }

  // main calls this after every rebuild so the highlight tracks fresh meshes
  onLevelRebuilt(): void {
    if (this.selected >= this.data.components.length) this.select(-1);
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

  private commit(rebuild = true): void {
    const now = JSON.stringify(this.data);
    if (this.lastCommitted && now !== this.lastCommitted) {
      this.undoStack.push(this.lastCommitted);
      if (this.undoStack.length > 100) this.undoStack.shift();
      this.redoStack.length = 0; // a fresh edit forks history
    }
    this.lastCommitted = now;
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
    this.data = JSON.parse(json) as CustomLevelData;
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
    this.data.components.push(c);
    this.commit();
    this.select(this.data.components.length - 1);
  }

  private deleteSelected(): void {
    if (this.selected < 0) return;
    this.data.components.splice(this.selected, 1);
    this.select(-1);
    this.commit();
  }

  private duplicateSelected(): void {
    if (this.selected < 0) return;
    const src = this.data.components[this.selected];
    const copy = JSON.parse(JSON.stringify(src)) as CustomComponent;
    copy.p = [copy.p[0] + 3, copy.p[1], copy.p[2] + 3];
    this.addComponent(copy);
  }

  // ---- selection + picking ----

  private select(idx: number): void {
    if (idx !== this.resizeIdx) this.setResize(-1); // handles follow the selection
    this.selected = idx;
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

  private refreshSelectionBox(): void {
    if (this.selBox) {
      this.scene.remove(this.selBox);
      this.selBox = null;
    }
    if (this.selected < 0) return;
    const objs = this.objectsFor(this.selected);
    if (objs.length === 0) return;
    const box = new THREE.Box3();
    for (const o of objs) box.expandByObject(o);
    box.expandByScalar(0.15);
    this.selBox = new THREE.Box3Helper(box, new THREE.Color(0x58e08a));
    this.scene.add(this.selBox);
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
        if (o.userData.editorIdx !== undefined) return o.userData.editorIdx as number;
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
    if (c.t === 'platform') {
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
    if (!this.active) return;
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
    // dragging starts only from the ALREADY selected component — first click
    // selects, second grab moves (keeps orbit usable everywhere else)
    if (hit >= 0 && hit === this.selected) {
      const c = this.data.components[this.selected];
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
        if (this.controls) this.controls.enabled = false;
      }
    }
  };

  private onMove = (e: PointerEvent): void => {
    if (!this.active) return;
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
    // hovering a handle: show it's grabbable
    if (this.resizeIdx >= 0 && !this.dragging && this.handleMeshes.length > 0) {
      this.setRay(e);
      const over = this.raycaster.intersectObjects(this.handleMeshes, false).length > 0;
      this.dom.style.cursor = over ? 'grab' : '';
    }
    if (!this.dragging || this.selected < 0) return;
    const hit = new THREE.Vector3();
    if (!this.groundPoint(e, this.dragPlane, hit)) return;
    const c = this.data.components[this.selected];
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
    // live-preview: shift the tagged visuals; physics catches up on release
    const dx = nx - c.p[0];
    const dy = ny - c.p[1];
    const dz = nz - c.p[2];
    if (dx || dy || dz) {
      for (const o of this.objectsFor(this.selected)) o.position.add(new THREE.Vector3(dx, dy, dz));
      c.p = [nx, ny, nz];
      this.refreshSelectionBox();
      this.renderProps();
    }
  };

  private onUp = (e: PointerEvent): void => {
    if (!this.active) return;
    if (this.hdlDrag) {
      this.hdlDrag = null;
      if (this.controls) this.controls.enabled = true;
      this.commit(); // one undo step for the whole handle stretch
      return;
    }
    if (this.dragging) {
      this.dragging = false;
      if (this.controls) this.controls.enabled = true;
      this.commit(); // rebuild: colliders/rails regenerate at the new spot
      return;
    }
    // plain click (no drag distance): select / deselect
    if (this.downAt && Math.hypot(e.clientX - this.downAt.x, e.clientY - this.downAt.y) < 5 && e.button === 0) {
      this.select(this.pick(e));
    }
    this.downAt = null;
  };

  private onKey = (e: KeyboardEvent): void => {
    if (!this.active) return;
    const typing = (e.target as HTMLElement)?.tagName === 'INPUT' || (e.target as HTMLElement)?.tagName === 'SELECT';
    if (typing) return;
    if (e.code === 'Escape' && this.resizeIdx >= 0) this.setResize(-1);
    if (e.code === 'Delete' || e.code === 'Backspace') this.deleteSelected();
    if (e.code === 'KeyD' && (e.ctrlKey || e.metaKey)) {
      e.preventDefault();
      this.duplicateSelected();
    }
    // Cmd+Z / Cmd+Shift+Z (mac) — Ctrl works too
    if (e.code === 'KeyZ' && (e.metaKey || e.ctrlKey)) {
      e.preventDefault();
      if (e.shiftKey) this.redo();
      else this.undo();
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

    // add palette: grouped, icon + label per component
    for (const sect of PALETTE_SECTIONS) {
      panel.appendChild(h(`<div class="ed-sect">ADD · ${sect.title}</div>`));
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
      panel.appendChild(pal);
    }

    // selection properties (rebuilt on select)
    panel.appendChild(h('<div class="ed-sect">SELECTION</div>'));
    this.propsEl = h('<div class="ed-props"><div class="ed-dim">click a component…</div></div>');
    panel.appendChild(this.propsEl);

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
      h('<div class="ed-dim">orbit: drag · zoom: wheel · pan: right-drag<br>move: drag selected (shift = height)<br>double-click = resize handles (esc = done)<br>del = delete · ⌘D = duplicate<br>⌘Z = undo · ⌘⇧Z = redo</div>'),
    );

    document.body.appendChild(panel);
    this.panel = panel;
    this.injectStyle();
  }

  private buildPanelLevelRefresh: (() => void) | null = null;

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
        this.commit();
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
    if (this.selected < 0 || !this.data.components[this.selected]) {
      this.propsEl.innerHTML = '<div class="ed-dim">click a component…</div>';
      return;
    }
    const c = this.data.components[this.selected];
    const head = document.createElement('div');
    head.className = 'ed-selhead';
    head.textContent = `#${this.selected} · ${c.t}`;
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
        o.textContent = k;
        if ((c.kind ?? 'wood') === k) o.selected = true;
        sel.appendChild(o);
      }
      sel.addEventListener('change', () => {
        c.kind = sel.value as CustomComponent['kind'];
        this.commit();
      });
      this.propsEl.appendChild(sel);
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
    const del = document.createElement('button');
    del.className = 'ed-btn ed-danger';
    del.textContent = 'delete';
    del.addEventListener('click', () => this.deleteSelected());
    row.appendChild(dup);
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
    `;
    document.head.appendChild(css);
  }
}
