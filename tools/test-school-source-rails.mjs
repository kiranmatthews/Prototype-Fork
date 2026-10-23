import assert from 'node:assert/strict';
import {writeFile} from 'node:fs/promises';
import {withSkateRuntime,makeInput} from './jungle-cup-harness.mjs';

await withSkateRuntime(async ({THREE,server,Player,Level,scene,CONST,TUNING})=>{
 const {createSkateReference,referenceRailMotion}=await server.ssrLoadModule('/src/skateReferencePhysics.ts');
 const {Rail}=await server.ssrLoadModule('/src/rails.ts');
 const {SCHOOL_SOURCE_SCALE:unit}=await server.ssrLoadModule('/src/levels/school-source.ts');
 const reference={kind:'thps1',metresPerUnit:unit,stats:{ollie:4,speed:8,air:8}};
 const profile=createSkateReference(reference),near=(a,b,e=1e-8)=>assert.ok(Math.abs(a-b)<e,`${a} != ${b}`);
 near(profile.railEntryBoost,390*unit);near(profile.railTransferAngle,17.578125*Math.PI/180);
 near(profile.railSlowThreshold,60000/4096*30*unit);near(profile.railZeroSpeed,1000/4096*30*unit);
 near(profile.railSlopeBoost,2000/4096*30*unit);near(profile.finalSpeedLimit,Math.trunc(58*4096*45/28)/4096*30*unit);
 const cadence=[];
 for(const [initial,slope] of [[0,0],[2,0],[-2,0],[6,.4],[-6,-.4],[18,.4],[18,-.4]]){
  // Independent 30 Hz source-domain trace, before its final global cap.
  // Positions use Q12 velocity and half acceleration; low-speed decisions
  // occur at tick starts, including reversal on a climb.
  let qSpeed=initial/(30*unit)*4096,qDistance=0;
  for(let frame=0;frame<90;frame++){
   if(!qSpeed)qSpeed=1000;
   if(Math.abs(qSpeed)<60000){if(slope>0)qSpeed-=2000;else if(slope<0)qSpeed+=2000;else qSpeed*=5/4;}
   qDistance+=qSpeed-slope*13000/2;qSpeed-=slope*13000;
  }
  for(const hz of [30,60,120]){
   let speed=initial,distance=0,seconds=0;
   for(let i=0;i<hz*3;i++) {const r=referenceRailMotion(profile,speed,slope,seconds,1/hz);speed=r.speed;distance+=r.distance;seconds=r.seconds;}
   near(speed,qSpeed/4096*30*unit,1e-7);near(distance,qDistance/4096*unit,1e-7);
   cadence.push({initial,slope,hz,speed,distance});
  }
 }
 const data={v:1,name:'Reference rail motion',skatepark:true,skateReference:reference,spawn:[0,.1,100],killY:-50,components:[
  {t:'platform',p:[0,-.5,0],s:[1000,1,1000],edgeGrinding:false},{t:'gate',p:[400,0,-400]},
 ]};
 const l=new Level(scene,{id:'reference-rails',name:data.name,data});l.update(0);scene.updateMatrixWorld(true);
 const p=new Player(scene);p.enterLevel('reference-rails');p.endlessDeaths=true;
 const tuning=JSON.stringify(TUNING),entry=[],exits=[];
 const makeRail=(slope=0,length=120)=>new Rail([new THREE.Vector3(0,70,0),new THREE.Vector3(0,70+slope*length,-Math.sqrt(1-slope*slope)*length)],false);
 const setup=(rail,at,velocity)=>{
  l.rails.splice(0,l.rails.length,rail);p.rawInput=makeInput();p.respawn(l,true,false,{position:rail.pointAt(at),heading:new THREE.Vector3(0,0,-1)});
  p.state='air';p.grounded=false;p.vVel=velocity[1];p.speed=Math.hypot(velocity[0],velocity[2]);
  if(p.speed){p.axisF.set(velocity[0]/p.speed,0,velocity[2]/p.speed);p.axisL.set(p.axisF.z,0,-p.axisF.x);}
  p.enterGrind(rail,rail.closest(rail.pointAt(at)),l);
 };
 const step=(input={})=>{p.step(CONST.fixedStep,makeInput(input),l);l.update(CONST.fixedStep);};
 try{
  for(const f of [{slope:0,velocity:[0,0,-18]},{slope:0,velocity:[30,0,-4]},{slope:.4,velocity:[0,-12,-18]},{slope:.4,velocity:[0,12,18]}]){
   const rail=makeRail(f.slope);setup(rail,40,f.velocity);
   const along=new THREE.Vector3(...f.velocity).dot(rail.tangentAt(40));
   near(p.grindVel,Math.abs(along)+390*unit);assert.equal(p.grindDir,Math.sign(along));
   entry.push({...f,along,speed:p.grindVel,direction:p.grindDir});
  }
  for(const slope of [0,.4,-.4])for(const direction of [1,-1]){
   const rail=makeRail(slope),t=rail.tangentAt(0).multiplyScalar(direction),v=t.clone().multiplyScalar(18);
   setup(rail,direction===1?rail.totalLength-.05:.05,v.toArray());
   step();assert.equal(p.state,'air');near(p.vVel,t.y*p.grindVel);near(p.speed,Math.hypot(t.x,t.z)*p.grindVel);
   exits.push({slope,direction,speed:p.speed,vertical:p.vVel,addedPop:p.vVel-t.y*p.grindVel});
  }
  const edgeRail=makeRail();setup(edgeRail,edgeRail.totalLength-.05,[0,0,-18]);
  p.charging=true;p.chargeTimer=.3;step({jumpReleased:true});
  assert.equal(p.state,'air');assert.equal(p.lastJumpType,'Grind Exit');
  assert.ok(p.vVel>12 && p.pos.y>70,'The last supported release must ollie before the endpoint');
  const endpointRelease={vertical:p.vVel,height:p.pos.y};
  const transfers=[];
  for(const slope of [0,.4,-.4])for(const direction of [1,-1])for(const side of [-1,1]){
   const rail=makeRail(slope),t=rail.tangentAt(40).multiplyScalar(direction),v=t.clone().multiplyScalar(18);
   setup(rail,40,v.toArray());const before=p.grindVel;
   p.exitGrind(profile.park.ollieMax,l,side,true);
   const a=17.578125*Math.PI/180,h=Math.hypot(t.x,t.z);
   const vx=before*(t.x*Math.cos(a)+side*t.z/h*Math.sin(a));
   const vy=before*t.y*Math.cos(a);
   const vz=before*(t.z*Math.cos(a)-side*t.x/h*Math.sin(a));
   near(p.speed*p.axisF.x,vx);near(p.speed*p.axisF.z,vz);near(p.vVel-profile.park.ollieMax,vy);
   near(Math.hypot(p.speed,p.vVel-profile.park.ollieMax),before);near(p.grindAirLat??0,0);
   transfers.push({slope,direction,side,velocity:[vx,p.vVel,vz]});
  }
  // Source HandleJump reads left/right directly in the rider's rail plane.
  // Rotate the camera through four headings: a right ollie must still go
  // right, with no extra fork lateral velocity layered onto the launch.
  const inputTransfers=[];
  for(const direction of [1,-1])for(const right of [-1,1]) {
   let baseline;
   for(const cameraYaw of [0,Math.PI/2,Math.PI,3*Math.PI/2]) {
    const rail=makeRail(.4),tangent=rail.tangentAt(40).multiplyScalar(direction);
    setup(rail,60,tangent.clone().multiplyScalar(18).toArray());
    p.camDir.set(Math.sin(cameraYaw),0,-Math.cos(cameraYaw));
    for(let i=0;i<20;i++)step({jumpHeld:true});
    assert.equal(p.state,'grind'); const before=p.grindVel;
    let launch;
    const oldExit=p.exitGrind;
    p.exitGrind=function(...args){oldExit.apply(this,args);launch={velocity:[this.speed*this.axisF.x,this.vVel,this.speed*this.axisF.z],lateral:this.grindAirLat??0};};
    try {step({jumpReleased:true,moveX:right});} finally {p.exitGrind=oldExit;}
    assert.ok(launch,'Directional release launches before rail motion');
    assert.equal(launch.lateral,0,'Source rail turn must not add fork strafe');
    const localRight=new THREE.Vector3(-tangent.z,0,tangent.x).normalize();
    const horizontal=new THREE.Vector3(launch.velocity[0],0,launch.velocity[2]);
    near(horizontal.dot(localRight),right*before*Math.sin(200/4096*Math.PI*2),1e-7);
    if(baseline) assert.deepEqual(launch,baseline,'Camera-independent source rail ollie'); else baseline=launch;
    inputTransfers.push({direction,right,cameraYaw,...launch});
   }
  }
  // A nearly vertical fast fall and fast lateral motion share one vector cap.
  p.respawn(l,true,false,{position:new THREE.Vector3(100,100,100),heading:new THREE.Vector3(0,0,-1)});
  p.state='air';p.grounded=false;p.airFromSkate=true;p.speed=30;p.vVel=-60;
  step();near(Math.hypot(p.speed,p.vVel),profile.finalSpeedLimit,1e-7);
  assert.equal(JSON.stringify(TUNING),tuning);
  const report={scale:unit,cadence,entry,exits,endpointRelease,transfers,inputTransfers,fall:{horizontal:p.speed,vertical:p.vVel,magnitude:Math.hypot(p.speed,p.vVel)},tuningUnchanged:true};
  await writeFile(process.env.SCHOOL_RAIL_REPORT||'/private/tmp/school-miami-review/reference-rails.json',JSON.stringify(report,null,2));
  console.log(`PASS source rails: ${cadence.length} cadence traces, ${entry.length} entries, ${exits.length} runoffs, ${transfers.length} directional launches, ${inputTransfers.length} camera-independent input launches, endpoint ollie and final velocity cap.`);
 }finally{l.dispose();}
});
