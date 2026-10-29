import assert from 'node:assert/strict';
import {mkdir,writeFile} from 'node:fs/promises';
import {withBlockworksRuntime} from './blockworks-runner.mjs';
const out=process.env.MAYFIELD_OUTPUT||'/tmp/mayfield-validation';await mkdir(out,{recursive:true});
await withBlockworksRuntime(async r=>{
 const {p,l,THREE,sourceModule:m}=r,report=[];
 for(const fixture of m.MAYFIELD_VERT_TESTS.filter(f=>!process.argv.includes('--timber')||f.name.includes('timber')))for(const side of [-1,1]){
  const [x,y,z]=fixture.p;
  p.respawn(l,true,false,{position:new THREE.Vector3(x-side*3,y+.08,z),heading:new THREE.Vector3(side,0,0)});r.stepFor(5);
  const e={name:fixture.name,side,vert:0,air:0,peak:y,maxStep:0,returned:false,bail:false,trace:[]};
  for(let i=0;i<720;i++){
   const before=p.pos.clone(),f=p.courseInputDirection(l)??p.camDir,drive=e.air?Math.sign(x-p.pos.x):side;
   r.tick({moveX:p.grounded?drive*-f.z:0,moveY:p.grounded?drive*f.x:0,jumpHeld:true});
   e.peak=Math.max(e.peak,p.pos.y);const delta=p.pos.distanceTo(before);if(delta>e.maxStep){e.maxStep=delta;e.maxEvent={i,before:before.toArray(),after:p.pos.toArray(),state:p.state,ground:p.groundHit?.name,normal:p.rideNormal.toArray()};}e.bail||=p.isBailing;
   if(p.groundHit?.vert&&p.rideNormal.y<.97)e.vert++;
   if(e.vert&&!p.grounded)e.air++;
   if(i%5===0)e.trace.push({i,p:p.pos.toArray(),state:p.state,ground:p.groundHit?.name,normal:p.rideNormal.toArray(),air:p.vertAir,speed:p.speed});
   if(e.air&&p.grounded&&p.pos.y<y+.25){e.returned=true;break;}
   if(p.isBailing||['dead','gameover'].includes(p.state))break;
  }
  e.height=e.peak-y;e.end=p.pos.toArray();report.push(e);
 }
 await writeFile(`${out}/transitions.json`,JSON.stringify(report,null,2));console.log(JSON.stringify(report.map(({trace,...e})=>e),null,2));
 assert.ok(report.every(e=>e.vert>0&&e.air>0&&e.returned&&!e.bail&&e.maxStep<1),'Original Warehouse and Kona transitions must climb, air and return without snagging');
},{modulePath:'/src/levels/mayfield-mall.ts',source:m=>m.MAYFIELD_MALL_LEVEL,levelId:'mayfield-mall',maxFrames:7000});
