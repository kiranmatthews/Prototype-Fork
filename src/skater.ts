import * as THREE from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';

// The rigged, animated skater: a Mixamo-rigged glTF character (public/models/
// ch46.glb) with the game's animation clips baked in. It replaces the
// procedural hero body — the game physics still owns position/facing, this just
// picks the right clip for the current move state and crossfades between them.
export class SkaterModel {
  ready = false;
  readonly group = new THREE.Group();
  scale = 1.5; // GLB is ~1.47u tall; the procedural hero was ~2.27u
  yawOffset = 0; // model-forward alignment vs the course (tuned live)
  yOffset = 0;
  clips: string[] = [];

  private mixer: THREE.AnimationMixer | null = null;
  private actions = new Map<string, THREE.AnimationAction>();
  private current = '';

  constructor(scene: THREE.Scene, url: string) {
    this.group.scale.setScalar(this.scale);
    scene.add(this.group);
    new GLTFLoader().load(
      url,
      (gltf) => {
        const root = gltf.scene;
        root.traverse((o) => {
          // skinned bounds fool frustum culling; keep it drawn.
          if ((o as THREE.Mesh).isMesh) (o as THREE.Mesh).frustumCulled = false;
        });
        this.group.add(root);
        this.mixer = new THREE.AnimationMixer(root);
        for (const clip of gltf.animations) {
          stripRootMotionXZ(clip); // in-place horizontally; physics drives ground travel
          const action = this.mixer.clipAction(clip);
          this.actions.set(clip.name, action);
          this.clips.push(clip.name);
        }
        this.ready = true;
      },
      undefined,
      (err) => console.warn('skater model failed to load:', err),
    );
  }

  private play(name: string, fade = 0.18): void {
    if (!this.mixer || name === this.current) return;
    const next = this.actions.get(name);
    if (!next) return;
    const prev = this.actions.get(this.current);
    next.enabled = true;
    next.setEffectiveWeight(1).reset().play();
    if (prev && prev !== next) next.crossFadeFrom(prev, fade, true);
    this.current = name;
  }

  update(dt: number, pos: THREE.Vector3, yaw: number, clip: string): void {
    if (!this.ready) return;
    this.group.position.set(pos.x, pos.y + this.yOffset, pos.z);
    this.group.rotation.y = yaw + this.yawOffset;
    this.group.scale.setScalar(this.scale);
    if (clip) this.play(clip);
    this.mixer?.update(dt);
  }

  setVisible(v: boolean): void {
    this.group.visible = v;
  }
}

// Pin the Hips X/Z translation to its first-frame value so locomotion clips
// don't drift the character across the world (the game physics owns ground
// travel). Vertical (Y) is kept so crouches, jumps and slides still bob.
function stripRootMotionXZ(clip: THREE.AnimationClip): void {
  for (const track of clip.tracks) {
    if (!/Hips\.position$/.test(track.name)) continue;
    const v = track.values; // [x,y,z, x,y,z, ...]
    const x0 = v[0];
    const z0 = v[2];
    for (let i = 0; i < v.length; i += 3) {
      v[i] = x0;
      v[i + 2] = z0;
    }
  }
}
