import * as THREE from "three";
import type { ShoreSample } from "./unityOcean";
import { createUnitySandMaterial } from "./unitySandMaterial";

const COURSE_MINIMUM_Z = -20;
const COURSE_LENGTH = 740;
const COURSE_SAMPLE_COUNT = 149;
const SAND_LONGITUDINAL_SAMPLE_COUNT = 371;
const SAND_SUBMERGED_LATERAL_SEGMENTS = 16;
const SAND_BANK_LATERAL_SEGMENTS = 48;
const SAND_LATERAL_SEGMENTS =
  SAND_SUBMERGED_LATERAL_SEGMENTS + SAND_BANK_LATERAL_SEGMENTS;
const SAND_WATERLINE_COLUMN = SAND_SUBMERGED_LATERAL_SEGMENTS;
const SAND_SUBMERGED_SHELF_WIDTH = 16;
const SAND_MAXIMUM_LATERAL = 8;
const LANDWARD_SAND_MINIMUM_LATERAL = 12.8;
const LANDWARD_SAND_MAXIMUM_LATERAL = 16.8;
const SEA_LEVEL = -0.36;
const SAND_WET_TRANSITION_WIDTH = 3.5;
const SAND_OFFSHORE_DEPTH = 1.28;
const DRY_SAND_RELIEF_AMPLITUDE = 0.04;
const SUBMERGED_SAND_RELIEF_AMPLITUDE = 0.035;
const FINE_SHORE_SEAWARD_FADE = 5;
const FINE_SHORE_LANDWARD_FADE = 4;
const SAND_TEXTURE_TILE_SIZE = 5.4;

interface BeachfrontCourseFrame {
  distance: number;
  center: THREE.Vector3;
  forward: THREE.Vector3;
  right: THREE.Vector3;
}

export interface UnityBeachfrontReference {
  group: THREE.Group;
  sand: THREE.Mesh;
  shore: ShoreSample[];
  lane: { x: number; y: number; z: number }[];
  spawn: THREE.Vector3;
  finish: THREE.Vector3;
  dispose: () => void;
}

function clamp(value: number, minimum: number, maximum: number): number {
  return Math.max(minimum, Math.min(maximum, value));
}

function clamp01(value: number): number {
  return clamp(value, 0, 1);
}

function lerp(a: number, b: number, t: number): number {
  return a + (b - a) * t;
}

function frameAtDistance(rawDistance: number): BeachfrontCourseFrame {
  const distance = clamp(rawDistance, 0, COURSE_LENGTH);
  const t = distance / COURSE_LENGTH;
  const phase = Math.PI * 2 * t;
  const x = 15 * Math.sin(phase) + 6 * Math.sin(phase * 2);
  const derivative =
    (15 * Math.PI * 2 * Math.cos(phase) +
      12 * Math.PI * 2 * Math.cos(phase * 2)) /
    COURSE_LENGTH;
  // Unity's world is consumed here as source data.  Mirror source Z when it
  // enters Three's right-handed world so the native +Z course becomes the
  // prototype's normal -Z corridor without horizontally mirroring the shot.
  const forward = new THREE.Vector3(derivative, 0, -1).normalize();
  // A handedness reflection reverses cross products.  Unity's landward right
  // is up x forward; after C=diag(1,1,-1), its exact converted vector is
  // forward x up in Three coordinates.
  const right = new THREE.Vector3().crossVectors(
    forward,
    new THREE.Vector3(0, 1, 0),
  ).normalize();
  return {
    distance,
    center: new THREE.Vector3(x, 0, -(COURSE_MINIMUM_Z + distance)),
    forward,
    right,
  };
}

function buildCourseFrames(): BeachfrontCourseFrame[] {
  const frames: BeachfrontCourseFrame[] = [];
  for (let index = 0; index < COURSE_SAMPLE_COUNT; index++) {
    frames.push(
      frameAtDistance(
        (COURSE_LENGTH * index) / (COURSE_SAMPLE_COUNT - 1),
      ),
    );
  }
  return frames;
}

