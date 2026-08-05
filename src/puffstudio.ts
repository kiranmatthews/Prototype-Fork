// The smoke studio — a place to dial the puffs by eye.
//
// WHY THIS EXISTS. Same reason as the model studio next door: the questions
// that matter here are not answerable by anything reasoning in text. "Is that
// too big." "Does that read as smoke or as a shard." "Is that the right
// purple." I have now guessed at those three times and been wrong three times.
// The numbers I can measure — vertex counts, falloff profiles, draw calls —
// are all fine while the thing still looks absurd.
//
// So: open it, drag the sliders, pick the colours, watch it, press Copy. What
// comes out is a preset object that pastes straight into PUFF_PRESETS in
// src/puffs.ts. Every control the particle system reads is on this panel, so
// nothing has to come back to me as a description.
//
// It is a dev tool — opened by hand with #puffstudio on the URL, never on a
// player's path, and main.ts imports it lazily so it costs nothing until asked
// for.
import * as THREE from 'three';
import { puffs, PUFF_PRESETS, type PuffPreset, type SurfaceKind } from './puffs';

interface Ctx {
  camera: THREE.PerspectiveCamera;
  scene: THREE.Scene;
  onClose: () => void;
}

const STORE = 'puffStudioV1';

/** Every editable field, in the order the panel lays them out. */
type Kind = 'num' | 'range' | 'int2' | 'colour' | 'bool' | 'blend' | 'orient';
interface Field {
  key: keyof PuffPreset;
  label: string;
  kind: Kind;
  lo?: number;
  hi?: number;
  step?: number;
  hint?: string;
}
interface Group {
  name: string;
  fields: Field[];
}

const N = (key: keyof PuffPreset, label: string, lo: number, hi: number, step: number, hint?: string): Field =>
  ({ key, label, kind: 'num', lo, hi, step, hint });
const R = (key: keyof PuffPreset, label: string, lo: number, hi: number, step: number, hint?: string): Field =>
  ({ key, label, kind: 'range', lo, hi, step, hint });

