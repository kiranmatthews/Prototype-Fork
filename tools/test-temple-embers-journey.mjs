import assert from 'node:assert/strict';
import {writeFile} from 'node:fs/promises';
import {withBlockworksRuntime} from './blockworks-runner.mjs';
import {runEmberJourney} from './temple-embers-journey.mjs';
// TEMPLE_START=<station> begins the same pilot part-way along the course.
import {createServer} from 'vite';
const startStation=process.env.TEMPLE_START?Number(process.env.TEMPLE_START):null;
let start;
if(startStation!==null){const pre=await createServer({appType:'custom',logLevel:'silent',server:{middlewareMode:true}});const route=(await pre.ssrLoadModule('/src/levels/jungle-sequels.ts')).JUNGLE_TERRACES_ROUTE;start=route.toWorld(startStation,route.groundAt(startStation)+.12,1.25);await pre.close();}
await withBlockworksRuntime(async r=>{
 r.route=r.sourceModule.JUNGLE_TERRACES_ROUTE;r.nodeCamera=true;
 let stage=-1;const stations=[];
 try {for(const input of runEmberJourney(r)){r.tick(input);const n=Math.floor(r.route.toLocal(r.p.pos.toArray())[0]/100);if(n>stage){stage=n;stations.push({station:n*100,frame:r.frame,seconds:+(r.frame*r.CONST.fixedStep).toFixed(1)});console.log('station',n*100,'frame',r.frame,'deaths',r.p.totalDeaths);}}}
 catch(error){await writeFile(startStation===null?'/private/tmp/temple-embers-failed-trace.json':`/private/tmp/temple-embers-failed-trace-${startStation}.json`,JSON.stringify(r.trace.slice(-300)));throw error;}
 assert.equal(r.p.state,'finished');assert.equal(r.p.totalDeaths,0);
 const report={state:r.p.state,seconds:+(r.frame*r.CONST.fixedStep).toFixed(1),deaths:r.p.totalDeaths,position:r.p.pos.toArray(),frames:r.frame,stations,cratesBroken:r.p.cratesBroken};
 await writeFile(startStation===null?'/private/tmp/temple-embers-journey.json':`/private/tmp/temple-embers-journey-from-${startStation}.json`,JSON.stringify(report,null,2));console.log(JSON.stringify(report));
},{modulePath:'/src/levels/jungle-sequels.ts',levelId:'jungle-terraces',source:m=>m.JUNGLE_TERRACES_LEVEL,endlessDeaths:true,maxFrames:60000,start,controlFrame:r=>r.p.courseInputDirection(r.l)??{x:r.p.camDir.x,z:r.p.camDir.z}});
