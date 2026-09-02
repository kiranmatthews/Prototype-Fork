#!/usr/bin/env node
/** Convert the owner-supplied alternate Meshy head FBX into browser geometry. */

import { createHash } from 'node:crypto';
import { readFileSync, writeFileSync } from 'node:fs';
import { basename, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { FBXLoader } from 'three/examples/jsm/loaders/FBXLoader.js';

const FILES = Object.freeze({
  fbx: Object.freeze({
    name: 'Meshy_AI_Coco_Bandicoot_0902221249_texture.fbx',
    bytes: 15229580,
    sha256: '3785121eba8296c773d3d41834ae2e44eb4b7da471576772fe4eea0c1d9aacf3',
  }),
  baseColor: Object.freeze({
    name: 'Meshy_AI_Coco_Bandicoot_0902221249_texture.png',
    bytes: 17629373,
    sha256: '3eb292fa71eb8efc8308e992c50616b933b9c5d4d376fbd68428d65d2029b530',
  }),
  normal: Object.freeze({
    name: 'Meshy_AI_Coco_Bandicoot_0902221249_texture_normal.png',
    bytes: 11657174,
    sha256: 'eb364755973788c23d4dea84705bbead526fec39f8a59b00e527f8fe5c57e698',
  }),
  roughness: Object.freeze({
    name: 'Meshy_AI_Coco_Bandicoot_0902221249_texture_roughness.png',
    bytes: 1182785,
    sha256: 'df4df5f209df475392ffaa88da8345820340b5cef008acbe7d086b69957b5e2b',
  }),
  metallic: Object.freeze({
    name: 'Meshy_AI_Coco_Bandicoot_0902221249_texture_metallic.png',
    bytes: 18764,
    sha256: '9c7f6fcbb8a67e14bc3dc28d8b6e5e056ba8700bda9ad96c52edc106a30d9acb',
  }),
});

const EXPECTED = Object.freeze({
  vertices: 46902,
  triangles: 15634,
  localBounds: Object.freeze({
    min: Object.freeze([-0.5, -0.26171875, -0.392578125]),
    max: Object.freeze([0.5, 0.259765625, 0.396484375]),
  }),
});

function installNodeFbxShims() {
  globalThis.ProgressEvent ??= class ProgressEvent {};
  globalThis.window ??= {
    URL: { createObjectURL: () => '', revokeObjectURL: () => {} },
  };
  globalThis.document ??= {
    createElementNS: () => ({
      addEventListener() {}, removeEventListener() {}, set src(_value) {},
    }),
  };
}

function sha256(bytes) {
  return createHash('sha256').update(bytes).digest('hex');
}

function cliArguments() {
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

function encodeFloat32(values) {
  const typed = values instanceof Float32Array ? values : new Float32Array(values);
  return Buffer.from(typed.buffer, typed.byteOffset, typed.byteLength).toString('base64');
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
      `expected one static head mesh; resolved ${meshes.length} meshes, ` +
      `${bones.length} bones, ${root.animations.length} clips`,
    );
  }
  const geometry = meshes[0].geometry;
  const position = geometry.getAttribute('position');
  const normal = geometry.getAttribute('normal');
  const uv = geometry.getAttribute('uv');
  if (!position || !normal || !uv || geometry.index) {
    throw new Error('alternate head must remain a non-indexed position/normal/uv triangle list');
  }
  if (
    position.count !== EXPECTED.vertices || normal.count !== EXPECTED.vertices ||
    uv.count !== EXPECTED.vertices || position.count / 3 !== EXPECTED.triangles
  ) throw new Error(`alternate head topology changed: ${position.count} vertices`);
  geometry.computeBoundingBox();
  for (const [axis, index] of [['x', 0], ['y', 1], ['z', 2]]) {
    if (
      geometry.boundingBox.min[axis] !== EXPECTED.localBounds.min[index] ||
      geometry.boundingBox.max[axis] !== EXPECTED.localBounds.max[index]
    ) throw new Error(`alternate head ${axis} bounds changed`);
  }

  const positions = new Float32Array(position.count * 3);
  const uvs = new Float32Array(uv.count * 2);
  const sourceBottom = EXPECTED.localBounds.min[2];
  for (let index = 0; index < position.count; index++) {
    positions[index * 3] = position.getX(index);
    positions[index * 3 + 1] = position.getZ(index) - sourceBottom;
    positions[index * 3 + 2] = -position.getY(index);
    uvs[index * 2] = uv.getX(index);
    uvs[index * 2 + 1] = uv.getY(index);
  }
  return {
    schemaVersion: 1,
    sourceFile: FILES.fbx.name,
    sourceSha256: sources.fbx.hash,
    sourceBytes: sources.fbx.bytes.length,
    vertices: position.count,
    triangles: position.count / 3,
    sourceAttributes: ['position', 'faceted-normal', 'uv'],
    generatedAttributes: ['position', 'uv'],
    sourceLocalBounds: EXPECTED.localBounds,
    runtimeBounds: {
      min: [EXPECTED.localBounds.min[0], 0, -EXPECTED.localBounds.max[1]],
      max: [EXPECTED.localBounds.max[0], EXPECTED.localBounds.max[2] - sourceBottom, -EXPECTED.localBounds.min[1]],
    },
    textureSources: Object.fromEntries(
      Object.entries(FILES).filter(([role]) => role !== 'fbx').map(([role, expected]) => [role, {
        sourceFile: expected.name,
        sourceBytes: expected.bytes,
        sourceSha256: expected.sha256,
      }]),
    ),
    positionsBase64: encodeFloat32(positions),
    uvsBase64: encodeFloat32(uvs),
  };
}

function moduleSource(asset) {
  return `// Generated by tools/import-meshy-coco-head.mjs. Do not hand-edit.\n` +
    `// Owner-supplied Meshy alternate-head evaluation asset.\n\n` +
    `export const MESHY_COCO_HEAD_ASSET = Object.freeze(${JSON.stringify(asset, null, 2)} as const);\n`;
}

const [assetDirectory, outputPath] = cliArguments();
const source = moduleSource(parseHead(assetDirectory));
writeFileSync(outputPath, source);
console.log(JSON.stringify({
  output: outputPath,
  bytes: Buffer.byteLength(source),
  sha256: sha256(Buffer.from(source)),
  triangles: EXPECTED.triangles,
}, null, 2));
