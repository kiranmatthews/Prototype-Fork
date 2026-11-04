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
const {ParticleMotion}=await load('particleMotion'),{ParticleLighting}=await load('particleLighting');
const option=name=>process.argv.includes(name)?process.argv[process.argv.indexOf(name)+1]:undefined;
const numeric=(field,base)=>({field,op:'float',base}),flags=(...value)=>({field:'flags',op:'value',value});
const source={file:'fixture.gc',line:1};
const definition=(id,fields)=>({id,source,fields});
const first=extra=>definition(1,[numeric('num',1),numeric('timer',300),numeric('r',300),numeric('g',100),numeric('b',80),
  numeric('a',90),numeric('fade-r',2),numeric('fade-g',4),numeric('fade-b',6),numeric('fade-a',1),...extra]);
const group={id:1,name:'fixture',source,items:[]};
const motion=(defs)=>new ParticleMotion(group,new Map(defs.map(d=>[d.id,d])));
const emit=m=>{m.emitSource(1,new Vector3(),false);return m.particles[0];};
const rgb=p=>['r','g','b','fade-r','fade-g','fade-b','a','fade-a'].map(k=>p.values[k]);
const close=(a,b)=>assert.ok(Math.abs(a-b)<1e-6,`${a} != ${b}`);
const vectorClose=(a,b)=>a.forEach((v,i)=>close(v,b[i]));
{
  const m=motion([first([flags('bit12')])]);m.host.particleColor.set(.5,2,.25);
  const p=emit(m);assert.deepEqual(rgb(p),[127.5,200,20,1,8,1.5,90,1]);
  m.host.particleColor.set(4,3,2);m.update(1/60);
  assert.deepEqual(rgb(p),[132.5,240,27.5,1,8,1.5,95,1],'live colour is not re-lit every step');
  const unlit=motion([first([flags()])]);unlit.host.particleColor.set(0,0,0);
  assert.deepEqual(rgb(emit(unlit)),[255,100,80,2,4,6,90,1],'unflagged RGB is clamped but not lit');
  const aux=motion([first([flags('bit12','aux-list')])]);aux.host.particleColor.set(0,0,0);
  assert.deepEqual(rgb(emit(aux)),[300,100,80,2,4,6,0,0],'distortion radii and their changes must not be tinted or clamped');
}
for(const is3d of [false,true]) {
  const m=motion([first([flags('bit12'),numeric('next-time',5),numeric('next-launcher',2)]),
    definition(2,[numeric('b',120),numeric('fade-r',8),numeric('fade-a',-2),flags()])]);
  m.host.particleColor.set(.5,2,.25);m.emitSource(1,new Vector3(),is3d);const p=m.particles[0];
  m.host.particleColor.set(2,.5,3);m.update(1/60);
  assert.deepEqual(rgb(p),[207.5,240,367.5,16,8,1.5,80,-2],
    'partial relaunch preserves existing lit fields and lights only replacements, using OLD flags');
}
{
  const m=motion([first([flags('bit12'),numeric('next-time',5),numeric('next-launcher',2)]),
    definition(2,[{field:'g',op:'copy',value:'r'},numeric('b',99999),{field:'fade-r',op:'copy',value:'g'}])]);
  m.host.particleColor.set(.5,2,.25);const p=emit(m);m.update(1/60);
  assert.deepEqual(rgb(p),[132.5,240,27.5,1,8,1.5,95,1],
    'copying an unchanged sentinel restores the destination live field, exactly as the source');
}
{
  const m=motion([first([flags(),numeric('next-time',5),numeric('next-launcher',2)]),
    definition(2,[flags('bit12'),numeric('r',40)])]);m.host.particleColor.set(.5,.5,.5);
  const p=emit(m);m.update(1/60);assert.deepEqual(rgb(p),[50,120,110,2,4,6,95,1],
    'adding bit12 at relaunch does not retroactively light fields when the old flag was absent');
}
{
  // A birth callback copies already lit parent colours before the child's own
  // lighting pass. This catches moving the tint into field assignment.
  const parent=first([flags('bit12')]);
  const child=definition(2,[numeric('num',1),numeric('timer',300),numeric('a',90),flags('bit12'),
    {field:'birth-func',op:'value',value:'birth-func-copy-rot-color'}]);
  const m=new ParticleMotion({...group,items:[{particle:1,flags:['launch-asap'],binding:2},{particle:2,flags:['start-dead','launch-asap']}]},new Map([[1,parent],[2,child]]));
  m.host.particleColor.set(.5,2,.25);m.update(2/60);
  vectorClose(['r','g','b'].map(k=>m.particles[1].values[k]),[66.25,480,6.875]);
}