// Slider ranges are WIDE and the track is curved (see toV/toT below): most of
// the travel lives near zero, so tiny values are easy to hit by drag — and the
// number box takes exact typed values, even past the slider's ends.
const GROUPS: Group[] = [
  {
    name: 'LOOK',
    fields: [
      { key: 'blend', label: 'blend', kind: 'blend', hint: 'how it reaches the screen' },
      { key: 'orient', label: 'facing', kind: 'orient' },
      { key: 'centre', label: 'core colour', kind: 'colour', hint: 'the hot, dense middle' },
      { key: 'inner', label: 'body colour', kind: 'colour', hint: 'the broad plateau' },
      { key: 'outer', label: 'rim colour', kind: 'colour', hint: 'the tail — usually near black' },
      { key: 'fadeTo', label: 'fades toward', kind: 'colour', hint: 'colour it drifts to as it dies' },
      R('alpha', 'opacity', 0, 1, 0.01, 'per puff — density comes from OVERLAP, so keep it low'),
      N('outerAlpha', 'rim opacity', 0, 1, 0.01, '0 = the rim vanishes completely'),
      N('haloAlpha', 'body opacity', 0, 1, 0.01, 'the plateau, as a fraction of the core'),
      R('bright', 'brightness', 0, 4, 0.05),
      N('fadeIn', 'fade in', 0, 1, 0.01, 'fraction of life spent appearing'),
    ],
  },
  {
    name: 'SHAPE',
    fields: [
      { key: 'ring', label: 'ring points', kind: 'int2', lo: 5, hi: 8, step: 1, hint: 'outer vertices' },
      N('multiCentre', 'lobes', 0, 1, 0.05, 'chance of 2-3 centres — lopsided, faceted puffs'),
      N('halo', 'plateau at', 0, 0.9, 0.02, '0 = one ring (cheap). >0 adds the mid ring here'),
      R('size', 'size', 0, 5, 0.01),
      R('aspect', 'wide/tall', 0.2, 3, 0.05, '>1 wide. Capped at 1.9:1 when drawn'),
      R('grow', 'growth', 0, 12, 0.05, 'radius multiplier by end of life'),
      R('growY', 'growth (up)', 0, 12, 0.05),
      N('growCurve', 'growth curve', 0.05, 3, 0.05, '<1 opens fast then creeps'),
      N('stretch', 'speed stretch', 0, 1, 0.005),
    ],
  },
  {
    name: 'DEFORM',
    fields: [
      R('wobble', 'wobble', 0, 1, 0.01, 'radial, as a fraction of radius'),
      R('swirl', 'swirl', 0, 1, 0.01, 'tangential — auto-capped so points cannot cross'),
      R('wobbleRate', 'wobble rate', 0, 8, 0.05),
      N('neighbour', 'smoothing', 0, 1, 0.02, 'how much a point borrows its neighbours'),
      N('centreDrift', 'centre drift', 0, 1.5, 0.02),
      R('spin', 'spin', -6, 6, 0.05),
    ],
  },
  {
    name: 'MOTION',
    fields: [
      R('speed', 'launch speed', 0, 16, 0.1),
      N('spread', 'cone', 0, 3.14, 0.05),
      R('up', 'extra lift', 0, 8, 0.05),
      N('inherit', 'inherit motion', 0, 1, 0.02),
      R('gravity', 'gravity', -6, 14, 0.05, 'negative rises'),
      R('buoyancy', 'buoyancy', 0, 8, 0.05, 'lift that fades as it cools'),
      R('drag', 'drag', 0, 12, 0.05),
      N('wind', 'wind', 0, 2, 0.02),
      R('turbulence', 'turbulence', 0, 3, 0.02),
      R('turbRate', 'turbulence rate', 0, 6, 0.05),
    ],
  },
  {
    name: 'GROUND',
    fields: [
      { key: 'ground', label: 'ground aware', kind: 'bool' },
      N('flatten', 'flatten', 0, 1, 0.02),
      N('spreadOnGround', 'spread', 0, 4, 0.05),
      N('friction', 'friction', 0, 12, 0.1),
      N('bounce', 'bounce', 0, 1, 0.02),
      N('surfaceTint', 'surface tint', 0, 1, 0.02, 'how much the floor colours it'),
    ],
  },
  {
    name: 'LIFE + RATE',
    fields: [
      R('life', 'lifetime', 0.02, 12, 0.05),
      R('count', 'burst count', 1, 40, 1),
      R('rate', 'per second', 0, 80, 0.5, 'continuous emitters'),
      N('jitter', 'timing jitter', 0, 1, 0.05),
      R('spacing', 'trail spacing', 0.02, 6, 0.05, 'metres between trail puffs'),
    ],
  },
];

const BLENDS = ['alpha', 'add', 'softAdd', 'darken'];
const ORIENTS = ['billboard', 'billboardY', 'velocity', 'surface', 'fixed'];
const SURFACES: SurfaceKind[] = [
  'generic', 'concrete', 'sand', 'dirt', 'wood', 'grass', 'stone', 'metal', 'snow',
];

export function openPuffStudio(ctx: Ctx): PuffStudio {
  return new PuffStudio(ctx);
}

class PuffStudio {
  private panel: HTMLElement;
  private preset: PuffPreset;
  private name = 'myPuff';
  private acc = 0;
  private mode: 'play' | 'pulse' | 'pause' = 'play';
  private pulseT = 0; // seconds the stage has been fully empty, in pulse mode
  private surface: SurfaceKind = 'generic';
  private backdrop: THREE.Mesh | null = null;
  private dark = true;
  private anchor = new THREE.Vector3();
  private out!: HTMLTextAreaElement;
  private stat!: HTMLElement;
  private seed = 1;

  constructor(private ctx: Ctx) {
    const saved = localStorage.getItem(STORE);
    if (saved) {
      try {
        const j = JSON.parse(saved);
        this.name = j.name ?? this.name;
        this.preset = j.preset;
      } catch {
        this.preset = clone(PUFF_PRESETS.dustWheel);
      }
    } else this.preset = clone(PUFF_PRESETS.dustWheel);
    this.panel = this.build();
    document.body.appendChild(this.panel);
    this.makeBackdrop();
    this.dump();
  }

