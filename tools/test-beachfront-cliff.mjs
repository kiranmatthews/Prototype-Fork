import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { readFileSync, statSync } from "node:fs";
import { resolve } from "node:path";
import { pathToFileURL } from "node:url";
import ts from "typescript";

const root = resolve(import.meta.dirname, "..");
const assetPath = resolve(root, "public/beachfront/stonecliff-bastion.glb");
const sourcePath = resolve(root, "src/beachfrontCliff.ts");
const coursePath = resolve(root, "src/beachfrontCourse.ts");
const read = (path) => readFileSync(path, "utf8");
const sha256 = (bytes) =>
  createHash("sha256").update(bytes).digest("hex");

function parseGlb(bytes) {
  assert.equal(bytes.toString("ascii", 0, 4), "glTF", "GLB magic");
  assert.equal(bytes.readUInt32LE(4), 2, "GLB version");
  assert.equal(bytes.readUInt32LE(8), bytes.length, "GLB total length");
  const jsonLength = bytes.readUInt32LE(12);
  assert.equal(bytes.readUInt32LE(16), 0x4e4f534a, "JSON chunk type");
  const document = JSON.parse(
    bytes.toString("utf8", 20, 20 + jsonLength).trimEnd(),
  );
  const binaryHeader = 20 + jsonLength;
  const binaryLength = bytes.readUInt32LE(binaryHeader);
  assert.equal(bytes.readUInt32LE(binaryHeader + 4), 0x004e4942, "BIN chunk type");
  const binary = bytes.subarray(binaryHeader + 8, binaryHeader + 8 + binaryLength);
  assert.equal(binary.length, document.buffers[0].byteLength);
  return { document, binary };
}

function jpegDimensions(bytes) {
  assert.equal(bytes[0], 0xff);
  assert.equal(bytes[1], 0xd8);
  let offset = 2;
  while (offset + 8 < bytes.length) {
    while (bytes[offset] === 0xff) offset++;
    const marker = bytes[offset++];
    if (marker === 0xd9 || marker === 0xda) break;
    const length = bytes.readUInt16BE(offset);
    if ([0xc0, 0xc1, 0xc2, 0xc3, 0xc5, 0xc6, 0xc7, 0xc9, 0xca, 0xcb, 0xcd, 0xce, 0xcf].includes(marker)) {
      return {
        height: bytes.readUInt16BE(offset + 3),
        width: bytes.readUInt16BE(offset + 5),
      };
    }
    offset += length;
  }
  throw new Error("embedded Stonecliff JPEG has no SOF marker");
}

function accessorBytes(document, binary, accessorIndex) {
  const accessor = document.accessors[accessorIndex];
  const view = document.bufferViews[accessor.bufferView];
  const start = (view.byteOffset ?? 0) + (accessor.byteOffset ?? 0);
  return binary.subarray(start, start + view.byteLength);
}

function transpile(path) {
  return ts.transpileModule(read(path), {
    compilerOptions: {
      module: ts.ModuleKind.ESNext,
      target: ts.ScriptTarget.ES2022,
    },
  }).outputText;
}

const dataUrl = (source) =>
  `data:text/javascript;base64,${Buffer.from(source).toString("base64")}`;

async function loadTransformAuthority() {
  const courseUrl = dataUrl(transpile(coursePath));
  const threeUrl = pathToFileURL(
    resolve(root, "node_modules/three/build/three.module.js"),
  ).href;
  const loaderUrl = pathToFileURL(
    resolve(root, "node_modules/three/examples/jsm/loaders/GLTFLoader.js"),
  ).href;
  const source = transpile(sourcePath)
    .replace('from "three";', `from "${threeUrl}";`)
    .replace(
      'from "three/examples/jsm/loaders/GLTFLoader.js";',
      `from "${loaderUrl}";`,
    )
    .replace('from "./beachfrontCourse";', `from "${courseUrl}";`);
  return import(dataUrl(source));
}

const bytes = readFileSync(assetPath);
assert.equal(statSync(assetPath).size, 161_696, "stable compact asset size");
assert.ok(bytes.length < 200 * 1024, "Stonecliff GLB stays under 200 KiB");
assert.equal(
  sha256(bytes),
  "a0c437610c97bc43feb6f54af44213de08df273839fadb19ce741d45d13f86bb",
  "deterministic Stonecliff GLB hash",
);

