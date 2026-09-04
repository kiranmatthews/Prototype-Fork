// The Gouraud FIELD studio — the preserved sine-field disc's control panel.
// Open with #fieldstudio on the URL. Scratch remains a general-purpose draft;
// Menu, Warp/Loading and Game Over retain separate source-profile drafts.
import * as THREE from 'three';
import {
  FIELD_SWIRL_PRESETS,
  FieldSwirl,
  type FieldSwirlPreset,
} from './swirlfield';
import {
  FIELD_STUDIO_CONTEXTS,
  FIELD_STUDIO_CONTEXT_INFO,
  gameFlowProfilesFromStudio,
  loadFieldStudioState,
  presetForFieldStudioSource,
  resetFieldStudioContext,
  saveFieldStudioState,
  type FieldStudioContext,
  type FieldStudioState,
} from './fieldStudioPresets';
import { el, sec, note, btn, sliderRow, injectStudioCss } from './studiokit';

interface Ctx {
  camera: THREE.PerspectiveCamera;
  scene: THREE.Scene;
  onClose: () => void;
}

type Kind = 'num' | 'colour' | 'bool' | 'blend';
interface Field {
  key: keyof FieldSwirlPreset;
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

const N = (key: keyof FieldSwirlPreset, label: string, lo: number, hi: number, step: number, hint?: string): Field =>
  ({ key, label, kind: 'num', lo, hi, step, hint });

const GROUPS: Group[] = [
  {
    name: 'SHAPE',
    fields: [
      N('radius', 'radius', 0.2, 20, 0.05, 'world units'),
      N('rings', 'rings', 3, 14, 1, 'polar grid rings — more = smoother radially'),
      N('segs', 'segments', 8, 48, 1, 'points around the circle'),
      N('depth', 'depth', 0.2, 4, 0.01, 'ring gaps shrink toward the centre — tunnel illusion. 1 = even'),
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
    // The two plasma families, deliberately separate: SHAPE moves vertices,
    // GHOST paints — the accidental colour-space deformations that were worth
    // keeping when the geometry warp replaced them as the main act.
    name: 'PLASMA · SHAPE',
    fields: [
      N('warpA', 'cloud', 0, 0.35, 0.005, 'band A: the big slow bulges (low frequency)'),
      N('warpAScale', 'cloud scale', 1, 12, 1),
      N('warpARate', 'cloud rate', 0, 12, 0.02),
      N('warpB', 'electric', 0, 0.35, 0.005, 'band B: the lively jagged edge — high frequency, runs backwards'),
      N('warpBScale', 'electric scale', 1, 12, 1, 'lobes per circumference; at ~segs/3 the polyline makes corners'),
      N('warpBRate', 'electric rate', 0, 12, 0.02, 'the seethe. The reference runs this FAST'),
      N('warpC', 'sway', 0, 0.35, 0.005, 'band C: very low frequency drift'),
      N('warpCScale', 'sway scale', 1, 12, 1),
      N('warpCRate', 'sway rate', 0, 12, 0.02),
      N('couple', 'light follows', 0, 2, 0.01, 'bright bands ride the deformed shape. 0 = paint on a circle (jelly)'),
    ],
  },
  {
    name: 'PLASMA · GHOST',
    fields: [
      N('jag', 'colour jag', 0, 3, 0.01, 'kinks the painted line, geometry untouched — needs segs ~4x the scale'),
      N('jagScale', 'jag scale', 1, 12, 1, 'kinks per circumference (5-9 = electric)'),
      N('jagRate', 'jag rate', 0, 8, 0.02, 'how fast the kinks seethe'),
      N('streak', 'streak', 0, 1, 0.01, 'brightness knots ALONG the line — energy coursing through'),
      N('streakScale', 'streak scale', 1, 10, 1, 'knots per circumference'),
      N('streakRate', 'streak rate', -8, 8, 0.02, 'rad/s the knots travel along the rings'),
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
      N('spinDiff', 'spin diff', -3, 3, 0.01, 'extra field swirl at the centre, fading to zero at the rim'),
      N('pulse', 'pulse', 0, 1, 0.01, 'brightness breathing'),
      N('pulseRate', 'pulse rate', 0, 6, 0.02),
    ],
  },
];

export function openFieldStudio(ctx: Ctx): FieldStudio {
  return new FieldStudio(ctx);
}

class FieldStudio {
  private panel: HTMLElement;
  private state: FieldStudioState;
  private context: FieldStudioContext;
  private preset: FieldSwirlPreset;
  private name = 'myField';
  private live: FieldSwirl | null = null;
  private paused = false;
  private backdrop: THREE.Mesh | null = null;
  private dark = true;
  private out!: HTMLTextAreaElement;
  private seed = 1;
  private contextDescription!: HTMLElement;
  private nameLabel!: HTMLLabelElement;
  private nameInput!: HTMLInputElement;
  private sourceSelect!: HTMLSelectElement;

  constructor(private ctx: Ctx) {
    this.state = loadFieldStudioState();
    this.context = this.state.selectedContext;
    const draft = this.state.drafts[this.context];
    this.name = draft.name;
    this.seed = draft.seed;
    this.preset = clone(draft.preset);
    this.panel = this.build();
    document.body.appendChild(this.panel);
    this.makeBackdrop();
    this.respawn();
    this.dump(false);
  }

  /** Called from the frame loop while the studio is open. */
  frame(dt: number): void {
    const cam = this.ctx.camera;
    cam.getWorldDirection(FWD);
    if (this.live) {
      this.live.group.position.copy(cam.position).addScaledVector(FWD, 9);
      if (!this.paused) this.live.update(dt, cam);
    }
    if (this.backdrop) {
      // 13, not further: the preview parks at 9 and the card must beat the
      // level geometry to the depth buffer or the jungle floor IS the backdrop.
      this.backdrop.position.copy(cam.position).addScaledVector(FWD, 13);
      this.backdrop.quaternion.copy(cam.quaternion);
    }
  }

  private respawn(): void {
    if (this.live) {
      this.ctx.scene.remove(this.live.group);
      this.live.dispose();
    }
    this.live = new FieldSwirl(this.preset, { seed: this.seed });
    this.ctx.camera.getWorldDirection(FWD);
    this.live.group.position
      .copy(this.ctx.camera.position)
      .addScaledVector(FWD, 9);
    // A context/source switch is legal while paused. Prime the freshly
    // allocated buffers once so the frozen replacement is a complete frame.
    this.live.update(0, this.ctx.camera);
    this.ctx.scene.add(this.live.group);
  }

  /** Push edits into the live instance without recreating it. */
  private apply(): void {
    this.live?.setPreset(this.preset);
    this.dump(true);
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
    h.textContent = 'GOURAUD FIELD LAB';
    const x = el('button', 'pst-x');
    x.textContent = '✕';
    x.onclick = () => this.close();
    h.appendChild(x);
    p.appendChild(h);

    p.appendChild(
      note(
        'A coarse polar grid of Gouraud triangles coloured by a cheap field of sines. ' +
          'Each game-flow context keeps its own auto-saved draft. Copy All emits the ' +
          'three reviewed profiles for src/gameFlowVortexProfiles.ts.',
      ),
    );

    p.appendChild(sec('CONTEXT'));
    const contextRow = el('div', 'pst-row');
    const contextLabel = el('label', 'pst-label');
    contextLabel.textContent = 'editing';
    const contextSelect = document.createElement('select');
    contextSelect.className = 'pst-sel';
    for (const context of FIELD_STUDIO_CONTEXTS) {
      const option = document.createElement('option');
      option.value = context;
      option.textContent = FIELD_STUDIO_CONTEXT_INFO[context].label;
      contextSelect.appendChild(option);
    }
    contextSelect.value = this.context;
    contextSelect.addEventListener('change', () => {
      this.switchContext(contextSelect.value as FieldStudioContext);
    });
    contextRow.append(contextLabel, contextSelect);
    p.appendChild(contextRow);
    this.contextDescription = note('');
    p.appendChild(this.contextDescription);

    p.appendChild(sec('PRESET'));
    const nameRow = el('div', 'pst-row');
    this.nameLabel = el('label', 'pst-label') as HTMLLabelElement;
    this.nameInput = document.createElement('input');
    this.nameInput.type = 'text';
    this.nameInput.className = 'pst-text';
    this.nameInput.addEventListener('input', () => {
      if (this.context !== 'scratch') return;
      this.name = this.nameInput.value.replace(/[^\w-]/g, '') || 'myField';
      this.dump(true);
    });
    nameRow.append(this.nameLabel, this.nameInput);
    p.appendChild(nameRow);

    const loadRow = el('div', 'pst-row');
    const loadLbl = el('label', 'pst-label');
    loadLbl.textContent = 'start from';
    this.sourceSelect = document.createElement('select');
    this.sourceSelect.className = 'pst-sel';
    this.sourceSelect.addEventListener('change', () => {
      this.applySource(this.sourceSelect.value);
    });
    loadRow.append(loadLbl, this.sourceSelect);
    p.appendChild(loadRow);
    this.refreshContextControls();

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
        this.paused = !this.paused;
        b.textContent = this.paused ? 'Resume' : 'Pause';
      }),
      btn('Reseed', () => {
        this.seed = this.seed >= 0x7fffffff ? 1 : this.seed + 1;
        this.respawn();
        this.dump(true);
      }),
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
      btn('Copy active', (b) => void this.copyText(this.activeProfileOutput(), b, 'Copy active')),
      btn('Copy all', (b) => void this.copyText(this.allProfilesOutput(), b, 'Copy all')),
      btn('Download all', () => {
        const blob = new Blob(
          [JSON.stringify({ version: 1, profiles: gameFlowProfilesFromStudio(this.state) }, null, 2)],
          { type: 'application/json' },
        );
        const a = document.createElement('a');
        a.href = URL.createObjectURL(blob);
        a.download = 'game-flow-gouraud-presets.json';
        a.click();
        URL.revokeObjectURL(a.href);
      }),
      btn('Reset context', () => {
        this.syncDraft();
        resetFieldStudioContext(this.state, this.context);
        this.loadDraft();
        this.respawn();
        this.refreshContextControls();
        this.rebuild(true);
      }),
    );
    p.appendChild(outBtns);
    return p;
  }

  private switchContext(context: FieldStudioContext): void {
    if (!FIELD_STUDIO_CONTEXTS.includes(context) || context === this.context) return;
    this.syncDraft();
    this.context = context;
    this.state.selectedContext = context;
    this.loadDraft();
    this.refreshContextControls();
    this.respawn();
    this.rebuild(true);
  }

  private loadDraft(): void {
    const draft = this.state.drafts[this.context];
    this.name = draft.name;
    this.seed = draft.seed;
    this.preset = clone(draft.preset);
  }

  private syncDraft(): void {
    const draft = this.state.drafts[this.context];
    draft.name = this.name;
    draft.seed = this.seed;
    draft.preset = clone(this.preset);
  }

  private refreshContextControls(): void {
    const info = FIELD_STUDIO_CONTEXT_INFO[this.context];
    const draft = this.state.drafts[this.context];
    this.contextDescription.textContent = info.description;
    this.nameLabel.textContent = this.context === 'scratch' ? 'name' : 'profile key';
    this.nameInput.value = this.name;
    this.nameInput.readOnly = this.context !== 'scratch';
    this.sourceSelect.replaceChildren();
    if (this.context !== 'scratch') {
      const authored = document.createElement('option');
      authored.value = 'authored';
      authored.textContent = `authored ${info.label.toLowerCase()}`;
      this.sourceSelect.appendChild(authored);
    }
    for (const key of Object.keys(FIELD_SWIRL_PRESETS)) {
      const option = document.createElement('option');
      option.value = key;
      option.textContent = key;
      this.sourceSelect.appendChild(option);
    }
    this.sourceSelect.value = draft.sourcePreset;
  }

  private applySource(sourcePreset: string): void {
    const draft = this.state.drafts[this.context];
    draft.sourcePreset = sourcePreset;
    const source = presetForFieldStudioSource(this.context, sourcePreset);
    this.seed = source.seed;
    this.preset = source.preset;
    if (this.context === 'scratch') this.name = sourcePreset;
    this.syncDraft();
    this.refreshContextControls();
    this.respawn();
    this.rebuild(true);
  }

  private async copyText(
    value: string,
    button: HTMLElement,
    idleLabel: string,
  ): Promise<void> {
    try {
      await navigator.clipboard.writeText(value);
      button.textContent = 'Copied';
      setTimeout(() => (button.textContent = idleLabel), 1200);
    } catch {
      this.out.value = value;
      this.out.select();
      button.textContent = 'Select + copy';
    }
  }

  private fill(host: HTMLElement): void {
    host.textContent = '';
    for (const g of GROUPS) {
      host.appendChild(sec(g.name));
      for (const f of g.fields) host.appendChild(this.control(f));
    }
  }

  private rebuild(save = true): void {
    const body = this.panel.querySelector('.pst-body') as HTMLElement;
    if (body) this.fill(body);
    this.dump(save);
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

  private dump(persist: boolean): void {
    this.syncDraft();
    this.out.value = this.activeProfileOutput();
    if (persist) saveFieldStudioState(this.state);
  }

  private activeProfileOutput(): string {
    const clean: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(this.preset)) {
      if (v === undefined) continue;
      clean[k] = v;
    }
    const value = this.context === 'scratch'
      ? clean
      : { seed: this.seed, preset: clean };
    const body = JSON.stringify(value, null, 2)
      .split('\n')
      .map((line, index) => (index === 0 ? line : `  ${line}`))
      .join('\n');
    return `  ${this.name}: ${body},`;
  }

  private allProfilesOutput(): string {
    this.syncDraft();
    return (
      'export const GAME_FLOW_VORTEX_PROFILES = ' +
      JSON.stringify(gameFlowProfilesFromStudio(this.state), null, 2) +
      ' as const;'
    );
  }

  private close(): void {
    if (this.live) {
      this.ctx.scene.remove(this.live.group);
      this.live.dispose();
      this.live = null;
    }
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

function clone(p: Readonly<FieldSwirlPreset>): FieldSwirlPreset {
  return { ...p };
}
function num(v: unknown, dflt: number): number {
  return typeof v === 'number' ? v : dflt;
}