function buildSandFrames(
  courseFrames: readonly BeachfrontCourseFrame[],
): BeachfrontCourseFrame[] {
  const frames: BeachfrontCourseFrame[] = [courseFrames[0]];
  for (let segment = 0; segment < courseFrames.length - 1; segment++) {
    const subdivisions = segment % 2 === 0 ? 3 : 2;
    for (let step = 1; step <= subdivisions; step++) {
      frames.push(
        step === subdivisions
          ? courseFrames[segment + 1]
          : frameAtDistance(
              lerp(
                courseFrames[segment].distance,
                courseFrames[segment + 1].distance,
                step / subdivisions,
              ),
            ),
      );
    }
  }
  if (frames.length !== SAND_LONGITUDINAL_SAMPLE_COUNT) {
    throw new Error(
      `Beachfront sand generated ${frames.length} longitudinal samples; ` +
        `expected ${SAND_LONGITUDINAL_SAMPLE_COUNT}.`,
    );
  }
  return frames;
}

function smoothLongitudinalHeight(distance: number): number {
  return (
    0.075 * Math.sin(distance * 0.019 + 0.55 * Math.sin(distance * 0.0043)) +
    0.05 * Math.sin(distance * 0.051 + 1.1)
  );
}

function localizedCove(
  distance: number,
  center: number,
  radius: number,
): number {
  const normalized = (distance - center) / Math.max(0.01, radius);
  return Math.exp(-normalized * normalized);
}

function sandWidth(distance: number): number {
  const width =
    20.5 +
    Math.sin(distance * 0.018 + 0.4) +
    0.7 * Math.sin(distance * 0.043 - 1.1) +
    3.36 * localizedCove(distance, 80, 40) -
    3.36 * localizedCove(distance, 180, 35) +
    3.6 * localizedCove(distance, 290, 45) -
    3.36 * localizedCove(distance, 405, 38) +
    3.6 * localizedCove(distance, 525, 44) -
    3.36 * localizedCove(distance, 635, 38) +
    2.64 * localizedCove(distance, 710, 28);
  return clamp(width, 16, 25);
}

function shorelineLateral(distance: number): number {
  return SAND_MAXIMUM_LATERAL - sandWidth(distance);
}

function fineShorelineOffset(distance: number): number {
  return (
    0.28 *
      Math.sin(distance * 0.21 + 0.42 * Math.sin(distance * 0.047)) +
    0.13 * Math.sin(distance * 0.43 + 1.35) +
    0.055 * Math.sin(distance * 0.71 - 0.6)
  );
}

function fineShorelineInfluence(shoreOffset: number): number {
  const influence =
    shoreOffset <= 0
      ? clamp01(1 + shoreOffset / FINE_SHORE_SEAWARD_FADE)
      : clamp01(1 - shoreOffset / FINE_SHORE_LANDWARD_FADE);
  return influence * influence * (3 - 2 * influence);
}

function landwardSandEdgeLateral(distance: number): number {
  const broad =
    14.2 +
    1.05 * Math.sin(distance * 0.016 + 0.65) +
    0.62 * Math.sin(distance * 0.039 - 1.2) +
    0.48 * Math.sin(distance * 0.071 + 2.1) +
    0.9 * localizedCove(distance, 102, 54) -
    0.85 * localizedCove(distance, 236, 46) +
    1.05 * localizedCove(distance, 372, 58) -
    0.75 * localizedCove(distance, 516, 48) +
    0.8 * localizedCove(distance, 684, 42);
  const fine =
    0.32 *
      Math.sin(distance * 0.19 + 0.38 * Math.sin(distance * 0.043)) +
    0.16 * Math.sin(distance * 0.41 - 0.9) +
    0.07 * Math.sin(distance * 0.67 + 1.7);
  return clamp(
    broad + fine,
    LANDWARD_SAND_MINIMUM_LATERAL,
    LANDWARD_SAND_MAXIMUM_LATERAL,
  );
}

function cliffToeBurialHeight(distance: number, lateral: number): number {
  let toe = clamp01((lateral - 5.8) / 2.6);
  toe = toe * toe * (3 - 2 * toe);
  return toe * (0.52 + 0.08 * Math.sin(distance * 0.061 + 0.7));
}

function submergedSandRelief(distance: number, shelf: number): number {
  const depthFromShore = clamp01(1 - shelf);
  const envelope =
    4 * shelf * depthFromShore * Math.sqrt(depthFromShore);
  const relief =
    0.68 *
      Math.sin(
        distance * 0.243 +
          shelf * 8.7 +
          0.55 * Math.sin(distance * 0.031),
      ) +
    0.32 * Math.sin(distance * 0.517 - shelf * 13.1 + 1.2);
  return SUBMERGED_SAND_RELIEF_AMPLITUDE * envelope * relief;
}

