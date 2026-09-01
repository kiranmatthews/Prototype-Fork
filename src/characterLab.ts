import * as THREE from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';
import { RigBinding } from './animation';
import type { Player } from './player';
import type { CartoonGlovePoseName } from './character/cartoonGlove';
import {
  CHARACTER_PROPORTION_CONTROLS,
  DEFAULT_CHARACTER_PROPORTIONS,
  characterProportionSettings,
  type CharacterProportionControl,
  type CharacterProportionKey,
  type CharacterProportionSettingsValue,
} from './character/settings';

export interface CharacterLabContext {
  renderer: THREE.WebGLRenderer;
  scene: THREE.Scene;
  camera: THREE.PerspectiveCamera;
  player: Player;
  rigRoot: THREE.Object3D;
  onClose(): void;
}

export interface CharacterLabDiagnostics {
  readonly settings: Readonly<CharacterProportionSettingsValue>;
  readonly tailVisible: boolean;
  readonly bounds: { width: number; height: number; depth: number };
  readonly appliedObjectCount: number;
}

export interface CharacterLabHandle {
  frame(): void;
  close(): void;
  readonly isOpen: boolean;
  readonly diagnostics: CharacterLabDiagnostics;
  rootElement(): HTMLElement;
}

let stylesInstalled = false;

function installStyles(): void {
  if (stylesInstalled) return;
  stylesInstalled = true;
  const style = document.createElement('style');
  style.dataset.characterLab = 'styles';
  style.textContent = `
    body.character-lab-open { overflow: hidden; }
    body.character-lab-open .game-hud-layer,
    body.character-lab-open .hud-tl, body.character-lab-open .hud-tr,
    body.character-lab-open .hud-trickplate, body.character-lab-open .hud-msg,
    body.character-lab-open .hud-boosts, body.character-lab-open .hud-balance,
    body.character-lab-open .hud-vbalance, body.character-lab-open .side-wrap,
    body.character-lab-open .hud-ttclock { display: none !important; }
    .clab, .clab * { box-sizing: border-box; }
    .clab {
      position: fixed; inset: 0; z-index: 1000; pointer-events: none;
      color: #dce7ef; font: 12px/1.35 Inter, ui-sans-serif, system-ui, sans-serif;
      color-scheme: dark; user-select: none;
    }
    .clab-panel {
      pointer-events: auto; position: absolute; right: 0; top: 0; bottom: 0;
      width: min(390px, 94vw); overflow: auto; padding: 0 14px 24px;
      background: linear-gradient(180deg, rgba(13,16,24,.975), rgba(10,12,18,.975));
      border-left: 1px solid #384157; box-shadow: -10px 0 30px rgba(0,0,0,.28);
    }
    .clab-head {
      position: sticky; top: 0; z-index: 2; display: flex; align-items: center;
      min-height: 48px; gap: 8px; background: rgba(13,16,24,.985);
      border-bottom: 1px solid #343d50;
    }
    .clab-brand { flex: 1; color: #ff78d3; font-weight: 850; letter-spacing: .17em; }
    .clab-close, .clab-button {
      min-height: 29px; border: 1px solid #3c465d; border-radius: 4px;
      background: #1b2230; color: #dce7ef; padding: 4px 8px; cursor: pointer;
      font: inherit;
    }
    .clab-close { width: 31px; font-size: 15px; }
    .clab-button:hover, .clab-close:hover { background: #29344a; }
    .clab-button[data-active=true] { background: #482b49; border-color: #ff78d3; color: #ffe4f7; }
    .clab-actions { display: flex; flex-wrap: wrap; gap: 6px; margin: 10px 0; }
    .clab-section {
      margin: 15px 0 7px; padding-bottom: 5px; border-bottom: 1px solid #293043;
      color: #8c9bb1; font-size: 10px; font-weight: 800; letter-spacing: .15em;
      text-transform: uppercase;
    }
    .clab-row { display: grid; grid-template-columns: 118px minmax(65px,1fr) 64px; gap: 7px; align-items: center; margin: 6px 0; }
    .clab-label { color: #b0bbcc; }
    .clab-range { width: 100%; min-width: 0; accent-color: #ff78d3; }
    .clab-number {
      width: 64px; min-width: 0; padding: 4px 5px; text-align: right;
      color: #dce7ef; background: #111621; border: 1px solid #3a4357;
      border-radius: 3px; font: inherit; font-variant-numeric: tabular-nums;
    }
    .clab-number::-webkit-outer-spin-button, .clab-number::-webkit-inner-spin-button { -webkit-appearance: none; margin: 0; }
    .clab-check { display: flex; align-items: center; gap: 8px; margin: 9px 0; color: #c4cfdd; }
    .clab-check input { accent-color: #ff78d3; }
    .clab-note { margin: 8px 0; color: #8492a8; font-size: 11px; }
    .clab-status {
      margin: 10px 0; padding: 8px; border-left: 2px solid #61ddff;
      background: rgba(97,221,255,.065); color: #bfefff; white-space: pre-line;
      font-variant-numeric: tabular-nums;
    }
    .clab-toast {
      position: fixed; left: 50%; bottom: 28px; transform: translateX(-50%);
      padding: 7px 12px; border-radius: 5px; background: rgba(8,11,17,.94);
      border: 1px solid #49546b; opacity: 0; transition: opacity .12s;
    }
    .clab-toast[data-show=true] { opacity: 1; }
    @media (max-width: 700px) {
      .clab-panel { width: min(350px, 96vw); }
      .clab-row { grid-template-columns: 102px minmax(55px,1fr) 58px; }
      .clab-number { width: 58px; }
    }
  `;
  document.head.appendChild(style);
}