  /** Called from the frame loop while the studio is open. */
  frame(dt: number): void {
    // Park the preview a fixed distance down the lens, so the shot frames
    // itself wherever the camera happens to be and dragging a slider never
    // sends the thing off screen.
    const cam = this.ctx.camera;
    cam.getWorldDirection(FWD);
    this.anchor.copy(cam.position).addScaledVector(FWD, 7);
    if (this.backdrop) {
      this.backdrop.position.copy(cam.position).addScaledVector(FWD, 16);
      this.backdrop.quaternion.copy(cam.quaternion);
    }
    if (this.mode === 'play') {
      const rate = midOf(this.preset.rate, 8);
      this.acc += dt * rate;
      let guard = 12;
      while (this.acc >= 1 && guard-- > 0) {
        this.acc -= 1;
        puffs.spawn(this.preset, this.anchor.x, this.anchor.y, this.anchor.z, {
          seed: this.seed++,
          surface: this.surface,
          groundY: this.anchor.y - 0.05,
        });
      }
    } else if (this.mode === 'pulse') {
      // One whole event at a time, like watching a TNT go off on repeat: fire
      // a full burst (children and all), let the cloud play ALL the way out,
      // hold an empty stage for a second, fire the next.
      if (puffs.liveCount > 0) this.pulseT = 0;
      else {
        this.pulseT += dt;
        if (this.pulseT >= 1) {
          this.pulseT = 0;
          this.fireBurst();
        }
      }
    }
    this.stat.textContent = `${puffs.liveCount} live · ${puffs.drawCalls} draw call(s)`;
  }

  // A full burst through the SAME path the game uses — puffs.burst on a
  // temporary registration of the working preset — so count scaling and
  // child presets (a boomTnt's smoke) behave exactly as they will in play.
  private fireBurst(): void {
    PUFF_PRESETS.__studio = this.preset;
    puffs.burst('__studio', this.anchor.x, this.anchor.y, this.anchor.z, {
      seed: this.seed++,
      surface: this.surface,
      groundY: this.anchor.y - 0.05,
    });
  }

  // -- preview backdrop -----------------------------------------------------
  // Smoke is judged against what is behind it, and the reference is smoke
  // against near-black. A plain unlit card, big enough to fill the frame,
  // parked behind the preview and following the camera.
  private makeBackdrop(): void {
    const m = new THREE.Mesh(
      new THREE.PlaneGeometry(60, 40),
      new THREE.MeshBasicMaterial({ color: 0x0a0c14, fog: false, depthWrite: true }),
    );
    m.renderOrder = -2;
    m.frustumCulled = false;
    m.userData.shared = true;
    this.ctx.scene.add(m);
    this.backdrop = m;
  }

  private setBackdrop(): void {
    if (!this.backdrop) return;
    this.backdrop.visible = true;
    (this.backdrop.material as THREE.MeshBasicMaterial).color.setHex(
      this.dark ? 0x0a0c14 : 0x9fb6c8,
    );
  }

