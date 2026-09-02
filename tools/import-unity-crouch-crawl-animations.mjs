#!/usr/bin/env node

import { createHash } from 'node:crypto';
import { readFile, writeFile } from 'node:fs/promises';
import { basename, relative, resolve, sep } from 'node:path';
import * as THREE from 'three';

const SAMPLE_RATE = 60;
const MAX_QUATERNION_ERROR_DEGREES = 0.5;
const MAX_QUATERNION_ERROR_RADIANS = THREE.MathUtils.degToRad(
  MAX_QUATERNION_ERROR_DEGREES,
);
const MAX_HIPS_POSITION_ERROR = 0.0005;
const UNITY_CROUCH_CRAWL_FLOOR_LIFT = 0.225;
const CRAWL_OUTPUT_FRAMES = 60;
const CRAWL_HALF_FRAMES = CRAWL_OUTPUT_FRAMES / 2;
const CRAWL_LOOP_OVERLAP_FRAMES = 6;
const EPSILON = 1e-8;

const BIND_ASSET =
  'Assets/Game/Art/Characters/PunkyFox/Generated/PunkyFox_Idle.anim';

const CLIP_SPECS = Object.freeze({
  crouchIdle: {
    sourceName: 'CrouchLookAroundBow',
    sourceAsset:
      'Assets/Game/Art/Characters/PunkyFox/Generated/Animations/PunkyFox_CrouchLookAroundBow.anim',
    sourceFbx:
      'Assets/MeshyImports/Meshy_AI_Punky_Fox_Pop_biped_Animation_CrouchLookAroundBow_frame_rate_60_20260818_200713/local_export_20260818_200713_49d11e09e9894a1aa94083e1ca224554.fbx',
    symbol: 'UNITY_CROUCH_IDLE',
    expectedDuration: 350 / SAMPLE_RATE,
    productionSourceWindow: { start: 0, end: 350 / SAMPLE_RATE },
    productionPostProcess: 'full source loop; constant imported scale curves removed',
  },
  crawl: {
    sourceName: 'Crawl and Look Back',
    sourceAsset:
      'Assets/Game/Art/Characters/PunkyFox/Generated/Animations/PunkyFox_Crawl_and_Look_Back.anim',
    sourceFbx:
      'Assets/MeshyImports/Meshy_AI_Punky_Fox_Pop_biped_Animation_Crawl_and_Look_Back_frame_rate_60_20260817_143437/local_export_20260817_143437_a30d5f24fd29494692ab6a75365c96f7.fbx',
    symbol: 'UNITY_CRAWL',
    expectedDuration: 52 / SAMPLE_RATE,
    outputDuration: CRAWL_OUTPUT_FRAMES / SAMPLE_RATE,
    productionSourceWindow: { start: 219 / SAMPLE_RATE, end: 271 / SAMPLE_RATE },
    productionPostProcess:
      'frames 219-271 retimed as one half-cycle plus an X-mirrored opposite half; six-frame internal/outer cyclic overlaps reproduce Unity Loop Pose',
  },
});

// The generated PunkyFox clips are remapped onto these stable paths. The
// target order is the browser rig's conventional 22-joint humanoid chain.
const PLAYER_HIERARCHY = Object.freeze([
  ['hips', null, 'Armature/Hips'],
  ['torsoRoot', 'hips', 'Armature/Hips/Spine02'],
  ['spine', 'torsoRoot', 'Armature/Hips/Spine02/Spine01'],
  ['chest', 'spine', 'Armature/Hips/Spine02/Spine01/Spine'],
  ['neck', 'chest', 'Armature/Hips/Spine02/Spine01/Spine/neck'],
  ['head', 'neck', 'Armature/Hips/Spine02/Spine01/Spine/neck/Head'],
  ['clavicleLeft', 'chest', 'Armature/Hips/Spine02/Spine01/Spine/LeftShoulder'],
  ['shoulderLeft', 'clavicleLeft', 'Armature/Hips/Spine02/Spine01/Spine/LeftShoulder/LeftArm'],
  ['elbowLeft', 'shoulderLeft', 'Armature/Hips/Spine02/Spine01/Spine/LeftShoulder/LeftArm/LeftForeArm'],
  ['wristLeft', 'elbowLeft', 'Armature/Hips/Spine02/Spine01/Spine/LeftShoulder/LeftArm/LeftForeArm/LeftHand'],
  ['clavicleRight', 'chest', 'Armature/Hips/Spine02/Spine01/Spine/RightShoulder'],
  ['shoulderRight', 'clavicleRight', 'Armature/Hips/Spine02/Spine01/Spine/RightShoulder/RightArm'],
  ['elbowRight', 'shoulderRight', 'Armature/Hips/Spine02/Spine01/Spine/RightShoulder/RightArm/RightForeArm'],
  ['wristRight', 'elbowRight', 'Armature/Hips/Spine02/Spine01/Spine/RightShoulder/RightArm/RightForeArm/RightHand'],
  ['hipLeft', 'hips', 'Armature/Hips/LeftUpLeg'],
  ['kneeLeft', 'hipLeft', 'Armature/Hips/LeftUpLeg/LeftLeg'],
  ['ankleLeft', 'kneeLeft', 'Armature/Hips/LeftUpLeg/LeftLeg/LeftFoot'],
  ['toeLeft', 'ankleLeft', 'Armature/Hips/LeftUpLeg/LeftLeg/LeftFoot/LeftToeBase'],
  ['hipRight', 'hips', 'Armature/Hips/RightUpLeg'],
  ['kneeRight', 'hipRight', 'Armature/Hips/RightUpLeg/RightLeg'],
  ['ankleRight', 'kneeRight', 'Armature/Hips/RightUpLeg/RightLeg/RightFoot'],
  ['toeRight', 'ankleRight', 'Armature/Hips/RightUpLeg/RightLeg/RightFoot/RightToeBase'],
]);

