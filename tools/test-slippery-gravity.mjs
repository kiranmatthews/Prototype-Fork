import assert from 'node:assert/strict';
import {mkdir,writeFile} from 'node:fs/promises';
import {withSkateRuntime,makeInput} from './jungle-cup-harness.mjs';

const data=(force,slope=.2)=>({v:1,name:'Authored gravity slick',spawn:[0,.12,0],killY:-60,components:[
 {t:'mesh',nm:'Tilted slick',p:[0,0,0],vertices:[-100,100*slope,-100,100,-100*slope,-100,100,-100*slope,100,-100,100*slope,100],
  indices:[0,3,2,0,2,1],solid:true,tex:'solid',slip:true,iceGrip:.02,...(force===undefined?{}:{slipGravity:force})},
 {t:'gate',p:[0,0,-90]},
]});
const rows=[];
await withSkateRuntime(async({THREE,Level,Player,server,CONST,TUNING})=>{
 const baseline=JSON.stringify(TUNING),{normalizeCustomLevelData}=await server.ssrLoadModule('/src/level.ts');
 for(const v of [-1,2.01,NaN,Infinity,'1'])assert.equal(normalizeCustomLevelData(data(v)),null);
 assert.equal(normalizeCustomLevelData({...data(1),components:[{...data(1).components[0],slip:false}]}),null);
 for(const v of [0,1,2])assert.ok(normalizeCustomLevelData(data(v)));
 for(const variant of [
  {name:'legacy ice',force:undefined,slope:.2},
  {name:'flat slick',force:1,slope:0},
  {name:'downhill feet',force:1,slope:.2},
  {name:'countersteer feet',force:1,slope:.2,opposing:true},
  {name:'incoming foot momentum',force:1,slope:.2,carry:true},
  {name:'sideways board gravity',force:1,slope:.2,board:true},
  {name:'icy board brake',force:1,slope:.2,board:true,brake:true},
 ]){
  const scene=new THREE.Scene(),level=new Level(scene,{id:'ice-force-test',name:'Slick test',data:data(variant.force,variant.slope)});
  scene.updateMatrixWorld(true);const p=new Player(scene);p.enterLevel('ice-force-test');p.endlessDeaths=true;
  p.respawn(level,true);p.step(CONST.fixedStep,makeInput(),level);
  if(variant.carry){p.walkVelocity.set(0,0,-9);p.speed=9;p.lastPlanar=9;}
  if(variant.board){p.freeSkate=true;p.speed=14;p.lastPlanar=14;p.axisF.set(0,0,-1);p.axisL.set(-1,0,0);}
  for(let i=0;i<60;i++){
   const input=makeInput({moveX:variant.opposing?-1:0,grabHeld:!!variant.brake});p.rawInput=input;
   p.step(CONST.fixedStep,input,level);level.update(CONST.fixedStep);
  }
  const row={name:variant.name,position:p.pos.toArray(),velocity:p.walkVelocity.toArray(),speed:p.speed,board:p.freeSkate,heading:p.axisF.toArray(),grounded:p.grounded};rows.push(row);
  assert.equal(p.grounded,true,JSON.stringify(row));assert.equal(p.isBailing,false);
  if(variant.force&&variant.slope){assert.ok(p.pos.x>2,JSON.stringify(row));if(!variant.board)assert.equal(p.freeSkate,false,'slide unexpectedly mounted the board');}
  else assert.ok(Math.abs(p.pos.x)<.01,'legacy/flat surface gained gravity motion');
  if(variant.carry)assert.ok(-p.walkVelocity.z>8,'released input erased incoming momentum');
  if(variant.board)assert.ok(p.axisF.x>.3,'bank did not pull a contour-heading board downhill');
  if(variant.force===1){const saved=level.captureData();assert.ok(normalizeCustomLevelData(saved));assert.ok(saved.components.some(c=>c.slipGravity===1&&c.iceGrip===.02));}
  level.dispose();
 }
 assert.ok(rows[3].position[0]<rows[2].position[0],'uphill input cannot influence the slide');
 assert.equal(JSON.stringify(TUNING),baseline);
},{levelEntry:{id:'ice-force-test',name:'Slick test',data:data(1)}});
await mkdir('docs/carlisle-relay/slippery',{recursive:true});
await writeFile('docs/carlisle-relay/slippery/forces.json',JSON.stringify(rows,null,2)+'\n');
console.log(JSON.stringify(rows,null,2));
console.log('PASS authored downhill vector gravity, retained foot momentum, countersteering, mounted side-slip, legacy isolation and capture.');
