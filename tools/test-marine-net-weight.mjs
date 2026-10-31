import assert from 'node:assert/strict';
import { withSkateRuntime } from './jungle-cup-harness.mjs';
import { normalizeGameInput } from './blockworks-runner.mjs';

const data={v:1,name:'Bonus: Springtide Skippers',spawn:[0,.1,0],killY:-80,hugeDropBail:false,components:[
  {t:'platform',p:[20,-.5,0],s:[120,1,180]},
  {t:'trampoline',nm:'Weight net',p:[0,.02,0],s:[24,.6,24],speed:48,amp:1.25},
  {t:'mover',nm:'Moving weight net',p:[40,2,0],s:[16,.6,16],axis:'x',amp:2,period:5,spin:25,bounce:48},
  {t:'gate',p:[0,0,-80]},
]};
await withSkateRuntime(async({player:p,level,CONST,THREE,server})=>{
  const {trampolineSurfacePresentations:surfaces}=await server.ssrLoadModule('/src/trampolineSurface.ts');
  const pad=level.groundMeshes.find(m=>m.name==='Weight net'),net=surfaces.get(pad);
  assert.ok(net,'the actual marine dressing did not register its render-only surface');
  p.competitionMode=false;
  let previous={};
  const reset=(at=new THREE.Vector3(0,.1,0))=>{
    p.respawn(level,true,true,{position:at,heading:new THREE.Vector3(0,0,-1)});previous={};
    for(let f=0;f<120;f++)level.update(CONST.fixedStep);
  };
  const tick=(sample={})=>{
    const input=normalizeGameInput(sample,previous);previous={...input};p.rawInput=input;
    p.step(CONST.fixedStep,input,level);level.update(CONST.fixedStep);p.commitRenderStep(level);
    const physical=p.pos.toArray();
    p.applyRenderInterpolation(1);
    const offset=p.group.position.clone().sub(p.pos);
    assert.deepEqual(p.pos.toArray(),physical,'render dent moved the controller');
    p.restoreRenderPose();
    assert.deepEqual(p.group.position.toArray(),physical,'render dent leaked into the next simulation step');
    return offset;
  };
  reset();
  for(let f=0;f<50;f++)tick();
  assert.ok(net.weightOffset(0,0)<-.6,'standing weight did not settle visibly');
  assert.ok(Math.abs(net.weightOffset(6,0))<.04,'weight flattened the whole trampoline');
  assert.equal(net.diagnostics.impacts,0,'walking emitted a bounce impact');
  for(const input of [{moveX:1},{moveY:1}])for(let f=0;f<20;f++){
    const offset=tick(input),local=pad.worldToLocal(p.pos.clone());
    assert.ok(p.grounded&&!p.isBailing&&!p.trampolineAir);
    assert.ok(Math.abs(net.diagnostics.weightAt[0]-local.x)<1e-9);
    assert.ok(Math.abs(net.diagnostics.weightAt[1]-local.z)<1e-9);
    assert.ok(Math.abs(offset.y-net.weightOffset(local.x,local.z))<1e-9,'rendered feet did not follow the local dent');
  }
  assert.equal(Math.abs(net.weightOffset(-24*.307,0)),0,'weight moved the bound edge');
  assert.equal(Math.abs(net.weightOffset(24*.357,0)),0,'weight moved the bound edge');
  const depth=net.diagnostics.weightDepth;
  reset(new THREE.Vector3(10,.1,0));tick();
  assert.ok(depth>.6&&net.diagnostics.weightDepth===0,'net did not relax after leaving');
  for(let f=0;f<20;f++)assert.equal(tick().lengthSq(),0,'metal rim inherited the net dent');

  // One world-space walk/hop/bounce trace must be identical with the visual
  // contact disabled, including input-gated jumping and launch velocity.
  const run=enabled=>{
    if(enabled)surfaces.set(pad,net);else surfaces.delete(pad);
    reset();const start=p.trampolineLaunchId,rows=[];
    for(let f=0;f<150;f++){
      tick(f<30?{moveY:1}:f<36?{jumpHeld:true}:{});
      rows.push([p.pos.toArray(),p.speed,p.vVel,p.grounded,p.state,p.freeSkate,p.isBailing,p.trampolineLaunchId-start]);
    }
    assert.ok(rows.some(row=>row.at(-1)>0),'fixture never completed a trampoline landing');
    return rows;
  };
  assert.deepEqual(run(true),run(false),'net weight changed movement/jump physics');surfaces.set(pad,net);

  const mover=level.movers[0],moving=surfaces.get(mover.mesh);
  for(const x of [-2,2]){
    mover.mesh.updateMatrixWorld(true);
    reset(mover.mesh.localToWorld(new THREE.Vector3(x,.4,0)));
    for(let f=0;f<45;f++)tick();
    assert.equal(p.groundHit.mesh,mover.mesh);
    const local=mover.mesh.worldToLocal(p.pos.clone());
    assert.ok(moving.weightOffset(local.x,local.z)<-.6);
    assert.ok(Math.abs(moving.diagnostics.weightAt[0]-local.x)<1e-8,'dent failed to follow the moving/rotating deck');
    assert.ok(Math.abs(moving.diagnostics.weightAt[1]-local.z)<1e-8);
  }
  // All three shader passes use the same live contact state. Housing anchors
  // retain zero mobility, including during a simultaneous impact ripple.
  const shaders=[net.mesh.material,net.mesh.customDepthMaterial,net.mesh.customDistanceMaterial].map(material=>{
    const shader={uniforms:{},vertexShader:'#include <begin_vertex>\n#include <beginnormal_vertex>'};
    material.onBeforeCompile(shader);return shader;
  });
  for(const shader of shaders){
    assert.equal(shader.uniforms.netLoad,shaders[0].uniforms.netLoad);
    assert.match(shader.vertexShader,/netOffset\(position.xz\)\*netMobility/);
  }
  assert.ok([...net.mesh.geometry.attributes.netMobility.array].some(v=>v===0),'housing ties are not pinned');
  console.log('PASS local walking/standing dent, planted render feet, finite recovery, safe metal rim, rotating/moving deck, matching shadow deformation, pinned ties, exact movement/jump parity.');
},{levelEntry:{id:'__marine_weight',name:data.name,data}});