function parseArguments(argv) {
  const values = new Map();
  for (let index = 0; index < argv.length; index++) {
    const key = argv[index];
    if (!key.startsWith('--')) throw new Error(`unexpected positional argument: ${key}`);
    const value = argv[++index];
    if (!value || value.startsWith('--')) throw new Error(`missing value for ${key}`);
    values.set(key.slice(2), value);
  }
  const unityProject = values.get('unity-project');
  const output = values.get('output');
  if (!unityProject || !output) {
    throw new Error(
      'usage: node tools/import-unity-crouch-crawl-animations.mjs ' +
      '--unity-project <Board Platformer Unity> ' +
      '--output <src/animation/unityCrouchCrawlAnimations.generated.ts>',
    );
  }
  return { unityProject: resolve(unityProject), output: resolve(output) };
}

function normalizedPath(path) {
  return path.split(sep).join('/');
}

function finiteNumber(value, context) {
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) throw new Error(`${context} is not finite: ${value}`);
  return parsed;
}

function vector3(match, offset, context) {
  return new THREE.Vector3(
    finiteNumber(match[offset], `${context}.x`),
    finiteNumber(match[offset + 1], `${context}.y`),
    finiteNumber(match[offset + 2], `${context}.z`),
  );
}

function vector4(match, offset, context) {
  return new THREE.Vector4(
    finiteNumber(match[offset], `${context}.x`),
    finiteNumber(match[offset + 1], `${context}.y`),
    finiteNumber(match[offset + 2], `${context}.z`),
    finiteNumber(match[offset + 3], `${context}.w`),
  );
}

function parseRotationCurves(source, sourcePath) {
  const start = source.indexOf('  m_RotationCurves:');
  const end = source.indexOf('  m_CompressedRotationCurves:', start);
  if (start < 0 || end < 0) {
    throw new Error(`${sourcePath} does not contain readable rotation curves`);
  }
  const curves = new Map();
  const blocks = source.slice(start, end).split('\n  - curve:\n').slice(1);
  const keyPattern =
    /time: ([^\n]+)\n        value: \{x: ([^,]+), y: ([^,]+), z: ([^,]+), w: ([^}]+)\}\n        inSlope: \{x: ([^,]+), y: ([^,]+), z: ([^,]+), w: ([^}]+)\}\n        outSlope: \{x: ([^,]+), y: ([^,]+), z: ([^,]+), w: ([^}]+)\}/g;
  for (const block of blocks) {
    const path = block.match(/\n    path: ([^\n]+)/)?.[1]?.trim();
    if (!path) continue;
    const keys = [];
    for (const match of block.matchAll(keyPattern)) {
      keys.push({
        time: finiteNumber(match[1], `${sourcePath}:${path}.time`),
        value: vector4(match, 2, `${sourcePath}:${path}.value`),
        inSlope: vector4(match, 6, `${sourcePath}:${path}.inSlope`),
        outSlope: vector4(match, 10, `${sourcePath}:${path}.outSlope`),
      });
    }
    if (keys.length === 0) throw new Error(`${sourcePath}:${path} has no quaternion keys`);
    curves.set(path, keys);
  }
  return curves;
}

