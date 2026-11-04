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
const option=name=>process.argv[process.argv.indexOf(name)+1];
const catalogue=JSON.parse(await readFile(option('--catalogue'),'utf8'));
const oracle=JSON.parse(await readFile(option('--oracle'),'utf8'));
const {ParticleMotion}=await load('particleMotion'),{FirstPersonHud}=await load('firstPersonHud');
const {screenHudDefinitions,screenHudDefinition}=await load('screenHud');
const definition=catalogue.firstPersonHud,particles=new Map(catalogue.particles.map(p=>[p.id,p]));
const before=JSON.stringify(catalogue);
assert.deepEqual(definition.sources,oracle.sources);
const byCallback=new Map(catalogue.particles.flatMap(p=>p.fields.filter(f=>f.field==='func').map(f=>[f.value,p.id])));
const values=(actual,expected,label)=>{
  assert.deepEqual([actual['scale-x'],actual['scale-y']],[expected[0].w,expected[1].w],label+' scales');
  assert.deepEqual([actual.r,actual.g,actual.b,actual.a],['x','y','z','w'].map(k=>expected[2][k]),label+' rgba');
  assert.equal(actual['rot-z'],(Math.trunc(expected[1].z)<<16)>>16,label+' rotation');
};
let callbackSamples=0,frames=0,particleSamples=0;
for(const sample of oracle.samples) {
  const profile=definition.profiles.find(p=>p.id===sample.format),s=profile.scales;
  for(const [index,[name,expected]] of Object.entries(sample.results).entries()) {
    const group={id:1,name:'source callback fixture',source:definition.source,items:[{particle:byCallback.get(name),flags:['launch-asap']}]};
    const motion=new ParticleMotion(group,particles,100,1,catalogue.callbackPrograms);
    motion.host.firstPerson={offset:sample.offset,movie:sample.movie,xScale:s['sides-x-scale'],
      yScale:s['sides-y-scale'],xOffset:s['x-offset'],positions:profile.layers.map(l=>[...l.position])};
    motion.update(1/60);assert.equal(motion.particles.length,1);
    values(motion.particles[0].values,expected,`${name} ${sample.format} offset ${sample.offset}`);
    assert.deepEqual(motion.host.firstPerson.positions[index],sample.positions[index],name+' callback origin write');
    callbackSamples++;
  }
}
const make=(format,only)=>{
  const layers=definition.profiles[0].layers.flatMap((layer,sourceIndex)=>{
    if(only!==undefined&&sourceIndex!==only)return [];
    const group=catalogue.groups.find(group=>group.name===layer.group);assert.ok(group);
    return [{sourceIndex,origin:new Vector3(),motion:new ParticleMotion(group,particles,100,group.id+1,catalogue.callbackPrograms)}];
  });
  const hud=new FirstPersonHud(definition,layers);hud.select(format);hud.restart();return hud;
};
const snapshot=hud=>({phase:hud.phase,clock:hud.clock,offset:hud.offset,positions:structuredClone(hud.context.positions),
  layers:hud.layers.map(l=>({origin:l.origin.toArray(),particles:l.motion.particles.map(p=>({id:p.id,values:{...p.values},position:p.position.toArray()}))}))});
for(const timeline of oracle.timelines)for(const only of [undefined,0,1,2]) {
  const hud=make(timeline.format,only);let previousAction='';
  for(const sample of timeline.records) {
    hud.progressState=sample.progress;hud.movie=sample.movie;
    if(sample.action==='hide'&&previousAction!=='hide')hud.hide();
    previousAction=sample.action;hud.update(1/60);frames++;
    assert.equal(hud.phase,sample.phase,`${timeline.format} ${sample.action}: phase`);
    assert.equal(hud.offset,sample.offset,`${timeline.format} ${sample.action}: offset`);
    for(const {motion,origin,sourceIndex} of hud.layers) {
      assert.equal(motion.particles.length,Number(sample.active),'persistent layer count');
      assert.equal(motion.dropped,0);assert.deepEqual([...motion.issues],[]);
      if(!sample.active)continue;
      assert.deepEqual(origin.toArray(),sample.origins[sourceIndex],'source post/callback order');
      const particle=motion.particles[0];values(particle.values,sample.results[particle.callback],sample.action);
      assert.ok([...particle.position.toArray(),...Object.values(particle.values)].every(Number.isFinite));particleSamples++;
    }
  }
  hud.show();hud.update(.5);assert.equal(hud.phase,'in');assert.equal(hud.offset,0);
  hud.hide(true);assert.ok(hud.layers.every(l=>l.motion.particles.length===0));
  hud.movie=false;hud.progressState='absent';hud.restart();hud.update(.5);const first=snapshot(hud);
  hud.restart();hud.update(.5);assert.deepEqual(snapshot(hud),first,'restart must be deterministic');
}
for(const format of ['4:3','16:9']) {
  const a=make(format),b=make(format);
  for(let i=0;i<240;i++)a.update(1/120);for(let i=0;i<60;i++)b.update(1/30);
  assert.deepEqual(snapshot(a),snapshot(b),'render-rate-independent fixed source steps');
  a.hold=false;a.update(10);assert.equal(a.phase,'in','first-person HUD has no tally timeout');
  assert.ok(a.layers.every(l=>l.motion.particles.length===1));
}
const composite=screenHudDefinitions(catalogue).find(effect=>effect.screenHud==='first-person');assert.ok(composite);
assert.equal(screenHudDefinition(composite,catalogue),definition);
for(const layer of definition.profiles[0].layers)assert.equal(screenHudDefinition(catalogue.groups.find(g=>g.name===layer.group),catalogue),definition);
assert.equal(JSON.stringify(catalogue),before);
const result={status:'PASS',callbackSamples,frames,particleSamples,checks:[
  'independent original GOAL callback and host-state evaluation','both NTSC display profiles',
  'exact quarter/half thresholds, including source nonassigning branches','movie/setting-movie suppression',
  'source post-before-callback origin order','waiting/arrival/normal/departure/deactivation',
  'progress present/absent/going-out/gone','three bounded permanent layers and isolated layer identity',
  'source lifetime without a tally timeout','restart, cleanup, reactivation and frame-rate independence','immutable catalogue']};
if(process.argv.includes('--output'))await writeFile(option('--output'),JSON.stringify(result,null,2)+'\n');
console.log(JSON.stringify(result,null,2));
