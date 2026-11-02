import assert from 'node:assert/strict';
import {mkdir,writeFile} from 'node:fs/promises';
import {withBlockworksRuntime} from './blockworks-runner.mjs';
const output=process.env.SPAGHETTI_OUTPUT??'/private/tmp/spaghetti-forks';
await mkdir(output,{recursive:true});
const reports=[];
for(const platforming of [false,true])await withBlockworksRuntime(async r=>{
 const source=r.sourceModule[platforming?'SPAGHETTI_RAILS_PLATFORMING_LEVEL':'SPAGHETTI_RAILS_LEVEL'];
 const islands=r.sourceModule[platforming?'SPAGHETTI_PLATFORMER_ISLANDS':'SPAGHETTI_RACE_ISLANDS'];
 const {spaghettiSamples}=await r.server.ssrLoadModule('/src/levels/spaghetti-infinite-course.ts');
 const forks=source.components.filter(c=>c.t==='rail'&&c.nm.includes('fork'));
 const ray=new r.THREE.Raycaster(),departures=new Map();let maxYaw=0,level=0,downhill=0;
 const support=p=>{ray.set(new r.THREE.Vector3(p[0],p[1]+.05,p[2]),new r.THREE.Vector3(0,-1,0));ray.far=2;return r.l.raycastGround(ray).find(h=>h.face?.normal.y>.5);};
 for(const c of forks){
  const points=spaghettiSamples(c),first=points[0],last=points.at(-1);
  assert.ok(support(first),c.nm+' has a supported, selectable mouth');
  assert.ok(support(last),c.nm+' ends above a real landing');
  const island=islands.find(i=>Math.abs(first[0]-i.p[0])<i.w/2&&Math.abs(first[2]-i.p[2])<i.d/2&&Math.abs(first[1]-i.p[1]-.9)<.05);
  assert.ok(island,c.nm+' starts on an existing island');
  const links=departures.get(island.name)??[];links.push({name:c.nm,drop:first[1]-last[1]});departures.set(island.name,links);
  if(Math.abs(first[1]-last[1])<.1)level++;else if(first[1]-last[1]>5)downhill++;
 }
 for(const c of source.components.filter(c=>c.t==='rail'&&(/fork|Recovery weave|edge stitch/.test(c.nm)))){
  const points=spaghettiSamples(c);
  for(let i=1;i<points.length;i++){
   const a=points[i-1],b=points[i],dz=a[2]-b[2];
   assert.ok(dz>0,c.nm+' always advances');
   const angle=Math.atan2(Math.abs(b[0]-a[0]),dz)*180/Math.PI;maxYaw=Math.max(maxYaw,angle);
   assert.ok(angle<60,c.nm+' must not waste distance on a sideways traverse: '+angle);
  }
 }
 const mainJunctions=[...departures.keys()].filter(n=>!n.startsWith('Recovery')).length;
 assert.ok(mainJunctions>=30,'Frequent forks are on primary platforms, not just the recovery network');
 assert.ok(level>=12&&downhill>=40,'Both same-height choices and genuine height transfers are distributed through the course');
 let downhillPairs=0;
 const sampled=source.components.filter(c=>c.t==='rail').map(c=>({name:c.nm,points:spaghettiSamples(c)}));
 for(const [name,links] of departures){
  const island=islands.find(i=>i.name===name),outgoing=new Set();
  for(const rail of sampled){
   const at=rail.points.findIndex(p=>Math.abs(p[0]-island.p[0])<island.w/2&&Math.abs(p[2]-island.p[2])<island.d/2&&Math.abs(p[1]-island.p[1]-.9)<.2);
   if(at>=0&&rail.points.slice(at+1).some(p=>p[2]<island.p[2]-island.d/2-1))outgoing.add(rail.name);
  }
  assert.ok(outgoing.size>=2,name+' has two physically separate forward rail departures');
  if(links.length>1&&Math.max(...links.map(l=>l.drop))-Math.min(...links.map(l=>l.drop))>30)downhillPairs++;
 }
 assert.ok(downhillPairs>=8,'Many junctions offer genuinely different downhill grades');
 const categories=new Map();
 for(const c of forks){
  const p=spaghettiSamples(c),drop=p[0][1]-p.at(-1)[1];
  const kind=c.nm.startsWith('Recovery')?'recovery':platforming?c.nm.split('/ fork /')[1]:c.nm.split('/').at(-1).trim();
  const key=kind+'/'+(drop<1?'level':drop>55?'steep':'shallow')+'/'+Math.floor((p[0][1]+144)/96);
  if(!categories.has(key))categories.set(key,c);
 }
 const rides=[];
 for(const c of categories.values()){
  const rail=r.l.rails.find(rail=>rail.object.userData.sourceName===c.nm),start=rail.points[0].clone();start.y+=1.3;
  r.p.respawn(r.l,true,false,{position:start,heading:new r.THREE.Vector3(0,0,-1)});
  r.p.state='air';r.p.grounded=false;r.p.vVel=-2;r.p.speed=22;
  const deaths=r.p.totalDeaths;let maxT=0,caught=false,frames=0;
  for(;frames<2400;frames++){
   const correction=Math.max(-1,Math.min(1,-r.p.balance*5-r.p.balanceVel*.7));
   r.tick({moveY:1,moveX:r.p.state==='grind'?correction:0,grindHeld:true});
   if(r.p.grindRail===rail){caught=true;maxT=Math.max(maxT,r.p.grindT);}
   if(maxT>rail.totalLength-4||r.p.totalDeaths>deaths)break;
  }
  const ride={name:c.nm,caught,frames,maxT,length:rail.totalLength,end:r.p.pos.toArray(),deaths:r.p.totalDeaths-deaths};rides.push(ride);
  await writeFile(output+'/progress.json',JSON.stringify({platforming,rides},null,2));
  assert.ok(caught&&maxT>rail.totalLength-4,'Native grind cannot complete '+JSON.stringify(ride));
  assert.equal(ride.deaths,0);
 }
 const slopes=[];
 for(const c of source.components.filter(c=>c.gravityTrack&&c.nm.includes('kicker approach'))){
  const start=[c.p[0],c.p[1]+2.08,c.p[2]+6];
  r.p.respawn(r.l,true,false,{position:new r.THREE.Vector3(...start),heading:new r.THREE.Vector3(0,0,-1)});r.p.speed=12;
  r.tick({});const entrySpeed=r.p.speed;let exitSpeed=entrySpeed,downhillFrames=0;
  for(let f=0;f<120&&r.p.pos.z>c.p[2]-6;f++){
   r.tick({moveY:1});
   if(r.p.groundHit?.normal.z<-.1)downhillFrames++;
   exitSpeed=Math.max(exitSpeed,r.p.speed);
  }
  slopes.push({name:c.nm,entrySpeed,exitSpeed,downhillFrames,end:r.p.pos.toArray()});
  assert.ok(downhillFrames>8&&exitSpeed>entrySpeed+2,'Downhill approach earns speed on real sloping ground');
 }
 const report={platforming,rails:forks.length,junctions:departures.size,mainJunctions,downhillPairs,level,downhill,maxYaw,rides,slopes};reports.push(report);
 await writeFile(output+'/report.json',JSON.stringify(reports,null,2));console.log(JSON.stringify(report));
},{modulePath:platforming?'/src/levels/spaghetti-rails-platforming.ts':'/src/levels/spaghetti-rails.ts',source:m=>m[platforming?'SPAGHETTI_RAILS_PLATFORMING_LEVEL':'SPAGHETTI_RAILS_LEVEL'],levelId:platforming?'spaghetti-rails-platforming':'spaghetti-rails',endlessDeaths:true});
