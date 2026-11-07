import * as THREE from 'three';
import {skateboardSettings} from '../skateboard/settings';

export const SCRIBBLE_FRAMES = 32;
export const SCRIBBLE_FPS = 60;
export const SCRIBBLE_DURATION = SCRIBBLE_FRAMES / SCRIBBLE_FPS;
const REVEAL_FRAME = 2;
// Thirty-two source drawings. Every sample uses the same 384 × 128 pixels.
// Measured UV origins / ink anchors accommodate the hand-drawn row spacing,
// keeping the ink centred without rescaling a drawing or changing pen weight.
const FRAME_REGIONS = [
  [0,0.86328125,0.5,0.5],
  [0.25,0.864257813,0.497395833,0.5],
  [0.5,0.865234375,0.498697917,0.5],
  [0.75,0.865234375,0.48828125,0.49609375],
  [0,0.723632813,0.49609375,0.5],
  [0.25,0.7265625,0.5,0.49609375],
  [0.5,0.720703125,0.493489583,0.5],
  [0.75,0.717773438,0.497395833,0.5],
  [0,0.588867188,0.497395833,0.5],
  [0.25,0.5859375,0.498697917,0.49609375],
  [0.5,0.583007813,0.498697917,0.5],
  [0.75,0.580078125,0.498697917,0.5],
  [0,0.455078125,0.501302083,0.50390625],
  [0.25,0.456054688,0.497395833,0.5],
  [0.5,0.455078125,0.5,0.49609375],
  [0.75,0.455078125,0.498697917,0.50390625],
  [0,0.33203125,0.490885417,0.5],
  [0.25,0.3359375,0.4921875,0.5],
  [0.5,0.331054688,0.497395833,0.5],
  [0.75,0.331054688,0.493489583,0.5],
  [0,0.21484375,0.498697917,0.49609375],
  [0.25,0.21484375,0.502604167,0.5],
  [0.5,0.21484375,0.498697917,0.49609375],
  [0.75,0.21484375,0.5,0.5],
  [0,0.099609375,0.489583333,0.50390625],
  [0.25,0.098632813,0.493489583,0.5],
  [0.5,0.09765625,0.5,0.49609375],
  [0.75,0.09765625,0.498697917,0.5],
  [0,0,0.5,0.42578125],
  [0.25,0,0.498697917,0.44140625],
  [0.5,0,0.5,0.44921875],
  [0.75,0,0.501302083,0.44140625]
] as const;

/** Simulation clock, so pause / frame step / slow motion also control the ink.
 * Equipment switches under the full-size drawings, before the smaller drawings. */
export class BoardScribbleSequence {
  enabled = true;
  targetVisible = false;
  private playing = false;
  duration = SCRIBBLE_DURATION;
  elapsed = 0;
  serial = 0;
  appearances = 0;
  disappearances = 0;
  get active(): boolean {return this.enabled && this.playing;}
  get frame(): number {return Math.min(SCRIBBLE_FRAMES - 1, Math.floor(this.elapsed / this.duration * SCRIBBLE_FRAMES + 1e-7));}
  get boardVisible(): boolean {return this.targetVisible && (!this.active || this.frame >= REVEAL_FRAME);}
  // Only an explicit equipment cue starts a burst. Board visibility, bails,
  // loose decks and other animation owners are deliberately not inputs.
  start(visible: boolean, duration = SCRIBBLE_DURATION): void {
    this.duration = duration;
    this.targetVisible = visible; this.elapsed = 0; this.playing = true; this.serial++;
    if (visible) this.appearances++; else this.disappearances++;
  }
  step(dt: number): void {
    if (this.playing) {
      this.elapsed += dt;
      if (this.elapsed + 1e-7 >= this.duration) this.playing = false;
    }
  }
  cancel(): void {this.playing = false;}
  reset(): void {
    this.targetVisible = this.playing = false;
    this.elapsed = this.appearances = this.disappearances = 0;
    this.duration = SCRIBBLE_DURATION;
    this.serial++;
  }
}

/** Thirty-two independently drawn PNG frames on a fixed-size billboard. Only the
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
    this.texture.repeat.set(1 / 4, 1 / 8);
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
    // A/B hides the drawing without changing the size of the same burst.
    if (!this.clock.active) return;
    const newBurst = this.serial !== this.clock.serial;
    this.board.updateWorldMatrix(true, false);
    // Both bursts follow the source prop. Dismount ink clears at the hand catch,
    // before the source animation relinquishes the board to the idle pose.
    {
      const s = skateboardSettings.value, scale = s.overallScale;
      const y = (s.boardToGroundDistance + .01) * scale;
      this.center.set(0, y, (s.deckNoseLength - s.deckTailLength) * .5 * scale);
      this.tail.set(0, y, -s.deckTailLength * scale);
      this.nose.set(0, y, s.deckNoseLength * scale);
      for (const v of [this.center, this.tail, this.nose]) this.root.worldToLocal(this.board.localToWorld(v));
      if (newBurst) {
        this.board.getWorldScale(this.worldScale);
        const width = (s.deckNoseLength + s.deckTailLength) * scale * this.worldScale.z * 1.45;
        // Same pixel density and quad dimensions for ALL thirty-two drawings.
        this.sprite.scale.set(width, width / 3, 1);
      }
    }
    this.serial = this.clock.serial;
    this.sprite.position.copy(this.root.localToWorld(this.a.copy(this.center)));
    this.a.copy(this.tail); this.b.copy(this.nose);
    this.root.localToWorld(this.a); this.root.localToWorld(this.b);
    this.a.applyMatrix4(camera.matrixWorldInverse); this.b.applyMatrix4(camera.matrixWorldInverse);
    this.sprite.material.rotation = Math.atan2(this.b.y - this.a.y, this.b.x - this.a.x);
    const frame = FRAME_REGIONS[this.clock.frame];
    this.sprite.center.set(frame[2], frame[3]);
    this.texture.offset.set(frame[0], frame[1]);
  }
  dispose(): void {this.sprite.removeFromParent(); this.sprite.material.dispose(); this.texture.dispose();}
}
