// The swirl studio — dial the wormholes by eye, same deal as the smoke studio
// next door. Open with #swirlstudio on the URL. Every control the swirl field
// reads is on the panel; Copy emits a block that pastes straight into
// SWIRL_PRESETS in src/swirls.ts.
import * as THREE from 'three';
import { swirls, SWIRL_PRESETS, type SwirlPreset, type Swirl } from './swirls';
import { el, sec, note, btn, sliderRow, injectStudioCss } from './studiokit';

interface Ctx {
  camera: THREE.PerspectiveCamera;
  scene: THREE.Scene;
  onClose: () => void;
}

const STORE = 'swirlStudioV1';

type Kind = 'num' | 'colour' | 'bool' | 'blend';
interface Field {
  key: keyof SwirlPreset;
  label: string;
  kind: Kind;
  lo?: number;
  hi?: number;
  step?: number;
  hint?: string;
  optional?: boolean; // colour with a use-me checkbox; unchecked deletes the key
}
interface Group {
  name: string;
  fields: Field[];
}

const N = (key: keyof SwirlPreset, label: string, lo: number, hi: number, step: number, hint?: string): Field =>
  ({ key, label, kind: 'num', lo, hi, step, hint });

const GROUPS: Group[] = [
  {
    name: 'SHAPE',
    fields: [
      N('radius', 'radius', 0.2, 20, 0.05, 'world units'),
      N('rings', 'rings', 3, 14, 1, 'polar grid rings — more = smoother radially'),
      N('segs', 'segments', 8, 48, 1, 'points around the circle'),
      { key: 'billboard', label: 'face camera', kind: 'bool' },
    ],
  },
  {
    name: 'SPIRAL',
    fields: [
      N('arms', 'arms', 0, 6, 1, '0 = concentric rings, 1 = one spiral arm'),
      N('twist', 'twist', -6, 6, 0.05, 'turns from centre to rim; sign flips the hand'),
      N('flow', 'swallow', -3, 3, 0.01, 'radius/sec the rings THEMSELVES travel: + into the core, - out'),
      N('current', 'current', -6, 6, 0.01, 'colour pulse pouring through the rings without moving them'),
      N('sharp', 'sharpness', 0.5, 14, 0.05, '1 = broad band, 10 = hairline filament'),
      N('filament', 'filament', 0, 2.5, 0.02, 'strength of the bright line. 0 = none'),
      N('glowWidth', 'glow bleed', 0.05, 1, 0.02, 'how far colour bleeds around the line'),
    ],
  },
  {
    name: 'CHURN',
    fields: [
      N('wobble', 'wobble', 0, 3, 0.02, 'bends the spiral so it goes wispy'),
      N('wobbleScale', 'wobble scale', 0, 8, 0.05),
      N('wobbleRate', 'wobble rate', 0, 5, 0.02),
      N('edgeCrinkle', 'edge crinkle', 0, 0.4, 0.005, 'the rim stops being a clean circle'),
    ],
  },
  {
    name: 'CORE + GROUND',
    fields: [
      N('core', 'core size', 0.02, 1, 0.01, 'hot blob in the middle, fraction of radius'),
      N('coreGlow', 'core glow', 0, 4, 0.02),
      N('mottle', 'mottle', 0, 1.5, 0.02, 'cloudiness of the backing'),
      N('mottleScale', 'mottle scale', 0, 8, 0.05),
      N('mottleRate', 'mottle rate', 0, 4, 0.02),
    ],
  },
  {
    name: 'COLOUR',
    fields: [
      { key: 'blend', label: 'body blend', kind: 'blend', hint: 'the ground pass: alpha occludes, add burns' },
      { key: 'blendBright', label: 'bright blend', kind: 'blend', hint: 'the filament/glow/core pass' },
      { key: 'colCore', label: 'hot core', kind: 'colour', hint: 'the white-hot line centre' },
      { key: 'colFil', label: 'filament', kind: 'colour' },
      { key: 'colGlow', label: 'glow', kind: 'colour', hint: 'the bleed around the filament' },
      { key: 'colGround', label: 'backing', kind: 'colour', hint: 'the disc behind everything' },
      { key: 'colGround2', label: 'mottle', kind: 'colour', optional: true, hint: 'what the cloud patches lift toward' },
      { key: 'colRim', label: 'rim tint', kind: 'colour', optional: true, hint: 'the outer band before it dies' },
      N('alpha', 'opacity', 0, 1, 0.01),
      N('body', 'body', 0, 1, 0.01, 'ground-pass opacity: 1 = solid cloudy disc, 0 = only the bright bits'),
      N('rim', 'rim fade at', 0.1, 1, 0.01, 'where the edge starts dying'),
    ],
  },
  {
    name: 'COLOUR CYCLE',
    fields: [
      N('cycleRate', 'breath rate', 0, 4, 0.01, 'rad/s the palette breathes A→B→A, short hue arc, no rainbow detour'),
      { key: 'colCoreB', label: 'core B', kind: 'colour', optional: true },
      { key: 'colFilB', label: 'filament B', kind: 'colour', optional: true },
      { key: 'colGlowB', label: 'glow B', kind: 'colour', optional: true },
      { key: 'colGroundB', label: 'backing B', kind: 'colour', optional: true },
      { key: 'colGround2B', label: 'mottle B', kind: 'colour', optional: true },
      { key: 'colRimB', label: 'rim B', kind: 'colour', optional: true },
      N('hueCycle', 'hue walk', -3, 3, 0.01, 'rad/s round the FULL wheel (Crash 1 style) — usually 0'),
    ],
  },
  {
    name: 'MOTION',
    fields: [
      N('spin', 'spin', -3, 3, 0.01, 'whole-disc rotation on top of the flow'),
      N('pulse', 'pulse', 0, 1, 0.01, 'brightness breathing'),
      N('pulseRate', 'pulse rate', 0, 6, 0.02),
    ],
  },
];

