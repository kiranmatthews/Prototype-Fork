import {build} from 'esbuild';
import {withSkateRuntime,makeInput} from './jungle-cup-harness.mjs';
import {relayPilot} from './carlisle-relay-pilot.mjs';
import {mkdir,writeFile} from 'node:fs/promises';
const compiled=await build({entryPoints:['src/levels/carlisle-tidal-relay.ts'],bundle:true,format:'esm',write:false});
const api=await import('data:text/javascript;base64,'+Buffer.from(compiled.outputFiles[0].text).toString('base64'));
const data=api.CARLISLE_TIDAL_RELAY_LEVEL;
await withSkateRuntime(async({level,player:p,CONST,THREE})=>{
 p.competitionMode=false;p.endlessDeaths=true;
 const startS=Number(process.env.START_S??0),endS=Number(process.env.END_S??4002),start=api.CARLISLE_RELAY_STOPS.find(s=>s.s===startS);
 if(start)p.respawn(level,true,false,{position:new THREE.Vector3(...start.p),heading:new THREE.Vector3(0,0,-1)});
 const pilot=relayPilot({player:p,level,THREE,makeInput,jumps:api.CARLISLE_RELAY_JUMPS,stops:api.CARLISLE_RELAY_STOPS,walk:api.CARLISLE_RELAY_WALK,point:api.carlislePoint,startS});
 let frame=0;const tail=[];
 for(;frame<60*900;frame++){
  const input=pilot.input();p.rawInput=input;p.step(CONST.fixedStep,input,level);level.update(CONST.fixedStep);input.consumeEdges();
  if(frame%1800===0)console.log(JSON.stringify({seconds:frame/60,target:pilot.target?.name,position:p.pos.toArray(),state:p.state,skating:p.freeSkate,speed:p.speed,mover:p.groundHit?.moverId}));
  if(frame%10===0){tail.push({frame,target:pilot.target?.name,position:p.pos.toArray(),state:p.state,grounded:p.grounded,skating:p.freeSkate,speed:p.speed,mover:p.groundHit?.moverId,input:[input.moveX,input.moveY,input.jumpHeld,input.jumpReleased]});if(tail.length>80)tail.shift();}
  if(pilot.target?.s>endS)break;
  if(p.state==='finished'||p.state==='dead'||p.totalDeaths)break;
 }
 const report={seconds:frame/60,startS,endS,target:pilot.target?.name,position:p.pos.toArray(),state:p.state,deaths:p.totalDeaths,events:pilot.events,checkpoints:level.checkpoints.filter(c=>c.active).length,tail};
 await mkdir('docs/carlisle-relay',{recursive:true});await writeFile(`docs/carlisle-relay/route-${startS}.json`,JSON.stringify(report,null,2)+'\n');console.log(JSON.stringify({...report,tail:undefined}));
 if((p.state!=='finished'&&!(pilot.target?.s>endS))||p.totalDeaths)throw Error('Route did not finish cleanly');
},{levelEntry:{id:'carlisle-coast',name:data.name,data}});
