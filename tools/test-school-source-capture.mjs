import assert from 'node:assert/strict';
import {readFile,writeFile} from 'node:fs/promises';
import {withSkateRuntime,makeInput} from './jungle-cup-harness.mjs';
await withSkateRuntime(async({server,THREE,Player,Level,scene})=>{
 const {nearestReferenceRail,railPointToNative}=await server.ssrLoadModule('/src/referenceRailCapture.ts');
 const {Rail}=await server.ssrLoadModule('/src/rails.ts');
 const {validSkateReference,createSkateReference}=await server.ssrLoadModule('/src/skateReferencePhysics.ts');
 const {normalizeCustomLevelData}=await server.ssrLoadModule('/src/level.ts');
 const m=await server.ssrLoadModule('/src/levels/school-source.ts');
 const unit=m.SCHOOL_SOURCE_SCALE,base={kind:'thps1',metresPerUnit:unit,stats:{ollie:4,speed:8,air:8,balance:5}},frame={...m.SCHOOL_SOURCE_LEVEL.skateReference.railCapture,unit};
 const reference={...base,railCapture:{origin:frame.origin,axes:frame.axes}};
 assert.equal(createSkateReference(base).railCapture,undefined);assert.ok(validSkateReference(reference));
 for(const railCapture of [null,false,[],{origin:[0,0,0],axes:[1,1,3]},{origin:[0,0,0],axes:[1,2,4]},{origin:[NaN,0,0],axes:[1,2,3]},{origin:[0,0],axes:[1,2,3]},{origin:[0,0,0],axes:[1,2,3],extra:1}])assert.equal(validSkateReference({...base,railCapture}),false);
 const point=a=>new THREE.Vector3(...a),line=new Rail([point([0,0,-10]),point([0,0,10])],false);
 const cross=nearestReferenceRail([line],point([-4,.5,0]),point([4,.5,0]),point([10,0,0]),frame,false);
 assert.equal(cross.rail,line);assert.ok(cross.sample.point.distanceTo(point([0,0,-2*unit]))<1e-9,'Registered crossing retains the original two-unit integer interpolation offset');
 assert.equal(nearestReferenceRail([line],point([-4,2,0]),point([4,2,0]),point([10,0,0]),frame,false),null);
 assert.equal(nearestReferenceRail([line],point([-4,-.5,0]),point([4,-.5,0]),point([10,0,0]),frame,true),null);
 const shortRail=new Rail([point([0,0,-1]),point([0,0,1])],false),alternate=new Rail([point([0,.5,-4]),point([0,.5,4])],false);
 const endpoint=nearestReferenceRail([alternate,shortRail],point([-2,0,1.2]),point([2,0,1.2]),point([0,0,10]),frame,false);
 assert.equal(endpoint.rail,alternate,'An invalid nearer outward endpoint must not hide another eligible chain');
 assert.equal(nearestReferenceRail([shortRail],point([-2,0,1.2]),point([2,0,1.2]),point([0,0,10]),frame,false),null);
 assert.equal(nearestReferenceRail([shortRail],point([-2,0,1.2]),point([2,0,1.2]),point([0,0,-10]),frame,false).rail,shortRail);
 line.grindable=false;assert.equal(nearestReferenceRail([line],point([-4,.5,0]),point([4,.5,0]),point([10,0,0]),frame,false),null);line.grindable=true;
 const shifted={origin:[103,-21,407],axes:[-3,-2,-1],unit};
 assert.deepEqual(railPointToNative(point([103+2*unit,-21+3*unit,407+4*unit]),shifted),[-4*4096,-3*4096,-2*4096]);
 const data={v:1,name:'Source capture integration',skatepark:true,skateReference:reference,spawn:[0,.1,8],killY:-40,components:[{t:'platform',p:[0,-.5,0],s:[100,1,100],edgeGrinding:false},{t:'gate',p:[40,0,-40]}]};
 const level=new Level(scene,{id:'source-capture',name:data.name,data});level.update(0);scene.updateMatrixWorld(true);
 const p=new Player(scene);p.enterLevel('source-capture');p.rawInput=makeInput();p.respawn(level,true,false);level.rails.push(line);level.grindRails.push(line);
 try{
  assert.deepEqual(level.captureData().skateReference,reference);assert.deepEqual(normalizeCustomLevelData(level.captureData()).skateReference,reference);
  // Isolated capture fixture: seed the preceding sweep once. Ordinary route
  // tests separately verify input-only approaches at the real School scale.
  p.pos.set(4,.5,0);p.grounded=false;p.state='air';p.speed=10;p.axisF.set(1,0,0);p.axisL.set(0,0,-1);p.vVel=0;
  p.parkRailSweepStart.set(-4,.5,0);p.parkRailSweepEnd.set(4,.5,0);p.rawInput=makeInput({grindHeld:true});
  assert.ok(p.tryGrind(true,level));assert.equal(p.grindRail,line);assert.equal(p.state,'grind');
  p.exitGrind(0,level);assert.ok(Math.abs(p.regrindCd-5/30)<1e-12);
  p.grindExitAir=true;p.grindOllieAir=true;p.grindOllieCatchGrace=.2;
  p.regrindCd=0;p.rawInput=makeInput();
  assert.equal(p.tryGrind(false,level),false,'A released legacy buffer must not request a source capture');
  p.rawInput=makeInput({grindHeld:true});assert.ok(p.tryGrind(false,level));
 }finally{level.dispose();}
 const original=JSON.parse(await readFile('docs/school/source-geometry.json','utf8'));
 for(const node of original.railNodes){
  const p=point(m.schoolSourcePoint(...node.position));
  const expected=node.position.map((v,i)=>Math.round(v*(i===1?-4096:4096))||0);
  assert.deepEqual(railPointToNative(p,frame).map(v=>v||0),expected,`Original School node ${node.id}`);
 }
 assert.deepEqual(m.SCHOOL_SOURCE_LEVEL.skateReference,reference);
 assert.deepEqual(m.SCHOOL_SOURCE_RAILS.map(r=>r.ids),original.railActivation.paths);
 // Coincident activated chains resolve in newest-first CRail list order.
 const twin=new Rail(line.points.map(p=>p.clone()),false);
 assert.equal(nearestReferenceRail([line,twin],point([-4,.5,0]),point([4,.5,0]),point([10,0,0]),frame,false).rail,twin);
 const realRails=m.SCHOOL_SOURCE_RAILS.map(r=>new Rail(r.points.map(point),false));
 const times=[];const from=realRails[0].points[0].clone().add(point([-1,.4,0])),to=from.clone().add(point([2,0,0])),velocity=point([12,0,0]);
 for(let i=0;i<1200;i++){const start=performance.now();nearestReferenceRail(realRails,from,to,velocity,frame,false);if(i>=200)times.push(performance.now()-start);}
 times.sort((a,b)=>a-b);
 const report={scale:unit,frame,mappedOriginalNodes:original.railNodes.length,quantizedCrossingOffset:cross.sample.point.toArray(),activationOrder:'Newest activated chain first',queryMilliseconds:{samples:times.length,median:times[500],p95:times[950],max:times.at(-1)},sweptCrossing:true,outsideRadiusRejected:true,groundSideRejected:true,outwardEndpointRejected:true,alternateEligibleChain:true,inwardEndpointAccepted:true,disabledRailRejected:true,sourceFrameMapping:true,editorRoundTrip:true,invalidFramesRejected:true,legacyProfilesOptOut:true,productionCapture:true,heldInputRequired:true,sourceDepartureCooldownSeconds:5/30};
 await writeFile(process.env.SCHOOL_CAPTURE_REPORT||'/private/tmp/school-miami-review/reference31-capture-integration.json',JSON.stringify(report,null,2));console.log(JSON.stringify(report));
});