  // -- panel ----------------------------------------------------------------
  private build(): HTMLElement {
    injectCss();
    const p = el('div', 'pst');
    const h = el('div', 'pst-head');
    h.textContent = 'SMOKE STUDIO';
    const x = el('button', 'pst-x');
    x.textContent = '✕';
    x.onclick = () => this.close();
    h.appendChild(x);
    p.appendChild(h);

    p.appendChild(
      note(
        'Everything the particle system reads is on this panel. Drag until it ' +
          'looks right, then Copy — the output pastes straight into ' +
          'PUFF_PRESETS in src/puffs.ts.',
      ),
    );

    // --- start from / name ---
    p.appendChild(sec('PRESET'));
    const nameRow = el('div', 'pst-row');
    const nameLbl = el('label', 'pst-label');
    nameLbl.textContent = 'name';
    const nameIn = document.createElement('input');
    nameIn.type = 'text';
    nameIn.className = 'pst-text';
    nameIn.value = this.name;
    nameIn.addEventListener('input', () => {
      this.name = nameIn.value.replace(/[^\w]/g, '') || 'myPuff';
      this.dump();
    });
    nameRow.append(nameLbl, nameIn);
    p.appendChild(nameRow);

    const loadRow = el('div', 'pst-row');
    const loadLbl = el('label', 'pst-label');
    loadLbl.textContent = 'start from';
    const sel = document.createElement('select');
    sel.className = 'pst-sel';
    for (const k of Object.keys(PUFF_PRESETS)) {
      if (k.startsWith('__')) continue; // the studio's own scratch registration
      const o = document.createElement('option');
      o.value = k;
      o.textContent = k;
      sel.appendChild(o);
    }
    sel.value = 'dustWheel';
    sel.addEventListener('change', () => {
      this.preset = clone(PUFF_PRESETS[sel.value]);
      this.name = sel.value;
      nameIn.value = sel.value;
      this.rebuild();
    });
    loadRow.append(loadLbl, sel);
    p.appendChild(loadRow);

    // --- stage ---
    p.appendChild(sec('STAGE'));
    const stageBtns = el('div', 'pst-btns');
    stageBtns.append(
      btn('Dark / light', () => {
        this.dark = !this.dark;
        this.setBackdrop();
      }),
      btn('Hide backdrop', (b) => {
        if (!this.backdrop) return;
        this.backdrop.visible = !this.backdrop.visible;
        b.textContent = this.backdrop.visible ? 'Hide backdrop' : 'Show backdrop';
      }),
      btn('Clear', () => puffs.clear()),
    );
    p.appendChild(stageBtns);

    // Mode row: Play streams at the preset's own rate; Pulse fires one whole
    // burst, waits for the cloud to fully die plus a second, and fires again;
    // Pause freezes spawning. One burst is a single manual Pulse shot.
    const modeBtns = el('div', 'pst-btns');
    const modeB: Record<string, HTMLElement> = {};
    const setMode = (m: 'play' | 'pulse' | 'pause'): void => {
      this.mode = m;
      this.pulseT = 0;
      for (const [k, b] of Object.entries(modeB)) b.classList.toggle('pst-on', k === m);
      if (m === 'pulse') {
        puffs.clear();
        this.fireBurst();
      }
    };
    modeB.play = btn('Play', () => setMode('play'));
    modeB.pulse = btn('Pulse', () => setMode('pulse'));
    modeB.pause = btn('Pause', () => setMode('pause'));
    modeB.play.classList.add('pst-on');
    modeBtns.append(
      modeB.play,
      modeB.pulse,
      modeB.pause,
      btn('One burst', () => {
        puffs.clear();
        this.fireBurst();
      }),
    );
    p.appendChild(modeBtns);

    const surfRow = el('div', 'pst-row');
    const surfLbl = el('label', 'pst-label');
    surfLbl.textContent = 'surface';
    const surfSel = document.createElement('select');
    surfSel.className = 'pst-sel';
    for (const k of SURFACES) {
      const o = document.createElement('option');
      o.value = k;
      o.textContent = k;
      surfSel.appendChild(o);
    }
    surfSel.addEventListener('change', () => {
      this.surface = surfSel.value as SurfaceKind;
    });
    surfRow.append(surfLbl, surfSel);
    p.appendChild(surfRow);

    this.stat = el('div', 'pst-stat');
    p.appendChild(this.stat);

    // --- every control ---
    const body = el('div', 'pst-body');
    p.appendChild(body);
    this.fill(body);

    // --- output ---
    p.appendChild(sec('OUTPUT'));
    this.out = document.createElement('textarea');
    this.out.className = 'pst-out';
    this.out.readOnly = true;
    p.appendChild(this.out);
    const outBtns = el('div', 'pst-btns');
    outBtns.append(
      btn('Copy', async (b) => {
        try {
          await navigator.clipboard.writeText(this.out.value);
          b.textContent = 'Copied';
          setTimeout(() => (b.textContent = 'Copy'), 1200);
        } catch {
          this.out.select();
          b.textContent = 'Select + copy';
        }
      }),
      btn('Download', () => {
        const blob = new Blob([this.out.value], { type: 'application/json' });
        const a = document.createElement('a');
        a.href = URL.createObjectURL(blob);
        a.download = `${this.name}.json`;
        a.click();
        URL.revokeObjectURL(a.href);
      }),
      btn('Reset', () => {
        this.preset = clone(PUFF_PRESETS[sel.value] ?? PUFF_PRESETS.dustWheel);
        this.rebuild();
      }),
    );
    p.appendChild(outBtns);
    return p;
  }

