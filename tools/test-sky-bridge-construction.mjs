import assert from 'node:assert/strict';
import {withBlockworksRuntime} from './blockworks-runner.mjs';
import {writeFile,mkdir} from 'node:fs/promises';
const out=process.env.SKY_CONSTRUCTION_OUTPUT||'/private/tmp/sky-construction-tests';await mkdir(out,{recursive:true});
const reports=[];
const options={modulePath:'/src/levels/sky-bridge.ts',source:m=>m.SKY_BRIDGE_LEVEL,levelId:'sky',endlessDeaths:true,
 controlFrame:()=>({x:0,z:-1})};
await withBlockworksRuntime(async r=>{
 const {l,source,THREE}=r;
 const boards=l.groundMeshes.filter(m=>m.children.some(c=>c.userData.suspensionDeck));
 assert.equal(boards.length,14,'all four sound, seven rotten, three frozen spans have proper board skins');
 let aged=0,frozen=0,plankCount=0;
 for(const owner of boards){
  const root=owner.children.find(c=>c.userData.suspensionDeck),skin=root.userData.suspensionDeck;
  const c=source.components[owner.userData.editorIdx];
  assert.ok(root.children.some(x=>x.userData.suspensionLashings),'boards lack rope lashings');
  const materials=[];root.traverse(o=>{if(o.isMesh)materials.push(...(Array.isArray(o.material)?o.material:[o.material]));
   assert.ok(!o.userData.woodPathRoles?.some(role=>role==='support-post'||role==='crossbeam'),'suspended boards still have pier legs');});
  const planks=root.children.find(g=>g.userData.woodPathPartRole==='plank');
  const bound=new THREE.Box3().setFromObject(planks);
  const target=c.p[1]+(c.t==='crumble'?0:c.s[1]/2)-(skin.frozen?.1:0);
  assert.ok(Math.abs(bound.max.y-target)<.04,'visual boards and collision differ vertically');
  assert.ok(Math.abs(bound.min.y+.18)<.04,'boards must rest at the lower bearer rope crest');
  assert.ok(bound.min.x<-1.72&&bound.max.x>1.72,'boards do not cross both ropes');
  for(const m of planks.children){plankCount+=m.count;
   if(skin.rotten)assert.ok(['plank-split','plank-chipped'].includes(m.userData.woodPathModel));}
  if(skin.rotten){aged++;assert.ok(materials.some(m=>m.name.startsWith('Rotten bridge boards')));}
  if(skin.frozen){frozen++;assert.ok(materials.some(m=>m.transparent&&m.opacity<1&&m.userData.iceSurface));
   assert.ok(root.children.some(m=>m.userData.frozenBoardGlaze));assert.equal(owner.userData.iceGrip,.12);}
 }
 assert.equal(aged,7);assert.equal(frozen,3);
 const ray=new THREE.Raycaster(),down=new THREE.Vector3(0,-1,0);
 const posts=[],sockets=[];l.root.traverse(o=>{if(o.name==='Rope anchor post')posts.push(o);if(o.name==='Rope post socket on landing')sockets.push(o);});
 assert.equal(posts.length,32);assert.equal(sockets.length,32);
 for(const post of posts){
   const bounds=new THREE.Box3().setFromObject(post);
   assert.ok(Math.abs(bounds.min.y+.05)<.001,'post base floats above its landing');
 }
 assert.equal(source.components.filter(c=>c.nm==='Lower rope eye fixed into masonry').length,32);

 for(const rope of l.ropes)for(const p of [rope.rest[0],rope.rest.at(-1)]){
  ray.set(p.clone().setY(3),down);const ground=ray.intersectObjects(l.groundMeshes,false).find(h=>h.face.normal.y>.5);
  assert.ok(ground&&Math.abs(ground.point.y)<.01,'a hand-rope post is floating off its masonry anchor');
 }
 const deep=source.components.filter(c=>c.nm?.startsWith('Continuous anchor shaft'));
 assert.equal(deep.filter(c=>c.p[1]<=-100).length,9);
 assert.equal(source.components.filter(c=>c.dkind==='coastarch').length,3);
 assert.equal(l.enemies.length,4);assert.equal(new Set(l.enemies.map(e=>e.kind)).size,4);
 for(const e of l.enemies)if(e.kind!=='floater')for(let i=0;i<=24;i++){
  const x=e.x0+(e.x1-e.x0)*i/24,z=e.group.position.z;
  ray.set(new THREE.Vector3(x,3,z),down);const hit=ray.intersectObjects(l.groundMeshes,false)[0];
  assert.ok(hit&&Math.abs(hit.point.y-e.baseY)<.1,'enemy patrol has unsupported feet');
 }
 assert.equal(l.crates.filter(c=>c.tnt).length,4);assert.equal(l.crates.filter(c=>c.nitro).length,4);
 const templeWalls=source.components.filter(c=>c.t==='wall'&&c.invisible).map(c=>new THREE.Box3().setFromCenterAndSize(
  new THREE.Vector3(c.p[0],c.p[1]+c.s[1]/2,c.p[2]),new THREE.Vector3(...c.s)));
 for(const crate of l.crates)for(const wall of templeWalls)
  assert.ok(!crate.box.clone().expandByScalar(.1).intersectsBox(wall),'crate visually intersects a temple leg');
 const bonus=l.groundMeshes.find(m=>m.name==='bonus platform deck');
 if(bonus)for(const wall of templeWalls)assert.ok(!new THREE.Box3().setFromObject(bonus).intersectsBox(wall),'temple leg intersects the bonus landing');
 for(const rope of l.ropes)for(const p of [rope.rest[0],rope.rest.at(-1)])for(const wall of templeWalls)
  assert.ok(!new THREE.Box3().setFromCenterAndSize(p.clone().setY(.85),new THREE.Vector3(.6,1.8,.6)).intersectsBox(wall),'rope post intersects a temple leg');

 for(const cp of l.checkpoints)for(const c of l.crates.filter(c=>c.tnt||c.nitro))
  assert.ok(cp.spawnPos.distanceTo(c.mesh.position)>4.7,'an explosive crowds checkpoint recovery');
 reports.push({name:'construction',pass:true,boards:boards.length,plankCount,aged,frozen,ropeSpans:l.ropes.length,deepShafts:9,enemies:4,tnt:4,nitro:4});
},options);

