import assert from 'node:assert/strict';
import {createServer} from 'vite';
import {readFile} from 'node:fs/promises';
const server=await createServer({configFile:false,appType:'custom',logLevel:'silent',server:{middlewareMode:true,hmr:false,ws:false}});
try{
 const {SUNNY_BEACH_LEVEL:l,SUNNY_ISLAND_OFFSET:offset}=await server.ssrLoadModule('/src/levels/sunny-beach.ts');
 const {ISLAND_HOPPER_LEVEL:original}=await server.ssrLoadModule('/src/levels/island-hopper.ts');
 const {BEACHFRONT_RUN_LEVEL:beach}=await server.ssrLoadModule('/src/levels/beachfront-run.ts');
 assert.equal(l.components.filter(c=>c.t==='gate').length,1);
 assert.equal(l.components.filter(c=>c.t==='crystal').length,1);
 assert.equal(l.components.filter(c=>c.t==='checkpoint').length,8);
 assert.equal(l.components.filter(c=>c.t==='rope').length,2);
 assert.deepEqual(l.spawn,beach.spawn);
 const copied=l.components.filter(c=>c.nm?.startsWith('Island Hopper /'));
 const expected=original.components.filter(c=>c.t!=='clock'&&c.t!=='decor');
 assert.equal(copied.length,expected.length);
 for(let i=0;i<copied.length;i++){
  const a=copied[i],b=expected[i];
  for(let axis=0;axis<3;axis++)assert.ok(Math.abs(a.p[axis]-b.p[axis]-offset[axis])<.0011);
  for(const key of ['t','s','pts','widths','len','rise','amp','yaw','kind','shoreProfile','edgeGrinding'])
   assert.deepEqual(a[key],b[key],`${i}: unchanged Island Hopper ${key}`);
 }
 const knots=l.components.filter(c=>c.t==='camnode');
 for(let i=1;i<knots.length;i++)assert.ok(knots[i].p[2]<knots[i-1].p[2],`camera order ${i}`);
 assert.ok(l.components.find(c=>c.t==='gate').p[2]<-1120);
 assert.ok(l.atmosphere.sunDirection[1]>.85&&l.atmosphere.sunIntensity>2);
 assert.equal(l.atmosphere.backdrop,'painted sky');
 for(const id of ['sunny-sandstone','sunny-hibiscus']){
  const raw=await readFile(`public/sunny-beach/${id}.glb`),length=raw.readUInt32LE(12),d=JSON.parse(raw.toString('utf8',20,20+length));
  assert.ok(d.nodes.some(n=>n.name?.endsWith('LOD0'))&&d.nodes.some(n=>n.name?.endsWith('LOD1')));
  assert.equal(d.materials.length,1);assert.ok(raw.length<1200000);
 }
 const ledger=JSON.parse(await readFile('tools/sunny-beach-assets/tasks.json'));
 assert.equal(Object.values(ledger.tasks).reduce((n,t)=>n+t.consumedCredits,0),30);
 console.log(`PASS: single finish, eight checkpoints, original island geometry/actors, camera order, daytime atmosphere, both Meshy assets and 30-credit ledger (${l.components.length} components).`);
}finally{await server.close();}
