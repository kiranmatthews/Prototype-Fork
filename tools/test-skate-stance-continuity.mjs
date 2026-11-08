import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {gunzipSync} from 'node:zlib';
import {withSkateRuntime,makeInput} from './jungle-cup-harness.mjs';

const bank=async name=>JSON.parse(gunzipSync(await readFile(new URL(`../public/motion-study/${name}/motion.json.gz`,import.meta.url))));
const [skate,jak]=await Promise.all([bank('skate'),bank('jak')]);
await withSkateRuntime(async({server,scene,level,Player,THREE})=>{
  const {PlayableSkateMotion}=await server.ssrLoadModule('/src/skateReferenceLab/playableMotion.ts');
  const {RigBinding,createPlayerStarterAnimationSuite}=await server.ssrLoadModule('/src/animation/index.ts');
  const {createJakDirectSuite,JAK_DIRECT_PHYSICS}=await server.ssrLoadModule('/tools/jak-direct-motion.ts');
  const {createCharacterAnimationRuntime}=await server.ssrLoadModule('/src/characterAnimationRuntime.ts');
  const players=[new Player(scene),new Player(scene)],[p,native]=players;
  const runtimes=players.map((player,i)=>{
    const binding=RigBinding.fromSculptRuntime(player.animationRig.root),base=createPlayerStarterAnimationSuite(binding.definition);
    return createCharacterAnimationRuntime(player,i===0?createJakDirectSuite(base,binding.definition,jak):base);
  });
  p.onFootJumpStudy={...JAK_DIRECT_PHYSICS,flip:true};
  const source=new PlayableSkateMotion(p,skate,{continuousTransitions:true});
  const point=(player,id)=>player.animationRig.jointsById.get(id).node.getWorldPosition(new THREE.Vector3());
  const lead=player=>point(player,'ankleRight').sub(point(player,'ankleLeft')).dot(player.axisF);
  const chest=player=>new THREE.Vector3(0,0,-1).applyQuaternion(player.animationRig.jointsById.get('chest').node.getWorldQuaternion(new THREE.Quaternion()));
  const results=[];let frames=0;
  for(const stance of [-1,1]){
    source.setActive(false);
    players.forEach((player,i)=>{
      player.enterLevel('stance-flow');player.respawn(level,true,true);runtimes[i].restart();
      player.freeSkate=true;player.speed=18;player.lastPlanar=18;player.stance=stance;
      player.grounded=true;player.state='ride';player.groundHit=player.queryGround(level);
    });
    source.setActive(true);
    let sourceFrames=0,iceFrames=0,returnedFrames=0,maxHipTurn=0,minLeadAgreement=1,previousHip=null,previousOwner=null;
    for(let f=0;f<260;f++){
      for(const player of players){player.step(1/60,makeInput(),level);player.commitRenderStep(level);}
      level.update(1/60);frames++;
      assert.ok(p.pos.distanceTo(native.pos)<1e-8,'stance correction changed gameplay');
      assert.equal(p.stance,native.stance,'source changed regular/fakie state');
      if(f<25)continue;
      const owner=source.diagnostics.nativeOwner,ice=Boolean(p.boardG.userData.iceSkateMotion);
      if(ice)iceFrames++;
      else if(source.sourceName){sourceFrames++;if(iceFrames)returnedFrames++;}
      const a=lead(p),b=lead(native);
      minLeadAgreement=Math.min(minLeadAgreement,Math.sign(a*b));
      assert.ok(a*b>0,`lead foot inverted at ${stance}/${f}: source ${a}, native ${b}, owner ${owner}`);
      assert.ok(chest(p).dot(chest(native))>0,`chest faces opposite side at ${stance}/${f}`);
      const hip=p.animationRig.jointsById.get('hips').node.getWorldQuaternion(new THREE.Quaternion());
      if(previousHip&&owner!==previousOwner)maxHipTurn=Math.max(maxHipTurn,hip.angleTo(previousHip));
      previousHip=hip;previousOwner=owner;
      for(const joint of p.animationRig.joints)assert.ok(joint.node.scale.toArray().every(v=>v>0),'mirroring changed skeleton handedness');
      assert.equal(source.boardScribble.appearances,0,'ice/fakie invented a mount');
      assert.equal(source.boardScribble.disappearances,0,'ice/fakie invented a pickup');
    }
    assert.ok(iceFrames>15,'fixture missed ice');
    if(stance===-1)assert.ok(sourceFrames>20&&returnedFrames>20,'source did not resume after ice');
    assert.ok(maxHipTurn<.8,`stance snapped on ice boundary: ${maxHipTurn}`);
    results.push({stance,sourceFrames,iceFrames,returnedFrames,minLeadAgreement,maxHipTurn});
  }
  source.dispose();runtimes.forEach(r=>r.dispose());
  console.log(JSON.stringify({status:'pass',frames,results},null,2));
},{levelEntry:{id:'stance-flow',name:'Stance continuity',data:{v:1,name:'Stance continuity',spawn:[0,.02,18],killY:-30,
  components:[{t:'platform',p:[0,-.5,0],s:[200,1,200],edgeGrinding:false},
    {t:'platform',p:[0,-.09,-7],s:[100,.2,16],slip:true,iceGrip:.08,edgeGrinding:false},{t:'gate',p:[80,0,-80]}]}}});
