import * as THREE from "three";
import type { ShoreSample } from "./unityOcean";
import { createUnitySandMaterial } from "./unitySandMaterial";
import {
  beachfrontCliffReady,
  createBeachfrontCliffVisual,
  releaseBeachfrontCliffVisual,
} from "./beachfrontCliff";
import {
  BEACHFRONT_COURSE_LENGTH as COURSE_LENGTH,
  BEACHFRONT_COURSE_SAMPLE_COUNT as COURSE_SAMPLE_COUNT,
  BEACHFRONT_SAND_BANK_LATERAL_SEGMENTS as SAND_BANK_LATERAL_SEGMENTS,
  BEACHFRONT_SAND_LONGITUDINAL_SAMPLE_COUNT as SAND_LONGITUDINAL_SAMPLE_COUNT,
  BEACHFRONT_SAND_SUBMERGED_LATERAL_SEGMENTS as SAND_SUBMERGED_LATERAL_SEGMENTS,
  BEACHFRONT_SAND_SUBMERGED_SHELF_WIDTH as SAND_SUBMERGED_SHELF_WIDTH,
  BEACHFRONT_SAND_TEXTURE_TILE_SIZE as SAND_TEXTURE_TILE_SIZE,
  BEACHFRONT_SAND_WATERLINE_COLUMN as SAND_WATERLINE_COLUMN,
  BEACHFRONT_SAND_WET_TRANSITION_WIDTH as SAND_WET_TRANSITION_WIDTH,
  beachfrontFineShorelineInfluence as fineShorelineInfluence,
  beachfrontFineShorelineOffset as fineShorelineOffset,
  beachfrontFrameAtDistance as sourceFrameAtDistance,
  beachfrontLandwardSandEdgeLateral as landwardSandEdgeLateral,
  beachfrontSandHeight as sandHeight,
  beachfrontShorelineLateral as shorelineLateral,
} from "./beachfrontCourse";

const SAND_LATERAL_SEGMENTS =
  SAND_SUBMERGED_LATERAL_SEGMENTS + SAND_BANK_LATERAL_SEGMENTS;

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
  const source = sourceFrameAtDistance(rawDistance);
  return {
    distance: source.distance,
    center: new THREE.Vector3(source.x, 0, source.z),
    forward: new THREE.Vector3(source.fx, 0, source.fz),
    right: new THREE.Vector3(source.rx, 0, source.rz),
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
  sand.userData.beachSandFriction = true;

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
  const stonecliff = createBeachfrontCliffVisual();
  stonecliff.name = "Stonecliff Bastion source presentation";

  const group = new THREE.Group();
  group.name = "Unity Beachfront Run reference";
  group.add(sand, cliff, stonecliff);

  // Keep the synchronous strip as a no-pop fallback while the aggressively
  // compressed source mesh loads. A successful shared GLB upgrade replaces
  // it; a served asset failure leaves the fallback visible and debuggable.
  let disposed = false;
  void beachfrontCliffReady.then(() => {
    if (!disposed && stonecliff.userData.assetReady === true)
      cliff.visible = false;
  });

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

  const dispose = (): void => {
    if (disposed) return;
    disposed = true;
    releaseBeachfrontCliffVisual(stonecliff);
    sand.geometry.dispose();
    sandOwner.dispose();
    cliff.geometry.dispose();
    cliffMaterial.dispose();
    group.clear();
  };

  return { group, sand, shore, lane, spawn, finish, dispose };
}
