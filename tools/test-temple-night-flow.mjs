import assert from 'node:assert/strict';
import {writeFile} from 'node:fs/promises';
import {withBlockworksRuntime} from './blockworks-runner.mjs';
import {runTempleJourney} from './temple-night-pilot.mjs';
await withBlockworksRuntime(async r=>{
 r.route=r.sourceModule.JUNGLE_TERRACES_ROUTE;r.nodeCamera=true;
 let stage=-1;
 try {for(const input of runTempleJourney(r)){r.tick(input);const n=Math.floor(r.route.toLocal(r.p.pos.toArray())[0]/100);if(n>stage){stage=n;console.log('station',n*100,'frame',r.frame,'deaths',r.p.totalDeaths);}}}
 catch(error){await writeFile('/private/tmp/temple-night-failed-trace.json',JSON.stringify(r.trace.slice(-240)));throw error;}
 assert.equal(r.p.state,'finished');assert.equal(r.p.totalDeaths,0);
 const report={state:r.p.state,seconds:r.frame*r.CONST.fixedStep,deaths:r.p.totalDeaths,position:r.p.pos.toArray(),frames:r.frame};
 await writeFile('/private/tmp/temple-night-flow.json',JSON.stringify(report,null,2));console.log(report);
},{modulePath:'/src/levels/jungle-sequels.ts',levelId:'jungle-terraces',source:m=>m.JUNGLE_TERRACES_LEVEL,endlessDeaths:true,controlFrame:r=>r.p.courseInputDirection(r.l)??{x:r.p.camDir.x,z:r.p.camDir.z}});
