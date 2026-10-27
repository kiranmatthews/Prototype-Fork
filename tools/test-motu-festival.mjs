import assert from 'node:assert/strict';
import {writeFile} from 'node:fs/promises';
import {withSkateRuntime,makeInput} from './jungle-cup-harness.mjs';

await withSkateRuntime(async({THREE,server,player:p,level:l,step})=>{
  const {JUNGLE_CUP_LEVEL:data}=await server.ssrLoadModule('/src/levels/jungle-cup.ts');
  const {parseCustomLevelJson}=await server.ssrLoadModule('/src/level.ts');
  assert.ok(parseCustomLevelJson(JSON.stringify(data)),'complete festival survives the editor contract');
  let triangles=0;
  for(const c of data.components.filter(c=>c.t==='mesh'))for(let i=0;i<c.indices.length;i+=3){
    const a=new THREE.Vector3().fromArray(c.vertices,c.indices[i]*3),b=new THREE.Vector3().fromArray(c.vertices,c.indices[i+1]*3),d=new THREE.Vector3().fromArray(c.vertices,c.indices[i+2]*3);
    assert.ok(b.sub(a).cross(d.sub(a)).lengthSq()>1e-12,`${c.nm}: degenerate triangle`);triangles++;
  }
  assert.equal(l.loopMeshes.length,1);assert.equal(l.motuBeachDiagnostics.graphics,8);
  assert.equal(data.components.filter(c=>c.gravityTrack).length,2);
  assert.ok(data.components.some(c=>c.nm==='Motu / coral wave wall'&&c.arcSteps===48));
  const place=(point,heading,speed=0)=>{
    p.respawn(l,true,true,{position:new THREE.Vector3(...point),heading:new THREE.Vector3(...heading)});
    p.freeSkate=true;p.speed=speed;p.axisF.set(...heading);p.axisL.set(p.axisF.z,0,-p.axisF.x);
  };
  const safe=name=>{assert.ok(!p.isBailing,`${name}: bail`);assert.ok(p.pos.y>=-.05&&p.pos.toArray().every(Number.isFinite),`${name}: lost floor`);assert.equal(p.totalDeaths,0);};
  // Start at rest: no artificial entry velocity or movement tuning changes.
  place([-59,6.4,25],[0,0,-1]);let entered=false,maxY=0,maxSpeed=0,loopFrames=0;
  for(;loopFrames<900;loopFrames++){
    step(makeInput({moveY:1,jumpHeld:true,jumpPressed:loopFrames===0}));safe('gravity approach and loop');
    entered ||= !!p.loopRide;maxY=Math.max(maxY,p.pos.y);maxSpeed=Math.max(maxSpeed,p.speed);
    if(p.completedLoops.size)break;
  }
  assert.ok(entered&&p.completedLoops.size===1,'approach must complete the full loop');
  assert.ok(maxY>8.35&&Math.abs(p.pos.x+50)<2&&Math.abs(p.pos.y)<.1,'crown and separated exit');
  const loop={frames:loopFrames+1,maxY,maxSpeed,exit:p.pos.toArray()};
  // Controller-style steering climbs the curved timber return to the summit.
  place([-42,.1,-7],[0,0,1],6);const targets=[[-42,4],[-43,19],[-49,27],[-58,27]];
  let target=0,walkMaxY=0,walkFrames=0;
  for(;walkFrames<1200&&target<targets.length;walkFrames++){
    const [x,z]=targets[target],dx=x-p.pos.x,dz=z-p.pos.z;
    // Competition controls steer relative to the board, unlike the campaign
    // camera-relative stick. Charge uphill and use the ordinary brake in bends.
    const angle=Math.atan2(dx,dz)-Math.atan2(p.axisF.x,p.axisF.z),delta=Math.atan2(Math.sin(angle),Math.cos(angle));
    step(makeInput({moveX:Math.max(-1,Math.min(1,-delta*2)),moveY:1,jumpHeld:true,jumpPressed:walkFrames===0,grabHeld:p.speed>12.5}));
    safe('boardwalk ascent');walkMaxY=Math.max(walkMaxY,p.pos.y);
    if(Math.hypot(x-p.pos.x,z-p.pos.z)<2.1)target++;
  }
  assert.equal(target,targets.length,`curved boardwalk reaches the loop summit: position ${p.pos.toArray()}, speed ${p.speed}, ground ${p.surfaceName}`);assert.ok(walkMaxY>6.2);
  // The horseshoe wall works from its open mouth without an invisible end cap.
  place([0,.1,-138],[0,0,-1],19);let air=false,land=false,released=false,waveMaxY=0;
  for(let i=0;i<450;i++){
    const release=!released&&p.grounded&&p.rideNormal.y<.42;if(release)released=true;
    step(makeInput({jumpHeld:!released,jumpPressed:i===0,jumpReleased:release}));safe('coral wave');
    air ||= p.vertAir||p.state==='air';waveMaxY=Math.max(waveMaxY,p.pos.y);
    if(air&&p.grounded){land=true;break;}
  }
  assert.ok(air&&land,'coral wave returns to supported ground');
  const report={passed:true,triangles,graphics:8,loop,boardwalk:{frames:walkFrames,maxY:walkMaxY,targets},wave:{air,land,maxY:waveMaxY},movementChanged:false};
  await writeFile(process.env.MOTU_FESTIVAL_REPORT??'/private/tmp/motu-festival-native.json',JSON.stringify(report,null,2));console.log(JSON.stringify(report));
});
