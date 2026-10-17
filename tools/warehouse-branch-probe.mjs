/** Local isolated branch probes. These respawn per challenge and do NOT prove session flow. */
import assert from 'node:assert/strict';
import {withSkateRuntime} from './jungle-cup-harness.mjs';
import {createWarehousePilot} from './warehouse-pilot.mjs';
import {writeFile} from 'node:fs/promises';
await withSkateRuntime(async({server,scene,Level,level,player:p})=>{
 level.dispose();const m=await server.ssrLoadModule('/src/levels/codex-lab.ts'),data=m.WAREHOUSE_PARK_LEVEL;
 const l=new Level(scene,{id:'warehouse',name:data.name,data});scene.updateMatrixWorld(true);
 p.competitionMode=false;p.endlessDeaths=true;const t=createWarehousePilot(p,l),report=[];
 for(const [i,route]of m.WAREHOUSE_TOKEN_ROUTES.entries()){
  t.place([...route.start],[...route.heading],true);let popped=false,grindFrames=0,maxY=0;
  const r=t.run(()=>l.skateCollectathon.tokens[i].collected&&p.grounded,()=>{
   maxY=Math.max(maxY,p.pos.y);if(p.state==='grind')grindFrames++;
   const pop=!popped&&(i===0?p.pos.x>-19.4:i===2?p.pos.z<-45.8:i===4?p.pos.x<-22.7:false);
   if(pop)popped=true;
   return {moveY:1,jumpHeld:!popped,jumpReleased:pop,grindHeld:i===1||i===3,moveX:p.state==='grind'?t.balance():0};
  },1000);
  report.push({name:route.name,...r,grindFrames,maxY,ground:p.groundHit?.name});
 }
 await writeFile(process.env.WAREHOUSE_REPORT??'/private/tmp/warehouse-branch-probe.json',JSON.stringify({report,records:t.records},null,2));
 console.log(JSON.stringify(report,null,2));
 for(const r of report){assert.ok(r.reached,r.name+' must reach its collectible');assert.equal(r.bail,false,r.name+' must land safely');}
 l.dispose();
});
