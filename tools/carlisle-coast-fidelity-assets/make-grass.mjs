/** Code-authored, opaque Carlisle grass. Run with the project's Node runtime.
 * No source textures, alpha cards, billboards or generated model service.
 * All blade centres follow a curved 3D spine; a third of near blades have a
 * folded cross-section. Two metre-derived LOD meshes share one material. */
import fs from 'node:fs/promises';
import path from 'node:path';
import crypto from 'node:crypto';
import { fileURLToPath } from 'node:url';
import * as THREE from 'three';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const destination = path.join(root, 'public/carlisle-coast-fidelity');
const hash = value => {
  const result = Math.sin(value * 127.1 + 311.7) * 43758.5453123;
  return result - Math.floor(result);
};
const lerp = (a, b, t) => a + (b - a) * t;
const color = (r, g, b) => new THREE.Color().setRGB(r, g, b);

function bladeDefinitions(seed, straw) {
  return Array.from({ length: 72 }, (_, index) => {
    const angle = index * 2.399963229728653 + seed * .17;
    const radius = .40 * Math.sqrt((index + .6) / 72);
    const rootAngle = angle + (hash(seed + index * 1.7) - .5) * .38;
    const dry = hash(seed + index * 7.31) < straw;
    return {
      index, x: Math.cos(rootAngle) * radius, z: Math.sin(rootAngle) * radius,
      heading: angle + (hash(seed + index * 2.5) - .5) * 1.9,
      height: lerp(.135, .325, hash(seed + index * 3.7)),
      width: lerp(.015, .036, hash(seed + index * 5.8)),
      lean: lerp(.045, .165, hash(seed + index * 4.4)),
      curl: lerp(-.038, .038, hash(seed + index * 6.13)),
      dry, tint: lerp(1, 1.07, hash(seed + index * 3.2)),
    };
  });
}

function tuft(definitions, lod) {
  const positions = [], indices = [], colors = [], uvs = [], flex = [], ao = [];
  const segments = lod ? 3 : 4;
  const selected = lod ? Array.from({ length: 32 }, (_, i) => definitions[Math.floor(i * definitions.length / 32)]) : definitions;
  const add = (position, texcoord, blade, t) => {
    const id = positions.length / 3;
    positions.push(...position); uvs.push(...texcoord);
    // These are linear colours, deliberately bright enough to retain an
    // olive silhouette through the shaded coastal material treatment.
    const lower = blade.dry ? color(.40, .45, .20) : color(.35, .45, .14);
    const middle = blade.dry ? color(.53, .54, .28) : color(.43, .53, .18);
    const upper = blade.dry ? color(.65, .59, .33) : color(.48, .55, .22);
    const shade = t < .5 ? lower.lerp(middle, t * 2) : middle.lerp(upper, (t - .5) * 2);
    shade.multiplyScalar(blade.tint);
    colors.push(shade.r, shade.g, shade.b);
    flex.push(t ** 1.8); ao.push(.82 + .18 * Math.sqrt(t));
    return id;
  };
  for (const blade of selected) {
    const direction = [Math.cos(blade.heading), Math.sin(blade.heading)];
    const side = [-direction[1], direction[0]];
    const folded = !lod && blade.index % 3 === 0;
    const columns = folded ? 3 : 2, rows = [];
    for (let segment = 0; segment < segments; segment++) {
      const t = segment / segments;
      const spread = blade.lean * (t ** 1.75 - .15 * t ** 4);
      const curl = blade.curl * Math.sin(t * Math.PI * .83) * t;
      const centre = [blade.x + direction[0] * spread + side[0] * curl,
        blade.height * (1.12 * t - .12 * t * t),
        blade.z + direction[1] * spread + side[1] * curl];
      const halfWidth = blade.width * .5 * ((1 - t) ** .62) * (1 + .13 * Math.sin(t * Math.PI));
      const row = [];
      for (let column = 0; column < columns; column++) {
        const across = columns === 3 ? column - 1 : column * 2 - 1;
        const ridge = folded && column === 1 ? halfWidth * .25 : 0;
        row.push(add([centre[0] + side[0] * halfWidth * across + direction[0] * ridge,
          centre[1], centre[2] + side[1] * halfWidth * across + direction[1] * ridge],
        [column / (columns - 1), t], blade, t));
      }
      rows.push(row);
    }
    for (let row = 0; row < rows.length - 1; row++) for (let column = 0; column < columns - 1; column++) {
      const a = rows[row][column], b = rows[row][column + 1], c = rows[row + 1][column], d = rows[row + 1][column + 1];
      indices.push(a, c, b, b, c, d);
    }
    const spread = blade.lean * .85, curl = blade.curl * Math.sin(Math.PI * .83);
    const tip = add([blade.x + direction[0] * spread + side[0] * curl, blade.height,
      blade.z + direction[1] * spread + side[1] * curl], [.5, 1], blade, 1);
    for (let column = 0; column < columns - 1; column++)
      indices.push(rows.at(-1)[column], tip, rows.at(-1)[column + 1]);
  }
  const bounds = [0, 1, 2].map(axis => {
    const values = positions.filter((_, index) => index % 3 === axis);
    return [Math.min(...values), Math.max(...values)];
  });
  const sourceSpan = bounds.map(([low, high]) => high - low);
  for (let vertex = 0; vertex < positions.length / 3; vertex++) for (let axis = 0; axis < 3; axis++)
    positions[vertex * 3 + axis] = (positions[vertex * 3 + axis] - bounds[axis][0]) / sourceSpan[axis] - (axis === 1 ? 0 : .5);
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
  geometry.setIndex(indices); geometry.computeVertexNormals();
  const normals = Array.from(geometry.getAttribute('normal').array); geometry.dispose();
  return { positions, indices, normals, colors, uvs, flex, ao, sourceSpan, blades: selected.length };
}

