// Production entry, first-paint ownership and real failure/reload boundaries.
// Uses installed Playwright; no downloads, uploads or external page requests.
import assert from 'node:assert/strict';
import {mkdir,writeFile} from 'node:fs/promises';
import {createRequire} from 'node:module';
const {CSP}=createRequire(import.meta.url)('../desktop/policy.cjs');
const {chromium}=await import(process.env.PLAYWRIGHT_MODULE||'playwright');
const base=new URL(process.argv[2]||'http://127.0.0.1:5348/');
const output=process.env.STARTUP_OUTPUT||'/private/tmp/slipstream-startup-browser';
await mkdir(output,{recursive:true});
const html=await(await fetch(base)).text();
const entry=new URL(html.match(/<script[^>]*type="module"[^>]*src="([^"]+)"/)?.[1],base);
const source=await(await fetch(entry)).text();
const main=new URL(source.match(/import\("([^"\n]*main-[^"\n]+\.js)"\)/)?.[1],entry);
assert.match(main.pathname,/\/assets\/main-[^/]+\.js$/,'Build before running this production test');
const browser=await chromium.launch({channel:'chrome',headless:true}),rows=[];
const ready=page=>page.waitForFunction(()=>window.__game&&!window.__game.gameFlow.startupLoading&&!window.__game.gameFlow.loadingPhase&&!document.getElementById('game-startup'),null,{timeout:180000});
const snapshot=page=>page.evaluate(()=>{const root=document.getElementById('game-startup'),link=document.getElementById('game-startup-reload'),spinner=root?.querySelector('.startup-spinner');return{status:document.getElementById('game-startup-status')?.textContent,visible:!!root&&!root.hidden,failed:root?.hasAttribute('data-failed')??false,link:link?.getBoundingClientRect().toJSON(),viewport:[innerWidth,innerHeight],animation:spinner&&getComputedStyle(spinner).animationName,paint:performance.getEntriesByType('paint').map(e=>({name:e.name,ms:e.startTime})),game:!!window.__game};});
async function run(name,options,action){
 if(process.env.STARTUP_CASES&&!process.env.STARTUP_CASES.split(',').includes(name))return;
 const context=await browser.newContext({viewport:{width:1280,height:720},serviceWorkers:'block',...options}),page=await context.newPage(),errors=[],external=[];
 page.on('pageerror',e=>errors.push(e.message));page.on('console',m=>{if(m.type()==='error')errors.push(m.text());});
 await context.route('**/*',route=>{const url=new URL(route.request().url());if(/^https?:$/.test(url.protocol)&&url.origin!==base.origin){external.push(url.href);return route.abort();}return route.fallback();});
 try{const detail=await action({context,page,errors});assert.deepEqual(external,[]);rows.push({name,...detail,errors,external});console.log(JSON.stringify(rows.at(-1)));}
 finally{await writeFile(output+'/report.json',JSON.stringify({base:base.href,entry:entry.pathname,main:main.pathname,rows},null,2));await context.close();}
}
const play=()=>new URL('?playtest&level=slipstream-race&lite',base).href;
try{
 for(const name of ['delayed-entry','missing-entry'])await run(name,{},async({page})=>{
  let release;const held=new Promise(resolve=>release=resolve);
  await page.route(entry.href,route=>name==='missing-entry'?route.abort('failed'):held.then(()=>route.continue()));
  try{await page.goto(play(),{waitUntil:'commit'});await page.waitForTimeout(300);const state=await snapshot(page);assert.equal(state.visible,true);assert.match(state.status,/Loading game/);assert.equal(state.game,false);assert.ok(state.link.height>=44);await page.screenshot({path:`${output}/${name}.png`});if(name==='missing-entry'){await page.unroute(entry.href);await Promise.all([page.waitForEvent('domcontentloaded'),page.getByRole('link',{name:'Reload game'}).click()]);await ready(page);assert.equal(page.url(),play());state.nativeReloadRecovered=true;}return state;}finally{release();}
 });
 await run('no-javascript',{javaScriptEnabled:false,viewport:{width:320,height:568}},async({page})=>{
  await page.goto(play());assert.equal(await page.locator('#game-startup-status').isVisible(),false);assert.equal(await page.locator('noscript p').isVisible(),true);assert.equal(await page.getByRole('link',{name:'Reload game'}).isVisible(),true);await page.screenshot({path:output+'/no-javascript.png'});return{instructionsVisible:true};
 });
 for(const name of ['missing-main','missing-style','strict-csp'])await run(name,{},async({page,errors})=>{
  if(name==='strict-csp')await page.route(url=>url.pathname===base.pathname,async route=>{const response=await route.fetch();await route.fulfill({response,headers:{...response.headers(),'content-security-policy':CSP}});});
  await page.route(name==='missing-style'?/\/assets\/main-[^/]+\.css$/:main.href,route=>route.abort('failed'));
  await page.goto(play(),{waitUntil:'domcontentloaded'});
  await page.locator('#game-startup[data-failed]').waitFor();
  const failed=await snapshot(page);assert.match(failed.status,/couldn’t start/);assert.ok(errors.some(s=>s.includes('Game startup failed.')));await page.screenshot({path:`${output}/${name}.png`});
  if(name==='missing-style')return{failed};
  if(name==='strict-csp'){assert.ok(!errors.some(s=>/Content Security Policy|Refused to|violates the following/i.test(s)));return{failed};}
  await page.evaluate(()=>localStorage.setItem('solProtoStartupProbe','keep me'));
  await page.unroute(main.href);errors.length=0;
  await Promise.all([page.waitForEvent('domcontentloaded'),page.getByRole('link',{name:'Reload game'}).press('Enter')]);await ready(page);
  const recovered=await page.evaluate(()=>({url:location.href,saved:localStorage.getItem('solProtoStartupProbe'),level:window.__game.getCurrentLevel().id}));assert.equal(recovered.saved,'keep me');assert.equal(recovered.url,play());assert.equal(recovered.level,'slipstream-race');assert.deepEqual(errors,[]);return{failed,recovered};
 });
 for(const kind of ['webgl','preparation','frame'])await run(kind+'-failure',{},async({page,errors})=>{
  await page.addInitScript(kind=>{
   if(kind==='webgl'){const original=HTMLCanvasElement.prototype.getContext;HTMLCanvasElement.prototype.getContext=function(type,...args){return /webgl/i.test(type)?null:original.call(this,type,...args);};}
   else{if(sessionStorage.getItem('startup-fault-injected'))return;sessionStorage.setItem('startup-fault-injected','1');let game;Object.defineProperty(window,'__game',{configurable:true,get:()=>game,set:value=>{game=value;if(kind==='preparation')game.gameFlow.prepareMenuPresentation=async()=>{throw Error('Injected preparation failure');};else{window.__badFrames=0;game.gameFlow.prepareMenuPresentation=()=>new Promise(()=>{});game.gameFlow.update=()=>{window.__badFrames++;throw Error('Injected startup frame failure');};}}});}
  },kind);
  await page.goto(kind==='preparation'?base.href:play(),{waitUntil:'domcontentloaded'});await page.locator('#game-startup[data-failed]').waitFor({timeout:180000});await page.waitForTimeout(250);
  const state=await snapshot(page);assert.equal(state.visible,true);assert.match(state.status,/couldn’t start/);assert.ok(errors.length>0);
  if(kind==='frame')assert.equal(await page.evaluate(()=>window.__badFrames),1,'Fatal startup frames must stop retrying');
  await page.screenshot({path:`${output}/${kind}-failure.png`});const injectedErrors=[...errors];if(kind==='preparation'){assert.equal(await page.locator('#game-startup-reload').evaluate(e=>document.activeElement===e&&!e.closest('[inert]')),true);errors.length=0;await Promise.all([page.waitForEvent('domcontentloaded'),page.getByRole('link',{name:'Reload game'}).press('Enter')]);await ready(page);assert.deepEqual(errors,[]);state.keyboardRecovery=true;}return{...state,injectedErrors};
 });
 for(const variant of [{name:'lite',query:'?playtest&level=slipstream-race&lite',viewport:{width:1280,height:720}},{name:'full-mobile',query:'',viewport:{width:390,height:844},isMobile:true,hasTouch:true,reducedMotion:'reduce'},{name:'full-4x3',query:'',viewport:{width:960,height:720}}])await run(variant.name,variant,async({page,errors})=>{
  await page.addInitScript(()=>{window.__startupSamples=[];window.__startupTasks=[];new PerformanceObserver(list=>{for(const task of list.getEntries())window.__startupTasks.push({start:task.startTime,ms:task.duration});}).observe({type:'longtask',buffered:true});let last='';const sample=()=>{const root=document.getElementById('game-startup'),g=window.__game,state=!root?'removed':root.hidden?'hidden':'status';const row={ms:performance.now(),state,loading:g?.gameFlow.startupLoading??null,frames:g?.getGameFlowVortexDiagnostics().renderedFrames??0,context:g?.gameFlow.vortexContext??null,font:g?.getFontDiagnostics().ready??null};const key=JSON.stringify({...row,ms:0,frames:row.frames>0});if(key!==last){last=key;window.__startupSamples.push(row);}if(state!=='removed')requestAnimationFrame(sample);};requestAnimationFrame(sample);});
  await page.route(/\/(fonts\/roo-counter-v[^/]*\.png|[^/]*\.(woff2?|ttf|otf))(\?.*)?$/,async route=>{await new Promise(resolve=>setTimeout(resolve,1200));await route.continue();});
  // Hold only the heavy entry so the screenshot is a real pre-evaluation paint.
  let release;const held=new Promise(resolve=>release=resolve);await page.route(main.href,route=>held.then(()=>route.continue()));
  await page.goto(new URL(variant.query,base).href,{waitUntil:'commit'});await page.waitForTimeout(200);const initial=await snapshot(page);assert.equal(initial.visible,true);assert.equal(initial.game,false);if(variant.reducedMotion)assert.equal(initial.animation,'none');assert.ok(initial.link.x>=0&&initial.link.y>=0&&initial.link.right<=initial.viewport[0]&&initial.link.bottom<=initial.viewport[1]);await page.screenshot({path:`${output}/${variant.name}-loading.png`});release();await ready(page);await page.waitForTimeout(120);
  const final=await page.evaluate(()=>({samples:window.__startupSamples,tasks:window.__startupTasks,stamp:document.querySelector('.hud-build')?.textContent,font:window.__game.getFontDiagnostics(),loading:window.__game.getLoadingDiagnostics(),context:window.__game.gameFlow.vortexContext,screen:window.__game.gameFlow.currentScreen,pendingLabels:document.querySelectorAll('.game-shell [data-roo-menu]:not([data-ready])').length,paint:performance.getEntriesByType('paint').map(e=>({name:e.name,ms:e.startTime})),gl:window.__game.renderer.getContext().getError()}));
  assert.ok(final.samples.some(s=>s.state==='hidden'&&s.frames>0&&s.loading),'Game loading animation must take over before readiness');assert.equal(final.samples.at(-1).state,'removed');assert.ok(final.paint.find(e=>e.name==='first-contentful-paint').ms<final.tasks.find(t=>t.ms>1000).start,'Status must paint before heavy evaluation');assert.equal(final.gl,0);assert.deepEqual(final.loading.pending,[]);assert.deepEqual(final.loading.failed,[]);assert.equal(final.pendingLabels,0);assert.deepEqual(errors,[]);if(!variant.query){assert.equal(final.screen,'launch');assert.equal(final.font.ready,true);}await page.screenshot({path:`${output}/${variant.name}-ready.png`});return{initial,final};
 });
 await run('missing-optional-art',{viewport:{width:568,height:320},isMobile:true,hasTouch:true},async({page,errors})=>{
  await page.route(/\/fonts\/roo-counter-v[^/]*-light1[^/]*\.png$/,route=>route.abort('failed'));
  await page.goto(base.href,{waitUntil:'domcontentloaded'});await ready(page);
  const state=await page.evaluate(()=>({font:window.__game.getFontDiagnostics(),screen:window.__game.gameFlow.currentScreen,pending:document.querySelectorAll('.game-shell [data-roo-menu]:not([data-ready])').length}));
  assert.equal(state.font.ready,true);assert.equal(state.screen,'launch');assert.equal(state.pending,0);assert.ok(errors.every(e=>e==='Failed to load resource: net::ERR_FAILED'));await page.screenshot({path:output+'/missing-optional-art.png'});return state;
 });
 console.log('PASS startup browser scenarios: '+rows.map(row=>row.name).join(', '));
}finally{await browser.close();}
