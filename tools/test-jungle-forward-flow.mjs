import assert from 'node:assert/strict';
import * as THREE from 'three';
import {withBlockworksRuntime} from './blockworks-runner.mjs';

await withBlockworksRuntime(async r=>{
  const {normalizeCustomLevelData}=await r.server.ssrLoadModule('/src/level.ts');
  assert.ok(normalizeCustomLevelData(r.source),'native capture remains editor-safe');
  const crystal=r.source.components.filter(c=>c.t==='crystal');
  assert.equal(crystal.length,1);
  const crossing=r.l.rails.find(rail=>rail.points[0].z===-172&&rail.points.at(-1).z===-240);
  assert.ok(crossing,'existing ravine grind remains');
  assert.ok(crossing.closest(new THREE.Vector3(...crystal[0].p)).distance<.02,'crystal sits on the actual grind line');
  assert.equal(crystal[0].p[2],-206);
  const nodes=r.source.components.filter(c=>c.t==='camnode'&&!c.cameraView&&c.p[2]>=-1314);
  assert.ok(nodes.every(c=>c.p[0]===0),'all forward corridor and aqueduct controls point down the same centreline');
  assert.ok(r.l.cameraPresentationViews.length===1&&r.l.zoneAt(100,-1360)?.dir==='E','side-view ascent is retained');
  const plants=r.source.components.filter(c=>c.nm?.startsWith('Summit understory')&&c.dkind!=='trialsv2cavewalla');
  assert.ok(plants.length>=12,'layered 3D finish planting');
  assert.ok(plants.every(c=>(c.yaw===90?c.p[0]-c.s[2]/2>191:c.p[2]+c.s[2]/2<-1366.5)&&c.p[2]>-1424&&c.solid===false&&c.scenerySolid===false),'foliage is behind the podium, in front of the matte, without collision');
  const tuning=JSON.stringify(r.TUNING),cases=[];
  const start=(x,z)=>{
    const ray=new THREE.Raycaster(new THREE.Vector3(x,50,z),new THREE.Vector3(0,-1,0));
    const hit=ray.intersectObjects(r.l.groundMeshes,false)[0];assert.ok(hit);
    r.p.respawn(r.l,true,false,{position:new THREE.Vector3(x,hit.point.y+.06,z),heading:new THREE.Vector3(0,0,-1)});
    r.stepFor(24);
  };
  // Ordinary held-forward input must not creep sideways against the forward
  // corridor's straight log and crate faces. No obstacles or physics removed.
  for(const z of [6,-586]){
    start(0,z);let sideways=0;
    for(let i=0;i<600;i++){r.tick({moveY:1});sideways=Math.max(sideways,Math.abs(r.p.pos.x));}
    assert.ok(sideways<.025,`held-forward lateral creep at ${z}: ${sideways}`);
    assert.equal(r.p.totalDeaths,0);assert.equal(r.p.grounded,true);
    cases.push({start:z,maxLateral:sideways,end:r.p.pos.toArray()});
  }
  start(0,-171);
  r.charge(26);
  r.releaseJump({moveY:1,grindHeld:true});
  let grinding=false,collectedOnRail=false;
  for(let i=0;i<1800&&!(r.p.pos.z<-242&&r.p.grounded);i++){
    const wasCrystal=r.p.hasCrystal;
    r.tick({moveY:r.p.state==='grind'?0:1,grindHeld:true,moveX:r.p.state==='grind'?THREE.MathUtils.clamp(-r.p.balance*8-r.p.balanceVel*.9,-1,1):0});
    grinding||=r.p.state==='grind';
    if(!wasCrystal&&r.p.hasCrystal)collectedOnRail=r.p.state==='grind';
    assert.equal(r.p.totalDeaths,0,'crossing has no death');
  }
  assert.ok(grinding&&collectedOnRail,'normal jump and grind collect the crystal');
  assert.ok(r.p.grounded&&r.p.pos.z<-242,'grind exits onto the receiving ground');
  assert.equal(JSON.stringify(r.TUNING),tuning,'movement tuning stays unchanged');
  console.log(JSON.stringify({cases,crystal:crystal[0].p,collectedOnRail,landing:r.snapshot(),plants:plants.length},null,2));
},{modulePath:'/src/level.ts',levelId:'jungle',source:m=>{
  const native=new m.Level(new THREE.Scene(),{id:'jungle',name:'Jungle Ruins'});
  const source=native.captureData();native.dispose();return source;
},endlessDeaths:true,maxFrames:7000});
