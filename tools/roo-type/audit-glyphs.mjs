import fs from 'node:fs/promises';
import assert from 'node:assert/strict';
import {pathToFileURL} from 'node:url';
const {chromium}=await import(process.env.PLAYWRIGHT_MODULE?pathToFileURL(process.env.PLAYWRIGHT_MODULE).href:'playwright');
const base=process.env.ROO_LAB_URL||'http://127.0.0.1:5178/';
const out=process.env.ROO_REVIEW_DIR||'/private/tmp/roo-type-v4-review';await fs.mkdir(out,{recursive:true});
const browser=await chromium.launch({headless:true,channel:'chrome'}),errors=[];
try{
 const context=await browser.newContext({viewport:{width:1800,height:1250},deviceScaleFactor:1});
 await context.addInitScript(()=>localStorage.setItem('solProtoRooAppearanceV3',JSON.stringify({tracking:-.065,shimmer:false,lightStrength:.7})));
 const page=await context.newPage();page.on('pageerror',e=>errors.push(e.message));page.on('console',m=>{if(m.type()==='error')errors.push(m.text());});
 await page.goto(base+'roo-type-lab.html');await page.waitForFunction(()=>window.rooTypeLab?.ready);
 assert.equal((await page.evaluate(()=>window.rooTypeLab.metrics())).version,4);
 await page.screenshot({path:out+'/lab-v3.png',fullPage:true});
 await page.selectOption('#view','all');
 const coverage=[];
 for(const palette of ['bonus','counter']){
  await page.selectOption('#palette',palette);
  for(let p=0;p<9;p++){
   await page.locator('.stage').screenshot({path:out+`/glyphs-${palette}-${p+1}.png`});
   coverage.push({palette,page:p+1});if(p<8)await page.locator('#next').click();
  }
  for(let p=0;p<8;p++)await page.locator('#prev').click();
 }
 await page.selectOption('#view','glyph');await page.selectOption('#glyph','5');
 for(const position of [-1,0,1]){
  await page.locator('#light').fill(String(position));await page.locator('#light').dispatchEvent('input');
  await page.locator('.stage').screenshot({path:out+`/five-light-${position}.png`});
 }
 await page.close();
 for(const lite of [true,false]){
  const game=await context.newPage();await game.setViewportSize({width:1280,height:720});game.on('pageerror',e=>errors.push(e.message));
  await game.goto(base+(lite?'?lite':''));await game.waitForFunction(()=>window.__game?.gameFlow,null,{timeout:90000});
  if(lite)await game.evaluate(()=>window.__game.gameFlow.showLaunch());
  await game.waitForFunction(()=>document.querySelectorAll('.game-shell [data-roo-menu][data-ready]').length>=3);
  await game.waitForTimeout(600);await game.screenshot({path:out+`/audit-launch-${lite?'lite':'full'}.png`});
  console.log(JSON.stringify({mode:lite?'lite':'full',labels:await game.locator('.game-shell [data-roo-menu]').count(),text:await game.locator('.game-shell-panel').textContent()}));
  await game.close();
 }
 assert.deepEqual(errors,[]);await fs.writeFile(out+'/audit-captures.json',JSON.stringify({errors,coverage},null,2));console.log('Captured all 51 glyphs in both palettes, three light positions, and both menu paths.');
}finally{await browser.close();}