function drySandRelief(distance: number, bank: number): number {
  let envelope = Math.sin(Math.PI * clamp01(bank));
  envelope *= envelope;
  const relief =
    0.55 *
      Math.sin(
        distance * 0.287 +
          bank * 9.4 +
          0.62 * Math.sin(distance * 0.037),
      ) +
    0.29 * Math.sin(distance * 0.631 - bank * 16.7 + 1.45) +
    0.16 * Math.sin(distance * 1.071 + bank * 27.3 - 0.8);
  return DRY_SAND_RELIEF_AMPLITUDE * envelope * relief;
}

function sandHeight(distance: number, lateral: number): number {
  const shoreline = shorelineLateral(distance);
  const shoreOffset = lateral - shoreline;
  if (shoreOffset <= 0) {
    const shelf = clamp01(
      1 + shoreOffset / SAND_SUBMERGED_SHELF_WIDTH,
    );
    return (
      SEA_LEVEL -
      SAND_OFFSHORE_DEPTH * Math.pow(1 - shelf, 1.8) +
      submergedSandRelief(distance, shelf)
    );
  }

  const playableBankOffset = SAND_MAXIMUM_LATERAL - shoreline;
  const bank = clamp01(shoreOffset / Math.max(0.01, playableBankOffset));
  const shoreSlope = 2.1;
  const bankProfile =
    shoreSlope * bank +
    (3 - 2 * shoreSlope) * bank * bank +
    (shoreSlope - 2) * bank * bank * bank;
  const longitudinalBlend = bank * bank * (3 - 2 * bank);
  const lowShoreNoise =
    0.012 *
    Math.sin(distance * 0.109 + 0.55 * Math.sin(distance * 0.017)) *
    16 *
    bank *
    bank *
    (1 - bank) *
    (1 - bank);
  const playableHeight =
    SEA_LEVEL +
    0.84 * bankProfile +
    smoothLongitudinalHeight(distance) * longitudinalBlend +
    lowShoreNoise +
    drySandRelief(distance, bank);
  const cliffToeBurial = cliffToeBurialHeight(distance, lateral);
  if (lateral <= SAND_MAXIMUM_LATERAL) {
    return playableHeight + cliffToeBurial;
  }

  const extension = lateral - SAND_MAXIMUM_LATERAL;
  const landwardSpan = Math.max(
    0.01,
    landwardSandEdgeLateral(distance) - SAND_MAXIMUM_LATERAL,
  );
  const extension01 = clamp01(extension / landwardSpan);
  const smoothExtension = extension01 * extension01 * (3 - 2 * extension01);
  const rollingRise =
    0.115 * extension +
    0.16 * smoothExtension +
    0.075 *
      Math.sin(
        distance * 0.083 +
          extension * 0.72 +
          0.5 * Math.sin(distance * 0.019),
      ) *
      smoothExtension;
  return playableHeight + rollingRise + cliffToeBurial;
}

