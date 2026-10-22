import assert from 'node:assert/strict';
import {writeFile,mkdir} from 'node:fs/promises';
import {withBlockworksRuntime} from './blockworks-runner.mjs';
import {createMeasuredMallPilot} from './mall-measured-pilot.mjs';
await mkdir('/private/tmp/mall-recreation/measured',{recursive:true});
await withBlockworksRuntime(async r=>{
 const {p,l,sourceModule:m}=r,pilot=createMeasuredMallPilot(m),tuning=JSON.stringify(r.TUNING),contacts=[];
 const bail=p.bail.bind(p);p.bail=(...args)=>{contacts.push({args,source:m.mallSourcePoint(...p.pos.toArray()),stack:new Error().stack});return bail(...args);};
 console.log(JSON.stringify({stats:m.MALL_SURVEY_STATS,components:r.source.components.length,spawn:r.source.spawn,checkpoints:m.MALL_CHECKPOINTS,gate:r.source.components.find(c=>c.t==='gate')}));
 let error=null;try{while(p.state!=='finished'){r.tick(pilot.sample(p,l));pilot.observe(p,l);}}catch(e){error=String(e);}
 const report={state:p.state,seconds:r.frame*r.dt,position:p.pos.toArray(),source:m.mallSourcePoint(...p.pos.toArray()),stage:pilot.stage,stats:m.MALL_SURVEY_STATS,evidence:pilot.evidence,error,contacts,tail:r.trace.slice(-5)};
 await writeFile('/private/tmp/mall-recreation/measured/main.json',JSON.stringify(report,null,2));await writeFile('/private/tmp/mall-recreation/measured/main-trace.json',JSON.stringify(r.trace));
 console.log(JSON.stringify({...report,tail:undefined}));assert.equal(JSON.stringify(r.TUNING),tuning);assert.equal(error,null);assert.equal(p.state,'finished');
},{modulePath:'/src/levels/mall-measured.ts',source:m=>m.MALL_LEVEL,levelId:'mall',endlessDeaths:true,maxFrames:16000,controlFrame:r=>r.p.axisF});
