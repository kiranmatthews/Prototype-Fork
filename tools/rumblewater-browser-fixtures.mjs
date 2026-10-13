import assert from 'node:assert/strict';
import {readFile,writeFile} from 'node:fs/promises';
const root='/private/tmp/rumblewater-evidence';
const reports=JSON.parse(await readFile(`${root}/report.json`,'utf8'));
const channels=['jumpHeld','grindHeld','spinHeld','grabHeld','jumpPressed','jumpReleased','grindPressed','spinPressed','grabPressed','restartPressed','transferHeld','transferPressed','jumpCancelled'];
for(const name of process.argv.slice(2).length?process.argv.slice(2):['inner-low','outer-high','inner-high','outer-low','recovery','late-recovery','stall']){
 const report=reports.find(r=>r.name===name);assert.ok(report?.pass,`${name} must be a passing native take`);
 const trace=JSON.parse(await readFile(`${root}/${name}-trace.json`,'utf8'));
 assert.ok(trace.every(t=>Number.isFinite(t.cameraYaw)));
 const data={v:2,level:'rumblewater-run',date:new Date().toISOString(),tuning:{},tuningChanges:[],
  mx:trace.map(t=>t.input.moveX),my:trace.map(t=>t.input.moveY),cy:trace.map(t=>t.cameraYaw),
  b:trace.map(t=>channels.reduce((bits,c,i)=>bits|(t.input[c]?1<<i:0),0)),frames:trace.length,truncated:false,surfaceFrictionPolicy:1};
 if(report.startWorld)data.startWorld=report.startWorld;
 await writeFile(`tools/fixtures/rumblewater-${name}.json`,JSON.stringify(data));
 console.log(`${name}: ${data.frames} actual input frames`);
}
