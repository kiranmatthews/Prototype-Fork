import assert from 'node:assert/strict';
import {readFile,writeFile} from 'node:fs/promises';
import {withSkateRuntime,makeInput} from './jungle-cup-harness.mjs';

const bank=process.argv[2];
const entry={id:'travel-test',name:'Board travel',data:{v:1,name:'Board travel',spawn:[0,.02,0],killY:-30,
  components:[{t:'platform',p:[0,-.5,0],s:[1000,1,1000]},{t:'gate',p:[0,0,-450]}]}};
await withSkateRuntime(async({server,THREE,Player,level,player:p,TUNING})=>{
  const {JAK_DIRECT_PHYSICS,createJakDirectSuite}=await server.ssrLoadModule('/tools/jak-direct-motion.ts');
  const {SkateTravelMotion,sampleSkateTravelMount,SKATE_TRAVEL}=await server.ssrLoadModule('/src/skateTravelMotion.ts');
  const a=await server.ssrLoadModule('/src/animation/index.ts');
  const {createCharacterAnimationRuntime}=await server.ssrLoadModule('/src/characterAnimationRuntime.ts');
  const binding=a.RigBinding.fromSculptRuntime(p.animationRig.root);
  const suite=a.createPlayerStarterAnimationSuite(binding.definition);
  const runtime=createCharacterAnimationRuntime(p,bank?createJakDirectSuite(suite,binding.definition,JSON.parse(await readFile(bank,'utf8'))):suite);
  const control=new Player(level.scene);control.competitionMode=control.endlessDeaths=true;
  p.onFootJumpStudy=JAK_DIRECT_PHYSICS;
  const joint=n=>p.riderG.getObjectByName(n).getWorldPosition(new THREE.Vector3());
  const knee=side=>joint('knee-'+side).sub(joint('hip-'+side)).angleTo(joint('ankle-'+side).sub(joint('knee-'+side)));
  const samples=[],errors=[];let frames=0;
  try{
    for(const stance of [-1,1])for(const scenario of ['mount-stop','standing','cancel','release-cancel','early-ollie','remount','carve','charge']){
      for(const rider of [p,control]){
        rider.enterLevel('travel-test');rider.respawn(level,true);rider.freeSkate=scenario==='charge';rider.stance=stance;
        if(scenario==='charge')rider.speed=9;
      }
      runtime.restart();
      const phases=new Set();let hiddenFrames=0,smearFrames=0,remountStart=-1,mounts=0;
      let maxLoadError=0,maxLoadDrop=0,maxLoadKnee=0,maxPreparation=0,cancelSettled=false,maxLean=0,cruiseHip=0,chargeHip=0,chargeFeet=0;
      for(let frame=0;frame<530;frame++){
        const previous=p.boardG.userData.skateTravel;
        if(scenario==='remount'&&remountStart<0&&previous?.phase==='dismount')remountStart=frame;
        const chargeStudy=scenario==='charge',release=scenario==='cancel'?100:scenario==='release-cancel'?48:scenario==='early-ollie'?66:220;
        const brake=!chargeStudy&&frame>=260&&frame<350&&remountStart<0;
        const remount=remountStart>=0&&frame<remountStart+100;
        const input=makeInput({moveX:scenario==='carve'&&frame>=130&&frame<200?.65:0,
          moveY:scenario==='standing'&&frame<30?0:scenario==='cancel'&&frame>=54&&frame<100?0:brake?-1:frame<260||remount?1:0,
          jumpHeld:chargeStudy?frame>=100&&frame<280:frame>=30&&frame<release||remount,
          jumpPressed:chargeStudy?frame===100:frame===30||frame===remountStart,
          jumpReleased:chargeStudy?frame===280:frame===release||frame===remountStart+100&&remountStart>=0,
          grabHeld:brake,grabPressed:frame===260});
        p.step(1/60,input,level);control.step(1/60,input,level);level.update(1/60);frames++;
        assert.ok(p.pos.distanceTo(control.pos)<1e-8,`${scenario} ${frame}: movement changed`);
        for(const key of ['speed','vVel','grounded','state','freeSkate','spinning'])assert.equal(p[key],control[key],`${scenario} ${frame}: ${key}`);
        const board=p.boardG,pose=board.userData.skateTravel;
        if(!pose)continue;
        phases.add(pose.phase);
        assert.deepEqual(p.riderG.scale.toArray(),[1,1,1],'whole-rider scaling');
        if(['stowed','prepare','cancel'].includes(pose.phase)){
          hiddenFrames++;if(board.visible)errors.push({scenario,stance,frame,problem:'board visible on foot'});
        }
        if(pose.smear){smearFrames++;assert.ok(['mount','dismount'].includes(pose.phase));}
        if(pose.phase==='mount'&&previous?.phase!=='mount')mounts++;
        assert.equal(board.userData.skatePushContact,undefined,'removed kick-push returned');
        maxPreparation=Math.max(maxPreparation,pose.preparation);
        const load=board.userData.skateMountLoad;
        if(load){
          maxLoadKnee=Math.max(maxLoadKnee,knee('left'),knee('right'));
          if(load.knees.some((angle,i)=>angle>Math.max(2.2,load.sourceKnees[i]+.05)))errors.push({scenario,stance,frame,problem:'mount knee collapse',knees:[knee('left'),knee('right')]});
          maxLoadError=Math.max(maxLoadError,load.footError);maxLoadDrop=Math.max(maxLoadDrop,load.drop);
          if(load.reachCorrection>.08)errors.push({scenario,stance,frame,problem:'excessive free-foot reach correction',distance:load.reachCorrection});
          if(load.footError>.004||load.plantedFootError>.004)errors.push({scenario,stance,frame,problem:'preparation moved a sole',error:load.footError});
        }
        if(scenario==='cancel'&&frame===80){
          cancelSettled=pose.phase==='stowed'&&pose.preparation===0&&!board.visible&&!pose.smear;
          assert.ok(cancelSettled,'released direction did not unwind the load');
        }
        maxLean=Math.max(maxLean,Math.abs(pose.steer));
        if(chargeStudy&&frame===84)cruiseHip=joint('hips').y-p.pos.y;
        if(chargeStudy&&frame===250){
          chargeHip=joint('hips').y-p.pos.y;chargeFeet=board.userData.skateContact.footError;
          assert.ok(pose.charge>.99,'full charge must plant both feet');
          assert.ok(chargeFeet<.006,'full-charge feet left the deck');
        }
      }
      samples.push({scenario,stance,phases:[...phases],hiddenFrames,smearFrames,mounts,
        maxLoadError,maxLoadDrop,maxLoadKnee,maxPreparation,cancelSettled,maxLean,cruiseHip,chargeHip,chargeFeet});
      if(scenario==='cancel'||scenario==='release-cancel')assert.ok(!phases.has('mount')&&smearFrames===0,'cancel committed a board swap');
      if(scenario==='cancel')assert.ok(phases.has('cancel')&&maxLoadDrop>.28,'cancel did not exercise the visible load');
      if(scenario==='mount-stop'){
        for(const phase of ['prepare','mount','charge','dismount','stowed'])assert.ok(phases.has(phase),`missing ${phase}`);
        assert.ok(maxLoadDrop>.32,'mount load was not visible');assert.ok(smearFrames>0&&smearFrames<30,'handoff cover is missing or persistent');
      }
      if(scenario==='standing')assert.ok(phases.has('prepare')&&phases.has('mount')&&maxLoadDrop>.15,'standing load/mount was not exercised');
      if(scenario==='carve')assert.ok(maxLean>.2,'turning never affected balance');
      if(scenario==='remount')assert.ok(mounts>=2,'remount was not exercised');
      if(chargeHip)assert.ok(cruiseHip-chargeHip>.12&&cruiseHip-chargeHip<.30,`charge depth ${cruiseHip-chargeHip}`);
    }
    for(const fps of [30,60,120])for(const reverseAt of [0,.15,.4]){
      const motion=new SkateTravelMotion();let pose,covered=0;
      for(let i=0;i<fps*7;i++){
        const time=i/fps;
        pose=motion.step(1/fps,{enabled:true,available:true,eligible:true,grounded:true,
          mounted:time>=1&&time<3||reverseAt>0&&time>=3+reverseAt&&time<5,
          preparing:time<1,holdProgress:time,charging:time<2,charge:time>1?1:0,braking:time>2.8&&time<3,
          heading:time>1&&time<2?.8*time:1.6,time});
        if(pose.smear)covered++;
        assert.ok(Object.values(pose.deformations).every(v=>Number.isFinite(v)&&v>.82&&v<1.18));
      }
      assert.equal(pose.phase,'stowed');assert.equal(pose.smear,false);assert.equal(pose.weight,0);
      assert.ok(covered/fps<.85,'smear never settled');
    }
    // Cancel through direction release at different live hold durations,
    // then re-press during unwind: no forced commit and no pose restart snap.
    for(const hold of [.2,.55,1])for(const fps of [30,60,120]){
      const motion=new SkateTravelMotion();let pose;
      const base={enabled:true,available:true,eligible:true,grounded:true,mounted:false,
        charging:true,charge:1,braking:false,heading:0};
      for(let frame=0;frame<Math.floor(hold*.8*fps);frame++)
        pose=motion.step(1/fps,{...base,preparing:true,holdProgress:frame/fps/hold,time:frame/fps});
      const loaded=pose.preparation;
      pose=motion.step(1/fps,{...base,preparing:false,holdProgress:0,time:1});
      assert.ok(Math.abs(pose.preparation-loaded)<4/fps&&pose.preparation>0&&!pose.smear);
      const reversing=pose.preparation;
      pose=motion.step(1/fps,{...base,preparing:true,holdProgress:0,time:1+1/fps});
      assert.equal(pose.preparation,reversing,'re-press restarted the mount pose');
      for(let frame=0;frame<fps/2;frame++)pose=motion.step(1/fps,{...base,preparing:false,holdProgress:0,time:2+frame/fps});
      assert.equal(pose.preparation,0);assert.equal(pose.phase,'stowed');assert.equal(pose.smear,false);
    }
    let peakLift=0,visibleExtension=0;
    for(let frame=0;frame<120;frame++){
      const time=frame/120,pose=sampleSkateTravelMount(time);
      assert.ok(Object.values(pose).every(Number.isFinite));
      peakLift=Math.max(peakLift,pose.lift);
      if(time>SKATE_TRAVEL.mountCover)visibleExtension=Math.max(visibleExtension,pose.extension);
      if(time>=SKATE_TRAVEL.mount)assert.deepEqual(pose,{lift:0,tuck:0,settle:0,extension:0});
    }
    assert.ok(peakLift>.39&&visibleExtension>.98,'spring is too small or hidden behind the smear');
    const report={frames,samples,errors,errorCount:errors.length};
    console.log(JSON.stringify(report,null,2));
    if(process.env.SKATE_TRAVEL_REPORT)await writeFile(process.env.SKATE_TRAVEL_REPORT,JSON.stringify(report,null,2));
    assert.equal(errors.length,0,'Skate pose/contact failures; see measurements above');
    console.log('PASS hidden inventory, finite swap smear, removed push, planted cancellable mount load, charge depth, stances, cancellation/remount, exact controller parity');
  }finally{runtime.dispose();}
},{levelEntry:entry});