function parsePositionCurves(source, sourcePath) {
  const start = source.indexOf('  m_PositionCurves:');
  const end = source.indexOf('  m_ScaleCurves:', start);
  if (start < 0 || end < 0) {
    throw new Error(`${sourcePath} does not contain readable position curves`);
  }
  const curves = new Map();
  const blocks = source.slice(start, end).split('\n  - curve:\n').slice(1);
  const keyPattern =
    /time: ([^\n]+)\n        value: \{x: ([^,]+), y: ([^,]+), z: ([^}]+)\}\n        inSlope: \{x: ([^,]+), y: ([^,]+), z: ([^}]+)\}\n        outSlope: \{x: ([^,]+), y: ([^,]+), z: ([^}]+)\}/g;
  for (const block of blocks) {
    const path = block.match(/\n    path: ([^\n]+)/)?.[1]?.trim();
    if (!path) continue;
    const keys = [];
    for (const match of block.matchAll(keyPattern)) {
      keys.push({
        time: finiteNumber(match[1], `${sourcePath}:${path}.time`),
        value: vector3(match, 2, `${sourcePath}:${path}.value`),
        inSlope: vector3(match, 5, `${sourcePath}:${path}.inSlope`),
        outSlope: vector3(match, 8, `${sourcePath}:${path}.outSlope`),
      });
    }
    if (keys.length === 0) throw new Error(`${sourcePath}:${path} has no position keys`);
    curves.set(path, keys);
  }
  return curves;
}

function clipDuration(source, sourcePath) {
  const match = source.match(/\n    m_StopTime: ([^\n]+)/);
  if (!match) throw new Error(`${sourcePath} has no m_StopTime`);
  return finiteNumber(match[1], `${sourcePath}.m_StopTime`);
}

function clipSampleRate(source, sourcePath) {
  const match = source.match(/\n  m_SampleRate: ([^\n]+)/);
  if (!match) throw new Error(`${sourcePath} has no m_SampleRate`);
  return finiteNumber(match[1], `${sourcePath}.m_SampleRate`);
}

function hermite(a, b, alpha, duration, component) {
  const u2 = alpha * alpha;
  const u3 = u2 * alpha;
  const h00 = 2 * u3 - 3 * u2 + 1;
  const h10 = u3 - 2 * u2 + alpha;
  const h01 = -2 * u3 + 3 * u2;
  const h11 = u3 - u2;
  return h00 * a.value.getComponent(component) +
    h10 * duration * a.outSlope.getComponent(component) +
    h01 * b.value.getComponent(component) +
    h11 * duration * b.inSlope.getComponent(component);
}

function evaluateCurve(keys, time, dimensions) {
  if (time <= keys[0].time + EPSILON) return keys[0].value.clone();
  const final = keys[keys.length - 1];
  if (time >= final.time - EPSILON) return final.value.clone();
  let upper = 1;
  while (keys[upper].time < time) upper++;
  const a = keys[upper - 1];
  const b = keys[upper];
  const duration = b.time - a.time;
  if (duration <= EPSILON) return b.value.clone();
  const alpha = THREE.MathUtils.clamp((time - a.time) / duration, 0, 1);
  const result = dimensions === 4 ? new THREE.Vector4() : new THREE.Vector3();
  for (let component = 0; component < dimensions; component++) {
    result.setComponent(component, hermite(a, b, alpha, duration, component));
  }
  return result;
}

function evaluateQuaternion(keys, time) {
  const value = evaluateCurve(keys, time, 4);
  return new THREE.Quaternion(value.x, value.y, value.z, value.w).normalize();
}

function evaluatePosition(keys, time) {
  return evaluateCurve(keys, time, 3);
}

function sourcePathOrder(curves) {
  return [...curves.keys()].sort((a, b) => {
    const depth = a.split('/').length - b.split('/').length;
    return depth || a.localeCompare(b);
  });
}

function sourceWorldQuaternions(curves, fallbackCurves, paths, time) {
  const result = new Map();
  for (const path of paths) {
    const localKeys = curves.get(path) ?? fallbackCurves.get(path);
    if (!localKeys) throw new Error(`source hierarchy is missing ${path}`);
    const local = evaluateQuaternion(localKeys, time);
    const slash = path.lastIndexOf('/');
    const parent = slash >= 0 ? result.get(path.slice(0, slash)) : undefined;
    result.set(path, parent ? parent.clone().multiply(local).normalize() : local);
  }
  return result;
}

function playerCanonicalWorldQuaternions() {
  const result = new Map();
  for (const [joint, parent] of PLAYER_HIERARCHY) {
    const local = new THREE.Quaternion();
    if (joint === 'shoulderLeft') {
      local.set(0, 0, Math.SQRT1_2, Math.SQRT1_2);
    } else if (joint === 'shoulderRight') {
      local.set(0, 0, -Math.SQRT1_2, Math.SQRT1_2);
    }
    result.set(joint, parent ? result.get(parent).clone().multiply(local) : local);
  }
  return result;
}

