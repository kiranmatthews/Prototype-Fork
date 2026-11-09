import assert from 'node:assert/strict';
import {mkdir,writeFile,readFile} from 'node:fs/promises';
const {chromium}=await import(process.env.PLAYWRIGHT_MODULE||'playwright');
const base=process.argv[2]||'http://127.0.0.1:5297/';
const output=process.env.ENEMY_AUDIT_OUTPUT||'/private/tmp/opengoal-enemy-review';await mkdir(output,{recursive:true});
const browser=await chromium.launch({headless:true,channel:'chrome'}),issues=[],rows=[];
try{
 const context=await browser.newContext({viewport:{width:1600,height:1000},deviceScaleFactor:2});
 const page=await context.newPage();page.on('pageerror',e=>issues.push(String(e)));page.on('console',m=>{if(['error','warning'].includes(m.type()))issues.push(m.text());});
 await page.goto(new URL('tools/enemies/reference-review.html?paused=1&lite',base).href);
 await page.waitForFunction(()=>window.__enemyReferences?.getDiagnostics().status==='ready',null,{timeout:60000});
 const audit=await page.evaluate(()=>window.__enemyReferences.getAudit());assert.equal(audit.summary.playableModels,28);assert.equal(audit.summary.exportedClips,254);
 for(const candidate of audit.candidates.filter(c=>c.asset&&!process.argv.includes('--ui-only'))){
  await page.evaluate(id=>window.__enemyReferences.choose(id),candidate.id);
  const initial=await page.evaluate(()=>window.__enemyReferences.getDiagnostics());assert.equal(initial.status,'ready',candidate.id);assert.equal(initial.sourceTriangles,candidate.asset.triangles,candidate.id);assert.equal(initial.clipCount,candidate.asset.clips.length,candidate.id);assert.deepEqual(initial.ourRootScale,[1,1,1]);
  let changingClips=0;
  for(const clip of candidate.asset.clips){
   const samples=await page.evaluate(({name,duration})=>{const r=window.__enemyReferences;r.setClip(name);return [.13,.47,.83].map(f=>{r.seek(duration*f);return r.getDiagnostics();});},clip);
   for(const sample of samples){assert.ok(sample.finite&&sample.verticesFinite,candidate.id+'/'+clip.name);assert.equal(sample.clip,clip.name);assert.equal(sample.sourceTriangles,candidate.asset.triangles);}
   if(Math.abs(samples[2].vertexFingerprint-samples[0].vertexFingerprint)>1e-5)changingClips++;
  }
  assert.ok(changingClips>0,`${candidate.id}: no sampled skin motion`);rows.push({candidate:candidate.id,clips:candidate.asset.clips.length,changingClips,sourceTriangles:initial.sourceTriangles,joints:initial.sourceJoints});console.log(`${candidate.id}: ${candidate.asset.clips.length} clips, ${changingClips} with sampled skin motion`);
 }
 // Missing assets have an explicit evidence state, not a substitute model.
 for(const id of ['ogreboss','jak3-mantis']){await page.evaluate(id=>window.__enemyReferences.choose(id),id);const d=await page.evaluate(()=>window.__enemyReferences.getDiagnostics());assert.equal(d.status,'unavailable');assert.equal(d.sourceTriangles,0);assert.equal(d.ourStatus,'hidden');assert.ok(await page.getByLabel('Source animation',{exact:true}).isDisabled());}
 await page.getByLabel('Game',{exact:true}).selectOption('jak3');assert.match(await page.locator('#result-count').textContent(),/9 candidates/);
 await page.getByLabel('Find a candidate').fill('shield');assert.equal(await page.locator('.candidate').count(),1);await page.getByLabel('Find a candidate').fill('nothing-matches-zz');assert.match(await page.locator('#candidate-list').textContent(),/No matching/);
 await page.getByLabel('Find a candidate').fill('');await page.getByLabel('Game',{exact:true}).selectOption('all');await page.getByLabel('Show',{exact:true}).selectOption('recommended');assert.equal(await page.locator('.candidate').count(),8);
 await page.locator('[data-id="lurkercrab"]').click();await page.waitForFunction(()=>window.__enemyReferences.getDiagnostics().status==='ready');await page.locator('#shortlist').click();assert.equal(await page.locator('#shortlist').getAttribute('aria-pressed'),'true');
 await page.reload();await page.waitForFunction(()=>window.__enemyReferences?.getDiagnostics().status==='ready');assert.equal(await page.locator('#shortlist').getAttribute('aria-pressed'),'true');
 const downloadPromise=page.waitForEvent('download');await page.getByRole('button',{name:'Export shortlist'}).click();const download=await downloadPromise;const downloadPath=`${output}/shortlist.json`;await download.saveAs(downloadPath);const exported=JSON.parse(await readFile(downloadPath,'utf8'));assert.deepEqual(exported.candidates.map(c=>c.id),['lurkercrab']);await page.locator('#shortlist').click();
 // Delayed/stale source loads must never attach after selecting a different row.
 await page.evaluate(()=>Promise.all([window.__enemyReferences.choose('babak'),window.__enemyReferences.choose('hopper'),window.__enemyReferences.choose('swamp-bat')]));assert.equal((await page.evaluate(()=>window.__enemyReferences.getDiagnostics())).candidate,'swamp-bat');assert.equal((await page.evaluate(()=>window.__enemyReferences.getDiagnostics())).status,'ready');
 // Actual autoplay, once-only endpoint, scrubbing, skeleton and comparison toggles.
 await page.evaluate(()=>{const r=window.__enemyReferences;r.setClip('swamp-bat-swoop');r.seek(0);r.setPlaying(true);});await page.waitForTimeout(350);assert.ok((await page.evaluate(()=>window.__enemyReferences.getDiagnostics())).time>0);
 await page.getByLabel('Rig',{exact:true}).check();await page.locator('#compare').uncheck();await page.waitForFunction(()=>window.__enemyReferences.getDiagnostics().ourStatus==='hidden');await page.locator('#compare').check();await page.waitForFunction(()=>window.__enemyReferences.getDiagnostics().ourStatus==='ready');
 // Finish in the full antialiasing renderer at native pixel density.
 await page.goto(new URL('tools/enemies/reference-review.html?paused=1',base).href);await page.waitForFunction(()=>window.__enemyReferences?.getDiagnostics().status==='ready');await page.getByLabel('MAX / native').check();
 const captures=[['lurkercrab','lurkercrab-peek'],['aphid','aphid-lurker-spike-out'],['hopper','hopper-jump-long'],['babak','babak-spot'],['driller','driller-lurker-drill-jams'],['quicksandlurker','quicksandlurker-spit'],['swamp-bat','swamp-bat-swoop'],['bully','bully-dizzy']];
 for(const [id,clip] of captures){
  await page.evaluate(id=>window.__enemyReferences.choose(id),id);await page.evaluate(clip=>{const r=window.__enemyReferences;r.setClip(clip);r.seek(r.getDiagnostics().duration*.47);},clip);
  for(const view of ['front','quarter','side']){await page.locator(`[data-view="${view}"]`).click();await page.screenshot({path:`${output}/${id}-${view}.png`});}
 }
 await page.evaluate(()=>window.__enemyReferences.choose('lurkercrab'));await page.getByLabel('Rig',{exact:true}).check();await page.screenshot({path:`${output}/skeleton-native.png`});
 const native=await page.evaluate(()=>window.__enemyReferences.getDiagnostics());assert.ok(native.resolution[0]>1800);rows.push({phase:'native',...native});
 // Existing detailed enemy lab remains available and still loads its nine kinds.
 await page.getByRole('link',{name:'Our roster',exact:true}).click();await page.waitForFunction(()=>window.__enemyReview?.getDiagnostics().loaded===9,null,{timeout:60000});rows.push({phase:'existing-roster',loaded:9});
 await page.getByRole('link',{name:'OpenGOAL audit'}).click();await page.waitForFunction(()=>window.__enemyReferences?.getDiagnostics().status==='ready');
 await page.setViewportSize({width:390,height:844});await page.screenshot({path:`${output}/mobile.png`,fullPage:true});assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth));
 assert.deepEqual(issues,[]);await writeFile(`${output}/report.json`,JSON.stringify({base,mode:process.argv.includes('--ui-only')?'ui-only':'all-assets',rows,issues,summary:audit.summary},null,2));console.log(`PASS: ${process.argv.includes('--ui-only')?'UI follow-up':'all 28 rigs / 254 clips'}, selection, shortlist, export, async lifecycle, current lab, full/native and narrow layout.`);
}finally{await browser.close();}
