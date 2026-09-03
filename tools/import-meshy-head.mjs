#!/usr/bin/env node
/**
 * Convert the owner-supplied Meshy Crowned Inferno Skull FBX into synchronous
 * Three.js geometry. PBR textures remain external browser assets.
 *
 * Usage:
 *   node tools/import-meshy-head.mjs ASSET_DIRECTORY OUTPUT.ts
 */

import { createHash } from 'node:crypto';
import { readFileSync, writeFileSync } from 'node:fs';
import { basename, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { FBXLoader } from 'three/examples/jsm/loaders/FBXLoader.js';
import {
  encodeFloat32,
  encodeUint16,
  indexGeneratedGeometry,
} from './index-generated-geometry.mjs';

const FILES = Object.freeze({
  fbx: Object.freeze({
    name: 'Meshy_AI_Crowned_Inferno_Skull_0901100025_texture.fbx',
    bytes: 12633388,
    sha256: '7ce05ff91c0b33ff3845c0e5a24610eeb51d3851abf25167e22910ed93f0b234',
    size: null,
  }),
  baseColor: Object.freeze({
    name: 'Meshy_AI_Crowned_Inferno_Skull_0901100025_texture.png',
    bytes: 13339517,
    sha256: 'e62fa53008279d36884368e82cf55106cc0673fc0c0e111e85ef673aa7eb7319',
    size: [4096, 4096],
  }),
  normal: Object.freeze({
    name: 'Meshy_AI_Crowned_Inferno_Skull_0901100025_texture_normal.png',
    bytes: 9355443,
    sha256: '0979609c7b373805c340644b35ac06180218cd21b2189ba3625cba5db512f6a8',
    size: [4096, 4096],
  }),
  roughness: Object.freeze({
    name: 'Meshy_AI_Crowned_Inferno_Skull_0901100025_texture_roughness.png',
    bytes: 1109088,
    sha256: '7820a7c3ac368b3c4505f7bdd21859c8f65e6cbdfdc81ca2c584ebcfa187145b',
    size: [2048, 2048],
  }),
  metallic: Object.freeze({
    name: 'Meshy_AI_Crowned_Inferno_Skull_0901100025_texture_metallic.png',
    bytes: 18377,
    sha256: '9a05f4ad0dc1046e3731bf19b9c883b9bc0bc514192d02747cb7f205566bb84f',
    size: [2048, 2048],
  }),
});

const EXPECTED = Object.freeze({
  vertices: 49608,
  triangles: 16536,
  localBounds: Object.freeze({
    min: Object.freeze([-0.427734375, -0.375, -0.5]),
    max: Object.freeze([0.427734375, 0.369140625, 0.5]),
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

function argumentsFromCli() {
  const values = process.argv.slice(2);
  if (values.length !== 2) {
    throw new Error(`usage: node ${basename(fileURLToPath(import.meta.url))} ASSET_DIRECTORY OUTPUT.ts`);
  }
  return values.map((value) => resolve(value));
}

function validatedFile(assetDirectory, expected) {
  const path = resolve(assetDirectory, expected.name);
  const bytes = readFileSync(path);
  const hash = sha256(bytes);
  if (bytes.length !== expected.bytes || hash !== expected.sha256) {
    throw new Error(`${expected.name} revision mismatch: ${bytes.length} bytes / ${hash}`);
  }
  return { bytes, hash };
}

function close(actual, expected, tolerance = 1e-9) {
  return Math.abs(actual - expected) <= tolerance;
}

function parseHead(assetDirectory) {
  installNodeFbxShims();
  const sources = Object.fromEntries(
    Object.entries(FILES).map(([role, expected]) => [role, validatedFile(assetDirectory, expected)]),
  );
  const bytes = sources.fbx.bytes;
  const buffer = bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength);
  const originalWarn = console.warn;
  console.warn = () => {};
  let root;
  try {
    root = new FBXLoader().parse(buffer, `${assetDirectory}/`);
  } finally {
    console.warn = originalWarn;
  }
  const meshes = [];
  const bones = [];
  root.traverse((object) => {
    if (object.isMesh) meshes.push(object);
    if (object.isBone) bones.push(object);
  });
  if (meshes.length !== 1 || bones.length !== 0 || root.animations.length !== 0) {
    throw new Error(
      `expected one static mesh; resolved ${meshes.length} meshes, ` +
      `${bones.length} bones, ${root.animations.length} clips`,
    );
  }
  const geometry = meshes[0].geometry;
  const position = geometry.getAttribute('position');
  const normal = geometry.getAttribute('normal');
  const uv = geometry.getAttribute('uv');
  if (!position || !normal || !uv || geometry.index) {
    throw new Error('head must remain a non-indexed position/normal/uv triangle list');
  }
  if (
    position.count !== EXPECTED.vertices ||
    normal.count !== EXPECTED.vertices ||
    uv.count !== EXPECTED.vertices ||
    position.count / 3 !== EXPECTED.triangles
  ) throw new Error(`head topology changed: ${position.count} vertices`);
  geometry.computeBoundingBox();
  for (const [axis, index] of [['x', 0], ['y', 1], ['z', 2]]) {
    if (
      !close(geometry.boundingBox.min[axis], EXPECTED.localBounds.min[index]) ||
      !close(geometry.boundingBox.max[axis], EXPECTED.localBounds.max[index])
    ) throw new Error(`head ${axis} bounds changed`);
  }

  const positions = new Float32Array(position.count * 3);
  const uvs = new Float32Array(uv.count * 2);
  for (let index = 0; index < position.count; index++) {
    positions[index * 3] = position.getX(index);
    // Rebase the lowest source point to the semantic head origin so neckHeight
    // is a literal air gap rather than a scale/deformation operation.
    positions[index * 3 + 1] = position.getZ(index) + 0.5;
    positions[index * 3 + 2] = -position.getY(index);
    uvs[index * 2] = uv.getX(index);
    uvs[index * 2 + 1] = uv.getY(index);
  }
  const indexed = indexGeneratedGeometry({
    position: { values: positions, itemSize: 3 },
    uv: { values: uvs, itemSize: 2 },
  });
  return {
    schemaVersion: 1,
    sourceFile: FILES.fbx.name,
    sourceSha256: sources.fbx.hash,
    sourceBytes: sources.fbx.bytes.length,
    vertices: position.count,
    indexedVertices: indexed.attributes.position.length / 3,
    triangles: position.count / 3,
    sourceAttributes: ['position', 'faceted-normal', 'uv'],
    generatedAttributes: ['position', 'uv', 'index'],
    sourceLocalBounds: EXPECTED.localBounds,
    runtimeBounds: {
      min: [
        EXPECTED.localBounds.min[0],
        0,
        -EXPECTED.localBounds.max[1],
      ],
      max: [
        EXPECTED.localBounds.max[0],
        1,
        -EXPECTED.localBounds.min[1],
      ],
    },
    textureSources: Object.fromEntries(
      Object.entries(FILES)
        .filter(([role]) => role !== 'fbx')
        .map(([role, expected]) => [role, {
          sourceFile: expected.name,
          sourceBytes: expected.bytes,
          sourceSha256: expected.sha256,
          sourceSize: expected.size,
        }]),
    ),
    positionsBase64: encodeFloat32(indexed.attributes.position),
    uvsBase64: encodeFloat32(indexed.attributes.uv),
    indicesBase64: encodeUint16(indexed.indices),
  };
}

function moduleSource(asset) {
  return `// Generated by tools/import-meshy-head.mjs. Do not hand-edit.\n` +
    `// Owner-supplied Meshy derivative; provenance lives in public/characters/meshy-head/.\n\n` +
    `export const MESHY_HEAD_ASSET = Object.freeze(${JSON.stringify(asset, null, 2)} as const);\n`;
}

function main() {
  const [assetDirectory, outputPath] = argumentsFromCli();
  const source = moduleSource(parseHead(assetDirectory));
  writeFileSync(outputPath, source);
  console.log(JSON.stringify({
    output: outputPath,
    bytes: Buffer.byteLength(source),
    sha256: sha256(Buffer.from(source)),
    triangles: EXPECTED.triangles,
  }, null, 2));
}

main();
