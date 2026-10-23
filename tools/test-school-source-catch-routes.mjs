import assert from 'node:assert/strict';
import {readFile,writeFile} from 'node:fs/promises';
import {execFileSync} from 'node:child_process';
import {withSkateRuntime,makeInput} from './jungle-cup-harness.mjs';

// Observe ordinary controls on original School rails. Independently recover
// the native query from the retained trigger graph, then compare each actual
// catch with the compiled source line-pair oracle made by the math check.
await withSkateRuntime(async({server,Level,Player,scene,THREE,CONST})=>{
 const m=await server.ssrLoadModule('/src/levels/school-source.ts');
 const {Input}=await server.ssrLoadModule('/src/input.ts');
 const {schoolSourceTrials,schoolSourceGamepad}=await server.ssrLoadModule('/tools/school-source-lines.ts');
 const {nativeRailCandidate}=await server.ssrLoadModule('/src/referenceRailCapture.ts');
 const data=JSON.parse(await readFile('docs/school/source-geometry.json','utf8'));
 const nodes=new Map(data.railNodes.map(n=>[n.id,n.position.map((v,i)=>Math.round(v*(i===1?-4096:4096)))]));
 const rails=data.railActivation.paths.map((ids,id)=>({id,points:ids.map(n=>nodes.get(n))})).reverse();
 const level=new Level(scene,{id:'school-source',name:m.SCHOOL_SOURCE_LEVEL.name,data:m.SCHOOL_SOURCE_LEVEL});scene.updateMatrixWorld(true);
 const p=new Player(scene);p.endlessDeaths=true;p.rawInput=makeInput();
 const input=new Input(true);let sample={},previous=null,current=null,active=null,frame=0;
 input.pollGamepad=()=>schoolSourceGamepad(sample);
 const native=p=>m.schoolOriginalPoint(...p.toArray()).map((v,i)=>Math.round(v*(i===1?-4096:4096)));
 const anchor=()=>p.pos.clone().addScaledVector(p.grounded?p.rideNormal:new THREE.Vector3(0,1,0),30*m.SCHOOL_SOURCE_SCALE);
 const oracleCases=[];
 const attempt=p.tryGrind.bind(p);
 p.tryGrind=(pressed,l)=>{
  assert.ok(p.parkRailSweepStart.distanceTo(previous)<1e-9);
  assert.ok(p.parkRailSweepEnd.distanceTo(current)<1e-9);
  const velocity=new THREE.Vector3();
  if(p.grounded){
   const n=p.rideNormal,slope=Math.hypot(n.x,n.z),nx=slope?n.x/slope:0,nz=slope?n.z/slope:0,down=p.axisF.x*nx+p.axisF.z*nz;
   velocity.set(p.axisF.x+nx*(n.y-1)*down,-slope*down,p.axisF.z+nz*(n.y-1)*down).multiplyScalar(p.speed);
  }else if(p.vertAir)velocity.set(-p.vertNormal.z*p.vertLatVel,p.vVel,p.vertNormal.x*p.vertLatVel);
  else velocity.set(p.axisF.x*p.speed+p.axisL.x*p.slideAirLat,p.vVel,p.axisF.z*p.speed+p.axisL.z*p.slideAirLat);
  const from=native(previous),to=native(current),q=nativeRailCandidate(rails,from,to,[-velocity.x,-velocity.y,velocity.z],{grounded:p.grounded});
  active.queries++;
  const caught=attempt(pressed,l);
  if(caught){
   assert.ok(q,'A production catch needs an independent original-graph candidate');
   const actual=level.grindRails.indexOf(p.grindRail);
   assert.equal(actual,q.rail,'Production capture must select the original candidate chain');
   assert.equal(p.grindDir,q.direction);
   const chain=rails.find(r=>r.id===q.rail),segment=[chain.points[q.segment],chain.points[q.segment+1]];
   oracleCases.push({points:[from,to,...segment],expected:[q.distance,q.t1,q.t2,...q.point1,...q.point2]});
   active.catches.push({frame,chain:data.railActivation.paths[q.rail][0],rail:actual,segment:q.segment,sourceDistance:q.distance,direction:q.direction,sourceRailPoint:q.point2.map(v=>v/4096),speed:p.speed});
  }
  return caught;
 };
 const place=(original,heading,speed=0)=>{
  p.rawInput=makeInput();p.respawn(level,true,true,{position:new THREE.Vector3(...m.schoolSourcePoint(...original)),heading:new THREE.Vector3(...heading)});
  p.axisF.set(...heading).normalize();p.axisL.set(p.axisF.z,0,-p.axisF.x);p.freeSkate=true;p.speed=speed;
  p.groundHit=p.queryGround(level);assert.ok(p.groundHit);p.pos.y=p.groundHit.y;p.prevPos.copy(p.pos);p.grounded=true;p.rideNormal.copy(p.groundHit.normal);
 };
 const fixtures=[];
 try{
  assert.equal(level.grindRails.length,rails.length);
  for(const c of schoolSourceTrials(p,level,place).filter(c=>/courtyard ollie|Original rail /.test(c.name))){
   active={name:c.name,queries:0,catches:[]};previous=null;current=null;frame=0;c.init();let done=false;
   for(;frame<c.limit;){
    current=anchor();previous??=current.clone();sample=c.sample(frame);input.update();frame++;
    p.step(CONST.fixedStep,input,level);level.update(CONST.fixedStep);input.consumeEdges();previous=current;
    assert.ok(!p.isBailing);assert.notEqual(p.state,'hang');
    if(c.observe(frame)){done=true;break;}
   }
   assert.ok(done,c.name);assert.ok(active.catches.length,c.name);
   fixtures.push({...active,frames:frame,result:c.result});
  }
 }finally{level.dispose();}
 const output=execFileSync('/private/tmp/school-miami-review/capture-oracle31/oracle',[],{input:oracleCases.map(c=>c.points.flat().join(' ')).join('\n')+'\n',encoding:'utf8'}).trim().split('\n');
 assert.equal(output.length,oracleCases.length);
 for(let i=0;i<output.length;i++)assert.deepEqual(output[i].split(' ').map(Number),oracleCases[i].expected,`School catch oracle ${i}`);
 const report={sourceRevision:'d9319c8d5b42c431de02bec0f02f0cf955f2fbae',querySpanSeconds:CONST.fixedStep,originalLogicHz:30,scale:m.SCHOOL_SOURCE_SCALE,originalGraphCandidateExact:true,productionSweepExact:true,compiledSourceCatchCases:oracleCases.length,ordinaryInputAfterInitialization:true,fixtures};
 await writeFile(process.env.SCHOOL_CATCH_ROUTES_REPORT||'/private/tmp/school-miami-review/reference31-catch-routes.json',JSON.stringify(report,null,2));
 console.log(JSON.stringify({cases:fixtures.length,steps:fixtures.reduce((n,f)=>n+f.frames,0),catches:fixtures.map(f=>({name:f.name,catches:f.catches})),compiledSourceCatchCases:oracleCases.length}));
});
