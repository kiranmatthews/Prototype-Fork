import assert from 'node:assert/strict';
import {withSkateRuntime,makeInput} from './jungle-cup-harness.mjs';
await withSkateRuntime(async({THREE,server,Level,Player,CONST})=>{
 const {RigBinding}=await server.ssrLoadModule('/src/animation/rigBinding.ts');
 const {createPlayerStarterAnimationSuite}=await server.ssrLoadModule('/src/animation/playerCatalog.ts');
 const {createCharacterAnimationRuntime}=await server.ssrLoadModule('/src/characterAnimationRuntime.ts');
 const scene=new THREE.Scene(),level=new Level(scene,{id:'death-cost',name:'Death cost',data:{v:1,name:'Death cost',spawn:[0,.1,0],killY:-300,components:[{t:'platform',p:[0,-.5,0],s:[40,1,40]},{t:'gate',p:[0,0,-16]}]}});
 const p=new Player(scene),input=makeInput({inventoryHeld:true});p.rawInput=input;p.respawn(level,true);
 const runtime=createCharacterAnimationRuntime(p,createPlayerStarterAnimationSuite(RigBinding.fromSculptRuntime(p.animationRig.root).definition));
 const floorMeshes=[...level.groundMeshes];
 let exact=0,fullBounds=0,ground=0,samples=0,indicatorRays=0;const measure=p.interactionMeasure;
 const verifyClearance=measure.minimumPlaneDistance.bind(measure);
 for(const [owner,key,count]of [[measure,'minimumPlaneDistance',()=>exact++],[measure,'measure',()=>fullBounds++],[p,'queryGround',()=>ground++],[p,'queryShadowGround',()=>indicatorRays++],[measure,'sampledPlaneDistance',()=>samples++]]){
  const fn=owner[key].bind(owner);owner[key]=(...args)=>{count();return fn(...args);};
 }
 p.step(CONST.fixedStep,input,level);p.speed=15;const location=p.pos.clone(),lives=p.lives;p.die();p.respawnTimer=30;
 exact=fullBounds=ground=samples=indicatorRays=0;
 for(let i=0;i<100;i++){p.step(CONST.fixedStep,makeInput({jumpPressed:true,spinPressed:true,moveX:1}),level);p.refreshGroundPresentation(level);}
 assert.equal(exact,0,'fatal playback scanned every rendered vertex');assert.equal(fullBounds,0,'fatal playback rebuilt live interaction bounds');
 assert.equal(ground,0,'supported death kept raycasting its floor');assert.equal(indicatorRays,0,'dead landing indicator still probes the level');assert.ok(p.pos.distanceTo(location)<.001,'supported death retained travel momentum');
 assert.equal(p.lives,lives-1);assert.equal(p.deathPresentationDiagnostics.frozen,true);assert.equal(p.ragActive,false);
 const frozenSamples=samples;for(let i=0;i<60;i++)p.step(CONST.fixedStep,input,level);
 assert.equal(samples,frozenSamples,'held final pose keeps re-solving support');
 // The cached support must not pin a corpse above a removed/phase-off floor.
 level.groundMeshes.length=0;p.step(CONST.fixedStep,input,level);
 assert.equal(p.grounded,false);assert.equal(p.deathPresentationDiagnostics.frozen,false);assert.equal(p.ragActive,true);assert.equal(p.animationClipHint,'player.death');
 assert.ok(p.pos.y<location.y);assert.equal(p.lives,lives-1);
 // A deep fall plays the authored collapse first, then the established tumble.
 p.respawn(level,true,true,{position:new THREE.Vector3(0,150,0),heading:new THREE.Vector3(0,0,-1)});
 const resetBounds=fullBounds;
 p.grounded=false;p.vVel=-2;p.die();p.respawnTimer=30;
 for(let i=0;i<65;i++)p.step(CONST.fixedStep,input,level);
 assert.equal(p.animationClipHint,'player.death');assert.equal(p.ragActive,false);
 let rootBefore=p.bodyGroup.position.clone();
 for(let i=0;i<12;i++){const wasRag=p.ragActive;p.step(CONST.fixedStep,input,level);if(!wasRag&&p.ragActive)assert.ok(p.bodyGroup.position.distanceTo(rootBefore)<.25,'ragdoll handoff snapped its outer root');rootBefore.copy(p.bodyGroup.position);}
 assert.equal(p.animationClipHint,'player.death');assert.equal(p.ragActive,true);assert.equal(p.deathPresentationDiagnostics.mode,'ragdoll');
 assert.equal(exact,0);assert.equal(fullBounds,resetBounds,'airborne death rebuilt full interaction bounds');
 const original={...p.characterProportions};level.groundMeshes.push(...floorMeshes);
 p.setCharacterProportions({height:1.3,headSize:1.8});p.respawn(level,true);p.step(CONST.fixedStep,input,level);p.die();p.respawnTimer=30;
 let clearance=Infinity;
 for(let i=0;i<110;i++){p.step(CONST.fixedStep,input,level);clearance=Math.min(clearance,verifyClearance(p.riderG,new THREE.Vector3(0,1,0),new THREE.Vector3()));}
 assert.ok(clearance>=0,`large-head death clips the floor by ${-clearance}m`);p.setCharacterProportions(original);
 runtime.dispose();level.dispose();
 console.log('PASS death cost/ownership: zero full-mesh scans or ground queries while supported, frozen final pose, inert input, one life charge, support loss and canned-to-ragdoll airborne handoff.');
});
