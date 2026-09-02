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
const CLIMB_LOOP_OVERLAP_SECONDS = 4 / SAMPLE_RATE;
const SWING_RELEASE_LEAD_IN_SECONDS = 34 / SAMPLE_RATE;
const BACKFLIP_RELEASE_LEAD_IN_SECONDS = 17 / SAMPLE_RATE;
const EPSILON = 1e-8;

const BIND_ASSET =
  'Assets/Game/Art/Characters/PunkyFox/Generated/PunkyFox_Idle.anim';

const CLIP_SPECS = Object.freeze({
  hang: {
    sourceName: 'Rope Hang Idle',
    sourceAsset:
      'Assets/Game/Art/Characters/PunkyFox/Generated/Animations/PunkyFox_Rope_Hang_Idle.anim',
    sourceFbx:
      'Assets/MeshyImports/Meshy_AI_Punky_Fox_Pop_biped_Animation_Rope_Hang_Idle_frame_rate_60_20260817_144808/local_export_20260817_144808_79cab7a2469342e79d4a5099cbc06127.fbx',
    symbol: 'UNITY_ROPE_HANG',
    loop: true,
    leadIn: 0,
    climbLoop: false,
  },
  climb: {
    sourceName: 'Climb Up Rope',
    sourceAsset:
      'Assets/Game/Art/Characters/PunkyFox/Generated/Animations/PunkyFox_Climb_Up_Rope.anim',
    sourceFbx:
      'Assets/MeshyImports/Meshy_AI_Punky_Fox_Pop_biped_Animation_Climb_Up_Rope_frame_rate_60_20260817_143110/local_export_20260817_143110_3f6e875818074917823e80993f2d7c5f.fbx',
    symbol: 'UNITY_ROPE_CLIMB',
    loop: true,
    leadIn: CLIMB_LOOP_OVERLAP_SECONDS,
    climbLoop: true,
  },
  releaseSwing: {
    sourceName: 'Swing on Rope to Ground',
    sourceAsset:
      'Assets/Game/Art/Characters/PunkyFox/Generated/Animations/PunkyFox_Swing_on_Rope_to_Ground.anim',
    sourceFbx:
      'Assets/MeshyImports/Meshy_AI_Punky_Fox_Pop_biped_Animation_Swing_on_Rope_to_Ground_frame_rate_60_20260817_145224/local_export_20260817_145224_ae202030b74b4dfda6c805c797c85a59.fbx',
    symbol: 'UNITY_ROPE_RELEASE_SWING',
    loop: false,
    leadIn: SWING_RELEASE_LEAD_IN_SECONDS,
    climbLoop: false,
  },
  releaseBackflip: {
    sourceName: 'Rope Hang Backflip to Crouch',
    sourceAsset:
      'Assets/Game/Art/Characters/PunkyFox/Generated/Animations/PunkyFox_Rope_Hang_Backflip_to_Crouch.anim',
    sourceFbx:
      'Assets/MeshyImports/Meshy_AI_Punky_Fox_Pop_biped_Animation_Rope_Hang_Backflip_to_Crouch_frame_rate_60_20260817_144725/local_export_20260817_144725_d5edcfdc7c994f25b12828eef9a0c7b0.fbx',
    symbol: 'UNITY_ROPE_RELEASE_BACKFLIP',
    loop: false,
    leadIn: BACKFLIP_RELEASE_LEAD_IN_SECONDS,
    climbLoop: false,
  },
});

