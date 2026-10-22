import assert from 'node:assert/strict';
import { writeFile } from 'node:fs/promises';
import { withSkateRuntime, makeInput } from './jungle-cup-harness.mjs';

await withSkateRuntime(async ({ THREE, server, Level, Player, scene, TUNING, CONST }) => {
  const { SCHOOL_MIAMI_LEVEL } = await server.ssrLoadModule('/src/levels/school-miami.ts');
  const { SkateChaseCamera, SKATE_CAMERA } = await server.ssrLoadModule('/src/skateChaseCamera.ts');
  const level = new Level(scene, { id: 'school-miami', name: SCHOOL_MIAMI_LEVEL.name, data: SCHOOL_MIAMI_LEVEL });
  scene.updateMatrixWorld(true);
  const framing = { camDist:TUNING.parkCamDist, camHeight:TUNING.parkCamHeight, camPitch:TUNING.parkCamPitch, camFov:TUNING.parkCamFov };
  const ray = new THREE.Raycaster(), report = { views:[], motion:[], recovery:[], drops:[], entrances:[], roofJumps:[], roofVents:[], roofEdges:[] };
  try {
    for (const [x,y,z] of [[44,0,-5],[42,-1,-15],[40,-2.5,-21],[38,-4.4,-30],[37,-5,-36],[45,3.4,4],[48.5,0,32]]) {
      ray.set(new THREE.Vector3(x,y+.3,z),new THREE.Vector3(0,-1,0));ray.far=2;
      const ground=ray.intersectObjects(level.groundMeshes,false)[0];
      assert.ok(ground,`Missing camera probe support at ${x}/${z}`);
      for (const sign of [-1,1]) {
        const rig=new SkateChaseCamera(),camera=new THREE.PerspectiveCamera(SKATE_CAMERA.verticalFov,16/9,.1,400);
        const subject={position:ground.point.clone(),heading:new THREE.Vector3(-.15*sign,0,-sign).normalize(),up:new THREE.Vector3(0,1,0),vertAir:false,vertNormal:new THREE.Vector3(0,0,1),verticalSpeed:0,speed:0,grounded:true,bailing:false};
        rig.update(camera,subject,0,true,level.groundMeshes,framing);camera.updateMatrixWorld(true);
        const trailing=Math.hypot(camera.position.x-subject.position.x,camera.position.z-subject.position.z);
        const bounds=[.1,1.5,3].map(h=>subject.position.clone().add(new THREE.Vector3(0,h,0)).project(camera));
        const crop=Math.max(...bounds.flatMap(p=>[Math.abs(p.x),Math.abs(p.y)]));
        const row={position:subject.position.toArray(),sign,eye:camera.position.toArray(),trailing,crop};
        report.views.push(row);console.log(JSON.stringify(row));
        assert.ok(trailing>3.5,`Camera collapsed under canopy at ${x}/${z}/${sign}`);
        assert.ok(crop<.98,`Camera cropped rider at ${x}/${z}/${sign}: ${crop}`);
      }
    }
    // Follow the real stair surface in both directions, including each end
    // of the cover. These samples audit camera motion, not rider physics.
    for (const sign of [-1,1]) {
      const rig=new SkateChaseCamera(),camera=new THREE.PerspectiveCamera(49,16/9,.1,400);
      const subject={position:new THREE.Vector3(),heading:new THREE.Vector3(-.15*sign,0,-sign).normalize(),up:new THREE.Vector3(0,1,0),vertAir:false,vertNormal:new THREE.Vector3(0,0,1),verticalSpeed:0,speed:8,grounded:true,bailing:false};
      const previous=new THREE.Vector3();let maxStep=0,minTrailing=Infinity,maxCrop=0;
      for(let frame=0;frame<=360;frame++) {
        const z=sign>0?5-frame/7.5:-43+frame/7.5,x=44+(z+5)*.15;
        ray.set(new THREE.Vector3(x,z>-5?.2:z<-37?-4.8:-5*THREE.MathUtils.smoothstep(-z,5,37)+.2,z),new THREE.Vector3(0,-1,0));ray.far=2;
        const ground=ray.intersectObjects(level.groundMeshes,false)[0];assert.ok(ground,'Missing descent support');
        subject.position.copy(ground.point);
        rig.update(camera,subject,1/60,frame===0,level.groundMeshes,framing);camera.updateMatrixWorld(true);
        if(Math.hypot(camera.position.x-x,camera.position.z-z)<3.5 || (frame&&camera.position.distanceTo(previous)>.9))console.log('CAMERA_EDGE',JSON.stringify({sign,frame,position:subject.position.toArray(),eye:camera.position.toArray(),desired:rig.desiredEye.toArray(),aim:rig.aim.toArray()}));
        if(frame)maxStep=Math.max(maxStep,camera.position.distanceTo(previous));previous.copy(camera.position);
        minTrailing=Math.min(minTrailing,Math.hypot(camera.position.x-x,camera.position.z-z));
        for(const h of [.1,1.5,3]) {const point=subject.position.clone().add(new THREE.Vector3(0,h,0)).project(camera);maxCrop=Math.max(maxCrop,Math.abs(point.x),Math.abs(point.y));}
      }
      report.motion.push({sign,frames:361,maxStep,minTrailing,maxCrop});console.log(JSON.stringify(report.motion.at(-1)));
      assert.ok(minTrailing>3.5,'Camera collapsed on the moving stair route');
      assert.ok(maxCrop<.98,'Moving camera cropped the skater');
      assert.ok(maxStep<.9,`Moving stair view snapped ${maxStep}m`);
    }
    // Leaving a low cover restores the normal shot gradually at every rate.
    for (const hz of [30,60,120]) {
      const rig=new SkateChaseCamera(),camera=new THREE.PerspectiveCamera(49,16/9,.1,400);
      const subject={position:new THREE.Vector3(44,0,-5),heading:new THREE.Vector3(0,0,-1),up:new THREE.Vector3(0,1,0),vertAir:false,vertNormal:new THREE.Vector3(0,0,1),verticalSpeed:0,speed:0,grounded:true,bailing:false};
      rig.update(camera,subject,0,true,level.groundMeshes,framing);
      let previous=camera.position.clone(),maxStep=0;
      for(let frame=0;frame<hz;frame++) {
        rig.update(camera,subject,1/hz,false,[],framing);
        maxStep=Math.max(maxStep,camera.position.distanceTo(previous));previous.copy(camera.position);
      }
      report.recovery.push({hz,maxStep,eye:camera.position.toArray()});
      assert.ok(maxStep<.6,'Ceiling exit snapped');
      assert.ok(Math.abs(camera.position.y-framing.camHeight)<.005,'Ceiling shot did not restore');
    }
    // Native roof-opening and doorway routes exercise narrow overhead
    // geometry. Check both rider framing and continuity of the moving shot.
    const player=new Player(scene),{schoolDetailTrials}=await server.ssrLoadModule('/tools/school-detail-lines.ts');
    const place=(q,h,speed)=>{
      player.rawInput=makeInput();player.respawn(level,true,true,{position:new THREE.Vector3(...q),heading:new THREE.Vector3(...h)});
      player.axisF.set(...h);player.axisL.set(h[2],0,-h[0]);player.freeSkate=true;player.speed=speed;
      player.groundHit=player.queryGround(level);player.pos.y=player.groundHit.y;player.prevPos.copy(player.pos);player.grounded=true;player.rideNormal.copy(player.groundHit.normal);
    };
    for(const trial of schoolDetailTrials(player,level,place,CONST.fixedStep).filter(c=>c.name.startsWith('Skylight')||c.name.startsWith('Gym doorway')||c.name.startsWith('West pavilion')||c.name.startsWith('Roof joined vent')||c.name.startsWith('Roof west hip')||c.name.startsWith('Roof south'))){
      trial.init();const rig=new SkateChaseCamera(),camera=new THREE.PerspectiveCamera(49,16/9,.1,400),previous=new THREE.Vector3();
      const subject=()=>({position:player.pos,heading:player.skateCameraHeading,up:player.skateCameraUp,vertAir:player.vertAir,vertNormal:player.vertNormal,verticalSpeed:player.vVel,speed:player.cameraSkateSpeed,grounded:player.skateCameraSupported,bailing:player.skateCameraBailing});
      let frames=0,maxStep=0,minTrailing=Infinity,maxCrop=0,complete=false;
      for(let frame=0;frame<trial.limit;frame++){
        const input=makeInput(trial.sample(frame)),n=Math.max(1,Math.hypot(input.moveX,input.moveY));input.moveX=Math.round(input.moveX/n*100)/100;input.moveY=Math.round(input.moveY/n*100)/100;
        player.step(CONST.fixedStep,input,level);level.update(CONST.fixedStep);assert.ok(!player.isBailing,`${trial.name}: camera route bailed`);
        rig.update(camera,subject(),CONST.fixedStep,frame===0,level.groundMeshes,framing);camera.updateMatrixWorld(true);frames++;
        if(frame)maxStep=Math.max(maxStep,camera.position.distanceTo(previous));previous.copy(camera.position);
        minTrailing=Math.min(minTrailing,Math.hypot(camera.position.x-player.pos.x,camera.position.z-player.pos.z));
        for(const h of [.1,1.5,3]){const point=player.pos.clone().add(new THREE.Vector3(0,h,0)).project(camera);maxCrop=Math.max(maxCrop,Math.abs(point.x),Math.abs(point.y));}
        if(trial.observe()){complete=true;break;}
      }
      console.log(JSON.stringify({name:trial.name,frames,maxStep,minTrailing,maxCrop}));
      assert.ok(complete,`${trial.name}: camera route missed its rollout`);assert.ok(maxCrop<.98,`${trial.name}: camera cropped the rider`);assert.ok(maxStep<1.05,`${trial.name}: camera snapped ${maxStep}m`);
      if(trial.name.startsWith('Gym doorway')){assert.ok(maxStep<.6,'Doorway camera snapped');assert.ok(minTrailing>4.9,'Doorway camera collapsed');}
      // Hold the landed subject still to measure presentation recovery alone.
      for(let frame=0;frame<60;frame++)rig.update(camera,subject(),CONST.fixedStep,false,level.groundMeshes,framing);
      const restoredTrailing=Math.hypot(camera.position.x-player.pos.x,camera.position.z-player.pos.z);
      assert.ok(Math.abs(restoredTrailing-framing.camDist)<.02,`${trial.name}: shot did not restore`);
      (trial.name.startsWith('Skylight')?report.drops:trial.name.startsWith('Gym doorway')?report.entrances:trial.name.startsWith('West pavilion')?report.roofJumps:trial.name.startsWith('Roof joined vent')?report.roofVents:report.roofEdges).push({name:trial.name,frames,maxStep,minTrailing,maxCrop,restoredTrailing,bails:0});
    }
    await writeFile('docs/performance/school-miami-camera.json',JSON.stringify(report,null,2)+'\n');
    console.log(`PASS ${report.views.length} School camera views and ceiling recovery at 30/60/120 Hz.`);
  } finally { level.dispose(); }
});
