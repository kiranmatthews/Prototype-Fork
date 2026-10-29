import assert from 'node:assert/strict';
import {build} from 'esbuild';
import {mkdir,readFile,writeFile} from 'node:fs/promises';
import {withSkateRuntime,makeInput} from './jungle-cup-harness.mjs';
import {relayPilot} from './carlisle-relay-pilot.mjs';
const b=await build({entryPoints:['src/levels/carlisle-tidal-relay.ts'],bundle:true,format:'esm',write:false});
const api=await import('data:text/javascript;base64,'+Buffer.from(b.outputFiles[0].text).toString('base64'));
const data=api.CARLISLE_TIDAL_RELAY_LEVEL,point=api.carlislePoint,rows=[];
await withSkateRuntime(async({THREE,level,player:p,CONST})=>{
 p.competitionMode=false;p.endlessDeaths=true;
 const cases=[['Scissor',222,0,303],['Winches',866,4,950,-5],['Tide dial',1346,12,1458],['Pinwheels',1542,16,1684],
  ['Counterweights',2261,24,2342],['Harbour scissors',2600,24,2669],['Pendulum boarding',3182,24,3205],['Pendulum exit',3286,24.5,3295],['Moving spring berth',2014,24,2030]];
 for(const phase of (process.env.PHASES??'0,7').split(',').map(Number))for(const [name,start,y,end,u=0] of cases){
  if(process.env.JOINS&&!process.env.JOINS.split(',').includes(name))continue;
  level.time=phase;level.update(0);
  p.respawn(level,true,false,{position:new THREE.Vector3(...point(start,y+.12,u)),heading:new THREE.Vector3(...point(start+2,0)).sub(new THREE.Vector3(...point(start,0))).setY(0)});
  p.totalDeaths=0;const pilot=relayPilot({player:p,level,THREE,makeInput,jumps:api.CARLISLE_RELAY_JUMPS,stops:api.CARLISLE_RELAY_STOPS,walk:api.CARLISLE_RELAY_WALK,point,startS:start});
  const endAt=point(end,0),direction=new THREE.Vector3(...point(end+1,0)).sub(new THREE.Vector3(...endAt)).setY(0).normalize();
  let done=false,frame=0;const samples=[],supports=new Set();
  for(;frame<60*75;frame++){
   if(new THREE.Vector3(p.pos.x-endAt[0],0,p.pos.z-endAt[2]).dot(direction)>=-1&&p.grounded||name==='Moving spring berth'&&p.trampolineAir&&p.vVel>15){done=true;break;}
   let input=pilot.input();
   // The long pier translates away from its exit. A charged hop crosses the
   // opening gap; walking off after it retreats is not a supported handoff.
   if(name==='Pendulum exit'){
    const dx=endAt[0]-p.pos.x,dz=endAt[2]-p.pos.z,side=dx*p.axisL.x+dz*p.axisL.z;
    input=makeInput({moveY:frame<24?0:1,moveX:frame<24?0:Math.abs(side)>.8?Math.sign(side):0,
      jumpHeld:frame<24,jumpPressed:frame===0,jumpReleased:frame===24});
   }
   p.rawInput=input;p.step(CONST.fixedStep,input,level);level.update(CONST.fixedStep);input.consumeEdges();
   if(p.grounded)supports.add(p.surfaceName);
   if(frame%60===0)samples.push({frame,at:p.pos.toArray(),state:p.state,surface:p.surfaceName,target:pilot.target?.name});
   if(p.isBailing||['dead','gameover'].includes(p.state)||p.totalDeaths)break;
  }
  const row={name,phase,done,seconds:frame/60,at:p.pos.toArray(),state:p.state,bail:p.isBailing,deaths:p.totalDeaths,supports:[...supports],samples};rows.push(row);
  console.log(JSON.stringify({...row,samples:undefined}));
 }
},{levelEntry:{id:'carlisle-coast',name:data.name,data}});
await mkdir('docs/carlisle-relay/surface-cleanup',{recursive:true});
const path='docs/carlisle-relay/surface-cleanup/joins.json';
const previous=process.env.JOINS?JSON.parse(await readFile(path,'utf8')).rows:[];
const combined=[...previous.filter(p=>!rows.some(r=>r.name===p.name&&r.phase===p.phase)),...rows];
await writeFile(path,JSON.stringify({rows:combined},null,2)+'\n');
assert.ok(rows.every(r=>r.done&&!r.bail&&!r.deaths),'moving-deck handoff failed');
