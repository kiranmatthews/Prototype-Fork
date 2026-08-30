import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { fileURLToPath, pathToFileURL } from "node:url";
import path from "node:path";
import ts from "typescript";
import * as THREE from "three";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const source = readFileSync(path.join(root, "src/unitySandMaterial.ts"), "utf8");
const transpiled = ts.transpileModule(source, {
  compilerOptions: {
    target: ts.ScriptTarget.ES2020,
    module: ts.ModuleKind.ESNext,
  },
  fileName: "unitySandMaterial.ts",
}).outputText;
const threeUrl = pathToFileURL(
  path.join(root, "node_modules/three/build/three.module.js"),
).href;
const executable = transpiled
  .replace('from "three"', `from "${threeUrl}"`)
  .replaceAll("import.meta.env.BASE_URL", '"/"');
const moduleUrl = `data:text/javascript;base64,${Buffer.from(executable).toString("base64")}`;
const {
  UNITY_SAND_AO_PROGRAM_KEY,
  UNITY_SAND_ASSETS,
  UNITY_SAND_TILE_METRES,
  UnitySandMaterialOwner,
  applyUnitySandMetricUvs,
  createUnitySandMaterial,
  unitySandAssetUrls,
} = await import(moduleUrl);

assert.equal(UNITY_SAND_TILE_METRES, 5.4);
assert.equal(UNITY_SAND_AO_PROGRAM_KEY, "unity-sand-ao-green-v1");
assert.deepEqual(UNITY_SAND_ASSETS, {
  color: "sand-color.png",
  normal: "sand-normal.png",
  mask: "sand-mask.png",
});
assert.deepEqual(unitySandAssetUrls("/prototype/water/matrixrex"), {
  color: "/prototype/water/matrixrex/sand-color.png",
  normal: "/prototype/water/matrixrex/sand-normal.png",
  mask: "/prototype/water/matrixrex/sand-mask.png",
});

const loadedUrls = [];
const owner = createUnitySandMaterial({
  name: "CoastalStreet_Showcase1Sand",
  assetBaseUrl: "/prototype/water/matrixrex/",
  loadTexture: (url) => {
    loadedUrls.push(url);
    return new THREE.Texture();
  },
});
assert.ok(owner instanceof UnitySandMaterialOwner);
assert.deepEqual(loadedUrls, Object.values(owner.urls));
assert.equal(owner.disposed, false);
assert.equal(owner.ownsTextures, true);

const material = owner.material;
assert.ok(material instanceof THREE.MeshStandardMaterial);
assert.equal(material.name, "CoastalStreet_Showcase1Sand");
assert.equal(material.color.getHex(), 0xffffff);
assert.equal(material.map, owner.maps.color);
assert.equal(material.normalMap, owner.maps.normal);
assert.deepEqual(material.normalScale.toArray(), [0.5, 0.5]);
assert.equal(material.aoMap, owner.maps.mask);
assert.equal(material.aoMapIntensity, 1);
assert.equal(material.metalness, 0);
assert.equal(material.roughness, 1);
assert.equal(material.emissive.getHex(), 0x000000);
assert.equal(material.emissiveIntensity, 0);
assert.equal(material.userData.unitySandTileMetres, 5.4);
assert.equal(material.customProgramCacheKey(), UNITY_SAND_AO_PROGRAM_KEY);

for (const [role, texture] of Object.entries(owner.maps)) {
  assert.equal(texture.wrapS, THREE.RepeatWrapping, `${role} wrapS`);
  assert.equal(texture.wrapT, THREE.RepeatWrapping, `${role} wrapT`);
  assert.deepEqual(texture.repeat.toArray(), [1, 1], `${role} repeat`);
  assert.deepEqual(texture.offset.toArray(), [0, 0], `${role} offset`);
  assert.equal(texture.minFilter, THREE.LinearMipmapNearestFilter, `${role} min`);
  assert.equal(texture.magFilter, THREE.LinearFilter, `${role} mag`);
  assert.equal(texture.generateMipmaps, true, `${role} mipmaps`);
}
assert.equal(owner.maps.color.colorSpace, THREE.SRGBColorSpace);
assert.equal(owner.maps.normal.colorSpace, THREE.NoColorSpace);
assert.equal(owner.maps.mask.colorSpace, THREE.NoColorSpace);
assert.equal(owner.maps.color.name, "MatrixRex sand-color.png");
assert.equal(owner.maps.normal.name, "MatrixRex sand-normal.png");
assert.equal(owner.maps.mask.name, "MatrixRex sand-mask.png");