function element<K extends keyof HTMLElementTagNameMap>(
  tag: K,
  className: string,
  text?: string,
): HTMLElementTagNameMap[K] {
  const node = document.createElement(tag);
  node.className = className;
  if (text !== undefined) node.textContent = text;
  return node;
}

export function openCharacterLab(ctx: CharacterLabContext): CharacterLabHandle {
  return new CharacterLab(ctx);
}

class CharacterLab implements CharacterLabHandle {
  private open = true;
  private readonly root = element('div', 'clab');
  private readonly panel = element('aside', 'clab-panel');
  private readonly status = element('div', 'clab-status');
  private readonly toast = element('div', 'clab-toast');
  private readonly controls: OrbitControls;
  private readonly grid = new THREE.GridHelper(8, 32, 0x66718a, 0x303747);
  private readonly cameraPosition: THREE.Vector3;
  private readonly cameraQuaternion: THREE.Quaternion;
  private readonly cameraNear: number;
  private readonly cameraFar: number;
  private readonly inputByKey = new Map<CharacterProportionKey, {
    range: HTMLInputElement;
    number: HTMLInputElement;
  }>();
  private readonly unsubscribe: () => void;
  private tailInput!: HTMLInputElement;
  private steered = false;
  private toastTimer: number | undefined;

