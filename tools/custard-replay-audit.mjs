import {readFile,writeFile} from 'node:fs/promises';
import {withBlockworksRuntime} from './blockworks-runner.mjs';
const file=process.argv[2];
if(!file)throw new Error('Provide the Custard Creek replay JSON path');
const replay=JSON.parse(await readFile(file,'utf8'));
await withBlockworksRuntime(async r=>{
 const {Replayer}=await r.server.ssrLoadModule('/src/replay.ts');
 const take=new Replayer(),input={},events=[],samples=[];let last='',minY=0,maxStation=0;
 take.begin(replay);
 try{for(let f=0;f<replay.frames;f++){
  take.feed(input,r.p.camDir);r.tick(input);
  const s=r.sourceModule.custardProgress(r.p.pos),c=r.sourceModule.custardPoint(s,0),d=r.sourceModule.custardTangent(s);
  const across=-(r.p.pos.x-c[0])*d[2]+(r.p.pos.z-c[2])*d[0];
  const state=[r.p.state,r.p.grounded,r.p.vertAir,r.p.totalDeaths].join('/');
  const sample={f,s:+s.toFixed(2),u:+across.toFixed(2),y:+r.p.pos.y.toFixed(2),water:+r.sourceModule.custardWaterHeight(s).toFixed(2),state,
   speed:+r.p.speed.toFixed(2),vy:+r.p.vVel.toFixed(2),normal:r.p.rideNormal.toArray()};
  if(state!==last){events.push(sample);last=state;}
  if(f%15===0)samples.push(sample);
  minY=Math.min(minY,r.p.pos.y);maxStation=Math.max(maxStation,s);
 }}finally{take.end();}
 const summary={frames:replay.frames,deaths:r.p.totalDeaths,minY,maxStation,events};
 await writeFile('/private/tmp/custard-replay-audit.json',JSON.stringify({...summary,samples},null,2));
 console.log(JSON.stringify(summary,null,2));
},{modulePath:'/src/levels/custard-creek.ts',source:m=>m.CUSTARD_CREEK_LEVEL,levelId:'custard-creek',endlessDeaths:true,maxFrames:11000});
