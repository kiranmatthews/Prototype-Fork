import assert from 'node:assert/strict';
import {mkdir,writeFile} from 'node:fs/promises';
import {createServer} from 'vite';
import {withBlockworksRuntime} from './blockworks-runner.mjs';
const server=await createServer({appType:'custom',logLevel:'silent',server:{middlewareMode:true}});
const m=await server.ssrLoadModule('/src/levels/kona.ts');await server.close();
const out=process.env.KONA_OUTPUT||'/private/tmp/kona-pilot';await mkdir(out,{recursive:true});
const reports=[];
const opts={modulePath:'/src/levels/kona.ts',source:m=>m.KONA_LEVEL,levelId:'kona',controlFrame:({p})=>p.axisF,maxFrames:3000};
const wrap=a=>Math.atan2(Math.sin(a),Math.cos(a));
const steer=(p,q,charge=false,brake=false)=>({moveX:Math.max(-1,Math.min(1,-wrap(Math.atan2(q[0]-p.pos.x,q[2]-p.pos.z)-Math.atan2(p.axisF.x,p.axisF.z))*2.5)),moveY:1,jumpHeld:charge,grabHeld:brake});
function align(r,heading){
 for(let i=0;i<150;i++){const a=wrap(Math.atan2(heading[0],heading[2])-Math.atan2(r.p.axisF.x,r.p.axisF.z));if(Math.abs(a)<.015)break;r.tick({moveX:Math.max(-1,Math.min(1,-a*4)),grabHeld:true});}
}
for(const reverse of (process.env.KONA_ONLY_VERT||process.env.KONA_BOWLS)?[]:[false,true]){
 const path=m.KONA_SNAKE.points.slice(4,-5);if(reverse)path.reverse();
 const start=path[0],heading=[path[3][0]-start[0],0,path[3][2]-start[2]];
 const report=await withBlockworksRuntime(r=>{
  const {p}=r;align(r,heading);let index=0,maxError=0,air=0,stalls=0;
  for(let f=0;f<2400&&index<path.length-6;f++){
   let closest=index,d=Infinity;
   for(let i=Math.max(0,index-3);i<Math.min(path.length,index+25);i++){const dd=Math.hypot(p.pos.x-path[i][0],p.pos.z-path[i][2]);if(dd<d){d=dd;closest=i;}}
   index=Math.max(index,closest);maxError=Math.max(maxError,d);
   const target=path[Math.min(path.length-1,index+8)],angle=Math.abs(wrap(Math.atan2(target[0]-p.pos.x,target[2]-p.pos.z)-Math.atan2(p.axisF.x,p.axisF.z)));
   r.tick(steer(p,target,false,angle>.42&&p.speed>7.5));
   if(!p.grounded)air++;if(f>100&&p.speed<1)stalls++;
   if(p.isBailing||p.totalDeaths||d>8)break;
  }
  const result={name:reverse?'Snake uphill':'Snake downhill',index,total:path.length,maxError,air,stalls,end:r.snapshot()};
  return {...result,trace:r.trace};
 },{...opts,start:[start[0],start[1]+.08,start[2]],heading});
 await writeFile(`${out}/snake-${reverse?'up':'down'}.json`,JSON.stringify(report,null,2));
 const {trace,...brief}=report;reports.push(brief);console.log(JSON.stringify(brief));
 if(process.env.KONA_STRICT){assert.ok(report.index>=report.total-6);assert.ok(report.maxError<5);assert.equal(report.end.deaths,0);assert.equal(report.end.bailing,false);}
}
const vessels=process.env.KONA_BOWLS?m.KONA_BOWLS.map(b=>({...b,radius:3,flat:5,length:20})):m.KONA_PIPES;
const requiredAirs=process.env.KONA_BOWLS?2:4;
for(const [i,pipe] of vessels.entries()){
 const report=await withBlockworksRuntime(r=>{
  const {p}=r;align(r,[1,0,0]);let air=null,airs=[],maxY=p.pos.y,released=false,side=1;
  for(let f=0;f<1800&&airs.length<requiredAirs;f++){
   if(p.grounded&&p.speed<5&&Math.abs(p.pos.x-pipe.centre[0])>pipe.flat+.7)side=-Math.sign(p.pos.x-pipe.centre[0]);
   const pop=p.grounded&&!released&&p.pos.y>pipe.centre[1]+.65&&p.groundHit?.normal.y<.8&&p.axisF.dot(p.groundHit.normal)<-.2;
   if(pop)released=true;
   const target=[pipe.centre[0]+side*20,0,pipe.centre[2]];
   r.tick({...(!air?steer(p,target,!released):{}),...(pop?{jumpHeld:false,jumpReleased:true}:{})});maxY=Math.max(maxY,p.pos.y);
   if(!p.grounded&&!air)air={frame:f,peak:p.pos.y};
   if(air){air.peak=Math.max(air.peak,p.pos.y);if(p.grounded){airs.push({...air,landed:f});air=null;released=false;side=-Math.sign(p.pos.x-pipe.centre[0]);}}
   if(p.isBailing||p.totalDeaths)break;
  }
  return {name:pipe.name,airs,maxY,end:r.snapshot(),trace:r.trace};
 },{...opts,start:[pipe.centre[0],pipe.centre[1]+.06,pipe.centre[2]],heading:[1,0,0]});
 await writeFile(`${out}/${process.env.KONA_BOWLS?'bowl':'vert'}-${i}.json`,JSON.stringify(report,null,2));const {trace,...brief}=report;reports.push(brief);console.log(JSON.stringify(brief));
 if(process.env.KONA_STRICT){assert.equal(report.airs.length,requiredAirs);assert.equal(report.end.deaths,0);assert.equal(report.end.bailing,false);}
}
await writeFile(`${out}/report.json`,JSON.stringify(reports,null,2));