// Explicit RGB takes precedence over light-derived fallback, including when
// just one channel is nonzero. Derive fallback after interpolation, not before.
const snapshot=(particle,ambient=[.4,.8,1,1],light=[2,1,0,1])=>({source,particle,ambient,light});
const makeLibrary=(a,b)=>({sources:[],lightTables:[{id:'l',source,snapshots:[a,b]}],
  palettes:[{id:'p',source,hours:Array.from({length:24},()=>({snapshot1:0,snapshot2:1,'morph-start':0,'morph-end':1}))}],
  contexts:[{id:'default',source,levels:[],lights:'l',palette:'p',presets:[{kind:'cycle',snapshot:null,source,function:'fixture'}]}]});
{
  const light=new ParticleLighting(makeLibrary(snapshot([0,0,0,1]),snapshot([0,.5,0,1])),'engine/fixture.gc');
  vectorClose(light.sample(0),[.8,.85,.75]);vectorClose(light.sample(.5),[0,.25,0]);
  vectorClose(light.sample(24),light.sample(0));vectorClose(light.sample(-.5),light.sample(23.5));
  assert.throws(()=>light.sample(NaN),/finite/);assert.throws(()=>light.select('missing'),/Unknown/);
}
let catalogueEvidence;
if(option('--catalogue')) {
  const catalogue=JSON.parse(await readFile(option('--catalogue'),'utf8'));
  const library=catalogue.particleLighting;assert.ok(library,'catalogue must include extracted source lighting');
  const frozen=JSON.stringify(library),light=new ParticleLighting(library,'levels/beach/beach-part.gc');
  assert.equal(light.selected.id,'beach:cycle');
  vectorClose(light.sample(12),[.6825,.671,.67825]);vectorClose(light.sample(0),[.308175,.4114875,.7335]);
  const samples=[];
  for(const preset of light.presets) {
    light.select(preset.id);
    for(let hour=0;hour<24;hour+=.25) {
      const color=light.sample(hour);assert.ok(color.every(v=>Number.isFinite(v)&&v>=0));
      if(preset.selection.kind==='snapshot')assert.deepEqual(color,light.sample(0));
      samples.push({preset:preset.id,hour,color});
    }
  }
  const sourceGroups=[];
  for(const id of [9,132,160,514])for(const hour of [0,12,18.5]) {
    const effect=catalogue.groups.find(g=>g.id===id);assert.ok(effect);
    const definitions=new Map(catalogue.particles.map(p=>[p.id,p]));
    const neutral=new ParticleMotion(effect,definitions,12000,123,catalogue.callbackPrograms);
    const lit=new ParticleMotion(effect,definitions,12000,123,catalogue.callbackPrograms);
    const lighting=new ParticleLighting(library,effect.source.file);
    neutral.hour=lit.hour=hour;lit.host.particleColor.fromArray(lighting.sample(hour));
    let observed=0,different=0;
    for(let step=0;step<120;step++) {
      neutral.update(1/60);lit.update(1/60);
      assert.equal(lit.particles.length,neutral.particles.length,`${effect.name}: lighting changed particle lifetime`);
      lit.particles.forEach((particle,i)=>{
        const control=neutral.particles[i];observed++;
        assert.deepEqual(particle.position.toArray(),control.position.toArray(),'lighting changed source travel');
        assert.deepEqual(particle.orientation.toArray(),control.orientation.toArray(),'lighting changed source rotation');
        assert.equal(particle.values.a,control.values.a,'lighting changed source alpha');
        assert.ok(Object.values(particle.values).every(Number.isFinite));
        if(['r','g','b'].some(k=>particle.values[k]!==control.values[k]))different++;
      });
    }
    assert.ok(observed>0,`${effect.name}: no observed particles`);
    assert.ok(different>0,`${effect.name}: source lighting had no effect`);
    assert.equal(lit.dropped,0);assert.equal(lit.auxiliaryDrops,0);
    sourceGroups.push({id,name:effect.name,hour,preset:lighting.selected.id,observed,different});
  }
  assert.equal(JSON.stringify(library),frozen,'source lighting tables must remain immutable');
  catalogueEvidence={contexts:library.contexts.length,lightTables:library.lightTables.length,palettes:library.palettes.length,
    presets:light.presets.length,samples:samples.length,noon:[.6825,.671,.67825],midnight:[.308175,.4114875,.7335],sourceGroups};
}
const report={status:'PASS',checks:['birth clamp/lighting order','partial relaunch and source sentinel copies','previous flags',
  'alpha and auxiliary exclusions','no repeated live tint','birth callback ordering','palette fallback/precedence','hour wrap'],catalogue:catalogueEvidence};
if(option('--output'))await writeFile(option('--output'),JSON.stringify(report,null,2)+'\n');
console.log(JSON.stringify(report,null,2));
