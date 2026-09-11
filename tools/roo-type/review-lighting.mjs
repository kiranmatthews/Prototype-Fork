import fs from 'node:fs/promises';
import assert from 'node:assert/strict';
import {pathToFileURL} from 'node:url';
const{chromium}=await import(process.env.PLAYWRIGHT_MODULE?pathToFileURL(process.env.PLAYWRIGHT_MODULE).href:'playwright');
const base=process.env.ROO_LAB_URL||'http://127.0.0.1:5178/',out=process.env.ROO_REVIEW_DIR||'/private/tmp/roo-type-v9-review';await fs.mkdir(out,{recursive:true});
const browser=await chromium.launch({headless:true,channel:'chrome'}),report={errors:[],samples:[]};
try{
 const page=await browser.newPage({viewport:{width:1440,height:1000},deviceScaleFactor:1});
 page.on('pageerror',e=>report.errors.push(e.message));page.on('console',m=>{if(m.type()==='error')report.errors.push(m.text());});
 await page.goto(base+'roo-type-lab.html');await page.waitForFunction(()=>window.rooTypeLab?.ready);
 assert.equal(await page.evaluate(()=>window.rooTypeLab.metrics().version),9);
 await page.selectOption('#view','glyph');await page.selectOption('#glyph','A');await page.selectOption('#palette','counter');
 await page.emulateMedia({reducedMotion:'no-preference'});await page.locator('#shimmer').check();
 const sample=()=>page.evaluate(()=>{
  const c=document.querySelector('.stage canvas'),ctx=c.getContext('2d'),ratio=c.width/c.clientWidth;
  const d=ctx.getImageData(0,Math.ceil(100*ratio),c.width,c.height-Math.ceil(150*ratio)).data;let hash=2166136261,colored=0;
  for(let p=0;p<d.length;p+=4){hash=Math.imul(hash^d[p],16777619);hash=Math.imul(hash^d[p+1],16777619);hash=Math.imul(hash^d[p+2],16777619);if(d[p+3]>128)colored++;}
  return{phase:Number(c.dataset.lightPosition),slider:Number(document.querySelector('#light').value),ready:c.dataset.lightingReady,status:document.querySelector('#light-status').textContent,hash,colored};
 });
 for(let i=0;i<13;i++){report.samples.push(await sample());if(i<12)await page.waitForTimeout(1000);}
 const phases=report.samples.map(s=>s.phase);assert.ok(Math.min(...phases)<-.5&&Math.max(...phases)>.5,'Live clock did not cover both light directions');
 assert.ok(new Set(report.samples.map(s=>s.hash)).size>8,'The actual glyph pixels are not animating');
 for(const s of report.samples){assert.equal(s.ready,'true');assert.ok(Math.abs(s.slider-s.phase)<.012);assert.equal(s.status,'Lighting is moving');assert.ok(s.colored>1000);}
 await page.screenshot({path:out+'/moving-a.png'});
 await page.locator('#shimmer').uncheck();const paused=await sample();await page.waitForTimeout(1200);assert.deepEqual(await sample(),paused);assert.match(paused.status,/Paused/);
 await page.locator('#light').fill('-1');await page.locator('#light').dispatchEvent('input');const left=await sample();await page.screenshot({path:out+'/a-left.png'});
 await page.locator('#light').fill('1');await page.locator('#light').dispatchEvent('input');const right=await sample();await page.screenshot({path:out+'/a-right.png'});assert.notEqual(left.hash,right.hash);
 await page.selectOption('#view','angles');await page.screenshot({path:out+'/compare-a-angles.png'});assert.equal(await page.locator('#light-status').textContent(),'Three fixed light angles');
 await page.selectOption('#view','glyph');await page.locator('#shimmer').check();await page.emulateMedia({reducedMotion:'reduce'});
 await page.waitForFunction(()=>document.querySelector('#light-status').textContent.includes('Reduced Motion'));
 const reduced=await sample();assert.match(reduced.status,/Reduced Motion/);assert.equal(reduced.phase,0);assert.ok(await page.locator('#light').isEnabled());
 await page.waitForTimeout(1200);assert.deepEqual(await sample(),reduced);
 await page.locator('#light').fill('-0.8');await page.locator('#light').dispatchEvent('input');assert.equal((await sample()).phase,-.8);
 await page.emulateMedia({reducedMotion:'no-preference'});await page.locator('#strength').fill('0');await page.locator('#strength').dispatchEvent('input');assert.match((await sample()).status,/0%/);
 await page.locator('#strength').fill('0.7');await page.locator('#strength').dispatchEvent('input');await page.waitForTimeout(200);assert.equal((await sample()).status,'Lighting is moving');
 report.controls={pause:true,manual:true,comparison:true,reducedMotion:true,zeroStrength:true};assert.deepEqual(report.errors,[]);
 await fs.writeFile(out+'/lighting-report.json',JSON.stringify(report,null,2));console.log(JSON.stringify(report,null,2));
}finally{await browser.close();}