function retargetRotations(
  clipRotations,
  bindRotations,
  paths,
  bindWorld,
  canonicalWorld,
  sourceTime,
) {
  const currentWorld = sourceWorldQuaternions(
    clipRotations,
    bindRotations,
    paths,
    sourceTime,
  );
  const desiredWorld = new Map();
  const desiredLocal = new Map();
  for (const [joint, parent, sourcePath] of PLAYER_HIERARCHY) {
    const current = currentWorld.get(sourcePath);
    const rest = bindWorld.get(sourcePath);
    if (!current || !rest) throw new Error(`cannot retarget missing source joint ${sourcePath}`);
    const world = current.clone()
      .multiply(rest.clone().invert())
      .multiply(canonicalWorld.get(joint))
      .normalize();
    const local = parent
      ? desiredWorld.get(parent).clone().invert().multiply(world).normalize()
      : world.clone();
    desiredWorld.set(joint, world);
    desiredLocal.set(joint, local);
  }
  return desiredLocal;
}

function sourceHipsWorldPosition(rotationCurves, positionCurves, bindRotations, bindPositions, time) {
  const armatureRotation = evaluateQuaternion(
    rotationCurves.get('Armature') ?? bindRotations.get('Armature'),
    time,
  );
  const armaturePosition = evaluatePosition(
    positionCurves.get('Armature') ?? bindPositions.get('Armature'),
    time,
  );
  const hipsPosition = evaluatePosition(
    positionCurves.get('Armature/Hips') ?? bindPositions.get('Armature/Hips'),
    time,
  );
  return hipsPosition.applyQuaternion(armatureRotation).add(armaturePosition);
}

function sampleTimes(duration) {
  const intervals = Math.max(1, Math.round(duration * SAMPLE_RATE));
  return Array.from(
    { length: intervals + 1 },
    (_, index) => index === intervals ? duration : index / SAMPLE_RATE,
  );
}

function continuousQuaternion(previous, current) {
  if (previous && previous.dot(current) < 0) {
    current.set(-current.x, -current.y, -current.z, -current.w);
  }
  return current.normalize();
}

function sampleRetargetedClip(
  clip,
  bindRotations,
  bindPositions,
  paths,
  bindWorld,
  bindHipsWorld,
  canonicalWorld,
  forceEndpointClosure = true,
) {
  const duration = Math.round(clip.duration * SAMPLE_RATE) / SAMPLE_RATE;
  const times = sampleTimes(duration);
  const rotations = new Map(PLAYER_HIERARCHY.map(([joint]) => [joint, []]));
  const previous = new Map();
  const hipsPositions = [];
  for (const time of times) {
    const pose = retargetRotations(
      clip.rotations,
      bindRotations,
      paths,
      bindWorld,
      canonicalWorld,
      time,
    );
    for (const [joint, quaternion] of pose) {
      continuousQuaternion(previous.get(joint), quaternion);
      previous.set(joint, quaternion.clone());
      rotations.get(joint).push(quaternion);
    }
    hipsPositions.push(
      sourceHipsWorldPosition(
        clip.rotations,
        clip.positions,
        bindRotations,
        bindPositions,
        time,
      ).sub(bindHipsWorld),
    );
  }
  if (forceEndpointClosure) {
    // The complete crouch source is already cyclic; remove exporter epsilon.
    hipsPositions[hipsPositions.length - 1] = hipsPositions[0].clone();
    for (const values of rotations.values()) values[values.length - 1] = values[0].clone();
  }
  return { duration, times, rotations, hipsPositions };
}

function quaternionStepMismatch(values) {
  const end = values.length - 1;
  if (end < 2) return 0;
  const startStep = values[0].clone().invert().multiply(values[1]).normalize();
  const endStep = values[end - 1].clone().invert().multiply(values[end]).normalize();
  return startStep.angleTo(endStep);
}

function loopMetrics(sampled) {
  let poseSquared = 0;
  let velocitySquared = 0;
  let count = 0;
  for (const values of sampled.rotations.values()) {
    poseSquared += values[0].angleTo(values[values.length - 1]) ** 2;
    velocitySquared += quaternionStepMismatch(values) ** 2;
    count++;
  }
  const dt = sampled.duration / (sampled.times.length - 1);
  const positionStartVelocity = sampled.hipsPositions[1].clone()
    .sub(sampled.hipsPositions[0])
    .divideScalar(dt);
  const end = sampled.hipsPositions.length - 1;
  const positionEndVelocity = sampled.hipsPositions[end].clone()
    .sub(sampled.hipsPositions[end - 1])
    .divideScalar(dt);
  return {
    poseGapRadiansRms: Math.sqrt(poseSquared / Math.max(1, count)),
    velocityGapRadiansRms: Math.sqrt(velocitySquared / Math.max(1, count)),
    hipsVelocityGap: positionStartVelocity.distanceTo(positionEndVelocity),
  };
}

