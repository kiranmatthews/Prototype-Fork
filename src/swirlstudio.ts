// The swirl studio — dial the wormhole by eye. Open with #swirlstudio.
// Controls mirror the band-based renderer: three independent rings, core,
// halo, backing, warm/cool palettes. Copy emits a block that pastes straight
// into SWIRL_PRESETS in src/swirls.ts.
import * as THREE from 'three';
import { readForkStudioDraft } from './localGameStorage';
import { swirls, SWIRL_PRESETS, type SwirlPreset, type Swirl } from './swirls';
import { el, sec, note, btn, sliderRow, injectStudioCss } from './studiokit';

interface Ctx {
  camera: THREE.PerspectiveCamera;
  scene: THREE.Scene;
  onClose: () => void;
}

const STORE = 'solProtoSwirlStudioV3'; // v3: unified seeded rings — older drafts don't fit

type Kind = 'num' | 'colour' | 'bool';
interface Field {
  key: keyof SwirlPreset;
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

const N = (key: keyof SwirlPreset, label: string, lo: number, hi: number, step: number, hint?: string): Field =>
  ({ key, label, kind: 'num', lo, hi, step, hint });
const COL = (key: keyof SwirlPreset, label: string): Field => ({ key, label, kind: 'colour' });

const GROUPS: Group[] = [
  {
    name: 'SHAPE',
    fields: [
      N('radius', 'radius', 0.2, 20, 0.05, 'world units'),
      N('segs', 'segments', 8, 48, 1, 'the reference budget is 24'),
      N('depth', 'depth', 0.2, 3, 0.01, 'ring lanes bunch toward the centre — tunnel foreshortening. 1 = even'),
      { key: 'billboard', label: 'face camera', kind: 'bool' },
      N('alpha', 'opacity', 0, 1, 0.01),
    ],
  },
  {
    name: 'SHARED MOTION',
    fields: [
      N('sharedLow', 'bulge 2-lobe', 0, 0.05, 0.001, 'the big slow bulges every ring shares'),
      N('sharedLowRate', 'bulge rate', 0, 4, 0.02),
      N('sharedMid', 'bulge 3-lobe', 0, 0.05, 0.001),
      N('sharedMidRate', '3-lobe rate', 0, 4, 0.02),
      N('breathe', 'breathe', 0, 0.02, 0.001, 'whole-portal radius breath — capped at 2%, rings hold station'),
      N('breatheRate', 'breathe rate', 0, 6, 0.02),
    ],
  },
  {
    name: 'RINGS',
    fields: [
      N('ringCount', 'rings', 1, 8, 1, 'how many — evenly laned, then scattered by vary'),
      N('ringInner', 'inner lane', 0.05, 0.6, 0.005, 'centre of the innermost ring slot'),
      N('ringOuter', 'outer lane', 0.15, 0.95, 0.005),
      N('ringLine', 'line width', 0.002, 0.08, 0.001, 'base half-width of the white-hot line'),
      N('ringGlow', 'glow width', 0.01, 0.3, 0.002, 'base half-width to the black edge'),
      N('ringBright', 'brightness', 0, 2.5, 0.02),
      N('vary', 'vary', 0, 1, 0.01, 'seeded per-ring spread: spacing, widths, brightness, wave character'),
      N('seed', 'seed', 1, 99, 1, 'reroll the family — same seed, same family, every run'),
    ],
  },
  {
    name: 'SHAPE WAVES',
    fields: [
      N('wavyAmp', 'wavy', 0, 0.08, 0.001, 'low-frequency waviness of the ring contours'),
      N('wavyFreq', 'wavy lobes', 1, 8, 1),
      N('wavyRate', 'wavy rate', 0, 8, 0.02),
      N('jagAmp', 'jag', 0, 0.06, 0.001, 'high-frequency jaggedness, runs backwards'),
      N('jagFreq', 'jag lobes', 4, 16, 1, 'needs segs ~3x this to draw corners'),
      N('jagRate', 'jag rate', 0, 8, 0.02),
    ],
  },
  {
    name: 'CORE',
    fields: [
      N('coreRadius', 'hot radius', 0.02, 0.4, 0.005, 'the clearly-hot centre — the footage sits near 0.1'),
      N('coreSoft', 'soft edge', 0.05, 0.6, 0.005, 'where the core glow dies to nothing'),
      N('coreBright', 'brightness', 0, 2.5, 0.02),
    ],
  },
  {
    name: 'HALO',
    fields: [
      N('haloRadius', 'radius', 0.2, 1, 0.005, 'the loose pale outer ring'),
      N('haloWidth', 'width', 0.01, 0.4, 0.005),
      N('haloAlpha', 'strength', 0, 1, 0.01, '0 = no halo'),
    ],
  },
  {
    name: 'BACKING',
    fields: [
      N('backingAlpha', 'opacity', 0, 1, 0.01, '1 = solid cloud, occludes the room behind'),
      N('backingRim', 'rim fade at', 0.2, 0.95, 0.005),
      N('backingFade', 'edge fade', 0, 1, 0.01, '1 = rim melts to transparent; 0 = solid near-black to the edge, as the reference'),
      N('cloudAmp', 'cloud', 0, 1.5, 0.02, 'how strongly the slow fields mottle it'),
      N('cloudRate', 'cloud rate', 0, 4, 0.02),
    ],
  },
  {
    name: 'MOTION',
    fields: [
      N('spin', 'spin', -3, 3, 0.01, 'rad/s whole-portal rotation. The reference sits at 0'),
      N('spinDiff', 'spin diff', -3, 3, 0.01, 'extra swirl at the centre, zero at the rim'),
      N('swallow', 'swallow', -1, 1, 0.005, 'rings ride the lane into the core (+), reborn at the rim — a seamless endless conveyor'),
      N('swallowTo', 'swallow to', 0.01, 0.3, 0.005, 'how deep rings travel before dying — small = right into the core'),
      N('swallowFrom', 'swallow from', 0.4, 1.1, 0.005, 'where newborns fade in — past the outer slot so they arrive early'),
      N('current', 'current', 0, 1, 0.01, 'brightness wave pouring through the bands'),
      N('currentRate', 'current rate', -8, 8, 0.02, '+ pours toward the core'),
      N('pulse', 'pulse', 0, 1, 0.01, 'whole-portal brightness breathing'),
      N('pulseRate', 'pulse rate', 0, 8, 0.02),
    ],
  },
  {
    name: 'PALETTE — WARM',
    fields: [
      COL('warmCore', 'core'), COL('warmLine', 'line'), COL('warmGlow', 'glow'),
      COL('warmHalo', 'halo'), COL('warmGround', 'ground'), COL('warmRim', 'rim'),
    ],
  },
  {
    name: 'PALETTE — COOL',
    fields: [
      COL('coolCore', 'core'), COL('coolLine', 'line'), COL('coolGlow', 'glow'),
      COL('coolHalo', 'halo'), COL('coolGround', 'ground'), COL('coolRim', 'rim'),
    ],
  },
  {
    name: 'PALETTE CYCLE',
    fields: [
      N('cycleRate', 'rate', 0, 8, 0.01,
        'rad/s. The WHOLE palette lerps warm->cool->warm together — period 1.4-2s is ~3.1-4.5'),
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
  private backdrop: THREE.Mesh | null = null;
  private dark = true;
  private out!: HTMLTextAreaElement;
  private overlay: HTMLElement | null = null;
  private overlayOpacity = 0.5;

  constructor(private ctx: Ctx) {
    this.preset = this.load();
    this.panel = this.build();
    document.body.appendChild(this.panel);
    this.makeBackdrop();
    this.respawn();
    this.dump();
  }

  /** Saved drafts are only trusted if they speak the band schema. */
  private load(): SwirlPreset {
    const saved = readForkStudioDraft(localStorage, STORE, 'swirlStudioV3');
    if (saved) {
      try {
        const j = JSON.parse(saved);
        if (j.preset && typeof j.preset.ringCount === 'number') {
          this.name = j.name ?? this.name;
          return j.preset as SwirlPreset;
        }
      } catch {
        /* fall through to the shipped preset */
      }
    }
    return clone(SWIRL_PRESETS.warpPortal);
  }

  /** Called from the frame loop while the studio is open. */
  frame(dt: number): void {
    void dt;
    const cam = this.ctx.camera;
    cam.getWorldDirection(FWD);
    if (this.live) this.live.group.position.copy(cam.position).addScaledVector(FWD, 9);
    if (this.backdrop) {
      // 13, not further: the preview parks at 9 and the card must beat the
      // level geometry to the depth buffer or the jungle floor IS the backdrop.
      this.backdrop.position.copy(cam.position).addScaledVector(FWD, 13);
      this.backdrop.quaternion.copy(cam.quaternion);
    }
  }

  private respawn(): void {
    const frozen = this.live?.paused ?? false;
    if (this.live) swirls.remove(this.live);
    this.live = swirls.spawn(this.preset, 0, 0, 0, { seed: 1 });
    // carry the freeze across preset loads — the new instance still paints
    // its first frame (dirty), then holds, and the button stays truthful
    this.live.paused = frozen;
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

  // -- reference overlay: an image or video floated over the viewport -------
  private setOverlay(file: File): void {
    this.clearOverlay();
    const url = URL.createObjectURL(file);
    let media: HTMLElement;
    if (file.type.startsWith('video')) {
      const v = document.createElement('video');
      v.src = url;
      v.loop = true;
      v.muted = true;
      v.autoplay = true;
      void v.play();
      media = v;
    } else {
      const img = document.createElement('img');
      img.src = url;
      media = img;
    }
    media.style.cssText =
      'position:fixed;left:0;top:0;width:calc(100% - 320px);height:100%;' +
      'object-fit:contain;pointer-events:none;z-index:40;';
    media.style.opacity = String(this.overlayOpacity);
    document.body.appendChild(media);
    this.overlay = media;
  }

  private clearOverlay(): void {
    if (this.overlay) {
      const src = (this.overlay as HTMLImageElement | HTMLVideoElement).src;
      this.overlay.remove();
      this.overlay = null;
      if (src.startsWith('blob:')) URL.revokeObjectURL(src);
    }
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
        'The Crash wormhole: three independent misshapen rings, a hot centre, ' +
          'a cloudy backing and a pale halo — every band its own Gouraud strip. ' +
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
      btn('Freeze', (b) => {
        // A TRUE freeze: the swirl stays in the scene and its update becomes
        // a no-op, holding the exact frame — nothing respawns, no phase moves.
        if (!this.live) return;
        this.live.paused = !this.live.paused;
        b.textContent = this.live.paused ? 'Unfreeze' : 'Freeze';
      }),
      btn('Reset saved', () => {
        this.preset = clone(SWIRL_PRESETS[sel.value] ?? SWIRL_PRESETS.warpPortal);
        this.respawn();
        this.rebuild();
        // last, so the key stays genuinely empty until the next edit
        localStorage.removeItem(STORE);
      }),
    );
    p.appendChild(stageBtns);

    // reference overlay controls
    const refBtns = el('div', 'pst-btns');
    const fileIn = document.createElement('input');
    fileIn.type = 'file';
    fileIn.accept = 'image/*,video/*';
    fileIn.style.display = 'none';
    fileIn.addEventListener('change', () => {
      if (fileIn.files && fileIn.files[0]) this.setOverlay(fileIn.files[0]);
    });
    refBtns.append(
      btn('Reference…', () => fileIn.click()),
      btn('Clear ref', () => this.clearOverlay()),
      fileIn,
    );
    p.appendChild(refBtns);
    p.appendChild(
      sliderRow('ref opacity', this.overlayOpacity, 0, 1, 0.01, (v) => {
        this.overlayOpacity = v;
        if (this.overlay) this.overlay.style.opacity = String(v);
      }),
    );

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
      inp.addEventListener('input', () => {
        (this.preset[f.key] as unknown) = parseInt(inp.value.slice(1), 16);
        this.apply();
      });
      row.append(l, inp);
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
    this.clearOverlay();
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
