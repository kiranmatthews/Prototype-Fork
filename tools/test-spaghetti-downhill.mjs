import assert from 'node:assert/strict';
import {mkdir,writeFile} from 'node:fs/promises';
import {withBlockworksRuntime} from './blockworks-runner.mjs';
const out=process.env.SPAGHETTI_OUTPUT??'/private/tmp/spaghetti-downhill';await mkdir(out,{recursive:true});
await withBlockworksRuntime(async r=>{
 const {raceDeckY}=await r.server.ssrLoadModule('/src/levels/spaghetti-race-world.ts');
 const C=r.source.components,islands=r.sourceModule.SPAGHETTI_RACE_ISLANDS,rails=C.filter(c=>c.t==='rail');
 const {spaghettiSamples}=r.sourceModule,{normalizeCustomLevelData}=await r.server.ssrLoadModule('/src/level.ts');
 const report={loop:r.source.verticalLoop,platforms:islands.length,rails:rails.length,items:C.filter(c=>c.t==='crate').length,stretch:[Math.min(...islands.map(s=>s.stretch)),Math.max(...islands.map(s=>s.stretch))],slopeDegrees:[Math.min(...islands.map(s=>Math.atan(s.grade)*180/Math.PI)),Math.max(...islands.map(s=>Math.atan(s.grade)*180/Math.PI))],coverage:0,physicalProbes:0,blocked:[],unconnected:[],downhill:[],kickers:[],falls:[]};
 assert.ok(normalizeCustomLevelData(r.source));assert.equal(r.source.skateRace.stages.length,12);assert.equal(r.source.verticalLoop.height,288);
 assert.deepEqual(report.stretch,[2,4]);assert.ok(islands.every(s=>s.grade>0&&s.d/s.baseDepth>=2&&s.d/s.baseDepth<=4));
 assert.equal(rails.length,183,'Version 1 graph plus the retained eighteen spring returns; no later fork web');
 assert.equal(r.source.skateRace.rivalSkill,'club');assert.equal(r.source.skateRace.grindBalanceScale,.55);assert.equal(r.source.skateRace.itemPool,'rail');
 assert.equal(r.source.skateRace.itemRespawnSeconds,1.5);assert.ok(report.items>500);assert.equal(C.filter(c=>c.t==='trampoline').length,18);
 const gate=C.find(c=>c.t==='gate'),ends=C.filter(c=>c.nm==='Periodic corridor end').map(c=>c.p[2]),near=Math.max(...ends),far=Math.min(...ends),ray=new r.THREE.Raycaster();
 for(let z=near-.1;z>far;z-=2)for(let x=-48;x<=48;x+=2){assert.ok(islands.some(s=>Math.abs(x-s.p[0])<=s.w/2+.001&&Math.abs(z-s.p[2])<=s.d/2+.001),`Coverage hole ${x},${z}`);report.coverage++;}
 for(let z=near-.5;z>far;z-=18)for(let x=-47.5;x<48;x+=8){
  ray.set(new r.THREE.Vector3(x,143.99,z),new r.THREE.Vector3(0,-1,0));ray.far=288;
  assert.ok(r.l.raycastGround(ray).some(h=>h.face?.normal.y>.5),`Physical recovery hole ${x},${z}`);report.physicalProbes++;
 }
 const parents=islands.map((_,i)=>i),connected=new Set(),root=i=>parents[i]===i?i:parents[i]=root(parents[i]);
 for(const c of rails){
  const points=spaghettiSamples(c),contacts=new Set(),blockers=new Set();
  for(let i=1;i<points.length;i++){
   const a=points[i-1],b=points[i],n=Math.max(1,Math.ceil(Math.hypot(...a.map((v,k)=>b[k]-v))));
   assert.ok(b[2]<=a[2]+.001,'Rails never turn back: '+c.nm);
   for(let j=0;j<=n;j++){
    const p=a.map((v,k)=>v+(b[k]-v)*j/n);
    islands.forEach((s,k)=>{
     if(Math.abs(p[0]-s.p[0])>s.w/2+.3||Math.abs(p[2]-s.p[2])>s.d/2+.3)return;
     const y=raceDeckY(s,p[2]);
     if(p[1]>=y-.05&&p[1]<=y+3.6)contacts.add(k);
     if(p[1]<y-.08&&p[1]+2.8>y-1.4)blockers.add(s.name);
    });
   }
  }
  if(blockers.size)report.blocked.push({rail:c.nm,decks:[...blockers]});
  const list=[...contacts];for(const k of list){connected.add(k);parents[root(k)]=root(list[0]);}
 }
 report.unconnected=islands.filter((s,k)=>!connected.has(k)).map(s=>s.name);report.graphs=new Set(parents.map((_,i)=>root(i))).size;
 await writeFile(out+'/layout.json',JSON.stringify(report,null,2));console.log(JSON.stringify(report));
 assert.equal(report.blocked.length,0,'Rails leave body clearance over sloping decks');assert.equal(report.unconnected.length,0);assert.equal(report.graphs,1);
 // Ordinary forward skating: these are independent slope-contact trials.
 for(const s of islands.filter(s=>s.name.startsWith('Race interchange')).filter((_,i)=>i%3===0)){
  const x=s.p[0]+(s.w>20?10:3),startZ=s.p[2]+s.d*.32,endZ=s.p[2]-s.d*.32;
  r.p.respawn(r.l,true,false,{position:new r.THREE.Vector3(x,raceDeckY(s,startZ)+.08,startZ),heading:new r.THREE.Vector3(0,0,-1)});r.p.speed=14;
  let maximum=0,groundFrames=0,normal=null,frames=0;
  for(;frames<900&&r.p.pos.z>endZ;frames++){r.tick({moveY:1});maximum=Math.max(maximum,r.p.speed);if(r.p.grounded)groundFrames++;normal=r.p.groundHit?.normal.toArray();}
  report.downhill.push({name:s.name,grade:s.grade,frames,groundFrames,maximum,startY:raceDeckY(s,startZ),end:r.p.pos.toArray(),normal});
  await writeFile(out+'/layout.json',JSON.stringify(report,null,2));
  assert.ok(r.p.pos.z<=endZ&&r.p.grounded,'Native skating crosses the long downhill deck');
  assert.ok(r.p.pos.y<raceDeckY(s,startZ)-.3);assert.ok(maximum>14,'The slope earns speed');
 }
 for(const c of C.filter(c=>c.nm?.startsWith('Race kicker / '))){
  const stage=c.nm.split(' / ').at(-1),approach=islands.find(s=>s.name==='Race kicker approach / '+stage),receiver=islands.find(s=>s.name==='Race kicker receiver / '+stage);
  const z=approach.p[2]+approach.d*.4;
  r.p.respawn(r.l,true,false,{position:new r.THREE.Vector3(approach.p[0],raceDeckY(approach,z)+.08,z),heading:new r.THREE.Vector3(0,0,-1)});r.p.speed=20;
  let air=false,landed=false,frames=0,peak=r.p.pos.y;const samples=[];
  for(;frames<360;frames++){
   r.tick({...r.steerToward(receiver.p),jumpHeld:r.p.pos.z<c.p[2]+2});peak=Math.max(peak,r.p.pos.y);
   if(frames%12===0)samples.push({p:r.p.pos.toArray(),g:r.p.grounded,vy:r.p.vVel,state:r.p.state});
   if(!r.p.grounded&&r.p.pos.z<c.p[2])air=true;
   if(air&&r.p.grounded&&r.p.pos.z<c.p[2]-c.len/2-3){landed=true;break;}
  }
  report.kickers.push({name:c.nm,air,landed,frames,peak,end:r.p.pos.toArray(),samples});await writeFile(out+'/layout.json',JSON.stringify(report,null,2));
  assert.ok(air&&landed&&Math.abs(r.p.pos.y-raceDeckY(receiver,r.p.pos.z))<.15&&Math.abs(r.p.pos.x-receiver.p[0])<receiver.w/2&&Math.abs(r.p.pos.z-receiver.p[2])<receiver.d/2,'The longer downhill approach launches onto its kicker receiver');
 }
 for(const [x,z] of [[0,-70],[-44,-400],[44,-980],[0,-2000],[-31,gate.p[2]+40]]){
  r.p.respawn(r.l,true,false,{position:new r.THREE.Vector3(x,-143,z),heading:new r.THREE.Vector3(0,0,-1)});r.p.state='air';r.p.grounded=false;r.p.vVel=-45;r.p.speed=0;
  const offset=r.p.verticalLoopOffset;let frames=0;for(;frames<900&&!r.p.grounded;frames++)r.tick({});
  report.falls.push({x,z,frames,wrapped:r.p.verticalLoopOffset-offset,end:r.p.pos.toArray()});assert.ok(r.p.grounded&&r.p.verticalLoopOffset-offset>=288);
 }
 await writeFile(out+'/layout.json',JSON.stringify(report,null,2));console.log(JSON.stringify({...report,downhill:report.downhill.map(({normal,...s})=>s)}));
},{modulePath:'/src/levels/spaghetti-rails.ts',source:m=>m.SPAGHETTI_RAILS_LEVEL,levelId:'spaghetti-rails'});