function overlapQuaternionSeam(values, overlapFrames) {
  const end = values.length - 1;
  const overlap = Math.max(1, Math.min(overlapFrames, Math.floor(end / 4)));
  const tail = values[end - overlap].clone();
  const head = values[overlap].clone();
  if (tail.dot(head) < 0) head.set(-head.x, -head.y, -head.z, -head.w);
  for (let offset = -overlap; offset <= overlap; offset++) {
    const index = offset < 0 ? end + offset : offset;
    values[index].copy(tail).slerp(head, (offset + overlap) / (overlap * 2));
  }
  values[end].copy(values[0]);
}

function overlapPositionSeam(values, overlapFrames) {
  const end = values.length - 1;
  const overlap = Math.max(1, Math.min(overlapFrames, Math.floor(end / 4)));
  const tail = values[end - overlap].clone();
  const head = values[overlap].clone();
  for (let offset = -overlap; offset <= overlap; offset++) {
    const index = offset < 0 ? end + offset : offset;
    values[index].copy(tail).lerp(head, (offset + overlap) / (overlap * 2));
  }
  values[end].copy(values[0]);
}

const CRAWL_MIRROR_JOINT = new Map([
  ['clavicleLeft', 'clavicleRight'], ['clavicleRight', 'clavicleLeft'],
  ['shoulderLeft', 'shoulderRight'], ['shoulderRight', 'shoulderLeft'],
  ['elbowLeft', 'elbowRight'], ['elbowRight', 'elbowLeft'],
  ['wristLeft', 'wristRight'], ['wristRight', 'wristLeft'],
  ['hipLeft', 'hipRight'], ['hipRight', 'hipLeft'],
  ['kneeLeft', 'kneeRight'], ['kneeRight', 'kneeLeft'],
  ['ankleLeft', 'ankleRight'], ['ankleRight', 'ankleLeft'],
  ['toeLeft', 'toeRight'], ['toeRight', 'toeLeft'],
]);

function sampleQuaternionValues(values, alpha) {
  const clock = THREE.MathUtils.clamp(alpha, 0, 1) * (values.length - 1);
  const start = Math.floor(clock);
  const end = Math.min(values.length - 1, start + 1);
  return values[start].clone().slerp(values[end], clock - start).normalize();
}

function samplePositionValues(values, alpha) {
  const clock = THREE.MathUtils.clamp(alpha, 0, 1) * (values.length - 1);
  const start = Math.floor(clock);
  const end = Math.min(values.length - 1, start + 1);
  return values[start].clone().lerp(values[end], clock - start);
}

function mirrorQuaternionX(value) {
  return new THREE.Quaternion(value.x, -value.y, -value.z, value.w).normalize();
}

function overlapQuaternionAt(values, seam, overlapFrames) {
  const overlap = Math.max(1, Math.min(overlapFrames, seam, values.length - 1 - seam));
  const tail = values[seam - overlap].clone();
  const head = values[seam + overlap].clone();
  if (tail.dot(head) < 0) head.set(-head.x, -head.y, -head.z, -head.w);
  for (let index = seam - overlap; index <= seam + overlap; index++) {
    values[index].copy(tail).slerp(head, (index - seam + overlap) / (overlap * 2));
  }
}

function overlapPositionAt(values, seam, overlapFrames) {
  const overlap = Math.max(1, Math.min(overlapFrames, seam, values.length - 1 - seam));
  const tail = values[seam - overlap].clone();
  const head = values[seam + overlap].clone();
  for (let index = seam - overlap; index <= seam + overlap; index++) {
    values[index].copy(tail).lerp(head, (index - seam + overlap) / (overlap * 2));
  }
}

