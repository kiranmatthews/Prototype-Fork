import assert from 'node:assert/strict';
import { writeFile } from 'node:fs/promises';
import { pathToFileURL } from 'node:url';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { withBlockworksRuntime } from './blockworks-runner.mjs';
import { runPuzzleJourney } from './puzzle-trilogy-pilot.mjs';
export { runPuzzleJourney } from './puzzle-trilogy-pilot.mjs';

const MODULE = '/src/levels/puzzle-trilogy.ts';
const IDS = ['crate-primer', 'switchyard', 'clockwork-gauntlet'];
export function sourceEntry(module,id) {
  const entry=module.PUZZLE_LEVELS.find(entry=>entry.id===id);
  if(!entry)throw Error(`Missing source entry ${id}`);
  return entry;
}
export async function withPuzzleRuntime(id,run,options={}) {
  return withBlockworksRuntime(r=>run(Object.assign(r,{id})),{modulePath:MODULE,levelId:id,
    controlFrame:()=>({x:0,z:-1}),
    source:module=>sourceEntry(module,id).data,
    ...options});
}
export function runInputPilot(r,pilot) {
  r.report={stage:'start',evidence:[],actions:[]};
  const generator=pilot(r);let next=generator.next();
  while(!next.done){r.tick(next.value);next=generator.next();}
  const result={...next.value,gemEarned:r.p.gemEarned};
  r.report.result=result;
  return {...r.report,...result,frames:r.frame,seconds:r.frame*r.dt};
}

export async function runTrilogyChecks({journey=true}={}) {
  const reports=[];
  for(const id of IDS) {
    await withPuzzleRuntime(id,r=>{
      r.stepFor(20);
      assert.ok(r.p.grounded&&!r.p.isBailing,`${id} spawn is unsupported`);
      assert.ok(Math.abs(r.p.pos.z)<.1,`${id} spawn left its side-scrolling line`);
      assert.equal(r.l.cameraViews.length,0,`${id} must use the shared normal side-scroll POV`);
      const probe=new r.THREE.Raycaster(),down=new r.THREE.Vector3(0,-1,0);let probes=0;
      for(let frame=0;frame<600;frame++) {
        r.l.update(r.dt);
        if(frame%15)continue;
        for(const enemy of r.l.enemies) {
          if(['hopper','floater'].includes(enemy.kind))continue;
          probe.set(enemy.group.position.clone().setY(enemy.baseY+2),down);probe.far=4;
          const hit=probe.intersectObjects(r.l.groundMeshes,false)[0];
          assert.ok(hit&&Math.abs(hit.point.y-enemy.baseY)<.1,`${id} ${enemy.kind} patrol is unsupported`);probes++;
          assert.ok(Math.abs(enemy.group.position.z)<.5,`${id} patrol leaves the containment line`);
        }
      }
      reports.push({id,test:'supported source spawn and complete enemy cycles',probes,spawn:r.p.pos.toArray()});
    });
    if(journey) reports.push(await withPuzzleRuntime(id,async r=>{
      try{return runInputPilot(r,runPuzzleJourney);}
      catch(error){await writeFile(join(tmpdir(),`${id}-journey-failure.json`),JSON.stringify({error:error.message,report:r.report,trace:r.trace},null,2));throw error;}
    },{maxFrames:40000}));
  }
  await writeFile(join(tmpdir(),'puzzle-trilogy-physics.json'),JSON.stringify(reports,null,2));
  console.log(JSON.stringify(reports.map(({id,test,frames,seconds,probes,cratesBroken,totalCrates,activeStageCrates,bonusCrateTotal,completionScope,gemEarned,deaths,state})=>
    ({id,test,frames,seconds,probes,cratesBroken,totalCrates,activeStageCrates,bonusCrateTotal,completionScope,gemEarned,deaths,state})),null,2));
  console.log(`PASS trilogy source spawns and supported enemy cycles${journey?' with continuous input-only main-route clears; linked bonus crates remain uncollected':''}`);
  return reports;
}

if(process.argv[1]&&import.meta.url===pathToFileURL(process.argv[1]).href)
  await runTrilogyChecks({journey:!process.argv.includes('--mechanics-only')});
