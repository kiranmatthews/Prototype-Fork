import assert from 'node:assert/strict';
import {readFile,writeFile} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import {withBlockworksRuntime,normalizeGameInput} from './blockworks-runner.mjs';
await withBlockworksRuntime(async e=>{
 const {SkateRace}=await e.server.ssrLoadModule('/src/race/runtime.ts');
 const {GolfCartPhysics}=await e.server.ssrLoadModule('/src/golf-cart/physics.ts');
 const layout=await e.server.ssrLoadModule('/src/levels/cart-stadium-layout.ts');
 const {CART_RALLY_LENGTH:length,CART_RALLY_TUNNEL:tunnel,CART_RALLY_MEGA_JUMP:mega}=layout;
 assert.equal(length,4640);assert.equal(e.l.grindRails.length,0);
 const prior=JSON.parse(await readFile('tools/fixtures/rally-pre-extension.json','utf8')),points=[];
 for(let s=prior.start;s<=prior.end;s+=prior.step)for(const u of prior.lanes)points.push(layout.rallySurfacePoint(s,u));
 assert.equal(createHash('sha256').update(JSON.stringify(points)).digest('hex'),prior.surfaceSha256,'Every sampled original road, mound, bank and existing corner stays exactly authored');
 const race=new SkateRace(e.scene,e.p,false,()=>true);race.attach(e.l,'coconut-cart-rally');race.start('time-trial',42);
 const c=race.carts,w=c.fleet.physics,report={passed:false,length,actualLength:race.course.length,cases:[]};let previous={};
 const tick=sample=>{const input=normalizeGameInput(sample,previous);previous=input;race.step(1/60,input);};
 for(let n=0;n<480;n++)tick({});
 const spawn=(s,u=0)=>{const p=layout.rallySurfacePoint(s,u),f=layout.cartRallyFrame(s);return {x:p[0],z:p[2],yaw:-Math.atan(f.dx)};};
 for(let s=tunnel.entry;s<=tunnel.exit;s+=4)for(const u of [-10,0,10]){
  const p=layout.rallySurfacePoint(s,u),g=c.ground(p[0],p[2]);assert.ok(g.supported&&Math.abs(g.height-p[1])<.18,'Underground floor supports carts; roof never becomes their ground');
 }
 assert.ok(layout.stadiumBase(tunnel.entry+40)-layout.dirtHeight(tunnel.entry+40)>11.9);
 assert.ok(e.l.builtFromData.components.some(p=>p.nm==='Earth over stadium tunnel'&&p.solid===false));
 const sections=[...layout.CART_RALLY_CORNER_PATCHES.filter(p=>p.start>2320).map(p=>({name:'sharp corner',start:p.start-35,end:p.end+28})),{name:'tunnel and huge jump',start:tunnel.descent-20,end:mega.end+95}];
 for(const section of sections){
  Object.assign(w.spawns[0],spawn(section.start));w.reset(0);const k=w.carts[0];k.vx=-Math.sin(k.yaw)*35;k.vz=-Math.cos(k.yaw)*35;k.speed=35;c.sync();
  const r=race.riders[0];r.progress=r.previousProgress=r.anchorProgress=race.course.project(e.p.pos).s;r.anchor.copy(e.p.pos);r.finish=null;previous={};
  const flights=[];let frames=0,maxGap=0,air=0,longestAir=0,flightStart=null,flightDistance=0;
  for(;frames<60*65&&-k.z<section.end;frames++){
   tick(c.drive(0));maxGap=Math.max(maxGap,k.y-c.ground(k.x,k.z).height);
   if(!k.grounded){air+=1/60;flightStart??={x:k.x,z:k.z};}
   else{longestAir=Math.max(longestAir,air);if(flightStart)flights.push({start:-flightStart.z,end:-k.z,seconds:air});air=0;if(flightStart){flightDistance=Math.max(flightDistance,Math.hypot(k.x-flightStart.x,k.z-flightStart.z));flightStart=null;}}
  }
  assert.ok(-k.z>=section.end,section.name+' remains traversable by the real race driver');assert.equal(k.respawns,0);assert.equal(k.rolls,0,'Corners and jump landings do not topple a lone kart');assert.equal(r.falls,0);
  console.log(JSON.stringify({section,frames,maxGap,longestAir,flightDistance,flights,rolls:k.rolls,health:k.health}));
  if(section.name.startsWith('tunnel')){assert.ok(maxGap>9&&longestAir>1.1&&flightDistance>40,'The tunnel exit delivers a substantially larger jump');assert.equal(flights.filter(f=>f.start>mega.start-15).length,1,'The huge jump landing stays planted with no second bounce');}
  report.cases.push({...section,seconds:frames/60,maxGap,longestAir,flightDistance,rolls:k.rolls,hits:k.hits,health:k.health});
 }
 // A missed launch remains a continuous driveable dirt trough at low speed.
 const slow=new GolfCartPhysics((x,z)=>c.ground(x,z),[spawn(mega.start-70)],w.obstacles,{scale:w.scale,engine:w.engine,gravity:w.gravity,stableLandings:w.stableLandings,maxLaunchVelocity:w.maxLaunchVelocity,airRecoveryDelay:w.airRecoveryDelay,topSpeed:8,speedLimit:10}),k=slow.carts[0];
 for(let frame=0;frame<120*65&&-k.z<mega.end+35;frame++)slow.advance(1/120,world=>{const target=layout.cartRallyPoint(-k.z+5),angle=Math.atan2(-(target[0]-k.x),-(target[2]-k.z))-k.yaw;world.inputs[0]={throttle:1,steer:Math.max(-1,Math.min(1,Math.atan2(Math.sin(angle),Math.cos(angle))*2)),brake:0,handbrake:false};});
 assert.ok(-k.z>mega.end+35);assert.equal(k.respawns,0);assert.equal(k.rolls,0);report.slowMiss={z:k.z,health:k.health,rolls:k.rolls};
 // Rescue deliveries choose daylight near a portal, never pass through a roof.
 for(const s of [tunnel.entry+35,tunnel.exit-35]){const progress=race.course.project(new e.THREE.Vector3(...layout.cartRallyPoint(s))).s,bay=c.loanerBay(progress,1,true);assert.ok(bay);assert.ok(-bay.bay.z<tunnel.entry||-bay.bay.z>tunnel.exit);}
 race.attach({skateRace:null},'flats');report.passed=true;
 await writeFile(process.env.RALLY_EXTENSION_REPORT??'/private/tmp/rally-extension.json',JSON.stringify(report,null,2)+'\n');console.log(JSON.stringify(report));
},{modulePath:'/src/levels/coconut-cart-rally.ts',source:m=>m.COCONUT_CART_RALLY_LEVEL,levelId:'coconut-cart-rally'});
