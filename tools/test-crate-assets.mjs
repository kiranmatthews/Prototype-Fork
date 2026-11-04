import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import * as THREE from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { createServer } from 'vite';

// Exercise exported geometry without a browser image decoder. Remove only
// texture references from this in-memory test copy, retaining every vertex,
// index, normal, transform and material primitive of the actual GLB.
async function readAsset(name) {
  const bytes = await readFile(new URL(`../public/props/crate-family/${name}.glb`, import.meta.url));
  const jsonLength = bytes.readUInt32LE(12), json = JSON.parse(bytes.subarray(20, 20 + jsonLength).toString());
  const hasPbr = json.materials?.some(m => m.normalTexture && m.pbrMetallicRoughness?.metallicRoughnessTexture);
  for (const material of json.materials ?? []) {
    delete material.normalTexture; delete material.occlusionTexture; delete material.emissiveTexture;
    if (material.pbrMetallicRoughness) { delete material.pbrMetallicRoughness.baseColorTexture; delete material.pbrMetallicRoughness.metallicRoughnessTexture; }
  }
  json.images = []; json.textures = []; json.samplers = [];
  const raw = Buffer.from(JSON.stringify(json)), padded = Buffer.alloc(Math.ceil(raw.length / 4) * 4, 32); raw.copy(padded);
  const binary = bytes.subarray(20 + jsonLength), header = Buffer.alloc(20);
  header.writeUInt32LE(0x46546c67, 0); header.writeUInt32LE(2, 4); header.writeUInt32LE(20 + padded.length + binary.length, 8);
  header.writeUInt32LE(padded.length, 12); header.writeUInt32LE(0x4e4f534a, 16);
  const glb = Buffer.concat([header, padded, binary]);
  const result = await new GLTFLoader().parseAsync(glb.buffer.slice(glb.byteOffset, glb.byteOffset + glb.length), '');
  result.scene.updateMatrixWorld(true);
  const sourceBounds = new THREE.Box3().setFromObject(result.scene);
  const sourceCenter = sourceBounds.getCenter(new THREE.Vector3()), sourceSize = sourceBounds.getSize(new THREE.Vector3());
  let triangles = 0, surfaceArea = 0;
  const meshes = [], bounds = new THREE.Box3();
  result.scene.traverse(node => {
    if (!node.isMesh) return;
    const g = node.geometry.clone().applyMatrix4(node.matrixWorld);
    if (name === 'metal-sculpt') g.translate(-sourceCenter.x,-sourceCenter.y,-sourceCenter.z).scale(1/sourceSize.x,1/sourceSize.y,1/sourceSize.z);
    const p = g.getAttribute('position');
    assert.ok(Array.from(p.array).every(Number.isFinite), `${name}: non-finite positions`);
    const count = g.index?.count ?? p.count; triangles += count / 3; g.computeBoundingBox(); bounds.union(g.boundingBox);
    const material = Array.isArray(node.material) ? node.material[0] : node.material;
    const fresh = material.name.includes('Fresh split');
    if (!fresh) {
      const a = new THREE.Vector3(), b = new THREE.Vector3(), c = new THREE.Vector3();
      for (let i = 0; i < count; i += 3) {
        a.fromBufferAttribute(p, g.index ? g.index.getX(i) : i);
        b.fromBufferAttribute(p, g.index ? g.index.getX(i + 1) : i + 1);
        c.fromBufferAttribute(p, g.index ? g.index.getX(i + 2) : i + 2);
        surfaceArea += b.sub(a).cross(c.sub(a)).length() * .5;
      }
    }
    meshes.push(new THREE.Mesh(g, new THREE.MeshBasicMaterial({ side: THREE.FrontSide })));
  });
  assert.ok(triangles <= 30000, `${name}: exceeds the absolute model triangle budget`);
  return { meshes, triangles, bounds, surfaceArea, bytes: bytes.length, hasPbr };
}
const wood = await readAsset('wood-sculpt'), broken = await readAsset('wood-fracture'), brace = await readAsset('wood-brace'), stick = await readAsset('explosive-stick'), metal = await readAsset('metal-sculpt'), steelPieces = await readAsset('metal-fracture');
const cage = await readAsset('multihit-cage'), cagePieces = await readAsset('multihit-fracture');
assert.equal(wood.triangles, 8052, 'approved intact geometry was changed');
assert.equal(stick.triangles, 1970, 'approved stick geometry was changed');
assert.equal(metal.triangles, 7661, 'Completed Tripo metal geometry was changed');
assert.ok(metal.hasPbr, 'metal must retain its own normal/metalness/roughness maps');
for (const asset of [wood, broken, metal, steelPieces, cage, cagePieces]) {
  assert.ok(asset.bounds.min.toArray().every(n => n >= -.56), 'fragment escaped the source minimum bounds');
  assert.ok(asset.bounds.max.toArray().every(n => n <= .56), 'fragment escaped the source maximum bounds');
}
assert.ok(Math.abs(broken.surfaceArea - wood.surfaceArea) < wood.surfaceArea * .001, 'fracture does not preserve the actual exterior surface');
assert.ok(Math.abs(steelPieces.surfaceArea - metal.surfaceArea) < metal.surfaceArea * .001, 'steel fracture does not preserve the Tripo exterior');
assert.ok(Math.abs(cagePieces.surfaceArea - cage.surfaceArea) < cage.surfaceArea * .0001, 'cage fracture loses or duplicates the actual timber exterior');
for (const [name, asset] of [['wood', wood], ['metal', metal], ['multihit', cage]])
  for (const axis of [new THREE.Vector3(1,0,0),new THREE.Vector3(-1,0,0),new THREE.Vector3(0,1,0),new THREE.Vector3(0,-1,0),new THREE.Vector3(0,0,1),new THREE.Vector3(0,0,-1)]) {
    const ray = new THREE.Raycaster(asset.bounds.getCenter(new THREE.Vector3()).addScaledVector(axis,3),axis.clone().negate());
    assert.ok(ray.intersectObjects(asset.meshes,false).length,`${name} has no outward face along ${axis.toArray()}`);
  }
