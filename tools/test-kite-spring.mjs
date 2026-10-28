import assert from 'node:assert/strict';
import {mkdir,writeFile} from 'node:fs/promises';
import {withSkateRuntime,makeInput} from './jungle-cup-harness.mjs';
const out=process.env.BEACH_OUTPUT??'docs/beach-street/kite-spring';await mkdir(out,{recursive:true});
const report={started:new Date().toISOString(),manuals:[],poses:[]};
const data={v:1,name:'Kite spring and manual fixture',kiteTow:true,startWarpPad:false,spawn:[0,.1,0],killY:-15,components:[
 {t:'platform',p:[0,-.5,-550],s:[40,1,1200]},{t:'gate',p:[0,0,-1100]}]};
try{await withSkateRuntime(async({THREE,Level,Player,scene,server})=>{
 let l=new Level(scene,{id:'kite-spring',name:data.name,data});const p=new Player(scene);p.rawInput=makeInput();
 const tick=(input={})=>{l.update(1/60);p.step(1/60,makeInput(input),l);};
 const snap=()=>({position:p.pos.toArray(),state:p.state,grounded:p.grounded,speed:p.speed,manual:p.manualing,combo:p.comboPoints,diagnostics:p.kiteDiagnostics,contact:p.boardG?.userData.skateContact});
 const reset=()=>{p.respawn(l,true);p.kiteMotion.reset(11);tick({grabPressed:true});for(let i=0;i<90;i++)tick();};
 const flick=type=>{tick({moveY:type});tick();tick({moveY:-type});};
 const balance=()=>({moveY:Math.max(-.5,Math.min(.5,(p.balance*3+p.balanceVel*.8)/4))});
 const gaze=()=>{const v=p.headLookSocket.getWorldDirection(new THREE.Vector3());return {direction:v.toArray(),dot:v.dot(p.axisF)};};
 try{
  scene.updateMatrixWorld(true);
  for(const type of [1,-1]){
   reset();flick(type);assert.equal(p.manualing,type,'Ordinary up/down flick enters the requested manual');
   const entered=snap(),initialCounter=p.kiteMotion.brakeSeconds;
   for(let i=0;i<180;i++)tick(balance());
   const held=snap(),eyes=gaze();assert.equal(p.manualing,type);assert.equal(p.state,'ride');assert.ok(p.comboPoints>entered.combo);
   assert.ok(p.kiteMotion.brakeSeconds<=initialCounter,'Balance input does not load the brake');
   assert.equal(held.contact.support,type>0?'rear-wheels':'front-wheels');
   assert.ok(held.contact.footError<.03);assert.ok(Math.max(...p.kiteVisual.gripErrors)<.03);assert.ok(eyes.dot>.999);
   for(let i=0;i<6;i++)tick({...balance(),jumpPressed:i===0,jumpHeld:true});tick({jumpReleased:true});
   assert.equal(p.manualing,0);assert.equal(p.state,'air');
   report.manuals.push({type,entered,held,eyes,exit:snap()});
  }
  // A completed airborne flick uses the shared landing buffer.
  for(let i=0;i<180&&!(p.vVel<0&&p.pos.y<.55);i++)tick();
  flick(1);assert.equal(p.manualArmed,1);
  for(let i=0;i<30&&!p.manualing;i++)tick();assert.equal(p.manualing,1);report.landingManual=snap();
  p.balance=1.01;p.balanceVel=.4;tick();assert.equal(p.state,'dead','A lost manual remains a fatal kite bail');report.failedManual=snap();
  for(const speed of [7.5,17,31.05]){
   reset();const yaw=[];let minGaze=1,maxGrip=0;
   for(let i=0;i<240;i++){
    p.kiteMotion.speed=speed;p.kiteMotion.wind=p.kiteMotion.windTarget=Math.sin(i/30);p.kiteMotion.windTime=100;
    tick();if(i>60){yaw.push(p.visualYaw);minGaze=Math.min(minGaze,gaze().dot);maxGrip=Math.max(maxGrip,...p.kiteVisual.gripErrors);}
   }
   const pose={speed,yawRange:Math.max(...yaw)-Math.min(...yaw),motion:p.kiteDiagnostics.poseMotion,minGaze,maxGrip,canopy:p.kiteVisual.sail.position.toArray()};
   assert.ok(minGaze>.999);assert.ok(maxGrip<.03);assert.ok(pose.canopy[1]>8&&pose.canopy[2]<=-28);report.poses.push(pose);
  }
  assert.ok(report.poses[0].yawRange<report.poses[2].yawRange*.55,'Slow riding has visibly less sway');
  assert.ok(report.poses[1].yawRange<report.poses[2].yawRange*.65,'Cruising is steadier than maximum speed');
  // Continuous Down reaches the cap exactly at 1 s, then cannot re-latch
  // until the physical input is released, including through a native frame.
  reset();for(let i=0;i<59;i++)tick({moveY:-1});assert.equal(p.kiteMotion.autoReleases,0);
  tick({moveY:-1});assert.equal(p.kiteMotion.autoReleases,1);
  for(let i=0;i<10;i++)tick({moveY:-1});assert.equal(p.kiteMotion.reserve,0);assert.equal(p.kiteMotion.brakeSeconds,0);report.burst=snap();
  for(let i=0;i<60;i++)tick({moveY:-1});assert.equal(p.kiteMotion.autoReleases,1);
  l.dispose();const {COASTAL_STREET_RUN_LEVEL:source}=await server.ssrLoadModule('/src/levels/coastal-street-run.ts');
  l=new Level(scene,{id:'coastal-street-run',name:source.name,data:source});scene.updateMatrixWorld(true);
  const footAt=position=>{p.respawn(l,true,false,{position:new THREE.Vector3(...position),heading:new THREE.Vector3(0,0,-1)});p.releaseKite(makeInput());};
  footAt([0,12.12,18]);for(let i=0;i<180;i++)tick({moveY:-1});report.startBoundary=snap();
  assert.ok(p.pos.z<24&&p.pos.z>20);assert.equal(p.state,'ride');assert.ok(p.grounded);
  footAt([0,7.12,-3024]);for(let i=0;i<90;i++)tick({moveY:1});
  for(let i=0;i<24;i++)tick({moveY:1,jumpPressed:i===0,jumpHeld:true});tick({moveY:1,jumpReleased:true});
  for(let i=0;i<180;i++)tick({moveY:1});report.endBoundary=snap();
  assert.ok(p.pos.z>-3029);assert.notEqual(p.state,'dead');assert.ok(p.grounded);
  const rear=source.components.find(c=>c.nm==='Kite start rear boundary');assert.equal(rear.invisible,true);
  const finish=source.components.find(c=>c.nm==='Finish overlook stone end wall');assert.ok(finish&&finish.s[0]>=16);
 }finally{l.dispose();}
});report.pass=true;console.log('PASS native manuals, landing buffer/fatal balance, forward gaze, speed-scaled sway, timed spring, invisible start and finished end containment');}
catch(e){report.pass=false;report.error=e.stack;throw e;}
finally{report.finished=new Date().toISOString();await writeFile(`${out}/native-spring.json`,JSON.stringify(report,null,2)+'\n');}
