// Actual debug toggle, DOM/CRT announcement policy and ordinary loop-course exit.
// Fixture placement isolates finish admission; test-loop-ride covers traversal.
import assert from 'node:assert/strict';
import {mkdir,writeFile} from 'node:fs/promises';
const {chromium}=await import(process.env.PLAYWRIGHT_MODULE||'playwright');
const base=process.argv[2]||'http://127.0.0.1:5187/';
const output=process.env.ANNOUNCEMENTS_OUTPUT||'/private/tmp/gameplay-announcements';
const full=process.env.ANNOUNCEMENTS_FULL==='1';
await mkdir(output,{recursive:true});
const browser=await chromium.launch({channel:'chrome',headless:true});
const report={base,full,errors:[]};
try {
  const page=await browser.newPage({viewport:{width:1600,height:1000},deviceScaleFactor:1});
  page.setDefaultTimeout(120000);
  await page.addInitScript(()=>localStorage.setItem('solProtoDebugChrome','hidden'));
  page.on('pageerror',e=>report.errors.push(e.message));
  page.on('console',m=>{if(m.type()==='error')report.errors.push(m.text());});
  await page.goto(new URL(`?playtest&level=waterpark${full?'':'&lite'}`,base).href,{waitUntil:'domcontentloaded'});
  await page.waitForFunction(()=>window.__game?.getCurrentLevel().id==='waterpark'&&!window.__game.gameFlow.blocksGameplay);
  if(full)await page.evaluate(()=>window.__game.renderQualitySettings.setRegularResolution(null));
  report.hidden=await page.evaluate(()=>{
    const {ui,gameFlow}=window.__game;
    ui.showMessage('DIAGNOSTIC NOTICE','Hidden during normal play',0);
    ui.restoreMessage({title:'RESTORED NOTICE',sub:'Still hidden',remainingMs:2000});
    ui.showDeathScreen(true);
    return {debug:gameFlow.developerChromeVisible,message:ui.captureMessage(),timer:ui.msgTimer??null,
      display:getComputedStyle(document.querySelector('.hud-msg')).display,
      legacyDeath:getComputedStyle(document.querySelector('.hud-death')).display};
  });
  assert.deepEqual(report.hidden,{debug:false,message:null,timer:null,display:'none',legacyDeath:'none'});
  // The Canvas painter must also refuse explicit frames that bypass UI.showMessage.
  report.canvas=await page.evaluate(()=>{
    const surface=window.__game.ui.gameHudSurface,draw=surface.drawRooInRect;
    const titles=[];surface.drawRooInRect=function(ctx,text,...args){titles.push(text);return draw.call(this,ctx,text,...args);};
    try {
      const probe=debugMessages=>{
        titles.length=0;
        surface.paintMessage(surface.context,new Map(),1600,1000,{debugMessages,message:{title:'EXPLICIT NOTICE',sub:''}});
        surface.paintDeath(surface.context,new Map(),1600,1000,{debugMessages,death:{title:'LEGACY NOTICE',sub:''}});
        return [...titles];
      };
      return {default:probe(undefined),hidden:probe(false),debug:probe(true)};
    }finally{surface.drawRooInRect=draw;}
  });
  assert.deepEqual(report.canvas.default,[]);assert.deepEqual(report.canvas.hidden,[]);
  assert.ok(report.canvas.debug.includes('EXPLICIT NOTICE')&&report.canvas.debug.includes('LEGACY NOTICE'));
  await page.keyboard.press('KeyM');
  await page.waitForFunction(()=>window.__game.gameFlow.developerChromeVisible);
  await page.evaluate(()=>{
    const {ui}=window.__game,surface=ui.gameHudSurface,draw=surface.drawRooInRect;
    window.__noticeDraws=0;window.__restoreNoticePainter=()=>{surface.drawRooInRect=draw;};
    surface.drawRooInRect=function(ctx,text,...args){if(text==='DIAGNOSTIC NOTICE')window.__noticeDraws++;return draw.call(this,ctx,text,...args);};
    ui.showMessage('DIAGNOSTIC NOTICE','Only visible with debug enabled',60000);
    window.__savedNotice=ui.captureMessage();
  });
  // RooLabel commits its text on the next animation frame. Lite exposes that
  // live DOM; exercise the equivalent UI-owned CRT frame after the commit.
  await page.waitForFunction(()=>document.querySelector('.hud-msg-title')?.textContent==='DIAGNOSTIC NOTICE');
  await page.evaluate(()=>window.__game.ui.drawGameHud(window.__game.renderer,{width:1600,height:1000},null));
  report.debug=await page.evaluate(()=>({state:window.__game.ui.captureMessage(),painted:window.__noticeDraws,display:getComputedStyle(document.querySelector('.hud-msg')).display,
    enabled:window.__game.ui.debugMessagesEnabled,title:document.querySelector('.hud-msg-title')?.textContent,
    rect:document.querySelector('.hud-msg').getBoundingClientRect().toJSON()}));
  assert.equal(report.debug.state.title,'DIAGNOSTIC NOTICE');assert.equal(report.debug.display,'block');
  await page.screenshot({path:`${output}/debug-only.png`});
  assert.ok(report.debug.painted>0,JSON.stringify(report.debug));
  await page.keyboard.press('KeyM');
  await page.waitForFunction(()=>!window.__game.gameFlow.developerChromeVisible);
  report.cleared=await page.evaluate(()=>{
    const {ui}=window.__game;window.__restoreNoticePainter();
    ui.restoreMessage(window.__savedNotice);
    return {state:ui.captureMessage(),timer:ui.msgTimer??null,display:getComputedStyle(document.querySelector('.hud-msg')).display};
  });
  assert.deepEqual(report.cleared,{state:null,timer:null,display:'none'});
  await page.keyboard.press('KeyM');
  assert.equal(await page.evaluate(()=>window.__game.ui.captureMessage()),null,'Reopening debug cannot replay a hidden announcement');
  await page.keyboard.press('KeyM');
  await page.keyboard.press('KeyP');
  await page.waitForFunction(()=>window.__game.gameFlow.currentScreen==='pause');
  report.pause=await page.evaluate(()=>window.__game.gameFlow.currentScreen);
  await page.keyboard.press('Escape');
  await page.waitForFunction(()=>!window.__game.gameFlow.blocksGameplay);
  await page.screenshot({path:`${output}/normal-play.png`});
  await page.evaluate(()=>{
    const {player:p,getLevel}=window.__game,l=getLevel();
    window.__courseHints=[];const hint=p.onCourseHint;
    p.onCourseHint=(title,sub)=>{window.__courseHints.push(title);hint(title,sub);};
    // Approach the real finish on its supported deck without riding any loop.
    p.respawn(l,true,false,{position:p.pos.clone().set(60,-164.9,-1052),heading:p.camDir.clone().set(0,0,-1)});
    p.snapRenderInterpolation();
  });
  await page.keyboard.down('Space');await page.keyboard.down('ArrowUp');
  try{await page.waitForFunction(()=>window.__game.player.state==='finished',null,{timeout:15000});}
  finally{await page.keyboard.up('ArrowUp');await page.keyboard.up('Space');}
  report.finish=await page.evaluate(()=>({state:window.__game.player.state,loops:window.__game.player.loopStatus.completed,hints:window.__courseHints}));
  assert.deepEqual(report.finish,{state:'finished',loops:0,hints:[]});
  await page.waitForFunction(()=>window.__game.gameFlow.currentScreen==='results'&&!window.__game.gameFlow.transitionActive);
  report.results=await page.evaluate(()=>({screen:window.__game.gameFlow.currentScreen,message:window.__game.ui.captureMessage(),stamp:document.querySelector('.hud-build')?.textContent}));
  assert.equal(report.results.message,null);assert.match(report.results.stamp,/Codex\/sol fork/);
  await page.screenshot({path:`${output}/ordinary-results.png`});
  assert.deepEqual(report.errors,[]);
  console.log(`PASS ${full?'full/native':'lite'}: debug-only DOM/CRT announcements, immediate clearing, no stale restore, Pause and zero-loop finish/results`);
} finally {
  await writeFile(`${output}/report.json`,JSON.stringify(report,null,2));
  await browser.close();
}
