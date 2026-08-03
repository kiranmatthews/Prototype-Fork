// The model studio — a place to point at things I cannot see.
//
// WHY THIS EXISTS. Some questions about a 3D character are not answerable from
// a screenshot by anything that reasons in text. "Which of these polygons are
// the old tail and which are her hair." "Is the tail too far from her back."
// "Is that the right orange." I spent a long run of this project guessing at
// shape rules for the first one — behind-the-hips, below-the-knee, past-z-0.17
// — and every guess either missed most of what it was aiming at or reached up
// and took a bite out of her ponytail. The information simply is not in the
// numbers I can measure; it is in what the thing LOOKS like.
//
// So instead of guessing: open this, click the polygons, drag the sliders,
// pick the colour, and press Copy. The output is a small JSON blob that gets
// pasted back and baked into src/modelcuts.ts and the tail defaults. A minute
// of somebody's eyes replaces an afternoon of my inference, and the result
// cannot over-reach, because it deletes exactly what was pointed at.
//
// It is a dev tool: opened by hand, never on a player's path, and it costs
// nothing at runtime until it is opened (main.ts imports it lazily).
//
// ── how the click becomes a polygon ─────────────────────────────────────────
// The body on screen is not the model. The carve chops the GLB into per-joint
// chunks and re-poses them, so a raycast hit is a face on some chunk. Each
// chunk carries userData.srcTris — the bucket it was built from, one entry per
// emitted vertex in order — so face f came from source vertex slot
// srcTris[3f], and because the source is de-indexed that slot belongs to
// triangle t/3 and nothing else. That is the whole mapping, and it is exact.
import * as THREE from 'three';
import type { Player } from './player';
import { DEFAULT_TAIL, type TailShape } from './tail';

interface Ctx {
  renderer: THREE.WebGLRenderer;
  scene: THREE.Scene;
  camera: THREE.PerspectiveCamera;
  player: Player;
  /** the frame loop hands the stage back when this fires */
  onClose: () => void;
}

/** One pickable chunk of the rendered body. */
interface Piece {
  mesh: THREE.Mesh;
  src: number[]; // bucket: source vertex slot per emitted vertex
  /** this chunk is geometry the carve ALREADY deletes, shown as a ghost */
  ghost: boolean;
}

const HL_SELECTED = 0xff2d6f; // marked for deletion
const HL_HOVER = 0x3fe0ff;
const HL_KEPT = 0x4dff9e; // rescued from deletion

/** While this is alive it owns the camera and the frame loop skips the sim, so
 *  nothing fights the orbit control and nothing moves under the cursor. */
export function openStudio(ctx: Ctx): Studio {
  return new Studio(ctx);
}

class Studio {
  private panel: HTMLElement;
  private pieces: Piece[] = [];
  private selected = new Set<number>(); // marked for deletion
  private kept = new Set<number>(); // rescued from what the carve already cuts
  private showGhost = false;
  private hover: number[] = []; // slots under the cursor right now
  private lastWasGhost = false;
  private sig = ''; // which set of chunks the view was framed against
  private steered = false; // has the user taken the camera? then leave it alone
  private ray = new THREE.Raycaster();
  private ndc = new THREE.Vector2();

  // orbit state
  private yaw = Math.PI * 0.75;
  private pitch = 0.22;
  private dist = 3.4;
  private focus = new THREE.Vector3();
  private dragging: 'orbit' | 'pan' | null = null;
  private lastX = 0;
  private lastY = 0;
  private moved = 0;

  private selMesh: THREE.Mesh;
  private hovMesh: THREE.Mesh;
  private keepMesh: THREE.Mesh;
  private shape: TailShape;
  private tailPos = new THREE.Vector3();
  private tint = '#f39133';
  private countEl!: HTMLElement;

