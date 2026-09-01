#!/usr/bin/env node
/**
 * Convert the two owner-supplied Meshy limb FBXs into synchronous generated
 * Three.js geometry. No Blender runtime or browser fetch is required.
 *
 * Usage:
 *   node tools/import-meshy-limb-bones.mjs IVORY_BONE.fbx IVORY_RATTLE.fbx OUTPUT.ts
 */

import { createHash } from 'node:crypto';
import { readFileSync, writeFileSync } from 'node:fs';
import { basename, dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { FBXLoader } from 'three/examples/jsm/loaders/FBXLoader.js';

const EXPECTED = Object.freeze({
  ivoryBone: Object.freeze({
    sha256: '13d5a1199abf1d39fa448ce9f2607e1358b5442ea27453ce542c1b25f543ed73',
    triangles: 1328,
    upperBoundaryZ: 0.23,
    lowerBoundaryZ: -0.26,
    upperBlendZ: 0.27,
    lowerBlendZ: -0.30,
    proximalKind: 'shoulder-knob',
    distalKind: 'joint-knob',
    upperRingVertices: 32,
    lowerRingVertices: 31,
    thicknessFadeMultiplier: 1,
  }),
  ivoryRattle: Object.freeze({
    sha256: '17acdb80d7144ad39786517910f031117d4ff08c5800e93dfb09b166aef66310',
    triangles: 1536,
    upperBoundaryZ: 0.31,
    lowerBoundaryZ: -0.40,
    upperBlendZ: 0.35,
    lowerBlendZ: -0.43,
    proximalKind: 'joint-knob',
    distalKind: 'insertion-tip',
    upperRingVertices: 42,
    lowerRingVertices: 39,
    thicknessFadeMultiplier: 1,
  }),
});

function installNodeFbxShims() {
  globalThis.ProgressEvent ??= class ProgressEvent {};
  globalThis.window ??= {
    URL: { createObjectURL: () => '', revokeObjectURL: () => {} },
  };
  globalThis.document ??= {
    createElementNS: () => ({
      addEventListener() {},
      removeEventListener() {},
      set src(_value) {},
    }),
  };
}

function sha256(bytes) {
  return createHash('sha256').update(bytes).digest('hex');
}

function args() {
  const values = process.argv.slice(2);
  if (values.length !== 3) {
    throw new Error(`usage: node ${basename(fileURLToPath(import.meta.url))} IVORY_BONE.fbx IVORY_RATTLE.fbx OUTPUT.ts`);
  }
  return values.map((value) => resolve(value));
}

function parseMesh(path, expected) {
  installNodeFbxShims();
  const bytes = readFileSync(path);
  const hash = sha256(bytes);
  if (hash !== expected.sha256) throw new Error(`unexpected ${basename(path)} revision ${hash}`);
  const buffer = bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength);
  const root = new FBXLoader().parse(buffer, `${dirname(path)}/`);
  const meshes = [];
  root.traverse((object) => { if (object.isMesh) meshes.push(object); });
  if (meshes.length !== 1) throw new Error(`${basename(path)} resolved ${meshes.length}/1 meshes`);
  const geometry = meshes[0].geometry;
  const position = geometry.getAttribute('position');
  const normal = geometry.getAttribute('normal');
  if (!position || !normal || geometry.index || position.count % 3 !== 0) {
    throw new Error(`${basename(path)} must remain a non-indexed position/normal triangle list`);
  }
  if (position.count / 3 !== expected.triangles) {
    throw new Error(`${basename(path)} has ${position.count / 3}/${expected.triangles} triangles`);
  }
  geometry.computeBoundingBox();
  const centerX = (geometry.boundingBox.min.x + geometry.boundingBox.max.x) * 0.5;
  const centerY = (geometry.boundingBox.min.y + geometry.boundingBox.max.y) * 0.5;
  const triangles = [];
  let maxRadius = 0;
  for (let offset = 0; offset < position.count; offset += 3) {
    const triangle = [];
    for (let corner = 0; corner < 3; corner++) {
      const index = offset + corner;
      const vertex = {
        position: [position.getX(index), position.getY(index), position.getZ(index)],
        normal: [normal.getX(index), normal.getY(index), normal.getZ(index)],
      };
      maxRadius = Math.max(
        maxRadius,
        Math.hypot(vertex.position[0] - centerX, vertex.position[1] - centerY),
      );
      triangle.push(vertex);
    }
    triangles.push(triangle);
  }
  return {
    sourceFile: basename(path),
    sourceSha256: hash,
    sourceBytes: bytes.length,
    sourceTriangles: triangles.length,
    centerX,
    centerY,
    maxRadius,
    sourceBounds: {
      min: geometry.boundingBox.min.toArray(),
      max: geometry.boundingBox.max.toArray(),
    },
    triangles,
  };
}

