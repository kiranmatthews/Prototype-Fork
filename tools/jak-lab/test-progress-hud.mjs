import assert from 'node:assert/strict';
import {readFile,writeFile} from 'node:fs/promises';
import {createRequire} from 'node:module';
import ts from 'typescript';
import {Vector3} from 'three';
const require=createRequire(import.meta.url),modules={};
for(const name of ['particleMotion','sunParticles','progressPlacement','progressHud','screenHud']) {
  const source=await readFile(new URL(`../../src/jak-lab/${name}.ts`,import.meta.url),'utf8');
  const compiled=ts.transpileModule(source,{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022},reportDiagnostics:true});
  assert.ok(!compiled.diagnostics?.length,'Source must parse');
  const module={exports:{}};new Function('require','module','exports',compiled.outputText)(path=>path.startsWith('./')?modules[path.slice(2)]:require(path),module,module.exports);modules[name]=module.exports;
}
const option=name=>process.argv[process.argv.indexOf(name)+1];
const catalogue=JSON.parse(await readFile(option('--catalogue'),'utf8'));
const oracle=JSON.parse(await readFile(option('--callbacks'),'utf8'));
const placement=JSON.parse(await readFile(option('--placement'),'utf8'));
const definition=catalogue.progressHud,before=JSON.stringify(catalogue);
assert.deepEqual(definition.sources,oracle.sources);
const {ParticleMotion}=modules.particleMotion,{ProgressHud}=modules.progressHud;
const {initialProgressPlacement,placeProgress}=modules.progressPlacement;
const motion=new ParticleMotion({id:0,name:'source callback fixtures',items:[],source:{file:'test',line:0}},new Map());
function particle(initial,name,userdata=0) {
  return {callback:name,position:new Vector3(initial[0].x,initial[0].y,initial[0].z),values:{userdata,
    'scale-x':initial[0].w,'scale-y':initial[1].w,r:initial[2].x,g:initial[2].y,b:initial[2].z,a:initial[2].w}};
}
function check(p,expected,label) {
  assert.deepEqual(p.position.toArray(),['x','y','z'].map(k=>expected[0][k]),label+' position');
  assert.deepEqual([p.values['scale-x'],p.values['scale-y']],[expected[0].w,expected[1].w],label+' scales');
  assert.deepEqual([p.values.r,p.values.g,p.values.b,p.values.a],['x','y','z','w'].map(k=>expected[2][k]),label+' RGBA');
  assert.deepEqual([...motion.issues],[]);
}
for(const sample of oracle.samples) {
  const h=sample.host;motion.host.progress={owner:0,states:[0],joints:[],
    leftScale:[h['left-side-x-scale'],h['left-side-y-scale']],rightScale:[h['right-side-x-scale'],h['right-side-y-scale']],
    xScale:h['sides-x-scale'],slotScale:h['slot-scale'],option:h['option-index'],offset:h['in-out-position'],transitionInverse:h['transition-percentage-invert']};
  const p=particle(sample.initial,sample.name);motion.callback(p);check(p,sample.result,sample.name);
}
for(const sample of oracle.orbitSamples) {
  motion.host.progress={owner:sample.owner,states:new Array(32).fill(sample.state),joints:sample.joints.map(icon=>new Map(Object.entries(icon).map(([id,v])=>[Number(id),new Vector3(v.x,v.y,v.z)])))};
  const p=particle(sample.initial,'fuel-cell-progress-hud-orbit-callback',sample.joint);motion.callback(p);check(p,sample.result,'orbit');
}
for(const sample of placement.cases) {
  const profile=definition.profiles.find(p=>p.id===sample.format),state=initialProgressPlacement(definition,profile);
  state.positions[2].x=sample.prior_right??Math.fround(profile.scales['right-x-offset']+409+Math.trunc(Math.fround(301.5*Math.fround(sample.offset/4096))));
  const input={page:sample.mode,nextPage:sample.next_mode??sample.mode,offset:sample.offset,transition:sample.transition,clock:sample.clock,
    taskStates:[1,1,2,2,2,2,2,3].slice(0,sample.count),taskIndex:sample.option,option:sample.option%4,
    lastOptionChange:sample.last_change??0,filledSlots:sample.filled??[true,false,true,false],cardReady:sample.card_ready??true,
    levelOpen:sample.level_open??true,statTransition:sample.stat??false,levelTransition:sample.level??0};
  const actual=placeProgress(definition,profile,state,input),label=JSON.stringify({...sample,result:undefined});
  assert.deepEqual(state.positions,sample.result.positions,label+' source positions');
  assert.deepEqual(state.states,sample.result.states,label+' task states');
  assert.deepEqual(state.yaws,sample.result.icons.slice(0,4).map(icon=>icon.yaw),label+' source yaw updates');
  assert.deepEqual(actual.origins,sample.result.origins,label+' projected origins');
  assert.deepEqual(Object.fromEntries(Object.entries(actual.scales).filter(([key])=>key.includes('-scale'))),sample.result.scales,label+' scales');
}
const particles=new Map(catalogue.particles.map(p=>[p.id,p]));
const make=(format,only)=>{
  const layers=definition.profiles[0].layers.flatMap((layer,sourceIndex)=>{
    if(only!==undefined&&sourceIndex!==only)return [];
    const group=catalogue.groups.find(g=>g.name===layer.group);assert.ok(group);
    return [{sourceIndex,origin:new Vector3(),motion:new ParticleMotion(group,particles,1000,group.id+1,catalogue.callbackPrograms)}];
  });
  const poses=[];
  const hud=new ProgressHud(definition,layers,(pose,joints)=>{
    poses[pose.index]={...pose};
    for(const id of [3,4,5,6,7,9])joints.set(id,new Vector3(Math.fround(id*.125),Math.fround(id*.25),Math.fround(id*.5)));
  });
  hud.select(format);hud.restart();return {hud,poses};
};
let frames=0,particleSamples=0;
const snapshot=h=>({phase:h.phase,clock:h.clock,offset:h.offset,transition:h.transition,page:h.page,nextPage:h.nextPage,
  placement:structuredClone(h.placement),layers:h.layers.map(l=>({sourceIndex:l.sourceIndex,origin:l.origin.toArray(),
    particles:l.motion.particles.map(p=>({id:p.id,values:{...p.values},position:p.position.toArray()}))}))});
