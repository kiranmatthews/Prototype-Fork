#!/usr/bin/env node
/**
 * Bake the owner-supplied Meshy Stonecliff Bastion FBX to a small, decoder-free
 * GLB for the browser port.
 *
 * Usage:
 *   node tools/bake-beachfront-cliff.mjs SOURCE.fbx BASE_COLOR.png OUTPUT.glb
 *
 * The source's 2,270 triangles are retained exactly. Repeated corner
 * attributes are indexed, the base colour is reduced to one 512 px JPEG, and
 * the normal/metal/roughness maps are replaced with conservative scalar PBR
 * values. `sips` is used only for the deterministic image resize on macOS;
 * geometry conversion is performed by Three's FBXLoader.
 */

import { spawnSync } from "node:child_process";
import { createHash } from "node:crypto";
import { readFileSync, writeFileSync } from "node:fs";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { basename, dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { FBXLoader } from "three/examples/jsm/loaders/FBXLoader.js";

const COPYRIGHT =
  "Stonecliff Bastion — model created with Meshy — CC BY 4.0";
const EXPECTED_TRIANGLES = 2_270;
const EXPECTED_SOURCE_FBX_SHA256 =
  "32d2ce8cd2324a20e14a07d8abdd9e878630f7c4b3ba121ee39c5db14d6e94d9";
const EXPECTED_SOURCE_BASE_COLOR_SHA256 =
  "ebd2c38a57c87b978bc2bb7af04af58cf39333d43f6ab576ffa3bd1b2ee7a62f";

const align4 = (value) => (value + 3) & ~3;
const sha256 = (bytes) => createHash("sha256").update(bytes).digest("hex");

function usage() {
  const script = fileURLToPath(import.meta.url);
  const defaults = [
    "/Users/kiki/Developer/Board Platformer Unity/Assets/Game/Art/Environment/Beachfront/StonecliffBastion/StonecliffBastion.fbx",
    "/Users/kiki/Developer/Board Platformer Unity/Assets/Game/Art/Environment/Beachfront/StonecliffBastion/StonecliffBastion_BaseColor.png",
    resolve(dirname(script), "../public/beachfront/stonecliff-bastion.glb"),
  ];
  const values = process.argv.slice(2);
  if (values.includes("--help") || values.includes("-h")) {
    console.log(
      `usage: node ${basename(script)} SOURCE.fbx BASE_COLOR.png OUTPUT.glb`,
    );
    process.exit(0);
  }
  return values.length === 0 ? defaults : values;
}

function installNodeFbxShims() {
  // This FBX contains embedded image records. The web bake intentionally uses
  // the explicitly supplied base colour instead, so a non-loading image stub
  // is sufficient for FBXLoader's synchronous geometry parse.
  globalThis.ProgressEvent ??= class ProgressEvent {};
  globalThis.window ??= {
    URL: {
      createObjectURL: () => "",
      revokeObjectURL: () => {},
    },
  };
  globalThis.document ??= {
    createElementNS: () => ({
      addEventListener: () => {},
      removeEventListener: () => {},
      set src(_value) {},
    }),
  };
}

function parseLargestMesh(sourcePath, sourceBytes) {
  installNodeFbxShims();
  const arrayBuffer = sourceBytes.buffer.slice(
    sourceBytes.byteOffset,
    sourceBytes.byteOffset + sourceBytes.byteLength,
  );
  const root = new FBXLoader().parse(arrayBuffer, `${dirname(sourcePath)}/`);
  let subject = null;
  root.traverse((object) => {
    if (!object.isMesh) return;
    const count = object.geometry.index?.count
      ?? object.geometry.getAttribute("position")?.count
      ?? 0;
    const best = subject
      ? subject.geometry.index?.count
        ?? subject.geometry.getAttribute("position")?.count
        ?? 0
      : -1;
    if (count > best) subject = object;
  });
  if (!subject) throw new Error("Stonecliff FBX contains no mesh geometry");
  return subject.geometry;
}

function indexGeometry(geometry) {
  const position = geometry.getAttribute("position");
  const normal = geometry.getAttribute("normal");
  const uv = geometry.getAttribute("uv");
  if (!position || !normal || !uv)
    throw new Error("Stonecliff FBX requires position, normal and UV attributes");
  if (position.count % 3 !== 0)
    throw new Error("Stonecliff source is not a triangle list");
  const triangleCount = position.count / 3;
  if (triangleCount !== EXPECTED_TRIANGLES)
    throw new Error(
      `Stonecliff source has ${triangleCount} triangles; expected ${EXPECTED_TRIANGLES}`,
    );

  geometry.computeBoundingBox();
  const bounds = geometry.boundingBox;
  const centerX = (bounds.min.x + bounds.max.x) * 0.5;
  const centerY = (bounds.min.y + bounds.max.y) * 0.5;

  const positions = [];
  const normals = [];
  const uvs = [];
  const indices = [];
  const unique = new Map();

  const indexForCorner = (corner) => {
    // Float32 attribute components stringify deterministically and preserve
    // every authored UV/normal seam while merging identical FBX corners.
    const values = [
      position.getX(corner) - centerX,
      position.getZ(corner) - bounds.min.z,
      position.getY(corner) - centerY,
      normal.getX(corner),
      normal.getZ(corner),
      normal.getY(corner),
      uv.getX(corner),
      1 - uv.getY(corner),
    ];
    const key = values.join(",");
    const found = unique.get(key);
    if (found !== undefined) return found;
    const next = unique.size;
    unique.set(key, next);
    positions.push(...values.slice(0, 3));
    normals.push(...values.slice(3, 6));
    uvs.push(...values.slice(6, 8));
    return next;
  };

  for (let corner = 0; corner < position.count; corner += 3) {
    const a = indexForCorner(corner);
    const b = indexForCorner(corner + 1);
    const c = indexForCorner(corner + 2);
    // Swapping source Y/Z reflects handedness. Reverse winding so the GLB
    // remains front-face culled without a double-sided material.
    indices.push(a, c, b);
  }
  if (unique.size > 65_535)
    throw new Error("Stonecliff web mesh no longer fits 16-bit indices");

  const min = [Infinity, Infinity, Infinity];
  const max = [-Infinity, -Infinity, -Infinity];
  for (let index = 0; index < positions.length; index += 3) {
    for (let axis = 0; axis < 3; axis++) {
      const value = positions[index + axis];
      min[axis] = Math.min(min[axis], value);
      max[axis] = Math.max(max[axis], value);
    }
  }
  return {
    triangleCount,
    vertexCount: unique.size,
    positions: new Float32Array(positions),
    normals: new Float32Array(normals),
    uvs: new Float32Array(uvs),
    indices: new Uint16Array(indices),
    min,
    max,
    sourceBounds: {
      min: bounds.min.toArray(),
      max: bounds.max.toArray(),
    },
  };
}

function encodeGlb(web, jpeg, provenance) {
  const chunks = [];
  const views = [];
  let byteOffset = 0;
  const append = (bytes, target) => {
    const data = Buffer.from(bytes.buffer, bytes.byteOffset, bytes.byteLength);
    const paddedLength = align4(data.length);
    const padded = Buffer.alloc(paddedLength);
    data.copy(padded);
    chunks.push(padded);
    const view = { buffer: 0, byteOffset, byteLength: data.length };
    if (target) view.target = target;
    views.push(view);
    byteOffset += paddedLength;
    return views.length - 1;
  };
  const positionView = append(web.positions, 34962);
  const normalView = append(web.normals, 34962);
  const uvView = append(web.uvs, 34962);
  const indexView = append(web.indices, 34963);
  const imageView = append(new Uint8Array(jpeg));

  const document = {
    asset: {
      version: "2.0",
      generator: "Board Platformer Stonecliff web bake",
      copyright: COPYRIGHT,
      extras: {
        license: "CC BY 4.0",
        sourceModelSha256: provenance.sourceModelSha256,
        sourceBaseColorSha256: provenance.sourceBaseColorSha256,
      },
    },
    scene: 0,
    scenes: [{ name: "StonecliffBastion_Web", nodes: [0] }],
    nodes: [{ name: "StonecliffBastion_Meshy", mesh: 0 }],
    meshes: [
      {
        name: "StonecliffBastion_2270tri",
        primitives: [
          {
            attributes: { POSITION: 0, NORMAL: 1, TEXCOORD_0: 2 },
            indices: 3,
            material: 0,
            mode: 4,
          },
        ],
        extras: { visualOnly: true, sourceTriangles: web.triangleCount },
      },
    ],
    materials: [
      {
        name: "StonecliffBastion_Web_Matte",
        pbrMetallicRoughness: {
          baseColorFactor: [1, 1, 1, 1],
          baseColorTexture: { index: 0, texCoord: 0 },
          metallicFactor: 0.03,
          roughnessFactor: 0.84,
        },
      },
    ],
    textures: [{ name: "StonecliffBastion_BaseColor_512", sampler: 0, source: 0 }],
    samplers: [
      {
        magFilter: 9729,
        minFilter: 9987,
        wrapS: 10497,
        wrapT: 10497,
      },
    ],
    images: [
      {
        name: "StonecliffBastion_BaseColor_512",
        mimeType: "image/jpeg",
        bufferView: imageView,
      },
    ],
    accessors: [
      {
        bufferView: positionView,
        componentType: 5126,
        count: web.vertexCount,
        type: "VEC3",
        min: web.min,
        max: web.max,
      },
      {
        bufferView: normalView,
        componentType: 5126,
        count: web.vertexCount,
        type: "VEC3",
      },
      {
        bufferView: uvView,
        componentType: 5126,
        count: web.vertexCount,
        type: "VEC2",
      },
      {
        bufferView: indexView,
        componentType: 5123,
        count: web.triangleCount * 3,
        type: "SCALAR",
        min: [0],
        max: [web.vertexCount - 1],
      },
    ],
    bufferViews: views,
    buffers: [{ byteLength: byteOffset }],
  };

  let json = Buffer.from(JSON.stringify(document));
  const paddedJson = Buffer.alloc(align4(json.length), 0x20);
  json.copy(paddedJson);
  const bin = Buffer.concat(chunks);
  const totalLength = 12 + 8 + paddedJson.length + 8 + bin.length;
  const header = Buffer.alloc(12);
  header.write("glTF", 0, "ascii");
  header.writeUInt32LE(2, 4);
  header.writeUInt32LE(totalLength, 8);
  const jsonHeader = Buffer.alloc(8);
  jsonHeader.writeUInt32LE(paddedJson.length, 0);
  jsonHeader.writeUInt32LE(0x4e4f534a, 4);
  const binHeader = Buffer.alloc(8);
  binHeader.writeUInt32LE(bin.length, 0);
  binHeader.writeUInt32LE(0x004e4942, 4);
  return Buffer.concat([header, jsonHeader, paddedJson, binHeader, bin]);
}

async function main() {
  const [sourceArg, colorArg, outputArg, ...extra] = usage();
  if (!sourceArg || !colorArg || !outputArg || extra.length)
    throw new Error("expected SOURCE.fbx BASE_COLOR.png OUTPUT.glb");
  const sourcePath = resolve(sourceArg);
  const colorPath = resolve(colorArg);
  const outputPath = resolve(outputArg);
  const sourceBytes = readFileSync(sourcePath);
  const colorBytes = readFileSync(colorPath);
  const sourceModelSha256 = sha256(sourceBytes);
  const sourceBaseColorSha256 = sha256(colorBytes);
  if (sourceModelSha256 !== EXPECTED_SOURCE_FBX_SHA256)
    throw new Error(`unexpected Stonecliff FBX revision ${sourceModelSha256}`);
  if (sourceBaseColorSha256 !== EXPECTED_SOURCE_BASE_COLOR_SHA256)
    throw new Error(`unexpected Stonecliff base-colour revision ${sourceBaseColorSha256}`);

  const temporary = await mkdtemp(join(tmpdir(), "stonecliff-web-"));
  try {
    const jpegPath = join(temporary, "StonecliffBastion_BaseColor_512.jpg");
    const resized = spawnSync(
      "/usr/bin/sips",
      [
        "-s",
        "format",
        "jpeg",
        "-s",
        "formatOptions",
        "55",
        "-z",
        "512",
        "512",
        colorPath,
        "--out",
        jpegPath,
      ],
      { encoding: "utf8" },
    );
    if (resized.status !== 0)
      throw new Error(`sips JPEG conversion failed: ${resized.stderr.trim()}`);
    const jpeg = readFileSync(jpegPath);
    const geometry = indexGeometry(parseLargestMesh(sourcePath, sourceBytes));
    const glb = encodeGlb(geometry, jpeg, {
      sourceModelSha256,
      sourceBaseColorSha256,
    });
    writeFileSync(outputPath, glb);
    console.log(
      JSON.stringify(
        {
          sourceTriangles: geometry.triangleCount,
          webTriangles: geometry.triangleCount,
          indexedVertices: geometry.vertexCount,
          embeddedJpegBytes: jpeg.length,
          bytes: glb.length,
          sha256: sha256(glb),
          sourceBounds: geometry.sourceBounds,
          output: outputPath,
        },
        null,
        2,
      ),
    );
  } finally {
    await rm(temporary, { force: true, recursive: true });
  }
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
