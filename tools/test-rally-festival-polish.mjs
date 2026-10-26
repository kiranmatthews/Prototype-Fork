import assert from 'node:assert/strict';
import {writeFile} from 'node:fs/promises';
import {withBlockworksRuntime} from './blockworks-runner.mjs';
await withBlockworksRuntime(async r=>{
 const {SkateRace}=await r.server.ssrLoadModule('/src/race/runtime.ts');
 const {GolfCartPhysics}=await r.server.ssrLoadModule('/src/golf-cart/physics.ts');
 const layout=await r.server.ssrLoadModule('/src/levels/cart-stadium-layout.ts');
 const race=new SkateRace(r.scene,r.p,false,()=>true);race.attach(r.l,'coconut-cart-rally');race.start('time-trial',0);
 const rally=race.carts,c=rally.fleet.physics.carts[0],flat=()=>({height:0,safe:true,supported:true,grip:1,drag:0});
 const prior=new GolfCartPhysics(flat,[{x:0,z:0,yaw:0}],[],{damageCapacity:16}),tough=new GolfCartPhysics(flat,[{x:0,z:0,yaw:0}],[],{damageCapacity:16*.7});
 for(let i=0;i<8;i++)for(const w of [prior,tough]){w.carts[0].cooldown=0;w.damage(0,12,0,-1);}
 const oldLoss=1-prior.carts[0].health,newLoss=1-tough.carts[0].health;assert.ok(Math.abs(newLoss*.7-oldLoss)<1e-10,'Collision capacity is exactly 70% of the published durability');
 const weaponLoss=[];
 for(const power of [.14,.24,.4]){
  Object.assign(c,{health:1,cooldown:0});rally.hit(0,undefined,power);
  const loss=1-c.health,expected=(power*.5+(12-1.6)*.042/16)/.7;
  assert.ok(Math.abs(loss-expected)<1e-10,'Weapon and impact durability both reduced by 30%');weaponLoss.push({power,loss,previous:expected*.7});
 }
 Object.assign(c,{health:1,cooldown:0,speed:24,grounded:true});
 for(let i=0;i<3600;i++)rally.mud.update(1/60,[c],[0],0,r.p.pos);
 assert.ok(rally.fleet.mudAmounts[0]>.2,'Driving accumulates visible mud');
 const deposited=rally.fleet.mudAmounts[0];for(let i=0;i<120;i++)rally.mud.update(1/60,[c],[-1],-1,r.p.pos);
 assert.equal(rally.fleet.mudAmounts[0],deposited,'Abandoning a kart preserves dirt without creating spray');
 rally.fleet.present(0);let wearMeshes=0,decals=0;
 rally.fleet.root.traverse(o=>{if(o.isInstancedMesh&&o.count>0&&o.geometry.getAttribute('rallyWear')){wearMeshes++;assert.ok(o.geometry.getAttribute('rallyWear').getX(0)>0);}if(o.name.startsWith('Fleet-')&&o.name.includes('sponsor')){decals++;assert.ok(o.material.map?.isTexture);const uv=o.geometry.getAttribute('uv');assert.ok(uv&&uv.count>=4,'Decal geometry retains its PNG UVs');assert.ok(uv.array.some(v=>v>0),'Decal UVs span the sponsor atlas');}});
 assert.ok(wearMeshes>10&&decals===3,'Wear and PNG decals use the fleet batches');
 const wearBuffers=[];rally.fleet.root.traverse(o=>{const a=o.geometry?.getAttribute('rallyWear');if(a)wearBuffers.push({a,version:a.version});});
 rally.fleet.present(0);assert.ok(wearBuffers.every(({a,version})=>a.version===version),'Stationary unchanged carts do not upload wear again');
 rally.fleet.mudAmounts[0]=.62;rally.fleet.present(0);assert.ok(wearBuffers.some(({a,version})=>a.version>version),'New mud still reaches the visible instances');
 let min=Infinity,max=-Infinity,changed=0,maxGradient=0,support=0;
 for(let s=38;s<layout.CART_RALLY_LENGTH-45;s+=7)for(const u of [-12,-8,-4,0,4,8,12]){
  const h=layout.rallyMicroHeight(s,u);min=Math.min(min,h);max=Math.max(max,h);if(Math.abs(h)>.02)changed++;
  maxGradient=Math.max(maxGradient,Math.abs(h-layout.rallyMicroHeight(s+.1,u))/.1);
  const p=layout.rallySurfacePoint(s,u);assert.ok(rally.ground(p[0],p[2]).supported);support++;
 }
 assert.ok(max-min>.35&&max-min<1&&changed>500,'Microterrain adds varied sub-metre relief');assert.ok(maxGradient<.2,'Microbumps never become sudden launch lips');
 for(const j of layout.CART_RALLY_JUMPS)for(const s of [j.start,j.end,j.end+12])for(const u of [-13,0,13])assert.deepEqual(layout.rallySurfacePoint(s,u),layout.cartRallyPoint(s,u),'Keep the exact full-height jump profiles at their lips and landing crests');
 const fastJumps=[];
 for(const j of layout.CART_RALLY_JUMPS){
  const p=layout.cartRallyPoint(j.start-42),f=layout.cartRallyFrame(j.start-42),yaw=Math.atan2(-f.dx,1);
  const w=new GolfCartPhysics((x,z)=>rally.ground(x,z),[{x:p[0],z:p[2],yaw}],[],{scale:1.25,topSpeed:38,engine:23,speedLimit:44,maxLaunchVelocity:9,gravity:24,stableLandings:true,damageCapacity:16*.7,airRecoveryDelay:6});
  const v=w.carts[0];v.vx=-Math.sin(yaw)*28;v.vz=-Math.cos(yaw)*28;
  for(let i=0;i<1440&&-v.z<j.end+38;i++)w.advance(1/120,world=>{const t=layout.cartRallyPoint(-v.z+7),angle=Math.atan2(-(t[0]-v.x),-(t[2]-v.z))-v.yaw;world.inputs[0]={throttle:1,steer:Math.max(-1,Math.min(1,Math.atan2(Math.sin(angle),Math.cos(angle))*2)),brake:0,handbrake:false};});
  assert.equal(v.rolls,0,'Fast landings on the actual detailed course stay upright');assert.equal(v.respawns,0);assert.ok(-v.z>j.end+35,'Fast kart clears the full dirt double');assert.ok(v.health>0);
  fastJumps.push({start:j.start,flights:v.airborneCount,rolls:v.rolls,respawns:v.respawns,z:v.z});
 }
 const report={passed:true,durability:{oldLoss,newLoss,weaponLoss},terrain:{min,max,changed,maxGradient,supportedSamples:support,jumpsPreserved:12,fastJumps},wear:{deposited,wearMeshes,decals},spectators:rally.crowd.count};
 await writeFile(process.env.RALLY_POLISH_REPORT??'/private/tmp/rally-polish-mechanics.json',JSON.stringify(report,null,2));console.log('PASS rally festival polish',JSON.stringify(report));race.attach({skateRace:null},'flats');
},{modulePath:'/src/levels/coconut-cart-rally.ts',source:m=>m.COCONUT_CART_RALLY_LEVEL,levelId:'coconut-cart-rally'});
