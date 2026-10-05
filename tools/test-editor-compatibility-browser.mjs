import assert from 'node:assert/strict';
import { mkdir, writeFile } from 'node:fs/promises';
const { chromium } = await import(process.env.PLAYWRIGHT_MODULE || 'playwright');
const base=(process.argv.find(value=>/^https?:/.test(value))||'http://127.0.0.1:5197/').replace(/\/$/,'');
const output=process.env.EDITOR_AUDIT_OUTPUT||'/private/tmp/editor-compatibility-browser';
await mkdir(output,{recursive:true});
const browser=await chromium.launch({channel:'chrome',headless:true});
const errors=[],report={base,checks:[],levels:[],errors};
const page=await browser.newPage({viewport:{width:1440,height:900}});
// Keep the loaded revision while other chats author this shared checkout.
// Preserve Vite's styles and injected constants, disabling only its HMR socket.
await page.addInitScript(()=>{
 const Native=WebSocket;
 window.WebSocket=new Proxy(Native,{construct(Target,args){
  if(args[1]==='vite-hmr')return Object.assign(new EventTarget(),{readyState:0,send(){},close(){}});
  return Reflect.construct(Target,args);
 }});
});
page.on('pageerror',error=>{errors.push(error.message);console.error(error.message);});
page.on('console',message=>{if(message.type()==='error'){errors.push(message.text());console.error(message.text());}});
const ready=()=>page.waitForFunction(()=>window.__game&&!window.__game.gameFlow.blocksGameplay,null,{timeout:120000});
try {
 await page.goto(`${base}/?lite&playtest&level=codex-lab`);await ready();
 await page.evaluate(()=>window.__game.campaign.startEphemeral());
 const ids=process.argv.includes('--playtest-only')?[]:['codex-lab','treehouse-trail','jungle','jungle-terraces','jungle-skyline','slipstream-2','test','custard-creek','dark','nightworks-after-hours','warproom','descent','beachfront','island-hopper','crate-primer','switchyard','clockwork-gauntlet','ghost-train','drowned-crown','bone-yard','waterpark','crab-chief','jungle-cup','waterpark-cup','bonus-jungle-skyline'];
 for(const id of ids) {
  const result=await page.evaluate(id=>{
   const g=window.__game;
   if(!g.switchLevel(id))throw new Error(`Cannot switch to ${id}`);
   const original=g.getLevel(),position=g.player.pos.toArray(),deaths=g.player.totalDeaths;
   const saved=localStorage.getItem('solProtoUserLevels');
   g.openEditor();
   const e=g.editor;
   if(!e.active)throw new Error(`Cannot open editor for ${id}`);
   if(getComputedStyle(e.panel).display==='none')throw new Error(`${id} active editor controls are hidden`);
   const json=JSON.stringify(e.data),types=[...new Set(e.data.components.map(c=>c.t))];
   // Exercise the real inspector once for every represented component type.
   // Defaults displayed by getters must never become authored JSON.
   for(const t of types){e.sel=[e.data.components.findIndex(c=>c.t===t)];e.renderProps();}
   e.sel=[];e.renderProps();
   if(JSON.stringify(e.data)!==json)throw new Error(`${id} inspector changed authored data`);
   if(g.getLevel()!==original)throw new Error(`${id} open replaced live level`);
   if(JSON.stringify(g.player.pos.toArray())!==JSON.stringify(position)||g.player.totalDeaths!==deaths)
    throw new Error(`${id} open changed player state`);
   document.querySelector('.ed-test').click();
   if(e.active||g.getLevel()!==original)throw new Error(`${id} no-op TEST rebuilt level`);
   if(localStorage.getItem('solProtoUserLevels')!==saved)throw new Error(`${id} no-op saved a level`);
   return{id,components:e.data.components.length,types};
  },id);
  report.levels.push(result);console.log(`PASS ${id}: ${result.components} components / ${result.types.length} types; pure inspector and no-op TEST`);
 }
 if(ids.length)report.checks.push(`${ids.length} representative current levels retain live objects/player/storage on editor open, property inspection and no-op TEST`);
 // Import through the production editor, perform one transform/history round
 // trip, then play through support, native checkpoint, death and finish logic.
 const fixture={v:1,name:'Editor compatibility smoke',spawn:[0,1.1,8],killY:-12,components:[
  {t:'platform',p:[0,-.5,0],s:[10,1,28]},
  {t:'checkpoint',p:[0,0,2]},
  {t:'gate',p:[0,0,-10]},
  {t:'pit',p:[7,-1,-1],s:[4,2,10]},
  {t:'spinbridge',p:[9,0,8],s:[6,.55,3],yaw:0,cycle:.7},
 ]};
 const edited=await page.evaluate(fixture=>{
  const g=window.__game;g.switchLevel('codex-lab');g.openEditor();g.editor.importLevel(fixture);
  const e=g.editor;if(e.data.name!==fixture.name)throw new Error('Production import rejected fixture');
  const id=e.targetId,baseline=JSON.stringify(e.data);e.sel=[4];e.rotateSelection(90);
  if(e.data.components[4].yaw!==90)throw new Error('Spinbridge did not rotate');
  e.undo();if(JSON.stringify(e.data)!==baseline)throw new Error('Undo did not restore imported data');
  e.redo();if(e.data.components[4].yaw!==90)throw new Error('Redo did not restore spinbridge turn');
  document.querySelector('.ed-test').click();
  return{id,competition:g.getCompetition(),competitionMode:g.player.competitionMode};
 },fixture);
 assert.equal(edited.competition,null);assert.equal(edited.competitionMode,false);
 await page.waitForFunction(()=>window.__game.player.grounded,null,{timeout:15000});
 assert.equal(await page.evaluate(()=>window.__game.player.totalDeaths),0);
 await page.keyboard.down('KeyW');
 await page.waitForFunction(()=>window.__game.player.pos.z<4.2,null,{timeout:15000});
 await page.keyboard.press('KeyF',{delay:80});
 await page.waitForFunction(()=>window.__game.getLevel().activeCheckpoint!==null,null,{timeout:15000});
 await page.keyboard.up('KeyW');
 const checkpoint=await page.evaluate(()=>({position:window.__game.getLevel().activeCheckpoint.spawnPos.toArray(),lives:window.__game.player.lives}));
 await page.evaluate(()=>{const g=window.__game;window.__editorPitLives=g.player.lives;g.player.pos.set(7,-3,-1);g.player.snapRenderInterpolation();});
 await page.waitForFunction(()=>window.__game.player.lives<window.__editorPitLives&&window.__game.player.state!=='dead'&&window.__game.player.grounded,null,{timeout:20000});
 const respawn=await page.evaluate(()=>({position:window.__game.player.pos.toArray(),lives:window.__game.player.lives}));
 assert.equal(respawn.lives,checkpoint.lives-1);assert.ok(Math.hypot(...respawn.position.map((v,i)=>v-checkpoint.position[i]))<2);
 await page.keyboard.down('KeyW');
 await page.waitForFunction(()=>window.__game.player.state==='finished',null,{timeout:20000});
 await page.keyboard.up('KeyW');
 report.playtest={edited,checkpoint,respawn,state:'finished'};report.checks.push('Actual import/rotate/undo/redo/TEST yields supported spawn, walking checkpoint, pit respawn and finish');
 await page.goto(`${base}/?playtest&level=ghost-train`);await ready();
 await page.evaluate(async()=>{await window.__game.getLevel().prepareGhostTrainAssets();window.__game.openEditor();});
 await page.waitForFunction(()=>window.__game.editor.active);
 assert.equal(await page.locator('.ed-test').isVisible(),true,'Hidden Debug menus must not hide an active editor');
 await page.screenshot({path:`${output}/ghost-train-full-editor.png`});
 await page.locator('.ed-test').click();
 await page.waitForFunction(()=>!window.__game.editor.active);
 assert.match(await page.locator('.hud-build').textContent(),/Codex\/sol fork/);
 report.checks.push('Full-render Ghost Train editor and no-op TEST, correct public build stamp');
 if(!process.argv.includes('--production')){
  await page.goto(`${base}/tools/editor-pointer-review.html`);
  await page.locator('#run').click();
  await page.waitForFunction(()=>document.body.dataset.pointerReview==='passed'||document.body.dataset.pointerReview==='failed',null,{timeout:30000});
  report.pointer=await page.locator('#summary').textContent();assert.equal(await page.locator('body').getAttribute('data-pointer-review'),'passed');
  report.checks.push('Real browser touch/pen/cancel/scrub/view pointer harness');
 }
 assert.deepEqual(errors,[],'Editor browser console must stay clean');
 console.log(JSON.stringify({checks:report.checks,levels:report.levels.length,pointer:report.pointer,errors,output}));
} catch(error){
 report.failure={message:error.message,state:await page.evaluate(()=>{const g=window.__game;return g?{level:g.getCurrentLevel().id,screen:g.gameFlow.currentScreen,blocked:g.gameFlow.blocksGameplay,editor:g.editor.active,position:g.player.pos.toArray(),playerState:g.player.state,grounded:g.player.grounded,spin:g.player.spinning,checkpoint:!!g.getLevel().activeCheckpoint}:null;}).catch(()=>null)};
 console.error(JSON.stringify(report.failure));throw error;
} finally {await writeFile(`${output}/report.json`,JSON.stringify(report,null,2));await browser.close();}