export function openSwirlStudio(ctx: Ctx): SwirlStudio {
  return new SwirlStudio(ctx);
}

class SwirlStudio {
  private panel: HTMLElement;
  private preset: SwirlPreset;
  private name = 'mySwirl';
  private live: Swirl | null = null;
  private paused = false;
  private backdrop: THREE.Mesh | null = null;
  private dark = true;
  private out!: HTMLTextAreaElement;
  private seed = 1;

  constructor(private ctx: Ctx) {
    const saved = localStorage.getItem(STORE);
    if (saved) {
      try {
        const j = JSON.parse(saved);
        this.name = j.name ?? this.name;
        this.preset = j.preset ?? clone(SWIRL_PRESETS.warpPortal);
      } catch {
        this.preset = clone(SWIRL_PRESETS.warpPortal);
      }
    } else this.preset = clone(SWIRL_PRESETS.warpPortal);
    this.panel = this.build();
    document.body.appendChild(this.panel);
    this.makeBackdrop();
    this.respawn();
    this.dump();
  }

  /** Called from the frame loop while the studio is open. */
  frame(dt: number): void {
    const cam = this.ctx.camera;
    cam.getWorldDirection(FWD);
    if (this.live) this.live.group.position.copy(cam.position).addScaledVector(FWD, 9);
    if (this.backdrop) {
      // 13, not further: the preview parks at 9 and the card must beat the
      // level geometry to the depth buffer or the jungle floor IS the backdrop.
      this.backdrop.position.copy(cam.position).addScaledVector(FWD, 13);
      this.backdrop.quaternion.copy(cam.quaternion);
    }
    // paused = the system just doesn't tick this one (system.update is driven
    // by main, which updates every live swirl; pausing removes it instead)
    void dt;
  }

  private respawn(): void {
    if (this.live) swirls.remove(this.live);
    this.live = swirls.spawn(this.preset, 0, 0, 0, { seed: this.seed++ });
  }

  /** Push edits into the live instance without recreating it. */
  private apply(): void {
    this.live?.setPreset(this.preset);
    this.dump();
  }

  private makeBackdrop(): void {
    const m = new THREE.Mesh(
      new THREE.PlaneGeometry(70, 46),
      new THREE.MeshBasicMaterial({ color: 0x0a0c14, fog: false, depthWrite: true }),
    );
    m.renderOrder = -2;
    m.frustumCulled = false;
    this.ctx.scene.add(m);
    this.backdrop = m;
  }

  private setBackdrop(): void {
    if (!this.backdrop) return;
    (this.backdrop.material as THREE.MeshBasicMaterial).color.setHex(
      this.dark ? 0x0a0c14 : 0x9fb6c8,
    );
  }