function interpolate(a, b, t) {
  const mix = (index) => a.position[index] + (b.position[index] - a.position[index]) * t;
  const nx = a.normal[0] + (b.normal[0] - a.normal[0]) * t;
  const ny = a.normal[1] + (b.normal[1] - a.normal[1]) * t;
  const nz = a.normal[2] + (b.normal[2] - a.normal[2]) * t;
  const length = Math.hypot(nx, ny, nz) || 1;
  return {
    position: [mix(0), mix(1), mix(2)],
    normal: [nx / length, ny / length, nz / length],
  };
}

function clipPlane(polygon, threshold, keepAbove) {
  if (!polygon.length) return polygon;
  const result = [];
  for (let index = 0; index < polygon.length; index++) {
    const current = polygon[index];
    const previous = polygon[(index + polygon.length - 1) % polygon.length];
    const currentInside = keepAbove
      ? current.position[2] >= threshold - 1e-8
      : current.position[2] <= threshold + 1e-8;
    const previousInside = keepAbove
      ? previous.position[2] >= threshold - 1e-8
      : previous.position[2] <= threshold + 1e-8;
    if (currentInside !== previousInside) {
      const denominator = current.position[2] - previous.position[2];
      const t = Math.abs(denominator) < 1e-12
        ? 0
        : (threshold - previous.position[2]) / denominator;
      result.push(interpolate(previous, current, t));
    }
    if (currentInside) result.push(current);
  }
  return result;
}

function clipped(triangle, minimumZ, maximumZ) {
  let polygon = triangle;
  if (minimumZ !== null) polygon = clipPlane(polygon, minimumZ, true);
  if (maximumZ !== null) polygon = clipPlane(polygon, maximumZ, false);
  return polygon;
}

function mappedVertex(vertex, centerX, centerY, axialRebase) {
  const [x, y, z] = vertex.position;
  const [nx, ny, nz] = vertex.normal;
  // FBX local +Z is the authored proximal direction. Convert it to the
  // component's conventional -Y direction with the proximal end at y=0.
  const normalLength = Math.hypot(nx, nz, -ny) || 1;
  return {
    position: [x - centerX, z - 0.5 + axialRebase, -(y - centerY)],
    normal: [nx / normalLength, nz / normalLength, -ny / normalLength],
  };
}

function encodePart(source, minimumZ, maximumZ, axialRebase) {
  const positions = [];
  const normals = [];
  for (const triangle of source.triangles) {
    const polygon = clipped(triangle, minimumZ, maximumZ);
    for (let index = 1; index + 1 < polygon.length; index++) {
      for (const vertex of [polygon[0], polygon[index], polygon[index + 1]]) {
        const mapped = mappedVertex(vertex, source.centerX, source.centerY, axialRebase);
        positions.push(...mapped.position);
        normals.push(...mapped.normal);
      }
    }
  }
  const positionArray = new Float32Array(positions);
  const normalArray = new Float32Array(normals);
  return {
    vertices: positionArray.length / 3,
    triangles: positionArray.length / 9,
    positionsBase64: Buffer.from(positionArray.buffer).toString('base64'),
    normalsBase64: Buffer.from(normalArray.buffer).toString('base64'),
  };
}