  private fill(host: HTMLElement): void {
    host.textContent = '';
    for (const g of GROUPS) {
      host.appendChild(sec(g.name));
      for (const f of g.fields) host.appendChild(this.control(f));
    }
  }

  private rebuild(): void {
    const body = this.panel.querySelector('.pst-body') as HTMLElement;
    if (body) this.fill(body);
    this.dump();
  }

  private control(f: Field): HTMLElement {
    const wrap = el('div', 'pst-ctl');
    const cur = this.preset[f.key] as unknown;

    if (f.kind === 'colour') {
      const row = el('div', 'pst-row');
      const l = el('label', 'pst-label');
      l.textContent = f.label;
      const inp = document.createElement('input');
      inp.type = 'color';
      inp.className = 'pst-col';
      inp.value = '#' + (((cur as number) ?? 0) >>> 0).toString(16).padStart(6, '0');
      const off = document.createElement('input');
      off.type = 'checkbox';
      off.className = 'pst-chk';
      off.checked = cur !== undefined;
      off.title = 'use this colour';
      const apply = (): void => {
        if (off.checked) (this.preset[f.key] as unknown) = parseInt(inp.value.slice(1), 16);
        else delete this.preset[f.key];
        this.dump();
      };
      inp.addEventListener('input', apply);
      off.addEventListener('change', apply);
      row.append(l, inp, off);
      wrap.appendChild(row);
    } else if (f.kind === 'bool') {
      const row = el('div', 'pst-row');
      const l = el('label', 'pst-label');
      l.textContent = f.label;
      const inp = document.createElement('input');
      inp.type = 'checkbox';
      inp.className = 'pst-chk';
      inp.checked = !!cur;
      inp.addEventListener('change', () => {
        (this.preset[f.key] as unknown) = inp.checked;
        this.dump();
      });
      row.append(l, inp);
      wrap.appendChild(row);
    } else if (f.kind === 'blend' || f.kind === 'orient') {
      const row = el('div', 'pst-row');
      const l = el('label', 'pst-label');
      l.textContent = f.label;
      const s = document.createElement('select');
      s.className = 'pst-sel';
      for (const v of f.kind === 'blend' ? BLENDS : ORIENTS) {
        const o = document.createElement('option');
        o.value = v;
        o.textContent = v;
        s.appendChild(o);
      }
      s.value = String(cur ?? (f.kind === 'blend' ? 'alpha' : 'billboard'));
      s.addEventListener('change', () => {
        (this.preset[f.key] as unknown) = s.value;
        this.dump();
      });
      row.append(l, s);
      wrap.appendChild(row);
    } else if (f.kind === 'num') {
      wrap.appendChild(
        this.slider(f.label, num(cur, 0), f.lo!, f.hi!, f.step!, (v) => {
          (this.preset[f.key] as unknown) = v;
        }),
      );
    } else {
      // range / int2 — a min and a max, because that is what the system reads
      const arr = Array.isArray(cur) ? (cur as number[]) : [num(cur, f.lo!), num(cur, f.lo!)];
      const set = (): void => {
        (this.preset[f.key] as unknown) = [
          Math.min(arr[0], arr[1]),
          Math.max(arr[0], arr[1]),
        ];
      };
      wrap.appendChild(
        this.slider(f.label + ' ↓', arr[0], f.lo!, f.hi!, f.step!, (v) => {
          arr[0] = v;
          set();
        }),
      );
      wrap.appendChild(
        this.slider(f.label + ' ↑', arr[1], f.lo!, f.hi!, f.step!, (v) => {
          arr[1] = v;
          set();
        }),
      );
    }
    if (f.hint) {
      const n = el('div', 'pst-hint');
      n.textContent = f.hint;
      wrap.appendChild(n);
    }
    return wrap;
  }

