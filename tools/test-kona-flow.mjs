import assert from 'node:assert/strict';
import {writeFile} from 'node:fs/promises';
import {withBlockworksRuntime} from './blockworks-runner.mjs';

await withBlockworksRuntime(async r=>{
 const {p,l,sourceModule:m,THREE}=r, report=[];
 const cases=m.KONA_PIPES.flatMap((pipe,i)=>[-1,1].flatMap(side=>[-.2,0,.2].map(angle=>({pipe,i,side,angle,charged:true,runup:true}))));
 for(const [i,pipe] of m.KONA_PIPES.slice(0,2).entries())for(const side of [-1,1])cases.push({pipe,i,side,angle:0,charged:false,runup:false});
 for(const {pipe,i,side,angle,charged,runup} of cases){
  if(process.env.KONA_FLOW_ONLY&&process.env.KONA_FLOW_ONLY!==`${i}:${side}:${angle}:${runup}`)continue;
  const heading=new THREE.Vector3(side,0,angle).normalize();
  // Stay in the uninterrupted timber vert bay; its inset roll-in and solid
  // shoulder are a separate wall-contact route, not an automatic-air face.
  const along=i===2&&angle!==0?(angle<0?124:100):pipe.centre[2]-(runup?(i===2?8:2):0);
  p.respawn(l,true,false,{position:new THREE.Vector3(pipe.centre[0]-(runup?side*(pipe.flat-.5):0),pipe.centre[1]+.06,along),heading});
  p.axisF.copy(heading);p.axisL.set(-heading.z,0,heading.x);
  const samples=[];let maxHeight=0,hang=0,maxNormalStep=0,maxStep=0,previousNormal=null,returned=false;
  for(let frame=0;frame<420;frame++){
   const before=p.pos.clone();r.tick({moveY:1,jumpHeld:charged,jumpPressed:charged&&frame===0,jumpReleased:false});
   maxHeight=Math.max(maxHeight,p.pos.y-pipe.centre[1]);hang+=Number(p.vertAir);
   maxStep=Math.max(maxStep,p.pos.distanceTo(before));
   if(p.grounded&&previousNormal&&p.groundHit)maxNormalStep=Math.max(maxNormalStep,previousNormal.angleTo(p.groundHit.normal)*180/Math.PI);
   previousNormal=p.grounded?p.groundHit?.normal.clone():null;
   samples.push({frame,p:p.pos.toArray(),normal:p.groundHit?.normal.toArray(),velocity:p.parkVelocity.toArray(),state:p.state,grounded:p.grounded,hang:p.vertAir,tracked:p.vertTracked,break:p.parkBreakHold});
   if(maxHeight>.7&&p.grounded&&p.pos.y<pipe.centre[1]+.25&&p.groundHit?.vert){returned=true;break;}
   if(p.isBailing||p.totalDeaths)break;
  }
  report.push({pipe:i,side,angle,charged,runup,maxHeight,hangSeconds:hang*r.dt,maxNormalStep,maxStep,returned,bailed:p.isBailing,samples});
 }
 await writeFile(process.env.KONA_FLOW_OUTPUT||'/private/tmp/kona-flow-report.json',JSON.stringify(report,null,2));
 console.log(JSON.stringify(report.map(({samples,...v})=>v),null,2));
 assert.ok(report.every(v=>v.hangSeconds>.4&&v.returned&&!v.bailed), 'Every normal held-input approach must hang and return safely');
 assert.ok(report.every(v=>v.maxStep<.55&&v.maxNormalStep<12), 'A transition caused a position or surface-normal discontinuity');
 console.log(`PASS ${report.length} held-input approaches, including angled rides and the raised-deck seam`);
},{modulePath:'/src/levels/kona.ts',source:m=>m.KONA_LEVEL,levelId:'kona',controlFrame:r=>r.p.axisF,maxFrames:12000});
