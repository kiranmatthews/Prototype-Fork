import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {withSkateRuntime,makeInput} from '../jungle-cup-harness.mjs';
import {normalizeGameInput} from '../blockworks-runner.mjs';
import {runInputPilot} from '../test-puzzle-trilogy.mjs';
import {runThemedBonusJourney} from '../themed-bonus-pilot.mjs';

const plants=[
  {t:'decor',dkind:'canyonsaguaro',p:[-12,0,0],s:[5.36,8,2.41],yaw:23,scenerySolid:true},
  {t:'decor',dkind:'canyonpricklypear',p:[0,0,0],s:[6.2,4,2.16],yaw:-29,scenerySolid:true},
  {t:'decor',dkind:'canyonbarrel',p:[12,0,0],s:[3.32,3,2.42],yaw:41,scenerySolid:true},
];
const data={v:1,name:'Dusty Road contact fixture',spawn:[0,.1,12],killY:-30,desertHeat:[],components:[
  {t:'platform',p:[0,-.5,0],s:[100,1,80]},...plants,
  {t:'decor',dkind:'deserthoodoocap',p:[25,0,0],s:[10,24,8],yaw:37,scenerySolid:true},
  {t:'decor',dkind:'canyondrygrass',p:[-12,0,14],s:[3,2,3],scenerySolid:false},
  {t:'mesh',p:[-25,0,0],vertices:[0,0,0,0,-1,-4,0,.25,-4,0,1.25,0],indices:[0,1,2,0,2,3],solidSides:true,invisible:true,edgeGrinding:false,nm:'Race fence contact'},
  {t:'gate',p:[0,0,-30]},
]};
await withSkateRuntime(async({level,player:p,THREE,server,step,CONST,Player})=>{
  const {normalizeCustomLevelData,Level}=await server.ssrLoadModule('/src/level.ts');
  const {inDesertValleyDrop,hasDesertContacts}=await server.ssrLoadModule('/src/desertContacts.ts');
  const {DESERT_CANYON_LEVEL:main,desertPoint,DESERT_CHECKPOINTS,DESERT_YELLOW_GEM,DESERT_BONUS_ENTRANCE,DESERT_LENGTH}=await server.ssrLoadModule('/src/levels/desert-canyon.ts');
  const {DUSTY_ROAD_BONUS_LEVEL:bonus,DUSTY_ROAD_BONUS_COURSE:course}=await server.ssrLoadModule('/src/levels/dusty-road-bonus.ts');
  const {isDesertCactus}=await server.ssrLoadModule('/src/desertPlants.ts');
  assert.ok(normalizeCustomLevelData(data));
  // Materialize the source recipe before checking its serialized editor data.
  const mainComponents=main.components;assert.ok(mainComponents.length);
  assert.ok(normalizeCustomLevelData(main));assert.ok(normalizeCustomLevelData(bonus));
  for(const source of [main,bonus]){
    assert.deepEqual(source.desertHeat,[]);
    assert.ok(source.components.filter(c=>isDesertCactus(c.dkind)).every(c=>c.scenerySolid===true));
    assert.ok(source.components.filter(c=>c.dkind?.startsWith('deserthoodoo')).every(c=>c.scenerySolid===true));
    assert.ok(source.components.filter(c=>c.dkind==='canyondrygrass'||c.dkind==='canyondryweed').every(c=>c.scenerySolid===false));
  }
  for(const id of ['jungle','factory-fuss','warproom','bonus-jungle'])assert.equal(hasDesertContacts(id),false);
  assert.ok(hasDesertContacts('bonus:bryce-canyon'));
  for(let s=0;s<=DESERT_LENGTH;s+=5)for(const u of [-5,0,5,10]){
    const [x,y,z]=desertPoint(s,u);assert.equal(inDesertValleyDrop({x,y,z}),false,`safe riding corridor at ${s},${u}`);
  }
  for(const point of [DESERT_YELLOW_GEM,DESERT_BONUS_ENTRANCE]){
    assert.equal(inDesertValleyDrop(new THREE.Vector3(...point)),false,'gem/bonus must remain reachable');
  }
  await level.prepareJungleAssets();level.root.updateMatrixWorld(true);level.prepareWorldSolids();
  const surfaces=[...level.worldSolids.surfaces];
  assert.deepEqual(level.jungleAssetDiagnostics.errors,[],'fixture must load the real native art');
  for(const plant of plants)assert.ok(surfaces.some(s=>s.mesh.userData.jungleAsset===plant.dkind),'actual plant triangles must bind');
  assert.ok(!surfaces.some(s=>s.mesh.userData.jungleAsset==='canyondrygrass'),'dry grass stays soft');
  const results=[];
  for(const plant of plants){
    const surface=surfaces.find(s=>s.mesh.userData.jungleAsset===plant.dkind),x=plant.p[0];
    const start=new THREE.Vector3(x,.05,surface.bounds.max.z+3);
    p.respawn(level,true,false,{position:start,heading:new THREE.Vector3(0,0,-1)});
    p.maskLevel=3;p.invulnTimer=100;p.uberTimer=100;
    let frames=0;for(;frames<180&&p.state!=='dead';frames++)step(makeInput({moveY:1}));
    assert.equal(p.state,'dead',`${plant.dkind}: walking contact must kill even during protection`);
    assert.ok(p.pos.z>surface.bounds.min.z,'cactus sweep stops at the contact instead of passing through');
    results.push({kind:plant.dkind,walkingFrames:frames,contact:p.pos.toArray()});
    // A whole cactus crossed in one collision tick still stops and kills.
    for(const state of ['air','grind']){
      p.respawn(level,true,false,{position:start,heading:new THREE.Vector3(0,0,-1)});
      p.state=state;p.grounded=false;p.prevPos.copy(start);p.pos.z=surface.bounds.min.z-3;
      p.collide(level);assert.equal(p.state,'dead',`${plant.dkind}: swept ${state} contact`);
    }
    // The authored arm/upper surface participates too, not just a trunk box.
    const high=new THREE.Vector3(x,surface.bounds.max.y+3,plant.p[2]);
    p.respawn(level,true,false,{position:high,heading:new THREE.Vector3(0,0,-1)});
    p.state='air';p.grounded=false;p.prevPos.copy(high);p.pos.y=.1;p.collide(level);
    assert.equal(p.state,'dead',`${plant.dkind}: landing on top must kill`);
  }
  const rock=surfaces.find(s=>s.mesh.userData.jungleAsset==='deserthoodoocap');
  const from=new THREE.Vector3(25,.05,rock.bounds.max.z+3),to=new THREE.Vector3(25,.05,rock.bounds.min.z-3),normal=new THREE.Vector3();
  assert.ok(level.desertContacts.resolve(from,to,{x:.3,y:.75,z:.3},normal,true),'rotated tower stops a swept crossing');
  assert.ok(to.z>rock.bounds.min.z&&normal.z>0,'tower contact stays outside its front face');
  const ray=new THREE.Raycaster(new THREE.Vector3(25,40,0),new THREE.Vector3(0,-1,0),0,50);
  assert.ok(level.raycastGround(ray).some(h=>h.point.y>10),'large rock cap has actual top support');
  for(const at of [-.1,-1.99,-3.9]){
    const from=new THREE.Vector3(-27,.05,at),to=new THREE.Vector3(-23,.05,at);
    assert.ok(level.meshSideCollisions.resolve(from,to,{x:.3,y:.75,z:.3},normal),'sloping fence panel has no post-to-post gaps');
    assert.ok(to.x<-24.5,'swept fence crossing stopped');
  }
  for(const s of DESERT_CHECKPOINTS.slice(13)){
    const [x,y,z]=desertPoint(s,45);p.respawn(level,true,false,{position:new THREE.Vector3(x,y-8,z),heading:new THREE.Vector3(0,0,-1)});
    p.collide(level);assert.equal(p.state,'dead','fall below the right valley rim is fatal');
  }
  const other=new Level(new THREE.Scene(),{id:'factory-fuss',name:data.name,data});
  assert.equal(other.desertContacts,null,'other levels do not acquire canyon collision/hazards');other.dispose();
  // Run the complete bonus with its real pedestal, tower and cactus meshes
  // loaded. A scenery-only mock cannot catch an obstacle across a shelf.
  const scene=new THREE.Scene(),cache=new Level(scene,{id:'bonus-bryce-canyon',name:bonus.name,data:bonus});
  try{
    await cache.prepareJungleAssets();scene.updateMatrixWorld(true);cache.prepareWorldSolids();
    assert.deepEqual(cache.jungleAssetDiagnostics.errors,[]);
    const rider=new Player(scene);rider.enterLevel('bonus-bryce-canyon');rider.rawInput=makeInput();rider.respawn(cache,true);
    let frame=0,last=makeInput();
    const r={id:'bonus-bryce-canyon',course,source:bonus,p:rider,l:cache,dt:CONST.fixedStep,get frame(){return frame;},tick(sample){
      const input=normalizeGameInput(sample,last);last={...input};
      rider.step(CONST.fixedStep,input,cache);cache.update(CONST.fixedStep);
      rider.flushLevelCrateRewards(cache);rider.commitRenderStep(cache);frame++;
      assert.ok(frame<40000,'native bonus pilot must finish');
    }};
    const report=runInputPilot(r,runThemedBonusJourney);
    assert.equal(report.state,'finished');assert.equal(report.deaths,0);assert.ok(report.gemEarned);
    console.log(JSON.stringify({nativeBonus:true,frames:report.frames,crates:report.cratesBroken,state:report.state}));
  }finally{cache.dispose();}
  console.log(JSON.stringify({cacti:results,airAndGrindSweeps:true,topContact:true,towerCollisionAndTop:true,continuousFence:true,rightValleyFatal:true,mainRouteBonusAndGemSafe:true,scoped:true}));
},{levelEntry:{id:'bryce-canyon',name:data.name,data},prepareRuntime(){
  globalThis.ProgressEvent??=class{constructor(type,data){this.type=type;Object.assign(this,data);}};
  globalThis.createImageBitmap=async()=>({width:1024,height:1024,close(){}});globalThis.self=globalThis;
  navigator.userAgent='Headless canyon contacts';
  const nativeFetch=globalThis.fetch;
  const NativeRequest=globalThis.Request;
  globalThis.Request=class extends NativeRequest{constructor(input,init){super(typeof input==='string'?new URL(input,'http://headless.invalid'):input,init);}};
  globalThis.fetch=async input=>{
    const url=typeof input==='string'?input:input.url;if(url.startsWith('blob:'))return nativeFetch(input);
    const path=new URL(typeof input==='string'?input:input.url,'http://headless.invalid').pathname;
    return path.startsWith('/desert-canyon/')&&path.endsWith('.glb')?new Response(await readFile(new URL('../../public'+path,import.meta.url))):new Response('',{status:404});
  };
}});