  constructor(private ctx: Ctx) {
    this.shape = ctx.player.tailRef?.form ?? { ...DEFAULT_TAIL };
    const root = ctx.player.tailRef?.root;
    if (root) this.tailPos.copy(root.position);

    const overlay = (colour: number, order: number): THREE.Mesh => {
      const m = new THREE.Mesh(
        new THREE.BufferGeometry(),
        new THREE.MeshBasicMaterial({
          color: colour,
          transparent: true,
          opacity: 0.75,
          depthTest: false,
          side: THREE.DoubleSide,
        }),
      );
      m.renderOrder = order;
      m.frustumCulled = false;
      ctx.scene.add(m);
      return m;
    };
    this.selMesh = overlay(HL_SELECTED, 900);
    this.keepMesh = overlay(HL_KEPT, 899);
    this.hovMesh = overlay(HL_HOVER, 901);

    // The game's own HUD is DOM over the canvas and would sit on top of the
    // subject and under the panel. Out of the way while the studio has the
    // stage; put back on close.
    document.body.classList.add('studio-on');
    this.collect();
    this.frameSubject();
    this.panel = this.buildPanel();
    document.body.appendChild(this.panel);
    this.bind();
    this.restore();
  }

  // ── the body, as pickable pieces ─────────────────────────────────────────
  /**
   * Re-read the body's chunks.
   *
   * Called before every pick and every toggle, not once at open, because the
   * character model loads ASYNCHRONOUSLY and installing it REPLACES every
   * chunk on the rig. A list captured at open time can therefore be a set of
   * detached meshes from the procedural stand-in — they still raycast, so the
   * failure is silent: clicks land, highlights draw, and none of it refers to
   * the body actually on screen. Thirteen meshes is nothing to re-walk.
   */
  private collect(): void {
    const before = this.sig;
    this.pieces = [];
    const rider = this.ctx.player.riderRef;
    if (!rider) return;
    rider.traverse((o) => {
      const m = o as THREE.Mesh;
      if (!m.isMesh) return;
      const src = m.userData.srcTris as number[] | undefined;
      if (src) this.pieces.push({ mesh: m, src, ghost: !!m.userData.discarded });
    });
    // The body CHANGED under us — almost always the GLB finishing its load and
    // replacing every chunk. Re-frame, or the view stays pointed at where the
    // stand-in used to be and the subject is off screen entirely.
    this.sig = this.pieces.length + ':' + this.pieces.reduce((n, p) => n + p.src.length, 0);
    // ...but only while nobody has taken the camera. Re-framing under someone
    // who is lining up a click would move the target out from under them.
    if (before !== '' && before !== this.sig && !this.steered) this.frameSubject();
  }

  /** Frame the BODY, not the tail — the tail is the thing being moved, and
   *  letting it drive the framing means the view jumps every time a slider
   *  changes. */
  private frameSubject(): void {
    const rider = this.ctx.player.riderRef;
    if (!rider) return;
    const box = new THREE.Box3();
    for (const piece of this.pieces) box.expandByObject(piece.mesh);
    if (box.isEmpty()) box.setFromObject(rider);
    box.getCenter(this.focus);
    this.dist = Math.max(1, box.getSize(new THREE.Vector3()).length() * 1.15);
  }

  // ── picking ───────────────────────────────────────────────────────────────
  /** Every source slot of the triangle under the cursor, or []. */
  private pick(ev: PointerEvent, island: boolean): number[] {
    this.collect();
    for (const piece of this.pieces) if (piece.ghost) piece.mesh.visible = this.showGhost;
    const el = this.ctx.renderer.domElement;
    const r = el.getBoundingClientRect();
    this.ndc.set(((ev.clientX - r.left) / r.width) * 2 - 1, -((ev.clientY - r.top) / r.height) * 2 + 1);
    this.ray.setFromCamera(this.ndc, this.ctx.camera);
    const hits = this.ray.intersectObjects(
      this.pieces.filter((p) => !p.ghost || this.showGhost).map((p) => p.mesh),
      false,
    );
    if (hits.length === 0) return [];
    // While rescue mode is on, a GHOST wins over anything in front of it.
    // Deleted geometry is usually buried inside the body it was cut from — the
    // nearest hit is the living surface covering it — so nearest-wins would
    // make the ghosts visible but unclickable, which is the whole feature.
    const hit =
      (this.showGhost && hits.find((h) => this.pieces.find((p) => p.mesh === h.object)?.ghost)) || hits[0];
    const piece = this.pieces.find((p) => p.mesh === hit.object);
    if (!piece || hit.faceIndex == null) return [];
    this.lastWasGhost = piece.ghost;
    const face = hit.faceIndex;
    if (!island) return [piece.src[face * 3]];
    return this.island(piece, face);
  }