// This is the same conventional target order used by the Quaternius importer.
// Source path names are the stable hierarchy produced by the Unity character
// asset builder after it remaps every Meshy clip onto PunkyFox.fbx.
const PLAYER_HIERARCHY = Object.freeze([
  ['hips', null, 'Armature/Hips'],
  ['torsoRoot', 'hips', 'Armature/Hips/Spine02'],
  ['spine', 'torsoRoot', 'Armature/Hips/Spine02/Spine01'],
  ['chest', 'spine', 'Armature/Hips/Spine02/Spine01/Spine'],
  ['neck', 'chest', 'Armature/Hips/Spine02/Spine01/Spine/neck'],
  ['head', 'neck', 'Armature/Hips/Spine02/Spine01/Spine/neck/Head'],
  [
    'clavicleLeft',
    'chest',
    'Armature/Hips/Spine02/Spine01/Spine/LeftShoulder',
  ],
  [
    'shoulderLeft',
    'clavicleLeft',
    'Armature/Hips/Spine02/Spine01/Spine/LeftShoulder/LeftArm',
  ],
  [
    'elbowLeft',
    'shoulderLeft',
    'Armature/Hips/Spine02/Spine01/Spine/LeftShoulder/LeftArm/LeftForeArm',
  ],
  [
    'wristLeft',
    'elbowLeft',
    'Armature/Hips/Spine02/Spine01/Spine/LeftShoulder/LeftArm/LeftForeArm/LeftHand',
  ],
  [
    'clavicleRight',
    'chest',
    'Armature/Hips/Spine02/Spine01/Spine/RightShoulder',
  ],
  [
    'shoulderRight',
    'clavicleRight',
    'Armature/Hips/Spine02/Spine01/Spine/RightShoulder/RightArm',
  ],
  [
    'elbowRight',
    'shoulderRight',
    'Armature/Hips/Spine02/Spine01/Spine/RightShoulder/RightArm/RightForeArm',
  ],
  [
    'wristRight',
    'elbowRight',
    'Armature/Hips/Spine02/Spine01/Spine/RightShoulder/RightArm/RightForeArm/RightHand',
  ],
  ['hipLeft', 'hips', 'Armature/Hips/LeftUpLeg'],
  ['kneeLeft', 'hipLeft', 'Armature/Hips/LeftUpLeg/LeftLeg'],
  ['ankleLeft', 'kneeLeft', 'Armature/Hips/LeftUpLeg/LeftLeg/LeftFoot'],
  [
    'toeLeft',
    'ankleLeft',
    'Armature/Hips/LeftUpLeg/LeftLeg/LeftFoot/LeftToeBase',
  ],
  ['hipRight', 'hips', 'Armature/Hips/RightUpLeg'],
  ['kneeRight', 'hipRight', 'Armature/Hips/RightUpLeg/RightLeg'],
  ['ankleRight', 'kneeRight', 'Armature/Hips/RightUpLeg/RightLeg/RightFoot'],
  [
    'toeRight',
    'ankleRight',
    'Armature/Hips/RightUpLeg/RightLeg/RightFoot/RightToeBase',
  ],
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
      'usage: node tools/import-unity-rope-animations.mjs ' +
      '--unity-project <Board Platformer Unity> ' +
      '--output <src/animation/unityRopeAnimations.generated.ts>',
    );
  }
  return {
    unityProject: resolve(unityProject),
    output: resolve(output),
  };
}

function normalizedPath(path) {
  return path.split(sep).join('/');
}

function finiteNumber(value, context) {
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) throw new Error(`${context} is not finite: ${value}`);
  return parsed;
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

function evaluateQuaternion(keys, time) {
  if (time <= keys[0].time + EPSILON) {
    return new THREE.Quaternion(
      keys[0].value.x,
      keys[0].value.y,
      keys[0].value.z,
      keys[0].value.w,
    ).normalize();
  }
  const final = keys[keys.length - 1];
  if (time >= final.time - EPSILON) {
    return new THREE.Quaternion(
      final.value.x,
      final.value.y,
      final.value.z,
      final.value.w,
    ).normalize();
  }
  let upper = 1;
  while (keys[upper].time < time) upper++;
  const a = keys[upper - 1];
  const b = keys[upper];
  const duration = b.time - a.time;
  if (duration <= EPSILON) {
    return new THREE.Quaternion(b.value.x, b.value.y, b.value.z, b.value.w)
      .normalize();
  }
  const alpha = THREE.MathUtils.clamp((time - a.time) / duration, 0, 1);
  return new THREE.Quaternion(
    hermite(a, b, alpha, duration, 0),
    hermite(a, b, alpha, duration, 1),
    hermite(a, b, alpha, duration, 2),
    hermite(a, b, alpha, duration, 3),
  ).normalize();
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
    result.set(
      joint,
      parent ? result.get(parent).clone().multiply(local).normalize() : local,
    );
  }
  return result;
}