const { document, binary } = parseGlb(bytes);
assert.equal(document.extensionsUsed, undefined, "decoder-free core glTF");
assert.equal(document.extensionsRequired, undefined, "no required decoder");
assert.match(document.asset.copyright, /Meshy.*CC BY 4\.0/i);
assert.equal(document.asset.extras.license, "CC BY 4.0");
assert.equal(
  document.asset.extras.sourceModelSha256,
  "32d2ce8cd2324a20e14a07d8abdd9e878630f7c4b3ba121ee39c5db14d6e94d9",
);
assert.equal(document.meshes.length, 1);
assert.equal(document.materials.length, 1);
assert.equal(document.images.length, 1);
assert.equal(document.images[0].mimeType, "image/jpeg");
assert.equal(document.materials[0].doubleSided, undefined, "front-face culling retained");
assert.equal(
  document.materials[0].pbrMetallicRoughness.roughnessFactor,
  0.84,
);
assert.equal(
  document.materials[0].pbrMetallicRoughness.metallicFactor,
  0.03,
);

const primitive = document.meshes[0].primitives[0];
const positionAccessor = document.accessors[primitive.attributes.POSITION];
const indexAccessor = document.accessors[primitive.indices];
assert.equal(positionAccessor.count, 2_994, "indexed attribute vertices");
assert.equal(indexAccessor.count, 6_810, "exact 2,270 source triangles");
assert.equal(indexAccessor.componentType, 5123, "compact uint16 indices");
assert.deepEqual(positionAccessor.min, [-0.5, 0, -0.2744145095348358]);
assert.deepEqual(positionAccessor.max, [0.5, 0.5566409826278687, 0.2744145095348358]);

const indices = new Uint16Array(
  accessorBytes(document, binary, primitive.indices).buffer,
  accessorBytes(document, binary, primitive.indices).byteOffset,
  indexAccessor.count,
);
assert.ok(Math.max(...indices) < positionAccessor.count, "indices remain in range");

const imageView = document.bufferViews[document.images[0].bufferView];
const jpeg = binary.subarray(
  imageView.byteOffset,
  imageView.byteOffset + imageView.byteLength,
);
assert.deepEqual(jpegDimensions(jpeg), { width: 512, height: 512 });
assert.ok(jpeg.length < 64 * 1024, "embedded base colour remains compact");

const module = await loadTransformAuthority();
assert.equal(module.BEACHFRONT_CLIFF_INSTANCE_COUNT, 150);
assert.equal(module.BEACHFRONT_CLIFF_CHUNK_COUNT, 15);
assert.equal(module.BEACHFRONT_CLIFF_CHUNK_SIZE, 10);
assert.equal(module.beachfrontCliffVariation01(0, 11), 0.7274294333117862);
assert.equal(module.beachfrontCliffVariation01(49, 107), 0.35781063782040107);

const transforms = module.buildBeachfrontCliffTransforms();
assert.equal(transforms.length, 150);
assert.equal(transforms.filter((value) => !value.backing).length, 100);
assert.equal(transforms.filter((value) => value.backing).length, 50);
assert.equal(transforms.filter((value) => value.mirrored).length, 61);
assert.equal(transforms.filter((value) => value.sheared).length, 50);
assert.equal(transforms.filter((value) => value.uniform).length, 27);
assert.equal(transforms[0].distance, 0);
assert.equal(transforms[99].distance, 740);
assert.equal(transforms[100].distance, 7.4);
assert.equal(transforms[149].distance, 732.6);
assert.deepEqual(transforms[0].scale, [
  10.545830639948287,
  10.545830639948287,
  10.545830639948287,
]);
assert.deepEqual(transforms[0].position, [
  10.863018555910648,
  0.5245603680030717,
  22.490361732050214,
]);
assert.deepEqual(
  transforms,
  module.buildBeachfrontCliffTransforms(),
  "Stonecliff transforms are deterministic",
);

const runtimeSource = read(sourcePath);
assert.match(runtimeSource, /let started = false/);
assert.match(runtimeSource, /if \(started\) return/);
assert.match(runtimeSource, /new THREE\.InstancedMesh/);
assert.match(runtimeSource, /userData\.visualOnly = true/);
assert.match(runtimeSource, /computeBoundingSphere\(\)/);

const readme = read(resolve(root, "public/beachfront/README.md"));
assert.match(readme, /CC BY 4\.0/);
assert.match(readme, /presentation-only/i);
assert.match(readme, /2,270 source triangles/);

console.log(
  `Beachfront Stonecliff OK: 2,270 triangles, 150 transforms, ` +
    `${bytes.length} bytes, ${sha256(bytes)}`,
);