  /**
   * The connected shell containing this face.
   *
   * The old tail brush is a fan of separate flat blades, and clicking a blade
   * should take the whole blade — picking one triangle at a time through a
   * hundred of them is not a tool anybody would use. Chunk geometry is
   * non-indexed, so adjacency has to be recovered by WELDING: two triangles
   * are neighbours if they share two vertices at the same position. The weld
   * key is quantised, because the carve rebuilt these positions through a
   * matrix and bit-identical duplicates are not guaranteed.
   */
  private island(piece: Piece, face: number): number[] {
    const pos = piece.mesh.geometry.getAttribute('position');
    const tris = pos.count / 3;
    const key = (v: number): string =>
      `${Math.round(pos.getX(v) * 4096)},${Math.round(pos.getY(v) * 4096)},${Math.round(pos.getZ(v) * 4096)}`;
    let adj = piece.mesh.userData.adj as Map<number, number[]> | undefined;
    if (!adj) {
      // vertex-position -> the triangles touching it
      const at = new Map<string, number[]>();
      for (let t = 0; t < tris; t++)
        for (let k = 0; k < 3; k++) {
          const s = key(t * 3 + k);
          const list = at.get(s);
          if (list) list.push(t);
          else at.set(s, [t]);
        }
      adj = new Map();
      for (let t = 0; t < tris; t++) {
        const seen = new Map<number, number>();
        for (let k = 0; k < 3; k++)
          for (const o of at.get(key(t * 3 + k)) ?? []) {
            if (o === t) continue;
            seen.set(o, (seen.get(o) ?? 0) + 1);
          }
        // two shared corners = a shared EDGE. One shared corner is a hinge
        // between two different parts and must not leak the flood across it.
        adj.set(t, [...seen].filter(([, n]) => n >= 2).map(([o]) => o));
      }
      piece.mesh.userData.adj = adj;
    }
    const out: number[] = [];
    const seen = new Set<number>([face]);
    const queue = [face];
    while (queue.length) {
      const t = queue.pop()!;
      out.push(piece.src[t * 3]);
      for (const o of adj.get(t) ?? []) if (!seen.has(o)) { seen.add(o); queue.push(o); }
    }
    return out;
  }

