import assert from 'node:assert/strict';
import {build} from 'esbuild';
import {mkdir, writeFile} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import {withSkateRuntime, makeInput} from './jungle-cup-harness.mjs';
import {airCargoPilot, airCargoObservation} from './carlisle-air-cargo-pilot.mjs';

const bundle = await build({entryPoints:['src/levels/carlisle-tidal-relay.ts'],bundle:true,format:'esm',write:false});
const api = await import('data:text/javascript;base64,' + Buffer.from(bundle.outputFiles[0].text).toString('base64'));
const data = api.CARLISLE_TIDAL_RELAY_LEVEL, encounters = api.CARLISLE_RELAY_AIR_CARGO;
const out = process.env.AIR_CARGO_OUT ?? '/private/tmp/carlisle-air-cargo-low', report = { flights: [], errors: [] };
await mkdir(out,{recursive:true});
const original = data.components.filter(c => !c.nm?.startsWith('Air cargo · '));
assert.equal(createHash('sha256').update(JSON.stringify({components:original,spawn:data.spawn,killY:data.killY})).digest('hex'),
  '326e69f1bb2f7beae44baccfd273223ea1ee31221a725e5aefb4bb3e303fb421', 'only the requested air cargo may extend the course');
assert.equal(encounters.length,7);assert.equal(encounters.filter(e=>e.nitro).length,4);
assert.equal(data.components.filter(c=>c.kind==='nitrobang').length,1);

try {
 await withSkateRuntime(async({level, player:p, CONST, THREE}) => {
  p.competitionMode=false;p.endlessDeaths=true;
  const authored = data.components.filter(c=>c.t==='crate');
  const live = c => level.crates[authored.indexOf(c)];
  let contacts=[];
  const snap=p.snapFeetToCrateLid.bind(p);
  p.snapFeetToCrateLid=c=>{contacts.push(authored[level.crates.indexOf(c)]?.nm);return snap(c);};
  const tick = values => { const input=makeInput(values);p.rawInput=input;p.step(CONST.fixedStep,input,level);level.update(CONST.fixedStep);input.consumeEdges(); };
  for (const held of (process.env.AIR_CARGO_HELD ? [process.env.AIR_CARGO_HELD==='true'] : [false,true])) for (const encounter of encounters.filter(e=>!process.env.AIR_CARGO_CASE||e.name===process.env.AIR_CARGO_CASE)) for (const avoid of (held ? [false,true] : [false])) {
   const phase=held?0:2.3;contacts=[];
   p.respawn(level,true);level.time=phase;level.update(0);
   const jump=api.CARLISLE_RELAY_JUMPS.find(j=>j.name===encounter.jump);
   const component=data.components.find(c=>c.nm===jump.name&&(c.t==='trampoline'||c.t==='mover'));
   const machine=jump.moving?level.movers.find(m=>m.mesh.name===jump.name):null;
   const start=machine?machine.mesh.position.clone().add(new THREE.Vector3(0,component.s[1]/2+.15,0)):new THREE.Vector3(...component.p).add(new THREE.Vector3(0,.15,0));
   p.respawn(level,true,false,{position:start,heading:new THREE.Vector3(0,0,-1)});p.totalDeaths=0;p.freeSkate=false;p.speed=0;p.masks=0;
   const target=api.carlislePoint(...jump.to), pilot=airCargoPilot(encounter,target,{avoid,held}), samples=[];
   const crates=authored.filter(c=>c.nm?.startsWith(encounter.prefix+' · ')), rewards=crates.filter(c=>c.kind==='wood').map(live);
   let launched=false, landed=false, launch=0,frame=0;
   for (;frame<700;frame++) {
    const values=pilot(airCargoObservation(p)),before=p.vVel;tick(values);
    if(!launched&&p.trampolineAir&&p.vVel>15){launched=true;launch=frame;}
    if(frame%6===0)samples.push({frame,...airCargoObservation(p),input:values,state:p.state});
    if(launched&&frame>launch+8&&((before<0&&p.vVel>15)||p.grounded)){landed=true;break;}
    if(p.totalDeaths||p.state==='dead'||p.isBailing)break;
   }
   const distance=p.pos.distanceTo(new THREE.Vector3(...target));
   const row={name:encounter.name,phase,held,avoid,stomped:encounter.landings.map(l=>l.names.some(n=>contacts.includes(n))),launched,landed,distance,broken:rewards.filter(c=>!c.alive).length,
     deaths:p.totalDeaths,state:p.state,bail:p.isBailing,seconds:frame/60,at:p.pos.toArray(),samples};
   report.flights.push(row);console.log(JSON.stringify({...row,samples:undefined}));
  }
  // Deliberately land on an actual lowered explosive row: it is still live.
  const encounter=encounters.find(e=>e.name==='Storm crosswind row');
  const nitro=live(authored.find(c=>c.nm===encounter.prefix+' · nitro 1.3'));
  p.respawn(level,true,false,{position:nitro.mesh.position.clone().add(new THREE.Vector3(0,3,0)),heading:new THREE.Vector3(0,0,-1)});
  p.totalDeaths=0;p.freeSkate=false;p.speed=0;p.masks=0;
  for(let f=0;f<100&&!p.totalDeaths&&p.state!=='dead';f++)tick({});
  report.directNitro={state:p.state,deaths:p.totalDeaths};assert.ok(p.totalDeaths||p.state==='dead','the lowered row must be a live hazard');
  p.respawn(level,true);const clear=level.crates.find(c=>c.nitroBang);level.breakCrate(clear);
  report.clearSwitch={nitros:level.crates.filter(c=>c.nitro).length,remaining:level.crates.filter(c=>c.nitro&&c.alive).length};
  assert.equal(report.clearSwitch.remaining,0,'finish switch must clear all airborne nitro');
  assert.ok(report.flights.every(r=>r.landed&&r.distance<15&&!r.deaths&&!r.bail),'a collect/bypass route failed to land safely');
  assert.ok(report.flights.filter(r=>!r.avoid).every(r=>r.stomped.every(Boolean)),'a crate chain was not completed by native top-face stomps');
  assert.ok(report.flights.filter(r=>r.avoid).every(r=>r.stomped.some(v=>!v)),'direct catch route required the complete chain');
  report.passed=true;
 },{levelEntry:{id:'carlisle-coast',name:data.name,data}});
} finally {
 if(report.passed)report.flights=report.flights.map(({samples,...row})=>row);
 await writeFile(out+'/native.json',JSON.stringify(report,null,2)+'\n');
}
