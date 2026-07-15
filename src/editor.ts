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

// what the ADD palette spawns, at the camera's focus point
const PALETTE: { label: string; make: (at: THREE.Vector3) => CustomComponent }[] = [
  { label: 'platform', make: (at) => ({ t: 'platform', p: [at.x, at.y, at.z], s: [10, 1, 10] }) },
  { label: 'ramp', make: (at) => ({ t: 'ramp', p: [at.x, at.y, at.z], len: 10, rise: 4, w: 8 }) },
  { label: 'wall', make: (at) => ({ t: 'wall', p: [at.x, at.y, at.z], s: [8, 4, 1] }) },
  { label: 'rail', make: (at) => ({ t: 'rail', p: [at.x, at.y + 1, at.z], len: 12, yaw: 0 }) },
  { label: 'halfpipe', make: (at) => ({ t: 'pipe', p: [at.x, at.y, at.z], len: 36, axis: 'z' }) },
  { label: 'crumble', make: (at) => ({ t: 'crumble', p: [at.x, at.y + 1, at.z], s: [3, 1, 3], shake: 0.7 }) },
  { label: 'crate', make: (at) => ({ t: 'crate', p: [at.x, at.y + 0.5, at.z], kind: 'wood' }) },
  { label: 'checkpoint', make: (at) => ({ t: 'checkpoint', p: [at.x, at.y + 0.5, at.z] }) },
  { label: 'enemy', make: (at) => ({ t: 'enemy', p: [at.x, at.y + 0.5, at.z], range: 5, speed: 3 }) },
  { label: 'wumpa', make: (at) => ({ t: 'wumpa', p: [at.x, at.y + 1.2, at.z] }) },
  { label: 'crystal', make: (at) => ({ t: 'crystal', p: [at.x, at.y + 0.5, at.z] }) },
];

const CRATE_KINDS = ['wood', 'bouncy', 'nitro', 'tnt', 'mask', 'mystery'] as const;

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
    window.addEventListener('keydown', this.onKey);
  }

  enter(): void {
    if (this.active) return;
    this.active = true;
    this.data = getCustomLevelData();
    this.controls = new OrbitControls(this.camera, this.dom);
    this.controls.enableDamping = true;
    this.controls.dampingFactor = 0.12;
    this.controls.target.set(this.data.spawn[0], this.data.spawn[1], this.data.spawn[2] - 6);
    this.camera.position.set(this.data.spawn[0] + 16, this.data.spawn[1] + 26, this.data.spawn[2] + 26);
    this.panel.style.display = 'block';
    this.select(-1);
    this.refreshSpawnMarker();
    this.hooks.showMsg('LEVEL EDITOR', 'click to select · drag to move · shift-drag = height');
  }

  exit(): void {
    if (!this.active) return;
    this.active = false;
    this.controls?.dispose();
    this.controls = null;
    this.panel.style.display = 'none';
    this.select(-1);
    if (this.spawnMarker) {
      this.scene.remove(this.spawnMarker);
      this.spawnMarker = null;
    }
  }

  update(): void {
    this.controls?.update();
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
    this.data = d;
    this.select(-1);
    this.commit();
  }

  // main calls this after every rebuild so the highlight tracks fresh meshes
  onLevelRebuilt(): void {
    if (this.selected >= this.data.components.length) this.select(-1);
    else this.refreshSelectionBox();
    this.refreshSpawnMarker();
  }

  // ---- data mutation ----

  private commit(rebuild = true): void {
    setCustomLevelData(this.data);
    try {
      localStorage.setItem('protoCustomLevel', JSON.stringify(this.data));
    } catch {
      /* storage full: the working copy still lives in memory */
    }
    if (rebuild) this.hooks.rebuild();
  }

  private addComponent(c: CustomComponent): void {
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
    const hits = this.raycaster.intersectObjects(this.getLevel().pickRoot.children, true);
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

  // ---- pointer handlers ----

  private onDown = (e: PointerEvent): void => {
    if (!this.active || e.button !== 0) return;
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
    if (!this.active || !this.dragging || this.selected < 0) return;
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
    if (e.code === 'Delete' || e.code === 'Backspace') this.deleteSelected();
    if (e.code === 'KeyD' && (e.ctrlKey || e.metaKey)) {
      e.preventDefault();
      this.duplicateSelected();
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

    // add palette
    panel.appendChild(h('<div class="ed-sect">ADD (at camera focus)</div>'));
    const pal = h('<div class="ed-grid"></div>');
    for (const p of PALETTE) {
      const b = h(`<button class="ed-btn">${p.label}</button>`) as HTMLButtonElement;
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
    panel.appendChild(file);

    // play
    const test = h('<button class="ed-btn ed-test">▶ TEST (play it)</button>') as HTMLButtonElement;
    test.addEventListener('click', () => {
      this.hooks.exitToPlay();
      test.blur();
    });
    panel.appendChild(test);
    panel.appendChild(
      h('<div class="ed-dim">orbit: drag · zoom: wheel · pan: right-drag<br>move: drag selected (shift = height)<br>del = delete · ctrl+D = duplicate</div>'),
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
    if (c.t === 'platform' || c.t === 'wall') {
      sizeRow(0, 'width');
      sizeRow(1, 'height');
      sizeRow(2, 'depth');
    } else if (c.t === 'crumble') {
      sizeRow(0, 'width');
      sizeRow(2, 'depth');
      num('shake', () => c.shake ?? 0.7, (v) => (c.shake = Math.max(0, v)), 0.1);
    } else if (c.t === 'ramp') {
      num('length', () => c.len ?? 10, (v) => (c.len = Math.max(1, v)));
      num('rise', () => c.rise ?? 4, (v) => (c.rise = v));
      num('width', () => c.w ?? 8, (v) => (c.w = Math.max(1, v)));
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
    }
    const row = document.createElement('div');
    row.className = 'ed-grid';
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
