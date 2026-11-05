import * as THREE from 'three';
import {skateboardSettings} from '../skateboard/settings';

export const SCRIBBLE_FRAMES = 12;
export const SCRIBBLE_FPS = 60;
const REVEAL_FRAME = 2;
// Ink bounds measured from the final atlas. Compensate the small differences
// in drawing placement, without cropping/rescaling any frame or changing ink weight.
const FRAME_CENTERS = [
  [.498698,.397949], [.501302,.402344], [.501302,.386230], [.498698,.396484],
  [.497396,.489746], [.497396,.489746], [.496094,.494141], [.509115,.495605],
  [.489583,.533203], [.5,.527344], [.490885,.528809], [.492188,.517090],
] as const;

/** Simulation clock, so pause / frame step / slow motion also control the ink.
 * Equipment switches under the full-size drawings, before the smaller drawings. */
export class BoardScribbleSequence {
  targetVisible = false;
  active = false;
  elapsed = 0;
  serial = 0;
  appearances = 0;
  disappearances = 0;
  get frame(): number {return Math.min(SCRIBBLE_FRAMES - 1, Math.floor(this.elapsed * SCRIBBLE_FPS + 1e-7));}
  get boardVisible(): boolean {return this.targetVisible && (!this.active || this.frame >= REVEAL_FRAME);}
  step(dt: number, visible: boolean, enabled = true): void {
    if (!enabled) {this.targetVisible = visible; this.active = false; return;}
    if (visible !== this.targetVisible) {
      this.targetVisible = visible; this.elapsed = 0; this.active = true; this.serial++;
      if (visible) this.appearances++; else this.disappearances++;
    } else if (this.active) {
      this.elapsed += dt;
      if (this.elapsed + 1e-7 >= SCRIBBLE_FRAMES / SCRIBBLE_FPS) this.active = false;
    }
  }
  reset(): void {
    this.targetVisible = this.active = false;
    this.elapsed = this.serial = this.appearances = this.disappearances = 0;
  }
}

/** Twelve independently drawn PNG frames on a fixed-size billboard. Only the
 * atlas cell changes: no scale tween, alpha fade, or resampled shrinking image. */
export class BoardScribbleEffect {
  readonly sprite: THREE.Sprite;
  private readonly texture: THREE.Texture;
  private serial = -1;
  private readonly center = new THREE.Vector3();
  private readonly tail = new THREE.Vector3();
  private readonly nose = new THREE.Vector3();
  private readonly a = new THREE.Vector3();
  private readonly b = new THREE.Vector3();
  private readonly worldScale = new THREE.Vector3();

  constructor(texture: THREE.Texture, private readonly root: THREE.Object3D,
    private readonly board: THREE.Object3D, private readonly clock: BoardScribbleSequence) {
    this.texture = texture.clone(); this.texture.needsUpdate = true;
    this.texture.colorSpace = THREE.SRGBColorSpace;
    this.texture.repeat.set(1 / 4, 1 / 3);
    this.texture.magFilter = this.texture.minFilter = THREE.LinearFilter;
    this.texture.generateMipmaps = false;
    const material = new THREE.SpriteMaterial({map:this.texture, transparent:false,
      alphaTest:.35, depthTest:false, depthWrite:false, toneMapped:false, fog:false});
    this.sprite = new THREE.Sprite(material);
    this.sprite.name = 'board-scribble'; this.sprite.renderOrder = 100;
    this.sprite.frustumCulled = false; this.sprite.visible = false;
  }

  update(camera: THREE.Camera): void {
    this.sprite.visible = this.clock.active;
    if (!this.clock.active) {this.serial = -1; return;}
    const newBurst = this.serial !== this.clock.serial;
    this.board.updateWorldMatrix(true, false);
    // Follow the actual prop on appearance. On disappearance, retain its last
    // attachment to the moving player rather than snapping to the idle board.
    if (newBurst || this.clock.targetVisible) {
      const s = skateboardSettings.value, scale = s.overallScale;
      const y = (s.boardToGroundDistance + .01) * scale;
      this.center.set(0, y, (s.deckNoseLength - s.deckTailLength) * .5 * scale);
      this.tail.set(0, y, -s.deckTailLength * scale);
      this.nose.set(0, y, s.deckNoseLength * scale);
      for (const v of [this.center, this.tail, this.nose]) this.root.worldToLocal(this.board.localToWorld(v));
      if (newBurst) {
        this.board.getWorldScale(this.worldScale);
        const width = (s.deckNoseLength + s.deckTailLength) * scale * this.worldScale.z * 1.45;
        // Same pixel density and quad dimensions for ALL twelve drawings.
        this.sprite.scale.set(width, width * (1024 / 3) / (1536 / 4), 1);
      }
    }
    this.serial = this.clock.serial;
    this.sprite.position.copy(this.root.localToWorld(this.a.copy(this.center)));
    this.a.copy(this.tail); this.b.copy(this.nose);
    this.root.localToWorld(this.a); this.root.localToWorld(this.b);
    this.a.applyMatrix4(camera.matrixWorldInverse); this.b.applyMatrix4(camera.matrixWorldInverse);
    this.sprite.material.rotation = Math.atan2(this.b.y - this.a.y, this.b.x - this.a.x);
    const frame = this.clock.frame;
    this.sprite.center.set(FRAME_CENTERS[frame][0], FRAME_CENTERS[frame][1]);
    this.texture.offset.set((frame % 4) / 4, 1 - (Math.floor(frame / 4) + 1) / 3);
  }
  dispose(): void {this.sprite.removeFromParent(); this.sprite.material.dispose(); this.texture.dispose();}
}
