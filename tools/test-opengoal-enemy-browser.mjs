import assert from 'node:assert/strict';
import {mkdir,writeFile,readFile} from 'node:fs/promises';
const {chromium}=await import(process.env.PLAYWRIGHT_MODULE||'playwright');
const base=process.argv[2]||'http://127.0.0.1:5297/';
const output=process.env.ENEMY_AUDIT_OUTPUT||'/private/tmp/jak1-character-review';
const uiOnly=process.argv.includes('--ui-only');await mkdir(output,{recursive:true});
const browser=await chromium.launch({headless:true,channel:'chrome'}),issues=[],rows=[];
try{
 const context=await browser.newContext({viewport:{width:1600,height:1000},deviceScaleFactor:2});
 const page=await context.newPage();page.on('pageerror',e=>issues.push(String(e)));page.on('console',m=>{if(['error','warning'].includes(m.type()))issues.push(m.text());});
 // The currently open, removed Jak II deep link must recover to a loaded Jak 1 character.
 await page.goto(new URL('tools/enemies/reference-review.html?candidate=jak2-predator&paused=1&lite',base).href);
 await page.waitForFunction(()=>window.__enemyReferences?.getDiagnostics().status==='ready',null,{timeout:60000});
 const audit=await page.evaluate(()=>window.__enemyReferences.getAudit());
 assert.equal(audit.summary.characters,72);assert.equal(audit.summary.playableModels,111);assert.equal(audit.summary.exportedClips,670);
 assert.ok(audit.candidates.every(c=>c.game==='jak1'&&c.variants.every(v=>v.asset.clips.length>0)));
 assert.equal((await page.evaluate(()=>window.__enemyReferences.getDiagnostics())).candidate,'lurkercrab');
 assert.equal(await page.locator('#compare,#pair,#game-filter').count(),0);
 assert.match(await page.locator('#build-stamp').textContent(),/Codex\/sol fork/);
 for(const candidate of audit.candidates){
  for(const variant of candidate.variants){
   if(uiOnly)continue;
   await page.evaluate(({id,variant})=>window.__enemyReferences.choose(id,variant),{id:candidate.id,variant:variant.id});
   const initial=await page.evaluate(()=>window.__enemyReferences.getDiagnostics());
   assert.equal(initial.status,'ready',variant.id+': '+initial.error);assert.equal(initial.modelCount,1);
   assert.equal(initial.sourceTriangles,variant.asset.triangles,variant.id);assert.ok(initial.sourceTriangles>3,variant.id+' must contain a visible character body');assert.equal(initial.clipCount,variant.asset.clips.length,variant.id);
   let changingClips=0;
   for(const clip of variant.asset.clips){
    const samples=await page.evaluate(({name,duration})=>{const r=window.__enemyReferences;r.setClip(name);return [.13,.47,.83].map(f=>{r.seek(duration*f);return {...r.getDiagnostics(),framing:r.getFraming()};});},clip);
    for(const sample of samples){assert.ok(sample.finite&&sample.verticesFinite,variant.id+'/'+clip.name);assert.equal(sample.clip,clip.name);assert.equal(sample.modelCount,1);assert.equal(sample.sourceTriangles,variant.asset.triangles);assert.ok(Math.abs(sample.duration-clip.duration)<.00001);assert.ok(sample.framing.min.slice(0,2).every(v=>v>=-1.15)&&sample.framing.max.slice(0,2).every(v=>v<=1.15),variant.id+'/'+clip.name+' outside camera');}
    if(Math.abs(samples[2].vertexFingerprint-samples[0].vertexFingerprint)>1e-5)changingClips++;
   }
   rows.push({candidate:candidate.id,variant:variant.id,clips:variant.asset.clips.length,changingClips,sourceTriangles:initial.sourceTriangles,joints:initial.sourceJoints,morphTargets:initial.morphTargets});
   const representative=variant.asset.clips.find(c=>c.name===variant.defaultAction)??variant.asset.clips.find(c=>c.duration>0&&/idle|hover|breath/.test(c.name))??variant.asset.clips[0];
   await page.evaluate(c=>{const r=window.__enemyReferences;r.setClip(c.name);r.seek(c.duration*.47);},representative);
   const framing=await page.evaluate(()=>window.__enemyReferences.getFraming());assert.ok(Math.max(...framing.size.slice(0,2))>.25,variant.id+' too small to inspect');
   await page.evaluate(()=>new Promise(resolve=>requestAnimationFrame(()=>requestAnimationFrame(resolve))));
   await page.locator('#reference-stage').screenshot({path:`${output}/${candidate.id}-${variant.name}.png`});
   console.log(`${variant.id}: ${variant.asset.clips.length} actions checked, ${changingClips} changing skin samples`);
  }
 }
 await page.getByLabel('Category',{exact:true}).selectOption('Bystanders');assert.equal(await page.locator('.candidate').count(),audit.candidates.filter(c=>c.category==='Bystanders').length);
 await page.getByLabel('Find a character').fill('Keira');assert.equal(await page.locator('.candidate').count(),1);await page.getByLabel('Find a character').fill('nothing-matches-zz');assert.match(await page.locator('#candidate-list').textContent(),/No matching/);
 await page.getByLabel('Find a character').fill('');await page.getByLabel('Category',{exact:true}).selectOption('all');
 await page.locator('[data-id="keira"]').click();await page.waitForFunction(()=>window.__enemyReferences.getDiagnostics().candidate==='keira'&&window.__enemyReferences.getDiagnostics().status==='ready');
 await page.getByLabel('Model variant').selectOption({label:'Rock Village'});await page.waitForFunction(()=>window.__enemyReferences.getDiagnostics().status==='ready'&&window.__enemyReferences.getDiagnostics().variant.includes('village2'));
 await page.getByLabel('Find an action').fill('welding');assert.equal(await page.locator('.action').count(),3);await page.locator('.action').first().click();assert.match((await page.evaluate(()=>window.__enemyReferences.getDiagnostics())).clip,/welding/);
 await page.getByLabel('Find an action').fill('');const before=await page.locator('#clip').inputValue();await page.getByRole('button',{name:'Next action',exact:true}).click();assert.notEqual(await page.locator('#clip').inputValue(),before);await page.getByRole('button',{name:'Previous action',exact:true}).click();assert.equal(await page.locator('#clip').inputValue(),before);
 await page.locator('#shortlist').click();assert.equal(await page.locator('#shortlist').getAttribute('aria-pressed'),'true');
 await page.reload();await page.waitForFunction(()=>window.__enemyReferences?.getDiagnostics().status==='ready');assert.equal(await page.locator('#shortlist').getAttribute('aria-pressed'),'true');
 const downloadPromise=page.waitForEvent('download');await page.getByRole('button',{name:'Export shortlist'}).click();const download=await downloadPromise;const downloadPath=`${output}/shortlist.json`;await download.saveAs(downloadPath);const exported=JSON.parse(await readFile(downloadPath,'utf8'));assert.deepEqual(exported.candidates.map(c=>c.id),['keira']);await page.locator('#shortlist').click();
 await page.evaluate(()=>Promise.all([window.__enemyReferences.choose('babak'),window.__enemyReferences.choose('keira'),window.__enemyReferences.choose('swamp-bat')]));assert.equal((await page.evaluate(()=>window.__enemyReferences.getDiagnostics())).candidate,'swamp-bat');assert.equal((await page.evaluate(()=>window.__enemyReferences.getDiagnostics())).status,'ready');
 await page.evaluate(()=>{const r=window.__enemyReferences;r.setClip('swamp-bat-swoop');r.seek(0);r.setPlaying(true);});await page.waitForTimeout(350);assert.ok((await page.evaluate(()=>window.__enemyReferences.getDiagnostics())).time>0);
 // Full renderer at native density, including recovered clips and bystander morphs.
 await page.goto(new URL('tools/enemies/reference-review.html?paused=1',base).href);await page.waitForFunction(()=>window.__enemyReferences?.getDiagnostics().status==='ready');await page.getByLabel('MAX / native').check();
 const captures=[['lurkercrab',null,'lurkercrab-peek'],['keira','assistant-lod0','assistant-idle-welding'],['samos',null,null],['farmer',null,null],['puffer',null,'puffer-puff-up'],['plant-boss',null,'plant-boss-main-attack'],['robotboss',null,'robotboss-blue-roar'],['ice-cube',null,'ice-cube-extend-spikes'],['flutflut',null,null],['yakow',null,'yakow-graze'],['daxter',null,null],['muse',null,null],['fisher',null,null],['oracle',null,null]];
 for(const [id,variant,clip] of captures){
  await page.evaluate(({id,variant})=>window.__enemyReferences.choose(id,variant??undefined),{id,variant});
  const ready=await page.evaluate(()=>window.__enemyReferences.getDiagnostics());assert.equal(ready.status,'ready',id+': '+ready.error);
  await page.evaluate(clip=>{const r=window.__enemyReferences;if(clip)r.setClip(clip);r.seek(r.getDiagnostics().duration*.47);},clip);
  for(const view of ['front','quarter','side']){await page.locator(`[data-view="${view}"]`).click();await page.screenshot({path:`${output}/native-${id}-${view}.png`});}
 }
 await page.evaluate(()=>window.__enemyReferences.choose('fisher'));const body=await page.evaluate(()=>window.__enemyReferences.getDiagnostics());await page.getByLabel('Include parked props').check();const props=await page.evaluate(()=>window.__enemyReferences.getDiagnostics());assert.equal(props.sourceTriangles,body.sourceTriangles);assert.equal(props.clip,body.clip);await page.screenshot({path:`${output}/native-fisher-all-props.png`});
 await page.evaluate(()=>window.__enemyReferences.choose('oracle'));assert.ok((await page.evaluate(()=>window.__enemyReferences.getDiagnostics())).sourceTriangles>1000);await page.getByRole('button',{name:'Play',exact:true}).isDisabled().then(value=>assert.ok(value));
 await page.evaluate(()=>window.__enemyReferences.choose('keira'));await page.getByLabel('Rig',{exact:true}).check();await page.screenshot({path:`${output}/skeleton-native.png`});
 const native=await page.evaluate(()=>window.__enemyReferences.getDiagnostics());assert.ok(native.resolution[0]>1800);rows.push({phase:'native',...native});
 await page.getByRole('link',{name:'Our enemy lab'}).click();await page.waitForFunction(()=>window.__enemyReview?.getDiagnostics().loaded===9,null,{timeout:60000});rows.push({phase:'existing-roster',loaded:9});
 await page.getByRole('link',{name:'Jak 1 characters'}).click();await page.waitForFunction(()=>window.__enemyReferences?.getDiagnostics().status==='ready');
 await page.setViewportSize({width:390,height:844});await page.screenshot({path:`${output}/mobile.png`,fullPage:true});assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth));
 assert.deepEqual(issues,[]);await writeFile(`${output}/report.json`,JSON.stringify({base,mode:uiOnly?'ui-only':'all-characters',rows,issues,summary:audit.summary},null,2));
 console.log(`PASS: ${uiOnly?'UI follow-up':'all 111 models / 670 actions'}, Jak 1 only, one character, variants, action controls, shortlist, async lifecycle, current lab, full/native and narrow layout.`);
}finally{await browser.close();}
