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
  const players=[new Player(scene),new Player(scene)],[p,control]=players;
  const runtimes=players.map(player=>{
    const binding=RigBinding.fromSculptRuntime(player.animationRig.root);
    player.onFootJumpStudy={...JAK_DIRECT_PHYSICS,flip:true};
    return createCharacterAnimationRuntime(player,createJakDirectSuite(createPlayerStarterAnimationSuite(binding.definition),binding.definition,jak));
  });
  const motion=new PlayableSkateMotion(p,skate,{continuousTransitions:true});
  const point=id=>p.animationRig.jointsById.get(id).node.getWorldPosition(new THREE.Vector3());
  const snapshot=()=>({hip:p.animationRig.jointsById.get('hips').node.getWorldQuaternion(new THREE.Quaternion()).normalize(),
    feet:['Left','Right'].map(side=>point(`ankle${side}`).sub(p.pos)),lead:point('ankleRight').sub(point('ankleLeft')).dot(p.axisF)});
  let incoming;
  const update=motion.update.bind(motion);
  motion.update=context=>{incoming=snapshot();update(context);};
  let frames=0;const results=[];
  const cases=[{delay:0},{delay:.55},{delay:1.1},{delay:0,rolling:true}];
  for(const fps of [30,60,120])for(const stance of [-1,1])for(const {delay,rolling=false} of cases){
    motion.setActive(false);
    players.forEach((player,i)=>{
      player.enterLevel('pickup-flow');player.respawn(level,true,true);runtimes[i].restart();
      player.freeSkate=true;player.speed=6;player.lastPlanar=6;player.stance=stance;
      player.grounded=true;player.state='ride';player.groundHit=player.queryGround(level);
    });
    motion.setActive(true);
    let off=-1,previous=null,walkingSince=-1,matched=0,exitChecked=0,maxEntryTurn=0,maxGaitError=0;
    const strides=[];
    for(let f=0;f<fps*4;f++){
      const age=off<0?-1:(f-off)/fps;
      // Brake to a real controller-driven step-off, then start running either
      // immediately or partway through the standing pickup. Reverse and stop
      // before the source clip ends to exercise a changing live gait target.
      const move=age>=delay?(age<delay+.65?1:age<delay+.9?-1:age<delay+1.05?0:1):0;
      for(const player of players){
        // Also exercise a deliberate step-off with carried velocity: it uses
        // the running pickup, whose board catch comes later than standing.
        if(rolling&&off<0&&f>=fps*.35)player.stepOff=true;
        player.step(1/fps,makeInput({grabHeld:!rolling&&off<0&&f>=fps*.35,moveY:move}),level);player.commitRenderStep(level);
      }
      level.update(1/fps);frames++;
      assert.ok(p.pos.distanceTo(control.pos)<1e-8,'presentation changed movement');
      for(const key of ['vVel','speed','grounded','freeSkate','stance'])assert.equal(p[key],control[key],`presentation changed ${key}`);
      const pose=snapshot();
      if(off<0&&!p.freeSkate){
        off=f;assert.equal(motion.phase,'dismount','fixture did not enter pickup');
        assert.equal(motion.sourceName,rolling?'BR_DISMOUNT_LO_INTO_RUN_FWD':'BR_DISMOUNT_LO_INTO_STAND_0');
        maxEntryTurn=pose.hip.angleTo(previous.hip);
        assert.ok(maxEntryTurn<.12,`step-off snapped from stance ${stance}: ${maxEntryTurn}`);
        assert.ok(pose.lead*previous.lead>0,'pickup exchanged the anatomical lead foot');
      }
      if(off>=0&&(f-off)/fps>=.4&&p.walkVelocity.length()>.15&&walkingSince<0)walkingSince=f;
      if(walkingSince>=0&&(f-walkingSince)/fps>=.2){
        const error=Math.max(...pose.feet.map((foot,i)=>foot.distanceTo(incoming.feet[i])));
        maxGaitError=Math.max(maxGaitError,error);
        assert.ok(error<.005,`pickup froze/overrode the live gait at ${fps}fps, stance ${stance}, delay ${delay}, frame ${f}: ${error}`);
        if(motion.phase==='dismount'){matched++;strides.push(pose.lead);}
        else if(motion.phase==='foot')exitChecked++;
      }
      previous=pose;
    }
    assert.ok(off>=0&&matched>=fps*.08&&exitChecked>fps*.2,'fixture missed moving pickup or its exit');
    const strideRange=Math.max(...strides)-Math.min(...strides);
    assert.ok(strideRange>.25,`legs failed to stride during pickup: ${strideRange}`);
    assert.equal(motion.boardScribble.disappearances,1,'step-off must have exactly one board disappearance');
    results.push({fps,stance,delay,rolling,matched,exitChecked,maxEntryTurn,maxGaitError,strideRange});
  }
  motion.dispose();runtimes.forEach(r=>r.dispose());
  console.log(JSON.stringify({status:'pass',frames,results},null,2));
},{levelEntry:{id:'pickup-flow',name:'Pickup flow',data:{v:1,name:'Pickup flow',spawn:[0,.02,6],killY:-30,
  components:[{t:'platform',p:[0,-.5,0],s:[2000,1,2000],edgeGrinding:false},{t:'gate',p:[800,0,-800]}]}}});
