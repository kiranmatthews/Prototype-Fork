import assert from 'node:assert/strict';
import {readFile,writeFile} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import {withBlockworksRuntime} from './blockworks-runner.mjs';
const data = {v:1,name:'Default movement parity',skatepark:true,spawn:[0,.05,100],killY:-30,
  components:[{t:'platform',p:[0,-.5,0],s:[600,1,600],edgeGrinding:false},{t:'gate',p:[250,0,-250]}]};
await withBlockworksRuntime(async r => {
  const trace=[];
  for(let i=0;i<960;i++) {
    const phase=Math.floor(i/120);
    const sample=[{}, {moveY:1}, {moveY:1,jumpHeld:true}, {moveY:1}, {moveX:.4,moveY:.9,jumpHeld:true},
      {}, {moveY:-1,grabHeld:true}, {moveY:1,jumpHeld:true}][phase];
    r.tick(sample);
    trace.push({position:r.p.pos.toArray(),speed:r.p.speed,vertical:r.p.vVel,heading:r.p.axisF.toArray(),state:r.p.state,grounded:r.p.grounded});
  }
  const json=JSON.stringify(trace),result={frames:trace.length,sha256:createHash('sha256').update(json).digest('hex'),trace};
  await writeFile(`/private/tmp/mall-recreation/measured/default-${process.cwd().split('/').at(-1)}.json`,JSON.stringify(result));
  if(process.argv[2])assert.deepEqual(result,JSON.parse(await readFile(process.argv[2],'utf8')));
  console.log(JSON.stringify({...result,trace:undefined}));
},{modulePath:'/src/levels/mall-measured.ts',source:()=>data,levelId:'default-parity',maxFrames:960,controlFrame:r=>r.p.axisF});
