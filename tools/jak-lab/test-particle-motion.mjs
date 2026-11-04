import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {createRequire} from 'node:module';
import ts from 'typescript';
import {Euler,Quaternion,Vector3} from 'three';

// Pure simulation check: no level, browser, WebGL, server or native scene load.
const source=await readFile(new URL('../../src/jak-lab/particleMotion.ts',import.meta.url),'utf8');
const js=ts.transpileModule(source,{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText;
const module={exports:{}};
new Function('require','module','exports',js)(createRequire(import.meta.url),module,module.exports);
const {ParticleMotion}=module.exports;
const numeric=(field,base)=>({field,op:'float',base});
const flags=(...value)=>({field:'flags',op:'value',value});
const definition=(id,fields=[])=>({id,source:{file:'fixture.gc',line:1},fields:[
  ...[numeric('num',1),numeric('timer',300)].filter(base=>!fields.some(f=>f.field===base.field)),...fields]});
const group=(items=[{particle:1,flags:['launch-asap']}])=>({id:1,name:'fixture',source:{file:'fixture.gc',line:1},items});
const run=(definitions,items)=>new ParticleMotion(group(items),new Map(definitions.map(d=>[d.id,d])));
const close=(actual,expected)=>assert.ok(Math.abs(actual-expected)<1e-7,`${actual} != ${expected}`);
const value=(field,value)=>({field,op:'value',value});
const contact=(actions,extra={})=>({kind:'height-contact',comparison:'below',descending:false,actions,...extra});
const withCallbacks=(definitions,programs,items)=>new ParticleMotion(group(items),new Map(definitions.map(d=>[d.id,d])),12000,1,programs);

{
  const motion=run([definition(1,[numeric('vel-y',1),numeric('launchrot-x',16384),numeric('launchrot-y',16384),numeric('conerot-z',16384)])]);
  motion.update(1/60);
  const expected=new Vector3(0,1,0).applyAxisAngle(new Vector3(1,0,0),Math.PI/2)
    .applyAxisAngle(new Vector3(0,1,0),Math.PI/2).applyAxisAngle(new Vector3(0,0,1),Math.PI/2).multiplyScalar(5);
  motion.particles[0].position.toArray().forEach((value,i)=>close(value,expected.getComponent(i)));
}
{
  const first=definition(1,[numeric('x',2),numeric('vel-x',.1),numeric('next-time',10),numeric('next-launcher',2)]);
  const next={id:2,source:first.source,fields:[numeric('y',7),{field:'z',op:'copy',value:'x'}]};
  const motion=run([first,next]);motion.update(2/60);
  close(motion.particles[0].position.x,3);close(motion.particles[0].position.y,7);close(motion.particles[0].position.z,2.5);
}
{
  const first=definition(1,[numeric('rot-z',16384),numeric('next-time',10),numeric('next-launcher',2)]);
  const next={id:2,source:first.source,fields:[numeric('rot-x',16384),flags('left-multiply-quat')]};
  const motion=run([first,next],[{particle:1,flags:['launch-asap','is-3d']}]);motion.update(2/60);
  const expected=new Quaternion().setFromAxisAngle(new Vector3(0,0,1),Math.PI/2)
    .multiply(new Quaternion().setFromAxisAngle(new Vector3(1,0,0),Math.PI/2));
  close(motion.particles[0].orientation.angleTo(expected),0);
}
for(const [values,blend,depth] of [[[],'normal',false],[['bit3'],'additive',false],[['bit4','bit9'],'subtractive',true]]) {
  const motion=run([definition(1,[flags(...values)])]);motion.update(1/60);
  assert.equal(motion.particles[0].blend,blend);assert.equal(motion.particles[0].depthWrite,depth);
}
{
  const motion=run([definition(1)],[{particle:1,'hour-mask':1<<12}]);motion.update(1/60);assert.equal(motion.particles.length,0);
  motion.hour=0;motion.update(1/60);assert.equal(motion.particles.length,1);
  const far=run([definition(1)],[{particle:1,'fade-after':4096}]);far.cameraDistance=4096;far.update(1/60);assert.equal(far.particles.length,0);
}
{
  const motion=run([definition(1)],[{particle:1,period:100,length:1,offset:20,flags:['bit1']}]);
  motion.update(1/60);assert.equal(motion.particles.length,1,'bit1 must recover a missed launch window');
}
{
  const make=()=>run([definition(1,[numeric('vel-y',.1),numeric('accel-y',-.01),numeric('friction',.96)])],[{particle:1}]);
  const a=make(),b=make();for(let i=0;i<120;i++)a.update(1/120);for(let i=0;i<30;i++)b.update(1/30);
  const snapshot=m=>m.particles.map(p=>[p.id,...p.position.toArray(),p.values.timer]);
  assert.deepEqual(snapshot(a),snapshot(b));a.reset();for(let i=0;i<60;i++)a.update(1/60);assert.deepEqual(snapshot(a),snapshot(b));
}
console.log('PASS source rotation order, relaunch aliases/quaternions, blend/depth flags, scheduling, hour/distance gating and deterministic fixed-step replay');

{
  const motion=withCallbacks([
    definition(1,[numeric('x',20),numeric('y',-4),numeric('z',30),numeric('vel-y',-2),value('func','contact')]),
    definition(2,[numeric('y',3),numeric('vel-y',1),value('texture','ripple')]),
    definition(3,[value('texture','spray')]),
  ],{contact:contact([{op:'kill'},{op:'launch',particle:2,is3d:true,height:'surface'},
    {op:'launch',particle:3,is3d:false,height:'particle'}],{descending:true})});
  assert.deepEqual([...motion.textureIds].sort(),['ripple','spray'],'callback children must preload their textures');
  motion.update(1/60);
  assert.equal(motion.particles.length,3);
  const [drop,ripple,spray]=motion.particles;
  assert.equal(drop.values.timer,0);close(drop.position.y,-14,'callback kill preserves this native scratchpad frame');
  assert.deepEqual(ripple.position.toArray(),[20,3,30]);assert.equal(ripple.is3d,true);
  assert.equal(ripple.age,0,'queued child must not integrate on its birth frame');
  assert.deepEqual(spray.position.toArray(),[20,-4,30]);
  motion.update(1/60);
  assert.equal(motion.particles.length,2,'dead contact must not emit a second splash');
  close(ripple.position.y,8);
}
{
  const motion=withCallbacks([
    definition(1,[numeric('y',-1),value('func','contact')]),
    definition(2,[numeric('num',.5),value('texture','fractional')]),
  ],{contact:contact([{op:'kill'},{op:'launch',particle:2,is3d:false,height:'surface'}])},[{particle:1}]);
  motion.update(1/60);assert.equal(motion.particles.filter(p=>p.texture==='fractional').length,0);
  motion.host.root.x=4096;motion.update(1/60);
  const children=motion.particles.filter(p=>p.texture==='fractional');
  assert.equal(children.length,1,'separate callback events share native launcher credit');
  close(children[0].position.x,4096,'credit carries; origin belongs to the event that emits');
  const snapshot=m=>m.particles.map(p=>[p.texture,...p.position.toArray(),p.age]);
  const first=snapshot(motion);motion.reset();motion.host.root.x=0;motion.update(1/60);motion.host.root.x=4096;motion.update(1/60);
  assert.deepEqual(snapshot(motion),first,'restart resets queued launches and accumulated credit');
}
for(const [height,velocity,comparison,descending,kill] of [
  [-1,1,'below',true,false],[-1,-1,'below',true,true],[0,-1,'below',false,false],
  [0,1,'at-or-above',false,true],[1,-1,'at-or-above',false,true],[-1,1,'at-or-above',false,false],
]) {
  const motion=withCallbacks([definition(1,[numeric('y',height),numeric('vel-y',velocity),value('func','contact')])],
    {contact:contact([{op:'kill'}],{comparison,descending})});motion.update(1/60);
  assert.equal(motion.particles[0].values.timer===0,kill,'source strict height / velocity conditions');
}
{
  const first=definition(1,[value('func','eco-track-root-prim-fadeout'),numeric('next-time',10),numeric('next-launcher',2)]);
  const next={id:2,source:first.source,fields:[numeric('func',0),numeric('timer',30),numeric('fade-a',-1)]};
  const motion=run([first,next]);motion.host.primitive.set(10,20,30);motion.update(1/60);
  assert.deepEqual(motion.particles[0].position.toArray(),[10,20,30]);
  for(let i=0;i<10;i++)motion.update(1/60);
  assert.equal(motion.particles[0].values['next-launcher'],2,'eco stays in its live phase until host fade');
  motion.host.fadeOut=true;motion.update(1/60);
  assert.equal(motion.particles[0].callback,'');assert.equal(motion.particles[0].values['next-launcher'],0);
}
{
  const motion=run([definition(1,[value('birth-func','birth-func-ocean-height'),numeric('userdata',100)])]);
  motion.host.oceanHeight=()=>4096;motion.update(1/60);close(motion.particles[0].position.y,4196);
  const money=run([definition(1,[value('func','sparticle-track-root-money')])]);
  money.host.root.set(20,30,40);money.update(1/60);assert.deepEqual(money.particles[0].position.toArray(),[20,2078,40]);
}
{
  const motion=run([definition(1,[value('birth-func','birth-func-copy-target-y-rot'),numeric('vel-x',1),numeric('accel-x',.5)])]);
  motion.host.targetYaw=32768;motion.update(1/60);
  close(motion.particles[0].values['vel-z'],-1.5);close(motion.particles[0].values['accel-z'],-.5);
  const orient=run([definition(1,[value('birth-func','birth-func-target-orient')])],[{particle:1,flags:['launch-asap','is-3d']}]);
  orient.host.targetNormal.set(0,.8,.6);orient.update(1/60);
  const normal=new Vector3(0,1,0).applyQuaternion(orient.particles[0].orientation);
  close(normal.distanceTo(orient.host.targetNormal),0);
}
{
  const defs=[definition(1,[numeric('scale-x',8192),numeric('rot-z',4096),numeric('r',40),numeric('g',50),numeric('b',60)]),
    definition(2,[numeric('num',2),value('birth-func','birth-func-copy2-rot-color'),value('texture','child')])];
  const motion=run(defs,[{particle:1,binding:2,flags:['launch-asap']},{particle:2,flags:['start-dead','launch-asap','is-3d']}]);
  motion.update(2/60);
  const children=motion.particles.filter(p=>p.texture==='child');assert.equal(children.length,2);
  for(let i=0;i<2;i++) {
    const expected=new Quaternion().setFromEuler(new Euler(0,Math.PI/8,i===0?3*Math.PI/4:Math.PI/4,'YXZ'));
    close(children[i].orientation.angleTo(expected),0);assert.deepEqual(['r','g','b'].map(c=>children[i].values[c]),[40,50,60]);
  }
}
console.log('PASS callback asset reachability, source contact boundaries, delayed secondary births, fractional credit, eco fade, root/orientation inputs and alternating parent-relative birth motion');

{
  const motion=withCallbacks([definition(1,[numeric('num',40),numeric('y',-1),value('func','contact')]),
    definition(2,[value('texture','splash')])],{contact:contact([{op:'kill'},{op:'launch',particle:2,is3d:false,height:'surface'}])});
  motion.update(1/60);assert.equal(motion.queueDrops,8);assert.equal(motion.particles.filter(p=>p.texture==='splash').length,32);
  motion.reset();assert.equal(motion.queueDrops,0);
}
console.log('PASS original 32-entry shared secondary launch queue');

const replay=(duration,linger)=>({kind:'part-tracker',group:'fixture',duration,linger,
  source:{file:'fixture.gc',line:1,function:'state:die:fixture'},formSha256:'fixture'});
{
  const motion=run([definition(1,[numeric('timer',-1)])],[{particle:1}]);
  motion.replay=replay(10,10);
  motion.update(1/60);motion.update(1/60);
  assert.equal(motion.particles.length,2);assert.equal(motion.replayPhase,'emitting');
  motion.update(1/60);
  assert.equal(motion.particles.length,2);assert.equal(motion.replayPhase,'lingering');
  motion.update(2/60);assert.equal(motion.particles.length,2,'notify suspend must preserve keyed particles');
  motion.update(1/60);assert.equal(motion.particles.length,0);assert.equal(motion.replayPhase,'finished');
  motion.reset();motion.update(2/60);assert.equal(motion.particles.length,2,'restart retains the selected source replay');
}
{
  const motion=run([definition(1,[numeric('timer',-1)])],[{particle:1}]);
  motion.replay=replay(6,6);motion.update(2/60);assert.equal(motion.particles.length,2);
  motion.update(3/60);assert.equal(motion.particles.length,2,'each source suspend phase rounds independently');
  motion.update(1/60);assert.equal(motion.particles.length,0);
  motion.replay=replay(0,0);motion.reset();motion.update(1/60);assert.equal(motion.particles.length,0,'zero-duration tracker never spawns');
}
{
  const motion=withCallbacks([
    definition(1,[numeric('y',-1),value('func','surface')]),definition(2,[numeric('timer',-1)])
  ],{surface:contact([{op:'kill'},{op:'launch',particle:2,is3d:false,height:'surface'}])});
  motion.replay=replay(5,0);motion.update(3/60);
  assert.equal(motion.replayPhase,'finished');assert.equal(motion.particles.length,1);
  assert.equal(motion.particles[0].controlled,false,'unkeyed callback children must survive tracker cleanup');
}
console.log('PASS source tracker emission, independent linger/notify suspension, restart, zero-duration and keyed cleanup');
