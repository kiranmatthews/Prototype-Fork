import assert from 'node:assert/strict';
import {readFile,mkdir,writeFile} from 'node:fs/promises';
import {gunzipSync} from 'node:zlib';
import {createHash} from 'node:crypto';
import {withBlockworksRuntime} from './blockworks-runner.mjs';
import {createCourseCameraHarness} from './course-camera-harness.mjs';

const output=process.env.SKYSTREAM_DROP_OUTPUT||'/private/tmp/skystream-drop-camera';
const capture=process.env.SKYSTREAM_DROP_CAPTURE==='1';
const replay=JSON.parse(gunzipSync(await readFile(new URL('./fixtures/skystream-drop-replay.json.gz',import.meta.url))));
await mkdir(output,{recursive:true});
await withBlockworksRuntime(async r=>{
  const rig=await createCourseCameraHarness(r),{p,l,THREE}=r;
  const {Replayer}=await r.server.ssrLoadModule('/src/replay.ts');
  const replayer=new Replayer(),input={},samples=[],trajectory=createHash('sha256');
  let previousEye=null;
  const sample=f=>{
    p.collapseRenderInterpolation();rig.step(1/60);rig.camera.updateMatrixWorld(true);
    const eye=rig.camera.position.toArray(),center=p.pos.clone().add(new THREE.Vector3(0,1.3,0)).project(rig.camera);
    const nearest={s:-1};l.laneDirAt(p.pos.x,p.pos.y,p.pos.z,nearest);
    const row={f,position:p.pos.toArray(),state:p.state,grounded:p.grounded,vy:p.vVel,
      eye,ndc:center.toArray(),held:previousEye?.every((v,i)=>v===eye[i])??false,
      lane:rig.cursor.s,nearest:nearest.s,playerLane:p.laneCursor.s};
    previousEye=eye;return row;
  };
  replayer.begin(replay);
  try{
    for(let f=0;f<replay.frames;f++){
      // Stored quantised axes are already the consumed device sample. A second
      // normalization changes their direction and eventually changes the run.
      replayer.feed(input,p.camDir);p.step(1/60,input,l);l.update(1/60);
      p.flushLevelCrateRewards(l);p.commitRenderStep(l);
      trajectory.update(JSON.stringify([p.pos.toArray(),p.speed,p.vVel,p.state,p.grounded]));
      samples.push(sample(f));
    }
  }finally{replayer.end();}
  const cuts=[];
  for(const cut of r.sourceModule.SKYSTREAM_SHORTCUTS){
    const part=r.sourceModule.SKYSTREAM_PARTS.find(part=>part.name===cut.name),points=part.points;
    p.respawn(l,true,false,{position:new THREE.Vector3(...points[0]).add(new THREE.Vector3(0,.1,0)),
      heading:new THREE.Vector3(...points[2]).sub(new THREE.Vector3(...points[0])).setY(0).normalize()});
    let index=0,launched=false,aired=false,takeoff=null,landing=null,jumped=false;
    const rows=[],inputs=[];
    for(let f=0;f<750;f++){
      const cam=l.cameraDirAt(p.pos.x,p.pos.y,p.pos.z,{s:p.laneCursor.s});if(cam)p.camDir.set(cam.x,0,cam.z);
      const yaw=Math.atan2(p.camDir.x,p.camDir.z);
      if(!launched){
        let best=Infinity,near=index;
        for(let j=index;j<Math.min(index+6,points.length);j++){
          const q=points[j],d=Math.hypot(q[0]-p.pos.x,q[1]-p.pos.y,q[2]-p.pos.z);
          if(d<best){best=d;near=j;}
        }
        index=near;
        const release=index>=Math.round((points.length-1)*.11)&&p.grounded;
        if(release){launched=true;takeoff=p.pos.clone();}
        r.tick({...r.steerToward(release?cut.aim:points[Math.min(points.length-1,index+3)]),jumpHeld:true});
      }else{
        const edgeDistance=Math.min(...points.map(q=>Math.hypot(q[0]-p.pos.x,q[2]-p.pos.z)));
        const release=!jumped&&p.grounded&&edgeDistance>6.5;if(release)jumped=true;
        r.tick({...(jumped&&!release?{}:r.steerToward(cut.aim)),jumpHeld:!release});
        if(!p.grounded)aired=true;
      }
      inputs.push({yaw,...r.trace.at(-1).input});
      rows.push(sample(f));
      if(aired&&p.grounded&&p.pos.y<takeoff.y-12){landing=rows.at(-1);break;}
      assert.ok(!p.isBailing&&!['dead','gameover'].includes(p.state),cut.name+': shortcut failed');
    }
    assert.ok(landing&&jumped,cut.name+': lower road was not reached');
    const air=rows.filter(row=>!row.grounded),held=air.filter(row=>row.held).length;
    const outside=air.filter(row=>Math.abs(row.ndc[0])>1||Math.abs(row.ndc[1])>1||row.ndc[2]>1).length;
    const control=p.courseInputDirection(l),expected=l.laneDirAt(p.pos.x,p.pos.y,p.pos.z);
    const controlError=Math.acos(THREE.MathUtils.clamp(control.x*expected.x+control.z*expected.z,-1,1))*180/Math.PI;
    cuts.push({name:cut.name,start:points[0],heading:new THREE.Vector3(...points[2]).sub(new THREE.Vector3(...points[0])).setY(0).normalize().toArray(),held,outside,landing,controlError,rows,inputs});
  }
  const report={frames:replay.frames,trajectory:trajectory.digest('hex'),samples,cuts};
  await writeFile(`${output}/native.json`,JSON.stringify(report));
  console.log(JSON.stringify({...report,samples:samples.length,cuts:cuts.map(({rows,inputs,...cut})=>cut)},null,2));
  if(!capture){
    assert.equal(samples.slice(3701,3742).filter(s=>s.held).length,0,'Reported rescue jump still freezes');
    for(const cut of cuts){
      assert.equal(cut.held,0,cut.name+': froze during a valid drop');
      assert.equal(cut.outside,0,cut.name+': lost the rider');
      assert.ok(Math.abs(cut.landing.lane-cut.landing.nearest)<.001,cut.name+': camera kept the upper road');
      assert.ok(cut.controlError<.01,cut.name+': steering kept the upper road');
    }
  }
},{modulePath:'/src/levels/skystream.ts',source:m=>m.SKYSTREAM_LEVEL,levelId:'skystream',
  endlessDeaths:replay.endlessDeaths,maxFrames:5000,controlFrame:r=>r.p.courseInputDirection(r.l)??r.p.camDir});
