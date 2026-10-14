import assert from 'node:assert/strict';
import {writeFile} from 'node:fs/promises';
import {withSkateRuntime,makeInput} from './jungle-cup-harness.mjs';
await withSkateRuntime(async({THREE,server,scene,Level,level,player:p,CONST})=>{
 level.dispose();
 const {WAREHOUSE_PARK_LEVEL:data}=await server.ssrLoadModule('/src/levels/codex-lab.ts');
 const l=new Level(scene,{id:'warehouse',name:data.name,data});scene.updateMatrixWorld(true);
 p.competitionMode=false;p.endlessDeaths=true;
 p.respawn(l,true,true,{position:new THREE.Vector3(31,.1,-24),heading:new THREE.Vector3(0,0,-1)});
 p.axisF.set(0,0,-1);p.axisL.set(-1,0,0);p.speed=0;p.freeSkate=true;
 const points=[[31,-52],[31,-105],[25,-118],[-28,-118],[-28,-30],[-28,-14],[-14,-14],[-7,-14],[8,-14],[10,-24],[26,-24],[31,-52]];
 let index=0,released=false;const samples=[];
 for(let frame=0;frame<6000&&index<points.length;frame++){
  const target=points[index],dx=target[0]-p.pos.x,dz=target[1]-p.pos.z;
  if(Math.hypot(dx,dz)<3){index++;continue;}
  const a=Math.atan2(dx,-dz)-Math.atan2(p.axisF.x,-p.axisF.z),angle=Math.atan2(Math.sin(a),Math.cos(a));
  const charging=!released&&index>=5&&index<=6;
  const pop=charging&&p.pos.x>-23.5;
  if(pop)released=true;
  const input=makeInput({moveX:p.grounded?Math.max(-1,Math.min(1,angle*2.5)):0,
   moveY:1,grabHeld:p.grounded&&Math.abs(angle)>.7&&p.speed>7,jumpHeld:charging&&!pop,jumpReleased:pop});
  p.step(CONST.fixedStep,input,l);l.update(CONST.fixedStep);
  if(frame%30===0||pop)samples.push({frame,index,p:p.pos.toArray(),speed:p.speed,bail:p.isBailing,state:p.state});
  if(p.isBailing||p.state==='dead')break;
 }
 console.log(`Circuit: ${index}/${points.length} waypoints, ${samples.at(-1)?.frame} fixed steps, mounted=${p.freeSkate}, bail=${p.isBailing}`);
 if(process.env.WAREHOUSE_FLOW_REPORT)await writeFile(process.env.WAREHOUSE_FLOW_REPORT,JSON.stringify({index,points,samples},null,2));
 assert.equal(index,points.length,'continuous circuit must remain skateable');
 assert.ok(!p.isBailing&&p.state!=='dead');
 l.dispose();
});
