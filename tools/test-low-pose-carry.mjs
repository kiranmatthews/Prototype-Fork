import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {gunzipSync} from 'node:zlib';
import {withSkateRuntime,makeInput} from './jungle-cup-harness.mjs';

// D carries the body between standing, the crouch and the crawl in place of
// the native five-frame clips and crossfades. That is presentation only: the
// same inputs must move the player exactly as the native suite does. Every
// way between the three (down and up, into the crawl and out of it, up off
// all fours to a stand or a run, a tap, a crawl begun before the crouch has
// arrived) must go without a jump in pose or speed, with the feet planted
// through a crouch, and with nothing put through the floor. The crawl itself
// must cover the ground its planted hands sweep, go the way the stick sends
// it and turn to face that way, at any pace it is set to. And none of it may
// depend on where in its cycle a crawl is stopped, or on how hard the stick
// is pushed.
const bank=JSON.parse(gunzipSync(await readFile(new URL('../public/motion-study/jak/motion.json.gz',import.meta.url))));
// Circle and the stick, as [from, to) seconds after a settled stand.
const PLANS={
  crouch:{circle:[0,1.0],stick:[9,9]},
  tap:{circle:[0,.25],stick:[9,9]},
  crawl:{circle:[0,3.0],stick:[.9,2.0]},
  'crawl-stand':{circle:[0,1.8],stick:[.6,1.8]},
  'crawl-run':{circle:[0,1.8],stick:[.6,9]},
  'quick-crawl':{circle:[0,1.5],stick:[.1,1.5]},
};
// The largest change of world speed in one frame, m/s, that a part may show.
// The native cuts show 12 to 15 on the body and 20 to 50 on the limbs. It is
// judged at 60 Hz, the step the game always simulates at: the crawl's clock
// counts distance in whole steps, so at 30 or 120 Hz a different crawl plays
// and these are no longer the same motions. Those rates still check the
// order of clips, the floor, the planted feet and the timing.
// LOW_POSE_REPORT=1 lists every failure instead of stopping at the first.
// LOW_POSE_ONLY=plans|ways|caught runs one of the three parts alone.
const KINK={hips:4.5,chest:4.5,head:5,wristLeft:6.5,wristRight:6.5,kneeLeft:10.5,kneeRight:10.5,ankleLeft:6.5,ankleRight:6.5};
const problems=[],check=(ok,message)=>{if(ok)return;if(process.env.LOW_POSE_REPORT)problems.push(message);else assert.fail(message);};
const part=name=>!process.env.LOW_POSE_ONLY||process.env.LOW_POSE_ONLY===name;
await withSkateRuntime(async({server,scene,level,Player,THREE,TUNING})=>{
  const {RigBinding,createPlayerStarterAnimationSuite}=await server.ssrLoadModule('/src/animation/index.ts');
  const {createJakDirectSuite,JAK_DIRECT_PHYSICS}=await server.ssrLoadModule('/tools/jak-direct-motion.ts');
  const {createCharacterAnimationRuntime}=await server.ssrLoadModule('/src/characterAnimationRuntime.ts');
  const {CRAWL_STRIDE_METRES}=await server.ssrLoadModule('/src/animation/crouch.ts');
  const {JAK_LOW_CUTS}=await server.ssrLoadModule('/src/animation/jakLowMotion.ts');
  const {PoseInertia,WeightInertia}=await server.ssrLoadModule('/src/animation/poseInertia.ts');

  // A layer's weight is let go without a step and without swinging past.
  const weight=new WeightInertia();
  weight.cut(1,0,[10,1]);
  let last=1;
  for(let f=0;f<180;f++){
    const value=weight.apply(0,1/60);
    assert.ok(value<=last+1e-12&&value>=0,`a carried weight rose or swung past at frame ${f} (${last} -> ${value})`);
    if(f===0)assert.ok(value>.995,`a carried weight stepped on its cut (${value})`);
    last=value;
  }
  assert.equal(last,0,'a carried weight never arrived');
  assert.equal(new PoseInertia().rootLeft,0,'an idle carry reported something left');
  // A cut that carries the feet leaves the legs to whoever carries them: they
  // take the new motion at once, and the cut says how far the feet have to go.
  {
    const turn=angle=>[Math.sin(angle/2),0,0,Math.cos(angle/2)];
    const pose=angle=>({joints:{hips:{quaternion:turn(angle)},hipLeft:{quaternion:turn(angle)},kneeLeft:{quaternion:turn(angle)}},scalars:{}});
    const shape={root:[12,1],legs:[12,1],spine:[12,1],head:[12,1],arms:[12,1],lengths:[12,1],carry:[0,0,0]};
    const plain=new PoseInertia(),carried=new PoseInertia();
    plain.cut(pose(1),pose(0),pose(0),1/60,shape);
    carried.cut(pose(1),pose(0),pose(0),1/60,{...shape,feet:[10,1]});
    assert.equal(plain.feet,null,'a cut that carries no feet reported some');
    assert.ok(carried.feet&&carried.feet[0]===1&&carried.feet[1]===0,`the feet were not all the way back on the cut (${carried.feet})`);
    const angle=q=>2*Math.atan2(Math.abs(q[0]),Math.abs(q[3]));
    const a=plain.apply(pose(1),1/60),b=carried.apply(pose(1),1/60);
    assert.ok(angle(a.joints.kneeLeft.quaternion)<.1,'a plain cut let a leg go on its first frame');
    assert.ok(Math.abs(angle(b.joints.kneeLeft.quaternion)-1)<1e-9&&Math.abs(angle(b.joints.hipLeft.quaternion)-1)<1e-9,
      'a cut that carries the feet still carried the legs joint by joint');
    assert.ok(angle(b.joints.hips.quaternion)<.1,'a cut that carries the feet let the pelvis go at once');
    let left=1;
    for(let f=0;f<240&&carried.feet;f++){
      assert.ok(carried.feet[0]<=left+1e-12&&carried.feet[0]>=-1e-9,`the feet's way back grew or swung past at frame ${f}`);
      left=carried.feet[0];carried.apply(pose(1),1/60);
    }
    assert.ok(left<1e-3&&carried.feet===null,`the feet never arrived (${left})`);
  }

  const results=[];
  for(const fps of part('plans')?[30,60,120]:[])for(const [mode,plan] of Object.entries(PLANS)){
    const players=[new Player(scene),new Player(scene)],[p,control]=players;
    const runtimes=players.map((player,i)=>{
      const rig=RigBinding.fromSculptRuntime(player.animationRig.root).definition,base=createPlayerStarterAnimationSuite(rig);
      return createCharacterAnimationRuntime(player,i?base:createJakDirectSuite(base,rig,bank));
    });
    p.onFootJumpStudy=control.onFootJumpStudy={...JAK_DIRECT_PHYSICS,flip:true};
    for(const [i,player] of players.entries()){player.enterLevel('low-test');player.respawn(level,true,true);runtimes[i].restart();}
    const joint=id=>p.animationRig.jointsById.get(id).node,v=new THREE.Vector3();
    const world=id=>joint(id).getWorldPosition(new THREE.Vector3());
    const socket=(part,side)=>p.group.getObjectByName(`socket-${part}-${side}`).getWorldPosition(new THREE.Vector3());
    // A shoe's tip is as far ahead of the middle of its sole as the heel is behind: the point a foot up on its toes stands on.
    const tips=()=>['left','right'].map(side=>socket('foot',side).multiplyScalar(2).sub(socket('heel',side)));
    const measure=new p.interactionMeasure.constructor(),up=new THREE.Vector3(0,1,0);
    const soleDepth=()=>{
      let low=Infinity;
      for(const {sole} of p.proceduralFootwear){
        const points=sole.geometry.getAttribute('position');
        for(let i=0;i<points.count;i++)low=Math.min(low,v.fromBufferAttribute(points,i).applyMatrix4(sole.matrixWorld).y-p.pos.y);
      }
      return -low;
    };
    const handDepth=()=>-Math.min(...[p.wristL,p.wristR].map(hand=>measure.sampledPlaneDistance(hand,up,p.pos)));
    const dt=1/fps,idle=Math.round(fps*1.8),at=seconds=>idle+Math.round(fps*seconds);
    const down=at(plan.circle[0]),release=at(plan.circle[1]),crawls=plan.stick[0]<9;
    const clips=[],kinks=Object.fromEntries(Object.keys(KINK).map(id=>[id,0])),history=[];
    let sink=0,dig=0,kneel=Infinity,slip=0,lift=0,held=null,lowest=Infinity,settled=null,crouchedBy=-1,stoodBy=-1,layerStep=0,previousLayers=null;
    let gather=0,ranAt=-1,phase=0,metres=0,previousTime=null,plantSlip=0,plant=null;
    const before=new THREE.Vector3();
    for(let f=0;f<idle+fps*4.6;f++){
      const t=(f-idle)*dt,circle=f>=down&&f<release,stick=t>=plan.stick[0]&&t<plan.stick[1];
      const input=()=>makeInput({grabHeld:circle,grabPressed:f===down,moveY:stick?1:0});
      before.copy(p.pos);
      for(const player of players){player.step(dt,input(),level);player.commitRenderStep(level);}
      level.update(dt);
      // Presentation never moves the player.
      assert.ok(p.pos.distanceTo(control.pos)<1e-9&&Math.abs(p.vVel-control.vVel)<1e-9&&p.state===control.state,
        `${mode}@${fps}: carrying the low poses changed movement at frame ${f}`);
      if(f<down-3)continue;
      const clip=runtimes[0].activeClipId,time=runtimes[0].diagnostics.timelineTime??0;
      if(clips.at(-1)!==clip)clips.push(clip);
      if(clip==='player.run'&&ranAt<0)ranAt=f;
      history.push(Object.fromEntries(Object.keys(KINK).map(id=>[id,world(id)])));
      // A run's own stride is the ordinary one and is not judged here.
      if(history.length>=3&&(ranAt<0||(f-ranAt)*dt<.2)){
        const [a,b,c]=history.slice(-3);
        for(const id of Object.keys(KINK))kinks[id]=Math.max(kinks[id],v.copy(c[id]).addScaledVector(b[id],-2).add(a[id]).length()*fps*fps/60);
      }
      if(f<down)continue;
      // The layers outside the pose are carried too: none switches in a frame.
      const layers=[p.characterUpperArmRestAngleWeight,p.authoredCrawlPalmWeight];
      if(previousLayers)layerStep=Math.max(layerStep,...layers.map((value,i)=>Math.abs(value-previousLayers[i])*fps/60));
      previousLayers=layers;
      if(p.grounded&&ranAt<0){
        // Nothing goes through the floor: no sole, no hand, and no knee.
        sink=Math.max(sink,soleDepth());dig=Math.max(dig,handDepth());
        kneel=Math.min(kneel,world('kneeLeft').y-p.pos.y,world('kneeRight').y-p.pos.y);
      }
      const hips=world('hips').y-p.pos.y;
      if(!crawls){
        // A crouch folds over the feet the stand left on the floor, down and up again.
        if(f<release+Math.round(fps*.3)){
          const here=tips();
          if(held)slip=Math.max(slip,...here.map((point,i)=>Math.hypot(point.x-held[i].x,point.z-held[i].z)));
          else held=here;
        }
        lift=Math.max(lift,-soleDepth());
        if(f<release){
          lowest=Math.min(lowest,hips);
          if(f===release-1)settled=hips;
        }else if(stoodBy<0&&hips>.95)stoodBy=(f-release)*dt;
      }
      if(mode==='crouch'&&f<release&&crouchedBy<0&&hips<.70)crouchedBy=(f-down)*dt;
      if(clip==='player.crouch'&&f>=release)gather+=dt;
      if(clip==='player.crawl'&&mode==='crawl-run'){
        // The crawl plays one cycle for every stride it covers, and a hand
        // that is down stays where it came down: it neither runs ahead of
        // the body nor is dragged along behind it. (The clip also draws the
        // hand in under the chest as it pulls; that sideways part is its own.)
        const crawl=runtimes[0].document.clips.find(candidate=>candidate.id==='player.crawl');
        if(previousTime!==null&&(f-at(plan.stick[0]))*dt>.5){
          const step=Math.hypot(p.pos.x-before.x,p.pos.z-before.z);
          phase+=((time-previousTime+crawl.duration)%crawl.duration)/crawl.duration;
          metres+=step;
          // The clip has the left wrist down from 5% to 55% of its cycle.
          const cycle=time/crawl.duration,wrist=world('wristLeft');
          if(cycle>.05&&cycle<.55&&step>1e-6){
            const along=(wrist.x*(p.pos.x-before.x)+wrist.z*(p.pos.z-before.z))/step;
            if(plant!==null)plantSlip=Math.max(plantSlip,Math.abs(along-plant));
            else plant=along;
          }else plant=null;
        }
        previousTime=time;
      }
    }
    const flow=clips.map(id=>id.replace('player.','')).join('>');
    check(!clips.some(id=>/crouch-enter|crouch-exit|run-stop/.test(id)),`${mode}@${fps}: a native transition clip played (${flow})`);
    check(flow===({crouch:'idle>crouch>idle',tap:'idle>crouch>idle',crawl:'idle>crouch>crawl>crouch>idle','crawl-stand':'idle>crouch>crawl>crouch>idle',
      'crawl-run':'idle>crouch>crawl>crouch>run','quick-crawl':'idle>crouch>crawl>crouch>idle'})[mode],`${mode}@${fps}: went ${flow}`);
    if(fps===60)for(const [id,limit] of Object.entries(KINK))
      check(kinks[id]<=limit,`${mode}@${fps}: ${id} changed speed by ${kinks[id].toFixed(1)} m/s in a frame (limit ${limit})`);
    if(fps>=60)check(layerStep<.2,`${mode}@${fps}: a layer outside the pose stepped by ${layerStep.toFixed(2)} in a frame`);
    check(sink<.03,`${mode}@${fps}: a sole sank ${sink.toFixed(3)} into the floor`);
    check(dig<.04,`${mode}@${fps}: a hand sank ${dig.toFixed(3)} into the floor`);
    check(kneel>.015,`${mode}@${fps}: a knee came within ${kneel.toFixed(3)} of the floor's far side`);
    if(!crawls){
      check(slip<.02,`${mode}@${fps}: the feet slid ${slip.toFixed(3)} under the crouch`);
      check(lift<.035,`${mode}@${fps}: a foot left the floor by ${lift.toFixed(3)}`);
      check(stoodBy>0&&stoodBy<.42,`${mode}@${fps}: he was not standing again within 0.42 s (${stoodBy})`);
    }
    if(mode==='crouch'){
      check(crouchedBy>0&&crouchedBy<.3,`${mode}@${fps}: he was not down within 0.3 s (${crouchedBy})`);
      // He dips a little under the crouch and comes back: a bounce, not a stop.
      check(settled-lowest>.012&&settled-lowest<.09,`${mode}@${fps}: the crouch dipped ${(settled-lowest).toFixed(3)} under where it settles`);
    }
    if(mode==='crawl-stand'||mode==='crawl-run'){
      // Up off all fours he is carried toward the crouch first, briefly.
      check(gather>JAK_LOW_CUTS.gatherSeconds-2*dt&&gather<JAK_LOW_CUTS.gatherSeconds+2*dt,`${mode}@${fps}: the knees were gathered for ${gather.toFixed(3)} s`);
    }
    if(mode==='crawl-run'){
      // The crawl's clock counts distance in whole simulation steps, which
      // the game always takes at 60 Hz.
      if(fps===60){
        check(Math.abs(metres/Math.max(phase,1e-9)-CRAWL_STRIDE_METRES)<1e-6,`${mode}@${fps}: a crawl cycle covered ${metres/phase} m`);
        check(plantSlip<.06,`${mode}@${fps}: a planted hand slid ${plantSlip.toFixed(3)} m along the way he is going`);
      }
      check(control.walkVelocity.length()>TUNING.walkSpeed*.5,`${mode}@${fps}: the run never got going`);
    }
    results.push({fps,mode,flow,sink:+sink.toFixed(3),dig:+dig.toFixed(3),knee:+kneel.toFixed(3),slip:+slip.toFixed(4),lift:+lift.toFixed(3),
      down:+crouchedBy.toFixed(3),up:+stoodBy.toFixed(3),dip:settled===null?null:+(settled-lowest).toFixed(3),gather:+gather.toFixed(3),
      plantSlip:+plantSlip.toFixed(3),layerStep:+layerStep.toFixed(3),kinks:Object.fromEntries(Object.entries(kinks).map(([id,value])=>[id,+value.toFixed(1)]))});
    for(const runtime of runtimes)runtime.dispose();
    for(const player of players)scene.remove(player.group);
  }
  const wrap=angle=>Math.atan2(Math.sin(angle),Math.cos(angle)),DEG=180/Math.PI,UP=new THREE.Vector3(0,1,0);
  const rider=native=>{
    const player=new Player(scene),rig=RigBinding.fromSculptRuntime(player.animationRig.root).definition,base=createPlayerStarterAnimationSuite(rig);
    const runtime=createCharacterAnimationRuntime(player,native?base:createJakDirectSuite(base,rig,bank));
    player.onFootJumpStudy={...JAK_DIRECT_PHYSICS,flip:true};
    player.enterLevel('low-test');player.respawn(level,true,true);runtime.restart();
    return {player,runtime};
  };
  const floorOf=player=>{
    const v=new THREE.Vector3(),measure=new player.interactionMeasure.constructor();
    let sole=Infinity;
    for(const part of player.proceduralFootwear){
      const points=part.sole.geometry.getAttribute('position');
      for(let i=0;i<points.count;i++)sole=Math.min(sole,v.fromBufferAttribute(points,i).applyMatrix4(part.sole.matrixWorld).y-player.pos.y);
    }
    const knee=Math.min(...['kneeLeft','kneeRight'].map(id=>player.animationRig.jointsById.get(id).node.getWorldPosition(v).y-player.pos.y));
    return {sole,hand:Math.min(...[player.wristL,player.wristR].map(hand=>measure.sampledPlaneDistance(hand,UP,player.pos))),knee};
  };

  // Which way a crawl goes and which way it faces. It goes where the stick
  // sends it at the pace it is set to, and the body turns to face that within
  // a quarter of a second, the same on the native suite as on D: a crawl set
  // slower than the 1.5 m/s that turns everything else used never to turn at
  // all. Pushed under three sevenths of the way the stick still moves him and
  // does not turn him, as it never did. Kinks are judged in the body's own
  // frame here: the turn itself is the old rule and whips a prone body round.
  const S=Math.SQRT1_2;
  const WAYS={ahead:[0,1],'ahead and right':[S,S],right:[1,0],'back and right':[S,-S],back:[0,-1],'back and left':[-S,-S],left:[-1,0],
    'ahead and left':[-S,S],'right at half the stick':[.5,0],'right at a third of the stick':[.33,0]};
  for(const [way,[x,y]] of part('ways')?Object.entries(WAYS):[]){
    const riders=[rider(false),rider(true)],[{player:p},{player:control}]=riders;
    const fps=60,dt=1/fps,down=Math.round(fps*1.8),go=down+Math.round(fps*.6),stop=go+Math.round(fps*1.4),push=Math.hypot(x,y);
    const want=Math.atan2(p.axisF.x*y+p.axisL.x*x,p.axisF.z*y+p.axisL.z*x),facing=()=>wrap(p.visualYaw+Math.PI);
    const turns=push*TUNING.crawlSpeed>Math.min(1.5,TUNING.crawlSpeed*1.5/3.5);
    const kinks=Object.fromEntries(Object.keys(KINK).map(id=>[id,0])),history=[],start=new THREE.Vector3(),v=new THREE.Vector3();
    let first=null,turnedBy=null,strayed=0,sole=Infinity,hand=Infinity,knee=Infinity;
    for(let f=0;f<stop+Math.round(fps*.5);f++){
      const input=()=>makeInput({grabHeld:f>=down,grabPressed:f===down,moveX:f>=go&&f<stop?x:0,moveY:f>=go&&f<stop?y:0});
      for(const {player} of riders){player.step(dt,input(),level);player.commitRenderStep(level);}
      level.update(dt);
      assert.ok(p.pos.distanceTo(control.pos)<1e-9&&Math.abs(wrap(p.visualYaw-control.visualYaw))<1e-9,
        `crawl ${way}: D and the native suite went or faced different ways at frame ${f}`);
      if(f===go-1){start.copy(p.pos);first=facing();}
      if(f<down)continue;
      history.push(Object.fromEntries(Object.keys(KINK).map(id=>[id,p.animationRig.jointsById.get(id).node.getWorldPosition(new THREE.Vector3())
        .sub(p.pos).applyAxisAngle(UP,-p.visualYaw)])));
      if(history.length>=3){
        const [a,b,c]=history.slice(-3);
        for(const id of Object.keys(KINK))kinks[id]=Math.max(kinks[id],v.copy(c[id]).addScaledVector(b[id],-2).add(a[id]).length()*fps);
      }
      const floor=floorOf(p);sole=Math.min(sole,floor.sole);hand=Math.min(hand,floor.hand);knee=Math.min(knee,floor.knee);
      if(f>=go&&f<stop){
        const off=Math.abs(wrap(facing()-want));
        if(turnedBy===null&&off<10/DEG)turnedBy=(f-go)*dt;
        strayed=Math.max(strayed,Math.abs(wrap(facing()-first)));
      }
      if(f===stop-1){
        const went=Math.atan2(p.pos.x-start.x,p.pos.z-start.z),far=Math.hypot(p.pos.x-start.x,p.pos.z-start.z),pace=far/((stop-go)*dt);
        check(Math.abs(wrap(went-want))<1/DEG,`crawl ${way}: went ${(wrap(went-want)*DEG).toFixed(1)} degrees off the stick`);
        check(Math.abs(pace-TUNING.crawlSpeed*push)<.02*TUNING.crawlSpeed,`crawl ${way}: went at ${pace.toFixed(3)} m/s, not ${(TUNING.crawlSpeed*push).toFixed(3)}`);
        if(turns){
          check(turnedBy!==null&&turnedBy<=.25,`crawl ${way}: did not turn to face the way he went within 0.25 s (${turnedBy})`);
          check(Math.abs(wrap(facing()-want))<2/DEG,`crawl ${way}: ended facing ${(wrap(facing()-want)*DEG).toFixed(1)} degrees off the way he went`);
        }else check(strayed<1/DEG,`crawl ${way}: a push too light to turn him turned him ${(strayed*DEG).toFixed(1)} degrees`);
      }
    }
    for(const [id,limit] of Object.entries(KINK))
      check(kinks[id]<=limit,`crawl ${way}: ${id} changed speed by ${kinks[id].toFixed(1)} m/s in a frame within the body (limit ${limit})`);
    check(sole>-.03&&hand>-.04&&knee>.015,`crawl ${way}: something went into the floor (sole ${sole.toFixed(3)}, hand ${hand.toFixed(3)}, knee ${knee.toFixed(3)})`);
    results.push({fps,mode:`crawl ${way}`,turned:turnedBy,sole:+sole.toFixed(3),hand:+hand.toFixed(3),knee:+knee.toFixed(3),
      kinks:Object.fromEntries(Object.entries(kinks).map(([id,value])=>[id,+value.toFixed(1)]))});
    for(const {player,runtime} of riders){runtime.dispose();scene.remove(player.group);}
  }

  // The same changes wherever in its cycle the crawl is caught, and under a
  // light push of the stick. Half way between a crouch and a crawl the pose
  // alone has each shin straight down through the floor; how far through
  // depends on the crawl's phase and on its pace, and a leg lifted out of
  // that used to be thrown (a knee by 30 m/s in a frame at half the stick).
  // Each foot is carried across the floor instead. Up off all fours the feet
  // land on the stance and stay there while the body settles over them.
  const CAUGHT=[];
  for(const seconds of [.5,.664,.828,.992,1.156]){
    CAUGHT.push([`stopped after ${seconds} s`,1,seconds,true]);
    CAUGHT.push([`let go of after ${seconds} s`,1,seconds,false]);
  }
  CAUGHT.push(['at half the stick, stopped',.5,1.128,true],['at half the stick, let go of',.5,1.62,false],['at 45% of the stick, stopped',.45,1.2,true]);
  for(const [name,push,seconds,held] of part('caught')?CAUGHT:[]){
    const {player:p,runtime}=rider(false);
    const fps=60,dt=1/fps,down=Math.round(fps*1.8),go=down+Math.round(fps*.5),stop=go+Math.round(fps*seconds),up=held?stop+Math.round(fps*.9):stop;
    const kinks=Object.fromEntries(Object.keys(KINK).map(id=>[id,0])),history=[],v=new THREE.Vector3();
    const socket=(part,side)=>p.group.getObjectByName(`socket-${part}-${side}`).getWorldPosition(new THREE.Vector3());
    const tips=()=>['left','right'].map(side=>socket('foot',side).multiplyScalar(2).sub(socket('heel',side)));
    let sole=Infinity,hand=Infinity,knee=Infinity,landed=null,slid=0;
    for(let f=0;f<up+Math.round(fps*1.1);f++){
      p.step(dt,makeInput({grabHeld:f>=down&&f<up,grabPressed:f===down,moveY:f>=go&&f<stop?push:0}),level);p.commitRenderStep(level);level.update(dt);
      if(f<down)continue;
      history.push(Object.fromEntries(Object.keys(KINK).map(id=>[id,p.animationRig.jointsById.get(id).node.getWorldPosition(new THREE.Vector3())])));
      if(history.length>=3){
        const [a,b,c]=history.slice(-3);
        for(const id of Object.keys(KINK))kinks[id]=Math.max(kinks[id],v.copy(c[id]).addScaledVector(b[id],-2).add(a[id]).length()*fps);
      }
      const floor=floorOf(p);sole=Math.min(sole,floor.sole);hand=Math.min(hand,floor.hand);knee=Math.min(knee,floor.knee);
      // On his feet again, the feet stay where they came down.
      if(f>=up+Math.round(fps*.5)){
        const here=tips();
        if(landed)slid=Math.max(slid,...here.map((point,i)=>Math.hypot(point.x-landed[i].x,point.z-landed[i].z)));
        else landed=here;
      }
    }
    for(const [id,limit] of Object.entries(KINK))
      check(kinks[id]<=limit,`crawl ${name}: ${id} changed speed by ${kinks[id].toFixed(1)} m/s in a frame (limit ${limit})`);
    check(sole>-.03&&hand>-.04&&knee>.015,`crawl ${name}: something went into the floor (sole ${sole.toFixed(3)}, hand ${hand.toFixed(3)}, knee ${knee.toFixed(3)})`);
    check(slid<.03,`crawl ${name}: the feet slid ${slid.toFixed(3)} m after he was standing on them`);
    results.push({fps,mode:`crawl ${name}`,slid:+slid.toFixed(3),sole:+sole.toFixed(3),hand:+hand.toFixed(3),knee:+knee.toFixed(3),
      kinks:Object.fromEntries(Object.entries(kinks).map(([id,value])=>[id,+value.toFixed(1)]))});
    runtime.dispose();scene.remove(p.group);
  }

  // A jump pressed while a crawl has only just begun or stopped. The body is
  // then a long way from the clip it was being carried to, prone under a
  // squat or the other way about; the charge and the jump are carried on
  // from where it is, the legs trail after him, and the floor fit is not
  // taken from legs that are not the ones on screen (that threw the whole
  // body up 0.9 m for the five frames of the charge). Judged with the jump's
  // own rise taken out.
  const LEAP={hips:15,chest:15,head:15,wristLeft:20,wristRight:20,kneeLeft:13.5,kneeRight:13.5,ankleLeft:13.5,ankleRight:13.5};
  const LEAPS=[];
  for(const after of [3,6,10])LEAPS.push([`begun, jump ${after} frames on`,1,after,'begun'],[`stopped, jump ${after} frames on`,.828,after,'stopped'],
    [`let go of, jump ${after} frames on`,.828,after,'let go']);
  for(const [name,seconds,after,event] of part('caught')?LEAPS:[]){
    const {player:p,runtime}=rider(false);
    const fps=60,dt=1/fps,down=Math.round(fps*1.8),go=down+Math.round(fps*.5),stop=go+Math.round(fps*seconds);
    const jump=(event==='begun'?go:stop)+after,up=event==='let go'?stop:Infinity;
    const kinks=Object.fromEntries(Object.keys(LEAP).map(id=>[id,0])),history=[],v=new THREE.Vector3();
    let flew=false;
    for(let f=0;f<jump+34;f++){
      p.step(dt,makeInput({grabHeld:f>=down&&f<up&&f<jump,grabPressed:f===down,moveY:f>=go&&f<stop?1:0,
        jumpPressed:f===jump,jumpHeld:f>=jump&&f<jump+5,jumpReleased:f===jump+5}),level);p.commitRenderStep(level);level.update(dt);
      flew||=!p.grounded;
      if(f<jump-3)continue;
      history.push(Object.fromEntries(Object.keys(LEAP).map(id=>[id,p.animationRig.jointsById.get(id).node.getWorldPosition(new THREE.Vector3()).sub(p.pos)])));
      if(history.length<3)continue;
      const [a,b,c]=history.slice(-3);
      for(const id of Object.keys(LEAP))kinks[id]=Math.max(kinks[id],v.copy(c[id]).addScaledVector(b[id],-2).add(a[id]).length()*fps);
    }
    check(flew,`crawl ${name}: he never left the ground`);
    for(const [id,limit] of Object.entries(LEAP))
      check(kinks[id]<=limit,`crawl ${name}: ${id} changed speed by ${kinks[id].toFixed(1)} m/s in a frame (limit ${limit})`);
    results.push({fps,mode:`crawl ${name}`,kinks:Object.fromEntries(Object.entries(kinks).map(([id,value])=>[id,+value.toFixed(1)]))});
    runtime.dispose();scene.remove(p.group);
  }

  // A hop out of a crawl or a crouch with Circle still held lands straight
  // back in it. A crawl is then come into off a landing, from feet that were
  // never in a low pose: where they are on screen is kept through every
  // motion, so they are carried from there, with the floor under them from
  // the first frame.
  const HOP={hips:10,chest:10,head:10,wristLeft:12,wristRight:12,kneeLeft:15,kneeRight:15,ankleLeft:12,ankleRight:12};
  const HOPS=[['crawl, hop, crawl on',1,1],['crawl, hop, land crouched',1,0],['crouch, hop, land crouched',0,0],['crouch, hop, land crawling',0,1]];
  for(const [name,before,after] of part('caught')?HOPS:[]){
    const {player:p,runtime}=rider(false);
    const fps=60,dt=1/fps,down=Math.round(fps*1.8),go=down+Math.round(fps*.5),jump=go+Math.round(fps*1.2);
    const kinks=Object.fromEntries(Object.keys(HOP).map(id=>[id,0])),history=[],v=new THREE.Vector3();
    let landed=-1,flew=false,sole=Infinity;
    for(let f=0;f<jump+150&&(landed<0||f<landed+45);f++){
      p.step(dt,makeInput({grabHeld:f>=down,grabPressed:f===down,moveY:f>=go?(landed>=0?after:before):0,
        jumpPressed:f===jump,jumpHeld:f>=jump&&f<jump+5,jumpReleased:f===jump+5}),level);p.commitRenderStep(level);level.update(dt);
      if(!p.grounded)flew=true;else if(flew&&landed<0)landed=f;
      if(landed<0&&!(flew&&p.vVel<0&&p.pos.y<.5))continue;
      history.push(Object.fromEntries(Object.keys(HOP).map(id=>[id,p.animationRig.jointsById.get(id).node.getWorldPosition(new THREE.Vector3()).sub(p.pos)])));
      if(landed<0)continue;
      sole=Math.min(sole,floorOf(p).sole);
      if(history.length<3)continue;
      const [a,b,c]=history.slice(-3);
      for(const id of Object.keys(HOP))kinks[id]=Math.max(kinks[id],v.copy(c[id]).addScaledVector(b[id],-2).add(a[id]).length()*fps);
    }
    check(landed>0,`${name}: he never came down`);
    for(const [id,limit] of Object.entries(HOP))
      check(kinks[id]<=limit,`${name}: ${id} changed speed by ${kinks[id].toFixed(1)} m/s in a frame after landing (limit ${limit})`);
    check(sole>-.05,`${name}: a sole sank ${(-sole).toFixed(3)} into the floor after landing`);
    results.push({fps,mode:name,sole:+sole.toFixed(3),kinks:Object.fromEntries(Object.entries(kinks).map(([id,value])=>[id,+value.toFixed(1)]))});
    runtime.dispose();scene.remove(p.group);
  }

  // A carry that is cut short while he is still on the ground (whatever
  // takes the motion away without carrying it on) does not drop the legs
  // where the new motion has them: the feet finish their way at the rate
  // they were going.
  if(part('caught')){
    const {player:p,runtime}=rider(false);
    const fps=60,dt=1/fps,down=Math.round(fps*1.8),go=down+Math.round(fps*.5),stop=go+Math.round(fps*.828),cut=stop+4;
    const carry=p.setLowPoseCarry.bind(p),history=[],v=new THREE.Vector3();
    let frame=0,carried=0,worst=0;
    p.setLowPoseCarry=(left,serial,gathering,feet)=>{if(frame===cut-1&&feet)carried=feet[0];carry(left,serial,gathering,frame>=cut?null:feet);};
    for(;frame<cut+30;frame++){
      p.step(dt,makeInput({grabHeld:frame>=down,grabPressed:frame===down,moveY:frame>=go&&frame<stop?1:0}),level);p.commitRenderStep(level);level.update(dt);
      history.push(['ankleLeft','ankleRight','kneeLeft','kneeRight'].map(id=>p.animationRig.jointsById.get(id).node.getWorldPosition(new THREE.Vector3())));
      if(frame<cut-1||history.length<3)continue;
      const [a,b,c]=history.slice(-3);
      for(const [i] of c.entries())worst=Math.max(worst,v.copy(c[i]).addScaledVector(b[i],-2).add(a[i]).length()*fps);
    }
    check(carried>.5,`a carry cut short: the feet were not in the middle of their way (${carried})`);
    check(worst<KINK.kneeLeft,`a carry cut short: a leg changed speed by ${worst.toFixed(1)} m/s in a frame`);
    results.push({fps,mode:'a carry cut short',left:+carried.toFixed(2),worst:+worst.toFixed(1)});
    runtime.dispose();scene.remove(p.group);
  }

  if(problems.length){
    console.log(problems.join('\n'));
    console.log(results.map(r=>JSON.stringify(r)).join('\n'));
    process.exit(1);
  }
  console.log(JSON.stringify({status:'pass',results},null,1));
},{levelEntry:{id:'low-test',name:'Low test',data:{v:1,name:'Low test',spawn:[0,.02,60],killY:-30,
  components:[{t:'platform',p:[0,-.5,0],s:[300,1,300],edgeGrinding:false},{t:'gate',p:[140,0,-140]}]}}});
