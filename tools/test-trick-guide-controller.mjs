// Runs against dev, a production preview or Pages; input enters through navigator.getGamepads.
import assert from 'node:assert/strict';
import {mkdir,writeFile} from 'node:fs/promises';
const {chromium}=await import(process.env.PLAYWRIGHT_MODULE||'playwright');
const base=process.argv[2]||'http://127.0.0.1:5336/';
const out=process.env.MENU_TEST_OUT||'/private/tmp/trick-guide-controller';
await mkdir(out,{recursive:true});
const browser=await chromium.launch({channel:'chrome',headless:true});
const report={checks:[],errors:[]};
const profiles=process.env.GUIDE_QUICK?[[1280,720,false]]:[[1280,720,false],[1920,1080,false],[1024,768,false],[320,568,false],[568,320,false],[390,844,true],[844,390,true]];
try {
 for(const lite of [true,false]) for(const [width,height,touch] of profiles.filter(p=>lite||[1280,568,844].includes(p[0]))) {
  const context=await browser.newContext({viewport:{width,height},hasTouch:touch,isMobile:touch});
  const page=await context.newPage();
  page.on('pageerror',e=>report.errors.push(e.message));
  page.on('console',m=>{if(m.type()==='error')report.errors.push(m.text());});
  await page.addInitScript(()=>{
   window.guidePad={id:'DualSense Wireless Controller',index:0,connected:true,mapping:'standard',timestamp:0,axes:[0,0,0,0],buttons:Array.from({length:18},()=>({pressed:false,touched:false,value:0}))};
   Object.defineProperty(navigator,'getGamepads',{value:()=>[window.guidePad]});
  });
  await page.goto(base+'?playtest&level=jungle-cup'+(lite?'&lite':''));
  await page.waitForFunction(()=>window.__game&&!document.body.classList.contains('game-startup-loading')&&!window.__game.gameFlow.transitionActive,null,{timeout:120000});
  const stamp=await page.locator('.hud-build').textContent();assert.match(stamp,/Codex\/sol fork/);
  const pad=async(button,axis=0,hold=110)=>{
   const key=axis?(axis>0?'right':'left'):({0:'accept',1:'back',12:'up',13:'down',14:'left',15:'right'})[button];
   await page.evaluate(({button,axis})=>{if(axis)window.guidePad.axes[0]=axis;else Object.assign(window.guidePad.buttons[button],{pressed:true,value:1});window.guidePad.timestamp++;},{button,axis});
   await page.waitForFunction(key=>{
    const g=window.__game;return (g.gameFlow.currentScreen?g.gameFlow.previousPad:g.competitionUI.previous)[key];
   },key,{timeout:10000});
   await page.waitForTimeout(hold);
   await page.evaluate(()=>{window.guidePad.axes.fill(0);window.guidePad.buttons.forEach(b=>Object.assign(b,{pressed:false,value:0}));window.guidePad.timestamp++;});
   await page.waitForFunction(()=>{
    const g=window.__game;return !Object.values(g.gameFlow.currentScreen?g.gameFlow.previousPad:g.competitionUI.previous).some(Boolean);
   },null,{timeout:10000});
   await page.waitForTimeout(90);
  };
  const state=()=>page.locator('.game-trick-content,.comp-guide-grid').filter({visible:true}).evaluate(e=>{
   const r=e.getBoundingClientRect(),nodes=[...e.querySelectorAll('[data-guide-entry]')];
   const outside=nodes.filter(n=>{const b=n.getBoundingClientRect();return b.top<r.top-1||b.bottom>r.bottom+1||b.left<r.left-1||b.right>r.right+1;}).map(n=>n.textContent);
   const wide=[...e.querySelectorAll('td,th,p')].filter(n=>n.scrollWidth>n.clientWidth+1).map(n=>n.textContent);
   return {page:e.parentElement.querySelector('[aria-live]').textContent,entries:nodes.map(n=>Number(n.dataset.guideEntry)),rows:[...e.querySelectorAll('tbody tr')].map(n=>n.cells[1].textContent),outside,wide,scroll:e.scrollHeight-e.clientHeight,scrollTop:e.scrollTop};
  });
  for(const screen of ['options','cup']) {
   if(screen==='options') {
    await page.evaluate(()=>window.__game.gameFlow.showPause({levelName:'Jungle Cup',inWarpRoom:false}));
    for(let i=0;i<12&&!await page.locator('.game-menu-button.selected').filter({hasText:'OPTIONS'}).count();i++)await pad(13);
    await pad(0);
    await page.waitForFunction(()=>window.__game.gameFlow.currentScreen==='options');
    for(let i=0;i<12&&!await page.locator('.game-menu-button.selected').filter({hasText:'TRICK GUIDE'}).count();i++)await pad(13);
    await pad(0);
   } else {
    await page.evaluate(()=>window.__game.gameFlow.hide());
    await page.waitForSelector('.comp-intro');
    await page.waitForTimeout(120);
    await pad(13);await pad(0);
   }
   await page.waitForSelector('.game-trick-content,.comp-guide-grid');
   await page.waitForTimeout(200);
   const first=await state(),count=Number(first.page.split('/')[1]),entries=[],rows=[];
   assert.equal(first.page,`1 / ${count}`);
   for(let i=0;i<count;i++) {
    const s=await state();
    assert.equal(s.page,`${i+1} / ${count}`);
    assert.deepEqual(s.outside,[],`${width}x${height} ${screen}: clipped text`);
    assert.deepEqual(s.wide,[],`${width}x${height} ${screen}: clipped columns`);
    assert.ok(s.scroll<=1,`${width}x${height} ${screen}: requires vertical scrolling`);
    assert.equal(s.scrollTop,0);
    entries.push(...s.entries);rows.push(...s.rows);
    if(i===count-1||s.rows.includes('Darkslide')||s.rows.includes('Lipslide'))await page.screenshot({path:`${out}/${lite?'lite':'full'}-${width}x${height}-${screen}-${i+1}.png`});
    // Alternate D-pad and stick; holding must only turn one page.
    await pad(15,i%2?1:0,i===0?400:110);
   }
   assert.deepEqual(entries,Array.from({length:37},(_,i)=>i),'every guide row and paragraph must be reachable exactly once');
   assert.equal(rows.length,27);assert.equal(new Set(rows).size,27);
   assert.equal((await state()).page,`1 / ${count}`,'forward wrap');
   await pad(14);assert.equal((await state()).page,`${count} / ${count}`,'reverse wrap');
   const anchor=(await state()).entries[0];
   await page.setViewportSize({width:height,height:width});await page.waitForTimeout(160);
   assert.ok((await state()).entries.includes(anchor),'rotation lost reading position');
   assert.ok((await state()).scroll<=1,'rotation introduced scrolling');
   await page.setViewportSize({width,height});await page.waitForTimeout(160);
   const beforeKeyboard=await state();
   await page.keyboard.press('ArrowRight');await page.waitForTimeout(80);
   assert.notEqual((await state()).page,beforeKeyboard.page);
   const beforePointer=(await state()).page;
   await page.getByRole('button',{name:'Next trick page',exact:true})[touch?'tap':'click']();await page.waitForTimeout(80);
   assert.notEqual((await state()).page,beforePointer);
   // Confirm on the selected page arrow also pages once; Back returns to its owner.
   const beforeConfirm=(await state()).page;await pad(0);
   assert.notEqual((await state()).page,beforeConfirm);
   await pad(1);
   if(screen==='options'){
    assert.equal(await page.evaluate(()=>window.__game.gameFlow.currentScreen),'options');
    assert.equal(await page.evaluate(()=>window.__game.gameFlow.blocksGameplay),true);
   }else assert.equal(await page.locator('.comp-intro').count(),1);
   report.checks.push({lite,width,height,touch,screen,pages:count,entries:entries.length,tricks:rows.length,controller:true,resize:true,stamp});
  }
  await context.close();
 }
 assert.deepEqual(report.errors,[]);console.log(`PASS ${report.checks.length} guide layouts: every trick and rule reachable with controller, no scrolling, page wrap, resize, keyboard, pointer/touch and Back.`);
} finally {await writeFile(out+'/report.json',JSON.stringify(report,null,2));await browser.close();}
