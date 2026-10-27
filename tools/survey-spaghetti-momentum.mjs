// Small numerical authoring aid: the native Rail sampler and current slope
// equation, without a scene, characters or a browser. This is not a playtest.
import {build} from 'esbuild';
import {mkdir,writeFile} from 'node:fs/promises';
const output=process.env.SPAGHETTI_OUTPUT??'docs/spaghetti-rails/evidence/momentum';
await mkdir(output,{recursive:true});
const built=await build({stdin:{contents:`
 export {SPAGHETTI_RUNS,spaghettiRail,spaghettiSamples} from './src/levels/spaghetti-rails';
 export {Rail} from './src/rails';
 export {TUNING,CONST} from './src/tuning';
 export {Vector3} from 'three';`,resolveDir:process.cwd(),loader:'ts'},bundle:true,write:false,format:'esm',platform:'node'});
const {SPAGHETTI_RUNS:runs,spaghettiRail,spaghettiSamples,Rail,TUNING,CONST,Vector3}=await import(`data:text/javascript;base64,${Buffer.from(built.outputFiles[0].text).toString('base64')}`);
const rows=[];
for(const [index,run]of runs.entries())for(const lane of run.lanes)for(const entrySpeed of [24,TUNING.downhillMax]){
 const rail=new Rail(spaghettiSamples(spaghettiRail(run,lane)).map(p=>new Vector3(...p)),false);
 let s=0,speed=entrySpeed,minimum=entrySpeed,seconds=0,slowSeconds=0;
 while(s<rail.totalLength&&seconds<120){
  if(TUNING.grindDrag>0)speed=Math.max(CONST.grindMinSpeed,speed-TUNING.grindDrag*CONST.fixedStep);
  const slope=rail.tangentAt(s).y;
  if(Math.abs(slope)>1e-3)speed=Math.max(CONST.grindMinSpeed,Math.min(TUNING.downhillMax,speed-slope*TUNING.groundGravity*CONST.fixedStep));
  minimum=Math.min(minimum,speed);if(speed<12)slowSeconds+=CONST.fixedStep;
  s+=speed*CONST.fixedStep;seconds+=CONST.fixedStep;
 }
 rows.push({section:index,name:run.name,lane,entrySpeed,length:rail.totalLength,seconds,minimum,exitSpeed:speed,slowSeconds});
}
const totals=[-3.6,0,3.6].map(lane=>({lane,seconds:rows.filter(r=>r.lane===lane&&r.entrySpeed===TUNING.downhillMax).reduce((sum,r)=>sum+r.seconds,0)}));
const report={at:new Date().toISOString(),scope:'Forward-grind momentum estimate only; excludes catches, jumps, combat and balance. Native playtests remain authoritative.',
 tuning:{gravity:TUNING.groundGravity,cap:TUNING.downhillMax,minimum:CONST.grindMinSpeed,drag:TUNING.grindDrag,step:CONST.fixedStep},totals,rows};
await writeFile(output+'/report.json',JSON.stringify(report,null,2));
console.log(JSON.stringify({totals,loom:rows.filter(r=>r.section===13||r.section===14)},null,2));
