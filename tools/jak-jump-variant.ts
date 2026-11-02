import * as THREE from 'three';
import type { AnimationSuiteDocument, QuaternionTuple } from '../src/animation';
import type { OnFootJumpStudy } from '../src/onFootJumpStudy';

// Source reference: Jak target's 60 m/s² gravity, 1.01..3.5 m jump and
// 1..2.5 m second jump, with a 0.7 m collision offset. This is a fit to our
// character/controller, retaining the release/hold-to-skate input contract.
export const JAK_JUMP_PHYSICS: Readonly<OnFootJumpStudy> = Object.freeze({
  gravity: 60, minimumHeight: 1.05, maximumHeight: 2.8, doubleHeight: 1.8,
  steeringSeconds: .12, coastSeconds: .22,
});

/** C sharpens the gather and forward body fold, with less long-limb extension. */
export function createJakStudySuite(base: AnimationSuiteDocument): AnimationSuiteDocument {
  const suite = structuredClone(base);
  for (const clip of suite.clips) {
    if (!['player.jump', 'player.double-jump', 'player.fall', 'player.land'].includes(clip.id)) continue;
    clip.name = `Jak study C · ${clip.name}`;
    clip.metadata = {...clip.metadata, jumpStudyVariant: 'C'};
    for (const track of clip.tracks) {
      for (const key of track.keys) {
        if (track.kind === 'scalar' && typeof key.value === 'number' && key.value > 1)
          key.value = 1 + (key.value - 1) * .65;
        if (track.kind !== 'quaternion') continue;
        const euler = new THREE.Euler().setFromQuaternion(new THREE.Quaternion().fromArray(key.value as QuaternionTuple));
        if (track.target === 'spine' && euler.x > .3) euler.x *= 1.25;
        if (track.target === 'head' && euler.x < -.15) euler.x *= 1.2;
        if (track.target.startsWith('knee') && clip.id !== 'player.land' && euler.x > 1.3) euler.x *= 1.08;
        key.value = new THREE.Quaternion().setFromEuler(euler).toArray() as QuaternionTuple;
        if (clip.id === 'player.jump' && key.time > .2 && key.time < 1) key.time *= .85;
      }
    }
  }
  return suite;
}
