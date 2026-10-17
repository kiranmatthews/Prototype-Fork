import assert from 'node:assert/strict';
import {writeFile} from 'node:fs/promises';
import {withBlockworksRuntime} from './blockworks-runner.mjs';
import {createRooftopPilot} from './rooftop-pilot.mjs';
const mode=process.argv.includes('--foot')?'foot':'skate',takeoff=Number(process.env.ROOF_TAKEOFF||(mode==='foot'?1:2.5)),lateral=Number(process.env.ROOF_LATERAL||0);
await withBlockworksRuntime(async r=>{
 const {p,l,sourceModule:m}=r,before=JSON.stringify(r.TUNING);
 const pilot=createRooftopPilot(m,{nodeCamera:true,mode,takeoff,lateral});let error=null;
 try{while(p.state!=='finished'){r.tick(pilot.sample(p,l));pilot.observe(p,l);}}catch(e){error=String(e);}
 const report={mode,takeoff,lateral,seconds:r.frame*r.dt,state:p.state,deaths:p.totalDeaths,position:p.pos.toArray(),evidence:pilot.evidence,error,traceTail:r.trace.slice(-16)};
 await writeFile(`/private/tmp/rooftop-${mode}-${takeoff}-${lateral}.json`,JSON.stringify(report,null,2));
 console.log(JSON.stringify({...report,traceTail:undefined},null,2));
 assert.equal(error,null);assert.equal(p.state,'finished');assert.equal(p.totalDeaths,0);
 assert.equal(pilot.evidence.roofs.length,m.ROOFTOP_ROOFS.length);
 assert.equal(pilot.evidence.jumps.length,m.ROOFTOP_GAPS.length);
 if(lateral===0)assert.equal(pilot.evidence.checkpoints.length,m.ROOFTOP_CHECKPOINTS.length);
 assert.equal(JSON.stringify(r.TUNING),before);
},{source:m=>m.ROOFTOP_RELAY_LEVEL,levelId:'rooftop-relay',endlessDeaths:true,maxFrames:15000,controlFrame:r=>r.p.courseInputDirection(r.l)??r.p.camDir});