function buildSandGeometry(
  frames: readonly BeachfrontCourseFrame[],
): THREE.BufferGeometry {
  const columns = SAND_LATERAL_SEGMENTS + 1;
  const vertexCount = frames.length * columns;
  const positions = new Float32Array(vertexCount * 3);
  const uvs = new Float32Array(vertexCount * 2);
  const colors = new Float32Array(vertexCount * 4);
  const indices = new Uint32Array(
    (frames.length - 1) * SAND_LATERAL_SEGMENTS * 6,
  );
  let vertex = 0;
  let shorelineMeters = 0;
  let previousVisibleShoreline: THREE.Vector3 | null = null;

  for (const frame of frames) {
    const shoreline = shorelineLateral(frame.distance);
    const landwardEdge = landwardSandEdgeLateral(frame.distance);
    const fineShoreOffset = fineShorelineOffset(frame.distance);
    const visibleShoreline = shoreline + fineShoreOffset;
    const visibleShorelinePoint = frame.center
      .clone()
      .addScaledVector(frame.right, visibleShoreline);
    if (previousVisibleShoreline) {
      const shorelineDelta = visibleShorelinePoint
        .clone()
        .sub(previousVisibleShoreline);
      shorelineDelta.y = 0;
      shorelineMeters += shorelineDelta.length();
    }
    previousVisibleShoreline = visibleShorelinePoint;

    for (let column = 0; column < columns; column++) {
      const nominalLateral =
        column <= SAND_WATERLINE_COLUMN
          ? lerp(
              shoreline - SAND_SUBMERGED_SHELF_WIDTH,
              shoreline,
              column / SAND_SUBMERGED_LATERAL_SEGMENTS,
            )
          : lerp(
              shoreline,
              landwardEdge,
              (column - SAND_WATERLINE_COLUMN) /
                SAND_BANK_LATERAL_SEGMENTS,
            );
      const nominalShoreOffset = nominalLateral - shoreline;
      const lateral =
        nominalLateral +
        fineShoreOffset * fineShorelineInfluence(nominalShoreOffset);
      const point = frame.center.clone().addScaledVector(frame.right, lateral);
      point.y = sandHeight(frame.distance, nominalLateral);
      const shoreOffset = lateral - visibleShoreline;
      const dryShoreOffset = Math.max(0, shoreOffset);
      const wetTransition = clamp01(
        dryShoreOffset / SAND_WET_TRANSITION_WIDTH,
      );
      const wetness =
        1 - wetTransition * wetTransition * (3 - 2 * wetTransition);

      const positionOffset = vertex * 3;
      positions[positionOffset] = point.x;
      positions[positionOffset + 1] = point.y;
      positions[positionOffset + 2] = point.z;
      const uvOffset = vertex * 2;
      uvs[uvOffset] = shoreOffset / SAND_TEXTURE_TILE_SIZE;
      uvs[uvOffset + 1] = shorelineMeters / SAND_TEXTURE_TILE_SIZE;
      const colorOffset = vertex * 4;
      colors[colorOffset] = wetness;
      colors[colorOffset + 1] = 0;
      colors[colorOffset + 2] = 0;
      colors[colorOffset + 3] = 1;
      vertex++;
    }
  }

  let triangle = 0;
  for (let row = 0; row < frames.length - 1; row++) {
    const current = row * columns;
    const next = (row + 1) * columns;
    for (let column = 0; column < SAND_LATERAL_SEGMENTS; column++) {
      const nearLeft = current + column;
      const farLeft = next + column;
      const nearRight = nearLeft + 1;
      const farRight = farLeft + 1;
      indices[triangle++] = nearLeft;
      indices[triangle++] = farLeft;
      indices[triangle++] = nearRight;
      indices[triangle++] = nearRight;
      indices[triangle++] = farLeft;
      indices[triangle++] = farRight;
    }
  }

  const geometry = new THREE.BufferGeometry();
  geometry.name = "BeachfrontRun_Showcase1ContinuousSandSeabed";
  geometry.setAttribute("position", new THREE.BufferAttribute(positions, 3));
  const uv = new THREE.BufferAttribute(uvs, 2);
  geometry.setAttribute("uv", uv);
  geometry.setAttribute("uv1", uv.clone());
  geometry.setAttribute("uv2", uv.clone());
  geometry.setAttribute("color", new THREE.BufferAttribute(colors, 4));
  geometry.setIndex(new THREE.BufferAttribute(indices, 1));
  geometry.computeVertexNormals();

  const normals = geometry.getAttribute("normal");
  if (normals.getY(0) < 0) {
    const index = geometry.getIndex();
    if (index) {
      const array = index.array;
      for (let offset = 0; offset < array.length; offset += 3) {
        const swap = array[offset + 1];
        array[offset + 1] = array[offset + 2];
        array[offset + 2] = swap;
      }
      index.needsUpdate = true;
      geometry.computeVertexNormals();
    }
  }
  geometry.computeTangents();
  geometry.computeBoundingBox();
  geometry.computeBoundingSphere();
  return geometry;
}

function buildShore(
  frames: readonly BeachfrontCourseFrame[],
): ShoreSample[] {
  const points = frames.map((frame) =>
    frame.center.clone().addScaledVector(
      frame.right,
      shorelineLateral(frame.distance),
    ),
  );
  return points.map((point, index) => {
    const before = points[Math.max(0, index - 1)];
    const after = points[Math.min(points.length - 1, index + 1)];
    let tx = after.x - before.x;
    let tz = after.z - before.z;
    const tangentLength = Math.hypot(tx, tz) || 1;
    tx /= tangentLength;
    tz /= tangentLength;
    let sx = tz;
    let sz = -tx;
    const seawardHint = frames[index].right;
    if (sx * -seawardHint.x + sz * -seawardHint.z < 0) {
      sx = -sx;
      sz = -sz;
    }
    return {
      x: point.x,
      z: point.z,
      sx,
      sz,
      beachSlope: 0.055,
      bedSlope: 0.08,
    };
  });
}