const shader = {
  fragmentShader: "before texture2D( aoMap, vAoMapUv ).r after",
};
material.onBeforeCompile(shader);
assert.equal(
  shader.fragmentShader,
  "before texture2D( aoMap, vAoMapUv ).g after",
  "AO must read MatrixRex mask green",
);

const geometry = new THREE.BufferGeometry();
geometry.setAttribute(
  "position",
  new THREE.Float32BufferAttribute(
    [0, 0, 0, 5.4, 0, 0, 0, 0, -10.8],
    3,
  ),
);
assert.equal(
  applyUnitySandMetricUvs(geometry, { offsetMetres: [5.4, 0] }),
  geometry,
);
const uv = geometry.getAttribute("uv");
const uv1 = geometry.getAttribute("uv1");
const uv2 = geometry.getAttribute("uv2");
assert.deepEqual(Array.from(uv.array), [1, 0, 2, 0, 1, 2]);
assert.deepEqual(Array.from(uv1.array), Array.from(uv.array));
assert.deepEqual(Array.from(uv2.array), Array.from(uv.array));
assert.notEqual(uv1, uv, "secondary UVs must not alias the primary attribute");
assert.notEqual(uv2, uv, "secondary UVs must not alias the primary attribute");

const diagonal = new THREE.BufferGeometry();
diagonal.setAttribute(
  "position",
  new THREE.Float32BufferAttribute([3, 0, 4], 3),
);
applyUnitySandMetricUvs(diagonal, {
  tileMetres: 1,
  uAxis: [3, 0, 4],
  vAxis: [0, 1, 0],
  offsetMetres: [0, 2],
});
assert.deepEqual(Array.from(diagonal.getAttribute("uv").array), [5, 2]);
assert.throws(
  () => applyUnitySandMetricUvs(new THREE.BufferGeometry()),
  /position attribute/,
);
assert.throws(
  () => applyUnitySandMetricUvs(geometry, { tileMetres: 0 }),
  /finite and positive/,
);
assert.throws(
  () => applyUnitySandMetricUvs(geometry, { uAxis: [0, 0, 0] }),
  /U axis/,
);

let materialDisposals = 0;
let textureDisposals = 0;
material.addEventListener("dispose", () => materialDisposals++);
for (const texture of Object.values(owner.maps)) {
  texture.addEventListener("dispose", () => textureDisposals++);
}
owner.dispose();
owner.dispose();
assert.equal(owner.disposed, true);
assert.equal(materialDisposals, 1, "material disposal must be idempotent");
assert.equal(textureDisposals, 3, "owned maps must each dispose exactly once");

const externalOwner = createUnitySandMaterial({
  ownsTextures: false,
  loadTexture: () => new THREE.Texture(),
});
let externalMaterialDisposals = 0;
let externalTextureDisposals = 0;
externalOwner.material.addEventListener(
  "dispose",
  () => externalMaterialDisposals++,
);
for (const texture of Object.values(externalOwner.maps)) {
  texture.addEventListener("dispose", () => externalTextureDisposals++);
}
externalOwner.dispose();
assert.equal(externalMaterialDisposals, 1);
assert.equal(externalTextureDisposals, 0, "external cache retains map ownership");

console.log(
  "Validated reusable Unity sand maps, metric 5.4m UVs, green-channel AO, and idempotent ownership.",
);
