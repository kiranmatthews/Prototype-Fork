import assert from 'node:assert/strict';
import {withBlockworksRuntime} from './blockworks-runner.mjs';

const fixture={v:1,name:'Race return lifetime',spawn:[0,.1,30],killY:-30,startWarpPad:false,components:[
 {t:'platform',p:[0,-.5,-100],s:[60,1,420]},{t:'crate',kind:'wood',p:[20,0,80]},{t:'crate',kind:'mystery',p:[24,0,80]},
 {t:'gate',p:[0,0,-200]},{t:'camnode',p:[0,0,100]},{t:'camnode',p:[0,0,-210]}],
 skateRace:{v:1,racers:8,seed:3,line:[[0,0,100,60],[0,0,-200,60]],jumps:[],finishWidth:55,originalLength:225}};

// Inspect retained world objects, not a duplicated list of Player's private
// contacts. Shared character geometry is deliberately outside this ownership set.
function retainedPath(owner,departed){
 const seen=new Set(),queue=[[owner,'race']];
 for(let at=0;at<queue.length;at++){
  const [value,path]=queue[at];if(!value||typeof value!=='object'||seen.has(value))continue;
  if(departed.has(value))return path;seen.add(value);
  if(ArrayBuffer.isView(value)||value instanceof ArrayBuffer)continue;
  const entries=value instanceof Map?[...value].flatMap(([k,v],i)=>[[`key${i}`,k],[`value${i}`,v]]):value instanceof Set?[...value].map((v,i)=>[i,v]):Object.entries(value);
  for(const [key,child]of entries)if(child&&typeof child==='object')queue.push([child,`${path}.${key}`]);
 }
 return null;
}

await withBlockworksRuntime(async r=>{
 const {SkateRace}=await r.server.ssrLoadModule('/src/race/runtime.ts');
 const {Level}=await r.server.ssrLoadModule('/src/level.ts');
 const race=new SkateRace(r.scene,r.p,false,()=>true);race.attach(r.l,'race-return');
 const players=race.riders.map(a=>a.player),scenes=race.riders.map(a=>a.scene),tuning={...r.TUNING};
 let current=r.l,visits=0;
 for(let i=0;i<4;i++){
  race.start('race',19410);race.phase='running';
  current.raceActorId=1;current.breakCrate(current.crates[0]);current.breakCrate(current.crates[1]);
  assert.ok(race.riders[1].boxes.size>0&&race.returns.size>0);
  race.riders[0].item='green-shell';assert.ok(race.useItem());
  race.effects.lightning(r.p.pos);
  const rival=race.riders[1].player;rival.invulnTimer=0;assert.ok(rival.beginRaceStun(4,1));assert.ok(rival.looseBoard);
  const departed=new Set([current,...current.crates]);current.root.traverse(node=>departed.add(node));
  const transient=[];race.projectiles[0].mesh.traverse(node=>{if(node.isMesh)transient.push(node.geometry);});
  const disposed=new Map(transient.map(g=>[g,0]));for(const g of transient)g.addEventListener('dispose',()=>disposed.set(g,disposed.get(g)+1));
  const ordinary=new Level(r.scene,{id:'ordinary',name:'Ordinary',data:{v:1,name:'Ordinary',spawn:[0,.1,0],killY:-30,components:[{t:'platform',p:[0,-.5,0],s:[30,1,30]},{t:'gate',p:[0,0,-10]}]}},current);
  current.dispose(ordinary);r.p.respawn(ordinary,true);const humanPosition=r.p.pos.clone(),humanLevel=r.p.runLevel;
  race.attach(ordinary,'ordinary');
  assert.equal(retainedPath(race,departed),null,'inactive race must release departed Level and all its scene nodes');
  assert.deepEqual(r.p.pos,humanPosition);assert.equal(r.p.runLevel,humanLevel,'detaching rivals must preserve the human destination');
  assert.equal(race.projectiles.length,0);assert.equal(race.effects.effects.length,0);
  assert.ok([...disposed.values()].every(count=>count===1),'transient item geometry is released exactly once');
  assert.ok(race.riders.slice(1).every(a=>a.scene.parent===null));
  assert.equal(current.onRaceCrateBreak,null);
  // Reattaching the current ordinary level must remain a no-op.
  race.attach(ordinary,'ordinary');assert.ok([...disposed.values()].every(count=>count===1));
  const next=new Level(r.scene,{id:'race-return',name:fixture.name,data:fixture},ordinary);
  ordinary.dispose(next);r.p.respawn(next,true);race.attach(next,'race-return');
  assert.deepEqual(race.riders.map(a=>a.player),players);assert.deepEqual(race.riders.map(a=>a.scene),scenes);
  race.start(i%2?'time-trial':'race',19410);race.phase='running';
  const before=r.p.pos.clone();for(let frame=0;frame<120;frame++){r.scene.updateMatrixWorld(true);race.step(r.dt,race.drive(0));r.p.commitRenderStep(next);race.commitRenderStep();}
  assert.ok(r.p.pos.distanceTo(before)>5,'reused rider still responds to ordinary drive input');
  assert.equal(r.p.totalDeaths,0);assert.equal(race.riders.length,8);assert.equal(race.root.children.length,40);
  current=next;visits++;
 }
 current.dispose();assert.deepEqual(r.TUNING,tuning);
 console.log(`PASS ${visits} race departures/reentries: no departed world references, unchanged rider identities, one-time effect cleanup, independent human destination and native movement.`);
},{modulePath:'/src/levels/slipstream.ts',source:()=>fixture,levelId:'race-return'});