function step(hud,dt=1/60) {
  hud.update(dt);frames++;
  for(const {motion} of hud.layers) {
    assert.deepEqual([...motion.issues],[]);assert.equal(motion.dropped,0);
    for(const p of motion.particles){assert.ok([...p.position.toArray(),...Object.values(p.values)].every(Number.isFinite));particleSamples++;}
  }
}
for(const format of ['4:3','16:9'])for(const page of ['fuel-cell','money','buzzer','save-game','auto-save','frame']) {
  const {hud,poses}=make(format);hud.selectPage(page);hud.restart();
  hud.otherHudVisible=true;for(let i=0;i<3;i++)step(hud);
  assert.equal(hud.phase,'waiting');assert.ok(hud.layers.every(l=>!l.motion.particles.length));
  hud.otherHudVisible=false;step(hud);assert.equal(hud.phase,'waiting');
  for(let i=0;i<70;i++)step(hud);
  assert.equal(hud.phase,'in');assert.equal(hud.offset,0);assert.equal(hud.transition,0);
  assert.deepEqual(poses.map(p=>p.frame),[null,2.5,10,15.5]);
  const identities=hud.layers.map(l=>l.motion.particles.map(p=>p.id));
  for(let i=0;i<4;i++)step(hud);
  assert.deepEqual(hud.layers.map(l=>l.motion.particles.map(p=>p.id)),identities,'persistent source particle identities');
  hud.hide();for(let i=0;i<75;i++)step(hud);
  assert.equal(hud.phase,'hidden');assert.ok(hud.layers.every(l=>!l.motion.particles.length));
  hud.restart();step(hud);const start=snapshot(hud);hud.update(2);hud.restart();step(hud);assert.deepEqual(snapshot(hud),start);
}
for(const format of ['4:3','16:9']) {
  const a=make(format).hud,b=make(format).hud;
  for(let i=0;i<120;i++){a.update(1/60);b.update(1/120);b.update(1/120);}assert.deepEqual(snapshot(a),snapshot(b),'fixed source frame rate');
  for(const only of [0,6,14,19,27,31]) {
    const full=make(format).hud,one=make(format,only).hud;
    for(let frame=0;frame<50;frame++){step(full);step(one);}
    assert.deepEqual(snapshot(one).layers[0],snapshot(full).layers[only],'isolated source layer equality');
  }
}
let sourceHostFrames=0;
for(const timeline of placement.timelines) {
  const {hud}=make(timeline.format);hud.taskStates=[1,1,2,2,2,2,2,3];hud.taskIndex=2;
  hud.selectPage(timeline.start);hud.restart();let priorAction='';
  for(const record of timeline.records) {
    if(record.action!==priorAction) {
      if(['fuel-cell','money','buzzer','save-game','auto-save','frame'].includes(record.action))hud.selectPage(record.action);
      else if(record.action==='hide')hud.hide();
      else if(record.action==='slot')hud.selectOption(2);
      else if(record.action==='level-up')hud.changeLevel(1);
      else if(record.action==='level-down')hud.changeLevel(2);
    }
    priorAction=record.action;step(hud);sourceHostFrames++;
    const label=`${timeline.format} ${timeline.start} ${record.action} ${record.clock}`;
    assert.equal(hud.phase,record.phase,label+' phase');assert.equal(hud.clock,record.clock,label+' clock');
    assert.equal(hud.offset,record.offset,label+' offset');assert.equal(hud.transition,record.transition,label+' transition');
    assert.equal(hud.page,record.page,label+' page');
    if(!record.active){assert.ok(hud.layers.every(l=>!l.motion.particles.length));continue;}
    assert.equal(hud.taskIndex,record.taskIndex,label+' selected task');assert.equal(hud.option,record.option,label+' selected option');
    assert.deepEqual(hud.placement.positions,record.result.positions,label+' positions');
    assert.deepEqual(hud.placement.states,record.result.states,label+' states');
    assert.deepEqual(hud.placement.yaws,record.result.icons.slice(0,4).map(icon=>icon.yaw),label+' yaw');
    for(const {origin,sourceIndex} of hud.layers)assert.deepEqual(origin.toArray(),Object.values(record.result.origins[sourceIndex]),label+' layer '+sourceIndex);
  }
}
assert.equal(JSON.stringify(catalogue),before,'catalogue inputs remain immutable');
const assemblies=modules.screenHud.screenHudDefinitions(catalogue);assert.ok(assemblies.some(a=>a.id===31004&&a.screenHud==='progress'));
const result={status:'PASS',scalarCases:oracle.samples.length,orbitCases:oracle.orbitSamples.length,
  placementCases:placement.cases.length,sourceHostFrames,frames,particleSamples,checks:['source callbacks and placement','both formats and six layouts',
    'fixed-step lifecycle, wait, cleanup and deterministic restart','persistent identities and isolated/full agreement','held source icon frames','2712 independent source-host frames','immutable catalogue'],
  scope:'Source/runtime parity; actual icon assets are covered by test-progress-rig.mjs, with build and browser evidence recorded separately.'};
await writeFile(option('--output'),JSON.stringify(result,null,2)+'\n');console.log(JSON.stringify(result));
