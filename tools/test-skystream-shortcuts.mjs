import assert from 'node:assert/strict';
import {writeFile,mkdir} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {withBlockworksRuntime} from './blockworks-runner.mjs';
const output=process.env.SKYSTREAM_REVIEW_DIR??join(tmpdir(),'skystream-review');
await mkdir(output,{recursive:true});
await withBlockworksRuntime(async r=>{
 const {p,l,sourceModule:m,THREE}=r,results=[];
 for(const cut of m.SKYSTREAM_SHORTCUTS){
  const part=m.SKYSTREAM_PARTS.find(x=>x.name===cut.name),points=part.points,target=cut.aim;
  p.respawn(l,true,false,{position:new THREE.Vector3(...points[0]).add(new THREE.Vector3(0,.1,0)),heading:new THREE.Vector3(...points[2]).sub(new THREE.Vector3(...points[0])).setY(0).normalize()});
  let index=0,launched=false,aired=false,takeoff=null,landing=null,jumped=false;
  const traceStart=r.frame;
  for(let frame=0;frame<750;frame++){
   const cam=l.cameraDirAt(p.pos.x,p.pos.y,p.pos.z,{s:p.laneCursor.s});if(cam)p.camDir.set(cam.x,0,cam.z);
   if(!launched){
    let near=index,best=Infinity;
    for(let j=index;j<Math.min(index+6,points.length);j++){const q=points[j],d=Math.hypot(q[0]-p.pos.x,q[1]-p.pos.y,q[2]-p.pos.z);if(d<best){best=d;near=j;}}
    index=near;
    const release=index>=Math.round((points.length-1)*.11)&&p.grounded;
    if(release){launched=true;takeoff=r.snapshot();}
    r.tick({...r.steerToward(release?target:points[Math.min(points.length-1,index+3)]),jumpHeld:true});
   }else{
    const edgeDistance=Math.min(...points.map(q=>Math.hypot(q[0]-p.pos.x,q[2]-p.pos.z)));
    const release=!jumped&&p.grounded&&edgeDistance>6.5;if(release)jumped=true;
    r.tick({...(jumped&&!release?{}:r.steerToward(target)),jumpHeld:!release});
    if(!p.grounded)aired=true;
    if(aired&&p.grounded&&p.pos.y<takeoff.position[1]-12){landing=r.snapshot();break;}
   }
   if(p.isBailing||p.state==='dead')break;
  }
  const trace=r.trace.slice(traceStart),jump=trace.find(t=>t.input.jumpReleased),air=trace.filter(t=>t.frame>=jump?.frame&&!t.grounded);
  assert.ok(jumped&&aired&&landing&&!p.isBailing&&p.totalDeaths===0,cut.name+': edge shortcut failed');
  const trail=[.2,.4,.6,.8].map(t=>air[Math.min(air.length-1,Math.floor(air.length*t))].position.map(n=>Math.round(n*100)/100));
  results.push({name:cut.name,target,jump,landing,trail,end:r.snapshot(),trace});
  console.log(JSON.stringify({name:cut.name,entry:jump.position,landing:landing.position,seconds:(landing.frame-jump.frame)*r.dt}));
 }
 await writeFile(join(output,'cuts.json'),JSON.stringify(results));
},{modulePath:'/src/levels/skystream.ts',source:m=>m.SKYSTREAM_LEVEL,levelId:'skystream',endlessDeaths:true,maxFrames:5000,
 controlFrame:r=>r.p.courseInputDirection(r.l)??r.p.camDir});
