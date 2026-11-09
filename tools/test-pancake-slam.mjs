import assert from 'node:assert/strict';
import {readFile,writeFile} from 'node:fs/promises';
import {gunzipSync} from 'node:zlib';
import {withSkateRuntime,makeInput} from './jungle-cup-harness.mjs';

const bank=JSON.parse(gunzipSync(await readFile(new URL('../public/motion-study/jak/motion.json.gz',import.meta.url))));
await withSkateRuntime(async({server,scene,level,Player,THREE,CONST})=>{
  const {RigBinding,createPlayerStarterAnimationSuite,ELASTIC_LENGTH_CONTROLS}=await server.ssrLoadModule('/src/animation/index.ts');
  const {createJakDirectSuite,JAK_DIRECT_PHYSICS}=await server.ssrLoadModule('/tools/jak-direct-motion.ts');
  const {createCharacterAnimationRuntime}=await server.ssrLoadModule('/src/characterAnimationRuntime.ts');
  const players=[new Player(scene),new Player(scene)],[p,control]=players;
  const runtimes=players.map((player,i)=>{
    const rig=RigBinding.fromSculptRuntime(player.animationRig.root).definition,base=createPlayerStarterAnimationSuite(rig);
    return createCharacterAnimationRuntime(player,i?base:createJakDirectSuite(base,rig,bank));
  });
  p.onFootJumpStudy={...JAK_DIRECT_PHYSICS,flip:true};
  const point=id=>p.animationRig.jointsById.get(id).node.getWorldPosition(new THREE.Vector3());
  const rows=[],results=[];let frames=0;
  for(const fps of [30,60,120])for(const height of [.25,2,8])for(const running of [false,true]){
    players.forEach((player,i)=>{
      player.enterLevel('slam-test');player.respawn(level,true,true);runtimes[i].restart();
      player.pos.y=height;player.prevPos.copy(player.pos);player.state='air';player.grounded=false;
      player.freeSkate=player.airFromSkate=false;player.airGrav='foot';player.vVel=0;
    });
    let flat=0,impactHead=Infinity,reboundHead=-Infinity,impactHip=Infinity,reboundHip=-Infinity,minClearance=Infinity,maxStep=0,previous=null,settled=0;
    let minImpactLimbLength=Infinity,minImpactWidth=Infinity;
    let held=null,holdFrames=0,lastPitch=null,forwardTurn=0,backwardTurn=0,inverted=false,feetFirst=false;
    for(let f=0;f<fps*2.5;f++){
      for(const player of players){player.step(1/fps,makeInput({grabHeld:f===0,grabPressed:f===0,moveY:running&&f>0?1:0}),level);player.commitRenderStep(level);}
      level.update(1/fps);frames++;
      assert.ok(p.pos.distanceTo(control.pos)<1e-8,'slam presentation changed movement');
      for(const key of ['state','grounded','vVel','speed','slamActive','slamHangT','slamFlatT','slamSquash'])
        assert.equal(p[key],control[key],`slam presentation changed ${key}`);
      assert.ok(Math.abs(p.bodyGroup.scale.y-1.36)<1e-8,'whole skeleton was squashed');
      for(const node of p.animationRig.joints)assert.ok(node.node.scale.toArray().every(v=>v>0),'invalid joint scale');
      const hip=p.animationRig.jointsById.get('hips').node.getWorldQuaternion(new THREE.Quaternion()).normalize();
      const head=point('head').y-p.pos.y,age=p.slamFlatT>0?CONST.slamFlat-p.slamFlatT:-1;
      const chestUp=new THREE.Vector3(0,1,0).applyQuaternion(p.animationRig.jointsById.get('chest').node.getWorldQuaternion(new THREE.Quaternion()));
      const width=point('wristLeft').distanceTo(point('wristRight'));
      const lengths=Object.fromEntries(ELASTIC_LENGTH_CONTROLS.map(([id])=>[id,p.playerAnimationBridge.deformationValue(id)]));
      const hangAge=CONST.slamHang-p.slamHangT;
      if(p.slamActive&&hangAge>=.10&&hangAge<=.23){
        const localHip=p.animationRig.jointsById.get('hips').node.quaternion.clone();
        if(held){assert.ok(localHip.angleTo(held.hip)<1e-5,`anticipation kept rotating through the pause (${fps}/${height}/${running}, age ${hangAge}, delta ${localHip.angleTo(held.hip)})`);
          assert.ok(Math.abs(head-held.head)<1e-5,`anticipation kept drifting through the pause: ${head-held.head}`);}
        held={hip:localHip,head};holdFrames++;
      }
      let clearance=null;
      if(age>=0){
        clearance=p.interactionMeasure.sampledPlaneDistance(p.riderG,new THREE.Vector3(0,1,0),p.pos);
        minClearance=Math.min(minClearance,clearance);
        assert.ok(clearance>-.005,`slam penetrated the floor: ${clearance} (${fps}/${height}/${running}, age ${age}, body ${p.bodyGroup.position.y}, pos ${p.pos.y}, ground ${p.groundHit?.y}, root ${p.group.position.y})`);
        if(age>=.43&&age<=.48)assert.ok(clearance<.012,`finished roll did not plant its feet: ${clearance}`);
        if(previous)maxStep=Math.max(maxStep,hip.angleTo(previous)*fps/60);
        if(age>=.035&&age<=.075){
          flat++;impactHead=Math.min(impactHead,head);
          impactHip=Math.min(impactHip,point('hips').y-p.pos.y);
          assert.ok(Math.abs(chestUp.y)<.4,'slam did not reach its falling/contact pose');
          minImpactWidth=Math.min(minImpactWidth,width);
          assert.ok(width>1.8,`pancake impact lost its outward limb stretch: ${width}`);
          assert.ok(lengths['deform.torso.length']<1,'contact torso did not compress');
          for(const [id,part]of ELASTIC_LENGTH_CONTROLS)if(part>0){
            minImpactLimbLength=Math.min(minImpactLimbLength,lengths[id]);
            assert.ok(lengths[id]>1.2,`${id} shortened instead of stretching at impact: ${lengths[id]}`);
          }
        }
        if(age>=.12&&age<.20){reboundHead=Math.max(reboundHead,head);reboundHip=Math.max(reboundHip,point('hips').y-p.pos.y);}
        if(age>=.035&&age<=.48){
          const local=p.animationRig.jointsById.get('hips').node.quaternion;
          const up=new THREE.Vector3(0,1,0).applyQuaternion(local),pitch=Math.atan2(up.z,up.y);
          if(lastPitch!==null){const step=Math.atan2(Math.sin(pitch-lastPitch),Math.cos(pitch-lastPitch));
            forwardTurn+=Math.max(0,step);backwardTurn+=Math.min(0,step);}
          lastPitch=pitch;
          if(up.y<-.8)inverted=true;
          if(age>=.43&&up.y>.96)feetFirst=true;
        }
      }else if(f>fps*1.5){
        assert.ok(['player.idle','player.run'].includes(runtimes[0].activeClipId),'slam did not return to locomotion');settled++;
      }
      if(fps===60&&height===2&&!running)rows.push({f,age,head,width,chestUp:chestUp.toArray(),hipY:point('hips').y-p.pos.y,
        active:runtimes[0].activeClipId,time:runtimes[0].diagnostics.timelineTime,lengths,bodyY:p.bodyGroup.position.y,
        clearance,ankles:[point('ankleLeft').y-p.pos.y,point('ankleRight').y-p.pos.y]});
      previous=hip;
    }
    assert.ok(flat>0&&settled>0,'fixture missed impact or recovery');
    // The head moves down while the hips roll over it. Measure the rebound at
    // the pelvis, not by demanding the rejected high whole-body belly lift.
    assert.ok(reboundHip>impactHip+.15,`missing visible rebound: ${impactHip} -> ${reboundHip}`);
    assert.ok(holdFrames>=3,'missing readable anticipation pause');
    assert.ok(inverted&&feetFirst&&forwardTurn>4.0,`rebound did not complete its forward flip onto the feet: ${JSON.stringify({fps,height,running,inverted,feetFirst,forwardTurn})}`);
    assert.ok(backwardTurn>-.07,'forward rebound reversed before landing');
    assert.ok(maxStep<.44,`recovery rotation snapped: ${maxStep} radians per 60 Hz frame`);
    results.push({fps,height,running,impactHead,reboundHead,impactHip,reboundHip,minImpactLimbLength,minImpactWidth,minClearance,maxStep,holdFrames,forwardTurn,backwardTurn});
  }
  runtimes.forEach(r=>r.dispose());
  const report={status:'pass',frames,results,rows};
  if(process.argv[2])await writeFile(process.argv[2],JSON.stringify(report,null,2));
  console.log(JSON.stringify({...report,rows:undefined},null,2));
},{levelEntry:{id:'slam-test',name:'Slam test',data:{v:1,name:'Slam test',spawn:[0,.02,6],killY:-30,
  components:[{t:'platform',p:[0,-.5,0],s:[200,1,200],edgeGrinding:false},{t:'gate',p:[80,0,-80]}]}}});
