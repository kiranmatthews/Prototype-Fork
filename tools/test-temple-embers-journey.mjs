import assert from 'node:assert/strict';
import {writeFile} from 'node:fs/promises';
import {withBlockworksRuntime} from './blockworks-runner.mjs';
import {runTempleJourney} from './temple-embers-journey.mjs';
// TEMPLE_START=<station> begins the journey at a room boundary (172, 240, 309, 398, 476, 660, 742, 776) instead of the spawn.
import {createServer} from 'vite';
const startStation=process.env.TEMPLE_START?Number(process.env.TEMPLE_START):null;
let start;
if(startStation!==null){const pre=await createServer({appType:'custom',logLevel:'silent',server:{middlewareMode:true}});const route=(await pre.ssrLoadModule('/src/levels/jungle-sequels.ts')).JUNGLE_TERRACES_ROUTE;start=route.toWorld(startStation,route.groundAt(startStation)+.12,0);await pre.close();}
await withBlockworksRuntime(async r=>{
 r.route=r.sourceModule.JUNGLE_TERRACES_ROUTE;r.report={stage:'',actions:[],evidence:[]};
 let stage=-1;const stations=[];
 const origTick=r.tick;r.tick=(input)=>{const out=origTick(input);const n=Math.floor(r.route.toLocal(r.p.pos.toArray())[0]/100);if(n>stage){stage=n;stations.push({station:n*100,frame:r.frame,seconds:+(r.frame*r.CONST.fixedStep).toFixed(1)});console.log('station',n*100,'frame',r.frame,'deaths',r.p.totalDeaths);}return out;};
 try {await runTempleJourney(r,{startStation});}
 catch(error){await writeFile(startStation===null?'/private/tmp/temple-embers-failed-trace.json':`/private/tmp/temple-embers-failed-trace-${startStation}.json`,JSON.stringify({stage:r.report.stage,actions:r.report.actions,trace:r.trace.slice(-240)}));throw error;}
 assert.equal(r.p.state,'finished');assert.equal(r.p.totalDeaths,0);
 const report={state:r.p.state,seconds:+(r.frame*r.CONST.fixedStep).toFixed(1),deaths:r.p.totalDeaths,position:r.p.pos.toArray(),frames:r.frame,stations,cratesBroken:r.p.cratesBroken,beats:r.report.actions,evidence:r.report.evidence};
 await writeFile(startStation===null?'/private/tmp/temple-embers-journey.json':`/private/tmp/temple-embers-journey-from-${startStation}.json`,JSON.stringify(report,null,2));console.log(JSON.stringify({...report,evidence:report.evidence.length}));
},{modulePath:'/src/levels/jungle-sequels.ts',levelId:'jungle-terraces',source:m=>m.JUNGLE_TERRACES_LEVEL,endlessDeaths:true,maxFrames:90000,start,controlFrame:r=>r.p.courseInputDirection(r.l)??{x:r.p.camDir.x,z:r.p.camDir.z}});
