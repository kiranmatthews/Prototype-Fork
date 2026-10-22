import assert from 'node:assert/strict';
import {mkdir,writeFile} from 'node:fs/promises';
import {withBlockworksRuntime} from './blockworks-runner.mjs';
import {createMallPilot} from './mall-pilot.mjs';
await mkdir('/private/tmp/mall-recreation',{recursive:true});
await withBlockworksRuntime(async r=>{
 const {p,l,THREE,source,sourceModule:m}=r;
 const {normalizeCustomLevelData}=await r.server.ssrLoadModule('/src/level.ts');
 assert.ok(normalizeCustomLevelData(JSON.parse(JSON.stringify(source))),'Mall must survive the editor security/size contract');
 for(const yaw of [0,90]){
  const spec={v:1,name:'Doorway fixture',spawn:[0,.1,8],killY:-10,components:[{t:'platform',p:[0,-.5,0],s:[30,1,30]},{t:'gate',p:[0,0,-8],w:14,yaw,invisible:true}]};
  const fixture=new r.Level(new THREE.Scene(),{id:'mall-doorway-test',name:spec.name,data:spec});
  const size=fixture.finishGlow.getSize(new THREE.Vector3());assert.ok(Math.abs((yaw?size.z:size.x)-14)<.001);assert.ok(Math.abs((yaw?size.x:size.z)-.8)<.001);assert.equal(size.y,4);fixture.dispose();
  spec.components[1].invisible=false;
  const visible=new r.Level(new THREE.Scene(),{id:'mall-visible-gate-test',name:spec.name,data:spec});
  assert.ok(visible.finishGlow.getSize(new THREE.Vector3()).x<5,'Visible warp pads keep contact-only behaviour even with legacy width metadata');visible.dispose();
  spec.components[1].invisible=true;
  delete spec.components[1].w;
  const ordinary=new r.Level(new THREE.Scene(),{id:'mall-default-gate-test',name:spec.name,data:spec});
  assert.ok(ordinary.finishGlow.getSize(new THREE.Vector3()).x<5,'Ordinary warp gate must retain its original narrow trigger');ordinary.dispose();
 }
 const report={components:source.components.length,rails:l.rails.length,checkpoints:[],verts:[],blueBanks:[],spawn:null,recovery:null};
 r.stepFor(5);report.spawn={position:p.pos.toArray(),grounded:p.grounded};assert.ok(p.grounded);
 for(const [i,c]of l.checkpoints.entries()){
  const ray=new THREE.Raycaster(c.spawnPos.clone().add(new THREE.Vector3(0,.3,0)),new THREE.Vector3(0,-1,0),0,1);
  const hits=ray.intersectObjects(l.groundMeshes,false);assert.ok(hits.length,`Checkpoint ${i} has no supporting ground`);
  assert.ok(Math.abs(c.spawnPos.y-m.MALL_CHECKPOINTS[i].p[1]-.1)<.05,`Checkpoint ${i} snapped to an unrelated storey`);
  report.checkpoints.push({index:i,position:c.spawnPos.toArray(),surface:hits[0].point.y});
 }
 for(const c of source.components.filter(c=>c.t==='vertramp'))for(const side of c.vkind==='half'?[-1,1]:[1]){
  const half=c.vkind==='half',base=half?m.mallPoint(384):c.p;
  const a=(c.yaw??0)*Math.PI/180,d=new THREE.Vector3(Math.cos(a)*side,0,-Math.sin(a)*side),origin=new THREE.Vector3(...base).addScaledVector(d,half?0:-6);origin.y+=.1;
  p.respawn(l,true,false,{position:origin,heading:d});
  // Initial fixture heading, before input starts. Respawn's optional facing
  // is presentation-only; all subsequent motion belongs to normal input.
  p.axisF.copy(d);p.axisL.set(-d.z,0,d.x);
  let peak=base[1],transition=0,air=0,landed=false,entered=false,bail=false,popped=false,railJump=false;
  for(let i=0;i<400;i++){
   if(p.grounded&&p.groundHit?.vert&&p.rideNormal.y<.5)popped=true;
   let jumpHeld=!popped;
   if(half&&!railJump&&(p.pos.x-base[0])*side>1){jumpHeld=false;railJump=true;}
   r.tick({moveY:p.grounded?1:0,jumpHeld});peak=Math.max(peak,p.pos.y);bail||=p.isBailing;
   if(p.groundHit?.vert){transition++;entered=true;}
   if(entered&&!p.grounded)air++;
   if(entered&&i>100&&p.grounded&&p.pos.y<base[1]+.3){landed=true;break;}
   if(p.isBailing||p.state==='dead')break;
  }
  report.verts.push({name:c.nm,side,position:base,peak,transition,air,landed,bail,end:p.pos.toArray()});
 }
 for(const side of [-1,1]){
  const origin=new THREE.Vector3(...m.mallPoint(330,side*3.8,.1)),d=new THREE.Vector3(0,0,-1);
  p.respawn(l,true,false,{position:origin,heading:d});p.axisF.copy(d);p.axisL.set(-d.z,0,d.x);
  let peak=0,bankFrames=0,landed=false,bail=false;
  for(let i=0;i<180;i++){
   r.tick({moveY:p.grounded?1:0,jumpHeld:true});peak=Math.max(peak,p.pos.y);bail||=p.isBailing;
   if(p.groundHit?.name==='Blue plaza bank trough')bankFrames++;
   if(bankFrames&&p.grounded&&p.pos.z<m.mallPoint(359)[2]&&p.pos.y<.3){landed=true;break;}
   if(bail||p.state==='dead')break;
  }
  report.blueBanks.push({side,peak,bankFrames,landed,bail,end:p.pos.toArray()});
 }
 // Controlled below-world fixture after banking a real checkpoint. This
 // verifies recovery independently of the continuous no-death route pilots.
 p.respawn(l,true);const pilot=createMallPilot(m),cp=l.checkpoints[0];
 for(let i=0;i<300&&!cp.active;i++){r.tick(pilot.sample(p,l));pilot.observe(p,l);}
 await writeFile('/private/tmp/mall-recreation/surfaces.json',JSON.stringify(report,null,2));
 assert.ok(cp.active,`Checkpoint was not activated by normal skating/spin input: ${JSON.stringify({position:p.pos.toArray(),state:p.state})}`);
 p.pos.set(0,-11.6,-150);p.grounded=false;p.state='air';p.vVel=-4;
 const before=p.totalDeaths;let died=false,returned=false;
 for(let i=0;i<600;i++){r.tick({});died||=p.state==='dead';if(died&&p.grounded&&p.state==='ride'){returned=true;break;}}
 report.recovery={died,returned,deaths:p.totalDeaths-before,checkpoint:l.checkpoints.indexOf(l.activeCheckpoint),position:p.pos.toArray(),distance:p.pos.distanceTo(cp.spawnPos)};
 await writeFile('/private/tmp/mall-recreation/surfaces.json',JSON.stringify(report,null,2));console.log(JSON.stringify(report,null,2));
 assert.ok(report.verts.every(v=>v.transition>0&&v.peak>v.position[1]+1.5&&!v.bail&&v.landed),'Every vert must climb and return to supported ground without a bail');
 assert.ok(report.blueBanks.every(v=>v.bankFrames>0&&v.peak>1.7&&!v.bail&&v.landed),'Both blue banks must carry the skater to their supported outside landings');
 assert.ok(died&&returned);assert.equal(p.totalDeaths-before,1);assert.equal(l.activeCheckpoint,cp);assert.ok(p.pos.distanceTo(cp.spawnPos)<.5);
},{modulePath:'/src/levels/mall.ts',source:m=>m.MALL_LEVEL,levelId:'mall',endlessDeaths:true,maxFrames:8000,controlFrame:r=>r.p.axisF});
