import assert from 'node:assert/strict';
import {readFile,writeFile} from 'node:fs/promises';
import {createRequire} from 'node:module';
import {Vector3} from 'three';
import ts from 'typescript';

async function load(name) {
  const source=await readFile(new URL(`../../src/jak-lab/${name}.ts`,import.meta.url),'utf8');
  const js=ts.transpileModule(source,{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText;
  const module={exports:{}};new Function('require','module','exports',js)(createRequire(import.meta.url),module,module.exports);return module.exports;
}
const {ParticleMotion}=await load('particleMotion');
const {SunParticles,sampleSunOrbit,sampleSunColor,sunHourVisible}=await load('sunParticles');
const option=name=>process.argv.includes(name)?process.argv[process.argv.indexOf(name)+1]:undefined;
const catalogue=JSON.parse(await readFile(option('--catalogue'),'utf8'));
const oracle=JSON.parse(await readFile(option('--oracle'),'utf8'));
const definitions=new Map(catalogue.particles.map(p=>[p.id,p]));
const motionFor=id=>new ParticleMotion(catalogue.groups.find(g=>g.id===id),definitions,100,1,catalogue.callbackPrograms);
const sky=catalogue.sunParticles,library=catalogue.particleLighting;
assert.deepEqual(sky.sources,oracle.sources,'oracle must match the exact catalogued source');
for(const sample of oracle.samples)assert.deepEqual(
  sampleSunOrbit(sky.orbits.find(o=>o.slot===sample.slot),sample.hour).toArray(),sample.position,
  `GOAL AST orbit mismatch at ${sample.slot}:${sample.hour}`);

for(const [id,hours] of [[35,[[6.2499,false],[6.25,true],[18.7499,true],[18.75,false]]],
  [36,[[10.25,true],[10.2501,false],[21.7499,false],[21.75,true]]]]) {
  const host=sky.hosts.find(h=>h.group===(id===35?'group-sun':'group-green-sun'));
  for(const [hour,expected] of hours)assert.equal(sunHourVisible(host.hours,hour),expected,`${id}:${hour} boundary`);
}

// A deliberately different particle palette and quick selector catches the
// tempting but incorrect reuse of particle RGB/snapshot for the sun.
{
  const source={file:'fixture',line:1},context={sun:'sun',skyPalette:'sky',palette:'light'};
  const hours=(a,b)=>Array.from({length:24},()=>({snapshot1:a,snapshot2:b,'morph-start':0,'morph-end':1}));
  const fixture={sunTables:[{id:'sun',snapshots:[{color:[200,80,20,128]},{color:[20,160,40,128]}]}],
    palettes:[{id:'light',hours:hours(0,0)},{id:'sky',hours:hours(0,1)}]};
  const cycle={context,selection:{kind:'cycle',snapshot:null,source}};
  assert.deepEqual(sampleSunColor(fixture,cycle,.5),[110,120,30,128]);
  assert.deepEqual(sampleSunColor(fixture,cycle,24.5),sampleSunColor(fixture,cycle,.5));
  assert.deepEqual(sampleSunColor(fixture,cycle,-.5),sampleSunColor(fixture,cycle,23.5));
  assert.throws(()=>sampleSunColor(fixture,cycle,NaN),/finite/);
  assert.deepEqual(sampleSunColor(fixture,{context,selection:{kind:'snapshot',snapshot:1}},12),[20,160,40,128]);
}

const results=[];let frames=0,samples=0;
const immutable=JSON.stringify({sky,library,particles:catalogue.particles});
for(const id of [35,36]) {
  const motion=motionFor(id),sun=new SunParticles(motion,sky,library),expectedCount=id===35?3:2;
  motion.host.particleColor.set(0,0,0); // callback replaces lit RGB every frame
  const camera=new Vector3(900000,-20000,450000);motion.host.camera.copy(camera);
  motion.update(1/60);
  assert.equal(motion.particles.length,expectedCount,'green core dies at zero alpha; flares persist');
  const ids=motion.particles.map(p=>p.id);
  assert.equal(motion.issues.size,0);
  const check=()=>{
    for(const p of motion.particles) {
      const part=p.values.userdata,slot=Math.trunc(part/4);
      const expected=camera.clone().addScaledVector(motion.host.suns[slot],4096).toArray().map(Math.fround);
      assert.deepEqual(p.position.toArray(),expected,'callback follows the source camera and orbit');
      assert.equal(p.values.a,Math.fround(128*sun.fade));
      assert.deepEqual(['r','g','b'].map(k=>p.values[k]),id===35?
        motion.host.sunColor.toArray().map(v=>Math.fround(v/(part===0?1:4))):[0,64,0]);
      assert.equal(p.values.timer,-1);
      assert.ok([...p.position.toArray(),...Object.values(p.values)].every(Number.isFinite));samples++;
    }
  };
  check();
  for(let i=0;i<600;i++){motion.update(1/60);check();frames++;}
  assert.deepEqual(motion.particles.map(p=>p.id),ids,'persistent suns must not be re-emitted each frame');
  const flares=motion.particles.filter(p=>p.values.userdata%4!==0);
  assert.equal(flares.length,2);
  assert.ok(flares[0].values['rot-z']*flares[1].values['rot-z']<0,'flare layers rotate in opposite directions');
  sun.fade=.25;motion.update(1/60);check();
  sun.fade=0;motion.update(1/60);assert.equal(motion.particles.length,0,'fade zero kills the keyed group');
  sun.fade=1;motion.update(1/60);assert.equal(motion.particles.length,expectedCount,'host reactivates once');check();
  motion.hour=id===35?0:12;motion.update(1/60);assert.equal(motion.particles.length,0,'host kills outside visibility window');
  motion.hour=id===35?12.5:4;motion.update(1/60);assert.equal(motion.particles.length,expectedCount);
  const capture=()=>motion.particles.map(p=>({id:p.id,position:p.position.toArray(),values:{...p.values}}));
  motion.reset();motion.update(.5);const replay=capture();motion.reset();motion.update(.5);assert.deepEqual(capture(),replay,'restart is deterministic');
  for(const preset of sun.presets) {
    sun.select(preset.id);sun.fade=1; // inspect every actual colour selector, independent of area occlusion
    for(let hour=0;hour<24;hour+=.25) {
      motion.hour=hour;motion.update(1/60);frames++;
      assert.equal(motion.particles.length,sun.active?expectedCount:0);check();
    }
  }
  assert.equal(motion.dropped,0);assert.equal(motion.issues.size,0);
  assert.equal(sun.presets.find(p=>p.context.id==='finalboss2').selection.snapshot,3,'sun quick snapshot differs from particle snapshot 5');
  results.push({group:id,layers:expectedCount,presets:sun.presets.length,radius:sun.radius});
}
assert.equal(JSON.stringify({sky,library,particles:catalogue.particles}),immutable,'runtime must not mutate extracted source data');
const report={status:'PASS',oracleSamples:oracle.samples.length,frames,particleSamples:samples,groups:results,
  checks:['source AST orbit parity','strict/inclusive hour boundaries','camera-relative callback','zero-alpha green core',
    'single persistent emission','opposing source rotations','fade and host cleanup/reactivation','all sun palettes',
    'separate sky interpolation/quick selector','deterministic restart','immutable source data']};
if(option('--output'))await writeFile(option('--output'),JSON.stringify(report,null,2)+'\n');
console.log(JSON.stringify(report,null,2));