function synthesizeAlternatingCrawlLoop(sampled) {
  const rawLoopMetrics = loopMetrics(sampled);
  const duration = CRAWL_OUTPUT_FRAMES / SAMPLE_RATE;
  const times = sampleTimes(duration);
  const rotations = new Map();
  for (const [joint] of PLAYER_HIERARCHY) {
    const values = [];
    for (let frame = 0; frame < CRAWL_OUTPUT_FRAMES; frame++) {
      const mirrored = frame >= CRAWL_HALF_FRAMES;
      const halfFrame = frame % CRAWL_HALF_FRAMES;
      const sourceJoint = mirrored ? (CRAWL_MIRROR_JOINT.get(joint) ?? joint) : joint;
      let value = sampleQuaternionValues(
        sampled.rotations.get(sourceJoint),
        halfFrame / CRAWL_HALF_FRAMES,
      );
      if (mirrored) value = mirrorQuaternionX(value);
      values.push(value);
    }
    values.push(values[0].clone());
    overlapQuaternionAt(values, CRAWL_HALF_FRAMES, CRAWL_LOOP_OVERLAP_FRAMES);
    overlapQuaternionSeam(values, CRAWL_LOOP_OVERLAP_FRAMES);
    rotations.set(joint, values);
  }
  const hipsPositions = [];
  for (let frame = 0; frame < CRAWL_OUTPUT_FRAMES; frame++) {
    const mirrored = frame >= CRAWL_HALF_FRAMES;
    const halfFrame = frame % CRAWL_HALF_FRAMES;
    const value = samplePositionValues(
      sampled.hipsPositions,
      halfFrame / CRAWL_HALF_FRAMES,
    );
    if (mirrored) value.x = -value.x;
    hipsPositions.push(value);
  }
  hipsPositions.push(hipsPositions[0].clone());
  overlapPositionAt(hipsPositions, CRAWL_HALF_FRAMES, CRAWL_LOOP_OVERLAP_FRAMES);
  overlapPositionSeam(hipsPositions, CRAWL_LOOP_OVERLAP_FRAMES);
  const result = { duration, times, rotations, hipsPositions };
  return {
    ...result,
    rawLoopMetrics,
    closedLoopMetrics: loopMetrics(result),
  };
}

function simplifyTrack(times, values, errorAt) {
  const keep = new Set([0, values.length - 1]);
  const recurse = (start, end) => {
    if (end - start <= 1) return;
    const duration = times[end] - times[start];
    let maximumError = -1;
    let maximumIndex = -1;
    for (let index = start + 1; index < end; index++) {
      const alpha = duration <= EPSILON ? 0 : (times[index] - times[start]) / duration;
      const error = errorAt(values[start], values[end], values[index], alpha);
      if (error > maximumError) {
        maximumError = error;
        maximumIndex = index;
      }
    }
    const tolerance = values[0].isQuaternion
      ? MAX_QUATERNION_ERROR_RADIANS
      : MAX_HIPS_POSITION_ERROR;
    if (maximumError <= tolerance || maximumIndex < 0) return;
    keep.add(maximumIndex);
    recurse(start, maximumIndex);
    recurse(maximumIndex, end);
  };
  recurse(0, values.length - 1);
  return [...keep].sort((a, b) => a - b);
}

function quaternionError(from, to, actual, alpha) {
  return from.clone().slerp(to, alpha).normalize().angleTo(actual);
}

function positionError(from, to, actual, alpha) {
  return from.clone().lerp(to, alpha).distanceTo(actual);
}

function maximumReducedError(times, values, indices, errorAt) {
  let maximum = 0;
  for (let segment = 1; segment < indices.length; segment++) {
    const start = indices[segment - 1];
    const end = indices[segment];
    const duration = times[end] - times[start];
    for (let index = start + 1; index < end; index++) {
      const alpha = duration <= EPSILON ? 0 : (times[index] - times[start]) / duration;
      maximum = Math.max(
        maximum,
        errorAt(values[start], values[end], values[index], alpha),
      );
    }
  }
  return maximum;
}

function reduceClip(sampled) {
  const reducedRotations = new Map();
  let reducedQuaternionKeyCount = 0;
  let maximumQuaternionError = 0;
  for (const [joint, values] of sampled.rotations) {
    const indices = simplifyTrack(sampled.times, values, quaternionError);
    maximumQuaternionError = Math.max(
      maximumQuaternionError,
      maximumReducedError(sampled.times, values, indices, quaternionError),
    );
    reducedRotations.set(joint, indices.map((index) => ({
      time: sampled.times[index],
      value: values[index],
    })));
    reducedQuaternionKeyCount += indices.length;
  }
  const hipsIndices = simplifyTrack(sampled.times, sampled.hipsPositions, positionError);
  const maximumPositionError = maximumReducedError(
    sampled.times,
    sampled.hipsPositions,
    hipsIndices,
    positionError,
  );
  const reducedHipsPositions = hipsIndices.map((index) => ({
    time: sampled.times[index],
    value: sampled.hipsPositions[index],
  }));
  return {
    ...sampled,
    reducedRotations,
    reducedHipsPositions,
    reducedQuaternionKeyCount,
    maximumQuaternionError,
    maximumPositionError,
  };
}

function rounded(value) {
  const nearestInteger = Math.round(value);
  const stable = Math.abs(value - nearestInteger) < 1e-7 ? nearestInteger : value;
  const result = Number(stable.toFixed(7));
  return Object.is(result, -0) ? 0 : result;
}

function tupleLine(key) {
  return `    [${rounded(key.time)}, [${key.value.toArray().map(rounded).join(', ')}]],`;
}

