import assert from 'node:assert/strict';
import {mkdir, writeFile} from 'node:fs/promises';
import {withSkateRuntime, makeInput} from './jungle-cup-harness.mjs';

const entry={id:'natural-grind-test',name:'Natural grind test',data:{v:1,name:'Natural grind test',
 spawn:[0,-9.4,0],killY:-40,components:[
  {t:'platform',p:[0,-10,0],s:[400,1,400],edgeGrinding:false},
  {t:'gate',p:[0,-9.5,-190]},
 ]}};
const reports=[];
await withSkateRuntime(async({THREE,server,level,scene,Player,CONST,TUNING})=>{
 const {Rail}=await server.ssrLoadModule('/src/rails.ts');
 const {railLandingFraction,naturalRailLandingTime}=await server.ssrLoadModule('/src/grindLanding.ts');
 const {createSkateReference}=await server.ssrLoadModule('/src/skateReferencePhysics.ts');
 const {nearestReferenceRail}=await server.ssrLoadModule('/src/referenceRailCapture.ts');
 const p=new Player(scene),control=new Player(scene);
 const reference=createSkateReference({kind:'thps1',metresPerUnit:.025,stats:{ollie:8,speed:8,air:8},railCapture:{origin:[0,0,0],axes:[1,-2,3]}});
 const close=(a,b,label)=>assert.ok(Math.abs(a-b)<1e-7,`${label}: ${a} != ${b}`);
 const snapshot=r=>({pos:r.pos.toArray(),vy:r.vVel,speed:r.speed,state:r.state});
 const scenarios=[
  {name:'descent',height:1.3,vy:-1},
  {name:'rising arc',height:.6,vy:6},
  {name:'diagonal',height:1.1,vy:-1,offset:-1.05,cross:5},
  {name:'uphill',height:1.2,vy:-1,slope:.3},
  {name:'downhill',height:1.2,vy:-1,slope:-.3},
  {name:'curve',height:1.3,vy:-1,curve:true},
  {name:'rail transfer',height:1.1,vy:-1,offset:1.05,transfer:5},
  {name:'slide carry',height:1.1,vy:-1,offset:1.05,slide:5},
  {name:'fast descent',height:1,vy:-85,fast:true},
 ];
 const misses=[
  {name:'parallel near miss',height:.7,vy:-1,offset:1.2},
  {name:'moving away',height:.8,vy:-1,offset:-.9,cross:-5},
  {name:'finite endpoint',height:1.2,vy:-1,short:true},
  {name:'below the rail',height:-1,vy:1},
 ];
 let rail;
 function fixture(mode,angle,dir,c){
  level.skatepark=mode!=='campaign';level.skateReferencePhysics=mode==='reference'?reference:undefined;
  const slope=c.slope??0;
  const points=c.curve?[[0,4,100],[0,4,0],[.5,4,-2],[2,4,-100]]:
   [[0,4-slope*(c.short?2:100),c.short?2:100],[0,4+slope*(c.short?2:100),c.short?-2:-100]];
  const rotate=v=>v.applyAxisAngle(new THREE.Vector3(0,1,0),angle);
  rail=new Rail(points.map(v=>rotate(new THREE.Vector3(...v))),false);
  level.rails.splice(0,level.rails.length,rail);level.grindRails.splice(0,level.grindRails.length,rail);
  const start=new THREE.Vector3(c.offset??0,4+CONST.railRideHeight+c.height,c.short?-1.4*dir:c.curve?1*dir:0);
  start.y+=-start.z*slope;
  const velocity=rotate(new THREE.Vector3(c.cross??0,0,-12*dir));
  const position=rotate(start),heading=velocity.clone().normalize();
  for(const rider of [p,control]){
   rider.competitionMode=false;rider.endlessDeaths=true;
   rider.respawn(level,true,true,{position,heading});
   rider.pos.copy(position);rider.prevPos.copy(position);rider.axisF.copy(heading);rider.axisL.set(heading.z,0,-heading.x);
   rider.state='air';rider.grounded=false;rider.freeSkate=rider.airFromSkate=true;rider.airGrav='board';
   rider.speed=velocity.length();rider.vVel=c.vy;rider.lastVelX=velocity.x;rider.lastVelZ=velocity.z;
   rider.rawInput=makeInput();rider.camDir.copy(heading);rider.airRose=true;
   rider.grindExitAir=!!c.transfer;rider.grindAirLat=(c.transfer??0)*dir;rider.slideAirLat=(c.slide??0)*dir;
   // Native capture examines the previous travelled sweep. Start with a
   // real airborne sweep rather than the zero-length one after a respawn.
   rider.parkRailSweepReady=true;rider.parkRailSweepStart.copy(position).addScaledVector(velocity,-2*CONST.fixedStep);
   rider.parkRailSweepStart.y+=30*reference.railCapture.unit-c.vy*2*CONST.fixedStep;
   // Physical contact is the subject here; no extra world props/ground edges.
   rider.railCand={rail,sample:rail.closest(position)};
  }
 }
 let contact=null;
 const enter=p.enterGrind.bind(p);
 p.enterGrind=(r,s,l)=>{contact={feet:p.pos.toArray(),rail:s.point.toArray(),natural:p.naturalGrindRail===r,from:p.prevPos.toArray()};enter(r,s,l);};
 const quick=process.argv.includes('--quick');
 for(const mode of quick?['campaign']:['campaign','park','reference'])
 for(const angle of quick?[0]:[0,Math.PI/2])for(const dir of quick?[1]:[-1,1])
 for(const tap of quick?[false]:[false,true])for(const c of scenarios){
  // A curve's turn is authored in one direction; the reverse cases use the
  // same geometry and still must preserve any predicted natural approach.
  fixture(mode,angle,dir,c);contact=null;let frames=0,flightFrames=0,pressFrame=-1;
  for(;frames<100;frames++){
   // The imported controller deliberately rejects some quantized sweeps.
   // Tap when its unchanged query actually offers a catch, then release.
   const offered=mode!=='reference'||nearestReferenceRail(level.grindRails,p.parkRailSweepStart,
    p.pos.clone().add(new THREE.Vector3(0,30*reference.railCapture.unit,0)),
    p.axisF.clone().multiplyScalar(p.speed).setY(p.vVel),reference.railCapture,false);
   const pressed=pressFrame<0&&!!offered;if(pressed)pressFrame=frames;
   control.step(CONST.fixedStep,makeInput(),level);
   p.step(CONST.fixedStep,makeInput({grindPressed:pressed,grindHeld:!tap||pressed}),level);
   if(p.state==='grind')break;
   assert.equal(p.state,'air',`${mode}/${c.name}: lost valid landing`);
   assert.equal(p.isBailing,false,`${mode}/${angle}/${dir}/${tap}/${c.name}: rail landing bailed at ${frames}, pending ${p.naturalGrindGrace}`);
   const a=snapshot(p),b=snapshot(control);
   a.pos.forEach((v,i)=>close(v,b.pos[i],`${mode}/${c.name} unaltered axis ${i}, frame ${frames}`));
   close(a.vy,b.vy,'unaltered vertical velocity');close(a.speed,b.speed,'unaltered speed');flightFrames++;
  }
  assert.ok(contact,`${mode}/${c.name}/${dir}/${tap}: never caught rail`);
  assert.equal(contact.natural,true,`${mode}/${c.name}/${dir}/${tap}: premature assisted catch`);
  close(contact.feet[1],contact.rail[1]+CONST.railRideHeight,'contact height');
  if(!c.fast)assert.ok(flightFrames>=2,`${c.name}: skipped approach frames`);
  assert.equal(p.naturalGrindRail,null);assert.equal(p.naturalGrindGrace,0);
  reports.push({mode,angle,dir,tap,name:c.name,pressFrame,flightFrames,contact});
 }
 for(const tap of [false,true])for(const c of [scenarios[0],{height:.6,vy:14,name:'high kite arc'}]){
  fixture('campaign',0,1,c);level.builtFromData.kiteTow=true;contact=null;
  for(const rider of [p,control]){
   rider.kiteMotion.reset(7);rider.kiteMotion.started=true;rider.kiteMotion.speed=12;
   // A calm long arc stays over the rail; wind-driven near misses should
   // still receive assistance and are not physical landing fixtures.
   if(c.vy>0){rider.kiteMotion.wind=rider.kiteMotion.windTarget=0;rider.kiteMotion.windTime=10;}
  }
  let flightFrames=0;
  for(let frame=0;frame<180;frame++){
   control.step(CONST.fixedStep,makeInput(),level);
   p.step(CONST.fixedStep,makeInput({grindPressed:frame===0,grindHeld:!tap||frame===0}),level);
   if(p.state==='grind')break;
   p.pos.toArray().forEach((v,i)=>close(v,control.pos.getComponent(i),'unaltered kite approach'));
   close(p.vVel,control.vVel,'unaltered kite gravity');flightFrames++;
  }
  assert.equal(p.state,'grind');assert.equal(contact.natural,true);assert.ok(flightFrames>2);
  close(contact.feet[1],contact.rail[1]+CONST.railRideHeight,'kite contact height');
  reports.push({mode:'kite',name:c.name,tap,flightFrames,contact});level.builtFromData.kiteTow=false;
 }
 // The original proximity is still useful for approaches that will miss.
 for(const c of misses){
  fixture('campaign',0,1,c);contact=null;
  assert.ok(rail.closest(p.pos).distance<=TUNING.railSnapDistance,c.name+' fixture outside existing capture radius');
  p.step(CONST.fixedStep,makeInput({grindHeld:true,grindPressed:true}),level);
  assert.equal(p.state,'grind',c.name+': lost original assistance');assert.equal(contact.natural,false,c.name);
 }
 // Demonstrate the original early transition using the same real Player.
 fixture('campaign',0,1,scenarios[0]);const defer=p.deferNaturalGrind;p.deferNaturalGrind=()=>false;contact=null;
 p.step(CONST.fixedStep,makeInput({grindHeld:true,grindPressed:true}),level);
 assert.equal(p.state,'grind');assert.ok(contact.feet[1]>contact.rail[1]+1);
 p.deferNaturalGrind=defer;
 // A buffered natural offer cannot attach to a rail that disappeared, or
 // survive a respawn. No button-free catches were added.
 fixture('campaign',0,1,scenarios[0]);p.step(CONST.fixedStep,makeInput({grindPressed:true}),level);
 assert.ok(p.naturalGrindRail);rail.grindable=false;
 p.step(CONST.fixedStep,makeInput(),level);assert.equal(p.naturalGrindRail,null);assert.notEqual(p.state,'grind');
 fixture('campaign',0,1,scenarios[0]);p.step(CONST.fixedStep,makeInput({grindPressed:true}),level);
 p.respawn(level,true);assert.equal(p.naturalGrindRail,null);assert.equal(p.naturalGrindGrace,0);
 // Sweeps must not extend a short rail or substitute its infinite line.
 const short=new Rail([new THREE.Vector3(0,0,1),new THREE.Vector3(0,0,-1)],false);
 assert.equal(railLandingFraction(short,{x:0,y:2,z:2},{x:0,y:-2,z:2},.15,.7),null);
 assert.equal(railLandingFraction(short,{x:0,y:-1,z:0},{x:0,y:2,z:0},.15,.7),null);
 assert.equal(naturalRailLandingTime(short,{x:0,y:2,z:0},{x:0,y:-1,z:-40},()=>70,.15,.7,1/60,90),null);
 console.log(`PASS ${reports.length} natural landings with identical pre-contact flight, four unchanged near-miss catches, exact contact, tap lifetime, source profiles, slopes and finite rail sweeps.`);
}, {levelEntry:entry});
const output=process.env.GRIND_LANDING_OUTPUT||'/private/tmp/natural-grind-landings';
await mkdir(output,{recursive:true});await writeFile(output+'/runtime.json',JSON.stringify(reports,null,2)+'\n');
