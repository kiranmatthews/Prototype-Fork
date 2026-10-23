import assert from 'node:assert/strict';
import {mkdir,writeFile} from 'node:fs/promises';
const {chromium}=await import(process.env.PLAYWRIGHT_MODULE||'playwright');
const base=process.argv[2]||'http://127.0.0.1:5419/';
const output=process.env.DEBUG_TABS_OUTPUT||'/private/tmp/debug-tabs-browser';
await mkdir(output,{recursive:true});
const browser=await chromium.launch({channel:'chrome',headless:true});
const report={runs:[],errors:[]},ids=['tuner','text','crt','render','board','spin','look'];
const cases=process.env.DEBUG_TABS_CASES?.split(',');
let currentPage,currentName;
try {
 for(const [name,lite,touch,viewport] of [
  ['desktop-lite',true,false,{width:1440,height:900}],
  ['desktop-full',false,false,{width:1280,height:720}],
  ['touch-full',false,true,{width:390,height:844}],
 ]) {
  if(cases&&!cases.includes(name))continue;
  const context=await browser.newContext({viewport,hasTouch:touch,serviceWorkers:'block'}),page=await context.newPage();
  currentPage=page;currentName=name;
  await context.addInitScript(()=>{if(!localStorage.getItem('solProtoDebugChrome'))localStorage.setItem('solProtoDebugChrome','visible');});
  page.on('pageerror',e=>report.errors.push({name,error:e.message}));
  page.on('console',m=>{if(m.type()==='error')report.errors.push({name,error:m.text()});});
  const url=base+'?playtest&level=bonus-rolling-bones'+(lite?'&lite':'');
  const ready=()=>page.waitForFunction(()=>window.__game&&!window.__game.gameFlow.blocksGameplay,null,{timeout:180000});
  await page.goto(url,{waitUntil:'domcontentloaded',timeout:180000});await ready();
  console.log(name+' ready');
  const tab=id=>page.locator(`[data-debug-tab="${id}"]`),pane=id=>page.locator(`#debug-panel-${id}`);
  const active=async id=>{
   await page.waitForFunction(id=>document.querySelector(`[data-debug-tab="${id}"]`)?.getAttribute('aria-expanded')==='true',id);
   assert.equal(await page.locator('.side-wrap.right .side-tab[aria-expanded=true]').count(),1);
   assert.equal(await pane(id).evaluate(el=>el.inert),false);
  };
  const click=async id=>{
   await tab(id).scrollIntoViewIfNeeded();await tab(id).click();await active(id);
   await page.locator('.side-wrap.right').evaluate(async el=>{await Promise.all(el.getAnimations().map(animation=>animation.finished));});
  };
  const dimensions=async id=>pane(id).evaluate(el=>{
   const box=el.getBoundingClientRect(),root=el.firstElementChild?.shadowRoot,
    panel=root?.querySelector('.panel')??el.querySelector('.secondary-text-tuner-body,.hud-tuning,.hud-stats');
   return {left:box.left,right:box.right,top:box.top,bottom:box.bottom,viewport:[innerWidth,innerHeight],width:panel?.clientWidth,scrollWidth:panel?.scrollWidth};
  });
  const within=box=>{assert.ok(box.left>=-1&&box.right<=box.viewport[0]+1&&box.top>=-1&&box.bottom<=box.viewport[1]+1,JSON.stringify(box));assert.ok(box.scrollWidth<=box.width+1,'horizontal overflow '+JSON.stringify(box));};
  assert.deepEqual(await page.locator('.side-wrap.right .side-tab').evaluateAll(t=>t.map(x=>x.dataset.debugTab)),ids);
  assert.equal(await page.locator('.side-wrap.left .side-tab').textContent(),'MENU');
  assert.equal(await page.locator('.secondary-text-tuner > summary').isVisible(),false);
  assert.equal(await page.locator('[data-debug-docked] .launcher:visible').count(),0);
  await tab('menu').click();
  await page.locator('.side-wrap.left').evaluate(async el=>{await Promise.all(el.getAnimations().map(animation=>animation.finished));});
  within(await dimensions('menu'));assert.equal(await pane('menu').evaluate(el=>el.inert),false);
  await tab('menu').click();assert.equal(await pane('menu').evaluate(el=>el.inert),true);
  const run={name,panels:[]};
  for(const id of ids){await click(id);const box=await dimensions(id);within(box);run.panels.push({id,...box});}
  if(touch){
   const row=await pane('look').locator('.control').first().evaluate(el=>{
    const [label,range,number]=[...el.children].map(child=>child.getBoundingClientRect());
    return {labelBottom:label.bottom,rangeTop:range.top,rangeY:range.top+range.height/2,numberY:number.top+number.height/2,rangeWidth:range.width};
   });
   assert.ok(row.labelBottom<=row.rangeTop&&Math.abs(row.rangeY-row.numberY)<1&&row.rangeWidth>80,JSON.stringify(row));
   run.compactSliderRow=row;
  }
  await page.screenshot({path:`${output}/${name}-look.png`});
  for(const id of ids.slice(1)){
   await click(id);await pane(id).getByRole('button',{name:/^Close /}).click();
   await page.waitForFunction(()=>document.querySelector('.side-wrap.right').classList.contains('collapsed'));
   assert.equal(await pane(id).evaluate(el=>el.inert),true);
   assert.equal(await page.evaluate(()=>!!document.activeElement?.closest('.side-wrap')),false,'pointer close must release debug keyboard focus');
  }
  await click('tuner');
  const steering=pane('tuner').locator('[data-tuning-key="boardAbandonSteering"] input[type=number]');
  await steering.fill('27');await steering.press('Tab');await click('text');await click('tuner');assert.equal(await steering.inputValue(),'27');
  await tab('tuner').click();assert.equal(await tab('tuner').getAttribute('aria-expanded'),'false');
  assert.equal(await tab('tuner').evaluate(el=>el===document.activeElement),false);
  await tab('tuner').focus();await page.keyboard.press('ArrowDown');await page.keyboard.press('Enter');await active('text');
  await page.keyboard.press('Escape');assert.equal(await tab('text').getAttribute('aria-expanded'),'false');
  assert.equal(await tab('text').evaluate(el=>el===document.activeElement),true,'keyboard close must return to its tab');
  await page.keyboard.press('F10');await active('crt');await page.keyboard.press('F10');
  await page.waitForFunction(()=>document.querySelector('[data-debug-tab="crt"]').getAttribute('aria-expanded')==='false');
  await click('look');await pane('look').getByRole('button',{name:'Close visual treatment panel'}).focus();
  await page.keyboard.press('KeyM');await page.waitForFunction(()=>document.body.classList.contains('game-debug-hidden')&&!document.body.classList.contains('tool-panel-open'));
  assert.equal(await tab('look').isVisible(),false);
  await page.keyboard.press('KeyM');await active('look');assert.equal(await pane('look').isVisible(),true);
  await click('text');const size=pane('text').locator('[data-setting="size"]');
  const sizeValue=Number(await size.inputValue())+1;await size.fill(String(sizeValue));
  await page.reload({waitUntil:'domcontentloaded'});await ready();await active('text');assert.equal(Number(await size.inputValue()),sizeValue);
  if(touch){
   await page.setViewportSize({width:844,height:390});await page.waitForTimeout(300);
   for(const id of ['look','crt','text']){await click(id);within(await dimensions(id));}
   await page.screenshot({path:`${output}/${name}-landscape.png`});
  }else{
   await page.setViewportSize({width:1024,height:768});await click('crt');within(await dimensions('crt'));
   await page.evaluate(()=>window.__game.gameFlow.showPause({levelName:'Moonbone Vault',inWarpRoom:false}));
   await pane('crt').getByRole('button',{name:'Close CRT tuning panel'}).focus();await page.keyboard.press('KeyM');
   await page.waitForFunction(()=>document.body.classList.contains('game-debug-hidden')&&document.activeElement===document.querySelector('.game-menu-button.selected'));
   await page.keyboard.press('KeyM');await active('crt');
   await page.screenshot({path:`${output}/${name}-pause.png`});
  }
  report.runs.push(run);console.log('PASS '+name+' tabs, switching, close, shortcuts, settings, persistence and bounds');
  await writeFile(`${output}/browser.json`,JSON.stringify(report,null,2));await context.close();currentPage=null;
 }
 assert.deepEqual(report.errors,[],'browser console');
} catch(error){
 if(currentPage)await currentPage.screenshot({path:`${output}/${currentName}-failure.png`}).catch(()=>{});
 throw error;
} finally {await writeFile(`${output}/browser.json`,JSON.stringify(report,null,2));await browser.close();}
