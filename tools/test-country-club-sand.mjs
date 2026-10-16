import assert from 'node:assert/strict';
import {writeFile} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {withBlockworksRuntime} from './blockworks-runner.mjs';
const reports=[];
for(const hopping of [false,true])await withBlockworksRuntime(r=>{
 const {p,l,sourceModule:m}=r,target=m.countryClubPoint(m.COUNTRY_CLUB_LENGTH-14),start=p.pos.clone();
 let softFrames=0,maxSettled=0,streak=0,airFrames=0,worst=null;
 for(let i=0;i<Math.ceil((m.COUNTRY_CLUB_LENGTH/23+8)*60);i++){
  const f=l.cameraDirAt(p.pos.x,p.pos.y,p.pos.z,{s:p.laneCursor.s});if(f)p.camDir.set(f.x,0,f.z);
  r.tick({...r.steerToward(target),jumpHeld:!hopping||i%90<80});
  assert.ok(!['dead','gameover'].includes(p.state),'cross-country route should stay recoverable');
  if(p.grounded&&p.groundHit?.groundSpeedLimit){softFrames++;streak++;if(streak>40&&Math.abs(p.speed)>maxSettled){maxSettled=Math.abs(p.speed);worst={frame:r.frame,position:p.pos.toArray(),speed:p.speed,state:p.state,normal:p.groundHit.normal.toArray(),ground:p.groundHit.name,freeSkate:p.freeSkate,bailing:p.isBailing};}}else{streak=0;airFrames++;}
  assert.notEqual(p.state,'finished','straight-line cut beat the fairway');
 }
 const remaining=p.pos.distanceTo(new r.THREE.Vector3(...target)),travelled=Math.hypot(p.pos.x-start.x,p.pos.z-start.z);
 assert.ok(softFrames>1000,'straight cut did not test actual off-course sand');
 console.log(JSON.stringify({hopping,remaining,travelled,softFrames,maxSettled,worst}));
 assert.ok(maxSettled<=2.5,'sustained charge ignored deep sand '+JSON.stringify(worst));
 assert.ok(remaining>250,'straight cut approached the finish too cheaply');
 reports.push({mode:hopping?'repeated jumping toward finish':'held-charge straight to finish',seconds:r.frame*r.dt,travelled,remaining,softFrames,airFrames,maxSettled,position:p.pos.toArray()});
},{modulePath:'/src/levels/country-club.ts',source:m=>m.COUNTRY_CLUB_LEVEL,levelId:'country-club',maxFrames:13000,
 controlFrame:r=>r.p.courseInputDirection(r.l)??r.p.camDir});
await writeFile(`${tmpdir()}/country-club-cross-country.json`,JSON.stringify(reports,null,2));console.log(JSON.stringify(reports,null,2));
