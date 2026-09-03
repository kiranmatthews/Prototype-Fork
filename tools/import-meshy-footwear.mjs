#!/usr/bin/env node
/**
 * Convert the owner-supplied Meshy shoe-and-sock FBX into synchronous Three.js
 * geometry plus deterministic connected-island IDs. Runtime code separates the
 * sock for knee/ankle skinning while keeping the shoe and laces rigid.
 *
 * Usage:
 *   node tools/import-meshy-footwear.mjs ASSET_DIRECTORY OUTPUT.ts
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
    name: 'Meshy_AI__0901063016_texture.fbx',
    bytes: 5386476,
    sha256: 'd9b49aa72ada43f841bb824c3743e05cf19d0b295403f931ff3a821ce8464f43',
    size: null,
  }),
  baseColor: Object.freeze({
    name: 'Meshy_AI__0901063016_texture.png',
    bytes: 4120902,
    sha256: '38d1c3b8d5d207444c9881ebc98032b5d88a238c6f74d9dd4980fe1129b69fda',
    size: [2048, 2048],
  }),
  normal: Object.freeze({
    name: 'Meshy_AI__0901063016_texture_normal.png',
    bytes: 3054405,
    sha256: '5a9578683c5b84f6a5dc61b6d570ef6bd64a26e9b33a0d22918821debf3cb5b6',
    size: [2048, 2048],
  }),
  roughness: Object.freeze({
    name: 'Meshy_AI__0901063016_texture_roughness.png',
    bytes: 1112045,
    sha256: '5f0aebd9b0611727ff542e0e47408df8a61bad10d4e17d1026a62020b5745b66',
    size: [2048, 2048],
  }),
  metallic: Object.freeze({
    name: 'Meshy_AI__0901063016_texture_metallic.png',
    bytes: 22300,
    sha256: 'd26688c74db4c63b442119c351d3be1dda116a2312fd0e057e9c962058d37ce1',
    size: [2048, 2048],
  }),
});

const EXPECTED = Object.freeze({
  vertices: 9405,
  indexedVertices: 2326,
  triangles: 3135,
  uniquePositions: 1677,
  islandTriangleCounts: Object.freeze([1898, 631, 156, 152, 138, 82, 78]),
  sockIslandId: 1,
  localBounds: Object.freeze({
    min: Object.freeze([-0.5, -0.26757800579071045, -0.3242189884185791]),
    max: Object.freeze([0.5, 0.265625, 0.32617199420928955]),
  }),
});

function installNodeFbxShims() {
  globalThis.ProgressEvent ??= class ProgressEvent {};
  globalThis.window ??= { URL: { createObjectURL: () => '', revokeObjectURL: () => {} } };
  globalThis.document ??= {
    createElementNS: () => ({ addEventListener() {}, removeEventListener() {}, set src(_value) {} }),
  };
}

const sha256 = (bytes) => createHash('sha256').update(bytes).digest('hex');

function argumentsFromCli() {
  const values = process.argv.slice(2);
  if (values.length !== 2) {
    throw new Error(`usage: node ${basename(fileURLToPath(import.meta.url))} ASSET_DIRECTORY OUTPUT.ts`);
  }
  return values.map((value) => resolve(value));
}

function validatedFile(assetDirectory, expected) {
  const bytes = readFileSync(resolve(assetDirectory, expected.name));
  const hash = sha256(bytes);
  if (bytes.length !== expected.bytes || hash !== expected.sha256) {
    throw new Error(`${expected.name} revision mismatch: ${bytes.length} bytes / ${hash}`);
  }
  return { bytes, hash };
}

function connectedIslandIds(position) {
  const parent = new Int32Array(position.count);
  const firstByPosition = new Map();
  for (let index = 0; index < parent.length; index++) parent[index] = index;
  const find = (value) => {
    let root = value;
    while (parent[root] !== root) root = parent[root];
    while (parent[value] !== value) {
      const next = parent[value];
      parent[value] = root;
      value = next;
    }
    return root;
  };
  const union = (a, b) => {
    const rootA = find(a);
    const rootB = find(b);
    if (rootA !== rootB) parent[rootB] = rootA;
  };
  for (let index = 0; index < position.count; index++) {
    const key = `${position.getX(index)},${position.getY(index)},${position.getZ(index)}`;
    const first = firstByPosition.get(key);
    if (first === undefined) firstByPosition.set(key, index);
    else union(index, first);
  }
  if (firstByPosition.size !== EXPECTED.uniquePositions) {
    throw new Error(`footwear unique-position count changed: ${firstByPosition.size}`);
  }
  for (let offset = 0; offset < position.count; offset += 3) {
    union(offset, offset + 1);
    union(offset, offset + 2);
  }
  const byRoot = new Map();
  for (let offset = 0; offset < position.count; offset += 3) {
    const root = find(offset);
    let component = byRoot.get(root);
    if (!component) {
      component = { root, first: offset, triangles: 0 };
      byRoot.set(root, component);
    }
    component.triangles++;
  }
  const components = [...byRoot.values()].sort((a, b) =>
    b.triangles - a.triangles || a.first - b.first);
  const counts = components.map((component) => component.triangles);
  if (JSON.stringify(counts) !== JSON.stringify(EXPECTED.islandTriangleCounts)) {
    throw new Error(`footwear islands changed: ${JSON.stringify(counts)}`);
  }
  const idByRoot = new Map(components.map((component, index) => [find(component.root), index]));
  const ids = new Uint8Array(position.count);
  for (let index = 0; index < position.count; index++) ids[index] = idByRoot.get(find(index));
  return { ids, components };
}

function parseFootwear(assetDirectory) {
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
    throw new Error('footwear must remain a non-indexed position/normal/uv triangle list');
  }
  if (
    position.count !== EXPECTED.vertices ||
    normal.count !== EXPECTED.vertices ||
    uv.count !== EXPECTED.vertices ||
    position.count / 3 !== EXPECTED.triangles
  ) throw new Error(`footwear topology changed: ${position.count} vertices`);
  geometry.computeBoundingBox();
  for (const [axis, index] of [['x', 0], ['y', 1], ['z', 2]]) {
    if (
      Math.abs(geometry.boundingBox.min[axis] - EXPECTED.localBounds.min[index]) > 1e-9 ||
      Math.abs(geometry.boundingBox.max[axis] - EXPECTED.localBounds.max[index]) > 1e-9
    ) throw new Error(`footwear ${axis} bounds changed`);
  }
  const islands = connectedIslandIds(position);
  const positions = new Float32Array(position.count * 3);
  const normals = new Float32Array(normal.count * 3);
  const uvs = new Float32Array(uv.count * 2);
  for (let index = 0; index < position.count; index++) {
    // Source toe points -X. Runtime is Y-up with rider-forward +Z.
    positions[index * 3] = -position.getY(index);
    positions[index * 3 + 1] = position.getZ(index);
    positions[index * 3 + 2] = -position.getX(index);
    normals[index * 3] = -normal.getY(index);
    normals[index * 3 + 1] = normal.getZ(index);
    normals[index * 3 + 2] = -normal.getX(index);
    uvs[index * 2] = uv.getX(index);
    uvs[index * 2 + 1] = uv.getY(index);
  }
  const indexed = indexGeneratedGeometry({
    position: { values: positions, itemSize: 3 },
    normal: { values: normals, itemSize: 3 },
    uv: { values: uvs, itemSize: 2 },
  }, islands.ids);
  if (indexed.attributes.position.length / 3 !== EXPECTED.indexedVertices) {
    throw new Error(
      `footwear indexed vertex count changed: ${indexed.attributes.position.length / 3}`,
    );
  }
  return {
    schemaVersion: 1,
    sourceFile: FILES.fbx.name,
    sourceSha256: sources.fbx.hash,
    sourceBytes: sources.fbx.bytes.length,
    vertices: position.count,
    indexedVertices: indexed.attributes.position.length / 3,
    triangles: position.count / 3,
    uniquePositions: EXPECTED.uniquePositions,
    sourceAttributes: ['position', 'smooth-normal', 'uv'],
    generatedAttributes: ['position', 'normal', 'uv', 'island-id', 'index'],
    sourceLocalBounds: EXPECTED.localBounds,
    runtimeBounds: {
      min: [-EXPECTED.localBounds.max[1], EXPECTED.localBounds.min[2], -EXPECTED.localBounds.max[0]],
      max: [-EXPECTED.localBounds.min[1], EXPECTED.localBounds.max[2], -EXPECTED.localBounds.min[0]],
    },
    islandTriangleCounts: islands.components.map((component) => component.triangles),
    sockIslandId: EXPECTED.sockIslandId,
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
    normalsBase64: encodeFloat32(indexed.attributes.normal),
    uvsBase64: encodeFloat32(indexed.attributes.uv),
    islandIdsBase64: Buffer.from(indexed.discriminator).toString('base64'),
    indicesBase64: encodeUint16(indexed.indices),
  };
}

function moduleSource(asset) {
  return `// Generated by tools/import-meshy-footwear.mjs. Do not hand-edit.\n` +
    `// Owner-supplied Meshy derivative; provenance lives in public/characters/meshy-footwear/.\n\n` +
    `export const MESHY_FOOTWEAR_ASSET = Object.freeze(${JSON.stringify(asset, null, 2)} as const);\n`;
}

function main() {
  const [assetDirectory, outputPath] = argumentsFromCli();
  const source = moduleSource(parseFootwear(assetDirectory));
  writeFileSync(outputPath, source);
  console.log(JSON.stringify({
    output: outputPath,
    bytes: Buffer.byteLength(source),
    sha256: sha256(Buffer.from(source)),
    triangles: EXPECTED.triangles,
  }, null, 2));
}

main();
