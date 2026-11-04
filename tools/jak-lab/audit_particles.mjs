import assert from 'node:assert/strict';
import {readFile,writeFile} from 'node:fs/promises';
import {createRequire} from 'node:module';
import ts from 'typescript';

// Source-catalogue simulation audit. This does not claim visual fidelity, source
// global RNG equivalence, or reconstruct unknown host-object states.
const args=process.argv.slice(2);
const option=(name,fallback)=>args.includes(name)?args[args.indexOf(name)+1]:fallback;
const path=option('--catalogue');assert.ok(path,'--catalogue is required');
const seconds=Number(option('--seconds','3'));assert.ok(seconds>0&&seconds<=60);
const catalogue=JSON.parse(await readFile(path,'utf8'));
const source=await readFile(new URL('../../src/jak-lab/particleMotion.ts',import.meta.url),'utf8');
const js=ts.transpileModule(source,{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText;
const module={exports:{}};new Function('require','module','exports',js)(createRequire(import.meta.url),module,module.exports);
const {ParticleMotion}=module.exports;
const definitions=new Map(catalogue.particles.map(p=>[p.id,p]));
const direct=(catalogue.sourceInventory?.standaloneParticles??[]).flatMap(entry=>
  [...new Set(entry.launches.map(l=>l.is3d))].map(is3d=>({id:10000+entry.particle*2+Number(is3d),
    name:`direct-${entry.particle}${is3d?'-3d':''}`,source:entry.source,directLaunch:{particle:entry.particle},
    items:[{particle:entry.particle,flags:['launch-asap',...(is3d?['is-3d']:[])]}]})));
const rows=[],seen=new Set(),callbacks=new Set(),births=new Set();let samples=0;
for(const group of [...catalogue.groups,...direct]) {
  const motion=new ParticleMotion(group,definitions,12000,group.id+1,catalogue.callbackPrograms);
  let peak=0,sounds=0;const emitted=new Set();
  for(let frame=0;frame<Math.ceil(seconds*60);frame++) {
    if(group.directLaunch&&frame>0&&frame%60===0)motion.triggerDirect();
    motion.update(1/60);peak=Math.max(peak,motion.particles.length);sounds+=motion.soundEvents.length;
    for(const p of motion.particles) {
      samples++;emitted.add(p.texture);
      if(p.callback)callbacks.add(p.callback);if(p.birth)births.add(p.birth);
      assert.ok([...p.position.toArray(),...p.orientation.toArray(),...p.orbit.toArray(),p.radius,
        ...Object.values(p.values)].every(Number.isFinite),`${group.name}: particle ${p.id} has nonfinite state`);
      assert.ok(Math.abs(p.orientation.lengthSq()-1)<1e-5,`${group.name}: non-unit orientation`);
      assert.ok(motion.textureIds.has(p.texture)||p.texture==='',`${group.name}: unloaded callback texture ${p.texture}`);
    }
  }
  for(const id of motion.referencedParticleIds)seen.add(id);
  rows.push({id:group.id,name:group.name,peakParticles:peak,remaining:motion.particles.length,dropped:motion.dropped,sourceQueueDrops:motion.queueDrops,
    textureCount:emitted.size,soundEvents:sounds,hostInputs:[...motion.hostInputs],issues:[...motion.issues]});
}
const report={createdAt:new Date().toISOString(),secondsPerExhibit:seconds,groups:catalogue.groups.length,
  directExhibits:direct.length,particleSamples:samples,sourceDefinitions:definitions.size,
  reachedDefinitions:[...seen].filter(id=>definitions.has(id)).length,
  compiledContactCallbacks:Object.keys(catalogue.callbackPrograms??{}).length,
  observedUpdateCallbacks:[...callbacks].sort(),observedBirthCallbacks:[...births].sort(),
  zeroEmissionExhibits:rows.filter(r=>r.peakParticles===0).map(r=>r.name),
  capacityDropExhibits:rows.filter(r=>r.dropped>0).map(r=>({name:r.name,dropped:r.dropped})),
  nonfiniteStates:0,rows};
const output=option('--output');if(output)await writeFile(output,JSON.stringify(report,null,2)+'\n');
const {rows:_,...summary}=report;console.log(JSON.stringify(summary,null,2));
