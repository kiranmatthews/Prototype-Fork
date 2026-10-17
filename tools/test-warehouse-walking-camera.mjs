import assert from 'node:assert/strict';
import {readFile,writeFile} from 'node:fs/promises';
import {resolve,join} from 'node:path';
import {fileURLToPath} from 'node:url';
import {runSession} from './warehouse-session-browser.mjs';

const output=resolve(process.env.WAREHOUSE_OUTPUT??'/private/tmp/warehouse-walking-camera');
process.env.WAREHOUSE_OUTPUT=output;
const report=await runSession(fileURLToPath(new URL('../docs/warehouse-art/walking-camera.json',import.meta.url)),process.argv[2]);
assert.equal(report.pass,true,report.failures.join('\n'));
assert.equal(report.config.skatepark,true);assert.equal(report.config.alwaysSkate,false);assert.equal(report.config.cameraRig,null);
const rows=(await readFile(join(output,'telemetry.jsonl'),'utf8')).trim().split('\n').map(JSON.parse);
assert.ok(rows.every(r=>!r.skating),'the entire camera check remains on foot');
const settled=rows.filter(r=>r.segment.startsWith('settle after')&&r.segmentSeconds>.8);
assert.ok(settled.length>20,'both turns include an observed camera settle');
const error=r=>{
 const [x,y,z,w]=r.camera.quaternion,fx=-2*(x*z+w*y),fz=-1+2*(x*x+y*y),[hx,,hz]=r.heading;
 return Math.acos(Math.min(1,Math.max(-1,(fx*hx+fz*hz)/Math.hypot(fx,fz)/Math.hypot(hx,hz))))*180/Math.PI;
};
const maxHeadingErrorDegrees=Math.max(...settled.map(error));
assert.ok(maxHeadingErrorDegrees<2,`on-foot camera must settle behind player heading: ${maxHeadingErrorDegrees} degrees`);
assert.ok(rows.every(r=>Math.abs(r.camera.fov-report.config.parkFov)<1e-6),'walking retains the shared competition lens');
const result={onFootFrames:rows.length,settledSamples:settled.length,maxHeadingErrorDegrees,parkFov:report.config.parkFov};
await writeFile(join(output,'facing-check.json'),JSON.stringify(result,null,2));
console.log('PASS actual on-foot turns retain player-facing competition camera',JSON.stringify(result));
