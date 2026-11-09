import assert from 'node:assert/strict';
import {createServer} from 'vite';
import * as THREE from 'three';
const server=await createServer({appType:'custom',logLevel:'silent',server:{middlewareMode:true,hmr:false,ws:false}});
try{
  const {FlameHeatDistortion,FLAME_HEAT_LIMIT}=await server.ssrLoadModule('/src/flameHeatDistortion.ts');
  const {FlameHeatSamples,attachFlameHeat,getFlameHeatSource}=await server.ssrLoadModule('/src/flameHeatSource.ts');
  const samples=object=>{const out=[];getFlameHeatSource(object)?.write((...p)=>out.push(p));return out;};
  const scene=new THREE.Scene(),camera=new THREE.PerspectiveCamera(50,16/9,.1,500);
  camera.updateMatrixWorld();scene.background=new THREE.Color('#334455');
  const owner=new THREE.Group(),flame=new THREE.Mesh(new THREE.BoxGeometry(),new THREE.MeshBasicMaterial());
  const data=new FlameHeatSamples(2);owner.add(flame);scene.add(owner);data.attach(owner,[flame]);
  data.add(0,0,-10,1,2,1,3);data.add(0,0,-12,1,2,0,3);data.add(0,0,-14,1,2,1,3);data.add(0,0,-15,1,2,1,3);
  assert.equal(samples(owner).length,2,'bounded source buffer ignores cool and overflow samples');
  const pass=new FlameHeatDistortion(),viewport=new THREE.Vector4(0,0,1280,720),scissor=viewport.clone();
  let bound=null,draws=[],copies=0,throwAt=0,test=false;
  const renderer={autoClear:false,shadowMap:{autoUpdate:true,needsUpdate:true},
    getRenderTarget:()=>bound,getActiveCubeFace:()=>0,getActiveMipmapLevel:()=>0,
    getViewport:v=>v.copy(viewport),getCurrentViewport:v=>v.copy(viewport),setViewport:v=>viewport.copy(v),
    getScissor:v=>v.copy(scissor),setScissor:v=>scissor.copy(v),getScissorTest:()=>test,setScissorTest:v=>{test=v;},
    setRenderTarget:t=>{bound=t;},getDrawingBufferSize:v=>v.set(1280,720),
    copyFramebufferToTexture:()=>{copies++;},render(s,c){
      draws.push({scene:s,mask:c.layers.mask,flame:flame.layers.mask,background:s.background,clear:this.autoClear});
      if(throwAt===draws.length)throw new Error('injected render failure');
    }};
  const render=(target=null,drawWorld)=>{draws=[];scene.updateMatrixWorld(true);return pass.render(renderer,scene,camera,target,drawWorld,false);};
  assert.equal(render(),true);assert.equal(copies,1);assert.equal(draws.length,3);
  assert.equal(draws[0].mask&draws[0].flame,0,'world copy excludes original fire artwork');
  assert.ok(draws[2].mask&draws[2].flame,'fire is drawn after distortion');
  assert.equal(draws[1].clear,false);assert.equal(draws[2].background,null);
  assert.equal(camera.layers.mask,1);assert.equal(flame.layers.mask,1);assert.equal(renderer.autoClear,false);
  assert.ok(scene.background.isColor);assert.equal(renderer.shadowMap.autoUpdate,true);assert.equal(renderer.shadowMap.needsUpdate,true);
  assert.equal(pass.diagnostics.visible,2);
  let callbacks=0;render(null,()=>{callbacks++;renderer.render(scene,camera);return true;});
  assert.equal(callbacks,1);assert.equal(draws.length,3,'existing world compositor is used exactly once');
  const hdr=new THREE.WebGLRenderTarget(640,360,{type:THREE.HalfFloatType});
  render(hdr);assert.deepEqual(pass.diagnostics.copySize,[640,360]);assert.equal(pass.diagnostics.textureType,THREE.HalfFloatType);assert.equal(bound,null);
  hdr.setSize(640.8,360.3);render(hdr);assert.deepEqual(pass.diagnostics.copySize,[640,360],'fractional DPR uses actual integral texel dimensions');
  const savedViewport=viewport.clone(),savedBackground=scene.background;
  for(throwAt=1;throwAt<=3;throwAt++){
    assert.throws(()=>render(hdr),/injected render failure/);
    assert.equal(bound,null);assert.equal(camera.layers.mask,1);assert.equal(flame.layers.mask,1);
    assert.equal(scene.background,savedBackground);assert.deepEqual(viewport,savedViewport);assert.equal(renderer.shadowMap.autoUpdate,true);
  }throwAt=0;
  for(const change of [()=>{owner.visible=false;},()=>{flame.visible=false;},()=>{owner.position.z=250;},()=>{owner.position.x=500;},()=>{scene.fog=new THREE.Fog(0,1,4);},()=>{pass.enabled=false;}]){
    owner.visible=flame.visible=pass.enabled=true;owner.position.set(0,0,0);scene.fog=null;change();
    const before=copies;assert.equal(render(),false);assert.equal(draws.length,0);assert.equal(copies,before);assert.equal(pass.diagnostics.copySize,null);
  }
  owner.visible=flame.visible=pass.enabled=true;owner.position.set(0,0,0);scene.fog=null;
  attachFlameHeat(owner,emit=>{for(let i=0;i<FLAME_HEAT_LIMIT+100;i++)emit(0,0,-10-i*.1,1,2,1,i);},[flame]);
  render();assert.equal(pass.diagnostics.visible,FLAME_HEAT_LIMIT);assert.equal(pass.diagnostics.dropped,100);
  pass.release();assert.equal(pass.diagnostics.visible,0);assert.equal(pass.diagnostics.copySize,null);

  const {TempleBreath,templeTikiPhase}=await server.ssrLoadModule('/src/templeBreath.ts');
  const breath=new TempleBreath(7.1,7.8,0,28);new THREE.Group().add(breath);
  breath.update(6.3,templeTikiPhase(6.3),true);assert.ok(samples(breath.flames).length>5);
  const early=samples(breath.flames);breath.update(7.08,templeTikiPhase(7.08),true);
  assert.ok(samples(breath.flames).every(p=>p[2]>2),'heat follows the travelling cutoff tail');
  breath.update(7.6,templeTikiPhase(7.6),true);assert.equal(samples(breath.flames).length,0);assert.ok(breath.diagnostics.embers>0);
  assert.equal(getFlameHeatSource(breath.embers),undefined,'cooling embers do not emit heat');
  const {CartTempleJets}=await server.ssrLoadModule('/src/golf-cart/templeJets.ts');
  const jets=new CartTempleJets(4),at=new THREE.Vector3(2,3,4),velocity=new THREE.Vector3(0,0,12),direction=new THREE.Vector3(1,0,0);
  jets.emit(0,at,velocity,direction,1.25,7);jets.present(.03);const jetEarly=samples(jets)[0];
  at.set(100,100,100);direction.set(-1,0,0);jets.present(.21);const jetLate=samples(jets)[0];
  assert.ok(jetLate[0]>jetEarly[0]+2&&jetLate[2]>jetEarly[2],'heat retains packet birth transform and velocity');
  jets.present(.34);assert.equal(samples(jets).length,0);
  const {CartGouraudFire}=await server.ssrLoadModule('/src/golf-cart/gouraudFire.ts');
  const fire=new CartGouraudFire(8,'heat lifecycle');
  for(const kind of ['fire','ember'])fire.emit(0,at,velocity,direction,.3,.6,.5,3,kind);
  fire.present(.15);assert.equal(fire.count,2);assert.equal(samples(fire).length,1);
  fire.present(.55);assert.equal(samples(fire).length,0);
  const {SentryFireball}=await server.ssrLoadModule('/src/enemies/fireball.ts');
  const ball=new SentryFireball(direction,4);assert.equal(samples(ball).length,1);assert.equal(getFlameHeatSource(ball).sprites.length,3);
  ball.update(.2);assert.equal(samples(ball)[0][6],4);
  const {PuffSystem,PUFF_PRESETS,puffs}=await server.ssrLoadModule('/src/puffs.ts');
  const puffScene=new THREE.Scene(),puff=new PuffSystem(32);puff.attach(puffScene);
  for(const name of ['boomTnt','boomNitro','boomSmoke','torchSmoke'])puff.spawn(PUFF_PRESETS[name],0,0,-10,{seed:8});
  puff.update(.05,camera);assert.equal(puffScene.children.flatMap(samples).length,2,'only the two actual fire bursts emit heat');
  puff.clear();assert.equal(puffScene.children.flatMap(samples).length,0,'clear removes heat too');puffs.clear();
  const {CrateVfx}=await server.ssrLoadModule('/src/crateVfx.ts');
  const painted=new CrateVfx();painted.emit('tnt',new THREE.Vector3(0,0,-10),1,0,true);painted.update(.05);
  assert.ok(painted.root.children.flatMap(samples).length>0,'painted explosive flames also emit heat');
  for(let i=0;i<8;i++)painted.update(.05);assert.equal(painted.root.children.flatMap(samples).length,0,'lingering smoke is cool');
  painted.clear();painted.emit('wood',new THREE.Vector3(0,0,-10),1,0,false);painted.update(.05);
  assert.equal(painted.root.children.flatMap(samples).length,0,'ordinary crate dust has no heat');painted.dispose();
  for(const m of [breath.flames,breath.embers]){m.geometry.dispose();m.material.dispose();}
  jets.destroy();fire.destroy();ball.dispose();pass.dispose();hdr.dispose();
  console.log('PASS shared flame heat: live sources, travelling tails, extinction, hidden/culled effects, bounded buffers, world→heat→fire ordering, HDR/resize, no extra world draw, state restoration and disposal');
}finally{await server.close();}
