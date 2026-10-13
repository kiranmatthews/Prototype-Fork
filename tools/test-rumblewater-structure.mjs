import assert from 'node:assert/strict';
import {withBlockworksRuntime} from './blockworks-runner.mjs';
await withBlockworksRuntime(async r=>{
 const {normalizeCustomLevelData,BUILTIN_LEVELS}=await r.server.ssrLoadModule('/src/level.ts');
 const m=r.sourceModule,data=m.RUMBLEWATER_RUN_LEVEL,copy=normalizeCustomLevelData(r.l.captureData());
 assert.ok(copy,'the complete new level is portable through the editor schema');
 assert.deepEqual(copy.boulderChase,data.boulderChase,'capture/export/import retains the pursuit');
 assert.equal(BUILTIN_LEVELS.filter(l=>l.id==='rumblewater-run').length,1);
 assert.ok(BUILTIN_LEVELS.some(l=>l.id==='codex-lab')&&BUILTIN_LEVELS.some(l=>l.id==='custard-creek'));
 assert.equal(data.components.filter(c=>c.t==='gate').length,1);
 assert.ok(data.killY<Math.min(...data.boulderChase.path.map(p=>p[1]))-15);
 assert.ok(data.components.filter(c=>c.t==='vertramp').length>=5);
 assert.ok(m.RUMBLEWATER_RAILS.length>=4&&m.RUMBLEWATER_GAPS.length>=8);
 const ray=new r.THREE.Raycaster(),down=new r.THREE.Vector3(0,-1,0),origin=new r.THREE.Vector3();
 for(const [s,u,h]of [[0,0,0],[155,-5.9,0],[217,-7,0],[289,-3,0],[400,0,0],[520,0,0],[618,7,3],[646,-7.2,0],[735,0,0],[800,0,0],[882,0,0]]){
  const p=m.rumblePoint(s,m.rumbleHeight(s)+h,u);ray.set(origin.fromArray(p).add(new r.THREE.Vector3(0,1,0)),down);ray.far=2;
  const hits=r.l.raycastGround(ray).filter(h=>h.face&&h.face.normal.y>.15);
  assert.ok(hits.length,`supported authored route at ${s}/${u}`);
 }
 for(const gap of m.RUMBLEWATER_GAPS){
  const s=(gap.a+gap.b)/2,p=m.rumblePoint(s,m.rumbleHeight(s)+.2,gap.u);
  ray.set(origin.fromArray(p),down);ray.far=.45;
  assert.equal(r.l.raycastGround(ray).length,0,`${gap.name} has no invisible floor at the route height`);
 }
 console.log(`PASS new identity, editor round trip, 11 actual support probes, ${m.RUMBLEWATER_GAPS.length} open-gap probes, pipe/rail inventory, gate and kill plane`);
},{modulePath:'/src/levels/rumblewater-run.ts',levelId:'rumblewater-run',source:m=>m.RUMBLEWATER_RUN_LEVEL});