function smoothstep01(value) {
  const t = Math.min(1, Math.max(0, value));
  return t * t * (3 - 2 * t);
}

function decodePositions(part) {
  const buffer = Buffer.from(part.positionsBase64, 'base64');
  return new Float32Array(buffer.buffer, buffer.byteOffset, buffer.byteLength / 4);
}

function thicknessMorphDelta(positions, stretchFraction, proximalFade, distalFade) {
  const delta = new Float32Array(positions.length);
  for (let offset = 0; offset < positions.length; offset += 3) {
    const t = Math.min(1, Math.max(0, -positions[offset + 1] / stretchFraction));
    const weight = smoothstep01(Math.min(t / proximalFade, (1 - t) / distalFade));
    delta[offset] = positions[offset] * weight;
    delta[offset + 2] = positions[offset + 2] * weight;
  }
  return delta;
}

function signedTetraVolume(ax, ay, az, bx, by, bz, cx, cy, cz) {
  return (
    ax * (by * cz - bz * cy) +
    ay * (bz * cx - bx * cz) +
    az * (bx * cy - by * cx)
  ) / 6;
}

function boundaryRing(positions, targetY) {
  const unique = new Map();
  for (let offset = 0; offset < positions.length; offset += 3) {
    const x = positions[offset];
    const y = positions[offset + 1];
    const z = positions[offset + 2];
    if (Math.abs(y - targetY) > 1e-6) continue;
    unique.set(`${x},${z}`, [x, y, z]);
  }
  const ring = [...unique.values()].sort((a, b) =>
    Math.atan2(a[2], a[0]) - Math.atan2(b[2], b[0]));
  if (ring.length < 3) throw new Error(`shaft boundary at ${targetY} resolved ${ring.length} vertices`);
  return ring;
}

function closedShaftVolume(positions, delta, influence, stretchFraction) {
  let volume = 0;
  for (let offset = 0; offset < positions.length; offset += 9) {
    const p = (index) => positions[offset + index] + delta[offset + index] * influence;
    volume += signedTetraVolume(
      p(0), p(1), p(2),
      p(3), p(4), p(5),
      p(6), p(7), p(8),
    );
  }
  const addCap = (ring, reverse) => {
    const ordered = reverse ? [...ring].reverse() : ring;
    const centerY = ordered[0][1];
    for (let index = 0; index < ordered.length; index++) {
      const a = ordered[index];
      const b = ordered[(index + 1) % ordered.length];
      volume += signedTetraVolume(0, centerY, 0, ...a, ...b);
    }
  };
  addCap(boundaryRing(positions, 0), true);
  addCap(boundaryRing(positions, -stretchFraction), false);
  return volume;
}

