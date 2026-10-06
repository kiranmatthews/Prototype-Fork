import assert from 'node:assert/strict';
import {readFile,writeFile} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import {withBlockworksRuntime} from './blockworks-runner.mjs';

const report={capModels:0,capRays:0,minClearance:Infinity,maxClearance:-Infinity,vergeRoots:0,outlines:[],quarrySamples:0};
await withBlockworksRuntime(async r=>{
 const {THREE,source:d,sourceModule:m,l}=r;l.root.updateMatrixWorld(true);
 const ray=new THREE.Raycaster(),down=new THREE.Vector3(0,-1,0);
 const hit=(p,meshes,above=.8,far=1.6)=>{ray.set(new THREE.Vector3(p[0],p[1]+above,p[2]),down);ray.near=0;ray.far=far;return ray.intersectObjects(meshes,false).find(h=>h.face.normal.clone().transformDirection(h.object.matrixWorld).y>.01);};
 const native=l.groundMeshes.filter(o=>d.components[o.userData.editorIdx]?.tex==='coast-terrain');
 // Width evidence comes from the shipped triangle surfaces, independently of
 // the procedural profile that generated them.
 for(const road of m.CUSTARD_CREEK_ROADS.filter(v=>v.b-v.a>65)){
  const meshes=native.filter(o=>o.name===road.name),widths=[];
  for(let s=road.a+7;s<road.b-7;s+=3.7){
   const u=typeof road.offset==='function'?road.offset(s):road.offset,w=typeof road.width==='function'?road.width(s):road.width;
   const base=m.custardHeight(s),halves=[];
   for(const side of [-1,1]){let lo=0,hi=w;for(let i=0;i<17;i++){const x=(lo+hi)/2;if(hit(m.custardPoint(s,base,u+side*x),meshes))lo=x;else hi=x;}halves.push(lo);}
   widths.push(halves[0]+halves[1]);assert.ok(widths.at(-1)>3.2,'a practical continuous core remains');
  }
  const spread=Math.max(...widths)-Math.min(...widths);report.outlines.push({name:road.name,samples:widths.length,min:Math.min(...widths),max:Math.max(...widths),spread});
 }
 assert.ok(report.outlines.filter(v=>v.spread>1.5).length>=8,'many actual banks vary by more than a body width');
 for(const grass of d.components.filter(c=>c.nm?.startsWith('Custard verge grass'))){
  const ground=hit(grass.p,native,.15,.3);assert.ok(ground&&Math.abs(ground.point.y-grass.p[1])<.022,'fine verge cover roots on its visible triangle surface');report.vergeRoots++;
 }
 assert.ok(report.vergeRoots>1000);
 assert.ok(!d.components.some(c=>c.nm?.startsWith('Rolling-stone court')),'quarry courts are integrated into one native bank');
 for(const s of [1862,1950,2030])for(let along=-8;along<=8;along+=2)for(const u of [-4,0,4]){
  const p=m.custardPoint(s+along,m.custardHeight(s),u),ground=hit(p,native);
  assert.ok(ground&&Math.abs(ground.point.y-p[1])<.003,'stone patrol has a level continuous quarry floor');report.quarrySamples++;
 }
 for(const s of [522.3,527.7,536.2,545.1,554.6]){
  const p=m.custardPoint(s,m.custardHeight(s),.31);ray.set(new THREE.Vector3(p[0],p[1]+.5,p[2]),down);ray.far=1;
  const tops=ray.intersectObjects(native,false).filter(h=>h.face.normal.y>.6);
  assert.equal(tops.length,1,'reunited millrace has one surface, without overlapping banks');
 }
 // Read the actual published LOD0 geometry, not the contact bake, as the
 // independent visual reference for the 2 cm sole-clearance check.
 const file=await readFile(new URL('../public/carlisle-coast-fidelity/ledge-root.glb',import.meta.url));
 const jsonLength=file.readUInt32LE(12),g=JSON.parse(file.subarray(20,20+jsonLength)),blob=file.subarray(28+jsonLength);
 report.assetSha256=createHash('sha256').update(file).digest('hex');
 const attribute=id=>{const a=g.accessors[id],v=g.bufferViews[a.bufferView],size=a.type==='VEC3'?3:1,bytes=a.componentType===5123?2:4,out=[];
  for(let i=0;i<a.count;i++)for(let j=0;j<size;j++){const at=(v.byteOffset??0)+(a.byteOffset??0)+i*(v.byteStride??bytes*size)+j*bytes;out.push(a.componentType===5126?blob.readFloatLE(at):bytes===2?blob.readUInt16LE(at):blob.readUInt32LE(at));}return out;};
 const primitive=g.meshes[0].primitives[0],geometry=new THREE.BufferGeometry();geometry.setAttribute('position',new THREE.Float32BufferAttribute(attribute(primitive.attributes.POSITION),3));geometry.setIndex(attribute(primitive.indices));
 const visual=new THREE.Mesh(geometry,new THREE.MeshBasicMaterial());
 for(const c of d.components.filter(c=>c.dkind==='coastv2ledge')){
  const support=l.groundMeshes.find(o=>o.name===`Measured ${c.nm}`);assert.ok(support,'each visibly exposed cap owns measured contact');
  visual.position.fromArray(c.p);visual.scale.fromArray(c.s);visual.rotation.y=(c.yaw??0)*Math.PI/180;visual.updateMatrixWorld(true);
  const index=support.geometry.getIndex(),positions=support.geometry.getAttribute('position');
  for(let i=0;i<index.count;i+=63){
   const p=new THREE.Vector3();for(let j=0;j<3;j++)p.add(new THREE.Vector3().fromBufferAttribute(positions,index.getX(i+j)));p.multiplyScalar(1/3).applyMatrix4(support.matrixWorld);
   const model=hit(p.toArray(),[visual],.1,.3),contact=hit(p.toArray(),[support],.1,.3);assert.ok(model&&contact,'measured cap ray meets actual asset and contact');
   const clearance=contact.point.y-model.point.y;assert.ok(clearance>.0198&&clearance<.0202,'exact transformed cap agrees within 0.2 mm');report.minClearance=Math.min(report.minClearance,clearance);report.maxClearance=Math.max(report.maxClearance,clearance);report.capRays++;
  }
  report.capModels++;
 }
 assert.equal(report.capModels,14);geometry.dispose();visual.material.dispose();
 await writeFile('/private/tmp/custard-ledges-proof.json',JSON.stringify(report,null,2));console.log(JSON.stringify(report));
},{modulePath:'/src/levels/custard-creek.ts',levelId:'custard-creek',source:m=>m.CUSTARD_CREEK_LEVEL});
