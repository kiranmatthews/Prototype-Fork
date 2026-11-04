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
const {ParticleMotion}=await load('particleMotion');
const {ScreenHud,screenHudDefinitions,screenHudDefinition}=await load('screenHud');
const library=catalogue.screenHud,definitions=new Map(catalogue.particles.map(p=>[p.id,p]));
assert.deepEqual(library.sources,oracle.sources);
const immutable=JSON.stringify(catalogue);
const particleByCallback=new Map(catalogue.particles.flatMap(p=>p.fields.filter(f=>f.field==='func').map(f=>[f.value,p.id])));
let callbackSamples=0,frames=0,particleSamples=0;
for(const sample of oracle.samples) {
  const entry=library.entries.find(entry=>entry.id===sample.kind),profile=entry.profiles.find(p=>p.id===sample.format),s=profile.scales;
  for(const [callback,result] of Object.entries(sample.results)) {
    const id=particleByCallback.get(callback);assert.ok(id);
    const group={id:1,name:'source callback fixture',source:entry.source,flags:['screen-space'],items:[{particle:id,flags:['launch-asap']}]};
    const motion=new ParticleMotion(group,definitions,100,1,catalogue.callbackPrograms);
    motion.host.hud={health:sample.health,frame:sample.frame,healthScale:s.scale??0,buzzerScale:s.scale??0,
      ecoFraction:Math.fround(Math.fround(sample.ticks)/Math.fround(library.ecoFullTicks)),ecoType:sample.color,
      ecoScale:s['scale-blue']??0,ecoBackingScale:s['scale-backing']??0,ecoTimerScale:s['scale-timer']??0};
    motion.update(1/60);const values=motion.particles[0].values;
    assert.deepEqual([values['scale-x'],values['scale-y']],[result[0].w,result[1].w],`${callback}: scale`);
    assert.deepEqual([values.r,values.g,values.b,values.a],['x','y','z','w'].map(k=>result[2][k]),`${callback}: colour/alpha`);
    assert.equal(values['rot-z'],(Math.trunc(result[1].z)<<16)>>16,`${callback}: source rotation and native quantization`);
    callbackSamples++;
  }
}
const make=(kind,only)=>{
  const entry=library.entries.find(entry=>entry.id===kind);
  const layers=entry.profiles[0].layers.flatMap((layer,sourceIndex)=>{
    if(only!==undefined&&only!==sourceIndex)return [];
    const group=catalogue.groups.find(group=>group.name===layer.group);
    return [{sourceIndex,origin:new Vector3(),motion:new ParticleMotion(group,definitions,1000,group.id+1,catalogue.callbackPrograms)}];
  });
  return new ScreenHud(entry,library.ecoFullTicks,layers);
};
const count=hud=>hud.layers.reduce((n,l)=>n+l.motion.particles.length,0);
const snapshot=hud=>({clock:hud.clock,offset:hud.offset,phase:hud.phase,remaining:hud.remaining,
  layers:hud.layers.map(l=>({origin:l.origin.toArray(),particles:l.motion.particles.map(p=>({id:p.id,values:{...p.values},position:p.position.toArray()}))}))});