  /** Rebuild a highlight overlay from a set of source slots. */
  private paint(mesh: THREE.Mesh, slots: Set<number> | number[]): void {
    const want = slots instanceof Set ? slots : new Set(slots);
    const pts: number[] = [];
    const v = new THREE.Vector3();
    for (const piece of this.pieces) {
      const pos = piece.mesh.geometry.getAttribute('position');
      piece.mesh.updateWorldMatrix(true, false);
      for (let t = 0; t * 3 < piece.src.length; t++) {
        if (!want.has(piece.src[t * 3])) continue;
        for (let k = 0; k < 3; k++) {
          v.fromBufferAttribute(pos as THREE.BufferAttribute, t * 3 + k).applyMatrix4(piece.mesh.matrixWorld);
          pts.push(v.x, v.y, v.z);
        }
      }
    }
    mesh.geometry.dispose();
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.Float32BufferAttribute(pts, 3));
    mesh.geometry = g;
  }

  private refresh(): void {
    this.collect();
    this.paint(this.selMesh, this.selected);
    this.paint(this.keepMesh, this.kept);
    this.paint(this.hovMesh, this.hover);
    const d = this.selected.size;
    const k = this.kept.size;
    this.countEl.textContent =
      `${d} to delete` + (k ? ` · ${k} rescued` : '') + (d + k === 0 ? ' — nothing marked yet' : '');
    this.save();
  }

  // ── input ────────────────────────────────────────────────────────────────
  private onDown = (ev: PointerEvent): void => {
    if ((ev.target as HTMLElement).closest('.studio')) return;
    this.dragging = ev.button === 2 || ev.shiftKey ? 'pan' : 'orbit';
    this.lastX = ev.clientX;
    this.lastY = ev.clientY;
    this.moved = 0;
    (ev.target as HTMLElement).setPointerCapture?.(ev.pointerId);
  };

  private onMove = (ev: PointerEvent): void => {
    if ((ev.target as HTMLElement).closest('.studio')) return;
    if (this.dragging) {
      const dx = ev.clientX - this.lastX;
      const dy = ev.clientY - this.lastY;
      this.moved += Math.abs(dx) + Math.abs(dy);
      this.lastX = ev.clientX;
      this.lastY = ev.clientY;
      this.steered = true;
      if (this.dragging === 'orbit') {
        this.yaw -= dx * 0.008;
        this.pitch = Math.max(-1.35, Math.min(1.35, this.pitch + dy * 0.006));
      } else {
        const s = this.dist * 0.0016;
        this.focus.x -= (Math.cos(this.yaw) * dx - 0) * s;
        this.focus.z += Math.sin(this.yaw) * dx * s;
        this.focus.y += dy * s;
      }
      return;
    }
    this.hover = this.pick(ev, !ev.altKey);
    this.paint(this.hovMesh, this.hover);
  };

  private onUp = (ev: PointerEvent): void => {
    const wasDragging = this.dragging;
    this.dragging = null;
    if ((ev.target as HTMLElement).closest('.studio')) return;
    if (wasDragging && this.moved > 5) return; // a drag is a camera move, not a click
    const hitGhost = this.lastWasGhost;
    const slots = this.pick(ev, !ev.altKey);
    if (slots.length === 0) return;
    // What a click MEANS depends on what it landed on. On live geometry it
    // marks for deletion; on a ghost — something the carve already removes —
    // it rescues. Ctrl/cmd reverses either. alt restricts to one triangle.
    const undo = ev.ctrlKey || ev.metaKey;
    const set = hitGhost ? this.kept : this.selected;
    for (const s of slots) (undo ? set.delete(s) : set.add(s));
    this.refresh();
  };

  private onWheel = (ev: WheelEvent): void => {
    if ((ev.target as HTMLElement).closest('.studio')) return;
    ev.preventDefault();
    this.steered = true;
    this.dist = Math.max(0.4, Math.min(20, this.dist * (1 + Math.sign(ev.deltaY) * 0.12)));
  };

  private onKey = (ev: KeyboardEvent): void => {
    const t = ev.target as HTMLElement;
    if (t && (t.tagName === 'INPUT' || t.tagName === 'TEXTAREA')) return;
    if (ev.key === 'Escape') this.close();
  };

  private bind(): void {
    const el = this.ctx.renderer.domElement;
    el.addEventListener('pointerdown', this.onDown);
    window.addEventListener('pointermove', this.onMove);
    window.addEventListener('pointerup', this.onUp);
    el.addEventListener('wheel', this.onWheel, { passive: false });
    el.addEventListener('contextmenu', preventDefault);
    window.addEventListener('keydown', this.onKey, true);
  }

  private unbind(): void {
    const el = this.ctx.renderer.domElement;
    el.removeEventListener('pointerdown', this.onDown);
    window.removeEventListener('pointermove', this.onMove);
    window.removeEventListener('pointerup', this.onUp);
    el.removeEventListener('wheel', this.onWheel);
    el.removeEventListener('contextmenu', preventDefault);
    window.removeEventListener('keydown', this.onKey, true);
  }

  /** Called from the frame loop instead of the game's camera rig. */
  frame(): void {
    const cam = this.ctx.camera;
    const cp = Math.cos(this.pitch);
    cam.position.set(
      this.focus.x + Math.sin(this.yaw) * cp * this.dist,
      this.focus.y + Math.sin(this.pitch) * this.dist,
      this.focus.z + Math.cos(this.yaw) * cp * this.dist,
    );
    cam.lookAt(this.focus);
  }

  // ── panel ────────────────────────────────────────────────────────────────
  private slider(
    label: string,
    value: number,
    min: number,
    max: number,
    step: number,
    onInput: (v: number) => void,
  ): HTMLElement {
    const row = el('div', 'studio-row');
    const name = el('label', 'studio-label');
    name.textContent = label;
    const read = el('span', 'studio-val');
    read.textContent = value.toFixed(3);
    const input = document.createElement('input');
    input.type = 'range';
    input.min = String(min);
    input.max = String(max);
    input.step = String(step);
    input.value = String(value);
    input.addEventListener('input', () => {
      const v = parseFloat(input.value);
      read.textContent = v.toFixed(3);
      onInput(v);
      this.save();
    });
    row.append(name, input, read);
    return row;
  }

  private buildPanel(): HTMLElement {
    injectCss();
    const p = el('div', 'studio');
    const h = el('div', 'studio-head');
    h.textContent = 'MODEL STUDIO';
    const close = el('button', 'studio-x');
    close.textContent = '✕';
    close.onclick = () => this.close();
    h.appendChild(close);
    p.appendChild(h);

    p.appendChild(
      note(
        'Drag to orbit · shift-drag or right-drag to pan · wheel to zoom. ' +
          'Click a polygon to mark it for deletion — a click takes the whole ' +
          'connected piece, hold ALT for a single triangle. Ctrl/⌘-click to unmark.',
      ),
    );

    // --- polygons
    p.appendChild(section('POLYGONS TO DELETE'));
    this.countEl = el('div', 'studio-count');
    p.appendChild(this.countEl);
    const btns = el('div', 'studio-btns');
    btns.append(
      button('Clear', () => {
        this.selected.clear();
        this.refresh();
      }),
      button('Hide marks', () => {
        this.selMesh.visible = !this.selMesh.visible;
        this.keepMesh.visible = this.selMesh.visible;
      }),
    );
    p.appendChild(btns);
    const gbtn = button('Show already-deleted', () => {
      this.showGhost = !this.showGhost;
      this.collect();
      for (const piece of this.pieces) if (piece.ghost) piece.mesh.visible = this.showGhost;
      gbtn.textContent = this.showGhost ? 'Hide already-deleted' : 'Show already-deleted';
    });
    p.appendChild(gbtn);
    p.appendChild(
      button('Re-frame view', () => {
        this.steered = false;
        this.frameSubject();
      }),
    );
    p.appendChild(
      note(
        'Some geometry is already cut before you see it. Turn that on to check ' +
          'nothing was taken by mistake — click a ghost polygon to put it BACK ' +
          '(it turns green).',
      ),
    );

    // --- tail placement
    const tail = this.ctx.player.tailRef;
    p.appendChild(section('TAIL PLACEMENT'));
    const move = (axis: 'x' | 'y' | 'z') => (v: number) => {
      this.tailPos[axis] = v;
      if (tail) tail.root.position.copy(this.tailPos);
    };
    p.appendChild(this.slider('across (x)', this.tailPos.x, -0.3, 0.3, 0.005, move('x')));
    p.appendChild(this.slider('height (y)', this.tailPos.y, 0.3, 1.1, 0.005, move('y')));
    p.appendChild(this.slider('depth (z)', this.tailPos.z, -0.4, 0.25, 0.005, move('z')));

    p.appendChild(section('TAIL SHAPE'));
    const reshape = (k: keyof TailShape) => (v: number) => {
      (this.shape[k] as number) = v;
      tail?.reshape({ [k]: v } as Partial<TailShape>);
    };
    p.appendChild(this.slider('length', this.shape.length, 0.2, 1.2, 0.01, reshape('length')));
    p.appendChild(this.slider('thickness', this.shape.baseRadius, 0.02, 0.16, 0.002, reshape('baseRadius')));
    p.appendChild(this.slider('neck pinch', this.shape.neck, 0.15, 1, 0.01, reshape('neck')));
    p.appendChild(this.slider('neck spread', this.shape.neckSpan, 0.05, 0.6, 0.01, reshape('neckSpan')));
    p.appendChild(this.slider('droop at base', this.shape.angleBase, -1.4, 0.4, 0.02, reshape('angleBase')));
    p.appendChild(this.slider('lift at tip', this.shape.angleTip, -0.8, 0.9, 0.02, reshape('angleTip')));
    p.appendChild(this.slider('bury depth', this.shape.bury, 0, 0.2, 0.005, reshape('bury')));

    // --- colour
    p.appendChild(section('TAIL COLOUR'));
    const swatchRow = el('div', 'studio-row');
    const swLabel = el('label', 'studio-label');
    swLabel.textContent = 'fur';
    const sw = document.createElement('input');
    sw.type = 'color';
    sw.value = this.tint;
    sw.className = 'studio-swatch';
    sw.addEventListener('input', () => {
      this.tint = sw.value;
      tail?.setTint(sw.value);
      this.save();
    });
    swatchRow.append(swLabel, sw);
    p.appendChild(swatchRow);

    // --- output
    p.appendChild(section('WHEN YOU ARE DONE'));
    const out = el('div', 'studio-btns');
    const status = el('div', 'studio-count');
    out.append(
      button('Copy answer', async () => {
        const text = this.exportText();
        try {
          await navigator.clipboard.writeText(text);
          status.textContent = 'Copied — paste it into the chat.';
        } catch {
          // clipboard is blocked in some contexts; fall back to a selectable box
          const ta = document.createElement('textarea');
          ta.className = 'studio-out';
          ta.value = text;
          p.appendChild(ta);
          ta.select();
          status.textContent = 'Select the text above and copy it.';
        }
      }),
      button('Download', () => {
        const blob = new Blob([this.exportText()], { type: 'application/json' });
        const a = document.createElement('a');
        a.href = URL.createObjectURL(blob);
        a.download = 'studio-answer.json';
        a.click();
        URL.revokeObjectURL(a.href);
        status.textContent = 'Saved — attach it in the chat.';
      }),
    );
    p.append(out, status);
    return p;
  }

  private exportText(): string {
    // The highest source slot any chunk refers to. The `+ 1` goes OUTSIDE the
    // loop: inside, it incremented once per mesh and reported a count higher
    // than the model actually has (6395 against a real 6390), which would have
    // made the guard in modelcuts.ts reject a perfectly good cut list.
    const rider = this.ctx.player.riderRef;
    let top = -1;
    rider?.traverse((o) => {
      const m = o as THREE.Mesh;
      const src = m.userData.srcTris as number[] | undefined;
      if (m.isMesh && src) for (const t of src) if (t > top) top = t;
    });
    const verts = top + 1;
    return JSON.stringify(
      {
        studio: 1,
        model: this.ctx.player.modelSrc,
        // The highest slot any chunk refers to, plus one. For a model whose
        // every triangle survives into some chunk this equals the de-indexed
        // vertex count; where the carve already drops geometry it is a lower
        // bound, so check it against the file before using it as the guard.
        highestSlot: verts,
        deletePolygons: [...this.selected].sort((a, b) => a - b),
        keepPolygons: [...this.kept].sort((a, b) => a - b),
        tail: {
          root: [round(this.tailPos.x), round(this.tailPos.y), round(this.tailPos.z)],
          colour: this.tint,
          shape: Object.fromEntries(
            Object.entries(this.shape).map(([k, v]) => [k, typeof v === 'number' ? round(v) : v]),
          ),
        },
      },
      null,
      2,
    );
  }

  // Survives a reload, because picking a hundred polygons and losing them to a
  // stray refresh would make this worse than useless.
  private save(): void {
    try {
      localStorage.setItem(
        'studio.v1',
        JSON.stringify({
          sel: [...this.selected],
          keep: [...this.kept],
          pos: this.tailPos.toArray(),
          shape: this.shape,
          tint: this.tint,
        }),
      );
    } catch {
      /* private mode: the session just is not resumable */
    }
  }

  private restore(): void {
    try {
      const raw = localStorage.getItem('studio.v1');
      if (raw) {
        const d = JSON.parse(raw) as { sel?: number[]; keep?: number[] };
        for (const s of d.sel ?? []) this.selected.add(s);
        for (const s of d.keep ?? []) this.kept.add(s);
      }
    } catch {
      /* ignore */
    }
    this.refresh();
  }

  close(): void {
    document.body.classList.remove('studio-on');
    this.unbind();
    this.panel.remove();
    for (const piece of this.pieces) if (piece.ghost) piece.mesh.visible = false;
    for (const m of [this.selMesh, this.hovMesh, this.keepMesh]) {
      m.geometry.dispose();
      (m.material as THREE.Material).dispose();
      m.removeFromParent();
    }
    this.ctx.onClose();
  }
}

