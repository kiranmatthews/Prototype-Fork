import assert from 'node:assert/strict';
import {mkdir,writeFile} from 'node:fs/promises';
import {withBlockworksRuntime} from './blockworks-runner.mjs';

const output='/private/tmp/ripcord-chasm-evidence';await mkdir(output,{recursive:true});
await withBlockworksRuntime(async r=>{
 const m=r.sourceModule,{RIPCORD_BOULDER_END:a,RIPCORD_SANCTUARY_START:b}=m;
 const authored=m.RIPCORD_RIVER_LEVEL.components.find(c=>c.nm==='Ripcord chasm escape rail');
 assert.equal(b-a,56);assert.ok(authored?.pts?.length>20);
 const railPoints=authored.pts.map(q=>new r.THREE.Vector3(authored.p[0]+q[0],authored.p[1]+(q[3]??0),authored.p[2]+q[1]));
 const ray=new r.THREE.Raycaster(),down=new r.THREE.Vector3(0,-1,0);
 // Test the whole boulder lane, including both shoulders, against real floors.
 for(let s=a+2;s<b-2;s+=2)for(const u of [-8,0,8]){
  ray.set(new r.THREE.Vector3(...m.ripcordPoint(s,m.ripcordHeight(s)+.3,u)),down);ray.far=4;
  assert.equal(r.l.raycastGround(ray).length,0,`chasm has no hidden floor at ${s}/${u}`);
 }
 for(const [s,u]of [[a-24,10.8],[a-4,10.8],[b+4,0],[b+12,0]]){
  ray.set(new r.THREE.Vector3(...m.ripcordPoint(s,m.ripcordHeight(s)+.3,u)),down);ray.far=1;
  assert.ok(r.l.raycastGround(ray).length,`supported takeoff/landing ${s}`);
 }
 const {createRipcordLivePilot}=await r.server.ssrLoadModule('/tools/ripcord-live-pilot.mjs');
 const pilot=createRipcordLivePilot({player:r.p,getLevel:()=>r.l},process.argv[2]??'inner-low');
 let input;
 try{while((input=pilot.next())!==null)r.tick(input);}
 catch(e){await writeFile(output+'/failure.json',JSON.stringify({error:String(e),last:r.snapshot(),pilot:pilot.report,trace:r.trace.slice(-240)},null,2));throw e;}
 assert.equal(r.p.state,'finished');assert.equal(r.p.totalDeaths,0);assert.ok(r.p.hasCrystal);
 assert.equal(r.l.checkpoints.filter(c=>c.active).length,4);
 const crossing=r.trace.filter(t=>{const s=m.ripcordProgress(t.position);return s>a+1&&s<b-1;});
 assert.ok(crossing.length>80,'sustained grind across the long gap');
 assert.ok(crossing.every(t=>t.state==='grind'),'the rail carries the entire crossing');
 const stone=r.l.boulder.course.actors.at(-1),fall=[],radius=m.RIPCORD_RIVER_LEVEL.boulderChase.radius;
 let closestRail=Infinity,farBankClearance=Infinity;
 for(let i=0;i<1800&&stone.phase!=='gone';i++){
  r.l.update(r.dt);
  if(stone.phase!=='falling')continue;
  const center=stone.stone.mesh.position,s=m.ripcordProgress(center);
  farBankClearance=Math.min(farBankClearance,b-s-radius);
  for(let j=1;j<railPoints.length;j++){
   const near=new r.THREE.Line3(railPoints[j-1],railPoints[j]).closestPointToPoint(center,true,new r.THREE.Vector3());
   closestRail=Math.min(closestRail,near.distanceTo(center)-radius);
  }
  fall.push({s,y:center.y});
 }
 assert.equal(stone.phase,'gone','the last boulder completes its fall');
 assert.ok(fall.length>100,'observed the actual falling actor');
 assert.ok(farBankClearance>2,'boulder clears the far bank for its entire visible fall');
 assert.ok(closestRail>1,'boulder does not clip the escape rail');
 const report={gapMetres:b-a,railMetres:railPoints.slice(1).reduce((sum,p,i)=>sum+p.distanceTo(railPoints[i]),0),
  seconds:r.frame*r.dt,deaths:r.p.totalDeaths,checkpoints:4,crystal:r.p.hasCrystal,grindFrames:crossing.length,
  closestRail,farBankClearance,boulderFall:fall,pilot:pilot.report,final:r.snapshot()};
 await writeFile(output+'/'+(process.argv[2]??'inner-low')+'.json',JSON.stringify(report,null,2));
 console.log(JSON.stringify({...report,boulderFall:fall.length,pilot:undefined,final:undefined}));
},{modulePath:'/src/levels/ripcord-river.ts',levelId:'rumblewater-run',source:m=>m.RIPCORD_RIVER_LEVEL,maxFrames:22000,allowCheckpointTrips:true});