  private slider(
    label: string,
    value: number,
    lo: number,
    hi: number,
    step: number,
    onInput: (v: number) => void,
  ): HTMLElement {
    const row = el('div', 'pst-row');
    const l = el('label', 'pst-label');
    l.textContent = label;
    // The track is 1000 abstract ticks pushed through a cubic curve (linear
    // for whole-number fields), so most of the drag travel sits near zero —
    // 0.02 and 0.05 are different slider positions, not the same pixel. The
    // number box is the exact value: type anything, including past the ends.
    const curve = step >= 1 ? 1 : 3;
    const inp = document.createElement('input');
    inp.type = 'range';
    inp.min = '0';
    inp.max = '1000';
    inp.step = '1';
    inp.value = String(toT(value, lo, hi, curve) * 1000);
    const box = document.createElement('input');
    box.type = 'number';
    box.className = 'pst-num';
    box.step = 'any';
    box.value = String(value);
    inp.addEventListener('input', () => {
      let v = snap(toV(parseInt(inp.value, 10) / 1000, lo, hi, curve));
      if (step >= 1) v = Math.round(v);
      box.value = String(v);
      onInput(v);
      this.dump();
    });
    box.addEventListener('input', () => {
      const v = parseFloat(box.value);
      if (!Number.isFinite(v)) return;
      inp.value = String(toT(v, lo, hi, curve) * 1000);
      onInput(v);
      this.dump();
    });
    row.append(l, inp, box);
    return row;
  }

  /** Serialise what the sliders currently say, and save it. */
  private dump(): void {
    const clean: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(this.preset)) {
      if (v === undefined) continue;
      clean[k] = v;
    }
    const body = JSON.stringify(clean, null, 2)
      .split('\n')
      .map((l, i) => (i === 0 ? l : '  ' + l))
      .join('\n');
    this.out.value = `  ${this.name}: ${body},`;
    localStorage.setItem(STORE, JSON.stringify({ name: this.name, preset: this.preset }));
  }

  private close(): void {
    delete PUFF_PRESETS.__studio;
    this.panel.remove();
    if (this.backdrop) {
      this.ctx.scene.remove(this.backdrop);
      this.backdrop.geometry.dispose();
      (this.backdrop.material as THREE.Material).dispose();
      this.backdrop = null;
    }
    puffs.clear();
    this.ctx.onClose();
  }
}

// ---------------------------------------------------------------- helpers ---

const FWD = new THREE.Vector3();

function clone(p: PuffPreset): PuffPreset {
  return JSON.parse(JSON.stringify(p)) as PuffPreset;
}
function num(v: unknown, dflt: number): number {
  if (typeof v === 'number') return v;
  if (Array.isArray(v) && typeof v[0] === 'number') return v[0];
  return dflt;
}
function midOf(v: unknown, dflt: number): number {
  if (typeof v === 'number') return v;
  if (Array.isArray(v) && v.length === 2) return ((v[0] as number) + (v[1] as number)) / 2;
  return dflt;
}
/**
 * Curved slider mapping. t in [0,1] -> value in [lo,hi], with |x|^curve
 * spent near zero — and when the range straddles zero the curve is applied
 * on EACH side of it, so fine control sits around 0 rather than around lo.
 */
function toV(t: number, lo: number, hi: number, curve: number): number {
  t = Math.min(1, Math.max(0, t));
  if (lo < 0 && hi > 0) {
    const t0 = -lo / (hi - lo); // the tick where the value crosses zero
    return t >= t0
      ? hi * Math.pow((t - t0) / (1 - t0), curve)
      : lo * Math.pow((t0 - t) / t0, curve);
  }
  return lo + (hi - lo) * Math.pow(t, curve);
}
function toT(v: number, lo: number, hi: number, curve: number): number {
  if (lo < 0 && hi > 0) {
    const t0 = -lo / (hi - lo);
    const t =
      v >= 0
        ? t0 + (1 - t0) * Math.pow(Math.min(1, v / hi), 1 / curve)
        : t0 - t0 * Math.pow(Math.min(1, v / lo), 1 / curve);
    return Math.min(1, Math.max(0, t));
  }
  return Math.min(1, Math.max(0, Math.pow((v - lo) / (hi - lo), 1 / curve)));
}
/** Round a curved-track value to a sane precision for its magnitude. */
function snap(v: number): number {
  const a = Math.abs(v);
  return +v.toFixed(a >= 100 ? 0 : a >= 10 ? 1 : a >= 1 ? 2 : 3);
}
function el(tag: string, cls: string): HTMLElement {
  const e = document.createElement(tag);
  e.className = cls;
  return e;
}
function sec(text: string): HTMLElement {
  const s = el('div', 'pst-sec');
  s.textContent = text;
  return s;
}
function note(text: string): HTMLElement {
  const s = el('div', 'pst-note');
  s.textContent = text;
  return s;
}
function btn(text: string, onClick: (b: HTMLElement) => void): HTMLElement {
  const b = el('button', 'pst-btn');
  b.textContent = text;
  b.onclick = () => onClick(b);
  return b;
}

