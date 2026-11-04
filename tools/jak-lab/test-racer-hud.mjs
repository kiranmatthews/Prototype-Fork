import assert from 'node:assert/strict';
import {readFile,writeFile} from 'node:fs/promises';
import {createRequire} from 'node:module';
import ts from 'typescript';

const source=await readFile(new URL('../../src/jak-lab/particleMotion.ts',import.meta.url),'utf8');
const js=ts.transpileModule(source,{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText;
const module={exports:{}};new Function('require','module','exports',js)(createRequire(import.meta.url),module,module.exports);
const {ParticleMotion}=module.exports;
const numeric=(field,base)=>({field,op:'float',base});
const callbacks=['part-hud-racer-speed-func','part-hud-racer-heat-func',
  ...[1,2,3].map(n=>`part-hud-zoomer-heat-slice-0${n}-func`)];
const fixture=(index,angle=0)=>new ParticleMotion({id:1,name:'HUD fixture',source:{file:'fixture',line:1},items:[{particle:1,flags:['launch-asap']}]},
  new Map([[1,{id:1,source:{file:'fixture',line:1},fields:[numeric('num',1),numeric('timer',-1),numeric('rot-z',angle),
    numeric('r',128),numeric('g',128),numeric('b',128),numeric('a',128),{field:'func',op:'value',value:callbacks[index]}]}]]));
const step=motion=>{motion.update(1/60);return motion.particles[0].values;};
const near=(actual,expected)=>assert.ok(Math.abs(actual-expected)<.0001,`${actual} != ${expected}`);
// Independent landmarks in the source calibration, including endpoint clamps.
for(const [metres,angle] of [[-1,-22756],[0,-22756],[30,27488],[32,14927],[34,7281],[36,-546],[38,-6371],[40,-10922],[42,-15473],[60,-15473]]) {
  const motion=fixture(0);motion.host.racerSpeed=metres*4096;motion.host.racerHudOffset=10;
  assert.equal(step(motion)['rot-z'],angle,`speed ${metres}`);
  assert.equal(motion.issues.size,0);assert.ok(motion.hostInputs.has('racer speed'));
}
{
  const motion=fixture(0);motion.host.racerSpeed=40*4096;
  assert.equal(step(motion)['rot-z'],-2184,'faster decreasing-angle seek');
  motion.host.racerSpeed=30*4096;
  assert.equal(step(motion)['rot-z'],-1638,'slower increasing-angle seek');
  motion.host.racerHudOffset=9;assert.equal(step(motion)['rot-z'],-1092,'offset below ten still eases');
  motion.host.racerHudOffset=10;assert.equal(step(motion)['rot-z'],27488,'entering HUD sets the needle immediately');
  motion.reset();assert.equal(step(motion)['rot-z'],27488,'restart retains chosen inputs');
}
{
  const motion=fixture(0,-5280);motion.host.racerSpeed=30*4096;
  assert.equal(step(motion)['rot-z'],-4734,'exact half-turn follows native abs-overflow positive branch');
}
for(const [heat,angles] of [[0,[-8192,-24576,-24576,-24576]],[.5,[11377,-5006,-21390,-24576]],
  [.8,[23119,6735,-9648,-24576]],[1,[30947,14563,-1820,-18204]]]) {
  for(let index=1;index<callbacks.length;index++) {
    const motion=fixture(index);motion.host.racerHeat=heat;
    assert.equal(step(motion)['rot-z'],angles[index-1],`heat ${heat} / ${callbacks[index]}`);
    assert.equal(motion.issues.size,0);assert.ok(motion.hostInputs.has('racer heat'));
  }
}
{
  const dial=fixture(1),slice=fixture(2);dial.host.racerHeat=slice.host.racerHeat=.8;
  const threshold=step(dial);assert.deepEqual([threshold.r,threshold.g,threshold.b],[128,128,128],'dial flash starts strictly above 80%');
  let v=step(slice);assert.deepEqual([v.r,v.g,v.b],[128,0,0],'pie flash starts at 80%');
  slice.update(7/60);v=slice.particles[0].values;assert.deepEqual([v.r,v.g,v.b],[128,100,100],'eight-frame blink phase');
  slice.host.racerHeat=.5;v=step(slice);near(v.r,106.666664);assert.equal(v.g,128);assert.equal(v.b,0);
  slice.host.racerHeat=.6;v=step(slice);assert.deepEqual([v.r,v.g,v.b],[128,128,0]);
  slice.host.racerHeat=.7;v=step(slice);near(v.g,64);assert.equal(v.r,128);assert.equal(v.b,0);
  dial.host.racerHeat=1.2;v=step(dial);assert.equal(v['rot-z'],-26761,'overheat extrapolates beyond full heat');
}
const paced=hz=>{
  const motion=fixture(0);
  for(const speed of [0,40,15,35,42,0]) {
    motion.host.racerSpeed=speed*4096;
    for(let i=0;i<hz/10;i++)motion.update(1/hz);
  }
  return {clock:motion.clock,values:motion.particles[0].values};
};
assert.deepEqual(paced(30),paced(60));assert.deepEqual(paced(120),paced(60));

const args=process.argv.slice(2),option=name=>args.includes(name)?args[args.indexOf(name)+1]:undefined;
if(option('--catalogue')) {
  const catalogue=JSON.parse(await readFile(option('--catalogue'),'utf8')),definitions=new Map(catalogue.particles.map(p=>[p.id,p]));
  const rows=[];
  for(const id of [108,112,114])for(const heat of [0,.6,.8,1,1.2]) {
    const group=catalogue.groups.find(g=>g.id===id);assert.ok(group);
    const motion=new ParticleMotion(group,definitions,12000,id+1,catalogue.callbackPrograms);
    motion.host.racerSpeed=40*4096;motion.host.racerHeat=heat;
    const observed=new Set();
    for(let frame=0;frame<32;frame++) {
      motion.update(1/60);
      for(const p of motion.particles) {
        observed.add(p.callback);assert.ok(callbacks.includes(p.callback));
        assert.ok(Object.values(p.values).every(Number.isFinite));
      }
    }
    assert.equal(motion.particles.length,id===114?3:1);assert.equal(motion.dropped,0);
    assert.deepEqual([...motion.issues],['Screen-space host layout']);
    rows.push({group:id,heat,frames:32,callbacks:[...observed],particles:motion.particles.length,
      angles:motion.particles.map(p=>p.values['rot-z'])});
  }
  if(option('--output'))await writeFile(option('--output'),JSON.stringify({status:'PASS',rows},null,2)+'\n');
  console.log(`PASS ${rows.length} source HUD cases / ${rows.reduce((n,r)=>n+r.frames,0)} frames; source screen layout remains explicit`);
}
console.log('PASS nonlinear speed landmarks, signed seek/rate/half-turn/entry boundaries, heat angles/clamps/color/blink thresholds, overheat, restart and 30/60/120 Hz parity');
