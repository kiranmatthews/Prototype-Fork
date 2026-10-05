import * as THREE from 'three';
import { Level, COMBO_GEM_TINT } from './level';
import { createJungleCupTrophy } from './competition/trophy';
import { setTimeMedalTier } from './timeMedalModel';
import type { TimeMedal } from './campaign';
import { createInputGlyph } from './inputPromptUI';
import { silverSecondaryLabel } from './secondaryText';
import type { InputAction } from './inputBindings';
import { presentationCssViewport } from './presentationCssViewport';

export type MenuReward = 'crystal' | 'gem' | 'combo' | 'medal' | 'cup';
let socketId = 0;
export function rewardSlot(kind: MenuReward, earned: boolean, medal?: TimeMedal | null): HTMLElement {
  const slot = document.createElement('span');
  slot.className = 'game-reward-slot'; slot.dataset.reward = kind;
  slot.dataset.earned = String(earned); if (medal) slot.dataset.medal = medal;
  slot.setAttribute('role', 'img');
  slot.setAttribute('aria-label', `${medal ?? kind}${earned ? ' earned' : ' empty socket'}`);
  if (!earned) {
    // Semantic fallback only: the cached pre-CRT painter uses the same silhouette.
    const paths = {
      crystal:'M50 5 73 28 69 68 50 96 31 68 27 28Z',
      gem:'M10 34 26 14 74 14 90 34 50 92Z',
      combo:'M10 34 26 14 74 14 90 34 50 92Z',
      medal:'M85 50a35 35 0 1 1-70 0a35 35 0 1 1 70 0',
      cup:'M20 10H80Q78 54 57 62V78H78V92H22V78H43V62Q22 54 20 10Z',
    };
    const id=`menu-socket-${++socketId}`;
    slot.innerHTML=`<svg class="game-reward-socket" viewBox="0 0 100 100" aria-hidden="true"><defs><linearGradient id="${id}" x2="0" y2="1"><stop stop-color="#010711"/><stop offset="1" stop-color="#102c3c"/></linearGradient></defs><path d="${paths[kind]}" fill="none" stroke="#79aec477" stroke-width="6" transform="translate(0 3)"/><path d="${paths[kind]}" fill="url(#${id})" stroke="#010710" stroke-width="3"/></svg>`;
  }
  return slot;
}
export function menuHint(label: string, actions: InputAction[], host: HTMLElement = document.createElement('span')): HTMLElement {
  host.classList.add('game-control-hint'); host.setAttribute('aria-label', label);
  host.replaceChildren(...actions.map(action => createInputGlyph(action)), silverSecondaryLabel(label, false));
  return host;
}

/** Shared renderer, pixel-space scene. The DOM hosts own layout and accessibility;
 * actual game collectible meshes own their appearance, on either CRT path. */
export class MenuRewardsPresentation {
  private scene = new THREE.Scene();
  private camera = new THREE.OrthographicCamera(-1, 1, 1, -1, .1, 2000);
  private pool: {kind: string; root: THREE.Group; model: THREE.Group; unit: number}[] = [];
  constructor() {
    this.camera.position.z = 1000;
    this.scene.add(new THREE.AmbientLight(0xffffff, 2.4));
    const key = new THREE.DirectionalLight(0xffefdb, 3.8); key.position.set(-2, 3, 5); this.scene.add(key);
    const rim = new THREE.DirectionalLight(0x9fdfff, 2); rim.position.set(3, 1, -2); this.scene.add(rim);
  }
  draw(renderer: THREE.WebGLRenderer, size: {width:number;height:number}, target: THREE.WebGLRenderTarget|null): void {
    const shell = document.querySelector<HTMLElement>('.game-shell:not([hidden])');
    if (!shell || document.body.classList.contains('game-shell-transitioning')) return;
    const display = presentationCssViewport();
    const hosts = [...shell.querySelectorAll<HTMLElement>('.game-reward-slot[data-earned="true"]')];
    for (const item of this.pool) item.root.visible = false;
    const used = new Set<object>();
    for (const host of hosts) {
      const rect = host.getBoundingClientRect(); if (rect.width < 1 || rect.height < 1) continue;
      // A bounded scrolling ledger must not leak rewards into its fixed header/footer.
      const clip = host.closest<HTMLElement>('.game-scroll-segment')?.getBoundingClientRect();
      if (clip && (rect.top < clip.top || rect.bottom > clip.bottom)) continue;
      const kind = host.dataset.reward!;
      let item = this.pool.find(value => value.kind === kind && !used.has(value));
      if (!item) {
        const model = kind === 'crystal' ? Level.crystalMesh() : kind === 'gem' ? Level.gemMesh() : kind === 'combo' ? Level.gemMesh(1, COMBO_GEM_TINT) : kind === 'cup' ? createJungleCupTrophy() : Level.timeRelicMesh();
        const sprites: THREE.Object3D[] = []; model.traverse(obj => { if ((obj as THREE.Sprite).isSprite) sprites.push(obj); });
        for (const sprite of sprites) sprite.removeFromParent();
        const bounds = new THREE.Box3().setFromObject(model), extent = bounds.getSize(new THREE.Vector3());
        model.position.sub(bounds.getCenter(new THREE.Vector3()));
        const root = new THREE.Group(); root.add(model); this.scene.add(root);
        item = {kind,root,model,unit:1 / Math.max(extent.y, Math.hypot(extent.x,extent.z))}; this.pool.push(item);
      }
      used.add(item); item.root.visible = true;
      if (kind === 'medal') setTimeMedalTier(item.model, (host.dataset.medal as TimeMedal) || 'gold');
      item.root.position.set(rect.x - display.left + rect.width/2 - display.width/2, display.height/2 - (rect.y - display.top) - rect.height/2, 0);
      item.root.scale.setScalar(Math.min(rect.width,rect.height) * .82 * item.unit);
      item.root.rotation.set(.13, matchMedia('(prefers-reduced-motion: reduce)').matches ? .35 : performance.now() * .0007, 0);
    }
    if (!used.size) return;
    this.camera.left = -display.width/2; this.camera.right = display.width/2;
    this.camera.top = display.height/2; this.camera.bottom = -display.height/2; this.camera.updateProjectionMatrix();
    const previous = renderer.getRenderTarget(), face = renderer.getActiveCubeFace(), mip = renderer.getActiveMipmapLevel();
    const viewport = renderer.getViewport(new THREE.Vector4()), scissor = renderer.getScissor(new THREE.Vector4());
    const test = renderer.getScissorTest(), auto = renderer.autoClear;
    try {
      renderer.setRenderTarget(target); renderer.setViewport(0,0,size.width,size.height); renderer.setScissorTest(false);
      renderer.autoClear = false; renderer.clearDepth(); renderer.render(this.scene,this.camera);
    } finally {
      renderer.setRenderTarget(previous,face,mip); renderer.setViewport(viewport); renderer.setScissor(scissor); renderer.setScissorTest(test); renderer.autoClear = auto;
    }
  }
}