  constructor(private readonly ctx: CharacterLabContext) {
    installStyles();
    document.body.classList.add('character-lab-open');
    this.cameraPosition = ctx.camera.position.clone();
    this.cameraQuaternion = ctx.camera.quaternion.clone();
    this.cameraNear = ctx.camera.near;
    this.cameraFar = ctx.camera.far;

    this.controls = new OrbitControls(ctx.camera, ctx.renderer.domElement);
    this.controls.enableDamping = true;
    this.controls.dampingFactor = 0.1;
    this.controls.screenSpacePanning = true;
    this.controls.minDistance = 0.7;
    this.controls.maxDistance = 18;
    this.controls.addEventListener('start', () => { this.steered = true; });

    try {
      const binding = RigBinding.fromSculptRuntime(ctx.rigRoot, { strict: false });
      binding.applyPose({ joints: {}, scalars: {} }, { resetUnspecified: true, strict: false });
      ctx.player.applyAnimationDeformations({});
    } catch {
      // The current preview pose remains a valid sculpting surface if a future
      // non-humanoid rig deliberately omits the conventional binding metadata.
    }
    ctx.player.tailRef?.reset();
    ctx.player.syncCharacterAppearance();
    ctx.player.setCartoonGlovePreviewPose('relaxed');

    this.grid.material.opacity = 0.28;
    this.grid.material.transparent = true;
    ctx.scene.add(this.grid);
    this.buildPanel();
    this.root.append(this.panel, this.toast);
    document.body.appendChild(this.root);
    this.frameCamera('three-quarter');
    this.unsubscribe = characterProportionSettings.subscribe((value) => {
      this.refreshInputs(value);
      ctx.player.syncCharacterAppearance();
      this.updateFloorAndStatus();
      if (!this.steered) this.frameCamera('three-quarter');
    }, true);
    window.addEventListener('keydown', this.onKeyDown);
  }

  get isOpen(): boolean {
    return this.open;
  }

  get diagnostics(): CharacterLabDiagnostics {
    const bounds = this.characterBounds();
    const size = bounds.getSize(new THREE.Vector3());
    return {
      settings: { ...characterProportionSettings.value },
      tailVisible: this.ctx.player.characterTailVisible,
      bounds: { width: size.x, height: size.y, depth: size.z },
      appliedObjectCount: this.ctx.player.characterProportionDiagnostics.appliedObjectCount,
    };
  }

  rootElement(): HTMLElement {
    return this.root;
  }

  frame(): void {
    if (!this.open) return;
    this.ctx.player.syncCharacterAppearance();
    this.controls.update();
    this.updateFloorAndStatus();
  }

  close(): void {
    if (!this.open) return;
    this.open = false;
    this.unsubscribe();
    this.controls.dispose();
    this.grid.removeFromParent();
    this.ctx.camera.position.copy(this.cameraPosition);
    this.ctx.camera.quaternion.copy(this.cameraQuaternion);
    this.ctx.camera.near = this.cameraNear;
    this.ctx.camera.far = this.cameraFar;
    this.ctx.camera.updateProjectionMatrix();
    this.root.remove();
    document.body.classList.remove('character-lab-open');
    window.removeEventListener('keydown', this.onKeyDown);
    if (this.toastTimer !== undefined) window.clearTimeout(this.toastTimer);
    this.ctx.onClose();
  }

  private readonly onKeyDown = (event: KeyboardEvent): void => {
    if (event.key === 'Escape') this.close();
  };