// One uninterrupted input-driven crossing. Anticipate each low-grip lane
// before jumping onto it; spin only near an enemy with no explosive in reach.
await withBlockworksRuntime(async r=>{
 const {p,l,source}=r,supports=source.components.filter(c=>(c.t==='platform'||c.t==='crumble')&&c.p[0]===0);
 let hold=0,rest=0,jumps=0;const ice=new Set(),falls=new Set();
 for(let i=0;i<5000&&p.state!=='finished';i++){
  const z=p.pos.z;
  const lane=z<-106&&z>-132?.95:((z<-12&&z>-36)||(z<-177&&z>-198))?-.95:0;
  const dx=lane-p.pos.x;
  const lateral=p.groundHit?.slippy?Math.max(-.22,Math.min(.22,dx*.2-p.walkVelocity.x*.18)):Math.max(-.65,Math.min(.65,dx*1.1));
  const ground=supports.find(c=>Math.abs(z-c.p[2])<=c.s[2]/2+.12);
  const distance=ground?z-(ground.p[2]-ground.s[2]/2):null;
  if(hold>0)hold--;else if(rest>0)rest--;else if(p.grounded&&distance!==null&&distance<1.8&&z>-229){hold=5;rest=12;jumps++;}
  const enemy=l.enemies.some(e=>e.alive&&Math.hypot(e.group.position.x-p.pos.x,e.group.position.z-z)<3.2);
  const bomb=l.crates.some(c=>c.alive&&(c.tnt||c.nitro)&&c.mesh.position.distanceTo(p.pos)<3.0);
  const spin=enemy&&!bomb||l.checkpoints.some(c=>!c.active&&Math.abs(c.spawnPos.z-z)<2);
  r.tick({moveY:1,moveX:lateral,jumpHeld:hold>0,spinHeld:spin});
  if(p.groundHit?.slippy)ice.add(p.groundHit.mesh.userData.editorIdx);
  if(p.groundHit?.crumbleId!==undefined)falls.add(p.groundHit.crumbleId);
  if(p.totalDeaths||p.isBailing)throw new Error('route failed '+JSON.stringify(r.snapshot()));
 }
 assert.equal(p.state,'finished');assert.equal(p.totalDeaths,0);assert.equal(ice.size,3);assert.equal(falls.size,7);
 assert.ok(l.checkpoints.every(c=>c.active));
 const result={name:'continuous-route',pass:true,frames:r.frame,jumps,ice:ice.size,falling:falls.size,cratesBroken:p.cratesBroken,
  enemyDefeats:l.enemies.filter(e=>!e.alive).length,final:r.snapshot()};reports.push(result);
 await writeFile(out+'/route.json',JSON.stringify({result,trace:r.trace},null,2));
},options);

