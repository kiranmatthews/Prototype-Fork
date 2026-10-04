import assert from 'node:assert/strict';
import {writeFile} from 'node:fs/promises';
import {withBlockworksRuntime} from './blockworks-runner.mjs';

const options={modulePath:'/src/levels/ghost-train.ts',levelId:'ghost-train',
  source:m=>m.GHOST_TRAIN_LEVEL,controlFrame:r=>r.p.courseInputDirection(r.l)??{x:r.p.camDir.x,z:r.p.camDir.z}};
const reports=[];
await withBlockworksRuntime(async r=>{
  const {normalizeCustomLevelData}=await r.server.ssrLoadModule('/src/level.ts');
  assert.ok(normalizeCustomLevelData(JSON.parse(JSON.stringify(r.source))), 'source level normalizes');
  assert.equal(r.source.components.filter(c=>c.t==='gate').length,1);
  assert.ok(r.source.components.filter(c=>c.t==='checkpoint').length>=12);
  assert.ok(r.l.movers.length>=8,'two moving-cart relays');
  assert.ok(r.l.pendulums.length>=8,'swinging axe galleries');
  assert.ok(r.l.enemies.some(e=>e.group.userData.ghostSkin==='ghostknight'));
  r.stepFor(30);
  assert.ok(r.p.grounded&&!r.p.isBailing,'supported station spawn');
  const ray=new r.THREE.Raycaster(),down=new r.THREE.Vector3(0,-1,0);
  const checkSupport=(point,name)=>{
    ray.set(new r.THREE.Vector3(point[0],point[1]+2,point[2]),down);ray.far=4;
    const hit=ray.intersectObjects(r.l.groundMeshes,false)[0];
    assert.ok(hit&&Math.abs(hit.point.y-point[1])<.15,`${name}: supported feet ${point}`);
  };
  for(const c of r.source.components.filter(c=>c.t==='checkpoint'))checkSupport(c.p,c.nm);
  for(let frame=0;frame<480;frame++){
    r.l.update(r.dt);r.l.root.updateMatrixWorld(true);
    if(frame%60===0)for(const e of r.l.enemies){
      if(e.kind==='hopper')continue;
      checkSupport([e.group.position.x,e.baseY,e.group.position.z],e.group.userData.ghostSkin??e.kind);
    }
  }
  reports.push({test:'source contracts, spawn, checkpoints, enemy patrol support',movers:r.l.movers.length,
    axes:r.l.pendulums.length,enemies:r.l.enemies.length,checkpoints:r.l.checkpoints.length});
},options);

// Each cart is sampled from an initial placement before simulation. A standing
// rider must follow the actual production moving-ground delta for a whole cycle.
const {createServer}=await import('vite');const server=await createServer({appType:'custom',logLevel:'silent',server:{middlewareMode:true}});
let source;try{source=(await server.ssrLoadModule('/src/levels/ghost-train.ts')).GHOST_TRAIN_LEVEL;}finally{await server.close();}
const carts=source.components.filter(c=>c.t==='mover'&&c.dkind==='ghostcart');
// The middle car stays over the trench through its entire motion cycle.
// End cars deliberately overlap the stationary boarding/disembark platforms.
for(const c of [carts[1],carts[Math.floor(carts.length/2)+1]]){
  const start=[c.p[0],c.p[1]+.05,c.p[2]+(c.travelSign??1)*Math.sin(c.phase??0)*(c.amp??0)];
  await withBlockworksRuntime(r=>{
    r.stepFor(30);const mover=r.l.movers.find(m=>Math.abs(m.base.z-c.p[2])<.01);
    assert.ok(mover,'cart fixture exists');
    const offset=r.p.pos.clone().sub(mover.mesh.position);let carried=0;
    for(let i=0;i<600;i++){
      r.tick({});assert.ok(r.p.grounded&&!r.p.isBailing,'cart keeps standing rider supported');
      const next=r.p.pos.clone().sub(mover.mesh.position);
      assert.ok(Math.abs(next.z-offset.z)<.15,'rider follows moving cart');carried+=mover.lastDelta.length();
    }
    assert.ok(carried>3,'cart actually travelled on rails');
    reports.push({test:'moving cart rider carry',name:c.nm,carried:Number(carried.toFixed(2)),deaths:r.p.totalDeaths});
  },{...options,start});
}
const gate=source.components.find(c=>c.t==='gate');
const checkpoint=source.components.find(c=>c.t==='checkpoint');
await withBlockworksRuntime(r=>{
  r.stepFor(20);
  r.walkTo([checkpoint.p[0]-1.3,checkpoint.p[1],checkpoint.p[2]],{pace:.35,arrivalTolerance:.3});
  r.tick({spinHeld:true});r.stepFor(24);
  assert.ok(r.l.checkpoints[0].active,'Reach and break actual checkpoint');
  assert.ok(r.l.currentSpawn.distanceTo(r.l.checkpoints[0].spawnPos)<.01,'checkpoint banks its respawn point');
  reports.push({test:'input-only checkpoint contact and banked respawn',active:r.l.checkpoints[0].active});
},{...options,start:[checkpoint.p[0],checkpoint.p[1]+.1,checkpoint.p[2]+4]});
const crypt=source.components.find(c=>c.t==='pit'&&/Crypt|crypt/.test(c.nm??''));
assert.ok(crypt,'cartless crypt has a real death pit');
await withBlockworksRuntime(r=>{
  r.until(()=>r.p.totalDeaths===1,{}, {maxFrames:600,allowDeath:true,label:'Fall into broken-track pit'});
  r.until(()=>r.p.grounded&&!r.p.isBailing&&r.p.state!=='dead',{}, {maxFrames:600,allowDeath:true,label:'Respawn after pit'});
  assert.ok(r.p.pos.distanceTo(r.l.spawnPos)<1,'pit restores supported source spawn');
  reports.push({test:'broken rail pit death and supported respawn',deaths:r.p.totalDeaths,grounded:r.p.grounded});
},{...options,start:[crypt.p[0]+3,.2,crypt.p[2]-20],endlessDeaths:true});
await withBlockworksRuntime(r=>{
  r.stepFor(15);r.until(()=>r.p.state==='finished',{moveY:.7},{maxFrames:480,label:'Cross finish gate'});
  assert.equal(r.p.totalDeaths,0);reports.push({test:'reachable production finish gate',state:r.p.state});
},{...options,start:[gate.p[0],gate.p[1]+.1,gate.p[2]+4]});
await writeFile('/private/tmp/ghost-train-physics.json',JSON.stringify(reports,null,2));
console.log(JSON.stringify(reports,null,2));
