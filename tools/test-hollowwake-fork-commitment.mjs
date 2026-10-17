import assert from 'node:assert/strict';
import {writeFile,mkdir} from 'node:fs/promises';
import {withBlockworksRuntime} from './blockworks-runner.mjs';
const report={fixture:'Isolated centre-line walking probes; pursuit disabled so each barrier can be measured',forks:[]};
try{await withBlockworksRuntime(async r=>{
 const m=r.sourceModule;
 for(const f of m.HOLLOWWAKE_FORKS){
  for(let at=f.a+1;at<f.a+24;at+=2)for(const u of [-.25,0,.25]){const q=new r.THREE.Vector3(...m.hollowPoint(at,-1,u,18)),ray=new r.THREE.Raycaster(q,new r.THREE.Vector3(0,-1,0),0,30);assert.ok(ray.intersectObjects(r.l.groundMeshes,false).some(h=>h.face?.normal.y>.15),'Continuous decision ground: '+f.name+' at '+at+'/'+u);}
  const nose=f.a+24,start=nose-7,rise=m.hollowFloorRise(Math.abs(m.hollowOffset(start,0))),position=new r.THREE.Vector3(...m.hollowPoint(start,-1,0,rise+.15));
  const ray=new r.THREE.Raycaster(position.clone().add(new r.THREE.Vector3(0,18,0)),new r.THREE.Vector3(0,-1,0),0,30),hit=ray.intersectObjects(r.l.groundMeshes,false).find(h=>h.face?.normal.y>.15);assert.ok(hit,'Supported centre approach: '+f.name);position.y=hit.point.y+.1;
  r.p.respawn(r.l,true,false,{position});r.p.commitRenderStep(r.l);r.l.boulder.course.reset(position);
  for(const a of r.l.boulder.course.actors){a.phase='gone';a.stone.mesh.visible=false;a.stone.box.makeEmpty();}
  const first=r.trace.length;r.stepFor(120,()=>r.steerToward(m.hollowPoint(nose+15)));
  const stopped=m.hollowProgress(r.p.pos),q=m.hollowCentre(stopped),d=m.hollowTangent(stopped),lateral=(r.p.pos.x-q[0])*-d[2]+(r.p.pos.z-q[2])*d[0];
  const penetrations=r.trace.slice(first).filter(t=>r.l.walls.some(w=>w.containsPoint(new r.THREE.Vector3(t.position[0],t.position[1]+.6,t.position[2]))));
  assert.equal(penetrations.length,0,`${f.name}: player passed through the solid divider`);assert.ok(stopped<nose+2||Math.abs(lateral)>.6,`${f.name}: spine failed to force a side`);assert.ok(stopped>start+2,`${f.name}: approach never reached the barrier`);assert.equal(r.p.totalDeaths,0);
  report.forks.push({name:f.name,formerFork:f.split,spineStarts:nose,stoppedAt:stopped,lateral,penetrations:penetrations.length,commitmentEarlierBy:f.split-nose,position:r.p.pos.toArray()});
 }
 report.pass=true;
},{modulePath:'/src/levels/hollowwake-descent.ts',levelId:'hollowwake-descent',source:m=>m.HOLLOWWAKE_LEVEL,allowCheckpointTrips:true});}catch(e){report.error=String(e.stack??e);process.exitCode=1;}
await mkdir('/private/tmp/hollowwake',{recursive:true});await writeFile('/private/tmp/hollowwake/fork-commitment.json',JSON.stringify(report,null,2));console.log(report);
