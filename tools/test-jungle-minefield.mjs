import assert from 'node:assert/strict';
import {withBlockworksRuntime} from './blockworks-runner.mjs';
await withBlockworksRuntime(async r=>{
 const {normalizeCustomLevelData}=await r.server.ssrLoadModule('/src/level.ts');
 const {Minefields,minefieldSafe}=await r.server.ssrLoadModule('/src/minefields.ts');
 const m=r.sourceModule,data=m.JUNGLE_MINEFIELD_LEVEL,l=r.l;
 assert.ok(normalizeCustomLevelData(data));
 assert.equal(data.minefields.length,10);assert.equal(l.checkpoints.length,5);assert.ok(l.minefields.mineCount>3000);
 assert.equal(l.boulder,null);assert.equal(l.stones.length,0);assert.equal(l.minefields.trappedRails.length,4);
 assert.equal(data.components.filter(c=>c.t==='gate').length,1);
 assert.ok(!data.components.some(c=>c.nm?.includes('safe footing')||c.t==='wumpa'));
 assert.deepEqual(l.captureData().minefields,data.minefields);
 const bad=structuredClone(data);bad.minefields[0].s[0]=-1;assert.equal(normalizeCustomLevelData(bad),null);
 bad.minefields=structuredClone(data.minefields);bad.minefields[1].id=1;assert.equal(normalizeCustomLevelData(bad),null);
 const wrongRail=structuredClone(data);wrongRail.components.find(c=>c.minefieldTrap).minefieldTrap=999;assert.equal(normalizeCustomLevelData(wrongRail),null);
 const v=(x,z,y=0)=>new r.THREE.Vector3(x,y,z);
 for(const f of data.minefields){
  const runtime=new Minefields(data.minefields);
  for(const [x,z]of [...(f.spots??[]),...(f.rectangles??[])]){
   assert.equal(runtime.contact(v(x,z),v(x,z),true,null),false,`safe footing field ${f.id}`);
  }
  let unsafe;
  for(let x=-5.5;x<6;x+=.5)if(!minefieldSafe(f,x,f.p[2])){unsafe=v(x,f.p[2]);break;}
  assert.ok(unsafe);assert.equal(runtime.contact(unsafe,unsafe,true,null),true);
  assert.deepEqual(runtime.fields.filter(f=>f.detonated).map(f=>f.data.id),[f.id]);
  assert.equal(runtime.fields.find(s=>s.data.id===f.id).mines.every(p=>p.y<0),true);
  runtime.reset();assert.equal(runtime.fields.some(f=>f.detonated),false);
 }
 // Both a grind catch and ordinary body contact on any X-marked rail trip it.
 for(const {rail,id}of l.minefields.trappedRails)for(const grinding of [true,false]){
  l.reset(true);const at=rail.pointAt(7);
  assert.equal(l.minefields.contact(at,at,false,grinding?rail:null),true);
  assert.deepEqual(l.minefields.fields.filter(f=>f.detonated).map(f=>f.data.id),[id]);
 }
 l.reset(true);
 for(const rail of l.rails.filter(rail=>!l.minefields.trappedRails.some(t=>t.rail===rail))){
  const at=rail.pointAt(7);assert.equal(l.minefields.contact(at,at,false,rail),false);
 }
 // Long-range TNT/Nitro wiring, independent of adjacency and the ordinary safe
 // spin flag. Neighbouring camps and other fields stay untouched.
 for(const c of l.crates.filter(c=>c.tnt||c.nitro)){
  l.reset(true);l.detonate(c,true);
  const triggered=l.minefields.fields.filter(f=>f.detonated);assert.equal(triggered.length,1);
  const f=triggered[0].data;
  assert.equal(l.minefields.contact(v(f.p[0],f.p[2]+f.s[1]/2-.2),v(0,0),false,null),true);
  assert.equal(l.minefields.contact(v(0,f.p[2]+f.s[1]/2+2),v(0,0),false,null),false);
 }
 l.reset(true);r.stepFor(30);assert.ok(r.p.grounded,'supported tunnel spawn');
 const ray=new r.THREE.Raycaster(),down=new r.THREE.Vector3(0,-1,0);
 for(const s of [0,20,50,58,m.GROVE_EXIT_START+1,m.GROVE_EXIT_START+30,m.MINEFIELD_END]){
  const y=m.groveTunnelFloor(s);ray.set(v(0,-s,y+1),down);ray.far=2;
  assert.ok(l.raycastGround(ray).length,`tunnel support ${s}`);
 }
 // Native player death does not permit a protective mask to reveal safe ground.
 const f=data.minefields[1],spot=f.spots[0];r.p.pos.set(spot[0],.01,spot[1]);r.p.prevPos.copy(r.p.pos);r.p.settle(l);r.stepFor(10);
 assert.notEqual(r.p.state,'dead');r.p.pos.set(5,.01,f.p[2]);r.p.prevPos.copy(r.p.pos);r.p.masks=2;r.stepFor(1);assert.equal(r.p.state,'dead');
 l.activateCheckpoint(l.checkpoints[0],0);r.p.respawn(l,false);r.stepFor(20);assert.ok(r.p.grounded);assert.ok(r.p.pos.distanceTo(l.checkpoints[0].spawnPos)<.5);assert.ok(l.minefields.fields.every(f=>!f.detonated));
 // Every checkpoint must restore supported feet, including the ramp-side camp.
 for(const cp of l.checkpoints){
  l.activateCheckpoint(cp,0);r.p.respawn(l,false);r.stepFor(20);
  assert.ok(r.p.grounded,`checkpoint support ${cp.spawnPos.z}`);
  assert.ok(r.p.pos.distanceTo(cp.spawnPos)<.5);
 }
 r.p.pos.y=l.killY-2;r.p.prevPos.copy(r.p.pos);r.p.grounded=false;r.stepFor(1);
 assert.equal(r.p.state,'dead','fall below the tunnel must trigger native pit death');
 r.p.respawn(l,false);r.stepFor(20);assert.ok(r.p.grounded);assert.ok(r.p.pos.distanceTo(l.activeCheckpoint.spawnPos)<.5);
 // Retain the native concealed-Nitro regression from the original Grove.
 // Field pressure is additive; ordinary invisible crates keep their own rules.
 {
  const {Level,setEditorBuild}=await r.server.ssrLoadModule('/src/level.ts');
  const {Player}=await r.server.ssrLoadModule('/src/player.ts');
  const THREE=r.THREE,levels=[];
  try {
 const make=(editor=false)=>{
  setEditorBuild(editor);
  const fixture={v:1,name:'Buried mine fixture',spawn:[0,.1,3],killY:-12,components:[
   {t:'platform',p:[0,-.5,0],s:[20,1,20]},
   {t:'crate',kind:'nitro',invisible:true,p:[0,-.88,0]},
   {t:'crate',kind:'nitro',invisible:true,p:[1.23,-.88,0]},
   {t:'crate',kind:'nitro',p:[-5,0,0]},
   {t:'checkpoint',p:[6,0,0]},{t:'gate',p:[0,0,-8]}]};
  const l=new Level(new THREE.Scene(),{id:'mine-fixture',name:fixture.name,data:fixture});levels.push(l);return l;
 };
 const l=make(),[mine,neighbor,ordinary]=l.crates;
 assert.equal(mine.concealed,true);assert.equal(mine.mesh.visible,false);
 assert.ok(Math.abs(mine.box.max.y-.08)<1e-6,'pressure contact must sit at ground level');
 assert.ok(Math.abs(mine.box.min.y+.88)<1e-6,'floor repair unearthed the mine');
 assert.equal(mine.explosiveBundle,undefined,'hidden mines should not allocate visible dynamite assemblies');
 assert.equal(ordinary.mesh.visible,true);assert.ok(ordinary.explosiveBundle);
 for(let i=0;i<60;i++)l.update(1/60);
 assert.equal(mine.mesh.visible,false);assert.ok(Math.abs(mine.mesh.position.y+.4)<1e-6,'mine bobbed out of burial');
 l.detonate(mine);assert.ok(l.explosions[0].center.y>=0,'burst must emerge above ground');
 for(let i=0;i<20;i++)l.update(1/60);
 assert.equal(neighbor.alive,false,'nearby mines did not chain');
 l.activateCheckpoint(l.checkpoints[0],2);
 l.reset(false);assert.equal(mine.alive,false,'banked explosion restored after checkpoint');
 l.reset(true);assert.equal(mine.alive,true);assert.equal(mine.mesh.visible,false);
 l.activateCheckpoint(l.checkpoints[0],0);l.detonate(mine);l.reset(false);
 assert.equal(mine.alive,true);assert.equal(mine.mesh.visible,false,'soft reset revealed the mine');
 assert.equal(l.captureData().components.filter(c=>c.kind==='nitro'&&c.invisible).length,2);
 const player=new Player(l.scene);player.respawn(l,true);player.pos.set(0,.01,0);player.invulnTimer=0;
 const input={moveX:0,moveY:0,jumpHeld:false,jumpPressed:false,jumpReleased:false,spinHeld:false,spinPressed:false,grindHeld:false,grindPressed:false,grabHeld:false,grabPressed:false,transferHeld:false,transferPressed:false,restartPressed:false,consumeEdges(){}};
 for(let i=0;i<8&&player.state!=='dead';i++){player.step(1/60,input,l);l.update(1/60);}
 assert.equal(player.state,'dead','stepping on the buried contact must cause a blast death');
 const editor=make(true);assert.equal(editor.crates[0].mesh.visible,true,'editor cannot locate buried mines');
 assert.ok(normalizeCustomLevelData(editor.captureData()));setEditorBuild(false);
  } finally {setEditorBuild(false);for(const fixture of levels)fixture.dispose();}
 }
 console.log(`PASS ten fields / ${l.minefields.mineCount} buried charges / four trapped rails / TNT and Nitro field wiring / safe spots / checkpoint restoration / tunnel support / editor validation.`);
},{modulePath:'/src/levels/jungle-minefield.ts',source:m=>m.JUNGLE_MINEFIELD_LEVEL,levelId:'jungle-minefield'});
