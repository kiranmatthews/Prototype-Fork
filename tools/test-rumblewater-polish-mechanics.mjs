import assert from 'node:assert/strict';
import {writeFile} from 'node:fs/promises';
import {withBlockworksRuntime} from './blockworks-runner.mjs';
const report={pace:[],fatal:[],trips:[],crateKinds:[]};
const kinds=['wood','bouncy','metalbounce','metal','nitro','tnt','mask','life','multihit','mystery','bang','nitrobang'];
const fixture={v:1,name:'Rumblewater contact fixture',spawn:[0,.12,0],killY:-40,startWarpPad:false,components:[
 {t:'platform',p:[0,-.5,-190],s:[40,1,450]},
 {t:'tumblezone',p:[0,5,-8],s:[12,12,2],checkpointTrip:true},
 {t:'rail',p:[0,.5,-8],len:24},
 ...kinds.map((kind,i)=>({t:'crate',p:[-13+i*2.2,0,-45],kind})),
 {t:'crate',p:[2.9,0,-20],kind:'metal',nm:'Partial footprint metal'},
 {t:'crusher',p:[0,0,-70],s:[5,3,5],supports:true},
 {t:'pendulum',p:[0,6,-92],len:5},
 {t:'stone',p:[0,0,-115],axis:'x',range:2,radius:1.2},
 {t:'gate',p:[0,0,-380]}],boulderChase:{path:[[0,0,40],[0,0,-400]],radius:3,speed:20,headStart:20}};
await withBlockworksRuntime(async r=>{
 const {BoulderChase}=await r.server.ssrLoadModule('/src/boulderChase.ts'),{THREE}=r;
 const spec=r.sourceModule.RUMBLEWATER_RUN_LEVEL.boulderChase;
 const pool=()=>Array.from({length:7},()=>({mesh:new THREE.Mesh(),box:new THREE.Box3(),r:8.2,speed:0}));
 for(let stage=0;stage<7;stage++){
  const a=new BoulderChase(spec,pool(),new THREE.Vector3(...r.sourceModule.RUMBLEWATER_RUN_LEVEL.spawn));
  const b=new BoulderChase(spec,pool(),new THREE.Vector3(...r.sourceModule.RUMBLEWATER_RUN_LEVEL.spawn));
  for(const c of [a,b]){c.stage=stage;c.actors[stage].phase='chasing';c.actors[stage].speed=c.actors[stage].pace;}
  let speed=a.speed;
  for(let i=0;i<180;i++){
   a.update(1/60,a.sample(a.progress+9));b.update(1/60,b.sample(b.progress+55));
   assert.equal(a.speed,b.speed,'player proximity cannot alter the rolling speed');
   assert.ok(a.speed>=speed,'no proximity braking');speed=a.speed;
   assert.ok(Math.abs(a.progress-b.progress)<1e-8);
  }
  report.pace.push({stage,speed});
 }
 for(const protection of ['mask','uber','invulnerability']){
  r.p.respawn(r.l,true);r.stepFor(20);r.p.masks=3;
  r.p.uberTimer=protection==='uber'?30:0;r.p.invulnTimer=protection==='invulnerability'?30:0;
  r.until(()=>r.p.pos.z<-7,{moveY:1},{maxFrames:300,label:'begin lethal chase'});
  let contact=false;
  for(let i=0;i<600;i++){
   if(r.l.boulder.st.box.intersectsBox(r.p.playerBox)){contact=true;r.tick();assert.equal(r.p.state,'dead','first boulder contact is fatal through '+protection);break;}
   r.tick();
  }
  assert.ok(contact);report.fatal.push(protection);
 }
 r.p.respawn(r.l,true);r.p.masks=3;r.p.uberTimer=r.p.invulnTimer=30;
 r.l.boulder.st.box.setFromCenterAndSize(r.p.pos.clone().add(new THREE.Vector3(0,.7,0)),new THREE.Vector3(2,3,2));
 r.p.state='hang';assert.ok(r.p.hangHazards(r.l));assert.equal(r.p.state,'dead');report.fatal.push('hanging');
 for(const state of ['ride','air','grind']){
  r.p.respawn(r.l,true);r.stepFor(2);r.p.masks=3;r.p.uberTimer=r.p.invulnTimer=30;
  r.p.prevPos.set(0,state==='air'?3:.1,-7.8);r.p.pos.set(0,state==='air'?3:.1,-8.2);
  r.p.axisF.set(0,0,-1);r.p.axisL.set(-1,0,0);r.p.speed=24;r.p.state=state;
  r.p.freeSkate=state==='ride';r.p.airFromSkate=state==='air';
  if(state==='grind'){r.p.grindRail=r.l.rails[0];r.p.grindVel=-24;r.p.grindT=12;}
  assert.ok(r.p.checkpointTrip(r.l));assert.ok(r.p.isBailing&&r.p.checkpointTripActive);
  assert.equal(r.p.checkpointTripCount,1);assert.equal(r.p.masks,3,'a safe entrance trip does not spend a mask');
  assert.equal(r.p.freeSkate,false);assert.equal(r.p.airFromSkate,false);assert.equal(r.p.state,'air');assert.ok(r.p.vVel>0);
  assert.equal(r.p.grindRail,null);assert.ok(!r.p.checkpointTrip(r.l),'one crossing cannot trip twice');report.trips.push(state);
 }
 r.p.respawn(r.l,true);r.l.consumeBlastBroken();
 for(let i=0;i<kinds.length;i++){const c=r.l.crates[i];assert.ok(r.l.crushCrate(c));assert.ok(!c.alive);report.crateKinds.push(kinds[i]);}
 const payouts=r.l.consumeBlastBroken();assert.ok(payouts.every(c=>!c.metal&&!c.metalBounce&&!c.bang&&!c.nitroBang),'metal/switch demolition never invents crate rewards');
 r.p.respawn(r.l,true,false,{position:new THREE.Vector3(0,.12,-100)});r.l.boulder.course.reset(new THREE.Vector3(0,.12,0));
 const edge=r.l.crates[kinds.length];r.until(()=>!edge.alive,{}, {maxFrames:600,label:'full boulder footprint destroys a partial-overlap crate'});assert.ok(!edge.alive);
 report.partialFootprint=true;
 const traps=[r.l.crushers[0],r.l.pendulums[0],r.l.stones.find(s=>!s.chase)];
 r.p.respawn(r.l,true,false,{position:new THREE.Vector3(0,.12,-200)});r.l.boulder.course.reset(new THREE.Vector3(0,.12,0));
 r.until(()=>traps.every(t=>t.crushed),{}, {maxFrames:900,label:'boulder demolishes physical traps'});
 assert.ok(traps.every(t=>t.box.isEmpty()));
 r.p.respawn(r.l,true);r.l.update(0);assert.ok(traps.every(t=>!t.crushed),'respawn restores demolished hazards');
 report.traps=['crusher and frame','pendulum and gallows','cross-rolling stone'];console.log(JSON.stringify(report));
},{modulePath:'/src/levels/rumblewater-run.ts',levelId:'rumblewater-run',source:()=>fixture,maxFrames:6000});
await writeFile('/private/tmp/rumblewater-polish-mechanics.json',JSON.stringify(report,null,2));
