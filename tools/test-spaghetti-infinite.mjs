import assert from 'node:assert/strict';
import {mkdir,writeFile} from 'node:fs/promises';
import * as THREE from 'three';
import {withBlockworksRuntime} from './blockworks-runner.mjs';
const output=process.env.SPAGHETTI_OUTPUT??'/private/tmp/spaghetti-infinite';
await mkdir(output,{recursive:true});
const reports=[];
for(const platforming of [false,true])await withBlockworksRuntime(async r=>{
 const source=r.sourceModule[platforming?'SPAGHETTI_RAILS_PLATFORMING_LEVEL':'SPAGHETTI_RAILS_LEVEL'];
 const {normalizeCustomLevelData}=await r.server.ssrLoadModule('/src/level.ts');
 const {verticalLoopShift}=await r.server.ssrLoadModule('/src/verticalLoop.ts');
 assert.ok(normalizeCustomLevelData(source),'Periodic levels survive the complete editor contract');
 const loop=source.verticalLoop;
 for(const y of [-100000,-433,-144,-143.99,0,143.99,144,100000]){
  const shift=verticalLoopShift(y,loop),canonical=y+shift;
  assert.ok(canonical>=loop.minY&&canonical<loop.minY+loop.height);
  assert.ok(shift%loop.height===0);
 }
 const rails=source.components.filter(c=>c.t==='rail');
 const {spaghettiSamples}=await r.server.ssrLoadModule('/src/levels/spaghetti-infinite-course.ts');
 for(const rail of rails){const pts=spaghettiSamples(rail);for(let i=1;i<pts.length;i++)assert.ok(pts[i][2]<pts[i-1][2]+1e-8,'Every rounded rail advances forward');}
 const terraces=source.components.filter(c=>c.t==='platform');
 const sizes=terraces.map(c=>c.s[0]*c.s[2]).sort((a,b)=>a-b);
 const density={platforms:terraces.length,averageArea:sizes.reduce((a,b)=>a+b,0)/sizes.length,medianArea:sizes[Math.floor(sizes.length/2)],largePlatforms:sizes.filter(a=>a>2000).length};
 assert.ok(density.averageArea<550&&density.medianArea<450,'The average platform is substantially smaller than the previous broad terraces');
 // Treat each native rail as an edge joining every landing it physically
 // visits. The entire platform graph, including recovery and reward tiers,
 // must be connected; mere decorative proximity does not count.
 const parent=terraces.map((_,i)=>i),seen=new Set();
 const root=i=>parent[i]===i?i:parent[i]=root(parent[i]);
 for(const rail of rails){
  const points=spaghettiSamples(rail),contacts=new Set();
  for(let i=1;i<points.length;i++){
   const a=points[i-1],b=points[i],steps=Math.max(1,Math.ceil(Math.hypot(...a.map((v,k)=>b[k]-v))));
   for(let j=0;j<=steps;j++){
    const p=a.map((v,k)=>v+(b[k]-v)*j/steps);
    terraces.forEach((c,k)=>{const top=c.p[1]+c.s[1]/2;if(p[1]>=top-.05&&p[1]<=top+3&&Math.abs(p[0]-c.p[0])<c.s[0]/2&&Math.abs(p[2]-c.p[2])<c.s[2]/2)contacts.add(k);});
   }
  }
  const all=[...contacts];for(const i of all){seen.add(i);parent[root(i)]=root(all[0]);}
 }
 assert.equal(seen.size,terraces.length,'Every platform has an authored connecting rail');
 assert.equal(new Set(parent.map((_,i)=>root(i))).size,1,'All platform rail routes join one connected network');
 assert.equal(source.cameraRig,undefined);assert.equal(source.cameraLookAhead,undefined);
 for(const x of [-47,0,47])for(const y of [-140,-30,100])assert.equal(r.l.cameraDirAt(x,y,-200),null,'The ordinary forward corridor owns the camera on every tier');
 const far=Math.min(...source.components.filter(c=>c.nm==='Periodic corridor end').map(c=>c.p[2]))+1;
 let coverage=0;
 for(let z=40;z>=far;z-=.5)for(let x=-48;x<=48;x+=.5){
  assert.ok(terraces.some(c=>Math.abs(x-c.p[0])<=c.s[0]/2+.001&&Math.abs(z-c.p[2])<=c.s[2]/2+.001),`No infinite-fall hole at ${x},${z}`);coverage++;
 }
 assert.equal(source.components.filter(c=>c.t==='trampoline').length,2);
 assert.equal(source.components.filter(c=>c.t==='pit').length,0);
 r.stepFor(30);assert.ok(r.p.grounded,'Spawn has physical support');
 const tuning=JSON.stringify(r.TUNING),falls=[];
 // Below every surface: falling must wrap once, preserve momentum and land.
 for(const [x,z] of [[0,-65],[-44,-180],[44,-245],[0,-355],[-31,far+60]]){
  r.p.respawn(r.l,true,false,{position:new THREE.Vector3(x,-143,z),heading:new THREE.Vector3(0,0,-1)});
  r.p.state='air';r.p.grounded=false;r.p.vVel=-45;r.p.speed=0;
  const offset=r.p.verticalLoopOffset,deaths=r.p.totalDeaths;let wrapped=false,steps=0;
  for(;steps<1800&&!r.p.grounded;steps++){
   const oldY=r.p.pos.y,oldOffset=r.p.verticalLoopOffset,vy=r.p.vVel;
   r.tick({});
   const shift=r.p.verticalLoopOffset-oldOffset;
   if(shift){wrapped=true;assert.equal(shift,loop.height);assert.ok(r.p.vVel<=vy+.01,'Wrap retains downward velocity');assert.ok(Math.abs(r.p.pos.y-oldY-shift)<3,'No physical jump at seam');}
  }
  assert.ok(wrapped&&r.p.grounded,'A miss below all shelves wraps and lands');
  assert.equal(r.p.totalDeaths,deaths,'Wrap costs time, never a life');
  assert.equal(r.p.verticalLoopOffset-offset,loop.height);
  falls.push({x,z,steps,landing:r.p.pos.toArray(),surface:r.p.groundHit?.name});
 }
 assert.equal(JSON.stringify(r.TUNING),tuning);
 reports.push({platforming,components:source.components.length,rails:rails.length,density,connectedPlatforms:seen.size,coverage,falls});
 console.log(JSON.stringify(reports.at(-1)));
},{modulePath:platforming?'/src/levels/spaghetti-rails-platforming.ts':'/src/levels/spaghetti-rails.ts',source:m=>m[platforming?'SPAGHETTI_RAILS_PLATFORMING_LEVEL':'SPAGHETTI_RAILS_LEVEL'],levelId:platforming?'spaghetti-rails-platforming':'spaghetti-rails',endlessDeaths:true});
await writeFile(output+'/native.json',JSON.stringify(reports,null,2));
