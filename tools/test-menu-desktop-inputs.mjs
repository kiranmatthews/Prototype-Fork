// Real browser input paths for the TV layout and shared Pause debug switch.
import assert from 'node:assert/strict';
import {mkdir,writeFile} from 'node:fs/promises';
const {chromium}=await import(process.env.PLAYWRIGHT_MODULE||'playwright');
const base=process.argv[2]||'http://127.0.0.1:5193/';
const output=process.env.MENU_TEST_OUT||'/private/tmp/menu-desktop-inputs';
await mkdir(output,{recursive:true});
const browser=await chromium.launch({channel:'chrome',headless:true});
const report={checks:[],errors:[]};
try {
 for(const lite of [true,false]) {
  const context=await browser.newContext({viewport:{width:1920,height:1080}});
  const page=await context.newPage();
  page.on('pageerror',e=>report.errors.push(e.message));
  page.on('console',m=>{if(m.type()==='error')report.errors.push(m.text());});
  await page.addInitScript(()=>{
   window.menuPad={id:'DualSense Wireless Controller',index:0,connected:true,mapping:'standard',timestamp:0,axes:[0,0,0,0],buttons:Array.from({length:18},()=>({pressed:false,touched:false,value:0}))};
   Object.defineProperty(navigator,'getGamepads',{value:()=>[window.menuPad]});
  });
  await page.goto(base+'menu-review.html?playtest&level=codex-lab'+(lite?'&lite':''));
  await page.waitForFunction(()=>window.__menuReview&&!window.__game.gameFlow.transitionActive,null,{timeout:120000});
  const pad=async(index,axis=false)=>{
   await page.evaluate(({index,axis})=>{if(axis)window.menuPad.axes[1]=1;else Object.assign(window.menuPad.buttons[index],{pressed:true,value:1});window.menuPad.timestamp++;},{index,axis});
   await page.waitForTimeout(180);
   await page.evaluate(()=>{window.menuPad.axes.fill(0);window.menuPad.buttons.forEach(b=>Object.assign(b,{pressed:false,value:0}));window.menuPad.timestamp++;});
   await page.waitForTimeout(100);
  };
  await page.evaluate(()=>window.__menuReview.show('pause'));
  for(let i=0;i<5;i++)await pad(13,i%2===0);
  assert.equal(await page.locator('.game-menu-button.selected').textContent(),'SHOW DEBUG MENUS','D-pad and stick must reach Debug');
  await pad(0);
  assert.equal(await page.locator('.game-debug-toggle').getAttribute('aria-pressed'),'true');
  assert.equal(await page.evaluate(()=>window.__game.gameFlow.currentScreen),'pause');
  assert.equal(await page.locator('.game-shell').getAttribute('aria-modal'),'false');
  await page.evaluate(()=>Object.assign(window.menuPad.buttons[0],{pressed:true,value:1}));
  await page.waitForTimeout(600);
  assert.equal(await page.locator('.game-debug-toggle').getAttribute('aria-pressed'),'false','held Confirm must toggle once');
  await page.evaluate(()=>Object.assign(window.menuPad.buttons[0],{pressed:false,value:0}));
  await page.waitForTimeout(100);
  // M and a pointer update the same existing row without losing selection.
  await page.keyboard.press('KeyM');
  assert.equal(await page.locator('.game-debug-toggle').textContent(),'HIDE DEBUG MENUS');
  await page.locator('.secondary-text-tuner summary').focus();
  await page.keyboard.press('KeyM');
  await page.waitForFunction(()=>document.activeElement===document.querySelector('.game-debug-toggle'));
  assert.equal(await page.locator('.secondary-text-tuner').isVisible(),false);
  await page.locator('.game-debug-toggle').click();
  await page.locator('.game-debug-toggle').click();
  assert.equal(await page.locator('.game-debug-toggle').getAttribute('aria-pressed'),'false');
  assert.equal(await page.evaluate(()=>localStorage.getItem('solProtoDebugChrome')),'hidden');
  await page.screenshot({path:`${output}/${lite?'lite':'full'}-pause.png`});
  await page.evaluate(()=>window.__menuReview.show('level-select'));
  const rows=await page.locator('.game-level-row').count();
  for(let i=1;i<rows;i++)await pad(13);
  assert.equal(await page.locator('.game-level-row.selected').getAttribute('data-level-key'),'jungle-cup');
  assert.equal(await page.locator('.game-level-row.selected').evaluate(e=>{const r=e.getBoundingClientRect(),s=e.parentElement.getBoundingClientRect();return r.top>=s.top-1&&r.bottom<=s.bottom+1;}),true);
  assert.ok(await page.locator('.game-level-list').evaluate(e=>e.scrollTop)>0);
  await page.screenshot({path:`${output}/${lite?'lite':'full'}-last-level.png`});
  await pad(0);
  assert.equal(await page.evaluate(()=>window.__game.gameFlow.currentScreen),'confirm-level-select');
  await pad(1);
  assert.equal(await page.evaluate(()=>window.__game.gameFlow.currentScreen),'level-select');
  assert.equal(await page.locator('.game-level-row.selected').getAttribute('data-level-key'),'jungle-cup');
  await pad(15);await page.waitForTimeout(260);
  assert.equal(await page.locator('.game-level-select-layout').getAttribute('data-island'),'island-2');
  await pad(14);await page.waitForTimeout(260);
  assert.equal(await page.locator('.game-level-row.selected').getAttribute('data-level-key'),'jungle-cup');
  // Mouse wheel scrolls only the list; double-click follows the normal confirmation.
  await page.locator('.game-level-list').hover();await page.mouse.wheel(0,-1200);await page.waitForTimeout(250);
  assert.equal(await page.locator('.game-level-list').evaluate(e=>e.scrollTop),0);
  const first=page.locator('.game-level-row').first();await first.dblclick();
  assert.equal(await page.evaluate(()=>window.__game.gameFlow.currentScreen),'confirm-level-select');
  await page.getByRole('button',{name:'CANCEL',exact:true}).click();
  assert.equal(await page.evaluate(()=>window.__game.gameFlow.currentScreen),'level-select');
  assert.deepEqual(await page.locator('.game-shell-panel').evaluate(e=>[e.scrollTop,e.scrollLeft]),[0,0]);
  // The 2x2 save grid keeps directional controller navigation and cancel memory.
  await page.evaluate(()=>window.__menuReview.show('new-slots'));
  await pad(15);assert.equal(await page.locator('.game-save-slot.selected').getAttribute('data-save-slot'),'2');
  await pad(13);assert.equal(await page.locator('.game-save-slot.selected').getAttribute('data-save-slot'),'4');
  await pad(14);assert.equal(await page.locator('.game-save-slot.selected').getAttribute('data-save-slot'),'3');
  await pad(0);assert.equal(await page.evaluate(()=>window.__game.gameFlow.currentScreen),'confirm-new');
  await pad(1);assert.equal(await page.locator('.game-save-slot.selected').getAttribute('data-save-slot'),'3');
  // Persistence survives a real document reload, then can be disabled again.
  await page.evaluate(()=>window.__menuReview.show('pause'));
  await page.locator('.game-debug-toggle').click();await page.reload();
  await page.waitForFunction(()=>window.__menuReview&&!window.__game.gameFlow.transitionActive,null,{timeout:120000});
  await page.evaluate(()=>window.__menuReview.show('pause'));
  assert.equal(await page.locator('.game-debug-toggle').getAttribute('aria-pressed'),'true');
  await page.locator('.game-debug-toggle').click();
  assert.equal(await page.evaluate(()=>window.__game.gameFlow.developerChromeVisible),false);
  report.checks.push({lite,controller:true,mouse:true,keyboard:true,scroll:true,saveGrid:true,debugPersistence:true});
  await context.close();
 }
 assert.deepEqual(report.errors,[]);console.log('PASS desktop controller/stick, mouse wheel/confirmation, keyboard, save grid, debug toggle and persistence in lite/full rendering.');
}finally{await writeFile(output+'/report.json',JSON.stringify(report,null,2));await browser.close();}
