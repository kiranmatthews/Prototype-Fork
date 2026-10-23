import assert from 'node:assert/strict';
import {readFile,writeFile} from 'node:fs/promises';
import {withBlockworksRuntime} from './blockworks-runner.mjs';
import {mallRailFixtures,createMallRailPilot} from './mall-measured-rail-pilot.mjs';
import {mallGapFixtures,createMallGapPilot} from './mall-measured-gap-pilot.mjs';
import {nativeRailCandidate,nativeLinePair} from './thps-rail-query.mjs';
const experiment=process.argv.includes('--source-query'),sweep=process.argv.includes('--sweep'),tuned=process.argv.includes('--tuned');
const retail=JSON.parse(await readFile('docs/mall/retail-rails.json','utf8'));
const nodes=new Map(retail.railNodes.map(n=>[n.index,n.rawPosition.map((v,i)=>Math.round(v*(i===1?-4096:4096)))]));
const rails=retail.activation.paths.map((path,id)=>({id,points:path.map(n=>nodes.get(n))})).reverse();
await withBlockworksRuntime(async r=>{
 const {p,l,THREE,sourceModule:m}=r,fixtures=[],unit=m.MALL_LEVEL.skateReference.metresPerUnit;
 const raw=world=>m.mallSourcePoint(...world).map((v,i)=>Math.round((v-retail.registration.translation[i])/retail.registration.factor*retail.registration.axisSigns[i]*(i===1?-4096:4096)));
 const xyz=v=>[-v[2],-v[1],-v[0]];
 const world=q=>m.mallPoint(...q.map((v,i)=>v/4096*(i===1?-1:1)*retail.registration.axisSigns[i]*retail.registration.factor+retail.registration.translation[i]));
 let previous=null,current=null,entry=null,frame=0;
 const step=p.step.bind(p),enter=p.enterGrind.bind(p);
 p.step=(dt,input,level)=>{
  const normal=p.grounded?p.rideNormal:new THREE.Vector3(0,1,0),feet=p.pos.toArray(),anchor=feet.map((v,i)=>v+normal.getComponent(i)*unit*30);
  current={feet:raw(feet),anchor:raw(anchor)};previous??=current;
  const velocity=xyz([p.axisF.x*p.speed+p.axisL.x*(p.grindAirLat+p.slideAirLat),p.vVel,p.axisF.z*p.speed+p.axisL.z*(p.grindAirLat+p.slideAirLat)]);
  if(p.grounded){const n=p.rideNormal,slope=Math.hypot(n.x,n.z),nx=slope?n.x/slope:0,nz=slope?n.z/slope:0,down=p.axisF.x*nx+p.axisF.z*nz;velocity.splice(0,3,...xyz([(p.axisF.x+nx*(n.y-1)*down)*p.speed,-slope*down*p.speed,(p.axisF.z+nz*(n.y-1)*down)*p.speed]));}
  assert.ok(velocity.every(Number.isFinite),'Finite complete incoming velocity is required');
  const options={grounded:p.grounded};
  entry={frame:++frame,state:p.state,source:m.mallSourcePoint(...feet),grounded:p.grounded,requested:!!(input.grindHeld||input.grindPressed),cooldown:p.regrindCd,
   nativeSweep:{from:previous.anchor,to:current.anchor},sourceAnchorCandidate:nativeRailCandidate(rails,previous.anchor,current.anchor,velocity,options),
   feetCandidate:nativeRailCandidate(rails,previous.feet,current.feet,velocity,options)};
  if(entry.requested&&p.state!=='grind'&&!p.isBailing&&entry.sourceAnchorCandidate&&active.firstSourceCandidate===null)active.firstSourceCandidate=entry;
  step(dt,input,level);previous=current;
 };
 let active;
 if(experiment)p.tryGrind=()=>{if(p.isBailing||p.regrindCd>0||p.flipT>1/60+1e-6||p.specialGrab!==null||!entry.sourceAnchorCandidate)return false;const q=entry.sourceAnchorCandidate,rail=l.rails[q.rail],sample=rail.closest(new THREE.Vector3(...world(q.point2)));p.enterGrind(rail,sample,l);return true;};
 p.enterGrind=(rail,sample,level)=>{
  active.catches.push({...entry,actualRail:l.rails.indexOf(rail),actualDistance:p.pos.distanceTo(sample.point),actualT:sample.t,originalSegments:rails.find(r=>r.id===l.rails.indexOf(rail)).points.slice(1).map((end,i)=>({segment:i,...nativeLinePair(entry.nativeSweep.from,entry.nativeSweep.to,rails.find(r=>r.id===l.rails.indexOf(rail)).points[i],end)})).sort((a,b)=>a.distance-b.distance).slice(0,2)});
  return enter(rail,sample,level);
 };
 const baselineFixtures=mallRailFixtures.map(f=>({...f,lead:f.name.includes('display')?6.5:f.name==='Crossrail low arch'?5:f.lead}));
 const cases=sweep?baselineFixtures.filter(f=>['First concourse display ledge','Crossrail low arch'].includes(f.name)).flatMap(f=>Array.from({length:10},(_,i)=>({...f,name:f.name+' / lead '+(i+1),lead:i+1}))):[...baselineFixtures,...mallGapFixtures.filter(f=>f.kind==='tape')];
 for(const original of cases){
  const f=tuned?{...original,lead:original.name.includes('display')?2:original.name==='Crossrail low arch'?9:original.lead}:original;
  const start=m.mallPoint(...f.start),heading=new THREE.Vector3(...(f.direction??f.heading));start[1]=m.mallSupport(start[0],start[2],start[1]+.4)+.1;
  p.respawn(l,true,false,{position:new THREE.Vector3(...start),heading});p.axisF.copy(heading);p.axisL.set(-heading.z,0,heading.x);
  previous=null;frame=0;active={name:f.name,catches:[],firstSourceCandidate:null};
  const pilot=f.kind?createMallGapPilot(f,m.MALL_RAILS):createMallRailPilot(f,m,l,p,THREE.Vector3),ri=()=>p.grindRail?l.rails.indexOf(p.grindRail):null;
  while(!pilot.e.done){r.tick(f.kind?pilot.sample(p,m.mallSourcePoint(...p.pos.toArray()),ri()):pilot.sample());if(f.kind)pilot.observe(p,m.mallSourcePoint(...p.pos.toArray()),ri());else pilot.observe();}
  if(!experiment)assert.ok(!pilot.e.bail&&(pilot.e.landed||pilot.e.reached));
  active.outcome={frames:pilot.e.frames,bail:pilot.e.bail,reached:pilot.e.landed||pilot.e.reached,intendedRails:pilot.e.targetRail!==undefined?[pilot.e.targetRail]:pilot.e.expectedRails,actualRails:pilot.e.rails,intendedRailCaught:pilot.e.targetRail!==undefined?pilot.e.rails.includes(pilot.e.targetRail):JSON.stringify(pilot.e.rails)===JSON.stringify(pilot.e.expectedRails),crossedNodes:pilot.e.crossedNodes};fixtures.push(active);
 }
 const report={sourceRevision:'d9319c8d5b42c431de02bec0f02f0cf955f2fbae',diagnosticOnly:true,isolatedQueryOverride:experiment,tunedReleases:tuned,querySpanSeconds:1/60,runtimeSnapshot:'snapshot-25 with source capture disabled for pass24 baseline; query override only when requested',nativeAnchor:'Original mPos is 30 source units along the support normal above collision contact; ordinary air uses the flat support offset. Feet-only queries are retained separately to expose the coordinate-reference effect.',inputContract:'One supported start per fixture, followed only by controller samples. Baseline queries observe pass24 capture behavior; --source-query replaces only the capture decision and --tuned changes release timing. Neither predicts the entire original-game trajectory.',scope:'Geometric Rail_Update offers only. Full HandleStickToRail cooldown, trick-state and handplant logic are not simulated. Source linked-list order is reverse normal-start activation order.',fixtures};
 await writeFile(`/private/tmp/mall-recreation/measured/catch-${sweep?'sweep':tuned?'tuned':experiment?'experiment':'audit'}.json`,JSON.stringify(report,null,2));
 console.log(JSON.stringify({fixtures:fixtures.map(f=>({name:f.name,outcome:f.outcome,firstSourceFrame:f.firstSourceCandidate?.frame,catches:f.catches.map(c=>({frame:c.frame,actual:c.actualRail,distance:c.actualDistance,source:c.sourceAnchorCandidate?.rail,sourceDistance:c.sourceAnchorCandidate?.distance,feet:c.feetCandidate?.rail}))}))}));
},{modulePath:'/src/levels/mall-measured.ts',source:m=>{const data={...m.MALL_LEVEL,skateReference:{...m.MALL_LEVEL.skateReference}};delete data.skateReference.railCapture;return data;},levelId:'mall',endlessDeaths:true,maxFrames:18000,controlFrame:r=>r.p.axisF});