function packGlb(name, lods) {
  const binary = [], bufferViews = [], accessors = [];
  let byteLength = 0;
  const append = (typed, type, target, min, max) => {
    const padding = (4 - byteLength % 4) % 4;
    if (padding) { binary.push(Buffer.alloc(padding)); byteLength += padding; }
    const data = Buffer.from(typed.buffer, typed.byteOffset, typed.byteLength);
    const view = bufferViews.length;
    bufferViews.push({ buffer: 0, byteOffset: byteLength, byteLength: data.length, target });
    binary.push(data); byteLength += data.length;
    const columns = { SCALAR: 1, VEC2: 2, VEC3: 3 }[type];
    const accessor = { bufferView: view, componentType: typed instanceof Uint16Array ? 5123 : 5126,
      count: typed.length / columns, type };
    if (min) accessor.min = min;
    if (max) accessor.max = max;
    accessors.push(accessor); return accessors.length - 1;
  };
  const meshes = lods.map((lod, index) => ({ name: `${name}_LOD${index}`, primitives: [{
    attributes: {
      POSITION: append(new Float32Array(lod.positions), 'VEC3', 34962, [-.5, 0, -.5], [.5, 1, .5]),
      NORMAL: append(new Float32Array(lod.normals), 'VEC3', 34962),
      COLOR_0: append(new Float32Array(lod.colors), 'VEC3', 34962),
      TEXCOORD_0: append(new Float32Array(lod.uvs), 'VEC2', 34962),
      _WIND_FLEX: append(new Float32Array(lod.flex), 'SCALAR', 34962, [0], [1]),
      _JUNGLE_AO: append(new Float32Array(lod.ao), 'SCALAR', 34962, [.82], [1]),
    }, indices: append(new Uint16Array(lod.indices), 'SCALAR', 34963), material: 0, mode: 4,
  }] }));
  const bin = Buffer.concat(binary);
  const document = {
    asset: { version: '2.0', generator: 'Carlisle Coast code-authored opaque curved grass',
      copyright: 'Apache-2.0; authored for Prototype Fork.',
      extras: { textureBytes: 0, codeAuthored: true, atlasRequired: false } },
    scene: 0, scenes: [{ nodes: [0, 1] }],
    nodes: meshes.map((mesh, index) => ({ name: mesh.name, mesh: index })), meshes,
    materials: [{ name: 'Carlisle muted olive grass and straw', doubleSided: true, alphaMode: 'OPAQUE',
      pbrMetallicRoughness: { baseColorFactor: [1, 1, 1, 1], metallicFactor: 0, roughnessFactor: .96 } }],
    buffers: [{ byteLength: bin.length }], bufferViews, accessors,
  };
  const rawJson = Buffer.from(JSON.stringify(document)), jsonPadding = (4 - rawJson.length % 4) % 4;
  const json = Buffer.concat([rawJson, Buffer.alloc(jsonPadding, 0x20)]);
  const binaryPadding = (4 - bin.length % 4) % 4;
  const paddedBin = Buffer.concat([bin, Buffer.alloc(binaryPadding)]);
  const header = Buffer.alloc(12), jsonHeader = Buffer.alloc(8), binaryHeader = Buffer.alloc(8);
  header.writeUInt32LE(0x46546c67, 0); header.writeUInt32LE(2, 4);
  header.writeUInt32LE(28 + json.length + paddedBin.length, 8);
  jsonHeader.writeUInt32LE(json.length, 0); jsonHeader.writeUInt32LE(0x4e4f534a, 4);
  binaryHeader.writeUInt32LE(paddedBin.length, 0); binaryHeader.writeUInt32LE(0x004e4942, 4);
  return Buffer.concat([header, jsonHeader, json, binaryHeader, paddedBin]);
}

