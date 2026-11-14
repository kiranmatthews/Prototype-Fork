import assert from 'node:assert/strict';
import {mkdir,readFile,writeFile} from 'node:fs/promises';
import {withBlockworksRuntime} from './blockworks-runner.mjs';

// Reuse the existing route pilot without invoking its standalone test runner.
const source=await readFile(new URL('./ghost-train-pilot.mjs',import.meta.url),'utf8');
const a=source.indexOf('const station='),b=source.indexOf('const server=await createServer');
assert.ok(a>=0&&b>a);
const pilot=new Function('assert','process',source.slice(a,b).replaceAll('export function','function')+'\nreturn runGhostJourney;')(assert,process);
const out=process.env.GHOST_CRATE_OUTPUT||'/tmp/ghost-crates';await mkdir(out,{recursive:true});
await withBlockworksRuntime(async r=>{
 try{
  r.stepFor(20);const result=pilot(r);
  await writeFile(out+'/route.json',JSON.stringify({...result,actions:r.actions},null,2)+'\n');
  console.log(JSON.stringify(result));
 }catch(error){
  await writeFile(out+'/route-failure.json',JSON.stringify({error:error.message,actions:r.actions,trace:r.trace}));throw error;
 }
},{modulePath:'/src/levels/ghost-train.ts',levelId:'ghost-train',source:m=>m.GHOST_TRAIN_LEVEL,
 controlFrame:r=>r.p.courseInputDirection(r.l)??r.p.camDir,maxFrames:54000});
