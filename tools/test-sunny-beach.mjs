import assert from 'node:assert/strict';
import {createServer} from 'vite';
import {readFile} from 'node:fs/promises';
import {Matrix4,Quaternion,Vector3} from 'three';
const server=await createServer({configFile:false,appType:'custom',logLevel:'silent',server:{middlewareMode:true,hmr:false,ws:false}});
try{
 const {SUNNY_BEACH_LEVEL:l,SUNNY_ISLAND_OFFSET:offset}=await server.ssrLoadModule('/src/levels/sunny-beach.ts');
 const {ISLAND_HOPPER_LEVEL:original}=await server.ssrLoadModule('/src/levels/island-hopper.ts');
 const {BEACHFRONT_RUN_LEVEL:beach}=await server.ssrLoadModule('/src/levels/beachfront-run.ts');
 assert.equal(l.components.filter(c=>c.t==='gate').length,1);
 assert.equal(l.components.filter(c=>c.t==='crystal').length,1);
 assert.equal(l.components.filter(c=>c.t==='checkpoint').length,14);
 assert.equal(l.components.filter(c=>c.t==='rope').length,2);
 assert.deepEqual(l.spawn,beach.spawn);
 const copied=l.components.filter(c=>c.nm?.startsWith('Island Hopper /'));
 const expected=original.components.filter(c=>!['clock','decor','gate','crystal'].includes(c.t));
 assert.equal(copied.length,expected.length);
 for(let i=0;i<copied.length;i++){
  const a=copied[i],b=expected[i];
  for(let axis=0;axis<3;axis++)assert.ok(Math.abs(a.p[axis]-b.p[axis]-offset[axis])<.0011);
  for(const key of ['t','s','pts','widths','len','rise','amp','yaw','kind','shoreProfile','edgeGrinding'])
   assert.deepEqual(a[key],b[key],`${i}: unchanged Island Hopper ${key}`);
 }
 const knots=l.components.filter(c=>c.t==='camnode');
 for(let i=1;i<knots.length;i++)assert.ok(knots[i].p[2]<knots[i-1].p[2],`camera order ${i}`);
 assert.ok(l.components.find(c=>c.t==='gate').p[2]<-1380);
 assert.equal(l.components.filter(c=>c.t==='enemy').length,15);
 const {SKY_PRESETS}=await server.ssrLoadModule('/src/levelAtmosphere.ts');
 assert.equal(l.sky,'tropical-clouds');
 assert.deepEqual(l.atmosphere.sunDirection,SKY_PRESETS[l.sky].bloomSun,'light agrees with the visible sun');
 assert.ok(l.atmosphere.sunIntensity>2);
 assert.equal(l.atmosphere.backdrop,'painted sky');
 const {beachfrontPointAtDistance}=await server.ssrLoadModule('/src/beachfrontCourse.ts');
 // Large scenery must not cut across a distant part of the bending coast.
 // Check the entire source-mesh box, more conservatively than its silhouette.
 const mainland=l.components.filter(c=>c.t==='decor'&&c.nm?.startsWith('Banana Bay mainland /'));
 for(const c of mainland){
  const inverse=new Matrix4().compose(new Vector3(...c.p),
   new Quaternion().setFromAxisAngle(new Vector3(0,1,0),(c.yaw??0)*Math.PI/180),new Vector3(...c.s)).invert();
  for(let distance=0;distance<=740;distance+=2)for(const lateral of [-6,0,6]){
   const p=beachfrontPointAtDistance(distance,lateral,1),q=new Vector3(-p[0],p[1],p[2]).applyMatrix4(inverse);
   assert.ok(Math.abs(q.x)>=.5||q.y<=0||q.y>=1||Math.abs(q.z)>=.5,`${c.nm} leaves the coast clear at ${distance}/${lateral}`);
  }
 }
 for(const id of ['sunny-sandstone','sunny-hibiscus']){
  const raw=await readFile(`public/sunny-beach/${id}.glb`),length=raw.readUInt32LE(12),d=JSON.parse(raw.toString('utf8',20,20+length));
  assert.ok(d.nodes.some(n=>n.name?.endsWith('LOD0'))&&d.nodes.some(n=>n.name?.endsWith('LOD1')));
  assert.equal(d.materials.length,1);assert.ok(raw.length<1200000);
 }
 const ledger=JSON.parse(await readFile('tools/sunny-beach-assets/tasks.json'));
 assert.equal(Object.values(ledger.tasks).reduce((n,t)=>n+t.consumedCredits,0),30);
 console.log(`PASS: single extended finish, fourteen checkpoints, preserved island crossings, fifteen patrols, camera order, daytime atmosphere, both Meshy assets and original 30-credit ledger (${l.components.length} components).`);
}finally{await server.close();}
