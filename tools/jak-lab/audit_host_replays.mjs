import assert from 'node:assert/strict';
import {readFile,writeFile} from 'node:fs/promises';
import {createRequire} from 'node:module';
import ts from 'typescript';

// Exercise each distinct source tracker timing through emission, linger and
// deactivation. This proves controller boundaries, not source visual fidelity.
const args=process.argv.slice(2);
const option=name=>args.includes(name)?args[args.indexOf(name)+1]:undefined;
assert.ok(option('--catalogue'),'--catalogue is required');
const catalogue=JSON.parse(await readFile(option('--catalogue'),'utf8'));
const source=await readFile(new URL('../../src/jak-lab/particleMotion.ts',import.meta.url),'utf8');
const js=ts.transpileModule(source,{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText;
const module={exports:{}};new Function('require','module','exports',js)(createRequire(import.meta.url),module,module.exports);
const {ParticleMotion}=module.exports;
const definitions=new Map(catalogue.particles.map(p=>[p.id,p]));
const groups=new Map(catalogue.groups.map(g=>[g.name,g]));
const unique=new Map();
for(const entry of catalogue.sourceInventory.partTrackerLaunches)if(entry.replay) {
  const r=entry.replay;unique.set(`${r.group}/${r.duration}/${r.linger}`,r);
}
assert.ok(unique.size,'No source replays found');
const rows=[];let frames=0,samples=0;
for(const replay of unique.values()) {
  const group=groups.get(replay.group);assert.ok(group);
  const motion=new ParticleMotion(group,definitions,12000,group.id+1,catalogue.callbackPrograms);
  motion.replay=replay;
  const count=Math.ceil(Math.max(0,replay.duration)/5)+Math.ceil(Math.max(0,replay.linger)/5)+2;
  let lastControlled=0,peak=0,emissionFrames=0;
  for(let i=0;i<count;i++) {
    const emitting=motion.clock<replay.duration;
    motion.update(1/60);frames++;if(emitting)emissionFrames++;
    peak=Math.max(peak,motion.particles.length);
    for(const particle of motion.particles) {
      samples++;
      if(particle.controlled) {
        if(!emitting)assert.ok(particle.id<=lastControlled,`${group.name}: continued controlled emission after stop`);
        lastControlled=Math.max(lastControlled,particle.id);
      }
      assert.ok([...particle.position.toArray(),...particle.orientation.toArray(),...Object.values(particle.values)]
        .every(Number.isFinite),`${group.name}: non-finite replay state`);
    }
  }
  assert.equal(motion.replayPhase,'finished',`${group.name}: source lifecycle did not finish`);
  assert.equal(motion.particles.filter(p=>p.controlled).length,0,`${group.name}: keyed particles survived cleanup`);
  rows.push({group:group.name,duration:replay.duration,linger:replay.linger,source:replay.source,
    frames:count,emissionFrames,peakParticles:peak,secondarySurvivors:motion.particles.length,
    capacityDrops:motion.dropped,sourceQueueDrops:motion.queueDrops,issues:[...motion.issues]});
}
const report={createdAt:new Date().toISOString(),replays:rows.length,groups:new Set(rows.map(r=>r.group)).size,
  frames,particleSamples:samples,nonfiniteStates:0,
  zeroEmission:rows.filter(r=>r.peakParticles===0).map(r=>r.group),
  capacityDrops:rows.filter(r=>r.capacityDrops>0).map(r=>({group:r.group,dropped:r.capacityDrops})),rows};
if(option('--output'))await writeFile(option('--output'),JSON.stringify(report,null,2)+'\n');
const {rows:_,...summary}=report;console.log(JSON.stringify(summary,null,2));
