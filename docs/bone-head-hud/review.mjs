// Task-scoped browser evidence. Run only after the shared capacity guard admits it.
import assert from 'node:assert/strict';
import {mkdir,writeFile} from 'node:fs/promises';
import {fileURLToPath} from 'node:url';
const {chromium}=await import(process.env.PLAYWRIGHT_MODULE||'playwright');
const base=process.argv[2]||'http://127.0.0.1:5198/';
const out=fileURLToPath(new URL('./',import.meta.url));
await mkdir(out,{recursive:true});
const browser=await chromium.launch({channel:'chrome',headless:true});
const report={base,cases:[],errors:[],requests:[]};
async function ready(page){
  await page.waitForFunction(()=>window.__game&&!window.__game.gameFlow.transitionActive&&window.__game.getGameHudDiagnostics().lifeFaceReady,null,{timeout:120000});
}
async function check(page,label,style){
  await page.waitForFunction(style=>window.__game.getCharacterHeadStyle()===style&&document.querySelector('.hud-icon-face')?.dataset.headStyle===style&&window.__game.getGameHudDiagnostics().lifeFaceReady,style);
  await page.waitForTimeout(400);
  const snapshot=await page.evaluate(()=>{
    const g=window.__game,face=document.querySelector('.hud-icon-face'),wrap=face.parentElement,value=document.querySelector('.hud-lives'),row=face.closest('.hud-life-row');
    const rect=e=>{const r=e.getBoundingClientRect();return {x:r.x,y:r.y,width:r.width,height:r.height,bottom:r.bottom,right:r.right};};
    return {head:g.getCharacterHeadStyle(),face:rect(face),value:rect(value),label:face.getAttribute('aria-label'),background:getComputedStyle(face).backgroundImage,transform:getComputedStyle(wrap).transform,visibility:getComputedStyle(row).visibility,opacity:getComputedStyle(row).opacity,hud:g.getGameHudDiagnostics(),resolution:g.renderQualitySettings.regularResolution,composited:document.querySelector('.game-hud-layer').classList.contains('precrt-composited'),modern:g.player.endlessDeaths,viewport:[innerWidth,innerHeight]};
  });
  assert.match(snapshot.background,style==='skull'?/bone-head\.png/:/roo\.png/);
  assert.match(snapshot.hud.lifeFaceUrl,style==='skull'?/bone-head\.png/:/roo\.png/);
  assert.equal(snapshot.visibility,'visible');
  assert.ok(snapshot.face.x>=0&&snapshot.face.y>=0&&snapshot.face.right<=snapshot.viewport[0]+1&&snapshot.face.bottom<=snapshot.viewport[1]+1);
  report.cases.push({label,...snapshot});
  await page.screenshot({path:`${out}${label}.png`});
  console.log('Reviewed',label,JSON.stringify({head:snapshot.head,face:snapshot.face,value:snapshot.value,composited:snapshot.composited}));
}
try{
  for(const lite of [true,false]){
    const context=await browser.newContext({viewport:{width:1920,height:1080}});
    const page=await context.newPage();
    page.on('pageerror',e=>report.errors.push(e.message));
    page.on('console',m=>{if(m.type()==='error')report.errors.push(m.text());});
    page.on('response',r=>{if(/(?:bone-head|roo)\.png/.test(r.url()))report.requests.push({url:r.url(),status:r.status()});});
    await page.addInitScript(()=>localStorage.setItem('solProtoDebugChrome','hidden'));
    await page.goto(base+'?playtest&level=codex-lab'+(lite?'&lite':''),{timeout:120000});
    await ready(page);
    await page.evaluate(()=>{window.__game.player.endlessDeaths=false;window.__game.player.lives=3;});
    await page.keyboard.down('KeyI');
    await check(page,`${lite?'lite':'full'}-skull-1080`,'skull');
    await page.evaluate(()=>window.__game.setCharacterHeadStyle('alternate'));
    await check(page,`${lite?'lite':'full'}-roo-1080`,'alternate');
    if(lite){
      await page.reload();await ready(page);
      await page.keyboard.up('KeyI');await page.keyboard.down('KeyI');
      await page.evaluate(()=>{window.__game.player.endlessDeaths=false;window.__game.player.lives=3;});
      await check(page,'lite-roo-reloaded','alternate');
      await page.evaluate(()=>window.__game.setCharacterHeadStyle('skull'));
      await check(page,'lite-skull-switched-back','skull');
      for(const [width,height] of [[1280,720],[1024,768],[390,844],[844,390]]){
        await page.setViewportSize({width,height});
        await check(page,`lite-skull-${width}x${height}`,'skull');
      }
      await page.setViewportSize({width:1280,height:720});
      await page.evaluate(()=>{window.__game.player.endlessDeaths=true;window.__game.player.totalDeaths=3;});
      await check(page,'lite-skull-modern','skull');
    }else{
      await page.evaluate(()=>{window.__game.setCharacterHeadStyle('skull');window.__game.renderQualitySettings.setRegularResolution(null);});
      await check(page,'full-native-skull-1080','skull');
      await page.evaluate(()=>{window.__game.player.endlessDeaths=true;window.__game.player.totalDeaths=3;});
      await check(page,'full-native-skull-modern','skull');
    }
    await context.close();
  }
  assert.deepEqual(report.errors,[]);
  assert.ok(report.requests.every(r=>r.status===200));
  console.log('PASS portrait selection, reload persistence, desktop/compact alignment, lite/full/MAX and clean console.');
}finally{
  await writeFile(`${out}report.json`,JSON.stringify(report,null,2));
  await browser.close();
}