function retargetPose(
  clipCurves,
  bindCurves,
  paths,
  bindWorld,
  canonicalWorld,
  sourceTime,
) {
  const currentWorld = sourceWorldQuaternions(
    clipCurves,
    bindCurves,
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

function smoothstep(value) {
  const clamped = THREE.MathUtils.clamp(value, 0, 1);
  return clamped * clamped * (3 - 2 * clamped);
}

function climbLoopPose(
  clip,
  bindCurves,
  paths,
  bindWorld,
  canonicalWorld,
  outputTime,
) {
  const overlap = CLIMB_LOOP_OVERLAP_SECONDS;
  const primarySourceTime = outputTime + overlap;
  const seamStart = clip.duration - 2 * overlap;
  const primary = retargetPose(
    clip.curves,
    bindCurves,
    paths,
    bindWorld,
    canonicalWorld,
    primarySourceTime,
  );
  if (outputTime < seamStart - EPSILON) return primary;
  const blend = smoothstep((outputTime - seamStart) / overlap);
  const secondary = retargetPose(
    clip.curves,
    bindCurves,
    paths,
    bindWorld,
    canonicalWorld,
    outputTime - seamStart,
  );
  for (const [joint, value] of primary) {
    value.slerp(secondary.get(joint), blend).normalize();
  }
  return primary;
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
  spec,
  clip,
  bindCurves,
  paths,
  bindWorld,
  canonicalWorld,
) {
  // Unity serializes intended frame boundaries with small decimal tails
  // (2.6000001, 4.366667, ...). Publish the exact 60 Hz duration so catalog
  // markers and phase math do not inherit those YAML formatting artifacts.
  const duration = Math.round((clip.duration - spec.leadIn) * SAMPLE_RATE)
    / SAMPLE_RATE;
  if (duration <= 0) throw new Error(`${spec.sourceName} has no usable range`);
  const times = sampleTimes(duration);
  const tracks = new Map(PLAYER_HIERARCHY.map(([joint]) => [joint, []]));
  const previous = new Map();
  for (const outputTime of times) {
    const pose = spec.climbLoop
      ? climbLoopPose(
          clip,
          bindCurves,
          paths,
          bindWorld,
          canonicalWorld,
          outputTime,
        )
      : retargetPose(
          clip.curves,
          bindCurves,
          paths,
          bindWorld,
          canonicalWorld,
          spec.leadIn + outputTime,
        );
    for (const [joint, quaternion] of pose) {
      continuousQuaternion(previous.get(joint), quaternion);
      previous.set(joint, quaternion.clone());
      tracks.get(joint).push(quaternion);
    }
  }
  if (spec.loop) {
    for (const values of tracks.values()) values[values.length - 1] = values[0].clone();
  }
  return { duration, times, tracks };
}

function simplifyQuaternionTrack(times, values, tolerance) {
  const keep = new Set([0, values.length - 1]);
  const recurse = (start, end) => {
    if (end - start <= 1) return;
    const duration = times[end] - times[start];
    let maximumError = -1;
    let maximumIndex = -1;
    for (let index = start + 1; index < end; index++) {
      const alpha = duration <= EPSILON
        ? 0
        : (times[index] - times[start]) / duration;
      const interpolated = values[start].clone().slerp(values[end], alpha).normalize();
      const error = interpolated.angleTo(values[index]);
      if (error > maximumError) {
        maximumError = error;
        maximumIndex = index;
      }
    }
    if (maximumError <= tolerance || maximumIndex < 0) return;
    keep.add(maximumIndex);
    recurse(start, maximumIndex);
    recurse(maximumIndex, end);
  };
  recurse(0, values.length - 1);
  return [...keep].sort((a, b) => a - b);
}

function maximumReducedError(times, values, indices) {
  let maximum = 0;
  for (let segment = 1; segment < indices.length; segment++) {
    const start = indices[segment - 1];
    const end = indices[segment];
    const duration = times[end] - times[start];
    for (let index = start + 1; index < end; index++) {
      const alpha = duration <= EPSILON
        ? 0
        : (times[index] - times[start]) / duration;
      const interpolated = values[start].clone().slerp(values[end], alpha).normalize();
      maximum = Math.max(maximum, interpolated.angleTo(values[index]));
    }
  }
  return maximum;
}

function reduceClip(sampled) {
  const reduced = new Map();
  let reducedKeyCount = 0;
  let maximumError = 0;
  for (const [joint, values] of sampled.tracks) {
    const indices = simplifyQuaternionTrack(
      sampled.times,
      values,
      MAX_QUATERNION_ERROR_RADIANS,
    );
    maximumError = Math.max(
      maximumError,
      maximumReducedError(sampled.times, values, indices),
    );
    const keys = indices.map((index) => ({
      time: sampled.times[index],
      value: values[index],
    }));
    reduced.set(joint, keys);
    reducedKeyCount += keys.length;
  }
  return { ...sampled, reduced, reducedKeyCount, maximumError };
}

function rounded(value) {
  const nearestInteger = Math.round(value);
  const stable = Math.abs(value - nearestInteger) < 1e-7 ? nearestInteger : value;
  const result = Number(stable.toFixed(7));
  return Object.is(result, -0) ? 0 : result;
}

function tupleLine(key) {
  const value = key.value.toArray().map(rounded).join(', ');
  return `    [${rounded(key.time)}, [${value}]],`;
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

function metadataClipSource(unityProject, spec, clip, hashes, result) {
  return {
    sourceName: spec.sourceName,
    sourceAsset: normalizedPath(relative(unityProject, resolve(unityProject, spec.sourceAsset))),
    sourceAssetSha256: hashes.sourceAsset,
    sourceFbx: normalizedPath(relative(unityProject, resolve(unityProject, spec.sourceFbx))),
    sourceFbxSha256: hashes.sourceFbx,
    sourceDuration: rounded(clip.duration),
    sourceLeadIn: rounded(spec.leadIn),
    outputDuration: rounded(result.duration),
    loop: spec.loop,
    sourceFrameCount: result.times.length,
    reducedQuaternionKeyCount: result.reducedKeyCount,
    maximumObservedErrorDegrees: rounded(
      THREE.MathUtils.radToDeg(result.maximumError),
    ),
  };
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
  const metadataJson = JSON.stringify(metadata, null, 2);
  const blocks = Object.entries(CLIP_SPECS).flatMap(([id, spec]) => {
    const result = results.get(id);
    return [
      `export const ${spec.symbol}_DURATION = ${rounded(result.duration)};`,
      rotationKeysSource(spec.symbol, result.reduced),
    ];
  });
  return `// Generated by tools/import-unity-rope-animations.mjs.
// Source motion is user-supplied Unity/Meshy animation evidence. Do not hand-edit
// sampled values; the resulting catalog clips remain editable in Animation Studio.

export const UNITY_ROPE_ANIMATION_SOURCE = Object.freeze(${metadataJson} as const);

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
  return {
    sourcePath,
    source,
    curves: parseRotationCurves(source, sourcePath),
    duration: Math.round(clipDuration(source, sourcePath) * SAMPLE_RATE)
      / SAMPLE_RATE,
  };
}

async function main() {
  const args = parseArguments(process.argv.slice(2));
  const bindPath = resolve(args.unityProject, BIND_ASSET);
  const bindSource = await readFile(bindPath, 'utf8');
  const bindCurves = parseRotationCurves(bindSource, bindPath);
  const paths = sourcePathOrder(bindCurves);
  const bindWorld = sourceWorldQuaternions(bindCurves, bindCurves, paths, 0);
  const canonicalWorld = playerCanonicalWorldQuaternions();
  for (const [, , sourcePath] of PLAYER_HIERARCHY) {
    if (!bindWorld.has(sourcePath)) {
      throw new Error(`${bindPath} is missing mapped source joint ${sourcePath}`);
    }
  }

  const clips = new Map();
  const results = new Map();
  const metadataClips = {};
  for (const [id, spec] of Object.entries(CLIP_SPECS)) {
    const clip = await loadClip(args.unityProject, spec);
    clips.set(id, clip);
    const sampled = sampleRetargetedClip(
      spec,
      clip,
      bindCurves,
      paths,
      bindWorld,
      canonicalWorld,
    );
    const reduced = reduceClip(sampled);
    if (reduced.maximumError > MAX_QUATERNION_ERROR_RADIANS + 1e-7) {
      throw new Error(
        `${spec.sourceName} reduction exceeded ${MAX_QUATERNION_ERROR_DEGREES} degrees`,
      );
    }
    results.set(id, reduced);
    metadataClips[id] = metadataClipSource(
      args.unityProject,
      spec,
      clip,
      {
        sourceAsset: await sha256(clip.sourcePath),
        sourceFbx: await sha256(resolve(args.unityProject, spec.sourceFbx)),
      },
      reduced,
    );
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
    conversion:
      'Unity bind-world delta to player canonical-world/rest-local; component Hermite source sampling',
    translationPolicy: 'omitted; deterministic gameplay owns traversal translation and root motion',
    loopPolicy: {
      hang: 'source loop with exact end-to-start closure',
      climb:
        '4/60s source overlap, final 4/60s smoothstep crossfade to source frames 0-4, exact closure',
    },
    releasePolicy: {
      swingLeadInSeconds: SWING_RELEASE_LEAD_IN_SECONDS,
      backflipLeadInSeconds: BACKFLIP_RELEASE_LEAD_IN_SECONDS,
    },
    semanticMap,
    clips: metadataClips,
  };
  // Stable metadata catches accidental platform/path-order drift in review.
  metadata.canonicalMetadataHash = createHash('sha256')
    .update(stableJson(metadata))
    .digest('hex');

  await writeFile(args.output, sourceModule(metadata, results), 'utf8');
  for (const [id, result] of results) {
    console.log(
      `${id}: ${result.times.length} source samples -> ${result.reducedKeyCount} keys ` +
      `across ${result.reduced.size} joints; max error ` +
      `${THREE.MathUtils.radToDeg(result.maximumError).toFixed(4)} degrees`,
    );
  }
  console.log(`Wrote ${args.output}`);
}

await main();