await withBlockworksRuntime(async r=>{
 const {p,l}=r;
 r.charge(Math.ceil(r.TUNING.skateHoldTime*60)+3,{moveY:1});
 r.until(()=>p.pos.z<2,{moveY:1,jumpHeld:true},{maxFrames:120,label:'build board speed on the departure island'});
 const charged={speed:p.speed,board:p.freeSkate};assert.equal(charged.board,true);
 r.releaseJump({moveY:1,grindHeld:true});
 r.until(()=>p.state==='grind',{moveY:1,grindHeld:true},{maxFrames:100,label:'charged ollie onto first hand rope'});
 const caught=l.ropes.find(rope=>rope.rail===p.grindRail);assert.ok(caught);
 const balance=()=>({moveX:Math.max(-1,Math.min(1,-p.balance*8-p.balanceVel*.8)),grindHeld:true});
 r.until(()=>p.pos.z<-34,balance,{maxFrames:400,label:'clear the ice and Nitro by grinding'});
 r.charge(8,balance);r.releaseJump({spinHeld:true});
 r.until(()=>p.grounded,{moveY:1,spinHeld:true},{maxFrames:140,label:'land at the temple refuge'});
 assert.equal(p.totalDeaths,0);assert.equal(p.isBailing,false);assert.ok(p.pos.z<-36&&p.pos.z>-44.5);
 const result={name:'charged-ollie-rope-bypass',pass:true,charged,frames:r.frame,final:r.snapshot()};reports.push(result);
 await writeFile(out+'/skate.json',JSON.stringify({result,trace:r.trace},null,2));
},{...options,start:[-2.65,.12,6.8]});

await withBlockworksRuntime(async r=>{
 const {p,l}=r,tnt=l.crates.find(c=>c.tnt&&Math.abs(c.mesh.position.z+109)<.01);
 r.stepFor(8);r.charge(26);r.releaseJump({moveY:.5});
 r.until(()=>tnt.fuse!==undefined,()=>r.steerToward([-1.85,.96,-109],{pace:.55}),{maxFrames:150,label:'stomp the shrine TNT'});
 const lit=tnt.fuse;
 r.until(()=>p.pos.x>1.6,{moveX:1},{maxFrames:160,label:'escape the lit TNT'});
 r.until(()=>!tnt.alive,{},{maxFrames:250,label:'TNT countdown and blast'});
 r.stepFor(90); // Include the full expanding blast and settle, not only fuse expiry.
 assert.ok(lit>2.5);assert.equal(p.totalDeaths,0);assert.equal(p.isBailing,false);
 const result={name:'TNT-stomp-and-escape',pass:true,fuse:lit,frames:r.frame,final:r.snapshot()};reports.push(result);
 await writeFile(out+'/tnt.json',JSON.stringify({result,trace:r.trace},null,2));
},{...options,start:[-1.85,.12,-106.65]});

await withBlockworksRuntime(async r=>{
 const {p,l}=r,nitro=l.crates.find(c=>c.nitro&&Math.abs(c.mesh.position.z+27)<.01);
 r.until(()=>p.totalDeaths>0,{moveY:1},{maxFrames:500,allowDeath:true,label:'Nitro contact remains lethal'});
 assert.equal(nitro.alive,false);reports.push({name:'Nitro-contact',pass:true,frames:r.frame,deaths:p.totalDeaths});
},{...options,start:[1.15,.2,-24]});

await withBlockworksRuntime(async r=>{
 const {p,l}=r,turtle=l.enemies.find(e=>e.kind==='turtle');
 r.stepFor(10);r.charge(26);r.releaseJump({moveY:.5});
 r.until(()=>!turtle.alive,()=>r.steerToward(turtle.group.position,{pace:.8}),{maxFrames:170,label:'stomp the observatory Mossback'});
 assert.equal(p.totalDeaths,0);reports.push({name:'Mossback-stomp',pass:true,frames:r.frame,state:p.state});
},{...options,start:[2.5,.12,-230.5]});
console.log(JSON.stringify(reports,null,2));await writeFile(out+'/report.json',JSON.stringify(reports,null,2));
