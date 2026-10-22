import assert from 'node:assert/strict';
import {writeFile} from 'node:fs/promises';
import {withSkateRuntime,makeInput} from './jungle-cup-harness.mjs';

await withSkateRuntime(async({THREE,server,Level,Player,scene,CONST,TUNING})=>{
  const m=await server.ssrLoadModule('/src/levels/school-miami.ts');
  const {schoolScaleTrials}=await server.ssrLoadModule('/tools/school-scale-lines.ts');
  const {SkateChaseCamera}=await server.ssrLoadModule('/src/skateChaseCamera.ts');
  const {parseCustomLevelJson}=await server.ssrLoadModule('/src/level.ts');
  const S=Number(process.env.SCHOOL_SCALE||m.SCHOOL_WORLD_SCALE),data=m.createSchoolMiamiLevel(S),base=m.createSchoolMiamiLevel(1),before=JSON.stringify(TUNING);
  const level=new Level(scene,{id:'school-miami',name:data.name,data});scene.updateMatrixWorld(true);
  const p=new Player(scene);p.endlessDeaths=true;
  const report={worldScale:S,components:data.components.length,rails:level.rails.length,support:[],railClearance:{samples:0},ditchClearance:[],trials:[],failures:[],tuningUnchanged:false};
  const place=(q,h,speed)=>{p.rawInput=makeInput();p.respawn(level,true,true,{position:new THREE.Vector3(...q),heading:new THREE.Vector3(...h).normalize()});p.axisF.set(...h).normalize();p.axisL.set(p.axisF.z,0,-p.axisF.x);p.freeSkate=true;p.speed=speed;p.groundHit=p.queryGround(level);assert.ok(p.groundHit,'Missing scaled placement support');p.pos.y=p.groundHit.y;p.prevPos.copy(p.pos);p.grounded=true;p.rideNormal.copy(p.groundHit.normal);};
  try{
    assert.ok(parseCustomLevelJson(JSON.stringify(data)),'Scaled source must survive editor validation');
    assert.ok(S>=2&&S<=3);assert.equal(data.components.length,base.components.length);
    for(const [i,c] of data.components.entries()){
      const b=base.components[i];assert.deepEqual(c.p,b.p.map(v=>v*S),c.nm);
      if(c.vertices)assert.deepEqual(c.vertices,b.vertices.map(v=>v*S),`${c.nm} mesh`);
      if(c.pts)assert.deepEqual(c.pts,b.pts.map(q=>q.map((v,j)=>j<4?v*S:v)),`${c.nm} path`);
      if(c.s&&c.t!=='mesh')assert.deepEqual(c.s,b.s.map(v=>v*S),`${c.nm} dimensions`);
    }
    const ray=new THREE.Raycaster();
    const classroomIndex=data.components.findIndex(c=>c.nm==='Zigzag classroom wings and Hall Pass alcove');
    const classroomMeshes=level.groundMeshes.filter(o=>o.userData.editorIdx===classroomIndex);
    assert.ok(classroomMeshes.length,'Missing classroom collision');
    for(const q of m.SCHOOL_LONG_ASS_RAIL){
      ray.set(new THREE.Vector3(q[0]*S,20*S,q[2]*S),new THREE.Vector3(0,-1,0));ray.far=40*S;
      const hit=ray.intersectObjects(classroomMeshes,false)[0];
      assert.ok(!hit||hit.point.y<=q[1]*S+.05,'Long Ass Rail passes inside the classroom');report.railClearance.samples++;
    }
    const ditch=m.SCHOOL_DITCH,bank=m.SCHOOL_DITCH_SLAP,span=Math.hypot(ditch.b[0]-ditch.a[0],ditch.b[2]-ditch.a[2]);
    const across=[(ditch.b[2]-ditch.a[2])/span,-(ditch.b[0]-ditch.a[0])/span],half=ditch.half+ditch.radius*Math.sin(65*Math.PI/180);
    const centre=ditch.a.map((v,i)=>v+(ditch.b[i]-v)*bank.t);
    for(const side of [-1,1])for(const behind of [.2,bank.run/2,bank.run+1,bank.run+3]){
      ray.set(new THREE.Vector3((centre[0]+across[0]*side*(half+behind))*S,20*S,(centre[2]+across[1]*side*(half+behind))*S),new THREE.Vector3(0,-1,0));ray.far=40*S;
      const hit=ray.intersectObjects(level.groundMeshes,false)[0];
      assert.ok(hit&&hit.point.y>=-5*S-.06&&hit.point.y<=(-5+bank.rise)*S+.06,'Ditch approach overlaps a building or lacks ground');
      report.ditchClearance.push({side,behind,point:hit.point.toArray()});
    }
    for(const [name,x,z,y,from] of [
      ['canopy',.5,0,3.4,4],['court',48.5,32,0,3],['doorway',48.5,14.6,0,3],['gym roof',64,45.4,7,8],
      ['air conditioner',54.7,23.7,9.1,11],['west hip',45.5,26.5,8.25,10],['south parapet',48,48.65,7.3,9],
      ['joined vent',64.7,40.25,7.7,9],['west pavilion',0,12.5,3.8,5],['bonus roof',65,6,7,8],
      ['skylight hole',(m.SCHOOL_SKYLIGHT.hole.minX+m.SCHOOL_SKYLIGHT.hole.maxX)/2,39.2,0,9],
      ...m.SCHOOL_POOLS.map(q=>[q.name,q.centre[0],q.centre[2],q.bottom,q.bottom+1]),
      ...m.SCHOOL_CHECKPOINTS.map((q,i)=>[`checkpoint ${i+1}`,q[0],q[2],q[1],q[1]+1]),
    ]){ray.set(new THREE.Vector3(x*S,from*S,z*S),new THREE.Vector3(0,-1,0));ray.far=60;const hit=ray.intersectObjects(level.groundMeshes,false)[0];assert.ok(hit&&Math.abs(hit.point.y-y*S)<.06,`${name}: ${hit?.point.y}, expected ${y*S}`);report.support.push({name,point:hit.point.toArray()});}
    for(const c of (process.env.SCHOOL_AC_LEADS?process.env.SCHOOL_AC_LEADS.split(',').flatMap(v=>schoolScaleTrials(p,level,place,CONST.fixedStep,S,Number(v)).filter(c=>c.name==='Scaled AC roof air 23.7').map(c=>({...c,name:c.name+' lead '+v}))):schoolScaleTrials(p,level,place,CONST.fixedStep,S)).filter(c=>!process.env.SCHOOL_SCALE_FILTER||new RegExp(process.env.SCHOOL_SCALE_FILTER).test(c.name))){
      let frames=0,done=false,maxStep=0,maxCameraStep=0,maxCrop=0,error=null,worstCamera=null;
      const rig=new SkateChaseCamera(),camera=new THREE.PerspectiveCamera(49,16/9,.1,1500),prev=p.pos.clone(),eye=new THREE.Vector3();
      try{c.init();prev.copy(p.pos);for(;frames<c.limit;frames++){
        const input=makeInput(c.sample(frames)),n=Math.max(1,Math.hypot(input.moveX,input.moveY));input.moveX=Math.round(input.moveX/n*100)/100;input.moveY=Math.round(input.moveY/n*100)/100;
        p.step(CONST.fixedStep,input,level);level.update(CONST.fixedStep);input.consumeEdges();
        assert.ok(c.allowDeath||!p.isBailing,`${c.name}: bail`);assert.ok(p.pos.toArray().every(Number.isFinite));
        maxStep=Math.max(maxStep,p.pos.distanceTo(prev));prev.copy(p.pos);
        rig.update(camera,{position:p.pos,heading:p.skateCameraHeading,up:p.skateCameraUp,vertAir:p.vertAir,vertNormal:p.vertNormal,verticalSpeed:p.vVel,speed:p.cameraSkateSpeed,grounded:p.skateCameraSupported,bailing:p.skateCameraBailing},CONST.fixedStep,frames===0,level.groundMeshes,{camDist:TUNING.parkCamDist,camHeight:TUNING.parkCamHeight,camPitch:TUNING.parkCamPitch,camFov:TUNING.parkCamFov});camera.updateMatrixWorld(true);
        if(frames>3&&camera.position.distanceTo(eye)>maxCameraStep){maxCameraStep=camera.position.distanceTo(eye);worstCamera={frame:frames,pos:p.pos.toArray(),eye:camera.position.toArray(),previousEye:eye.toArray(),state:p.state};}eye.copy(camera.position);
        if(!c.allowDeath)for(const h of [.1,1.5,3]){const q=p.pos.clone().addScaledVector(p.skateCameraUp,h).project(camera);maxCrop=Math.max(maxCrop,Math.abs(q.x),Math.abs(q.y));}
        if(c.observe(frames+1)){done=true;frames++;break;}
      }assert.ok(done,`${c.name}: timeout at ${p.pos.toArray()}`);if(!c.allowDeath){assert.ok(maxCameraStep<1.05,`${c.name}: camera step ${maxCameraStep}`);assert.ok(maxCrop<.98,`${c.name}: camera cropped body span ${maxCrop}`);}}catch(e){error=String(e);report.failures.push({name:c.name,error,end:p.pos.toArray(),result:c.result});}
      report.trials.push({name:c.name,passed:done&&!error,frames,maxStep,maxCameraStep,maxCrop,worstCamera,end:p.pos.toArray(),result:c.result});
      console.log(`${error?'FAIL':'PASS'} ${c.name}: ${error??frames+' frames'}`);
    }
    report.tuningUnchanged=before===JSON.stringify(TUNING);assert.ok(report.tuningUnchanged);
    assert.equal(report.failures.length,0,JSON.stringify(report.failures,null,2));
    console.log(`PASS School ${S}x: ${report.support.length} supports and ${report.trials.length} native cases; tuning unchanged.`);
  }finally{await writeFile(process.env.SCHOOL_SCALE_REPORT||`/private/tmp/school-miami-review/scale${process.env.SCHOOL_SCALE?'-'+S:''}.json`,JSON.stringify(report,null,2));level.dispose();}
});
