import {mkdir,writeFile} from 'node:fs/promises';
import {resolve} from 'node:path';
import {withBananaBay} from './banana-bay-runtime.mjs';
import {runBananaBay} from './banana-bay-pilot.mjs';
const out=process.env.BANANA_BAY_OUTPUT||resolve('docs/banana-bay/evidence');await mkdir(out,{recursive:true});
const finale=process.argv.includes('--finale');
const ferry=process.argv.includes('--ferry');
const phase=Number(process.argv.find(a=>a.startsWith('--phase='))?.slice(8)??0);
await withBananaBay(async r=>{
  if(finale||ferry)r.startAt=ferry?'ferry':'finale';
  for(let n=0;n<Math.round(phase/r.dt);n++)r.tick();
  const gen=runBananaBay(r);let done;
  try{let step;while(!(step=gen.next()).done){r.tick(step.value);if(r.frame%(finale?300:1800)===0)console.log(JSON.stringify({frame:r.frame,stage:r.report.stage,p:r.p.pos.toArray()}));}
    done=step.value;console.log('PASS',JSON.stringify(done));
  }finally{await writeFile(out+(ferry?`/ferry-phase-${phase}.json`:finale?'/finale-route.json':'/main-route.json'),JSON.stringify({phase,result:done,report:r.report,trace:r.trace}));}
},{start:ferry?[10.854,1.15,-1234]:finale?[0,1.15,-1138]:undefined});
