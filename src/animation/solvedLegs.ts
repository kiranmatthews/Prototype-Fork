import * as THREE from 'three';
import type { AnimationClip, AnimationTrack, QuaternionTuple, Vec3Tuple } from './types';

/**
 * LEGS THAT ARE SOLVED, NOT POSED. A clip that has to keep a sole on the floor
 * (a slide, a glide, a foot that will not come unstuck) gives each sole a path
 * and has the hip, knee and ankle that put it there worked out when the clip is
 * built. The results are stored as ordinary keys, which the Studio can edit.
 * Hand-set joint angles cannot hold two feet at one height through a stride.
 */

/** The procedural rider's leg, in the pelvis's own units: hip to knee, knee to ankle, each hip joint's distance
 * out from the middle of the pelvis, and his shoe as it is drawn at the default proportions (the ankle joint
 * carries a scale of 1.53: big shoes): the ankle's height over the sole's underside, and how far ahead of the
 * ankle the shoe turns on its toe when the heel comes up, and behind it on its heel when the toe does.
 * A flat shoe does not depend on these (the seat stands him on whichever sole is lowest); a turned one does. */
export const LEG = { thigh: 0.335, shin: 0.3528, out: 0.107, sole: 0.0765, toe: 0.29, heel: 0.095 };
export const STRAIGHT = LEG.thigh + LEG.shin;

export interface Pelvis { x: number; drop: number; pitch: number; yaw: number; roll: number }
export interface Foot { side: number; fore: number; lift: number; toeOut: number; heel: number }

/**
 * The hip, knee and ankle turns that put one sole where it is asked for. `side` is 1 for the left leg, -1 for
 * the right. A foot is given by how far out from under its hip (`side`, in the rig's units), how far forward
 * (`fore`), how far up off the floor (`lift`), how far its toes are turned out (`toeOut`, radians) and how far
 * its heel is raised (`heel`, radians). The pelvis is `drop` lower than a straight-legged stand.
 */
export function solveLeg(sign: number, pelvis: Pelvis, foot: Foot, shin = 1): { hip: QuaternionTuple; knee: QuaternionTuple; ankle: QuaternionTuple } {
  // (`shin` is the lower leg's length just then, as a share of its own: a clip that stretches a leg solves for the stretched one)
  const lower = LEG.shin * shin, straight = LEG.thigh + lower;
  const turn = new THREE.Quaternion().setFromEuler(new THREE.Euler(pelvis.pitch, pelvis.yaw, pelvis.roll, 'XYZ'));
  // Everything below is measured from the floor under the middle of a level, unshifted pelvis.
  const socket = new THREE.Vector3(sign * LEG.out, 0, 0).applyQuaternion(turn).add(new THREE.Vector3(pelvis.x, STRAIGHT + LEG.sole - pelvis.drop, 0));
  const ankle = new THREE.Vector3(sign * (LEG.out + foot.side), LEG.sole + foot.lift, foot.fore);
  // A raised heel turns the shoe about its toe, and a raised toe about its heel: whichever is down stays where
  // the sole was asked to be, and the ankle goes where that puts it.
  const pivot = foot.heel >= 0 ? LEG.toe : -LEG.heel;
  ankle.y += LEG.sole * Math.cos(foot.heel) + pivot * Math.sin(foot.heel) - LEG.sole;
  ankle.z += LEG.sole * Math.sin(foot.heel) - pivot * Math.cos(foot.heel) + pivot;
  const reach = ankle.sub(socket).applyQuaternion(turn.clone().invert());
  const most = straight * 0.9985;
  if (reach.length() > most) reach.setLength(most); // never asked to lock a knee out
  const r2 = reach.lengthSq();
  const bend = Math.acos(THREE.MathUtils.clamp((r2 - LEG.thigh ** 2 - lower ** 2) / (2 * LEG.thigh * lower), -1, 1));
  const m = LEG.thigh + lower * Math.cos(bend), n = lower * Math.sin(bend);
  const spread = Math.asin(THREE.MathUtils.clamp(reach.x / m, -1, 1));
  const flex = Math.atan2(reach.z, reach.y) - Math.atan2(-n, -m * Math.cos(spread));
  const hip = new THREE.Quaternion().setFromEuler(new THREE.Euler(flex, 0, spread, 'XYZ'));
  const knee = new THREE.Quaternion().setFromEuler(new THREE.Euler(bend, 0, 0, 'XYZ'));
  // The shoe is flat on the floor and turned out, whatever the leg above it is doing.
  const flat = new THREE.Quaternion().setFromEuler(new THREE.Euler(foot.heel, sign * foot.toeOut, 0, 'YXZ'));
  const shoe = turn.clone().multiply(hip).multiply(knee).invert().multiply(flat);
  return { hip: hip.toArray() as QuaternionTuple, knee: knee.toArray() as QuaternionTuple, ankle: shoe.toArray() as QuaternionTuple };
}

export const ease = (t: number): number => { const c = THREE.MathUtils.clamp(t, 0, 1); return c * c * (3 - 2 * c); };
export const wave = (phase: number): number => Math.sin(phase * Math.PI * 2);

export interface SolvedTracks {
  clip: AnimationClip;
  times: number[];
  euler(joint: string, at: (phase: number) => Vec3Tuple): void;
  turns(joint: string, values: QuaternionTuple[]): void;
  offset(joint: string, at: (phase: number) => Vec3Tuple): void;
}

export function solvedTracks(clip: AnimationClip, beats: number): SolvedTracks {
  const phases = Array.from({ length: beats + 1 }, (_, i) => i / beats), times = phases.map(phase => phase * clip.duration);
  const turns = (joint: string, values: QuaternionTuple[]): void => {
    const id = `${clip.id}:${joint}:quaternion`;
    // (neighbouring keys are kept on the same side of the double cover, so the cubic between them is the short way)
    const keys = values.map(value => new THREE.Quaternion(...value));
    for (let i = 1; i < keys.length; i++) if (keys[i].dot(keys[i - 1]) < 0) keys[i].set(-keys[i].x, -keys[i].y, -keys[i].z, -keys[i].w);
    clip.tracks.push({ id, target: joint, kind: 'quaternion', keys: keys.map((value, i) => ({
      id: `${id}:${i}`, time: times[i], value: value.toArray() as QuaternionTuple, interpolation: 'cubic' })) });
  };
  return {
    clip, times, turns,
    euler: (joint, at) => turns(joint, phases.map(phase => new THREE.Quaternion().setFromEuler(new THREE.Euler(...at(phase % 1), 'XYZ')).toArray() as QuaternionTuple)),
    offset: (joint, at) => {
      const id = `${clip.id}:${joint}:position`;
      clip.tracks.push({ id, target: joint, kind: 'position', keys: phases.map((phase, i) => ({
        id: `${id}:${i}`, time: times[i], value: [...at(phase % 1)], interpolation: 'cubic' })) } as AnimationTrack);
    },
  };
}