let cssIn = false;
function injectCss(): void {
  if (cssIn) return;
  cssIn = true;
  const s = document.createElement('style');
  s.textContent = `
    .pst {
      position: fixed; top: 0; right: 0; bottom: 0; width: 320px; z-index: 41;
      overflow-y: auto; padding: 0 14px 22px; box-sizing: border-box;
      background: linear-gradient(180deg, rgba(18,21,30,0.97), rgba(11,13,19,0.97));
      border-left: 1px solid #333a4a; color: #cfe3d8;
      font: 12px/1.5 ui-monospace, Menlo, Consolas, monospace;
    }
    .pst-head {
      position: sticky; top: 0; padding: 12px 0 10px; margin-bottom: 4px;
      background: inherit; letter-spacing: 3px; color: #ff7ae0; font-weight: bold;
      border-bottom: 1px solid #333a4a; z-index: 2;
    }
    .pst-x { position: absolute; right: 0; top: 8px; background: none; border: none;
      color: #8fa0b8; font-size: 15px; cursor: pointer; }
    .pst-sec { margin: 14px 0 6px; letter-spacing: 2px; font-size: 10px; color: #7f8fa8;
      border-bottom: 1px solid #262d3a; padding-bottom: 4px; }
    .pst-note { color: #7f8fa8; font-size: 11px; margin: 8px 0; }
    .pst-hint { color: #63708a; font-size: 10px; margin: -2px 0 6px 96px; }
    .pst-ctl { margin-bottom: 2px; }
    .pst-row { display: flex; align-items: center; gap: 8px; margin: 3px 0; }
    .pst-label { flex: 0 0 88px; color: #9fb0c8; }
    .pst-row input[type=range] { flex: 1; min-width: 0; accent-color: #ff7ae0; }
    .pst-num {
      flex: 0 0 58px; background: #131722; color: #cfe3d8; text-align: right;
      border: 1px solid #333a4a; padding: 2px 3px; font: inherit;
    }
    .pst-num::-webkit-outer-spin-button, .pst-num::-webkit-inner-spin-button {
      -webkit-appearance: none; margin: 0;
    }
    .pst-btn.pst-on { background: #3a2440; border-color: #ff7ae0; color: #ffd6f4; }
    .pst-col { flex: 1; height: 22px; background: none; border: 1px solid #333a4a; }
    .pst-chk { accent-color: #ff7ae0; }
    .pst-sel, .pst-text {
      flex: 1; min-width: 0; background: #131722; color: #cfe3d8;
      border: 1px solid #333a4a; padding: 3px; font: inherit;
    }
    .pst-btns { display: flex; flex-wrap: wrap; gap: 5px; margin: 8px 0; }
    .pst-btn {
      background: #1c2331; color: #cfe3d8; border: 1px solid #3a4457;
      padding: 4px 8px; cursor: pointer; font: inherit;
    }
    .pst-btn:hover { background: #263047; }
    .pst-stat { color: #ffd24a; font-size: 11px; margin: 4px 0 2px; }
    .pst-out {
      width: 100%; height: 190px; box-sizing: border-box; background: #0d1017;
      color: #9fe8c0; border: 1px solid #333a4a; font: 11px/1.4 ui-monospace, monospace;
      padding: 6px; resize: vertical;
    }
  `;
  document.head.appendChild(s);
}
