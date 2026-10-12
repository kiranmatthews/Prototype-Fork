import assert from 'node:assert/strict';
import {withBlockworksRuntime} from './blockworks-runner.mjs';
const report=[];
await withBlockworksRuntime(async r=>{
 const m=r.sourceModule,p=r.p,l=r.l;
 for(const station of [900,1000,1100])for(const side of [-1,1])for(const angle of [0,.3])for(const releaseAt of [null,.35,.16]){
  const tangent=m.custardTangent(station),across=[-tangent[2],0,tangent[0]],phi=Math.PI*.32;
  const u=side*(4.5+3*Math.sin(phi)),q=m.custardPoint(station,m.custardHeight(station)+3*(1-Math.cos(phi)),u);
  const heading=new r.THREE.Vector3(across[0]*side+tangent[0]*angle,0,across[2]*side+tangent[2]*angle).normalize();
  p.respawn(l,true,false,{position:new r.THREE.Vector3(...q),heading});p.endlessDeaths=true;
  p.pos.fromArray(q);p.prevPos.copy(p.pos);p.axisF.copy(heading);p.axisL.set(heading.z,0,-heading.x);
  p.speed=23;p.freeSkate=true;p.groundHit=p.queryGround(l);assert.ok(p.groundHit?.vert,'fixture must contact real ramp triangles');
  p.pos.y=p.groundHit.y;p.rideNormal.copy(p.groundHit.normal);p.camDir.fromArray(tangent).negate();
  let launched=false,landed=false,hangFrames=0,maxAcross=0,released=false;
  for(let frame=0;frame<300;frame++){
   const release=!released&&releaseAt!==null&&p.grounded&&p.rideNormal.y<releaseAt;released||=release;
   r.tick({jumpHeld:!released,jumpPressed:frame===0,jumpReleased:release});
   const s=m.custardProgress(p.pos),c=m.custardPoint(s,0),t=m.custardTangent(s),a=Math.abs(-(p.pos.x-c[0])*t[2]+(p.pos.z-c[2])*t[0]);
   maxAcross=Math.max(maxAcross,a);
   if(p.vertAir){launched=true;hangFrames++;assert.ok(p.lockedCoping,'authored curved coping lock missing');assert.ok(a<7.7,`escaped outer wall during hang: ${a}`);}
   if(launched&&p.grounded){landed=true;break;}
   assert.notEqual(p.state,'dead',`spillway ${station}/${side}/${angle} died`);
  }
  report.push({station,side,angle,releaseAt,launched,landed,hangFrames,maxAcross});
  assert.ok(launched&&landed,JSON.stringify(report.at(-1)));
 }
 console.log(JSON.stringify(report,null,2));
},{modulePath:'/src/levels/custard-creek.ts',source:m=>m.CUSTARD_CREEK_LEVEL,levelId:'custard-creek',maxFrames:16000});
