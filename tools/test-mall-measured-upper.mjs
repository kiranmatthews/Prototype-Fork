import assert from 'node:assert/strict';
import {writeFile} from 'node:fs/promises';
import {withBlockworksRuntime} from './blockworks-runner.mjs';

// Initial placement isolates each approach. Subsequent positions, speed and
// support come only from ordinary held accelerator and steering samples.
await withBlockworksRuntime(async r=>{
 const {p,l,THREE,sourceModule:m}=r,tuning=JSON.stringify(r.TUNING),fixtures=[];
 const cases=[
  {name:'First escalator up',start:[-13450,315,180],end:-11800,heading:-1,seam:-12160.4473},
  {name:'First escalator down',start:[-11800,717,180],end:-13200,heading:1,seam:-12160.4473},
  {name:'Gallery escalator up',start:[-6300,315,185],end:-4350,heading:-1,seam:-4541.5342},
  {name:'Gallery escalator down',start:[-4350,686,185],end:-5500,heading:1,seam:-4541.5342},
 ];
 for(const f of cases){
  const start=m.mallPoint(...f.start);start[1]=m.mallSupport(start[0],start[2],start[1]+.4)+.1;assert.ok(Number.isFinite(start[1]));
  const heading=new THREE.Vector3(0,0,f.heading);p.respawn(l,true,false,{position:new THREE.Vector3(...start),heading});p.axisF.copy(heading);p.axisL.set(-heading.z,0,heading.x);
  const e={name:f.name,frames:0,bail:false,airFrames:0,minSeamSpeed:Infinity,seamSamples:0,trace:[]};let q;
  for(let i=0;i<1800;i++){
   r.tick({moveY:1,jumpHeld:true});q=m.mallSourcePoint(...p.pos.toArray());e.frames++;e.bail||=p.isBailing;if(!p.grounded)e.airFrames++;
   if(Math.abs(q[0]-f.seam)<80){e.minSeamSpeed=Math.min(e.minSeamSpeed,p.speed);e.seamSamples++;}
   if(i%6===0||e.bail)e.trace.push({frame:i,source:q,speed:p.speed,state:p.state,ground:p.groundHit?.name});
   if(e.bail||p.state==='dead'||(q[0]-f.end)*-f.heading>0)break;
  }
  e.end=q;e.reached=(q[0]-f.end)*-f.heading>0;fixtures.push(e);
 }
 const report={scale:m.MALL_SCALE,stats:m.MALL_SURVEY_STATS,seams:m.MALL_WALL_SEAMS,tuningUnchanged:JSON.stringify(r.TUNING)===tuning,fixtures};
 await writeFile('/private/tmp/mall-recreation/measured/upper.json',JSON.stringify(report,null,2));console.log(JSON.stringify({...report,seams:report.seams.length,fixtures:fixtures.map(({trace,...f})=>f)}));
 assert.ok(report.tuningUnchanged);
 for(const f of fixtures){assert.ok(f.reached&&!f.bail,`${f.name} must cross its landing`);assert.ok(f.minSeamSpeed>8&&f.seamSamples>0,`${f.name} must retain momentum at the seam`);assert.ok(f.airFrames<4,`${f.name} must remain supported without an ollie`);}
},{modulePath:'/src/levels/mall-measured.ts',source:m=>m.MALL_LEVEL,levelId:'mall',endlessDeaths:true,maxFrames:8000,controlFrame:r=>r.p.axisF});
