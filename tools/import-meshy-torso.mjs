#!/usr/bin/env node
/**
 * Convert the owner-supplied Meshy skeleton/tank-top FBX into synchronous
 * Three.js geometry. Textures remain external browser assets.
 *
 * Usage:
 *   node tools/import-meshy-torso.mjs ASSET_DIRECTORY OUTPUT.ts
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
    name: 'Meshy_AI_Skeleton_Tank_Top_0901063656_texture.fbx',
    bytes: 6433116,
    sha256: 'eb856706da34e7ffb2042599698c56aeda4db7783ed46c4775bad39cf4b10576',
  }),
  baseColor: Object.freeze({
    name: 'Meshy_AI_Skeleton_Tank_Top_0901063656_texture.png',
    bytes: 4888772,
    sha256: '96383c2536bd5cb93f1c0fcb6b0f51c2c7cc53b266d39d872b2c7629223cbbe9',
  }),
  normal: Object.freeze({
    name: 'Meshy_AI_Skeleton_Tank_Top_0901063656_texture_normal.png',
    bytes: 3738604,
    sha256: '94c41ac3342fe230c098a48e84acadf3c99b7ad17167db9a70872de129fdc62f',
  }),
  roughness: Object.freeze({
    name: 'Meshy_AI_Skeleton_Tank_Top_0901063656_texture_roughness.png',
    bytes: 1201865,
    sha256: '4bf04ca3f2ab635597b49b7dafc643f9584a1d0706c8ec3a302cecf4ece074ca',
  }),
  metallic: Object.freeze({
    name: 'Meshy_AI_Skeleton_Tank_Top_0901063656_texture_metallic.png',
    bytes: 22763,
    sha256: '032bd5dc23f0ddd41ffdc2122db60cad6c82acb83bad737d6c9d3fe72cf74342',
  }),
});

const EXPECTED = Object.freeze({
  vertices: 32667,
  triangles: 10889,
  localBounds: Object.freeze({
    min: Object.freeze([-0.34375, -0.275390625, -0.5]),
    max: Object.freeze([0.34375, 0.275390625, 0.5]),
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
    throw new Error(
      `${expected.name} revision mismatch: ${bytes.length} bytes / ${hash}`,
    );
  }
  return { path, bytes, hash };
}

function close(actual, expected, tolerance = 1e-9) {
  return Math.abs(actual - expected) <= tolerance;
}

function parseTorso(assetDirectory) {
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
    throw new Error('torso must remain a non-indexed position/normal/uv triangle list');
  }
  if (
    position.count !== EXPECTED.vertices ||
    normal.count !== EXPECTED.vertices ||
    uv.count !== EXPECTED.vertices ||
    position.count / 3 !== EXPECTED.triangles
  ) {
    throw new Error(`torso topology changed: ${position.count} vertices`);
  }
  geometry.computeBoundingBox();
  for (const [axis, index] of [['x', 0], ['y', 1], ['z', 2]]) {
    if (
      !close(geometry.boundingBox.min[axis], EXPECTED.localBounds.min[index]) ||
      !close(geometry.boundingBox.max[axis], EXPECTED.localBounds.max[index])
    ) {
      throw new Error(`torso ${axis} bounds changed`);
    }
  }

  const positions = new Float32Array(position.count * 3);
  const uvs = new Float32Array(uv.count * 2);
  for (let index = 0; index < position.count; index++) {
    // FBX local +Z is authored up. Match the character's +Y-up, +Z-forward
    // convention with the source node's proper -90-degree X rotation.
    positions[index * 3] = position.getX(index);
    positions[index * 3 + 1] = position.getZ(index);
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
        EXPECTED.localBounds.min[2],
        -EXPECTED.localBounds.max[1],
      ],
      max: [
        EXPECTED.localBounds.max[0],
        EXPECTED.localBounds.max[2],
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
          sourceSize: [2048, 2048],
        }]),
    ),
    positionsBase64: encodeFloat32(indexed.attributes.position),
    uvsBase64: encodeFloat32(indexed.attributes.uv),
    indicesBase64: encodeUint16(indexed.indices),
  };
}

function moduleSource(asset) {
  return `// Generated by tools/import-meshy-torso.mjs. Do not hand-edit.\n` +
    `// Owner-supplied Meshy derivative; provenance lives in public/characters/meshy-torso/.\n\n` +
    `export const MESHY_TORSO_ASSET = Object.freeze(${JSON.stringify(asset, null, 2)} as const);\n`;
}

function main() {
  const [assetDirectory, outputPath] = argumentsFromCli();
  const source = moduleSource(parseTorso(assetDirectory));
  writeFileSync(outputPath, source);
  console.log(JSON.stringify({
    output: outputPath,
    bytes: Buffer.byteLength(source),
    sha256: sha256(Buffer.from(source)),
    triangles: EXPECTED.triangles,
  }, null, 2));
}

main();
