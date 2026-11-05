import assert from 'node:assert/strict';
import {readFile, mkdir, writeFile} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import {createServer} from 'vite';
import * as THREE from 'three';

function parseGlb(buffer) {
  assert.equal(buffer.readUInt32LE(0), 0x46546c67);
  const jsonLength = buffer.readUInt32LE(12);
  const json = JSON.parse(buffer.subarray(20, 20 + jsonLength));
  const binaryStart = 28 + jsonLength;
  const array = index => {
    const accessor = json.accessors[index], view = json.bufferViews[accessor.bufferView];
    const start = binaryStart + (view.byteOffset ?? 0) + (accessor.byteOffset ?? 0);
    const count = accessor.count * ({SCALAR:1,VEC2:2,VEC3:3,VEC4:4}[accessor.type]);
    const Type = {5123:Uint16Array,5125:Uint32Array,5126:Float32Array}[accessor.componentType];
    return new Type(buffer.buffer.slice(buffer.byteOffset + start, buffer.byteOffset + start + count * Type.BYTES_PER_ELEMENT));
  };
  let triangles = 0;
  for (const mesh of json.meshes) for (const primitive of mesh.primitives) {
    assert.equal(primitive.mode ?? 4, 4);
    triangles += json.accessors[primitive.indices ?? primitive.attributes.POSITION].count / 3;
  }
  const primitive = json.meshes[0].primitives[0], geometry = new THREE.BufferGeometry();
  geometry.setAttribute('position', new THREE.BufferAttribute(array(primitive.attributes.POSITION), 3));
  geometry.setIndex(new THREE.BufferAttribute(array(primitive.indices), 1));
  return {json, geometry, triangles};
}

const report = {assets: [], cases: []};
const server = await createServer({appType:'custom',logLevel:'silent',server:{middlewareMode:true}});
try {
  const art = await server.ssrLoadModule('/src/kiteArt.ts');
  const {KiteTowVisual} = await server.ssrLoadModule('/src/kiteTowVisual.ts');
  const models = [];
  for (const [name, budget] of [['canopy',8000],['control-bar',2000]]) {
    const buffer = await readFile(`public/beach-kite/${name}.glb`), model = parseGlb(buffer);
    assert.ok(model.triangles > 0 && model.triangles <= budget, `${name} exceeds its component budget`);
    assert.ok(model.json.materials.every(m => m.pbrMetallicRoughness.baseColorTexture), `${name} has its painted texture`);
    assert.equal(model.json.extensionsUsed?.includes('MSFT_lod') ?? false, false);
    report.assets.push({name,triangles:model.triangles,budget,bytes:buffer.length,sha256:createHash('sha256').update(buffer).digest('hex')});
    models.push(model);
  }
  const geometry = models[0].geometry, positions = geometry.attributes.position, indices = geometry.index;
  const triangle = new THREE.Triangle(), nearest = new THREE.Vector3();
  report.attachmentErrors = art.KITE_ATTACHMENT_SITES.map(site => {
    let distance = Infinity; const point = new THREE.Vector3(...site.point);
    for (let i=0; i<indices.count; i+=3) {
      triangle.a.fromBufferAttribute(positions,indices.getX(i));
      triangle.b.fromBufferAttribute(positions,indices.getX(i+1));
      triangle.c.fromBufferAttribute(positions,indices.getX(i+2));
      distance = Math.min(distance, triangle.closestPointToPoint(point,nearest).distanceTo(point));
    }
    assert.ok(distance < 1e-7, `${site.name} must sit on the exported canopy`);
    return {name:site.name,distanceMetres:distance*art.KITE_CANOPY_SCALE};
  });
  const kite = new KiteTowVisual();
  const canopy = new THREE.Mesh(geometry, new THREE.MeshBasicMaterial({side:THREE.DoubleSide}));
  canopy.scale.setScalar(art.KITE_CANOPY_SCALE); canopy.position.copy(art.KITE_CANOPY_OFFSET); kite.sail.add(canopy);
  const lineNames = ['left steering line','right steering line','left front load line','right front load line'];
  const ray = new THREE.Raycaster(), a = new THREE.Vector3(), b = new THREE.Vector3(), direction = new THREE.Vector3();
  for (const [steer,wind,lift,aspect] of [[0,0,0,1.6],[-1,-.45,0,1.6],[1,.45,0,1.6],[1,-.4,4,1.6],[-1,.4,7,.6]]) {
    kite.pose(new THREE.Vector3(12,lift,-205),2,steer,lift,wind,null,null,aspect);
    kite.root.updateMatrixWorld(true);
    for (const name of lineNames) {
      const line = kite.root.getObjectByName(name);
      a.set(0,-.5,0).applyMatrix4(line.matrixWorld); b.set(0,.5,0).applyMatrix4(line.matrixWorld);
      direction.copy(b).sub(a); const length = direction.length(); assert.ok(length > 20 && Number.isFinite(length));
      ray.set(a,direction.normalize()); ray.near = .001; ray.far = length-.001;
      assert.equal(ray.intersectObject(canopy).length,0,`${name} must not pierce the canopy before its attachment`);
      const leader = kite.root.getObjectByName(name+' leader');
      const start = new THREE.Vector3(0,-.5,0).applyMatrix4(leader.matrixWorld);
      assert.ok(start.distanceTo(a)<1e-6, 'Leader remains attached during wind/steering/jumps');
    }
    for (const side of [0,1]) for (const index of side === 0 ? [1,2] : [3,4]) {
      const bridle = kite.root.getObjectByName(`front bridle ${side}:${index}`);
      a.set(0,.5,0).applyMatrix4(bridle.matrixWorld); b.set(0,-.5,0).applyMatrix4(bridle.matrixWorld);
      direction.copy(b).sub(a); ray.set(a,direction.clone().normalize()); ray.far=direction.length()-.001;
      assert.equal(ray.intersectObject(canopy).length,0,'Bridle legs remain outside the fabric');
    }
    report.cases.push({steer,wind,lift,aspect,linesClear:true});
  }
  const barBefore = kite.bar.getWorldPosition(new THREE.Vector3());
  kite.beginFlyaway(); for(let i=0;i<60;i++)kite.stepFlyaway(1/60);
  assert.ok(kite.bar.getWorldPosition(new THREE.Vector3()).z < barBefore.z-10);
  kite.reset();assert.equal(kite.root.visible,false);assert.equal(kite.flyingAway,false);
  report.pass = true;
  const output = process.env.KITE_ART_OUTPUT ?? 'art/beach-kite/verification';
  await mkdir(output,{recursive:true});await writeFile(`${output}/art-check.json`,JSON.stringify(report,null,2)+'\n');
  console.log('PASS kite component budgets, measured anchors, four-line/bridle clearance, leaders and flyaway');
} finally {await server.close();}
