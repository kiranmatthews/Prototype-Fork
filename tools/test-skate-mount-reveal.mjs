import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {gunzipSync} from 'node:zlib';
import {withSkateRuntime,makeInput} from './jungle-cup-harness.mjs';

const bank=async name=>JSON.parse(gunzipSync(await readFile(new URL(`../public/motion-study/${name}/motion.json.gz`,import.meta.url))));
const [skate,jak]=await Promise.all([bank('skate'),bank('jak')]);
await withSkateRuntime(async({server,scene,level,Player,THREE})=>{
  const {PlayableSkateMotion}=await server.ssrLoadModule('/src/skateReferenceLab/playableMotion.ts');
  const {boardGroundClearance}=await server.ssrLoadModule('/src/skateReferenceLab/boardGrounding.ts');
  const {skateboardSettings}=await server.ssrLoadModule('/src/skateboard/settings.ts');
  const {evaluateSkateboardSurfaceHeight}=await server.ssrLoadModule('/src/skateboard/model.ts');
  const {RigBinding,createPlayerStarterAnimationSuite}=await server.ssrLoadModule('/src/animation/index.ts');
  const {createJakDirectSuite,JAK_DIRECT_PHYSICS}=await server.ssrLoadModule('/tools/jak-direct-motion.ts');
  const {createCharacterAnimationRuntime}=await server.ssrLoadModule('/src/characterAnimationRuntime.ts');
  const players=[new Player(scene),new Player(scene)],[p,control]=players;
  const runtimes=players.map(player=>{
    player.onFootJumpStudy={...JAK_DIRECT_PHYSICS,flip:true};
    const binding=RigBinding.fromSculptRuntime(player.animationRig.root);
    return createCharacterAnimationRuntime(player,createJakDirectSuite(createPlayerStarterAnimationSuite(binding.definition),binding.definition,jak));
  });
  const motion=new PlayableSkateMotion(p,skate,{continuousTransitions:true});
  const point=(player,id)=>player.animationRig.jointsById.get(id).node.getWorldPosition(new THREE.Vector3());
  const results=[];let frames=0;
  for(const warmup of [0,20,90])for(const outcome of ['mount','cancel','release']){
    players.forEach((player,i)=>{player.enterLevel('mount-reveal');player.respawn(level,true,true);runtimes[i].restart();});
    motion.reset();let previousHeld=false,previousBoard=null,previousHead=null;
    let preparation=0,mountFrames=0,minBelow=Infinity,minAhead=Infinity,maxBoardStep=0,maxHeadStep=0,maxFootError=0,minSoleClearance=Infinity,source='',worstSole;
    for(let f=0;f<warmup+120;f++){
      const t=f-warmup,cancel=outcome==='cancel'&&t>=20;
      const held=t>=0&&(outcome!=='release'||t<20);
      const input=makeInput({moveY:cancel?0:1,jumpHeld:held,jumpPressed:held&&!previousHeld,jumpReleased:!held&&previousHeld,jumpCancelled:cancel});
      previousHeld=held;
      for(const player of players){player.rawInput=input;player.step(1/60,input,level);}
      level.update(1/60);frames++;
      assert.ok(p.pos.distanceTo(control.pos)<1e-8,'mount presentation moved the controller');
      for(const key of ['speed','vVel','grounded','state','freeSkate','airFromSkate','stance'])assert.equal(p[key],control[key],`${key} changed`);
      const prepare=motion.boardScribble.stage==='prepare',mount=motion.phase==='mount';
      const hips=point(p,'hips'),head=point(p,'head').sub(p.pos),board=motion.retarget.board.getWorldPosition(new THREE.Vector3());
      if(prepare||mount){
        if(prepare){
          preparation++;assert.equal(motion.retarget.board.visible,false,'carried board appeared during hold');
          for(const side of ['Left','Right'])maxFootError=Math.max(maxFootError,point(p,`ankle${side}`).distanceTo(point(control,`ankle${side}`)));
        }
        if(mount){
          mountFrames++;source=motion.sourceName;
          if(motion.time>=.15)for(const side of ['Left','Right']){
            const socket=p.animationRig.jointsById.get(`ankle${side}`).node.getObjectByName(`socket-foot-${side.toLowerCase()}`);
            const local=motion.retarget.board.worldToLocal(socket.getWorldPosition(new THREE.Vector3()));
            const settings=skateboardSettings.value,s=settings.overallScale;
            const surface=(settings.boardToGroundDistance+evaluateSkateboardSurfaceHeight(settings,local.x/s,local.z/s))*s;
            if(local.y-surface<minSoleClearance){minSoleClearance=local.y-surface;worstSole={f,side,time:motion.time,local:local.toArray(),surface};}
          }
        }
        const delta=board.clone().sub(hips);minBelow=Math.min(minBelow,-delta.y);minAhead=Math.min(minAhead,delta.dot(p.axisF));
        const support=new THREE.Plane().setFromNormalAndCoplanarPoint(p.groundHit.normal,p.pos);
        assert.ok(boardGroundClearance(motion.retarget.board,support)>=.002-1e-7,'mount deck went through the floor');
        const relative=board.clone().sub(p.pos);
        if(previousBoard)maxBoardStep=Math.max(maxBoardStep,relative.distanceTo(previousBoard));
        if(previousHead)maxHeadStep=Math.max(maxHeadStep,head.distanceTo(previousHead));
        previousBoard=relative;
      }else previousBoard=null;
      previousHead=head;
    }
    assert.ok(preparation>=18,'did not exercise a reversible hold');
    assert.ok(minBelow>.4,`board climbed back into the pelvis: ${minBelow}`);
    assert.ok(minAhead>.05,`board emerged behind the skater: ${minAhead}`);
    assert.ok(maxBoardStep<.16,`board snapped at the hold/commit boundary: ${maxBoardStep}`);
    assert.ok(maxHeadStep<.18,`mount pose snapped: ${maxHeadStep}`);
    assert.ok(maxFootError<.002,`anticipation replaced native running feet: ${maxFootError}`);
    if(outcome==='mount'){
      assert.ok(mountFrames>15);assert.equal(motion.boardScribble.appearances,1);
      assert.ok(minSoleClearance>-.02,`step-on sole went through the deck (${source}): ${minSoleClearance}; ${JSON.stringify(worstSole)}`);
    }else{
      assert.equal(motion.boardScribble.appearances,0);assert.equal(motion.boardScribble.active,false);
      assert.equal(motion.diagnostics.mountPreparation,0,'cancel did not settle');assert.equal(motion.retarget.board.visible,false);
    }
    results.push({warmup,outcome,preparation,mountFrames,source,minBelow,minAhead,maxBoardStep,maxHeadStep,maxFootError,minSoleClearance});
  }
  motion.dispose();runtimes.forEach(r=>r.dispose());
  console.log(JSON.stringify({status:'pass',frames,results},null,2));
},{levelEntry:{id:'mount-reveal',name:'Mount reveal',data:{v:1,name:'Mount reveal',spawn:[0,.02,6],killY:-20,
  components:[{t:'platform',p:[0,-.5,-100],s:[1000,1,1000]},{t:'gate',p:[100,0,-400]}]}}});
