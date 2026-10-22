import assert from 'node:assert/strict';
import {mkdir,writeFile} from 'node:fs/promises';
import {withBlockworksRuntime} from './blockworks-runner.mjs';
import {createMallPilot} from './mall-pilot.mjs';
const route=process.argv.find(a=>a.startsWith('--route='))?.split('=')[1]??'main';
await mkdir('/private/tmp/mall-recreation',{recursive:true});
await withBlockworksRuntime(async r=>{
 const {sourceModule:m,p,l}=r,before=JSON.stringify(r.TUNING),pilot=createMallPilot(m,{route});
 assert.equal(r.source.components.filter(c=>c.t==='gate').length,1);
 assert.equal(r.source.components.filter(c=>c.t==='checkpoint').length,5);
 let error=null;
 try{while(p.state!=='finished'){r.tick(pilot.sample(p,l));pilot.observe(p,l);}}catch(e){error=String(e);}
 const report={route,seconds:r.frame*r.dt,state:p.state,deaths:p.totalDeaths,position:p.pos.toArray(),progress:pilot.progress,evidence:pilot.evidence,error,tail:r.trace.slice(-18)};
 await writeFile(`/private/tmp/mall-recreation/${route}.json`,JSON.stringify(report,null,2));
 await writeFile(`/private/tmp/mall-recreation/${route}-trace.json`,JSON.stringify(r.trace));
 console.log(JSON.stringify({...report,tail:undefined},null,2));
 assert.equal(error,null);assert.equal(p.state,'finished');assert.equal(p.totalDeaths,0);assert.equal(JSON.stringify(r.TUNING),before);
 assert.ok(pilot.evidence.minimumMovingSpeed>18,'The authored line must not require a hard stop after accelerating');
 if(route==='upper'){assert.ok(pilot.evidence.grinds.includes(7)||pilot.evidence.grinds.includes(8),'Flying Leap must catch an upper suspended rail');assert.ok(p.hasCrystal,'The upper rail must reach the secret reward');}
 if(route==='coffee')assert.ok(pilot.evidence.grinds.length>0,'Coffee Grind must be grindable');
},{modulePath:'/src/levels/mall.ts',source:m=>m.MALL_LEVEL,levelId:'mall',endlessDeaths:true,maxFrames:15000,controlFrame:r=>r.p.axisF});
