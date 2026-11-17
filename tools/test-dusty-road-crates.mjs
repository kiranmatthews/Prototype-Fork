import assert from 'node:assert/strict';
import {mkdir,readFile,writeFile} from 'node:fs/promises';
import {withBlockworksRuntime} from './blockworks-runner.mjs';
import {runInputPilot} from './test-puzzle-trilogy.mjs';
import {runThemedBonusJourney,runThemedBonusWrongOrder} from './themed-bonus-pilot.mjs';
const out=process.env.DUSTY_CRATE_OUTPUT??'/tmp/dusty-crates';await mkdir(out,{recursive:true});
if(!process.argv.includes('--main-only'))await withBlockworksRuntime(async r=>{
 r.course=r.sourceModule.DUSTY_ROAD_BONUS_COURSE;r.id='bonus-bryce-canyon';
 const tuning=JSON.stringify(r.TUNING),positive=runInputPilot(r,runThemedBonusJourney);
 assert.equal(positive.state,'finished');assert.equal(positive.cratesBroken,18);assert.equal(positive.deaths,0);assert.equal(positive.gemEarned,true);
 await writeFile(out+'/bonus.json',JSON.stringify(positive,null,2));const wrongOrder=[];
 for(const room of r.course.rooms){
  r.p.respawn(r.l,true,false,{position:new r.THREE.Vector3(room.a+1,.12,0),heading:new r.THREE.Vector3(0,0,-1)});
  r.course={...r.sourceModule.DUSTY_ROAD_BONUS_COURSE,rooms:[room]};const first=r.frame;
  const result=runInputPilot(r,runThemedBonusWrongOrder);wrongOrder.push({pattern:room.pattern,frames:r.frame-first,result:result.result});
 }
 r.p.respawn(r.l,true);r.l.update(0);assert.equal(r.l.crates.length,19);assert.ok(r.l.crates.every(c=>c.alive));assert.ok(r.l.outlinedSurfaces.every(s=>!s.active));assert.equal(r.p.cratesBroken,0);assert.equal(JSON.stringify(r.TUNING),tuning);
 await writeFile(out+'/bonus-negative.json',JSON.stringify({wrongOrder,all19Restored:true,bridgeHidden:true,credit:0},null,2));
 console.log('PASS continuous 18-box Cactus Cache, all three wrong orders and physical retry');
},{modulePath:'/src/levels/dusty-road-bonus.ts',source:m=>m.DUSTY_ROAD_BONUS_LEVEL,levelId:'bonus-bryce-canyon',controlFrame:()=>({x:0,z:-1}),maxFrames:18000});
if(!process.argv.includes('--bonus-only'))await withBlockworksRuntime(async r=>{
 const {p,l,THREE,source,sourceModule:m}=r,report={harvests:[],maxFloorError:0};
 if(process.env.DUSTY_CRATE_BASELINE){
  const before=JSON.parse(await readFile(process.env.DUSTY_CRATE_BASELINE,'utf8'));
  assert.ok(JSON.stringify(source.components.filter(c=>c.t!=='crate'))===JSON.stringify(before.components),'retain every original non-crate component');
  assert.deepEqual(Object.fromEntries(Object.entries(source).filter(([k])=>!['components','groups'].includes(k))),Object.fromEntries(Object.entries(before).filter(([k])=>!['components','groups'].includes(k))));report.geometryExact=report.settingsExact=true;
 }
 assert.equal(l.crates.length,180);assert.equal(l.totalCrates,215);assert.equal(l.bonusCrateTotal,18);assert.equal(l.checkpoints.length,17);assert.equal(l.enemies.length,0);
 const ray=new THREE.Raycaster(),down=new THREE.Vector3(0,-1,0),name=b=>source.components[b.mesh.userData.editorIdx].nm;
 for(const [index,[station]] of m.DESERT_SUPPLY_STATIONS.entries())for(const side of [-1,1]){
  p.respawn(l,true);const prefix=`Section ${Math.floor(index/2)+1} · supply ${index%2+1} · ${side<0?'left':'right'}`,boxes=l.crates.filter(b=>name(b).startsWith(prefix));assert.equal(boxes.length,side<0?2:3);
  const base=Math.min(...boxes.map(b=>b.box.min.y)),lower=boxes.find(b=>b.box.min.y===base);
  for(const dx of [-.556,.556])for(const dz of [-.556,.556]){ray.set(lower.mesh.position.clone().setY(base+2).add(new THREE.Vector3(dx,0,dz)),down);ray.far=4;const h=l.raycastGround(ray)[0];assert.ok(h,prefix+' corner support');report.maxFloorError=Math.max(report.maxFloorError,Math.abs(h.point.y-base));}
  const q=new THREE.Vector3(...m.desertPoint(station));ray.set(q.clone().add(new THREE.Vector3(0,3,0)),down);ray.far=6;const floor=l.raycastGround(ray)[0];assert.ok(floor,prefix+' route approach');
  p.respawn(l,true,false,{position:floor.point.clone().add(new THREE.Vector3(0,.1,0)),heading:new THREE.Vector3(...m.desertPoint(station+2)).sub(q).setY(0).normalize()});r.stepFor(18);const first=r.frame;let held=false;
  r.until(()=>boxes.every(b=>!b.alive),()=>{const spin=p.spinning||!held;held=spin;return{...r.steerToward(lower.mesh.position,{pace:p.spinning?.3:0}),spinHeld:spin};},{maxFrames:900,label:prefix});assert.equal(p.totalDeaths,0);
  report.harvests.push({name:prefix,count:boxes.length,station,fromMainRoute:true,frames:r.frame-first,deaths:0});
  if(side>0&&index%2)console.log(`PASS supplies in checkpoint section ${Math.floor(index/2)+1}`);
 }
 assert.ok(report.maxFloorError<.25,'upright stacks retain close support across the sloping trail');
 p.respawn(l,true);assert.ok(l.crates.every(c=>c.alive));report.reset={crates:l.crates.length,enemies:l.enemies.length};
 await writeFile(out+'/main.json',JSON.stringify(report,null,2));console.log('PASS all 180 Dusty Road supply crates from separately staged main-route approaches, support and full reset');
},{modulePath:'/src/levels/desert-canyon.ts',source:m=>m.DESERT_CANYON_LEVEL,levelId:'bryce-canyon',controlFrame:r=>r.p.raceInputBasis(r.l),maxFrames:70000});