const authoring = JSON.parse(await readFile(new URL('../public/props/crate-family/fracture-authoring.json',import.meta.url),'utf8'));
assert.equal(authoring.pieceCount,14);
assert.ok(authoring.pieces.every(p => p.nonManifoldEdges === 0), 'fracture contains an open or non-manifold piece');
const steelAuthoring = JSON.parse(await readFile(new URL('../public/props/crate-family/metal-fracture-authoring.json',import.meta.url),'utf8'));
assert.equal(steelAuthoring.pieceCount,14);
assert.ok(steelAuthoring.pieces.every(p => p.nonManifoldEdges === 0), 'steel fracture contains an open or non-manifold piece');
assert.ok(wood.triangles + brace.triangles * 8 <= 15000, 'braced crate exceeds its complete authored budget');
assert.ok(broken.triangles + brace.triangles * 8 <= 30000, 'broken braced assembly exceeds its budget');
const cageAuthoring = JSON.parse(await readFile(new URL('../public/props/crate-family/multihit-authoring.json',import.meta.url),'utf8'));
assert.equal(cageAuthoring.pieceCount,42);
assert.ok(cageAuthoring.pieces.every(p => p.nonManifoldEdges === 0 && p.signedVolume > 0), 'cage has an open or inverted fragment');
for (let side=0; side<4; side++) {
  const rotation=new THREE.Matrix4().makeRotationY(side*Math.PI/2);
  for (const y of [-.2,0,.2]) {
    const origin=new THREE.Vector3(.105,y,3).applyMatrix4(rotation);
    const direction=new THREE.Vector3(0,0,-1).transformDirection(rotation);
    assert.equal(new THREE.Raycaster(origin,direction,0,2.8).intersectObjects(cage.meshes,false).length,0,'cage slat gaps must be open geometry on every side');
  }
}
const server=await createServer({appType:'custom',logLevel:'silent',cacheDir:'.release-queue/crate-asset-test-cache',server:{middlewareMode:true}});
let fruitTriangles;
try {
  const {buildFruitGeometry}=await server.ssrLoadModule('/src/fruitAssets.ts');
  const fruit=buildFruitGeometry(3);fruitTriangles=(fruit.index?.count??fruit.getAttribute('position').count)/3;
} finally {await server.close();}
assert.ok(cage.triangles+fruitTriangles*5<=30000,'complete cage plus all five authored fruit exceeds the model budget');
console.log(JSON.stringify({ pass:true, exactExteriorPreserved:true, allSixSides:true, closedFragments:true,
  wood:wood.triangles,braced:wood.triangles+brace.triangles*8,fracture:broken.triangles,bracedFracture:broken.triangles+brace.triangles*8,stick:stick.triangles,metal:metal.triangles,steelFracture:steelPieces.triangles,metalPbr:metal.hasPbr,
  multihit:cage.triangles,multihitWithFruit:cage.triangles+fruitTriangles*5,multihitFracture:cagePieces.triangles,openSlatsAllSides:true },null,2));