  private buildPanel(): void {
    const header = element('div', 'clab-head');
    header.appendChild(element('div', 'clab-brand', 'CHARACTER LAB'));
    const close = element('button', 'clab-close', '×');
    close.type = 'button';
    close.title = 'Close Character Lab';
    close.onclick = () => this.close();
    header.appendChild(close);
    this.panel.appendChild(header);

    this.panel.appendChild(element(
      'div',
      'clab-note',
      'Persistent procedural proportions. Animation, sockets and gameplay collision remain separate.',
    ));

    const actions = element('div', 'clab-actions');
    for (const [label, view] of [
      ['Front', 'front'],
      ['3/4', 'three-quarter'],
      ['Side', 'side'],
      ['Rear', 'rear'],
      ['Hands', 'hands'],
    ] as const) {
      const button = element('button', 'clab-button', label);
      button.type = 'button';
      button.onclick = () => {
        this.steered = true;
        this.frameCamera(view);
      };
      actions.appendChild(button);
    }
    const reset = element('button', 'clab-button', 'Reset all');
    reset.type = 'button';
    reset.onclick = () => {
      characterProportionSettings.reset();
      this.ctx.player.setCharacterTailVisible(true);
      this.ctx.player.setCartoonGlovePreviewPose('relaxed');
      this.tailInput.checked = true;
      this.steered = false;
      this.frameCamera('three-quarter');
      this.showToast('Default proportions restored');
    };
    const copy = element('button', 'clab-button', 'Copy JSON');
    copy.type = 'button';
    copy.onclick = () => {
      const source = characterProportionSettings.serialize(true);
      const done = () => this.showToast('Character settings copied');
      if (navigator.clipboard?.writeText) void navigator.clipboard.writeText(source).then(done, () => {
        window.prompt('Copy Character Lab settings:', source);
      });
      else window.prompt('Copy Character Lab settings:', source);
    };
    actions.append(reset, copy);
    this.panel.appendChild(actions);

    this.panel.appendChild(element('div', 'clab-section', 'Hand rig preview'));
    const handViews = element('div', 'clab-actions');
    for (const [label, view] of [
      ['Hand front', 'hands-front'],
      ['Hand 3/4', 'hands'],
      ['Hand side', 'hands-side'],
      ['Hand rear', 'hands-rear'],
    ] as const) {
      const button = element('button', 'clab-button', label);
      button.type = 'button';
      button.onclick = () => {
        this.steered = true;
        this.frameCamera(view);
      };
      handViews.appendChild(button);
    }
    this.panel.appendChild(handViews);
    const handPoses = element('div', 'clab-actions');
    const glovePoseNames: readonly CartoonGlovePoseName[] =
      ['open', 'relaxed', 'curl', 'fist', 'pinch', 'grab'];
    for (const poseName of glovePoseNames) {
      const button = element('button', 'clab-button', poseName[0].toUpperCase() + poseName.slice(1));
      button.type = 'button';
      button.dataset.handPose = poseName;
      button.dataset.active = String(poseName === 'relaxed');
      button.onclick = () => {
        this.ctx.player.setCartoonGlovePreviewPose(poseName);
        for (const candidate of handPoses.querySelectorAll<HTMLButtonElement>('[data-hand-pose]')) {
          candidate.dataset.active = String(candidate.dataset.handPose === poseName);
        }
        this.showToast(`${button.textContent} hand pose`);
      };
      handPoses.appendChild(button);
    }
    this.panel.appendChild(handPoses);

    let section = '';
    for (const control of CHARACTER_PROPORTION_CONTROLS) {
      if (control.section !== section) {
        section = control.section;
        this.panel.appendChild(element('div', 'clab-section', section));
      }
      this.panel.appendChild(this.slider(control));
    }

    this.panel.appendChild(element('div', 'clab-section', 'Signature'));
    const tail = element('label', 'clab-check');
    this.tailInput = document.createElement('input');
    this.tailInput.type = 'checkbox';
    this.tailInput.checked = this.ctx.player.characterTailVisible;
    this.tailInput.onchange = () => {
      this.ctx.player.setCharacterTailVisible(this.tailInput.checked);
      this.showToast(this.tailInput.checked ? 'Tail shown' : 'Tail hidden');
    };
    tail.append(this.tailInput, element('span', '', 'Show animal tail'));
    this.panel.append(tail, this.status);
  }

  private slider(control: CharacterProportionControl): HTMLElement {
    const row = element('div', 'clab-row');
    const label = element('label', 'clab-label', control.label);
    const range = document.createElement('input');
    range.className = 'clab-range';
    range.type = 'range';
    range.min = String(control.min);
    range.max = String(control.max);
    range.step = String(control.step);
    const number = document.createElement('input');
    number.className = 'clab-number';
    number.type = 'number';
    number.min = String(control.min);
    number.max = String(control.max);
    number.step = String(control.step);
    const apply = (raw: string): void => {
      const value = Number(raw);
      if (!Number.isFinite(value)) return;
      characterProportionSettings.patch({ [control.key]: value });
    };
    range.oninput = () => apply(range.value);
    number.oninput = () => apply(number.value);
    label.ondblclick = () => characterProportionSettings.patch({
      [control.key]: DEFAULT_CHARACTER_PROPORTIONS[control.key],
    });
    this.inputByKey.set(control.key, { range, number });
    row.append(label, range, number);
    return row;
  }