// ── small DOM helpers, in this file so the studio can be deleted in one go ──
function preventDefault(e: Event): void {
  e.preventDefault();
}
function el(tag: string, cls: string): HTMLElement {
  const n = document.createElement(tag);
  n.className = cls;
  return n;
}
function section(text: string): HTMLElement {
  const s = el('div', 'studio-sec');
  s.textContent = text;
  return s;
}
function note(text: string): HTMLElement {
  const s = el('div', 'studio-note');
  s.textContent = text;
  return s;
}
function button(text: string, onClick: () => void): HTMLElement {
  const b = el('button', 'studio-btn');
  b.textContent = text;
  b.onclick = onClick;
  return b;
}
function round(v: number): number {
  return Math.round(v * 1000) / 1000;
}

let cssIn = false;
function injectCss(): void {
  if (cssIn) return;
  cssIn = true;
  const s = document.createElement('style');
  s.textContent = `
    .studio {
      position: fixed; top: 0; right: 0; bottom: 0; width: 310px; z-index: 40;
      overflow-y: auto; padding: 0 14px 22px; box-sizing: border-box;
      background: linear-gradient(180deg, rgba(18,21,30,0.97), rgba(11,13,19,0.97));
      border-left: 1px solid #333a4a; color: #cfe3d8;
      font: 12px/1.5 ui-monospace, Menlo, Consolas, monospace;
    }
    .studio-head {
      position: sticky; top: 0; padding: 12px 0 10px; margin-bottom: 4px;
      background: inherit; letter-spacing: 3px; color: #ffd24a; font-weight: bold;
      border-bottom: 1px solid #333a4a;
    }
    .studio-x {
      position: absolute; right: 0; top: 8px; background: none; border: none;
      color: #8fa0b8; font-size: 15px; cursor: pointer;
    }
    .studio-sec {
      margin: 16px 0 7px; letter-spacing: 2px; font-size: 10px; color: #7f8fa8;
      border-bottom: 1px solid #262d3a; padding-bottom: 4px;
    }
    .studio-note { color: #8fa0b8; font-size: 11px; margin: 8px 0 2px; }
    .studio-count { color: #b6f0cc; margin: 6px 0; min-height: 18px; }
    .studio-row { display: flex; align-items: center; gap: 8px; margin: 4px 0; }
    .studio-label { flex: 0 0 88px; color: #9fb0c8; }
    .studio-row input[type=range] { flex: 1; min-width: 0; accent-color: #ffd24a; }
    .studio-val { flex: 0 0 46px; text-align: right; color: #cfe3d8; }
    .studio-swatch {
      flex: 1; height: 26px; padding: 0; border: 1px solid #3a4152;
      background: none; cursor: pointer;
    }
    .studio-btns { display: flex; gap: 8px; flex-wrap: wrap; margin: 6px 0; }
    .studio-btn {
      flex: 1; padding: 7px 9px; cursor: pointer; border-radius: 5px;
      background: #222836; color: #cfe3d8; border: 1px solid #3a4152;
      font: inherit;
    }
    .studio-btn:hover { background: #2c3446; }
    .studio-out { width: 100%; height: 130px; margin-top: 8px; font: 10px ui-monospace, monospace; }
    /* the game's HUD would sit on top of the subject; the studio owns the screen */
    body.studio-on .hud-tl, body.studio-on .hud-tr, body.studio-on .hud-trickplate,
    body.studio-on .hud-msg, body.studio-on .hud-boosts, body.studio-on .hud-balance,
    body.studio-on .hud-vbalance, body.studio-on .side-wrap, body.studio-on .hud-ttclock {
      display: none !important;
    }
  `;
  document.head.appendChild(s);
}
