#!/usr/bin/env node
/**
 * Convert the owner-supplied Meshy denim shorts FBX into synchronous Three.js
 * geometry plus deterministic connected-island IDs for code-native skinning.
 *
 * Usage:
 *   node tools/import-meshy-shorts.mjs ASSET_DIRECTORY OUTPUT.ts
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
    name: 'Meshy_AI_Midnight_Chain_Denim__0901065952_texture.fbx',
    bytes: 26409884,
    sha256: 'ca74185a56d5fd9552088486b59ea4c836e1ac8228919a3743760cb8468629e5',
    size: null,
  }),
  baseColor: Object.freeze({
    name: 'Meshy_AI_Midnight_Chain_Denim__0901065952_texture.png',
    bytes: 23565301,
    sha256: 'f752df5e7125043b708b53a6b2181d6ce3f3da07c2830fb58c6da5e7c9a998b7',
    size: [4096, 4096],
  }),
  normal: Object.freeze({
    name: 'Meshy_AI_Midnight_Chain_Denim__0901065952_texture_normal.png',
    bytes: 22197458,
    sha256: 'aba3d20ff1e1f0ff5ae6cd139a59b839ea6f1ff0a8518feffb194531f9323ab2',
    size: [4096, 4096],
  }),
  roughness: Object.freeze({
    name: 'Meshy_AI_Midnight_Chain_Denim__0901065952_texture_roughness.png',
    bytes: 1341705,
    sha256: '06f7c31e31d5731846a067e8cd1cfc91decd6ebad228979a7bb250eae7b4ae87',
    size: [2048, 2048],
  }),
  metallic: Object.freeze({
    name: 'Meshy_AI_Midnight_Chain_Denim__0901065952_texture_metallic.png',
    bytes: 245018,
    sha256: 'cae1e4d45272ee47762a826261134be15f23604c0a6fc0a93823cfcc47d2fdec',
    size: [2048, 2048],
  }),
});

const EXPECTED = Object.freeze({
  vertices: 32196,
  triangles: 10732,
  islands: 45,
  mainIslandTriangles: 5041,
  localBounds: Object.freeze({
    min: Object.freeze([-0.5, -0.302734375, -0.3515625]),
    max: Object.freeze([0.5, 0.306640625, 0.357421875]),
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
  if (
    components.length !== EXPECTED.islands ||
    components[0]?.triangles !== EXPECTED.mainIslandTriangles
  ) {
    throw new Error(
      `shorts islands changed: ${components.length} islands, ` +
      `${components[0]?.triangles ?? 0} main triangles`,
    );
  }
  const idByRoot = new Map(components.map((component, index) => [find(component.root), index]));
  const ids = new Uint8Array(position.count);
  for (let index = 0; index < position.count; index++) ids[index] = idByRoot.get(find(index));
  return { ids, components };
}

function parseShorts(assetDirectory) {
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
    throw new Error('shorts must remain a non-indexed position/normal/uv triangle list');
  }
  if (
    position.count !== EXPECTED.vertices ||
    normal.count !== EXPECTED.vertices ||
    uv.count !== EXPECTED.vertices ||
    position.count / 3 !== EXPECTED.triangles
  ) throw new Error(`shorts topology changed: ${position.count} vertices`);
  geometry.computeBoundingBox();
  for (const [axis, index] of [['x', 0], ['y', 1], ['z', 2]]) {
    if (
      Math.abs(geometry.boundingBox.min[axis] - EXPECTED.localBounds.min[index]) > 1e-9 ||
      Math.abs(geometry.boundingBox.max[axis] - EXPECTED.localBounds.max[index]) > 1e-9
    ) throw new Error(`shorts ${axis} bounds changed`);
  }
  const islands = connectedIslandIds(position);
  const positions = new Float32Array(position.count * 3);
  const uvs = new Float32Array(uv.count * 2);
  for (let index = 0; index < position.count; index++) {
    positions[index * 3] = position.getX(index);
    positions[index * 3 + 1] = position.getZ(index);
    positions[index * 3 + 2] = -position.getY(index);
    uvs[index * 2] = uv.getX(index);
    uvs[index * 2 + 1] = uv.getY(index);
  }
  const indexed = indexGeneratedGeometry({
    position: { values: positions, itemSize: 3 },
    uv: { values: uvs, itemSize: 2 },
  }, islands.ids);
  return {
    schemaVersion: 1,
    sourceFile: FILES.fbx.name,
    sourceSha256: sources.fbx.hash,
    sourceBytes: sources.fbx.bytes.length,
    vertices: position.count,
    indexedVertices: indexed.attributes.position.length / 3,
    triangles: position.count / 3,
    sourceAttributes: ['position', 'faceted-normal', 'uv'],
    generatedAttributes: ['position', 'uv', 'island-id', 'index'],
    sourceLocalBounds: EXPECTED.localBounds,
    runtimeBounds: {
      min: [EXPECTED.localBounds.min[0], EXPECTED.localBounds.min[2], -EXPECTED.localBounds.max[1]],
      max: [EXPECTED.localBounds.max[0], EXPECTED.localBounds.max[2], -EXPECTED.localBounds.min[1]],
    },
    islandTriangleCounts: islands.components.map((component) => component.triangles),
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
    islandIdsBase64: Buffer.from(indexed.discriminator).toString('base64'),
    indicesBase64: encodeUint16(indexed.indices),
  };
}

function moduleSource(asset) {
  return `// Generated by tools/import-meshy-shorts.mjs. Do not hand-edit.\n` +
    `// Owner-supplied Meshy derivative; provenance lives in public/characters/meshy-shorts/.\n\n` +
    `export const MESHY_SHORTS_ASSET = Object.freeze(${JSON.stringify(asset, null, 2)} as const);\n`;
}

function main() {
  const [assetDirectory, outputPath] = argumentsFromCli();
  const source = moduleSource(parseShorts(assetDirectory));
  writeFileSync(outputPath, source);
  console.log(JSON.stringify({
    output: outputPath,
    bytes: Buffer.byteLength(source),
    sha256: sha256(Buffer.from(source)),
    triangles: EXPECTED.triangles,
  }, null, 2));
}

main();
