import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {createHash} from 'node:crypto';

for(const kind of ['arrival','finish']){
  const root=new URL(`../public/props/beacon-platforms/${kind}`,import.meta.url);
  const raw=await readFile(new URL(root.href+'.glb'));
  const evidence=JSON.parse(await readFile(new URL(root.href+'.provenance.json'),'utf8'));
  assert.equal(raw.readUInt32LE(0),0x46546c67);
  assert.equal(raw.readUInt32LE(8),raw.length);
  assert.equal(createHash('sha256').update(raw).digest('hex'),evidence.runtimeSha256);
  assert.equal(evidence.provider,'Meshy');assert.ok(evidence.taskId);
  assert.ok(raw.length<2.5*1024*1024,'one platform exceeds its download budget');
  const length=raw.readUInt32LE(12),gltf=JSON.parse(raw.subarray(20,20+length));
  const primitives=gltf.meshes.flatMap(mesh=>mesh.primitives);
  assert.equal(primitives.length,1,'each platform must render in one opaque draw');
  const triangles=primitives.reduce((total,p)=>total+gltf.accessors[p.indices].count/3,0);
  assert.equal(triangles,evidence.triangles);assert.ok(triangles<8000);
  const material=gltf.materials[0];assert.equal(material.alphaMode,'OPAQUE');
  assert.equal(material.doubleSided,false);assert.ok(material.normalTexture);
  assert.ok(material.pbrMetallicRoughness.metallicRoughnessTexture);
  assert.equal(material.emissiveTexture.index,material.pbrMetallicRoughness.baseColorTexture.index);
  const accessor=gltf.accessors[primitives[0].attributes.POSITION],view=gltf.bufferViews[accessor.bufferView];
  const binary=raw.subarray(length+28),start=(view.byteOffset||0)+(accessor.byteOffset||0);
  let deck=0,underside=0;
  for(let i=0;i<accessor.count;i++){
    const x=binary.readFloatLE(start+i*12),y=binary.readFloatLE(start+i*12+4),z=binary.readFloatLE(start+i*12+8);
    assert.ok([x,y,z].every(Number.isFinite));
    assert.ok(Math.hypot(x,z)<=4.85/3+1e-5,'art extends beyond the authored footprint');
    assert.ok(y>=-1e-5&&y<=2.2/3+.016,'art leaves the existing support envelope');
    if(Math.hypot(x,z)<1.1&&Math.abs(y-2.2/3)<1e-5)deck++;
    if(y<.03)underside++;
  }
  assert.ok(deck>100&&underside>20,'platform needs a flat central deck and a grounded base');
  console.log(`PASS ${kind}: verified Meshy provenance, ${triangles} triangles, ${raw.length} bytes, flat deck and bounded single-draw PBR art`);
}
