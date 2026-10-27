import assert from 'node:assert/strict';
import {mkdir,writeFile} from 'node:fs/promises';
import {withSkateRuntime,makeInput} from './jungle-cup-harness.mjs';
const out=process.env.BEACH_OUTPUT??'docs/beach-street/wind-finish';await mkdir(out,{recursive:true});
const report={started:new Date().toISOString()};
const data={v:1,name:'Kite release fixture',kiteTow:true,startWarpPad:false,spawn:[0,.1,0],killY:-15,components:[
 {t:'platform',p:[0,-.5,-60],s:[26,1,160]}, {t:'gate',p:[0,0,-100]}]};
try{await withSkateRuntime(async({THREE,Level,Player,scene})=>{
 const l=new Level(scene,{id:'kite-finish',name:data.name,data}),p=new Player(scene);p.rawInput=makeInput();
 const tick=(input={})=>{l.update(1/60);p.step(1/60,makeInput(input),l);};
 const snap=()=>({position:p.pos.toArray(),state:p.state,grounded:p.grounded,speed:p.speed,released:p.kiteReleased,skating:p.freeSkate,board:p.boardG?.visible,diagnostics:p.kiteDiagnostics});
 const reset=(z=73)=>{p.respawn(l,true,false,{position:new THREE.Vector3(0,.1,-z),heading:new THREE.Vector3(0,0,-1)});p.kiteMotion.reset(7);};
 try{
  scene.updateMatrixWorld(true);reset();
  for(let i=0;i<180&&!p.kiteReleased;i++)tick({jumpPressed:i===0,jumpHeld:true});
  report.release=snap();assert.ok(p.kiteReleased);assert.ok(p.pos.z>-84);assert.equal(p.kiteTowing,false);assert.equal(p.freeSkate,false);
  const sailStart=p.kiteVisual.root.position.clone();
  for(let i=0;i<120;i++)tick({jumpHeld:true});
  report.idle=snap();assert.equal(p.state,'ride');assert.equal(p.grounded,true);assert.equal(p.freeSkate,false);assert.ok(Math.abs(p.speed)<.01);assert.ok(p.pos.z>-85);
  assert.ok(p.kiteVisual.root.position.z<sailStart.z-15);assert.ok(p.kiteVisual.root.position.y>sailStart.y+2);
  tick({jumpReleased:true});assert.equal(p.grounded,true,'Old tow release cannot fire a jump');
  const idle=p.pos.clone();for(let i=0;i<45;i++)tick({moveX:1});for(let i=0;i<60;i++)tick();
  assert.ok(p.pos.x>idle.x+2,'Released rider can walk sideways');
  for(let i=0;i<45;i++)tick({moveY:-1});for(let i=0;i<60;i++)tick();
  assert.ok(p.pos.z>idle.z+2,'Released rider can walk backwards');assert.ok(p.kiteReleased);assert.equal(p.kiteVisual.root.visible,false,'Flyaway retires after leaving view');
  report.walk=snap();
  // Walk to the pad without a jump. Its ordinary sides/support may stop or
  // raise the feet, but walking contact must never finish this course.
  for(let i=0;i<300;i++)tick({moveX:Math.max(-1,Math.min(1,-p.pos.x*2)),moveY:1});
  report.walkUp=snap();assert.notEqual(p.state,'finished','Finish is a deliberate jump after kite release');
  for(let i=0;i<240&&p.pos.z<-95;i++)tick({moveY:-1});for(let i=0;i<90;i++)tick();
  assert.ok(p.pos.z>-98);assert.equal(p.state,'ride');
  for(let i=0;i<360&&p.state!=='finished';i++){
   const near=p.pos.z<-96;
   if(near&&!report.jump){
    for(let j=0;j<6;j++)tick({moveY:1,jumpPressed:j===0,jumpHeld:true});
    tick({moveY:1,jumpReleased:true});report.jump=snap();
   }else tick({moveY:1});
  }
  report.finish=snap();assert.equal(p.state,'finished');assert.ok(report.jump);assert.equal(p.freeSkate,false);
  reset();assert.equal(p.kiteReleased,false);assert.equal(p.kiteVisual.flyingAway,false);
  tick({spinPressed:true});assert.ok(p.kiteTowing);report.reset=snap();
 }finally{l.dispose();}
});report.pass=true;console.log('PASS kite release, intact flyaway, fresh-jump rearm, walking/standing, intentional finish and retry reset');}
catch(e){report.pass=false;report.error=e.stack;throw e;}
finally{report.finished=new Date().toISOString();await writeFile(`${out}/native-finish.json`,JSON.stringify(report,null,2)+'\n');}
