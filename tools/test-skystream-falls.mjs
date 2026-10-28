import assert from 'node:assert/strict';
import {writeFile,mkdir} from 'node:fs/promises';
import {join} from 'node:path';
import {tmpdir} from 'node:os';
import {withBlockworksRuntime} from './blockworks-runner.mjs';

const output=process.env.SKYSTREAM_REVIEW_DIR??join(tmpdir(),'skystream-review');
await mkdir(output,{recursive:true});
await withBlockworksRuntime(async r=>{
 const {p,l,THREE,sourceModule:m}=r,results=[];
 const api=await r.server.ssrLoadModule('/src/level.ts');
 assert.equal(api.normalizeCustomLevelData(r.source).fallRecoveryDrop,24);
 for(const invalid of [0,7,121,NaN,Infinity,'24'])
  assert.equal(api.normalizeCustomLevelData({...r.source,fallRecoveryDrop:invalid}),null);
 const fall=(name,start,enabled=true)=>{
  l.fallRecoveryDrop=enabled?24:undefined;
  p.respawn(l,true,false,{position:new THREE.Vector3(...start),heading:new THREE.Vector3(1,0,0)});
  const begin=r.frame;let left=null,death=null,returned=null;
  for(let frame=0;frame<1800;frame++){
   r.tick(death?{}:{...r.worldDirectionInput([1,0,0]),jumpHeld:true});
   if(!left&&!p.grounded&&p.state==='air')left=r.snapshot();
   if(!death&&p.state==='dead')death=r.snapshot();
   if(death&&p.state!=='dead'&&!p.isBailing&&p.grounded){returned=r.snapshot();break;}
  }
  assert.ok(left&&death&&returned,name+': native fall and supported respawn');
  assert.ok(p.pos.distanceTo(l.currentSpawn)<3,name+': returns to the earned spawn');
  const result={name,fallSeconds:(death.frame-left.frame)*r.dt,returnSeconds:(returned.frame-left.frame)*r.dt,
   deathY:death.position[1],begin,left,death,returned};
  results.push(result);console.log(JSON.stringify({name,fallSeconds:result.fallSeconds,returnSeconds:result.returnSeconds,deathY:result.deathY}));
  return result;
 };
 const old=fall('Old whole-level kill plane',r.source.spawn,false);
 const top=fall('Cloudhead departure',r.source.spawn);
 assert.ok(top.fallSeconds<2.5&&top.returnSeconds<5,'An empty high-course miss must return promptly');
 assert.ok(old.returnSeconds-top.returnSeconds>6,'Remove the long descent to the bottom of the level');
 assert.ok(top.deathY>100,'High-course recovery must happen near the missed road');
 for(const [name,start]of [
  ['Middle sanctuary',[30,-108,-1220]],
  ['Aureole runout',[164,-413.9,-1994]],
  ['Finish court',[132,-431.9,-2154]],
 ]){
  const result=fall(name,start);
  assert.ok(result.returnSeconds<5.5,name+': prompt recovery across the full course height');
 }
 l.fallRecoveryDrop=24;
 // The normal level still has the lower-road candidates used by all four
 // shortcuts. The separate input-only shortcut test proves their landings.
 for(const cut of m.SKYSTREAM_SHORTCUTS){
  const position=new THREE.Vector3(...cut.entry);position.y-=24;
  assert.ok(l.hasReachableFallLanding(position,-30,32,31,52),cut.name+': preserve its reachable lower road');
 }
 await writeFile(join(output,'falls.json'),JSON.stringify(results,null,2)+'\n');
},{modulePath:'/src/levels/skystream.ts',source:m=>m.SKYSTREAM_LEVEL,levelId:'skystream',endlessDeaths:true,maxFrames:10000,
 controlFrame:r=>r.p.courseInputDirection(r.l)??r.p.camDir});
