import * as THREE from 'three';
import type { AnimationClip, AnimationTrack, QuaternionTuple, Vec3Tuple } from './types';

export const JUMP_REFERENCE_CLIP_IDS = ['player.jump', 'player.double-jump', 'player.fall', 'player.land'] as const;
export const JUMP_REFERENCE_REVISION = 1;
type EulerKey = readonly [number, number, number?, number?];

/** Original poses for our proportions, informed by the local Jak motion study.
 * No source skeleton, sampled keyframes or game assets are embedded here.
 * Jump uses rise progress (1 = apex); double jump uses the whole arc (.5 = apex).
 * Length channels stay editable and compose with the shared elasticity layer.
 */
export function withJumpReferenceMotion(clip: AnimationClip): AnimationClip {
  if (!(JUMP_REFERENCE_CLIP_IDS as readonly string[]).includes(clip.id)) return clip;
  const tracks: AnimationTrack[] = [];
  const rotation = (target: string, keys: readonly EulerKey[]) => {
    const id = `${clip.id}:${target}:quaternion`;
    tracks.push({ id, kind: 'quaternion', target, keys: keys.map(([time, x, y = 0, z = 0], i) => ({
      id: `${id}:key-${i}`, time,
      value: new THREE.Quaternion().setFromEuler(new THREE.Euler(x, y, z, 'XYZ')).toArray() as QuaternionTuple,
      interpolation: 'cubic',
    })) });
  };
  const position = (keys: readonly (readonly [number, number, number?])[]) => {
    const id = `${clip.id}:root:position`;
    tracks.push({ id, kind: 'position', target: 'root', keys: keys.map(([time, y, z = 0], i) => ({
      id: `${id}:key-${i}`, time, value: [0, y, z] as Vec3Tuple, interpolation: 'cubic',
    })) });
  };
  const length = (target: string, keys: readonly (readonly [number, number])[]) => {
    const id = `${clip.id}:${target}:scalar`;
    tracks.push({ id, kind: 'scalar', target, keys: keys.map(([time, value], i) => ({
      id: `${id}:key-${i}`, time, value, interpolation: 'cubic',
    })) });
  };
  // Pair asymmetry is in knee/hip timing; the arm arc keeps both elbows and
  // gloves outside the torso, including the extreme stretched silhouettes.
  const arms = (keys: readonly (readonly [number, number, number, number, number])[]) => {
    for (const [side, sign] of [['Left', 1], ['Right', -1]] as const) {
      rotation(`shoulder${side}`, keys.map(([t, pitch, spread]) => [t, pitch, 0, sign * spread]));
      rotation(`elbow${side}`, keys.map(([t, , , bend]) => [t, bend]));
      rotation(`wrist${side}`, keys.map(([t, , , , drag]) => [t, drag]));
    }
  };
  const apexChest = .08, apexHead = -.30;
  if (clip.id === 'player.jump') {
    position([[0, .07], [.10, .14, -.01], [.42, .10], [.72, -.015, .01], [1, -.08, .015]]);
    rotation('spine', [[0, -.04], [.10, .04], [.42, .35], [.72, .58], [1, .62]]);
    rotation('chest', [[0, -.03], [.18, -.02], [.58, .04], [1, apexChest]]);
    rotation('head', [[0, .03], [.26, -.04], [.64, -.22], [1, apexHead]]);
    rotation('hipLeft', [[0, .08], [.10, .15], [.42, -.40], [.72, -.95], [1, -1.05]]);
    rotation('kneeLeft', [[0, .12], [.10, .06], [.42, .90], [.72, 1.75], [1, 1.85]]);
    rotation('hipRight', [[0, .05], [.10, .12], [.48, -.29], [.78, -.78], [1, -.88]]);
    rotation('kneeRight', [[0, .12], [.10, .06], [.48, .82], [.78, 1.50], [1, 1.65]]);
    // Jak's arms trail DOWN at launch, open into a broad bent-elbow tuck,
    // then lift during descent. Leading overhead reverses that source rhythm.
    arms([[0, .10, .30, -.10, .12], [.10, .08, .32, -.12, .16],
      [.38, -.08, .72, -.50, .10], [.68, -.20, 1.05, -.82, -.08],
      [1, -.25, 1.12, -.95, -.12]]);
    // Keep the authored large launch stretch, but release it earlier so the
    // knees can catch the torso before gravity reaches the apex.
    for (const track of clip.tracks) if (track.kind === 'scalar') {
      length(track.target, track.keys.map(key => [key.time === .5 ? .32 : key.time === .85 ? .72 : key.time, key.value]));
    }
  } else if (clip.id === 'player.double-jump') {
    rotation('root', [[0, 0], [1, 0]]);
    position([[0, .10], [.12, .12, -.01], [.32, .01], [.5, -.07, .015], [.78, -.015], [1, 0]]);
    rotation('spine', [[0, .04], [.12, .18], [.30, .49], [.5, .62], [.78, .35], [1, .02]]);
    rotation('chest', [[0, -.02], [.18, .02], [.5, apexChest], [.78, .03], [1, 0]]);
    rotation('head', [[0, -.04], [.22, -.12], [.5, apexHead], [.82, -.18], [1, 0]]);
    rotation('hipLeft', [[0, -.12, 0, .06], [.12, -.40, 0, .14], [.32, -.96, 0, .12],
      [.5, -1.16, 0, .08], [.78, -.54, 0, .06], [1, -.25, 0, .04]]);
    rotation('kneeLeft', [[0, .24], [.12, .70], [.32, 1.70], [.5, 2.02], [.78, 1.0], [1, .5]]);
    rotation('hipRight', [[0, .12, 0, -.06], [.12, -.20, 0, -.14], [.32, -.70, 0, -.12],
      [.5, -.91, 0, -.08], [.78, -.5, 0, -.06], [1, -.28, 0, -.04]]);
    rotation('kneeRight', [[0, .10], [.12, .55], [.32, 1.45], [.5, 1.74], [.78, .94], [1, .54]]);
    arms([[0, .08, .32, -.12, .16], [.12, -.08, .72, -.50, .10],
      [.32, -.20, 1.05, -.82, -.08], [.5, -.25, 1.12, -.95, -.12],
      [.78, -.95, 1.0, -.65, .04], [1, -1.90, .65, -.30, .12]]);
    for (const track of clip.tracks) if (track.kind === 'scalar') {
      const peak = track.target.includes('.leg.') ? (track.target.includes('.lower.') ? 1.52 : 1.40)
        : track.target.includes('.torso.') ? 1.32 : track.target.includes('.lower.') ? 1.34 : 1.26;
      const squash = track.target.includes('.leg.') ? .77 : track.target.includes('.torso.') ? .80 : .86;
      length(track.target, [[0, peak * .95], [.08, peak], [.3, .94], [.5, squash], [.78, .96], [1, 1]]);
    }
  } else if (clip.id === 'player.fall') {
    // Fall progress is normalized downward speed, not elapsed seconds.
    // Spread the recovery across that interval to avoid snapping on short hops.
    rotation('spine', [[0, .62], [.45, .35], [1, .02]]);
    rotation('hipLeft', [[0, -1.05], [.45, -.64], [1, -.25, 0, .04]]);
    rotation('kneeLeft', [[0, 1.85], [.45, 1.18], [1, .5]]);
    rotation('hipRight', [[0, -.88], [.45, -.56], [1, -.28, 0, -.04]]);
    rotation('kneeRight', [[0, 1.65], [.45, 1.05], [1, .54]]);
    rotation('chest', [[0, apexChest], [.45, .05], [1, 0]]);
    rotation('head', [[0, apexHead], [.45, -.06], [1, 0]]);
    arms([[0, -.25, 1.12, -.95, -.12], [.45, -.95, 1.0, -.65, .04],
      [1, -1.90, .65, -.30, .12]]);
  } else {
    // The support/contact solve owns planted feet. Add torso and hand delay
    // around the existing impact .075, rebound .18, finite .45-second settle.
    rotation('spine', [[0, .02], [.075, .46], [.18, -.08], [.30, .05], [.45, 0]]);
    rotation('chest', [[0, 0], [.095, .16], [.21, -.10], [.34, .025], [.45, 0]]);
    rotation('head', [[0, 0], [.075, -.12], [.14, -.23], [.25, .06], [.36, -.02], [.45, 0]]);
    arms([[0, -1.90, .65, -.30, .12], [.075, -1.55, .60, -.38, -.10],
      [.16, -.65, .46, -.75, -.20], [.26, -.22, .38, -.40, .12],
      [.36, .04, .30, -.18, .04], [.45, 0, .25, -.12, 0]]);
  }
  const replacements = new Set(tracks.map(track => `${track.target}:${track.kind}`));
  const name = clip.id === 'player.double-jump' ? 'Double Jump — Second Pop and Tuck'
    : clip.id === 'player.jump' ? 'Jump — Trail, Gather, Float'
    : clip.id === 'player.land' ? 'Land — Catch, Rebound, Settle' : clip.name;
  return { ...clip, name,
    tracks: [...clip.tracks.filter(track => !replacements.has(`${track.target}:${track.kind}`)), ...tracks],
    markers: clip.id === 'player.double-jump' ? [
      { id: `${clip.id}:reach`, time: .12, name: 'Second pop; arms opening' },
      { id: `${clip.id}:apex`, time: .5, name: 'Compact apex tuck' },
      { id: `${clip.id}:catch`, time: .78, name: 'Unfold for landing' },
    ] : clip.markers,
    tags: [...(clip.tags ?? []).filter(tag => clip.id !== 'player.double-jump' || !['split', 'high-jump'].includes(tag)), 'trail-gather-float'],
    metadata: { ...clip.metadata, jumpReferenceRevision: JUMP_REFERENCE_REVISION,
      ...(clip.id === 'player.double-jump' ? { poseIntent: 'second pop reuses trailing arms and broad asymmetric tuck; arms lift during descent' } : {}),
      referenceStudy: 'Jak motion timing and pose principles; original authored rig-local curves',
    },
  };
}