for(const kind of ['health','power','buzzers'])for(const format of ['4:3','16:9']) {
  const hud=make(kind);hud.select(format);hud.restart();
  let ids;
  for(let frame=0;frame<600;frame++) {
    hud.update(1/60);frames++;
    assert.equal(hud.offset,Math.max(0,128-15*(frame+1)));
    for(const layer of hud.layers) {
      const position=hud.profile.layers[layer.sourceIndex].position;
      assert.deepEqual(layer.origin.toArray(),[-256+hud.definition.xSign*hud.offset+position[0],
        Math.fround(.5*(position[1]+hud.definition.ySign*hud.offset-224)),position[2]]);
      assert.equal(layer.motion.clock,hud.clock);assert.equal(layer.motion.dropped,0);assert.deepEqual([...layer.motion.issues],[]);
      for(const p of layer.motion.particles) {
        assert.ok([...p.position.toArray(),...Object.values(p.values)].every(Number.isFinite));particleSamples++;
      }
    }
    if(frame>1) {
      assert.equal(count(hud),kind==='health'?3:kind==='power'?5:2);
      const next=hud.layers.map(l=>l.motion.particles.map(p=>p.id));
      if(ids)assert.deepEqual(next,ids,'permanent layers duplicated');ids=next;
    }
  }
  hud.hold=false;
  for(let i=1;i<=120;i++){hud.update(1/60);frames++;assert.equal(hud.phase,i===120?'leaving':'in');}
  for(let i=1;i<=26;i++){hud.update(1/60);frames++;assert.equal(hud.offset,Math.min(128,i*5));}
  assert.equal(count(hud),0);assert.equal(hud.phase,'hidden');
  hud.show();hud.hold=true;hud.update(.25);assert.equal(hud.phase,'in');assert.ok(count(hud)>0);
  hud.hide();for(let i=1;i<=13;i++){hud.update(1/60);frames++;assert.equal(hud.offset,Math.min(128,10*i));}
  assert.equal(count(hud),0);assert.equal(hud.phase,'hidden');
  hud.show();hud.update(.25);hud.hide(true);hud.update(1/60);assert.equal(count(hud),0);
  hud.hold=true;hud.restart();hud.update(.5);const first=snapshot(hud);hud.restart();hud.update(.5);assert.deepEqual(snapshot(hud),first);
  const a=make(kind),b=make(kind);a.restart();b.restart();
  for(let i=0;i<120;i++)a.update(1/120);for(let i=0;i<30;i++)b.update(1/30);assert.deepEqual(snapshot(a),snapshot(b));
  for(let layer=0;layer<hud.layers.length;layer++) {
    const alone=make(kind,layer);alone.select(format);alone.restart();alone.update(.5);
    assert.deepEqual(snapshot(alone).layers[0],snapshot(hud).layers[layer],'isolated layer lost source placement/state');
  }
}
{
  const hud=make('health');hud.health=1;hud.update(7/60);
  const first=hud.layers[0].motion.particles[0],rgb=[first.values.r,first.values.g,first.values.b];
  assert.ok(rgb[0]>250);hud.health=0;hud.update(1/60);
  assert.equal(first.values.a,32);assert.deepEqual([first.values.r,first.values.g,first.values.b],rgb,'dead health should retain the previous RGB');
  hud.hide(true);hud.update(1/60);hud.health=.5;hud.update(1/60);assert.equal(hud.phase,'hidden','fractional health with the same tally must not show the HUD');
  hud.health=null;hud.update(1/60);assert.equal(hud.phase,'hidden','no target must not run the source tally');
  hud.health=2;hud.update(1/60);assert.equal(hud.phase,'arriving','new health should show the hidden HUD');
}
{
  const hud=make('power');hud.restart();hud.hold=false;hud.drain=true;
  for(let i=0;i<1200;i++) {hud.update(1/60);frames++;assert.notEqual(hud.phase,'hidden','changing source value should keep the meter visible');}
  assert.equal(hud.remaining,0);assert.equal(hud.fraction,0);assert.equal(hud.phase,'in');
  for(let i=1;i<=120;i++){hud.update(1/60);frames++;assert.equal(hud.phase,i===120?'leaving':'in');}
  hud.update(26/60);assert.equal(hud.phase,'hidden');assert.equal(count(hud),0);
  hud.setCharge(.1);hud.update(1/60);assert.equal(hud.phase,'arriving');
  hud.hide();assert.equal(hud.drain,false,'manual inspection hide must not immediately retrigger depletion');
  const remaining=hud.remaining;hud.update(.5);assert.equal(hud.remaining,remaining);assert.equal(hud.phase,'hidden');
  hud.charge=1.2;hud.restart();hud.update(.2);assert.ok(hud.fraction>1,'source overcharge branches must remain inspectable');
}
const additions=screenHudDefinitions(catalogue);assert.equal(additions.length,2);
for(const effect of additions)assert.ok(screenHudDefinition(effect,catalogue));
assert.equal(JSON.stringify(catalogue),immutable);
const result={status:'PASS',callbackSamples,frames,particleSamples,checks:[
  'independent GOAL callback parity','both original NTSC aspect profiles','all health thresholds and low-health flash',
  'all eco colours, slice thresholds, low-eco flash and overcharge','source per-layer origin/depth',
  'bounded persistent layers and scout-fly orbit','entry/timeout/both departures','hidden cleanup and reactivation',
  'twenty-second eco drain keeps the meter visible until it stops changing','isolated and assembled layer identity',
  'repeatable restart and frame-rate independence','immutable catalogue']};
if(process.argv.includes('--output'))await writeFile(option('--output'),JSON.stringify(result,null,2)+'\n');
console.log(JSON.stringify(result,null,2));
