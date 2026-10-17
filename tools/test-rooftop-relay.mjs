import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {writeFile} from 'node:fs/promises';
import {withBlockworksRuntime} from './blockworks-runner.mjs';
import {createRooftopPilot} from './rooftop-pilot.mjs';
const mode=process.argv.includes('--foot')?'foot':'skate',route=process.env.ROOF_ROUTE||'main',district=Number(process.env.ROOF_DISTRICT??-1),takeoff=process.env.ROOF_TAKEOFF===undefined?undefined:Number(process.env.ROOF_TAKEOFF),lateral=Number(process.env.ROOF_LATERAL||0);
const variant=takeoff===undefined&&!lateral?'':`-takeoff-${takeoff??'default'}-lateral-${lateral}`;
let start=0,stop=Infinity;
await withBlockworksRuntime(async r=>{
 const{p,l,sourceModule:m}=r,before=JSON.stringify(r.TUNING),pilot=createRooftopPilot(m,{nodeCamera:true,mode,route,takeoff,lateral,start,maxFrames:110000});let error=null,seen=-1;
 try{while(p.state!=='finished'&&pilot.progress<stop){r.tick(pilot.sample(p,l));pilot.observe(p,l);const district=pilot.evidence.districts.at(-1);if(district!==seen){seen=district;console.log('DISTRICT',district,'s',pilot.progress.toFixed(1),'time',(r.frame*r.dt).toFixed(1));}}}catch(e){error=String(e);}
 const report={sourceHash:createHash('sha256').update(JSON.stringify(m.ROOFTOP_RELAY_LEVEL)).digest('hex'),mode,route,district,takeoff:takeoff??(mode==='foot'?.7:1.6),lateral,start,stop,seconds:r.frame*r.dt,state:p.state,progress:pilot.progress,deaths:p.totalDeaths,tuningUnchanged:JSON.stringify(r.TUNING)===before,position:p.pos.toArray(),evidence:pilot.evidence,error,traceTail:r.trace.slice(-18)};
 await writeFile(`/private/tmp/rooftop-v3-${mode}-${route}-${district}${variant}.json`,JSON.stringify(report,null,2));
 console.log(JSON.stringify({...report,evidence:{...report.evidence,jumps:report.evidence.jumps.length},traceTail:undefined},null,2));
 assert.equal(error,null);assert.equal(p.totalDeaths,0);assert.equal(JSON.stringify(r.TUNING),before);
 if(district<0){assert.equal(p.state,'finished');assert.equal(pilot.evidence.districts.length,12);assert.equal(pilot.evidence.checkpoints.length,m.ROOFTOP_CHECKPOINTS.length);assert.equal(pilot.evidence.jumps.length,m.rooftopGaps(route).length);if(route==='main')for(const roof of m.ROOFTOP_ROOFS)assert.ok(pilot.evidence.roofs.includes(roof.index),'Missing main roof '+roof.index);if(route==='challenge'){assert.equal(p.hasCrystal,true);for(const roof of m.ROOFTOP_BRANCH_ROOFS)assert.ok(pilot.evidence.roofs.includes(roof.index),'Missing branch roof '+roof.index);}}
 else {
  assert.ok(pilot.progress>=stop);
  if(route!=='main'){
   const branches=m.ROOFTOP_BRANCH_ROOFS.filter(r=>r.district===district&&(route==='challenge'||route===`fork-${district}`));
   for(const roof of branches)assert.ok(pilot.evidence.roofs.includes(roof.index),'Missing actual branch contact '+roof.index);
   if(branches.length&&district===7)assert.equal(p.hasCrystal,true);
  }
 }
},{source:m=>{
 const data=m.ROOFTOP_RELAY_LEVEL;
 if(district<0)return data;
 const d=m.ROOFTOP_DISTRICTS[district];start=d.a+6;stop=district===11?m.ROOFTOP_LENGTH-16:d.b+12;const spawn=m.rooftopPoint(start,route);spawn[1]+=.12;return{...data,spawn};
},levelId:'rooftop-relay',endlessDeaths:true,maxFrames:110000,controlFrame:r=>r.p.courseInputDirection(r.l)??r.p.camDir});
