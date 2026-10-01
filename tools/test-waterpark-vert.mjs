import assert from 'node:assert/strict';
import {withWaterparkRuntime} from './waterpark-runner.mjs';
import {createWaterparkPilot} from './waterpark-pilot.mjs';

const pumpResults=[];
for(const held of [false,true])await withWaterparkRuntime(r=>{
  const {p,l,THREE}=r,hp=l.halfpipes[5];
  p.respawn(l,true,false,{position:new THREE.Vector3(0,hp.yBottom+.05,hp.cross),heading:new THREE.Vector3(0,0,-1)});
  p.freeSkate=true;p.speed=12;p.skateMountT=-1;
  let peak=p.pos.y,airs=0,wasAir=false;
  for(let frame=0;frame<900;frame++){
    r.tick({jumpHeld:held});
    peak=Math.max(peak,p.pos.y);
    if(p.vertAir&&!wasAir)airs++;
    wasAir=p.vertAir;
    assert.ok(!p.isBailing&&p.totalDeaths===0);
  }
  pumpResults.push({held,peak,lip:hp.lipY,airs});
});
assert.ok(pumpResults[1].peak>pumpResults[0].peak+5,'Held X must earn visibly more height than coasting from identical momentum');
assert.ok(pumpResults[1].peak>pumpResults[1].lip+2&&pumpResults[1].airs>=2,'Held X alone must repeatedly clear the second-set coping');

await withWaterparkRuntime(r=>{
  const {p,l}=r,pilot=createWaterparkPilot(r.source,{holdThroughLanding:true});
  let pumpingAfterAir=0,loadedFrames=0,rolloverFrames=0,upright=false,maxTurn=0,maxFootError=0;
  let previousNormal=null;
  for(let frame=0;frame<5000&&p.state!=='finished';frame++){
    const wasGrounded=p.grounded;
    r.tick(pilot.sample(p,l));pilot.observe(p,l);
    assert.ok(!p.isBailing&&p.totalDeaths===0,`held-through-landing run failed ${JSON.stringify(r.snapshot())}`);
    if(wasGrounded&&p.grounded&&p.freeSkate&&p.groundHit?.halfpipe&&p.jumpReleaseRearmRequired&&p.rawInput.jumpHeld){
      pumpingAfterAir++;
      assert.ok(p.charging,'An air-owned release must not disable held pumping after pipe contact');
    }
    const motion=p.boardG?.userData.vertMotion;
    if(motion?.pump>.95){loadedFrames++;assert.ok(motion.kneeFlex>1.5,'A charged vert must show a deep knee load');}
    if(motion?.transfer){
      rolloverFrames++;
      if(motion.transfer.progress>.35&&motion.transfer.progress<.65)upright ||= p.alignNormal.y>.9;
      if(previousNormal)maxTurn=Math.max(maxTurn,p.alignNormal.angleTo(previousNormal));
      previousNormal=p.alignNormal.clone();
    }else previousNormal=null;
    const error=p.boardG?.userData.skateContact?.footError;
    if((motion?.pump>.95||motion?.transfer)&&Number.isFinite(error))maxFootError=Math.max(maxFootError,error);
  }
  assert.equal(p.state,'finished');assert.equal(pilot.evidence.transfers.length,5);
  console.log('Held-X contact coverage:',{pumpingAfterAir,loadedFrames,rolloverFrames,upright,maxTurn,maxFootError});
  assert.ok(pumpingAfterAir>50&&loadedFrames>100,'Exercise held-X pipe landings and sustained loaded poses');
  assert.ok(rolloverFrames>60&&upright&&maxTurn<.2,'Transfers must roll smoothly through upright rather than snap between walls');
  assert.ok(maxFootError<.04,`Deep charge/transfer poses lost deck contact: ${maxFootError}`);
  console.log('Held-X pump and transfer presentation:',{pumpingAfterAir,loadedFrames,rolloverFrames,maxTurn,maxFootError});
});
console.log('Second-set charge/coast comparison:',pumpResults);

await withWaterparkRuntime(r=>{
  const {p,l}=r,pilot=createWaterparkPilot(r.source,{holdThroughLanding:true});
  let landed=false;
  for(let frame=0;frame<600;frame++){
    r.tick(pilot.sample(p,l));pilot.observe(p,l);
    if(p.grounded&&p.jumpReleaseRearmRequired){landed=true;break;}
  }
  assert.ok(landed,'Fixture must hold an armed air press into a real pipe landing');
  for(let i=0;i<8;i++)r.tick({...r.directionInput([0,0,-1]),jumpHeld:true});
  assert.ok(p.charging&&p.jumpReleaseRearmRequired,'The fresh ground pump must work while the old release is still owned');
  r.tick({...r.directionInput([0,0,-1]),jumpHeld:false});
  assert.ok(p.grounded&&p.state==='ride'&&p.vVel===0,'Immediate air-owned release must not relaunch on contact');
  assert.equal(p.jumpReleaseRearmRequired,false);
  for(let i=0;i<25;i++)r.tick({...r.directionInput([0,0,-1]),jumpHeld:true});
  assert.ok(p.charging&&p.chargeTimer>=r.TUNING.jumpChargeTime,'A fresh deliberate charge must rearm normally');
  console.log('Pipe landing release ownership: immediate release consumed; held pump and next deliberate charge preserved.');
});
