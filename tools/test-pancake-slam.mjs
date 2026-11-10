import assert from 'node:assert/strict';
import {readFile,writeFile} from 'node:fs/promises';
import {gunzipSync} from 'node:zlib';
import {withSkateRuntime,makeInput} from './jungle-cup-harness.mjs';

const bank=JSON.parse(gunzipSync(await readFile(new URL('../public/motion-study/jak/motion.json.gz',import.meta.url))));
await withSkateRuntime(async({server,scene,level,Player,THREE,CONST})=>{
  const {RigBinding,createPlayerStarterAnimationSuite,ELASTIC_LENGTH_CONTROLS}=await server.ssrLoadModule('/src/animation/index.ts');
  const {createJakDirectSuite,JAK_DIRECT_PHYSICS}=await server.ssrLoadModule('/tools/jak-direct-motion.ts');
  const {createCharacterAnimationRuntime}=await server.ssrLoadModule('/src/characterAnimationRuntime.ts');
  const {PANCAKE_SLAM}=await server.ssrLoadModule('/src/animation/pancakeSlam.ts');
  // p plays D, control plays the native presentation, fresh plays D without
  // ever having idled (so its soles hold wherever the roll brings them down).
  const players=[new Player(scene),new Player(scene),new Player(scene)],[p,control,fresh]=players;
  const runtimes=players.map((player,i)=>{
    const rig=RigBinding.fromSculptRuntime(player.animationRig.root).definition,base=createPlayerStarterAnimationSuite(rig);
    return createCharacterAnimationRuntime(player,i===1?base:createJakDirectSuite(base,rig,bank));
  });
  p.onFootJumpStudy=fresh.onFootJumpStudy={...JAK_DIRECT_PHYSICS,flip:true};
  const joint=(player,id)=>player.animationRig.jointsById.get(id).node;
  const point=(player,id)=>joint(player,id).getWorldPosition(new THREE.Vector3());
  const sockets=(player,part)=>['left','right'].map(side=>player.group.getObjectByName(`socket-${part}-${side}`).getWorldPosition(new THREE.Vector3()));
  // The rigid shoe turns about its tip when the heel lifts, so the tip is what must stay put.
  const soles=player=>sockets(player,'foot'),toes=player=>sockets(player,'toe');
  // Lateral room between the ankles in the pelvis's own frame: negative means crossed legs.
  const ankleGap=player=>{
    const inverse=joint(player,'hips').matrixWorld.clone().invert();
    return point(player,'ankleLeft').applyMatrix4(inverse).x-point(player,'ankleRight').applyMatrix4(inverse).x;
  };
  const up=new THREE.Vector3(0,1,0),ground=PANCAKE_SLAM.groundStart,lock=PANCAKE_SLAM.recovery;
  const feetDown=PANCAKE_SLAM.feetDown-ground,crouch=PANCAKE_SLAM.crouch-ground,spring=PANCAKE_SLAM.spring-ground;
  assert.ok(lock>CONST.slamFlat*2&&lock<=1.2&&PANCAKE_SLAM.hang>CONST.slamHang*1.5,`the floaty slam should own a much longer hang and recovery: ${PANCAKE_SLAM.hang} / ${lock}`);
  // The splat keeps its speed; everything after it runs on the slower clock.
  const at=age=>age<=.045?age:.045+(age-.045)*(lock-.045)/.655;

  // Stand long enough for the settled idle to record where it actually stands.
  for(const player of [p,control]){player.enterLevel('slam-test');player.respawn(level,true,true);}
  runtimes[0].restart();runtimes[1].restart();
  for(let f=0;f<75;f++){for(const player of [p,control]){player.step(1/60,makeInput(),level);player.commitRenderStep(level);}level.update(1/60);}
  assert.ok(p.idleStanceValid,'the settled idle never recorded its stance');
  const standing={head:point(p,'head').y-p.pos.y,hips:point(p,'hips').y-p.pos.y,soles:soles(p).map(v=>v.sub(p.pos))};

  const rows=[],results=[];let frames=0;
  const drop=(player,runtime,height)=>{
    player.enterLevel('slam-test');player.respawn(level,true,true);runtime.restart();
    player.pos.y=height;player.prevPos.copy(player.pos);player.state='air';player.grounded=false;
    player.freeSkate=player.airFromSkate=false;player.airGrav='foot';player.vVel=0;
  };
  for(const fps of [30,60,120])for(const height of [.25,2,8])for(const running of [false,true]){
    drop(p,runtimes[0],height);drop(control,runtimes[1],height);
    const scale=fps/60,history=[],hang=[],grounded=[];
    let impactFrame=-1,lockEnd=-1,controlFree=-1,impact=null,lastPitch=null,lastStep=null,previousHip=null;
    let forwardTurn=0,backwardTurn=0,maxStep=0,maxSurge=0,inverted=false,settled=0,marks=null,maxSlide=0,maxSoleHeight=0,minClearance=Infinity;
    let lastSlamHead=null,handoffJump=null,fastest=0;
    for(let f=0;f<fps*3.6;f++){
      const input=()=>makeInput({grabHeld:f===0,grabPressed:f===0,moveY:running&&f>0?1:0});
      for(const player of [p,control]){player.step(1/fps,input(),level);player.commitRenderStep(level);}
      level.update(1/fps);frames++;
      assert.ok(Math.abs(p.bodyGroup.scale.y-1.36)<1e-8,'whole skeleton was squashed');
      for(const node of p.animationRig.joints)assert.ok(node.node.scale.toArray().every(v=>v>0),'invalid joint scale');
      history.push({pos:control.pos.clone(),speed:control.speed,state:control.state,grounded:control.grounded,vVel:control.vVel,walk:control.walkVelocity.clone()});
      if(impactFrame>=0&&controlFree<0&&control.slamFlatT===0)controlFree=f;
      // The floaty slam hangs longer and eases into its fall, but it comes
      // straight down and never falls faster than the native peak speed.
      if(impactFrame<0){
        assert.ok(Math.hypot(p.pos.x-control.pos.x,p.pos.z-control.pos.z)<1e-8&&p.speed===control.speed,'slam presentation moved the body sideways');
        assert.ok(p.vVel>=-CONST.slamSpeed-1e-9&&p.vVel<=1e-9,`slam fell outside its authored speed: ${p.vVel}`);
        fastest=Math.max(fastest,-p.vVel);
        if(p.slamFlatT>0){
          impactFrame=f;impact=p.pos.clone();
          assert.ok(Math.abs(p.slamFlatDuration-lock)<1e-9&&Math.abs(control.slamFlatDuration-CONST.slamFlat)<1e-9,
            `each presentation owns its recovery: ${p.slamFlatDuration} / ${control.slamFlatDuration}`);
        }
      }
      const hipNode=joint(p,'hips'),hip=hipNode.getWorldQuaternion(new THREE.Quaternion()).normalize();
      const local=up.clone().applyQuaternion(hipNode.quaternion),pitch=Math.atan2(local.z,local.y);
      const head=point(p,'head').y-p.pos.y,hipY=point(p,'hips').y-p.pos.y;
      const chestUp=up.clone().applyQuaternion(joint(p,'chest').getWorldQuaternion(new THREE.Quaternion()));
      const width=point(p,'wristLeft').distanceTo(point(p,'wristRight'));
      const lengths=Object.fromEntries(ELASTIC_LENGTH_CONTROLS.map(([id])=>[id,p.playerAnimationBridge.deformationValue(id)]));
      const age=p.slamFlatT>0?p.slamFlatDuration-p.slamFlatT:-1,hangAge=p.slamHangDuration-p.slamHangT;
      if(p.slamActive&&p.slamHangT>0)hang.push({age:hangAge,pitch,head});
      let clearance=null;
      if(age>=0){
        // The dead stop holds for the whole authored recovery, even with the stick held.
        assert.ok(p.pos.distanceTo(impact)<1e-8&&p.speed===0,'the recovery lock let the body move');
        clearance=p.interactionMeasure.sampledPlaneDistance(p.riderG,up,p.pos);minClearance=Math.min(minClearance,clearance);
        assert.ok(clearance>-.005,`slam penetrated the floor: ${clearance} (${fps}/${height}/${running}, age ${age})`);
        if(age>=.035)assert.ok(clearance<.03,`the recovery left the ground at age ${age}: ${clearance}`);
        assert.ok(ankleGap(p)>.1,`the recovery crossed its legs at age ${age}: ${ankleGap(p)}`);
        const step=lastPitch===null?0:Math.atan2(Math.sin(pitch-lastPitch),Math.cos(pitch-lastPitch));
        if(age>1.5/fps){
          maxStep=Math.max(maxStep,Math.abs(hip.angleTo(previousHip))*scale);
          // Eased, not just bounded: the turn's speed may only change gradually.
          if(lastStep!==null&&age>.05+1.5/fps)maxSurge=Math.max(maxSurge,Math.abs(step-lastStep)*scale*scale);
        }
        if(age>=PANCAKE_SLAM.flatEnd-ground&&age<=crouch+.07){forwardTurn+=Math.max(0,step);backwardTurn+=Math.min(0,step);}
        if(local.y<-.8)inverted=true;
        lastStep=step;lastSlamHead=point(p,'head');
        grounded.push({age,head,hipY,width,chestUpY:chestUp.y,lengths,localUp:local.y,clearance});
        if(age>=feetDown+.04){
          // Landed soles never slide and never float: the rise happens over them.
          const now=toes(p);marks??=now.map(v=>v.clone());
          now.forEach((toe,i)=>{maxSlide=Math.max(maxSlide,Math.hypot(toe.x-marks[i].x,toe.z-marks[i].z));
            maxSoleHeight=Math.max(maxSoleHeight,toe.y-p.pos.y);});
        }
      }else if(impactFrame>=0){
        if(lockEnd<0){lockEnd=f;handoffJump=point(p,'head').distanceTo(lastSlamHead);}
        // The longer lock only delays the very same movement.
        const delay=lockEnd-controlFree,then=history[f-delay];
        assert.ok(p.pos.distanceTo(then.pos)<1e-7&&Math.abs(p.speed-then.speed)<1e-9&&p.walkVelocity.distanceTo(then.walk)<1e-9&&
          p.state===then.state&&p.grounded===then.grounded,`movement after the lock is not the native movement, delayed (${fps}/${height}/${running}, frame ${f})`);
        if(!running&&f<lockEnd+fps/4)toes(p).forEach((toe,i)=>{
          maxSlide=Math.max(maxSlide,Math.hypot(toe.x-marks[i].x,toe.z-marks[i].z));});
        if(f>impactFrame+fps*1.9){
          assert.ok(['player.idle','player.run'].includes(runtimes[0].activeClipId),'slam did not return to locomotion');settled++;
        }
      }
      if(fps===60&&height===2&&!running)rows.push({f,age,hangAge:p.slamActive?hangAge:-1,head,width,chestUp:chestUp.toArray(),hipY,pitch,
        active:runtimes[0].activeClipId,time:runtimes[0].diagnostics.timelineTime,lengths,bodyY:p.bodyGroup.position.y,clearance,
        soles:soles(p).map(v=>v.sub(p.pos).toArray()),ankles:[point(p,'ankleLeft').y-p.pos.y,point(p,'ankleRight').y-p.pos.y]});
      lastPitch=pitch;previousHip=hip;
    }
    assert.ok(grounded.length>0&&settled>0&&lockEnd>0,'fixture missed impact or recovery');
    const span=(from,to)=>grounded.filter(row=>row.age>=from-1e-9&&row.age<=to+1e-9);
    const limbs=row=>ELASTIC_LENGTH_CONTROLS.filter(([,part])=>part>0).map(([id])=>row.lengths[id]);

    // Anticipation: recoil past the coil, then a hold that stays alive without wandering.
    const coil=hang.filter(row=>row.age>=PANCAKE_SLAM.coil-.005&&row.age<=PANCAKE_SLAM.dive-.03),recoil=Math.min(...hang.filter(row=>row.age<=PANCAKE_SLAM.coil-.02).map(row=>row.pitch));
    assert.ok(coil.length>=3&&PANCAKE_SLAM.dive-PANCAKE_SLAM.coil>.15,'missing readable anticipation hold');
    if(height>=8)assert.ok(fastest>CONST.slamSpeed-1e-6,`a long drop never reached the native peak speed: ${fastest}`);
    const coilPitch=coil.map(row=>row.pitch),coilHead=coil.map(row=>row.head);
    assert.ok(Math.max(...coilPitch)-Math.min(...coilPitch)<.16&&Math.max(...coilHead)-Math.min(...coilHead)<.1,
      `the anticipation hold wandered: ${Math.max(...coilPitch)-Math.min(...coilPitch)} rad, ${Math.max(...coilHead)-Math.min(...coilHead)} m`);
    assert.ok(Math.max(...coilPitch)<-.35,`the coil is not reared back: ${Math.max(...coilPitch)}`);
    assert.ok(recoil<coilPitch[0]-.08,`the recoil did not overshoot the coil it settles into: ${recoil} vs ${coilPitch[0]}`);
    assert.ok(hang.at(-1).pitch>.75,`the dive is not belly-first by the end of the hang: ${hang.at(-1).pitch}`);

    // Impact: a flat, spread, stretched pancake whose torso squashes hardest first.
    const flat=span(at(.05),at(.12)),hit=span(.02,.045);
    assert.ok(flat.length>0&&hit.length>0,'fixture missed the flat pancake');
    for(const row of flat){
      assert.ok(Math.abs(row.chestUpY)<.45,`slam did not stay belly-down through its rebound: ${row.chestUpY}`);
      assert.ok(row.width>1.8,`pancake lost its outward limb stretch: ${row.width}`);
      assert.ok(row.lengths['deform.torso.length']<1,'contact torso did not compress');
      assert.ok(Math.min(...limbs(row))>1.2,`a limb shortened instead of stretching at impact: ${Math.min(...limbs(row))}`);
    }
    const squash=Math.min(...hit.map(row=>row.lengths['deform.torso.length']));
    const rebound=Math.max(...span(at(.06),at(.11)).map(row=>row.lengths['deform.torso.length']));
    assert.ok(squash<.7&&rebound>squash+.12,`the pancake did not squash and rebound: ${squash} -> ${rebound}`);
    const flatHead=Math.min(...hit.map(row=>row.head)),reboundHead=Math.max(...span(at(.06),at(.11)).map(row=>row.head));
    assert.ok(reboundHead>flatHead+.04,`the rebound never lifted the chest: ${flatHead} -> ${reboundHead}`);

    // Roll: one tucked forward turn on the floor, eased in and out.
    const tuck=Math.min(...span(at(.2),at(.34)).map(row=>row.width));
    assert.ok(tuck<Math.min(...flat.map(row=>row.width))*.6,`roll did not gather the spread limbs: ${tuck}`);
    assert.ok(inverted&&forwardTurn>4.3,`recovery did not roll forward onto its feet: ${JSON.stringify({fps,height,running,inverted,forwardTurn})}`);
    assert.ok(backwardTurn>-.07,`forward roll reversed before landing: ${backwardTurn}`);
    assert.ok(maxStep<.47,`recovery rotation snapped: ${maxStep} radians per 60 Hz frame`);
    assert.ok(maxSurge<.16,`recovery rotation lurched: ${maxSurge} radians per 60 Hz frame squared`);

    // Rise: load low over planted soles, spring past standing, settle into idle.
    const low=Math.min(...span(feetDown,spring).map(row=>row.hipY)),peak=Math.max(...span(spring-.07,spring+.08).map(row=>row.head));
    const stretch=Math.max(...span(spring-.07,spring+.08).map(row=>row.lengths['deform.torso.length']));
    assert.ok(low<standing.hips*.7,`the rise never loaded a crouch: ${low} vs standing ${standing.hips}`);
    assert.ok(peak>standing.head+.05&&stretch>1.08,`the rise did not spring past standing: head ${peak} vs ${standing.head}, torso ${stretch}`);
    assert.ok(span(crouch,lock).every(row=>row.localUp>.93),'the rise did not stay upright over its feet');
    assert.ok(maxSlide<.025&&maxSoleHeight<.035,`planted soles moved: slid ${maxSlide} m, rose ${maxSoleHeight} m`);
    if(!running){
      assert.ok(handoffJump<.02,`the handoff to idle popped: ${handoffJump} m`);
      soles(p).forEach((sole,i)=>assert.ok(sole.sub(p.pos).distanceTo(standing.soles[i])<.015,'the recovery did not finish in the idle stance'));
    }
    results.push({fps,height,running,recoil,coilDrift:Math.max(...coilPitch)-Math.min(...coilPitch),squash,rebound,flatHead,reboundHead,tuck,
      forwardTurn,backwardTurn,maxStep,maxSurge,low,peak,stretch,maxSlide,maxSoleHeight,minClearance,handoffJump,lockFrames:lockEnd-impactFrame});
  }

  // Facing somewhere new since the idle last stood still must not swap the
  // marks: the body turns inside its root, so the stance travels with the facing.
  p.enterLevel('slam-test');p.respawn(level,true,true);runtimes[0].restart();
  let narrowest=Infinity,turned=0;
  for(let f=0;f<330;f++){
    const walking=f>=90&&f<125,slam=f===150;
    if(slam){turned=p.bodyGroup.rotation.y;p.pos.y=2;p.prevPos.copy(p.pos);p.state='air';p.grounded=false;p.freeSkate=p.airFromSkate=false;p.airGrav='foot';p.vVel=0;}
    p.step(1/60,makeInput({moveY:walking?-1:0,grabHeld:slam,grabPressed:slam}),level);p.commitRenderStep(level);level.update(1/60);frames++;
    if(p.slamFlatT>0)narrowest=Math.min(narrowest,ankleGap(p));
  }
  assert.ok(Math.abs(Math.atan2(Math.sin(turned),Math.cos(turned)))>2,`fixture never turned the body around: ${turned}`);
  assert.ok(narrowest>.1&&Number.isFinite(narrowest),`a slam after turning around crossed its legs: ${narrowest}`);

  // Never having idled, the recovery still lands and holds its own footing.
  drop(fresh,runtimes[2],2);
  assert.ok(!fresh.idleStanceValid,'fixture expected an unmeasured stance');
  let marks=null,slide=0,height=0;
  for(let f=0;f<240;f++){
    fresh.step(1/60,makeInput({grabHeld:f===0,grabPressed:f===0}),level);fresh.commitRenderStep(level);level.update(1/60);frames++;
    const age=fresh.slamFlatT>0?fresh.slamFlatDuration-fresh.slamFlatT:-1;
    if(age>=feetDown+.04&&age<=spring){
      const now=toes(fresh);marks??=now.map(v=>v.clone());
      now.forEach((toe,i)=>{slide=Math.max(slide,Math.hypot(toe.x-marks[i].x,toe.z-marks[i].z));height=Math.max(height,toe.y-fresh.pos.y);});
    }
  }
  assert.ok(marks&&slide<.03&&height<.07,`unmeasured stance did not hold its soles: slid ${slide} m, rose ${height} m`);
  assert.ok(['player.idle','player.run'].includes(runtimes[2].activeClipId),'unmeasured stance did not return to locomotion');

  runtimes.forEach(r=>r.dispose());
  const report={status:'pass',frames,results,rows};
  if(process.argv[2])await writeFile(process.argv[2],JSON.stringify(report,null,2));
  console.log(JSON.stringify({...report,rows:undefined},null,2));
},{levelEntry:{id:'slam-test',name:'Slam test',data:{v:1,name:'Slam test',spawn:[0,.02,6],killY:-30,
  components:[{t:'platform',p:[0,-.5,0],s:[200,1,200],edgeGrinding:false},{t:'gate',p:[80,0,-80]}]}}});