function positionKeysSource(symbol, keys) {
  return `export const ${symbol}_HIPS_POSITION_KEYS = [\n${keys.map(tupleLine).join('\n')}\n] as const;`;
}

function rotationKeysSource(symbol, tracks) {
  const body = PLAYER_HIERARCHY.map(([joint]) => [
    `  ${joint}: [`,
    ...tracks.get(joint).map(tupleLine),
    '  ],',
  ].join('\n')).join('\n');
  return `export const ${symbol}_ROTATION_KEYS = {\n${body}\n} as const;`;
}

async function sha256(path) {
  return createHash('sha256').update(await readFile(path)).digest('hex');
}

function stableJson(value) {
  if (Array.isArray(value)) return `[${value.map(stableJson).join(',')}]`;
  if (value && typeof value === 'object') {
    return `{${Object.keys(value).sort().map((key) =>
      `${JSON.stringify(key)}:${stableJson(value[key])}`).join(',')}}`;
  }
  return JSON.stringify(value);
}

function sourceModule(metadata, results) {
  const blocks = Object.entries(CLIP_SPECS).flatMap(([id, spec]) => {
    const result = results.get(id);
    return [
      `export const ${spec.symbol}_DURATION = ${rounded(result.duration)};`,
      positionKeysSource(spec.symbol, result.reducedHipsPositions),
      rotationKeysSource(spec.symbol, result.reducedRotations),
    ];
  });
  return `// Generated by tools/import-unity-crouch-crawl-animations.mjs.
// Source motion is user-supplied Unity/Meshy animation evidence. Do not hand-edit
// sampled values; resulting catalog clips remain editable in Animation Studio.

export const UNITY_CROUCH_CRAWL_ANIMATION_SOURCE = Object.freeze(${JSON.stringify(metadata, null, 2)} as const);

${blocks.join('\n\n')}
`;
}

async function loadClip(unityProject, spec) {
  const sourcePath = resolve(unityProject, spec.sourceAsset);
  const source = await readFile(sourcePath, 'utf8');
  const sampleRate = clipSampleRate(source, sourcePath);
  if (Math.abs(sampleRate - SAMPLE_RATE) > EPSILON) {
    throw new Error(`${sourcePath} is ${sampleRate} FPS; expected ${SAMPLE_RATE}`);
  }
  const duration = Math.round(clipDuration(source, sourcePath) * SAMPLE_RATE) / SAMPLE_RATE;
  if (Math.abs(duration - spec.expectedDuration) > 1 / (SAMPLE_RATE * 2)) {
    throw new Error(
      `${sourcePath} duration ${duration} does not match production duration ` +
      `${spec.expectedDuration}`,
    );
  }
  return {
    sourcePath,
    rotations: parseRotationCurves(source, sourcePath),
    positions: parsePositionCurves(source, sourcePath),
    duration,
  };
}

