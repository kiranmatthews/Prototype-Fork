import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {createRequire} from 'node:module';
import ts from 'typescript';
import {Quaternion,Vector3} from 'three';

// Pure simulation check: no level, browser, WebGL, server or native scene load.
const source=await readFile(new URL('../../src/jak-lab/particleMotion.ts',import.meta.url),'utf8');
const js=ts.transpileModule(source,{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText;
const module={exports:{}};
new Function('require','module','exports',js)(createRequire(import.meta.url),module,module.exports);
const {ParticleMotion}=module.exports;
const numeric=(field,base)=>({field,op:'float',base});
const flags=(...value)=>({field:'flags',op:'value',value});
const definition=(id,fields=[])=>({id,source:{file:'fixture.gc',line:1},fields:[numeric('num',1),numeric('timer',300),...fields]});
const group=(items=[{particle:1,flags:['launch-asap']}])=>({id:1,name:'fixture',source:{file:'fixture.gc',line:1},items});
const run=(definitions,items)=>new ParticleMotion(group(items),new Map(definitions.map(d=>[d.id,d])));
const close=(actual,expected)=>assert.ok(Math.abs(actual-expected)<1e-7,`${actual} != ${expected}`);

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
