import assert from 'node:assert/strict';
import {mkdir,writeFile} from 'node:fs/promises';
const {chromium}=await import(process.env.PLAYWRIGHT_MODULE||'playwright');
const base=process.argv.find(a=>/^https?:/.test(a))||'http://127.0.0.1:5201';
const full=process.argv.includes('--full'),checkpoints=process.argv.includes('--checkpoints');
const holdThroughLanding=process.argv.includes('--hold-charge');
const output=process.env.WATERPARK_BROWSER_OUTPUT||'/private/tmp/waterpark-browser';
await mkdir(output,{recursive:true});
const browser=await chromium.launch({headless:true,channel:'chrome'});
const page=await browser.newPage({viewport:{width:1440,height:900}}),errors=[];
page.on('pageerror',e=>errors.push(e.message));page.on('console',m=>{if(m.type()==='error')errors.push(m.text());});
try{
 await page.goto(new URL('?playtest&level=waterpark'+(full?'':'&lite'),base).href);
 await page.waitForFunction(()=>window.__game&&!window.__game.gameFlow.blocksGameplay,null,{timeout:90000});
 await page.screenshot({path:`${output}/entrance-${full?'full':'lite'}.png`});
 await page.evaluate(async ({checkpoints,holdThroughLanding})=>{
  const g=window.__game,l=g.getLevel(),p=g.player;
  const source=await import('/src/levels/waterpark.ts'),{createWaterparkPilot}=await import('/tools/waterpark-pilot.mjs');
  p.respawn(l,true);
  const pilot=createWaterparkPilot(source,{fastLine:!checkpoints,holdThroughLanding});
  const report=window.waterparkReview={frame:0,done:false,failed:null,phase:pilot.phase,peak:0,evidence:null,end:null,tuning:{...g.TUNING},loopFrames:0,loopFraming:[],airFraming:[],rampFraming:[]};
  const render=g.renderer.render.bind(g.renderer),projected=p.pos.clone(),vertex=p.pos.clone(),instance=g.camera.matrixWorld.clone(),world=g.camera.matrixWorld.clone();
  let lastAirFrame=-10,lastLoopFrame=-10,lastRampFrame=-10;
  const sightRay=new p.raycaster.constructor(),sightTarget=p.pos.clone(),sightDirection=p.pos.clone();
  const measureAir=()=>{
   const rider=p.riderRef;if(!rider)return;rider.updateWorldMatrix(true,true);rider.updateMatrixWorld(true);
   let minY=Infinity,maxY=-Infinity,minX=Infinity,maxX=-Infinity,vertices=0,behind=0;
   const visit=node=>{
    if(node!==rider&&!node.visible)return;
    if(node.isMesh&&!node.userData.characterRenderProxy){
     const mats=Array.isArray(node.material)?node.material:[node.material],positions=node.geometry.getAttribute('position');
     if(positions&&mats.some(mat=>mat.visible&&mat.opacity>0)){
      if(node.isSkinnedMesh)node.skeleton.update();
      for(let item=0;item<(node.isInstancedMesh?node.count:1);item++){
       world.copy(node.matrixWorld);if(node.isInstancedMesh){node.getMatrixAt(item,instance);world.multiply(instance);}
       for(let i=0;i<positions.count;i++){node.getVertexPosition(i,vertex).applyMatrix4(world).project(g.camera);vertices++;
        minY=Math.min(minY,vertex.y);maxY=Math.max(maxY,vertex.y);minX=Math.min(minX,vertex.x);maxX=Math.max(maxX,vertex.x);if(vertex.z>1)behind++;}
      }
     }
    }
    for(const child of node.children)visit(child);
   };visit(rider);
   report.airFraming.push({frame:report.frame,phase:pilot.phase,y:p.pos.y,verticalSpeed:p.vVel,minY,maxY,minX,maxX,vertices,behind,distance:g.camera.position.distanceTo(p.renderPosition)});
  };
  g.renderer.render=(scene,camera)=>{
   const result=render(scene,camera);
   if(scene===g.scene&&camera===g.camera&&p.grounded&&p.groundHit?.gravityTrack&&report.frame-lastRampFrame>=6&&!report.done){
    sightTarget.copy(p.renderPosition).addScaledVector(p.rideNormal,1.1);
    sightDirection.subVectors(sightTarget,camera.position);sightRay.set(camera.position,sightDirection.clone().normalize());sightRay.near=.08;sightRay.far=sightDirection.length()-.35;
    const blocking=sightRay.intersectObjects(l.groundMeshes,false).map(h=>h.object.name);
    report.rampFraming.push({frame:report.frame,phase:pilot.phase,clearance:sightTarget.subVectors(camera.position,p.renderPosition).dot(p.rideNormal),blocking});lastRampFrame=report.frame;
   }
   if(scene===g.scene&&camera===g.camera&&p.loopStatus.active&&report.frame-lastLoopFrame>=6&&!report.done){
    projected.copy(p.renderPosition).addScaledVector(p.rideNormal,.7).project(camera);
    report.loopFraming.push({frame:report.frame,distance:camera.position.distanceTo(p.renderPosition),fov:camera.fov,center:projected.toArray(),up:camera.up.toArray()});lastLoopFrame=report.frame;
   }
   if(scene===g.scene&&camera===g.camera&&!p.grounded&&!p.loopStatus.active&&['wave pools','coaster pools','dry flume','ravine launch','final loop gap'].includes(pilot.phase)&&report.frame-lastAirFrame>=6&&!report.done){measureAir();lastAirFrame=report.frame;}
   return result;
  };
  const fields=['moveX','moveY','jumpHeld','jumpPressed','jumpReleased','grindHeld','grindPressed','spinHeld','spinPressed','grabHeld','grabPressed','transferHeld','transferPressed','restartPressed'];
  let last={},advanced=false;
  const normalize=sample=>{
   const out=Object.fromEntries(fields.map(k=>[k,k==='moveX'||k==='moveY'?0:false]));Object.assign(out,sample);
   const length=Math.hypot(out.moveX,out.moveY);if(length>1){out.moveX/=length;out.moveY/=length;}
   out.moveX=Math.round(out.moveX*100)/100;out.moveY=Math.round(out.moveY*100)/100;
   for(const held of ['jumpHeld','grindHeld','spinHeld','grabHeld','transferHeld']){const pressed=held.replace('Held','Pressed');if(!(pressed in sample))out[pressed]=!!out[held]&&!last[held];}
   if(!('jumpReleased' in sample))out.jumpReleased=!out.jumpHeld&&!!last.jumpHeld;
   return out;
  };
  const snapshot=()=>({frame:report.frame,position:p.pos.toArray(),speed:p.speed,verticalSpeed:p.vVel,state:p.state,grounded:p.grounded,bailing:p.isBailing,loop:p.loopStatus,normal:p.rideNormal.toArray(),phase:pilot.phase});
  const realStep=p.step.bind(p),realCommit=p.commitRenderStep.bind(p);
  p.step=(dt,input,level)=>{
   if(report.done)return;
   try{last=normalize(pilot.sample(p,l));Object.assign(input,last);realStep(dt,input,level);advanced=true;}
   catch(e){report.failed={message:String(e),snapshot:snapshot()};report.done=true;}
  };
  p.commitRenderStep=(...args)=>{
   realCommit(...args);if(!advanced||report.done)return;advanced=false;report.frame++;
   pilot.observe(p,l);report.phase=pilot.phase;report.peak=Math.max(report.peak,p.pos.y);report.end=snapshot();
   if(p.loopStatus.active)report.loopFrames++;
   if(p.isBailing||['dead','gameover'].includes(p.state)){report.failed={message:'Main route bailed or died',snapshot:snapshot()};report.done=true;}
   if(p.state==='finished'){report.done=true;report.evidence=pilot.evidence;report.finalTuning={...g.TUNING};}
   if(report.frame>9000){report.failed={message:'Adaptive pilot exhausted its frame budget',snapshot:snapshot()};report.done=true;}
  };
 },{checkpoints,holdThroughLanding});
 const captured=new Set();
 for(let i=0;i<1200;i++){
  await page.waitForTimeout(250);
  const r=await page.evaluate(()=>({done:window.waterparkReview.done,phase:window.waterparkReview.phase,frame:window.waterparkReview.frame,p:window.__game.player.pos.toArray(),normal:window.__game.player.rideNormal.toArray(),air:!window.__game.player.grounded,verticalSpeed:window.__game.player.vVel,lip:window.__game.player.hangPipe?.lipY??0,pump:window.__game.player.boardG?.userData.vertMotion?.pump??0,transfer:window.__game.player.boardG?.userData.vertMotion?.transfer?.progress??-1,loops:window.__game.player.loopStatus.completed}));
  const shot=r.pump>.9&&r.normal[1]>.3&&r.normal[1]<.7?'vert-charge':r.transfer>.35&&r.transfer<.65?'transfer-rollover':r.phase==='first gravity drop'&&r.p[2]<-598?'gravity-drop':r.phase==='third gravity drop'&&r.p[2]<-936?'final-gravity-drop':r.phase==='tower descent'&&r.p[2]<20?'tower-descent':r.phase==='wave pools'&&r.air&&r.p[1]>r.lip+3&&Math.abs(r.verticalSpeed)<7?'wave-spine':r.phase==='downhill connector'&&!r.air&&r.p[2]<-202?'downhill-connector':r.phase==='coaster pools'&&r.air&&r.p[1]>r.lip+3&&Math.abs(r.verticalSpeed)<7?'boomerang-spine':r.phase==='dry flume'&&r.air&&r.p[2]<-520?'flume-jump':r.phase==='final loop gap'&&r.air?'final-loop-gap':r.phase==='loop'&&r.normal[1]<-.85?`loop-${r.loops+1}-inverted`:null;
  if(shot&&!captured.has(shot)){await page.screenshot({path:`${output}/${shot}-${full?'full':'lite'}.png`});captured.add(shot);}
  if(i%100===0)console.log(JSON.stringify(r));if(r.done)break;
 }
 const report=await page.evaluate(()=>window.waterparkReview);
 await writeFile(`${output}/adaptive-${full?'full':'lite'}${checkpoints?'-checkpoints':''}.json`,JSON.stringify({...report,errors},null,2));
 await page.screenshot({path:`${output}/finish-${full?'full':'lite'}.png`});
 assert.equal(report.done,true,'Live waterpark pilot timed out');
 assert.equal(report.failed,null,JSON.stringify(report.failed));
 assert.equal(report.end.state,'finished');assert.equal(report.evidence.transfers.length,5);assert.equal(report.evidence.jumps.length,4);
 assert.ok(report.evidence.inversions.length===3&&report.loopFrames>400,'The actual rendered rider must complete the giant loop');
 assert.ok(report.rampFraming.length>40,'Review the steep gravity roads in the actual render camera');
 assert.ok(report.rampFraming.every(f=>f.clearance>3.5&&f.blocking.length===0),`Coaster camera went under/behind a road: ${JSON.stringify(report.rampFraming.filter(f=>f.clearance<=3.5||f.blocking.length).slice(0,5))}`);
 assert.ok(report.evidence.checkpoints.includes(1),'The loop station checkpoint must be banked');
 if(checkpoints)assert.deepEqual(report.evidence.checkpoints,[0,1]);
 assert.equal(report.evidence.backwardInputs,0,'The linear course must never request reversing uphill');
 assert.equal(Object.keys(report.evidence.downhills).length,4,'All four upper downhill connectors must be traversed');
 for(const [name,run]of Object.entries(report.evidence.downhills))assert.ok(run.mounted&&run.frames>50&&run.minSpeed>12&&run.entry[1]>run.exit[1]+5,`${name} must be a supported momentum-carrying descent`);
 assert.ok(report.loopFraming.length>=10,'The loop needs actual rendered close-camera samples');
 const expectedDistance=Math.hypot(report.tuning.camDist,report.tuning.camHeight);
 assert.ok(report.loopFraming.every(f=>Math.abs(f.distance-expectedDistance)<.05),'The loop must preserve the ordinary close camera distance');
 assert.ok(report.loopFraming.every(f=>Math.abs(f.center[0])<1.05&&Math.abs(f.center[1])<1.05&&f.center[2]<1),'The inverted rider centre must stay on screen');
 assert.ok(report.airFraming.length>=50,'Ordinary giant airs need complete rendered-character framing samples');
 assert.ok(report.airFraming.every(f=>f.vertices>100&&f.behind===0),'Ordinary-air framing must measure the real visible rider');
 const cropped=report.airFraming.filter(f=>f.maxY>1.06||f.minY< -1.1);
 assert.equal(cropped.length,0,`The full rider cropped in ordinary giant airs: ${JSON.stringify(cropped.slice(0,5))}`);
 assert.deepEqual(report.finalTuning,report.tuning,'The pilot must never alter movement/camera tuning');
 assert.deepEqual(errors,[],'Browser errors during actual waterpark traversal');
 console.log(JSON.stringify({mode:full?'full':'lite',frame:report.frame,peak:report.peak,downhills:report.evidence.downhills,transfers:report.evidence.transfers.length,jumps:report.evidence.jumps.length,checkpoints:report.evidence.checkpoints,loopCameraDistance:[Math.min(...report.loopFraming.map(f=>f.distance)),Math.max(...report.loopFraming.map(f=>f.distance))],ordinaryAirBounds:{samples:report.airFraming.length,minY:Math.min(...report.airFraming.map(f=>f.minY)),maxY:Math.max(...report.airFraming.map(f=>f.maxY))},screenshots:[...captured],errors}));
}finally{await browser.close();}
