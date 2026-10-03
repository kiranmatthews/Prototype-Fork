import assert from 'node:assert/strict';
import * as THREE from 'three';
import { withChiefRuntime, chiefInput } from './crab-chief-harness.mjs';

// Fixture spawns/phase select the situation before a run. Every approach and
// mouth hit below is earned through real Player inputs; there is no balance
// correction, timed ollie, contact/state injection or attack-gate bypass.
await withChiefRuntime(async ({l,p,tick})=>{
  const boss=l.boss,geometry=boss.phaseGeometry,results=[],formingResults=[];
  const approaches=[];
  for(const skating of [false,true]){
    for(const x of [-1.8,-.9,0,.9,1.8])approaches.push({name:`parallel ${x}`,x,z:3,dx:0,dz:-1,skating});
    for(const x of [-5,-3,3,5])approaches.push({name:`angled ${x}`,x,z:2,dx:-x,dz:-6,skating});
    for(const x of [-5,5])approaches.push({name:`side ${x}`,x,z:-4,dx:-x,dz:0,skating});
    for(const x of [-3,3])approaches.push({name:`past tip ${x}`,x,z:-6,dx:-x,dz:2,skating});
  }
  const prepare=spec=>{
    p.respawn(l,true,false,{position:new THREE.Vector3(spec.x,.12,spec.z)});
    boss.phase=2;boss.health=6;boss.state='tongue-open';boss.stateTime=0;
    boss.present(0);
  };
  for(const spec of approaches){
    prepare(spec);
    const scale=Math.hypot(spec.dx,spec.dz),input={moveX:spec.dx/scale,moveY:-spec.dz/scale,
      grindHeld:true,...(spec.skating?{jumpHeld:true}:{})};
    let caught=false,grindFrames=0,catchPosition=null,maxFraction=0,minimumSpeed=Infinity;
    const before=boss.hits,deathBefore=p.totalDeaths;
    for(let frame=0;frame<460;frame++){
      tick(input);
      if(p.state==='grind'&&p.grindRail===geometry.tongueRail){
        if(!caught)catchPosition=p.pos.toArray();
        caught=true;grindFrames++;maxFraction=Math.max(maxFraction,geometry.tongueFraction(p.pos));
        minimumSpeed=Math.min(minimumSpeed,p.speed);
        assert.equal(p.balanceMeter,null);
        assert.equal(p.boardG.visible,true,'on-foot catch did not present a mounted board');
      }
      assert.equal(p.isBailing,false,`${spec.name} triggered a rail bail`);
      assert.equal(p.totalDeaths,deathBefore,`${spec.name} died`);
      if(boss.hits>before)break;
    }
    assert.ok(caught,`${spec.name} (${spec.skating?'skate':'foot'}) never caught tongue`);
    assert.equal(boss.hits,before+1,`${spec.name} (${spec.skating?'skate':'foot'}) never earned mouth hit`);
    const strike=boss.strikes.at(-1);assert.equal(strike.kind,'tongue');assert.ok(strike.tongueMetres>=6);
    assert.ok(grindFrames>100,'mouth hit bypassed the actual long grind');
    assert.ok(minimumSpeed>=geometry.tongueRail.chiefTongueAssist.minSpeed-.01);
    results.push({approach:spec.name,mode:spec.skating?'skate':'foot',catchPosition,
      grindSeconds:+(grindFrames/60).toFixed(2),tongueMetres:+strike.tongueMetres.toFixed(2),maxFraction});
  }

  // Walk into the animated unfurl with Triangle already held. The catch must
  // wait for the visible path to finish and must not need a perfectly timed
  // approach, ollie or balance input after that first opportunity opens.
  for(const z of [3,1])for(const x of [-1.5,0,1.5]){
    prepare({x,z});boss.state='tongue-form';boss.stateTime=0;boss.present(0);
    const before=boss.hits,deathBefore=p.totalDeaths;
    let caught=false,catchPosition=null,catchFrame=null,grindFrames=0;
    for(let frame=0;frame<460;frame++){
      tick({moveY:1,grindHeld:true});
      if(p.state==='grind'&&p.grindRail===geometry.tongueRail){
        if(!caught){
          catchPosition=p.pos.toArray();catchFrame=frame;
          assert.equal(geometry.tongueProgress,1,'caught before the visible tongue finished unfurling');
          assert.equal(geometry.tongueMesh.visible,true);
          assert.equal(boss.state,'tongue-open');
        }
        caught=true;grindFrames++;
        assert.equal(p.balanceMeter,null);assert.equal(p.boardG.visible,true);
      }
      assert.equal(p.isBailing,false,`forming tongue x=${x}, z=${z} caused a bail`);
      assert.equal(p.totalDeaths,deathBefore,`forming tongue x=${x}, z=${z} caused a death`);
      if(boss.hits>before)break;
    }
    assert.ok(caught,`forming tongue x=${x}, z=${z} never accepted the held grind`);
    assert.equal(boss.hits,before+1,`forming tongue x=${x}, z=${z} never earned a mouth hit`);
    const strike=boss.strikes.at(-1);assert.equal(strike.kind,'tongue');assert.ok(strike.tongueMetres>=6);
    assert.ok(grindFrames>100,'forming-tongue entry bypassed the actual long grind');
    formingResults.push({x,z,catchFrame,catchPosition,grindSeconds:+(grindFrames/60).toFixed(2),
      tongueMetres:+strike.tongueMetres.toFixed(2)});
  }

  // Outside the visible entry skin does not silently teleport onto the rail.
  prepare({x:3.3,z:1});
  const healthBefore=boss.health;
  for(let i=0;i<115;i++)tick({moveY:1,grindHeld:true});
  assert.notEqual(p.grindRail,geometry.tongueRail);assert.equal(boss.health,healthBefore);
  assert.equal(p.isBailing,false,'missed soft-tongue catch used a metal-rail trip');

  // Catching late at the mouth cannot substitute for the required coverage.
  prepare({x:0,z:-23});
  p.respawn(l,true,false,{position:new THREE.Vector3(0,6.55,-23)});
  boss.phase=2;boss.health=6;boss.state='tongue-open';boss.stateTime=0;boss.present(0);
  tick({grindHeld:true,spinPressed:true});
  assert.equal(boss.health,6,'mouth proximity bypassed tongue coverage');

  // An interrupted transient rail drops the attachment on the next real tick.
  prepare({x:0,z:1});
  for(let i=0;i<80&&p.state!=='grind';i++)tick({moveY:1,grindHeld:true});
  assert.equal(p.grindRail,geometry.tongueRail);
  geometry.hideTongue();const originalBoss=l.boss;l.boss=null;
  const heldInput=chiefInput({moveY:1,grindHeld:true},{grindHeld:true});
  p.rawInput=heldInput;p.step(1/60,heldInput,l);l.update(1/60);p.commitRenderStep(l);
  assert.notEqual(p.state,'grind');assert.equal(p.grindRail,null);
  // Keep the same button down through absence and a fresh unfurl. The old
  // endpoint latch cannot reject this new encounter opportunity.
  p.rawInput=heldInput;p.step(1/60,heldInput,l);l.update(1/60);p.commitRenderStep(l);
  geometry.setTongue(new THREE.Vector3(0,6.4,-23),1);
  let recaught=false;
  for(let i=0;i<90;i++){
    const input=chiefInput({moveY:1,grindHeld:true},{grindHeld:true});
    p.rawInput=input;p.step(1/60,input,l);l.update(1/60);p.commitRenderStep(l);
    if(p.grindRail===geometry.tongueRail){recaught=true;break;}
  }
  assert.ok(recaught,'held Triangle remained latched across a new unfurl');
  l.boss=originalBoss;

  // This authored profile is absent on the permanent ordinary terrace rails.
  assert.ok(l.rails.filter(rail=>rail!==geometry.tongueRail).every(rail=>rail.chiefTongueAssist===null));
  console.log(JSON.stringify({approaches:results.length,formingApproaches:formingResults.length,results,formingResults},null,2));
  console.log('Chief tongue access: fixed-input foot/skate approach matrix, real mouth hits, fair misses and retirement passed.');
});