function buildCliffGeometry(
  frames: readonly BeachfrontCourseFrame[],
): THREE.BufferGeometry {
  const positions = new Float32Array(frames.length * 2 * 3);
  const uvs = new Float32Array(frames.length * 2 * 2);
  const indices = new Uint32Array((frames.length - 1) * 6);
  let arc = 0;
  let previous: THREE.Vector3 | null = null;
  for (let row = 0; row < frames.length; row++) {
    const frame = frames[row];
    const lateral = landwardSandEdgeLateral(frame.distance);
    const edge = frame.center.clone().addScaledVector(frame.right, lateral);
    edge.y = sandHeight(frame.distance, lateral);
    if (previous) {
      arc += Math.hypot(edge.x - previous.x, edge.z - previous.z);
    }
    previous = edge;
    const bottomY = edge.y - 0.28;
    const topY =
      edge.y +
      4.4 +
      0.75 * Math.sin(frame.distance * 0.035 + 0.8) +
      0.35 * Math.sin(frame.distance * 0.113);
    const positionOffset = row * 6;
    positions[positionOffset] = edge.x;
    positions[positionOffset + 1] = bottomY;
    positions[positionOffset + 2] = edge.z;
    positions[positionOffset + 3] = edge.x;
    positions[positionOffset + 4] = topY;
    positions[positionOffset + 5] = edge.z;
    const uvOffset = row * 4;
    uvs[uvOffset] = arc / 7;
    uvs[uvOffset + 1] = 0;
    uvs[uvOffset + 2] = arc / 7;
    uvs[uvOffset + 3] = 1;
  }
  let cursor = 0;
  for (let row = 0; row < frames.length - 1; row++) {
    const bottom = row * 2;
    const top = bottom + 1;
    const nextBottom = bottom + 2;
    const nextTop = bottom + 3;
    indices[cursor++] = bottom;
    indices[cursor++] = nextBottom;
    indices[cursor++] = top;
    indices[cursor++] = top;
    indices[cursor++] = nextBottom;
    indices[cursor++] = nextTop;
  }
  const geometry = new THREE.BufferGeometry();
  geometry.name = "BeachfrontRun_LandwardCliffVisual";
  geometry.setAttribute("position", new THREE.BufferAttribute(positions, 3));
  geometry.setAttribute("uv", new THREE.BufferAttribute(uvs, 2));
  geometry.setIndex(new THREE.BufferAttribute(indices, 1));
  geometry.computeVertexNormals();
  geometry.computeBoundingBox();
  geometry.computeBoundingSphere();
  return geometry;
}

/**
 * Builds the source-authored Unity Beachfront Run terrain at world scale.
 * Ocean tails and water rendering are intentionally left to CoastWater.
 */
export function createUnityBeachfrontReference(): UnityBeachfrontReference {
  const courseFrames = buildCourseFrames();
  const sandFrames = buildSandFrames(courseFrames);
  const sandOwner = createUnitySandMaterial({
    name: "BeachfrontRun_Showcase1Sand",
  });
  const sandMaterial = sandOwner.material;

  const sand = new THREE.Mesh(buildSandGeometry(sandFrames), sandMaterial);
  sand.name = "Showcase1ContinuousSandSeabed";
  sand.userData.noShadow = true;

  const cliffMaterial = new THREE.MeshStandardMaterial({
    name: "BeachfrontRun_LandwardCliffVisual",
    color: 0x81786a,
    roughness: 0.96,
    metalness: 0,
    side: THREE.DoubleSide,
  });
  const cliff = new THREE.Mesh(buildCliffGeometry(sandFrames), cliffMaterial);
  cliff.name = "LandwardCliffVisual";
  cliff.userData.visualOnly = true;
  cliff.userData.noShadow = true;

  const group = new THREE.Group();
  group.name = "Unity Beachfront Run reference";
  group.add(sand, cliff);

  const shore = buildShore(sandFrames);
  const lane = courseFrames.map((frame) => ({
    x: frame.center.x,
    y: sandHeight(frame.distance, 0),
    z: frame.center.z,
  }));
  const spawnFrame = frameAtDistance(12);
  const spawn = spawnFrame.center.clone();
  spawn.y = sandHeight(12, 0) + 0.12;
  const finishFrame = frameAtDistance(720);
  const finish = finishFrame.center
    .clone()
    .addScaledVector(finishFrame.right, 2);
  finish.y = sandHeight(720, 2);

  let disposed = false;
  const dispose = (): void => {
    if (disposed) return;
    disposed = true;
    sand.geometry.dispose();
    sandOwner.dispose();
    cliff.geometry.dispose();
    cliffMaterial.dispose();
    group.clear();
  };

  return { group, sand, shore, lane, spawn, finish, dispose };
}
