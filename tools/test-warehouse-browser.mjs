/** Rendered-input acceptance. Every plan begins at the real spawn. */
import assert from 'node:assert/strict';
import {readFile,mkdir,writeFile} from 'node:fs/promises';
import {resolve,join} from 'node:path';
import {runSession} from './warehouse-session-browser.mjs';
const base=process.argv[2]??'http://127.0.0.1:5332/';
const output=resolve(process.env.WAREHOUSE_OUTPUT??'/private/tmp/warehouse-browser');
await mkdir(output,{recursive:true});
for(const name of ['arrival-manual-hip','workshop-miss-recovery','collectathon-east-first','collectathon-west-first']){
 const plan=JSON.parse(await readFile(new URL(`../docs/warehouse-flow/plans/${name}.json`,import.meta.url),'utf8'));
 plan.lite=false;const file=join(output,`${name}.json`);await writeFile(file,JSON.stringify(plan,null,2));
 process.env.WAREHOUSE_OUTPUT=join(output,name);const report=await runSession(file,base);
 assert.equal(report.config.skatepark,true);assert.equal(report.config.alwaysSkate,false);assert.equal(report.config.cameraRig,null);
 assert.match(report.stamp,/Codex\/sol fork/);assert.equal(report.pass,true,report.failures.join('\n'));
}
console.log('PASS continuous full-render Warehouse sessions with shared competition camera and optional walking');
