import assert from 'node:assert/strict';
import {writeFile} from 'node:fs/promises';
import {withSkateRuntime,makeInput} from './jungle-cup-harness.mjs';

await withSkateRuntime(async({THREE,server,level,player,step})=>{
  const {MOTU_HEATS,motuHeatLook}=await server.ssrLoadModule('/src/motuLighting.ts');
  const {validAtmosphere}=await server.ssrLoadModule('/src/levelAtmosphere.ts');
  const {JUNGLE_CUP_LEVEL:data}=await server.ssrLoadModule('/src/levels/jungle-cup.ts');
  const {MOTU_STANDS}=await server.ssrLoadModule('/src/levels/motu-beach-art.ts');
  assert.equal(MOTU_STANDS.length,8);
  assert.deepEqual(new Set(MOTU_STANDS.map(s=>s.yaw)),new Set([-90,90,180,0]),'spectators on all four sides');
  assert.equal(data.components.filter(c=>c.dkind==='baytrunk').length,85);
  assert.equal(level.motuBeachDiagnostics.spectators,1351);
  const lights=[];level.root.traverse(o=>{if(o.name==='Motu / warm floodlight illumination')lights.push(o);});
  const ids=lights.map(o=>o.uuid);assert.equal(lights.length,4);
  const sceneIds=[];level.root.traverse(o=>sceneIds.push(o.uuid));
  const camera=new THREE.PerspectiveCamera(),modes=[];
  for(let cycle=0;cycle<12;cycle++)for(const [i,look]of MOTU_HEATS.entries()){
    assert.ok(validAtmosphere(look.lighting));level.setMotuHeat(i+1);
    camera.position.set(25-cycle*3,5,-80+cycle*7);level.updateSceneryView(camera);
    const d=level.motuBeachDiagnostics;
    assert.equal(d.lighting.mode,look.name);assert.equal(d.lighting.moon,i===2);assert.equal(d.lighting.flare,i!==2);
    assert.ok(new THREE.Vector3(...d.sunDirection).distanceTo(new THREE.Vector3(...look.sunOffset).normalize())<1e-10);
    assert.deepEqual(lights.map(o=>o.uuid),ids);
    for(const light of lights){assert.ok(light.isSpotLight&&!light.castShadow);assert.equal(light.intensity,look.lampPower*3200);}
    if(cycle===0)modes.push(d.lighting);
  }
  const after=[];level.root.traverse(o=>after.push(o.uuid));assert.deepEqual(after,sceneIds,'heat cycling creates no new scene objects');
  assert.equal(motuHeatLook(NaN).name,'daylight');assert.equal(motuHeatLook(-1).name,'daylight');assert.equal(motuHeatLook(99).name,'moonlight');

  // Real ocean instances preserve the user's baseline through repeated heats,
  // including an editor change while the night tint is applied.
  const water=level.water,keys=['shallow','deep','peak','intersection','specular','shadow'];
  const baseline=Object.fromEntries(keys.map(key=>[key,{...water.params[key]}]));
  for(let cycle=0;cycle<12;cycle++)for(const [i,look]of MOTU_HEATS.entries()){
    level.setMotuHeat(i+1);level.applyMotuOceanLook();
    const applied=Object.fromEntries(keys.map(key=>[key,water.params[key]]));
    for(let frame=0;frame<20;frame++)level.applyMotuOceanLook();
    for(const key of keys)assert.equal(water.params[key],applied[key],'unchanged frames reuse colour objects');
    if(i===0)for(const key of keys)assert.deepEqual(water.params[key],baseline[key],'daylight restores the exact source colour');
    assert.ok(water.oceanMaterial.uniforms.uMainLightDirection.value.distanceTo(new THREE.Vector3(...look.sunOffset).normalize())<1e-10);
  }
  const edited={r:.16,g:.61,b:.72,a:.8};water.params.shallow={...edited};level.applyMotuOceanLook();
  level.setMotuHeat(1);level.applyMotuOceanLook();assert.deepEqual(water.params.shallow,edited,'new editor colour survives the heat tint');

  // Cache lifetime and exact panorama projection matter for matching the sea
  // horizon. Pixel appearance is covered by the full-render browser captures.
  const {MotuSky}=await server.ssrLoadModule('/src/motuSky.ts');
  const sky=new MotuSky(),source=new THREE.Texture({width:1774,height:519});
  source.colorSpace=THREE.SRGBColorSpace;source.repeat.set(-1,1);source.offset.set(.25,0);source.anisotropy=8;
  const variants=MOTU_HEATS.map(look=>sky.texture(source,look));
  assert.equal(variants[0],source);assert.equal(sky.count,2);
  let disposed=0,sourceDisposed=0;source.addEventListener('dispose',()=>sourceDisposed++);
  for(const texture of variants.slice(1)){
    assert.equal(texture.image.width,1774);assert.equal(texture.image.height,519);
    assert.ok(texture.repeat.equals(source.repeat)&&texture.offset.equals(source.offset));
    assert.equal(texture.colorSpace,source.colorSpace);assert.equal(texture.anisotropy,8);
    texture.addEventListener('dispose',()=>disposed++);
  }
  for(let cycle=0;cycle<12;cycle++)for(const [i,look]of MOTU_HEATS.entries())assert.equal(sky.texture(source,look),variants[i]);
  const replacement=new THREE.Texture({width:512,height:256});
  const fresh=sky.texture(replacement,MOTU_HEATS[1]);assert.equal(disposed,2);assert.equal(sky.count,1);
  fresh.addEventListener('dispose',()=>disposed++);sky.dispose();assert.equal(disposed,3);assert.equal(sourceDisposed,0);assert.equal(sky.count,0);

  const {UnityBloomPass}=await server.ssrLoadModule('/src/unityBloom.ts');
  const {visualTreatmentSettings:settings}=await server.ssrLoadModule('/src/visual-treatment/settings.ts');
  const before=JSON.stringify(settings.value),bloom=new UnityBloomPass(1280,720);
  for(const look of MOTU_HEATS){bloom.setLevelSettings(look.bloom);assert.equal(bloom.diagnostics.source,'level');assert.equal(bloom.diagnostics.intensity,look.bloom.intensity);assert.ok(bloom.diagnostics.active);}
  assert.equal(JSON.stringify(settings.value),before,'authored bloom never mutates saved user settings');
  bloom.setPresentationEnabled(false);assert.equal(bloom.diagnostics.active,false,'lite/nopost gate wins');
  bloom.setPresentationEnabled(true);assert.equal(bloom.diagnostics.active,true);
  settings.patch({enabled:true,bloom:{intensity:.63}},{persist:false});
  assert.equal(bloom.diagnostics.intensity,MOTU_HEATS[2].bloom.intensity);
  bloom.setLevelSettings(null);assert.equal(bloom.diagnostics.source,'user');assert.equal(bloom.diagnostics.intensity,.63,'exit restores the latest user edit');
  settings.patch(JSON.parse(before),{persist:false});bloom.dispose();assert.equal(bloom.diagnostics.active,false);

  const names=['west promenade rail','east return rail','south festival flatbar','palm crescent rail','east surf kink rail'],catches=[];
  for(const name of names){
    const index=data.components.findIndex(c=>c.nm===`Motu / ${name}`),rail=level.rails.find(r=>r.object.userData.editorIdx===index);
    assert.ok(rail,`built ${name}`);
    const point=rail.pointAt(rail.totalLength*.35),heading=rail.tangentAt(rail.totalLength*.35);
    player.respawn(level,true,true,{position:point.clone().add(new THREE.Vector3(0,.18,0)),heading});
    player.axisF.copy(heading);player.axisL.set(heading.z,0,-heading.x);player.freeSkate=true;player.speed=12;
    player.pos.copy(point).add(new THREE.Vector3(0,.18,0));player.prevPos.copy(player.pos);player.grounded=false;player.state='air';player.vVel=-1;player.balanceBoostT=10;
    step(makeInput({grindHeld:true,grindPressed:true}));assert.equal(player.state,'grind',`${name}: catch`);assert.equal(player.grindRail,rail,`${name}: correct rail`);
    for(let frame=0;frame<45;frame++){step(makeInput({grindHeld:true}));assert.ok(!player.isBailing&&player.pos.y>=0,`${name}: stable grind`);}
    catches.push({name,length:rail.totalLength,position:player.pos.toArray()});
  }
  const report={passed:true,stands:8,spectators:1351,palms:85,modes,heatCycles:36,stableLightObjects:4,newShadowMaps:0,
    oceanHeatCycles:36,oceanEditorRestored:true,skyCacheCycles:36,skyOwnedTexturesDisposed:disposed,bloomRestoresUserSettings:true,rails:catches};
  await writeFile('/private/tmp/motu-lighting-validation.json',JSON.stringify(report,null,2));console.log(JSON.stringify(report));
});