await fs.mkdir(destination, { recursive: true });
for (const [name, seed, straw] of [['grass-tuft-a', 811, .085], ['grass-tuft-b', 1229, .29]]) {
  const definitions = bladeDefinitions(seed, straw), lods = [tuft(definitions, false), tuft(definitions, true)];
  for (const lod of lods) {
    for (const values of [lod.positions, lod.normals, lod.colors, lod.uvs, lod.flex, lod.ao])
      if (!values.every(Number.isFinite)) throw new Error(`${name}: nonfinite mesh attribute`);
    if (lod.indices.some(index => index < 0 || index >= lod.positions.length / 3)) throw new Error(`${name}: invalid index`);
    if (Math.min(...lod.flex) !== 0 || Math.max(...lod.flex) !== 1) throw new Error(`${name}: unrooted wind flex`);
    for (let index = 0; index < lod.positions.length / 3; index++)
      if (lod.positions[index * 3 + 1] < 1e-7 && lod.flex[index] !== 0) throw new Error(`${name}: moving root`);
    if (lod.colors.some(value => value < 0 || value > 1)) throw new Error(`${name}: invalid linear colour`);
  }
  const glb = packGlb(name, lods), sha256 = crypto.createHash('sha256').update(glb).digest('hex');
  await fs.writeFile(path.join(destination, `${name}.glb`), glb);
  const manifest = {
    name, codeAuthored: true, license: 'Apache-2.0', authoringSource: 'tools/carlisle-coast-fidelity-assets/make-grass.mjs',
    triangles: lods[0].indices.length / 3, lodTriangles: lods[1].indices.length / 3,
    blades: lods[0].blades, lodBlades: lods[1].blades,
    bendSegments: 4, lodBendSegments: 3, foldedNearBlades: 24,
    originalBladeWidthMetres: [.015, .036],
    oliveLinearRootMinimum: [.35, .45, .14], oliveLinearTipMinimum: [.48, .55, .22],
    originalMetreSpan: lods[0].sourceSpan, originalHeightMetres: lods[0].sourceSpan[1],
    defaultSize: [1.15, .32, 1.15], normalizedBoundsGltf: [[-.5, 0, -.5], [.5, 1, .5]],
    materials: 1, textureBytes: 0, alphaMode: 'OPAQUE', doubleSided: true,
    attributes: { COLOR_0: 'linear RGB olive/straw root-to-tip colour',
      _WIND_FLEX: 'exactly zero at planted roots, smooth t^1.8 to exactly one at each tip',
      _JUNGLE_AO: 'analytic contact gradient 0.82 at root to 1 at tip; indirect light only' },
    bytes: glb.length, sha256,
    placement: 'Normalized X/Z [-.5,.5], Y [0,1], bottom anchored. Fine individual opaque blades; no support collision.',
  };
  await fs.writeFile(path.join(destination, `${name}-manifest.json`), `${JSON.stringify(manifest, null, 2)}\n`);
  console.log(JSON.stringify({ name, triangles: manifest.triangles, lodTriangles: manifest.lodTriangles,
    bytes: glb.length, originalHeightMetres: manifest.originalHeightMetres, sha256 }));
}
