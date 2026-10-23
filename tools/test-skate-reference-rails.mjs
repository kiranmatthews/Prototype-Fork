import assert from 'node:assert/strict';
import {writeFile} from 'node:fs/promises';
import {withSkateRuntime,makeInput} from './jungle-cup-harness.mjs';

await withSkateRuntime(async ({THREE,server,Player,Level,scene,CONST,TUNING})=>{
 const {createSkateReference,referenceRailMotion}=await server.ssrLoadModule('/src/skateReferencePhysics.ts');
 const {Rail}=await server.ssrLoadModule('/src/rails.ts');
 const reference={kind:'thps1',metresPerUnit:.01808,stats:{ollie:4,speed:8,air:8}};
 const profile=createSkateReference(reference),near=(a,b,e=1e-8)=>assert.ok(Math.abs(a-b)<e,`${a} != ${b}`);
 near(profile.railEntryBoost,7.0512);near(profile.railTransferAngle,17.578125*Math.PI/180);
 near(profile.railSlowThreshold,7.9453125);near(profile.railZeroSpeed,.132421875);
 near(profile.railSlopeBoost,.26484375);near(profile.finalSpeedLimit,50.5594285714,.0002);
 const cadence=[];
 for(const [initial,slope] of [[0,0],[2,0],[-2,0],[6,.4],[-6,-.4],[18,.4],[18,-.4]]){
  // Independent 30 Hz source-domain trace, before its final global cap.
  // Positions use Q12 velocity and half acceleration; low-speed decisions
  // occur at tick starts, including reversal on a climb.
  let qSpeed=initial/(30*.01808)*4096,qDistance=0;
  for(let frame=0;frame<90;frame++){
   if(!qSpeed)qSpeed=1000;
   if(Math.abs(qSpeed)<60000){if(slope>0)qSpeed-=2000;else if(slope<0)qSpeed+=2000;else qSpeed*=5/4;}
   qDistance+=qSpeed-slope*13000/2;qSpeed-=slope*13000;
  }
  for(const hz of [30,60,120]){
   let speed=initial,distance=0,seconds=0;
   for(let i=0;i<hz*3;i++) {const r=referenceRailMotion(profile,speed,slope,seconds,1/hz);speed=r.speed;distance+=r.distance;seconds=r.seconds;}
   near(speed,qSpeed/4096*30*.01808,1e-7);near(distance,qDistance/4096*.01808,1e-7);
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
   near(p.grindVel,Math.abs(along)+7.0512);assert.equal(p.grindDir,Math.sign(along));
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
  assert.ok(p.vVel>16 && p.pos.y>70,'The last supported release must ollie before the endpoint');
  const endpointRelease={vertical:p.vVel,height:p.pos.y};
  const cornerProjection=[];
  for(const degrees of [20,35])for(const direction of [1,-1]){
   const a=degrees*Math.PI/180;
   const pts=[new THREE.Vector3(0,70,0),new THREE.Vector3(0,70,-40),new THREE.Vector3(.1*Math.sin(a),70,-40-.1*Math.cos(a))];
   pts.push(pts[2].clone().add(new THREE.Vector3(40*Math.sin(2*a),0,-40*Math.cos(2*a))));
   const rail=new Rail(pts,false),at=direction===1?39.95:40.15;
   setup(rail,at,rail.tangentAt(at).multiplyScalar(18*direction).toArray());
   const before=p.grindVel;step();assert.equal(p.state,'grind');
   near(p.grindVel,before*Math.cos(a)**2,1e-7);
   cornerProjection.push({degrees,direction,before,after:p.grindVel,corners:2});
  }
  for(const direction of [1,-1]){
   const rail=new Rail([new THREE.Vector3(0,70,0),new THREE.Vector3(0,70,-40),new THREE.Vector3(40,70,-40)],false);
   const at=direction===1?39.95:40.05;
   setup(rail,at,rail.tangentAt(at).multiplyScalar(18*direction).toArray());const before=p.grindVel;
   step();assert.equal(p.state,'air');near(p.vVel,0);near(p.speed,before);
   cornerProjection.push({degrees:90,direction,before,after:p.speed,exit:true});
  }
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
  // A nearly vertical fast fall and fast lateral motion share one vector cap.
  p.respawn(l,true,false,{position:new THREE.Vector3(100,100,100),heading:new THREE.Vector3(0,0,-1)});
  p.state='air';p.grounded=false;p.airFromSkate=true;p.speed=30;p.vVel=-60;
  step();near(Math.hypot(p.speed,p.vVel),profile.finalSpeedLimit,1e-7);
  assert.equal(JSON.stringify(TUNING),tuning);
  const report={cadence,entry,exits,endpointRelease,cornerProjection,transfers,fall:{horizontal:p.speed,vertical:p.vVel,magnitude:Math.hypot(p.speed,p.vVel)},tuningUnchanged:true};
  await writeFile('/private/tmp/mall-recreation/measured/reference-rails.json',JSON.stringify(report,null,2));
  console.log(JSON.stringify(report));
 }finally{l.dispose();}
});