function deriveThicknessMorph(
  part,
  stretchStart,
  stretchEnd,
  thicknessStart,
  thicknessEnd,
  expected,
) {
  const stretchFraction = stretchEnd - stretchStart;
  const proximalFade = (stretchStart - thicknessStart) / stretchFraction *
    expected.thicknessFadeMultiplier;
  const distalFade = (thicknessEnd - stretchEnd) / stretchFraction *
    expected.thicknessFadeMultiplier;
  if (!(proximalFade > 0 && distalFade > 0)) {
    throw new Error('measured shaft thickness collars must have positive width');
  }
  const positions = decodePositions(part);
  const upperRing = boundaryRing(positions, 0);
  const lowerRing = boundaryRing(positions, -stretchFraction);
  if (
    upperRing.length !== expected.upperRingVertices ||
    lowerRing.length !== expected.lowerRingVertices
  ) {
    throw new Error(
      `shaft rings resolved ${upperRing.length}/${lowerRing.length}; expected ` +
      `${expected.upperRingVertices}/${expected.lowerRingVertices}`,
    );
  }
  const delta = thicknessMorphDelta(positions, stretchFraction, proximalFade, distalFade);
  let volumes = [0, 1, 2].map((influence) =>
    closedShaftVolume(positions, delta, influence, stretchFraction));
  if (volumes[0] < 0) volumes = volumes.map((value) => -value);
  if (!(volumes[0] > 0) || !volumes.every(Number.isFinite)) {
    throw new Error('shaft volume derivation produced an invalid closed volume');
  }
  const v1 = volumes[1] / volumes[0];
  const v2 = volumes[2] / volumes[0];
  const volumeB = (v2 - 2 * v1 + 1) / 2;
  const volumeA = (v1 - 1 - volumeB) / 2;
  return {
    proximalFade,
    distalFade,
    closedRestVolume: volumes[0],
    volumeA,
    volumeB,
  };
}

function bakeAsset(source, expected) {
  const stretchStart = 0.5 - expected.upperBoundaryZ;
  const stretchEnd = 0.5 - expected.lowerBoundaryZ;
  const thicknessStart = 0.5 - expected.upperBlendZ;
  const thicknessEnd = 0.5 - expected.lowerBlendZ;
  const parts = {
    proximal: encodePart(source, expected.upperBoundaryZ, null, 0),
    shaft: encodePart(
      source,
      expected.lowerBoundaryZ,
      expected.upperBoundaryZ,
      stretchStart,
    ),
    distal: encodePart(source, null, expected.lowerBoundaryZ, stretchEnd),
  };
  const thicknessMorph = deriveThicknessMorph(
    parts.shaft,
    stretchStart,
    stretchEnd,
    thicknessStart,
    thicknessEnd,
    expected,
  );
  return {
    sourceFile: source.sourceFile,
    sourceSha256: source.sourceSha256,
    sourceBytes: source.sourceBytes,
    sourceTriangles: source.sourceTriangles,
    bakedTriangles: Object.values(parts).reduce((sum, part) => sum + part.triangles, 0),
    sourceBounds: source.sourceBounds,
    sourceMaxRadius: source.maxRadius,
    stretchStart,
    stretchEnd,
    thicknessStart,
    thicknessEnd,
    thicknessMorph,
    proximalKind: expected.proximalKind,
    distalKind: expected.distalKind,
    parts,
  };
}

function moduleSource(assets) {
  return `// Generated by tools/import-meshy-limb-bones.mjs. Do not hand-edit.\n` +
`// Owner-supplied Meshy derivatives; source/provenance lives in public/characters/meshy-limb-bones/.\n\n` +
`export const MESHY_LIMB_BONE_ASSETS = Object.freeze(${JSON.stringify(assets, null, 2)} as const);\n`;
}

function main() {
  const [bonePath, rattlePath, outputPath] = args();
  const assets = {
    schemaVersion: 1,
    ivoryBone: bakeAsset(parseMesh(bonePath, EXPECTED.ivoryBone), EXPECTED.ivoryBone),
    ivoryRattle: bakeAsset(parseMesh(rattlePath, EXPECTED.ivoryRattle), EXPECTED.ivoryRattle),
  };
  const source = moduleSource(assets);
  writeFileSync(outputPath, source);
  console.log(JSON.stringify({
    output: outputPath,
    bytes: Buffer.byteLength(source),
    sha256: sha256(Buffer.from(source)),
    assets: Object.fromEntries(Object.entries(assets)
      .filter(([, value]) => typeof value === 'object')
      .map(([key, value]) => [key, {
        sourceTriangles: value.sourceTriangles,
        bakedTriangles: value.bakedTriangles,
        stretchStart: value.stretchStart,
        stretchEnd: value.stretchEnd,
      }])),
  }, null, 2));
}

main();
