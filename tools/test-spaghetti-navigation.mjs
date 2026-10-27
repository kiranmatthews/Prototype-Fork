// Lightweight source-path check. Uses the production samplers, with no scene
// or physics actors; native races and browser play remain separate evidence.
import assert from 'node:assert/strict';
import {build} from 'esbuild';
import {mkdir,writeFile} from 'node:fs/promises';

const output=process.env.SPAGHETTI_OUTPUT??'docs/spaghetti-rails/evidence/navigation';
await mkdir(output,{recursive:true});
const built=await build({stdin:{contents:`
 export {SPAGHETTI_RAILS_LEVEL,SPAGHETTI_RUNS,spaghettiRail,spaghettiSamples} from './src/levels/spaghetti-rails';
 export {RaceCourse} from './src/race/course';
 export {Rail} from './src/rails';
 export {Vector3} from 'three';`,resolveDir:process.cwd(),loader:'ts'},bundle:true,write:false,format:'esm',platform:'node'});
const {SPAGHETTI_RAILS_LEVEL:level,SPAGHETTI_RUNS:runs,spaghettiRail,spaghettiSamples,RaceCourse,Rail,Vector3}=
 await import(`data:text/javascript;base64,${Buffer.from(built.outputFiles[0].text).toString('base64')}`);
const course=new RaceCourse(level.skateRace.line),rows=[];
let samples=0;
for(const [section,run]of runs.entries())for(const lane of run.lanes){
 const points=spaghettiSamples(spaghettiRail(run,lane)).map(p=>new Vector3(...p));
 const rail=new Rail(points,false),start=course.project(new Vector3(...level.skateRace.grinds[section].start)).s;
 const end=course.project(new Vector3(...level.skateRace.grinds[section].end)).s;
 let progress=start,minDirection=1,maxBackstep=0,maxGlobalCorrection=0,maxDeviation=0,outside=0;
 for(let s=0;s<=rail.totalLength+.75;s+=.75){
  const at=Math.min(s,rail.totalLength),point=rail.pointAt(at);
  // Rider feet sit above the rail's authored centreline.
  point.y+=.12;
  let projection=course.project(point,progress,80);
  const global=course.project(point);
  if(global.distance<course.width(global.s)/2+3&&Math.abs(global.s-projection.s)>40){
   maxGlobalCorrection=Math.max(maxGlobalCorrection,Math.abs(global.s-projection.s));projection=global;
  }
  maxBackstep=Math.max(maxBackstep,progress-projection.s);
  minDirection=Math.min(minDirection,rail.tangentAt(at).dot(course.tangent(projection.s)));
  maxDeviation=Math.max(maxDeviation,projection.distance);
  if(projection.s<start-5||projection.s>end+5)outside++;
  progress=projection.s;samples++;
 }
 rows.push({section,name:run.name,lane,minDirection,maxBackstep,maxGlobalCorrection,maxDeviation,outside});
}
const report={at:new Date().toISOString(),scope:'Production path projection only, not a physics or browser playtest.',samples,rails:rows.length,
 minimumForwardDot:Math.min(...rows.map(r=>r.minDirection)),maxBackstep:Math.max(...rows.map(r=>r.maxBackstep)),
 maxGlobalCorrection:Math.max(...rows.map(r=>r.maxGlobalCorrection)),outsideSamples:rows.reduce((sum,r)=>sum+r.outside,0),rows};
await writeFile(output+'/report.json',JSON.stringify(report,null,2));
console.log(JSON.stringify({...report,rows:undefined}));
assert.equal(report.outsideSamples,0,'Every strand stays on its own ordered course section');
assert.equal(report.maxGlobalCorrection,0,'No strand falsely snaps race progress onto another stacked loop');
assert.ok(report.minimumForwardDot>0,'Forward travel cannot trigger the backward-catch response');
assert.ok(report.maxBackstep<1,'Forward rail travel keeps ordered race progress');
