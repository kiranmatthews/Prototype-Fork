import assert from 'node:assert/strict';
import {writeFile} from 'node:fs/promises';
import {withBlockworksRuntime} from './blockworks-runner.mjs';
await withBlockworksRuntime(async r=>{
 const {SkateRace}=await r.server.ssrLoadModule('/src/race/runtime.ts'),{GolfCartPhysics}=await r.server.ssrLoadModule('/src/golf-cart/physics.ts');
 const layout=await r.server.ssrLoadModule('/src/levels/cart-stadium-layout.ts'),race=new SkateRace(r.scene,r.p,false,()=>true);race.attach(r.l,'coconut-cart-rally');race.start('time-trial',0);const rally=race.carts,ground=(x,z)=>rally.ground(x,z),slow=[];
 assert.ok(rally.crowd.count>30000);assert.equal(rally.crowd.sections.length,100);
 const geometry=rally.crowd.sections[0].geometry,mat=rally.crowd.sections[0].material;
 assert.ok(rally.crowd.sections.every(m=>m.geometry===geometry&&m.material===mat&&m.frustumCulled));
 const matrixVersions=rally.crowd.sections.map(m=>m.instanceMatrix.version);rally.crowd.update(55);assert.deepEqual(rally.crowd.sections.map(m=>m.instanceMatrix.version),matrixVersions,'Cheering does not upload instance transforms');
 for(const jump of layout.CART_RALLY_JUMPS){
  for(let s=jump.start-8;s<=jump.end+44;s+=1)for(const u of [-13,0,13]){const p=layout.cartRallyPoint(s,u);assert.ok(ground(p[0],p[2]).supported,`Continuous dirt support at ${s},${u}`);}
  const start=jump.start-5,p=layout.cartRallyPoint(start),f=layout.cartRallyFrame(start),world=new GolfCartPhysics(ground,[{x:p[0],z:p[2],yaw:Math.atan2(-f.dx,1)}],[],{scale:1.25,topSpeed:8,engine:23,maxLaunchVelocity:17,airRecoveryDelay:6,gravity:rally.fleet.physics.gravity,stableLandings:rally.fleet.physics.stableLandings});let maxHeight=0;
  for(let i=0;i<7200&&-world.carts[0].z<jump.end+17;i++)world.advance(1/120,w=>{const c=w.carts[0],at=-c.z,target=layout.cartRallyPoint(at+5),angle=Math.atan2(-(target[0]-c.x),-(target[2]-c.z))-c.yaw;w.inputs[0]={throttle:1,steer:Math.max(-1,Math.min(1,Math.atan2(Math.sin(angle),Math.cos(angle))*2)),brake:0,handbrake:false};maxHeight=Math.max(maxHeight,c.y-ground(c.x,c.z).height);});
  const c=world.carts[0];assert.ok(-c.z>=jump.end+17,`Slow kart drives out of dirt double ${jump.start}`);assert.equal(c.respawns,0);assert.ok(c.health>0);slow.push({jump:jump.start,z:c.z,respawns:c.respawns,maxHeight});
 }
 // Dirt drag must penalize a missed jump, while an airborne kart retains its
 // momentum above the same soil. Compare identical states and controls.
 const coast=(drag,air)=>{const w=new GolfCartPhysics(()=>({height:0,safe:true,supported:true,grip:1,drag}),[{x:0,z:0,yaw:0}]);Object.assign(w.carts[0],{vz:-20,speed:20,y:air?20:0,grounded:!air,vy:air?10:0});for(let i=0;i<60;i++)w.advance(1/120);return Math.abs(w.carts[0].vz);};
 const dry=coast(.08,false),mud=coast(14,false),dryAir=coast(.08,true),mudAir=coast(14,true);assert.ok(dry-mud>6);assert.equal(dryAir,mudAir);
 race.start('race',0);race.phase='running';race.carts.drive=()=>({moveX:0,moveY:0});
 for(const cp of r.l.checkpoints){const at=race.course.project(cp.spawnPos).s,heading=race.course.tangent(at);r.p.resetRacePosition(r.l,cp.spawnPos.clone().addScaledVector(heading,-8),heading);for(let i=0;i<90&&!cp.active;i++)race.step(r.dt,{moveX:0,moveY:0,jumpHeld:true});assert.ok(cp.active,'Each checkpoint is supported and reachable by driving');assert.ok(race.riders[0].boxes.has(cp));}
 let disposed=0;race.carts.crowd.sections[0].geometry.addEventListener('dispose',()=>disposed++);race.carts.crowd.dispose();assert.equal(disposed,1);assert.equal(race.carts.crowd.root.children.length,0);
 const report={passed:true,spectators:rally.crowd.count,sections:100,sharedGeometry:true,gpuOnlyCheering:true,slowMisses:slow,drag:{dry,mud,dryAir,mudAir},disposed};await writeFile(process.env.CART_STADIUM_REPORT??'/private/tmp/cart-stadium.json',JSON.stringify(report,null,2)+'\n');console.log('PASS stadium',JSON.stringify({spectators:report.spectators,slowMisses:slow.length,drag:report.drag}));
},{modulePath:'/src/levels/coconut-cart-rally.ts',source:m=>m.COCONUT_CART_RALLY_LEVEL,levelId:'coconut-cart-rally'});