  private build(): HTMLElement {
    injectStudioCss();
    const p = el('div', 'pst');
    const h = el('div', 'pst-head');
    h.textContent = 'SWIRL STUDIO';
    const x = el('button', 'pst-x');
    x.textContent = '✕';
    x.onclick = () => this.close();
    h.appendChild(x);
    p.appendChild(h);

    p.appendChild(
      note(
        'Wormholes and scenery swirls: a coarse polar grid of Gouraud triangles, ' +
          'coloured by a cheap field of sines — visualizer maths, PS1 rules. ' +
          'Dial it, then Copy: the block pastes into SWIRL_PRESETS in src/swirls.ts.',
      ),
    );

    p.appendChild(sec('PRESET'));
    const nameRow = el('div', 'pst-row');
    const nameLbl = el('label', 'pst-label');
    nameLbl.textContent = 'name';
    const nameIn = document.createElement('input');
    nameIn.type = 'text';
    nameIn.className = 'pst-text';
    nameIn.value = this.name;
    nameIn.addEventListener('input', () => {
      this.name = nameIn.value.replace(/[^\w]/g, '') || 'mySwirl';
      this.dump();
    });
    nameRow.append(nameLbl, nameIn);
    p.appendChild(nameRow);

    const loadRow = el('div', 'pst-row');
    const loadLbl = el('label', 'pst-label');
    loadLbl.textContent = 'start from';
    const sel = document.createElement('select');
    sel.className = 'pst-sel';
    for (const k of Object.keys(SWIRL_PRESETS)) {
      const o = document.createElement('option');
      o.value = k;
      o.textContent = k;
      sel.appendChild(o);
    }
    sel.value = 'warpPortal';
    sel.addEventListener('change', () => {
      this.preset = clone(SWIRL_PRESETS[sel.value]);
      this.name = sel.value;
      nameIn.value = sel.value;
      this.respawn();
      this.rebuild();
    });
    loadRow.append(loadLbl, sel);
    p.appendChild(loadRow);

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
      btn('Pause', (b) => {
        // Pausing removes it from the ticking system; resuming re-adds it in
        // place, deterministic from its seed.
        this.paused = !this.paused;
        b.textContent = this.paused ? 'Resume' : 'Pause';
        if (this.paused) {
          if (this.live) {
            swirls.remove(this.live);
            this.live = null;
          }
        } else this.respawn();
      }),
      btn('Reseed', () => this.respawn()),
    );
    p.appendChild(stageBtns);

    const body = el('div', 'pst-body');
    p.appendChild(body);
    this.fill(body);

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
        this.preset = clone(SWIRL_PRESETS[sel.value] ?? SWIRL_PRESETS.warpPortal);
        this.respawn();
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
      inp.value = '#' + (((cur as number) ?? 0xffffff) >>> 0).toString(16).padStart(6, '0');
      let off: HTMLInputElement | null = null;
      if (f.optional) {
        off = document.createElement('input');
        off.type = 'checkbox';
        off.className = 'pst-chk';
        off.checked = cur !== undefined;
        off.title = 'use this colour';
      }
      const setIt = (): void => {
        if (off && !off.checked) delete this.preset[f.key];
        else (this.preset[f.key] as unknown) = parseInt(inp.value.slice(1), 16);
        this.apply();
      };
      inp.addEventListener('input', setIt);
      off?.addEventListener('change', setIt);
      row.append(l, inp);
      if (off) row.append(off);
      wrap.appendChild(row);
    } else if (f.kind === 'bool') {
      const row = el('div', 'pst-row');
      const l = el('label', 'pst-label');
      l.textContent = f.label;
      const inp = document.createElement('input');
      inp.type = 'checkbox';
      inp.className = 'pst-chk';
      inp.checked = cur !== false;
      inp.addEventListener('change', () => {
        (this.preset[f.key] as unknown) = inp.checked;
        this.apply();
      });
      row.append(l, inp);
      wrap.appendChild(row);
    } else if (f.kind === 'blend') {
      const row = el('div', 'pst-row');
      const l = el('label', 'pst-label');
      l.textContent = f.label;
      const s = document.createElement('select');
      s.className = 'pst-sel';
      for (const v of ['add', 'alpha']) {
        const o = document.createElement('option');
        o.value = v;
        o.textContent = v;
        s.appendChild(o);
      }
      s.value = String(cur ?? (f.key === 'blend' ? 'alpha' : 'add'));
      s.addEventListener('change', () => {
        (this.preset[f.key] as unknown) = s.value;
        this.apply();
      });
      row.append(l, s);
      wrap.appendChild(row);
    } else {
      wrap.appendChild(
        sliderRow(f.label, num(cur, f.lo!), f.lo!, f.hi!, f.step!, (v) => {
          (this.preset[f.key] as unknown) = v;
          this.apply();
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
    if (this.live) swirls.remove(this.live);
    this.live = null;
    this.panel.remove();
    if (this.backdrop) {
      this.ctx.scene.remove(this.backdrop);
      this.backdrop.geometry.dispose();
      (this.backdrop.material as THREE.Material).dispose();
      this.backdrop = null;
    }
    this.ctx.onClose();
  }
}

const FWD = new THREE.Vector3();

function clone(p: SwirlPreset): SwirlPreset {
  return JSON.parse(JSON.stringify(p)) as SwirlPreset;
}
function num(v: unknown, dflt: number): number {
  return typeof v === 'number' ? v : dflt;
}
