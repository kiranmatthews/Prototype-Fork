// Independent input fixtures complement, rather than replace, the full route.
import assert from 'node:assert/strict';
import {mkdir,writeFile} from 'node:fs/promises';
import {withBlockworksRuntime} from './blockworks-runner.mjs';
import {runWaterfallClimb} from './waterfall-climb-pilot.mjs';
const early=Number(process.env.WATERFALL_EARLY||0),out='docs/waterfall-climb/runs';await mkdir(out,{recursive:true});
await withBlockworksRuntime(async r=>{
 const results=[],route=r.sourceModule.WATERFALL_ACTIONS.filter(a=>a.kind==='jump'||a.kind==='spin');
 for(const [index,authored]of route.entries()){
  const a={...authored,from:[...authored.from]},dx=a.to[0]-a.from[0],dz=a.to[2]-a.from[2],n=Math.hypot(dx,dz);
  a.from[0]-=dx/n*early;a.from[2]-=dz/n*early;
  r.p.respawn(r.l,true,false,{position:new r.THREE.Vector3(a.from[0],a.from[1]+.12,a.from[2])});
  r.report={actions:[],evidence:[]};r.route=[a,{kind:'walk',name:'unused sentinel',to:a.to}];
  const pilot=runWaterfallClimb(r,{collect:false,untilBeat:1});
  try{let next;while(!(next=pilot.next()).done)r.tick(next.value);results.push({index,name:a.name,ok:true,landing:r.p.pos.toArray(),target:a.to});}
  catch(error){results.push({index,name:a.name,ok:false,error:error.message,position:r.p.pos.toArray()});}
 }
 await writeFile(`${out}/redesign-${early?'early-margin':'gaps'}.json`,JSON.stringify(results,null,2));
 const failed=results.filter(r=>!r.ok);console.log(JSON.stringify({early,total:results.length,passed:results.length-failed.length,failed},null,2));assert.equal(failed.length,0);
},{modulePath:'/src/levels/waterfall-climb.ts',levelId:'waterfall-climb',source:m=>m.WATERFALL_CLIMB_LEVEL,controlFrame:()=>({x:0,z:-1}),maxFrames:80000});