async function main() {
  const args = parseArguments(process.argv.slice(2));
  const bindPath = resolve(args.unityProject, BIND_ASSET);
  const bindSource = await readFile(bindPath, 'utf8');
  const bindRotations = parseRotationCurves(bindSource, bindPath);
  const bindPositions = parsePositionCurves(bindSource, bindPath);
  const paths = sourcePathOrder(bindRotations);
  const bindWorld = sourceWorldQuaternions(
    bindRotations,
    bindRotations,
    paths,
    0,
  );
  const bindHipsWorld = sourceHipsWorldPosition(
    bindRotations,
    bindPositions,
    bindRotations,
    bindPositions,
    0,
  );
  const canonicalWorld = playerCanonicalWorldQuaternions();
  for (const [, , sourcePath] of PLAYER_HIERARCHY) {
    if (!bindWorld.has(sourcePath)) {
      throw new Error(`${bindPath} is missing mapped source joint ${sourcePath}`);
    }
  }

  const results = new Map();
  const metadataClips = {};
  for (const [id, spec] of Object.entries(CLIP_SPECS)) {
    const clip = await loadClip(args.unityProject, spec);
    const sourceSamples = sampleRetargetedClip(
      clip,
      bindRotations,
      bindPositions,
      paths,
      bindWorld,
      bindHipsWorld,
      canonicalWorld,
      id !== 'crawl',
    );
    const sampled = id === 'crawl'
      ? synthesizeAlternatingCrawlLoop(sourceSamples)
      : sourceSamples;
    const reduced = reduceClip(sampled);
    if (reduced.maximumQuaternionError > MAX_QUATERNION_ERROR_RADIANS + 1e-7) {
      throw new Error(`${spec.sourceName} quaternion reduction exceeded tolerance`);
    }
    if (reduced.maximumPositionError > MAX_HIPS_POSITION_ERROR + 1e-8) {
      throw new Error(`${spec.sourceName} hips-position reduction exceeded tolerance`);
    }
    results.set(id, reduced);
    const sourceAssetPath = resolve(args.unityProject, spec.sourceAsset);
    const sourceFbxPath = resolve(args.unityProject, spec.sourceFbx);
    metadataClips[id] = {
      sourceName: spec.sourceName,
      sourceAsset: normalizedPath(relative(args.unityProject, sourceAssetPath)),
      sourceAssetSha256: await sha256(sourceAssetPath),
      sourceFbx: normalizedPath(relative(args.unityProject, sourceFbxPath)),
      sourceFbxSha256: await sha256(sourceFbxPath),
      samplingSource: normalizedPath(relative(args.unityProject, clip.sourcePath)),
      sourceDuration: rounded(clip.duration),
      productionSourceWindow: {
        start: rounded(spec.productionSourceWindow.start),
        end: rounded(spec.productionSourceWindow.end),
      },
      productionPostProcess: spec.productionPostProcess,
      outputDuration: rounded(reduced.duration),
      loop: true,
      sourceFrameCount: reduced.times.length,
      reducedQuaternionKeyCount: reduced.reducedQuaternionKeyCount,
      reducedHipsPositionKeyCount: reduced.reducedHipsPositions.length,
      maximumObservedQuaternionErrorDegrees: rounded(
        THREE.MathUtils.radToDeg(reduced.maximumQuaternionError),
      ),
      maximumObservedHipsPositionError: rounded(reduced.maximumPositionError),
      ...(sampled.rawLoopMetrics ? {
        rawLoopPoseGapDegreesRms: rounded(
          THREE.MathUtils.radToDeg(sampled.rawLoopMetrics.poseGapRadiansRms),
        ),
        rawLoopVelocityGapDegreesPerFrameRms: rounded(
          THREE.MathUtils.radToDeg(sampled.rawLoopMetrics.velocityGapRadiansRms),
        ),
        rawLoopHipsVelocityGap: rounded(sampled.rawLoopMetrics.hipsVelocityGap),
        closedLoopVelocityGapDegreesPerFrameRms: rounded(
          THREE.MathUtils.radToDeg(sampled.closedLoopMetrics.velocityGapRadiansRms),
        ),
        closedLoopHipsVelocityGap: rounded(sampled.closedLoopMetrics.hipsVelocityGap),
      } : {}),
    };
  }

  const semanticMap = Object.fromEntries(
    PLAYER_HIERARCHY.map(([joint, , sourcePath]) => [sourcePath, joint]),
  );
  const metadata = {
    source: 'Unity PunkyFox generated animation catalog',
    unityProjectName: basename(args.unityProject),
    bindAsset: BIND_ASSET,
    bindAssetSha256: await sha256(bindPath),
    sampleRate: SAMPLE_RATE,
    maximumQuaternionErrorDegrees: MAX_QUATERNION_ERROR_DEGREES,
    maximumHipsPositionError: MAX_HIPS_POSITION_ERROR,
    conversion:
      'Unity bind-world delta to player canonical-world/rest-local; component Hermite source sampling',
    translationPolicy:
      'retain only Armature/Hips world-position delta from PunkyFox_Idle bind; omit all per-bone translations and gameplay root motion',
    positionSpace:
      'PunkyFox model-local after the Armature basis; +Y is vertical and values are unscaled source model units',
    unityModelPresentationScale: 1.5,
    loopPolicy:
      'crouch exact closure; crawl X-mirrored half-cycle synthesis with six-frame internal and outer cyclic overlaps',
    unityFloorCorrection: {
      stanceRootLiftMetres: UNITY_CROUCH_CRAWL_FLOOR_LIFT,
      includedInHipsPositionKeys: false,
      policy:
        'Unity applies +0.225 m after animation and blends it by the crouch/crawl pose-transition weight',
    },
    semanticMap,
    clips: metadataClips,
  };
  metadata.canonicalMetadataHash = createHash('sha256')
    .update(stableJson(metadata))
    .digest('hex');

  await writeFile(args.output, sourceModule(metadata, results), 'utf8');
  for (const [id, result] of results) {
    console.log(
      `${id}: ${result.times.length} source samples -> ` +
      `${result.reducedQuaternionKeyCount} quaternion keys across ` +
      `${result.reducedRotations.size} joints + ` +
      `${result.reducedHipsPositions.length} hips-position keys; max errors ` +
      `${THREE.MathUtils.radToDeg(result.maximumQuaternionError).toFixed(4)} degrees, ` +
      `${result.maximumPositionError.toFixed(6)} units`,
    );
  }
  console.log(`Wrote ${args.output}`);
}

await main();
