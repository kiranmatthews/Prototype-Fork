import assert from 'node:assert/strict';
import { withSkateRuntime, makeInput } from './jungle-cup-harness.mjs';

await withSkateRuntime(async ({THREE, server, Level, Player, CONST}) => {
  const {SWIMMING} = await server.ssrLoadModule('/src/swimming.ts');
  const {SwimEffects} = await server.ssrLoadModule('/src/swimEffects.ts');
  const {Swirl} = await server.ssrLoadModule('/src/swirls.ts');
  const {swirlContourWave,swirlBandOffset} = await server.ssrLoadModule('/src/swirlContours.ts');
  const {RigBinding} = await server.ssrLoadModule('/src/animation/rigBinding.ts');
  const {createPlayerStarterAnimationSuite} = await server.ssrLoadModule('/src/animation/playerCatalog.ts');
  const {createCharacterAnimationRuntime} = await server.ssrLoadModule('/src/characterAnimationRuntime.ts');
  assert.equal(SWIMMING.strokeImmersion,1.53);assert.equal(SWIMMING.idleImmersion,1.65);
  for(let i=0;i<100;i++){
    const a=i*.37,t=i*.01;
    assert.equal(swirlContourWave(a,t,.08,3,.7,-.2),.08*Math.sin(a*3+.7+t*-.2));
  }
  assert.deepEqual([0,1,2,3,4].map(i=>swirlBandOffset(i,.1,.3)),[-.3,-.1,0,.1,.3]);
  const wormhole=new Swirl({});wormhole.update(.1,new THREE.PerspectiveCamera());wormhole.dispose();
  const effects=new SwimEffects(),water={heightAt:(x,z)=>.03*Math.sin(x+z)};
  const position=new THREE.Vector3(2,-1,5);
  for(let i=0;i<30;i++)effects.step(1/60,water,position,4,true,true);
  assert.equal(effects.group.children.length,2,'ripple pool adds draw objects');
  const mesh=effects.group.children[0],positions=mesh.geometry.getAttribute('position'),colors=mesh.geometry.getAttribute('color');
  assert.equal(colors.itemSize,4);assert.equal(mesh.material.depthWrite,false);
  const radii=[];
  for(let j=0;j<32;j++){
    assert.equal(colors.getW(j),0,'inner edge is hard');assert.equal(colors.getW(4*32+j),0,'outer edge is hard');
    assert.ok(colors.getW(2*32+j)>colors.getW(32+j),'soft radial falloff missing');
    radii.push(Math.hypot(positions.getX(2*32+j)-position.x,positions.getZ(2*32+j)-position.z));
  }
  assert.ok(Math.max(...radii)-Math.min(...radii)>.12,'ripples remain circular');
  for(let i=0;i<130;i++)effects.step(1/60,water,position,0,false,false);
  assert.ok(effects.group.children.every(m=>!m.visible),'expired effects still draw');
  effects.reset();effects.step(.2,water,position,0,true,false);
  for(let i=160;i<colors.count;i++)assert.equal(colors.getW(i),0,'pooled rings survived reset');
  effects.dispose();

  const scene=new THREE.Scene(),level=new Level(scene,{id:'death-polish',name:'Death',data:{v:1,name:'Death',spawn:[0,.1,0],killY:-20,
    components:[{t:'platform',p:[0,-.5,0],s:[60,1,60]},{t:'gate',p:[0,0,-25]}]}});
  const player=new Player(scene);player.rawInput=makeInput();player.respawn(level,true);
  const rig=RigBinding.fromSculptRuntime(player.animationRig.root).definition;
  const suite=createPlayerStarterAnimationSuite(rig),runtime=createCharacterAnimationRuntime(player,suite);
  const clip=suite.clips.find(c=>c.id==='player.death');
  assert.equal(clip.loop.mode,'once');assert.equal(clip.metadata.sourceAnimation.sourceLoop,false);
  assert.notDeepEqual(clip.tracks[0].keys[0].value,clip.tracks[0].keys.at(-1).value,'death loop was closed by importer');
  const hips=player.animationRig.jointsById.get('hips').node;
  let poses=0;
  for(const height of [0,5])for(const yaw of [0,Math.PI/2]){
    player.respawn(level,true);player.pos.set(0,height,0);player.prevPos.copy(player.pos);player.visualYaw=yaw;
    player.grounded=height===0;player.vVel=height?-2:0;player.speed=0;
    const lives=player.lives;player.die();player.respawnTimer=20;
    let finalPose=null,finalPosition=null,minY=Infinity;
    for(let i=0;i<240;i++){
      player.step(CONST.fixedStep,makeInput({jumpHeld:true,spinPressed:true}),level);
      assert.equal(player.state,'dead');assert.equal(player.lives,lives-1);
      assert.equal(player.ragActive,false);assert.ok(Math.abs(player.bodyGroup.rotation.x)<=.45,'legacy endless rotation still runs');
      if(player.grounded){
        const actual=player.interactionMeasure.minimumPlaneDistance(player.riderG,new THREE.Vector3(0,1,0),new THREE.Vector3());
        minY=Math.min(minY,actual);assert.ok(actual>=.019,`dead body intersects the floor: ${actual} at ${i}/${height}/${yaw}, tilt ${player.bodyGroup.rotation.x}`);
        if(i>190)assert.ok(actual<.025,'settled corpse hovers above the ground');
      }
      if(i===190){finalPose=hips.quaternion.clone();finalPosition=player.characterBounds.getCenter(new THREE.Vector3());}
      if(i>190){assert.ok(hips.quaternion.angleTo(finalPose)<1e-6,'one-shot death loops after settling');
        assert.ok(player.characterBounds.getCenter(new THREE.Vector3()).distanceTo(finalPosition)<.02,'settled corpse keeps moving');}
      poses++;
    }
    assert.ok(Number.isFinite(minY)&&minY<.3,'fall never meets the ground');
  }
  runtime.dispose();level.dispose();
  console.log(`PASS deeper stroke, shared wormhole contours, feathered two-draw ripple pool/reset, and ${poses} fatal-fall pose samples with ground clearance and a held final pose.`);
});
