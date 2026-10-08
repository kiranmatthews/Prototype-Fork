import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {withSkateRuntime,makeInput} from './jungle-cup-harness.mjs';

await withSkateRuntime(async({THREE,server,Level,Player,CONST})=>{
  const {normalizeCustomLevelData,isOriginalSkyBridge,findLevel,setUserLevels}=await server.ssrLoadModule('/src/level.ts');
  const {ICE_SURFACE,FALL_AWAY_SURFACE,SLIPPERY_COMPONENT_TYPES,icePlatform,fallAwayPlatform}=await server.ssrLoadModule('/src/surfaceBehavior.ts');
  const {SKY_BRIDGE_LEVEL}=await server.ssrLoadModule('/src/levels/sky-bridge.ts');
  const data=component=>({v:1,name:'Surface contract',spawn:[0,.1,0],killY:-30,
    components:[component,{t:'gate',p:[0,0,-90]}]});
  const solid=(t,extra={})=>({t,p:[0,-.5,0],s:[80,1,80],w:80,len:80,
    ...(t==='mesh'?{p:[0,0,0],s:[1,1,1],vertices:[-40,0,40,40,0,40,40,0,-40,-40,0,-40],indices:[0,1,2,0,2,3]}:{}),
    ...(t==='ramp'?{p:[0,0,0],rise:2}:{}),
    ...(t==='terrain'?{p:[0,0,40],len:80,amp:0,berms:false}:{}),
    ...(t==='vertramp'?{p:[0,0,0],vkind:'half',rise:2,arc:45,vert:false}:{}),
    ...(t==='mover'?{p:[0,0,0],amp:0}:{}),
    ...(t==='crumble'?{p:[0,0,0]}:{}),...extra});
  for(const t of SLIPPERY_COMPONENT_TYPES){
    const authored=normalizeCustomLevelData(data(solid(t,{slip:true})));
    assert.ok(authored,`${t}: supported ice primitive must validate`);
    const level=new Level(new THREE.Scene(),{id:'ice-contract',name:authored.name,data:authored});
    const disposed=new Map();
    const retired=new Set(level.replacedSurfaceMaterials.flatMap(m=>[m,...Object.values(m).filter(v=>v?.isTexture)]));
    for(const resource of retired)if(!resource.userData.shared){
      disposed.set(resource,0);resource.addEventListener('dispose',()=>disposed.set(resource,disposed.get(resource)+1));
    }
    try{
      const ice=level.groundMeshes.filter(m=>m.userData.slippy);
      assert.ok(ice.length,`${t}: no slippery ground`);
      for(const mesh of ice){
        assert.equal(mesh.userData.iceGrip,ICE_SURFACE.grip,`${t}: default grip differs`);
        assert.ok(mesh.material.userData.iceSurface,`${t}: missing common ice appearance`);
        assert.equal(mesh.userData.edgeGrinding,false,`${t}: a hidden edge rail bypasses ice`);
      }
      const captured=level.captureData();
      assert.ok(normalizeCustomLevelData(captured),`${t}: editor round trip rejected ice`);
    }finally{level.dispose();}
    assert.ok([...disposed.values()].every(n=>n===1),`${t}: replaced materials/textures leaked or were disposed twice`);
  }
  for(const t of ['platform','mesh']){
    const level=new Level(new THREE.Scene(),{id:'painted-ice',name:'Paint only',data:data(solid(t,{tex:'ice'}))});
    try{
      assert.ok(level.groundMeshes[0].material.userData.iceSurface);
      assert.equal(level.groundMeshes[0].userData.slippy,undefined,'texture silently changed traction');
    }finally{level.dispose();}
  }
  for(const patch of [{t:'decor',slip:true},{t:'mesh',slip:true,solid:false},{t:'platform',iceGrip:.1},
    {t:'platform',slip:true,iceGrip:0},{t:'crumble',shake:-1},{t:'crumble',speed:0}])
    assert.equal(normalizeCustomLevelData(data(solid(patch.t,patch))),null,JSON.stringify(patch));

  // Untagged old ice must behave exactly like an explicitly authored default.
  const coast=[];
  for(const patch of [{slip:true},{slip:true,iceGrip:ICE_SURFACE.grip},{}]){
    const level=new Level(new THREE.Scene(),{id:'ice-contract',name:'Ice',data:data(solid('platform',patch))});
    try{
      const player=new Player(level.scene);player.enterLevel('ice-contract');player.respawn(level,true);
      player.step(CONST.fixedStep,makeInput(),level);
      player.walkVelocity.set(4,0,-6);player.speed=6;
      for(let i=0;i<60;i++){player.step(CONST.fixedStep,makeInput(),level);level.update(CONST.fixedStep);}
      coast.push(player.walkVelocity.toArray());
    }finally{level.dispose();}
  }
  assert.deepEqual(coast[0],coast[1],'old slippery data bypassed the standard vector inertia');
  assert.ok(Math.hypot(...coast[0])>4,'default ice must visibly carry approach momentum');
  assert.ok(Math.hypot(...coast[2])<.01,'dry ground was retuned');

  const authored=fallAwayPlatform([0,2,0],[6,1.25,7],{yaw:37});
  const level=new Level(new THREE.Scene(),{id:'fall-contract',name:'Fall',data:data(authored)});
  try{
    const c=level.crumbles[0];level.root.updateMatrixWorld(true);
    assert.equal(c.shakeTime,FALL_AWAY_SURFACE.delay);
    assert.equal(c.fallSpeed,FALL_AWAY_SURFACE.acceleration);
    assert.equal(c.base.y+ c.mesh.geometry.parameters.height/2,2,'top-centre contract');
    const decoration=c.mesh.children.find(x=>x.name.includes('warning bindings'));
    assert.ok(decoration,'warning dressing must be owned by the falling support');
    level.touchCrumble(0);level.update(.1);level.touchCrumble(0);
    assert.equal(c.t,.1,'continued contact must not restart the timer');
    for(let i=0;i<35;i++)level.update(1/60);
    assert.equal(c.state,'shake','warning ended prematurely');
    for(let i=0;i<20;i++)level.update(1/60);
    assert.equal(c.state,'fall');
    for(let i=0;i<160;i++)level.update(1/60);
    assert.equal(c.state,'gone');assert.equal(c.mesh.visible,false);
    level.reset(false);level.root.updateMatrixWorld(true);
    assert.equal(c.state,'idle');assert.equal(c.mesh.visible,true);
    assert.deepEqual(c.mesh.position.toArray(),c.base.toArray());
    assert.equal(c.mesh.rotation.y,THREE.MathUtils.degToRad(37));
    assert.equal(decoration.material.color.getHex(),0x815027,'warning glow survived respawn');
  }finally{level.dispose();}

  assert.ok(normalizeCustomLevelData(SKY_BRIDGE_LEVEL),'Sky Bridge data must normalize');
  const supports=SKY_BRIDGE_LEVEL.components.filter(c=>(c.t==='platform'||c.t==='crumble')&&c.p[0]===0).sort((a,b)=>b.p[2]-a.p[2]);
  for(let i=1;i<supports.length;i++){
    const gap=supports[i-1].p[2]-supports[i-1].s[2]/2-(supports[i].p[2]+supports[i].s[2]/2);
    assert.ok(gap<=3.01&&gap>=1,`unreadable/unreachable gap ${gap} at ${supports[i].p[2]}`);
  }
  assert.ok(supports.filter(c=>c.t==='crumble').every(c=>c.s[2]>=6&&c.shake>=.95));
  assert.ok(supports.filter(c=>c.slip).every(c=>c.s[2]>=14&&c.iceGrip===ICE_SURFACE.grip));
  assert.equal(SKY_BRIDGE_LEVEL.components.filter(c=>c.t==='gate').length,1);
  assert.equal(SKY_BRIDGE_LEVEL.components.filter(c=>c.t==='checkpoint').length,3);
  const sky=new Level(new THREE.Scene(),{id:'sky',name:'Sky Bridge'});
  try{
    const ray=new THREE.Raycaster(new THREE.Vector3(0,3,5),new THREE.Vector3(0,-1,0));
    sky.root.updateMatrixWorld(true);
    assert.ok(ray.intersectObjects(sky.groundMeshes,false).some(h=>Math.abs(h.point.y)<.001),'spawn unsupported');
    for(const checkpoint of SKY_BRIDGE_LEVEL.components.filter(c=>c.t==='checkpoint')){
      ray.ray.origin.set(checkpoint.p[0]-1.05,3,checkpoint.p[2]);
      assert.ok(ray.intersectObjects(sky.groundMeshes,false).some(h=>Math.abs(h.point.y)<.001),'checkpoint recovery unsupported');
    }
  }finally{sky.dispose();}
  for(const file of ['sky-bridge-legacy.json','sky-bridge-placement-legacy.json']){
  const previous=JSON.parse(await readFile(new URL('./fixtures/'+file,import.meta.url),'utf8'));
  assert.equal(isOriginalSkyBridge(previous),true);
  setUserLevels([previous]);assert.equal(findLevel('sky').data.components.length,SKY_BRIDGE_LEVEL.components.length,'pristine cached course did not upgrade');
  const edited=structuredClone(previous);edited.data.components[0].p[0]+=.1;
  setUserLevels([edited]);assert.equal(findLevel('sky').data.components[0].p[0],.1,'local edit overwritten');
  setUserLevels([]);
  }
  const pack=JSON.parse(await readFile(new URL('../public/levels.json',import.meta.url),'utf8'));
  assert.equal(JSON.stringify(pack.levels.find(e=>e.id==='sky').data),JSON.stringify(SKY_BRIDGE_LEVEL),'published snapshot drift');
  console.log('PASS shared ice on seven ground primitives, default vector inertia, dry grip, fall lifecycle, reset, supported route and precise cache upgrade');
  console.log(JSON.stringify({coast,platforms:supports.length,fallAway:sky.crumbles.length}));
});
