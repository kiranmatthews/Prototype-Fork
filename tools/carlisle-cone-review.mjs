import assert from 'node:assert/strict';
import {mkdir,writeFile,rename} from 'node:fs/promises';
import {chromium} from '/Users/kiki/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright/index.mjs';
const out='art/carlisle-cone/review';await mkdir(out,{recursive:true});
const errors=[],browser=await chromium.launch({channel:'chrome',headless:true});
const context=await browser.newContext({viewport:{width:1920,height:1080},deviceScaleFactor:1,recordVideo:{dir:out+'/video',size:{width:1280,height:720}},serviceWorkers:'block'});
const page=await context.newPage();page.on('pageerror',e=>errors.push(e.message));page.on('console',m=>{if(m.type()==='error')errors.push(m.text())});
const report={errors,cycles:[],poses:[]};
try{
 await page.goto('http://127.0.0.1:5483/art/carlisle-cone/viewer.html',{waitUntil:'domcontentloaded'});
 await page.waitForFunction(()=>window.__coneReview?.ready,null,{timeout:60000});
 report.metrics=await page.evaluate(()=>window.__coneReview.metrics);assert.equal(report.metrics.clips.length,3);assert(report.metrics.bones>15);
 for(const angle of [0,40,90])for(const clip of ['idle','walk','slash']){
  const duration=await page.evaluate(({angle,clip})=>{const v=window.__coneReview;v.playback(true);v.view(angle);v.choose(clip);return v.actor.duration},{angle,clip});
  await page.waitForTimeout((duration+.15)*1000);
  report.cycles.push({angle,clip,duration});
  console.log(`Reviewed complete ${clip} cycle at ${angle} degrees (${duration.toFixed(2)}s)`);
  await page.evaluate(()=>{const v=window.__coneReview;v.playback(false);v.sample(.38)});
  await page.screenshot({path:`${out}/${clip}-${angle}.png`});
  const poses=await page.evaluate(()=>{
   const v=window.__coneReview,frames=[];
   for(let i=0;i<=30;i++){v.sample(i/31);const nodes=[];v.actor.model.traverse(n=>{if(n.isBone)nodes.push({name:n.name,p:n.position.toArray(),q:n.quaternion.toArray(),s:n.scale.toArray()})});frames.push(nodes);}
   return frames;
  });
  const flatten=poses.flatMap(f=>f.flatMap(n=>[...n.p,...n.q,...n.s]));assert(flatten.every(Number.isFinite));assert.notDeepEqual(poses[0],poses[15]);
  report.poses.push({angle,clip,frames:poses.length,finite:true,changing:true});
 }
 await page.getByRole('button',{name:'Early night',exact:true}).click();
 await page.evaluate(()=>{const v=window.__coneReview;v.choose('slash');v.view(40);v.playback(false);v.sample(.38)});
 await page.screenshot({path:out+'/night.png'});
 await page.setViewportSize({width:960,height:540});await page.waitForTimeout(200);await page.screenshot({path:out+'/normal.png'});
 await page.setViewportSize({width:390,height:844});await page.waitForTimeout(200);await page.screenshot({path:out+'/mobile.png'});
 report.mobileOverflow=await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth);assert.equal(report.mobileOverflow,false);
 assert.deepEqual(errors,[]);
}finally{await context.close();await browser.close();const video=await page.video()?.path();if(video){report.video=out+'/motion-cycles.webm';await rename(video,report.video)}await writeFile(out+'/viewer-validation.json',JSON.stringify(report,null,2)+'\n')}