  private refreshInputs(value: Readonly<CharacterProportionSettingsValue>): void {
    for (const [key, inputs] of this.inputByKey) {
      const next = value[key];
      inputs.range.value = String(next);
      if (document.activeElement !== inputs.number) inputs.number.value = next.toFixed(2);
    }
    if (this.tailInput) this.tailInput.checked = this.ctx.player.characterTailVisible;
  }

  private characterBounds(): THREE.Box3 {
    const subject = this.ctx.player.riderRef ?? this.ctx.rigRoot;
    subject.updateWorldMatrix(true, true);
    const bounds = new THREE.Box3().setFromObject(subject);
    if (bounds.isEmpty()) {
      bounds.setFromCenterAndSize(
        subject.getWorldPosition(new THREE.Vector3()),
        new THREE.Vector3(0.8, 2, 0.8),
      );
    }
    return bounds;
  }

  private handBounds(): THREE.Box3 {
    const bounds = new THREE.Box3().makeEmpty();
    for (const name of ['cartoon-glove-left', 'cartoon-glove-right']) {
      const hand = this.ctx.rigRoot.getObjectByName(name);
      if (hand) bounds.expandByObject(hand);
    }
    return bounds.isEmpty() ? this.characterBounds() : bounds;
  }

  private updateFloorAndStatus(): void {
    const bounds = this.characterBounds();
    const size = bounds.getSize(new THREE.Vector3());
    const center = bounds.getCenter(new THREE.Vector3());
    this.grid.position.set(center.x, bounds.min.y, center.z);
    const diagnostics = this.ctx.player.characterProportionDiagnostics;
    this.status.textContent =
      `${size.x.toFixed(2)} × ${size.y.toFixed(2)} × ${size.z.toFixed(2)} world units\n` +
      `${diagnostics.appliedObjectCount} proportion targets · collision unchanged`;
  }

  private frameCamera(
    view: 'front' | 'three-quarter' | 'side' | 'rear' |
      'hands' | 'hands-front' | 'hands-side' | 'hands-rear',
  ): void {
    const bounds = view.startsWith('hands') ? this.handBounds() : this.characterBounds();
    const center = bounds.getCenter(new THREE.Vector3());
    const size = Math.max(0.5, bounds.getSize(new THREE.Vector3()).length());
    const distance = size / (2 * Math.tan(THREE.MathUtils.degToRad(this.ctx.camera.fov) / 2)) * 1.22;
    const directions = {
      front: new THREE.Vector3(0, 0.12, -1),
      'three-quarter': new THREE.Vector3(0.7, 0.16, -1),
      side: new THREE.Vector3(1, 0.12, 0),
      rear: new THREE.Vector3(0, 0.12, 1),
      hands: new THREE.Vector3(0.72, 0.12, -1),
      'hands-front': new THREE.Vector3(0, 0.06, -1),
      'hands-side': new THREE.Vector3(1, 0.06, 0),
      'hands-rear': new THREE.Vector3(0, 0.06, 1),
    } as const;
    this.controls.target.copy(center);
    this.ctx.camera.position.copy(center).add(directions[view].clone().normalize().multiplyScalar(distance));
    this.ctx.camera.near = Math.max(0.005, distance / 200);
    this.ctx.camera.far = Math.max(100, distance * 30);
    this.ctx.camera.lookAt(center);
    this.ctx.camera.updateProjectionMatrix();
    this.controls.update();
    this.updateFloorAndStatus();
  }

  private showToast(message: string): void {
    this.toast.textContent = message;
    this.toast.dataset.show = 'true';
    if (this.toastTimer !== undefined) window.clearTimeout(this.toastTimer);
    this.toastTimer = window.setTimeout(() => {
      this.toast.dataset.show = 'false';
    }, 1400);
  }
}
