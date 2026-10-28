import assert from 'node:assert/strict';
import {mkdir,writeFile} from 'node:fs/promises';
import {withSkateRuntime,makeInput} from './jungle-cup-harness.mjs';
const data={v:1,name:'Kite control fixture',kiteTow:true,startWarpPad:false,spawn:[0,.12,0],killY:-15,components:[
 {t:'platform',p:[0,-.5,-100],s:[26,1,250]},
 {t:'rail',p:[-4,.65,-35],len:40,yaw:0},
 {t:'wall',p:[0,0,-170],s:[6,3,1]},
 {t:'bonusplatform',p:[3,0,-100],to:[-3,.12,-105]},
 {t:'crate',p:[-5,0,-130],kind:'wood'},
 {t:'gate',p:[0,0,-215]}]};
const out=process.env.BEACH_OUTPUT??'docs/beach-street/kite-controls',report={started:new Date().toISOString()};await mkdir(out,{recursive:true});
try{
 await withSkateRuntime(async({THREE,Level,Player,scene,TUNING})=>{
  const l=new Level(scene,{id:'kite-controls',name:data.name,data}),p=new Player(scene);p.rawInput=makeInput();
  const tick=(input=makeInput())=>{l.update(1/60);p.step(1/60,input,l);input.consumeEdges();};
  const reset=(x=0,z=0)=>{p.respawn(l,true,false,{position:new THREE.Vector3(x,.12,-z),heading:new THREE.Vector3(0,0,-1)});p.kiteMotion.reset(7);p.lives=9;};
  const launch=()=>tick(makeInput({spinPressed:true}));
  const charge=frames=>{for(let i=0;i<frames;i++)tick(makeInput({jumpPressed:i===0,jumpHeld:true}));tick(makeInput({jumpReleased:true}));};
  const pose=()=>{
   const parts=[[p.armL,p.gloveRight?.gripSocket],[p.armR,p.gloveLeft?.gripSocket]].map(([shoulder,grip])=>({shoulder:shoulder.getWorldPosition(new THREE.Vector3()).toArray(),grip:grip.getWorldPosition(new THREE.Vector3()).toArray()}));
   const uncrossed=(parts[0].shoulder[0]-parts[1].shoulder[0])*(parts[0].grip[0]-parts[1].grip[0])>0;
   const forward=parts.every(a=>a.grip[2]<a.shoulder[2]-.15);
   return {parts,uncrossed,forward,errors:p.kiteVisual.gripErrors.slice()};
  };
  try{
   scene.updateMatrixWorld(true);reset();for(let i=0;i<180;i++)tick();
   report.waiting={p:p.pos.toArray(),speed:p.speed,visible:p.kiteVisual.root.visible,started:p.kiteMotion.started,pose:pose()};
   assert.equal(p.kiteMotion.started,false);assert.equal(p.speed,0);assert.ok(Math.abs(p.pos.z)<.001);assert.ok(p.kiteVisual.root.visible);
   assert.ok(report.waiting.pose.forward&&report.waiting.pose.uncrossed,JSON.stringify(report.waiting));
   assert.ok(Math.max(...report.waiting.pose.errors)<.04);
   tick(makeInput({grabPressed:true,grabHeld:true}));assert.ok(p.kiteMotion.started);assert.equal(p.grabPhase,'none');
   report.charges=[];
   for(const frames of [1,12,24,48]){
    reset();launch();for(let i=0;i<60;i++)tick();
    charge(frames);
    const expected=TUNING.ollieMinVelocity+(TUNING.ollieVelocity-TUNING.ollieMinVelocity)*Math.min(1,frames/60/TUNING.jumpChargeTime);
    report.charges.push({frames,expected,actual:p.launchVy,state:p.state});
    assert.ok(Math.abs(p.launchVy-expected)<1e-7);assert.equal(p.state,'air');
   }
   let peak=p.pos.y;for(let i=0;i<90;i++){tick();peak=Math.max(peak,p.pos.y);}
   report.floatPeak=peak;assert.ok(peak>3.4,'Full normal charge receives floatier kite gravity');
   reset();launch();assert.ok(p.spinning,'Ground spin restored');
   for(let i=0;i<60;i++)tick();charge(24);tick(makeInput({spinPressed:true,moveX:-1}));
   report.flip={name:p.flipName,time:p.flipT,special:p.specialFlip};assert.ok(p.flipT>0);assert.equal(p.specialFlip,null);
   tick(makeInput({grabPressed:true,grabHeld:true,transferPressed:true}));assert.equal(p.grabPhase,'none');assert.equal(p.specialGrab,null);
   reset(-4,8);launch();
   for(let i=0;i<120&&-p.pos.z<17;i++)tick(makeInput({moveX:Math.max(-1,Math.min(1,(-4-p.pos.x)*3))}));
   tick(makeInput({grindPressed:true,grindHeld:true}));
   report.grind={state:p.state,rail:p.grindRail?.name,visible:p.kiteVisual.root.visible};assert.equal(p.state,'grind');
   for(let i=0;i<24;i++)tick(makeInput({jumpHeld:true,grindHeld:true}));tick(makeInput({jumpReleased:true,grindHeld:false}));
   report.grindExit={state:p.state,v:p.vVel,type:p.lastJumpType};assert.equal(p.state,'air');assert.ok(p.vVel>=TUNING.grindJumpForce-.01);
   reset(0,153);launch();for(let i=0;i<240&&p.state!=='dead';i++)tick(makeInput({moveX:Math.max(-1,Math.min(1,-p.pos.x*3))}));
   assert.equal(p.state,'dead');assert.equal(p.lives,8);assert.equal(p.breakApartDiagnostics.style,'kite-collapse');
   const barStart=p.kiteVisual.bar.getWorldPosition(new THREE.Vector3()),headStart=p.headM.getWorldPosition(new THREE.Vector3());
   const handStart=p.breakApart.tetherDiagnostics;
   for(let i=0;i<60;i++)tick();
   const barEnd=p.kiteVisual.bar.getWorldPosition(new THREE.Vector3()),headEnd=p.headM.getWorldPosition(new THREE.Vector3());
   const handEnd=p.breakApart.tetherDiagnostics;
   report.death={barStart:barStart.toArray(),barEnd:barEnd.toArray(),headStart:headStart.toArray(),headEnd:headEnd.toArray(),handStart,handEnd,fragments:p.breakApartDiagnostics};
   assert.ok(barEnd.z<barStart.z-10);assert.ok(headEnd.y<headStart.y-.2);assert.ok(handEnd.length>=2&&handEnd.length<=3);
   for(const hand of handEnd){const start=handStart.find(h=>h.name===hand.name);assert.ok(hand.position[2]<start.position[2]-10);}
   for(let i=0;i<360&&p.state==='dead';i++)tick();const respawn=p.pos.clone();for(let i=0;i<180;i++)tick(makeInput({jumpHeld:true}));
   report.respawn={p:p.pos.toArray(),waiting:!p.kiteMotion.started,lives:p.lives};assert.ok(p.pos.distanceTo(respawn)<.2);assert.equal(p.kiteMotion.started,false);assert.ok(!p.kiteVisual.flyingAway);
   reset(-5,124);launch();for(let i=0;i<180&&!p.cratesBroken;i++)tick(makeInput({moveY:-1,moveX:Math.max(-1,Math.min(1,(-5-p.pos.x)*3))}));
   assert.equal(p.cratesBroken,1,'Braking through a reward box cannot turn it into a wall');assert.equal(p.state,'ride');
   reset(3,87);launch();for(let i=0;i<240&&!p.kiteBonusDocked;i++)tick(makeInput({moveX:Math.max(-1,Math.min(1,(3-p.pos.x)*3))}));
   assert.ok(p.kiteBonusDocked,'Straight approach automatically seats on the pad');
   for(let i=0;i<45;i++)tick();
   report.pad={diagnostics:l.bonusPlatformDiagnostics,dock:p.kiteDiagnostics.dock,p:p.pos.toArray()};
   assert.ok(l.bonusPlatformDiagnostics.tilt>1);assert.ok(Math.max(...p.kiteDock.errors)<.05,JSON.stringify(report.pad));
   assert.ok(Math.max(...p.kiteDock.normalErrors)<.01);
   for(let i=0;i<12;i++)tick();assert.equal(l.consumeBonusLanding(p.pos,{enabled:true,grounded:true,jump:false,rising:false}),true);
   reset(3,65);launch();for(let i=0;i<90;i++)tick(makeInput({moveX:Math.max(-1,Math.min(1,(3-p.pos.x)*3))}));
   tick(makeInput({moveY:1}));tick();tick(makeInput({moveY:-1}));
   assert.equal(p.manualing,1);
   for(let i=0;i<240&&!p.kiteBonusDocked;i++)tick(makeInput({moveX:Math.max(-1,Math.min(1,(3-p.pos.x)*3)),moveY:Math.max(-.5,Math.min(.5,(p.balance*3+p.balanceVel*.8)/4))}));
   report.manualDock={docked:p.kiteBonusDocked,manual:p.manualing,armed:p.manualArmed};
   assert.ok(p.kiteBonusDocked,'Manual approach still catches the optional pad');assert.equal(p.manualing,0);assert.equal(p.manualArmed,0);
   reset(-3,87);launch();for(let i=0;i<200;i++)tick(makeInput({moveX:Math.max(-1,Math.min(1,(-3-p.pos.x)*3))}));
   assert.ok(-p.pos.z>110);assert.equal(p.kiteBonusDocked,false,'Steering around preserves the main run');
   const grounds=l.groundMeshes.slice();l.setTimeTrial(true);assert.equal(l.kiteBonusPad,null);
   l.setTimeTrial(false);assert.deepEqual(l.groundMeshes,grounds,'Upright pad cannot become an invisible floor after a trial');
   const captured=l.captureData();
   assert.deepEqual(captured.components.find(c=>c.t==='bonusplatform').p,[3,0,-100],'Editor capture stores the authored base, not the raised presentation');
   const ordinary=new Level(new THREE.Scene(),{id:'ordinary-bonus',name:'ordinary',data:{...data,kiteTow:false}});
   try{assert.equal(ordinary.bonusPlatformDiagnostics.tilt,0);assert.equal(ordinary.consumeBonusLanding(new THREE.Vector3(3,1.05,-100),{enabled:true,grounded:true,jump:false,rising:false}),false);}
   finally{ordinary.dispose();}
  }finally{l.dispose();}
 });
 report.pass=true;console.log('PASS native kite controls, forward/uncrossed grip, grind/flip, automatic pad/avoidance and tethered collapse');
}catch(e){report.pass=false;report.error=e.stack;throw e;}
finally{report.finished=new Date().toISOString();await writeFile(`${out}/native-controls.json`,JSON.stringify(report,null,2)+'\n');}
