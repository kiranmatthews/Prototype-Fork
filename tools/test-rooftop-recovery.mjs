import assert from 'node:assert/strict';
import {writeFile} from 'node:fs/promises';
import {withBlockworksRuntime} from './blockworks-runner.mjs';
import {createRooftopPilot} from './rooftop-pilot.mjs';
const reports=[];
await withBlockworksRuntime(r=>{
 const{p,l,sourceModule:m,THREE}=r;const before=JSON.stringify(r.TUNING);
 assert.ok(m.ROOFTOP_LENGTH>=1800&&m.ROOFTOP_LENGTH<=2800,'Keep the edited route compact');assert.equal(m.ROOFTOP_DISTRICTS.length,6);assert.equal(m.ROOFTOP_ROOFS.length,44);assert.equal(m.ROOFTOP_FORKS.length,2);
 assert.ok(new Set(m.ROOFTOP_DISTRICTS.map(d=>d.last-d.first+1)).size>=3,'Districts must not repeat the same roof-count template');assert.equal(m.ROOFTOP_ROOFS.filter(r=>r.kind==='crumble').length,1);assert.equal(m.ROOFTOP_ROOFS.filter(r=>r.kind==='atrium').length,1);
 const lengths=new Set(m.ROOFTOP_ROOFS.map(r=>r.depth)),widths=new Set(m.ROOFTOP_ROOFS.map(r=>r.width)),kinds=new Set(m.ROOFTOP_ROOFS.map(r=>r.kind));
 assert.ok(lengths.size>=16&&Math.min(...lengths)<=30&&Math.max(...lengths)>=70);assert.ok(widths.size>=14&&Math.min(...widths)<=8&&Math.max(...widths)>=36);assert.ok(kinds.size>=10);
 assert.ok(m.ROOFTOP_GAPS.filter(g=>g.ramp).length>=8);assert.ok(m.ROOFTOP_GAPS.filter(g=>g.to-g.from>.25).length>=2);
 const descending=m.ROOFTOP_GAPS.filter(g=>g.to<g.from-.25).length,level=m.ROOFTOP_GAPS.filter(g=>Math.abs(g.to-g.from)<.25).length;
 assert.ok(descending>=18&&level>=14);assert.ok(m.rooftopPoint(6)[1]-m.rooftopPoint(m.ROOFTOP_LENGTH-16)[1]>40);
 assert.ok(m.ROOFTOP_ROOFS.filter(r=>r.shape!=='flat').length>=16);assert.equal(m.ROOFTOP_FOG_Y,m.ROOFTOP_LOWEST_Y-3);
 for(const c of m.ROOFTOP_RELAY_LEVEL.components.filter(c=>c.grp===391))for(let i=1;i<c.vertices.length;i+=3)assert.ok(c.p[1]+c.vertices[i]<=m.ROOFTOP_FOG_Y+.001);
 for(const fork of m.ROOFTOP_FORKS){assert.ok(Math.abs(fork.offset)>=30);assert.equal(m.ROOFTOP_BRANCH_ROOFS.filter(r=>r.route===fork.index).length,fork.weights.length);}
 const headings=m.ROOFTOP_ROOFS.map(r=>m.rooftopYaw((r.a+r.b)/2));assert.ok(Math.max(...headings)-Math.min(...headings)>110);
 let length=0,last=m.rooftopPoint(0);for(let s=1;s<=m.ROOFTOP_LENGTH;s++){const q=m.rooftopPoint(s);length+=Math.hypot(q[0]-last[0],q[2]-last[2]);last=q;}
 reports.push({test:'authored scope',mainStationMetres:m.ROOFTOP_LENGTH,walkingLineMetres:length,roofs:m.ROOFTOP_ROOFS.length,alternateRoofs:m.ROOFTOP_BRANCH_ROOFS.length,districts:m.ROOFTOP_DISTRICTS.length,forks:m.ROOFTOP_FORKS.length,lengthVariants:lengths.size,widthVariants:widths.size,roofKinds:[...kinds],rampTransfers:m.ROOFTOP_GAPS.filter(g=>g.ramp).length,ascendingTransfers:m.ROOFTOP_GAPS.filter(g=>g.to>g.from+.25).length,headingRange:[Math.min(...headings),Math.max(...headings)],descendingTransfers:descending,levelTransfers:level,totalDescent:m.rooftopPoint(6)[1]-m.rooftopPoint(m.ROOFTOP_LENGTH-16)[1],roofShapes:Object.fromEntries(['flat','gable','aframe','shed','hip'].map(shape=>[shape,m.ROOFTOP_ROOFS.filter(r=>r.shape===shape).length])),lowestRoof:m.ROOFTOP_LOWEST_Y,fogCeiling:m.ROOFTOP_FOG_Y});
 r.stepFor(8);assert.ok(p.grounded);assert.ok(p.pos.distanceTo(l.spawnPos)<.2);
 let supported=0,openAtriums=0,realGaps=0;
 const cast=(q)=>{const ray=new THREE.Raycaster(new THREE.Vector3(q[0],q[1]+.5,q[2]),new THREE.Vector3(0,-1,0),0,1.1);return [...l.raycastGround(ray),...ray.intersectObjects(l.crumbles.map(c=>c.mesh),false)];};
 for(const roof of [...m.ROOFTOP_ROOFS,...m.ROOFTOP_BRANCH_ROOFS]){
  const route=roof.route<0?'main':`fork-${roof.route}`;
  for(let s=roof.a+1;s<roof.b-1;s+=3){const q=m.rooftopPoint(s,route);assert.ok(cast(q).some(h=>Math.abs(h.point.y-q[1])<.085),`Unsupported ${roof.index} at ${s}`);supported++;}
  if(roof.kind==='atrium'){const q=m.rooftopWorld((roof.a+roof.b)/2,roof.top);if(!cast(q).some(h=>h.point.y>roof.top-.2))openAtriums++;}
 }
 let pitchedSamples=0;
 for(const roof of [...m.ROOFTOP_ROOFS,...m.ROOFTOP_BRANCH_ROOFS].filter(r=>r.shape!=='flat'))for(const t of [.25,.5,.75])for(const side of [-.65,0,.65]){
  const station=roof.a+roof.depth*t,u=side*roof.width/2,q=m.rooftopPoint(station,roof.route<0?'main':`fork-${roof.route}`),yaw=m.rooftopYaw(station)*Math.PI/180;q[0]+=Math.cos(yaw)*u;q[2]-=Math.sin(yaw)*u;q[1]=m.rooftopSurfaceY(roof,station,u);
  assert.ok(cast(q).some(h=>Math.abs(h.point.y-q[1])<.13),`Unsupported pitched face ${roof.index}, ${station}, ${u}`);pitchedSamples++;
 }
 reports.push({test:'actual pitched roof faces',supportedSamples:pitchedSamples});
 for(const gap of m.ROOFTOP_GAPS){const q=m.rooftopPoint((gap.a+gap.b)/2);if(!cast(q).some(h=>h.point.y>q[1]-.2))realGaps++;}
 assert.equal(openAtriums,1,'Keep the garden atrium physically open');assert.ok(realGaps>=m.ROOFTOP_GAPS.length-1,'The supposed roof gaps have been filled');
 reports.push({test:'native physical support and voids',supportedSamples:supported,openAtriums,realMainRouteGaps:realGaps});
 let branchClearanceSamples=0;
 for(const roof of m.ROOFTOP_BRANCH_ROOFS)for(let s=roof.a+1;s<roof.b-1;s+=2){
  const q=m.rooftopPoint(s,`fork-${roof.route}`);
  for(const c of m.ROOFTOP_RELAY_LEVEL.components){
   if(c.t!=='wall'||c.pts||!c.s||c.p[1]+c.s[1]<=q[1]+.1||c.p[1]>q[1]+2.4)continue;
   const yaw=(c.yaw??0)*Math.PI/180,dx=q[0]-c.p[0],dz=q[2]-c.p[2],x=Math.cos(yaw)*dx-Math.sin(yaw)*dz,z=Math.sin(yaw)*dx+Math.cos(yaw)*dz;
   assert.ok(Math.abs(x)>c.s[0]/2+.7||Math.abs(z)>c.s[2]/2+.7,`Branch ${roof.route} obstructed by ${c.nm} at ${s}`);
  }
  branchClearanceSamples++;
 }
 reports.push({test:'alternate route body clearance',samples:branchClearanceSamples,obstructions:0});

 for(let i=0;i<m.ROOFTOP_CHECKPOINTS.length;i++){assert.equal(p.warpCheckpoint(l,1),true);r.stepFor(6);assert.ok(p.grounded,`Unsupported checkpoint ${i}`);assert.equal(l.activeCheckpoint,l.checkpoints[i]);}
 reports.push({test:'all native checkpoint warps',count:l.checkpoints.length,supported:true});
 const spec=m.ROOFTOP_CHECKPOINTS.at(-1),roof=m.ROOFTOP_ROOFS[spec.index],cp=l.activeCheckpoint,lives=p.lives;
 r.walkTo(m.rooftopWorld(spec.s,roof.top,roof.width/2-2),{pace:.65,tolerance:.4,arrivalTolerance:.9});
 const yaw=m.rooftopYaw(spec.s)*Math.PI/180,right=[Math.cos(yaw),0,-Math.sin(yaw)],departure=r.frame;
 r.charge(25);r.releaseJump(r.worldDirectionInput(right));
 r.until(()=>p.state==='dead',()=>r.worldDirectionInput(right),{allowDeath:true,maxFrames:350,label:'jump past the real parapet into the street reset'});const death=r.frame;
 r.until(()=>p.state==='ride'&&p.grounded,{}, {allowDeath:true,maxFrames:350,label:'native checkpoint return'});const returned=r.frame;
 assert.equal(l.activeCheckpoint,cp);assert.ok(p.pos.distanceTo(cp.spawnPos)<1);assert.equal(lives-p.lives,1);
 r.until(()=>p.pos.distanceTo(cp.spawnPos)>4,()=>r.steerToward(m.rooftopPoint(spec.s+10),{pace:.7}),{maxFrames:150,label:'continue after recovery'});
 reports.push({test:'missed-roof recovery',fallSeconds:(death-departure)*r.dt,respawnSeconds:(returned-death)*r.dt,livesLost:1,continued:true});
 assert.equal(JSON.stringify(r.TUNING),before);
},{source:m=>m.ROOFTOP_RELAY_LEVEL,levelId:'rooftop-relay',controlFrame:r=>r.p.courseInputDirection(r.l)??r.p.camDir});
await withBlockworksRuntime(r=>{
 const{p,l,sourceModule:m}=r,roof=m.ROOFTOP_ROOFS.find(r=>r.kind==='crumble'),d=m.ROOFTOP_DISTRICTS[roof.district],mid=(roof.a+roof.b)/2,pilot=createRooftopPilot(m,{nodeCamera:true,mode:'foot',start:d.a+6});
 while(pilot.progress<mid-1.6){r.tick(pilot.sample(p,l));pilot.observe(p,l);}
 assert.ok(p.grounded);const cp=l.activeCheckpoint;assert.ok(cp,'The construction approach must bank its checkpoint');
 const q=m.rooftopWorld(mid,roof.top),panel=l.crumbles.find(c=>Math.hypot(c.base.x-q[0],c.base.z-q[2])<1);assert.ok(panel);assert.equal(panel.state,'shake');
 const stopped=r.frame,lives=p.lives;
 r.until(()=>p.state==='dead',{}, {allowDeath:true,maxFrames:900,label:'wait on the visibly loose construction panel'});const death=r.frame;
 r.until(()=>p.state==='ride'&&p.grounded,{}, {allowDeath:true,maxFrames:350,label:'construction checkpoint return'});
 assert.equal(l.activeCheckpoint,cp);assert.equal(lives-p.lives,1);assert.ok(p.pos.distanceTo(cp.spawnPos)<1);assert.equal(panel.state,'idle');
 assert.ok(Math.abs(panel.mesh.position.y-panel.base.y)<.02);
 reports.push({test:'construction warning, collapse and reset',warningSeconds:panel.shakeTime,stoppedToDeathSeconds:(death-stopped)*r.dt,restoredPanel:true,bankedCheckpoint:true});
},{source:m=>{const p=m.rooftopPoint(m.ROOFTOP_DISTRICTS[m.ROOFTOP_ROOFS.find(r=>r.kind==='crumble').district].a+6);p[1]+=.12;return{...m.ROOFTOP_RELAY_LEVEL,spawn:p};},levelId:'rooftop-relay',maxFrames:12000,controlFrame:r=>r.p.courseInputDirection(r.l)??r.p.camDir});
await writeFile('/private/tmp/rooftop-v4-recovery.json',JSON.stringify(reports,null,2));console.log(JSON.stringify(reports,null,2));
