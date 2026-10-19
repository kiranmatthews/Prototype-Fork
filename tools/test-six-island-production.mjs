import assert from 'node:assert/strict';
const {chromium}=await import(process.env.PLAYWRIGHT_MODULE||'playwright');
import {mkdir,writeFile} from 'node:fs/promises';
const base=process.argv[2]||'http://127.0.0.1:4173/';
const output=process.env.ISLAND_REVIEW_DIR||'/tmp/six-island-review';await mkdir(output,{recursive:true});
const browser=await chromium.launch({headless:true,channel:process.env.BROWSER_CHANNEL||'chrome'}),errors=[],checks=[];
const names=['MOTU MOTU','THE UGA ISLES','SPOOKY SHORES','MAYNARD QUAY','QUAGMIRE CAVERNS','SECRET ISLAND'];
try{
 for(const lite of [true,false]){
  const page=await browser.newPage({viewport:{width:1280,height:720}});
  page.on('pageerror',e=>errors.push(e.message));page.on('console',m=>{if(m.type()==='error')errors.push(m.text())});
  await page.goto(base+'?playtest&level=warproom'+(lite?'&lite':''));
  await page.waitForFunction(()=>window.__game&&!window.__game.gameFlow.blocksGameplay,null,{timeout:120000});
  await page.waitForTimeout(500);
  await page.screenshot({path:`${output}/production-map-${lite?'lite':'full'}.png`});
  const islands=await page.evaluate(()=>{const names=[];window.__game.getLevel().root.traverse(o=>{if(o.name.startsWith('world map campaign island '))names.push(o.name)});return names;});assert.equal(islands.length,6);
  await page.keyboard.press('Tab');await page.waitForTimeout(300);
  assert.deepEqual(await page.locator('.game-level-row').evaluateAll(rows=>rows.map(row=>row.dataset.levelKey)),['treehouse-trail']);
  assert.equal(await page.getByRole('button',{name:'Next island',exact:true}).isEnabled(),false);
  assert.equal(await page.locator('.game-panel-title').textContent(),'MOTU MOTU');
  assert.doesNotMatch(await page.locator('.game-shell-panel').textContent(),/BANANA BAY|THE UGA ISLES|SPOOKY SHORES|MAYNARD QUAY|QUAGMIRE CAVERNS|SECRET ISLAND/);
  await page.waitForTimeout(500);await page.screenshot({path:output+'/fresh-level-select-'+(lite?'lite':'full')+'.png'});
  await page.evaluate(()=>{const g=window.__game;g.campaign.commitClear('treehouse-trail',{crystal:false,boxGem:false,comboGem:false});g.gameFlow.showMapSection('level-select');});
  assert.deepEqual(await page.locator('.game-level-row').evaluateAll(rows=>rows.map(row=>row.dataset.levelKey)),['treehouse-trail','beachside-run']);
  checks.push({render:lite?'lite':'full',freshVisible:1,afterFirstClear:2,lockedIslandPaging:false});
  // Future progress stays inside this isolated browser's ephemeral save.
  await page.evaluate(()=>{const g=window.__game;for(const progress of Object.values(g.campaign.active.levels))Object.assign(progress,{cleared:true,boxGem:true,timeMedal:'gold',cup:true,raceWon:true});g.gameFlow.showMapSection('level-select');});
  const keys=[];
  for(let i=0;i<6;i++){
   assert.equal(await page.locator('.game-panel-title').textContent(),names[i]);
   keys.push(...await page.locator('.game-level-row').evaluateAll(r=>r.map(e=>e.dataset.levelKey)));
   if(!lite){await page.waitForTimeout(900);await page.screenshot({path:`${output}/production-menu-${i+1}.png`});}
   if(i===5){assert.equal(await page.locator('[data-level-key="secret-8"]').count(),0);await page.locator('[data-level-key="secret-7"]').click();await page.keyboard.press('Enter');await page.waitForTimeout(400);assert.equal(await page.evaluate(()=>window.__game.getCurrentLevel().id),'warproom');}
   await page.getByRole('button',{name:'Next island',exact:true}).click();await page.waitForTimeout(240);
  }
  assert.equal(keys.length,37);assert.equal(new Set(keys).size,37);
  checks.push({render:lite?'lite':'full',islands:6,revealedDestinations:37,placeholderLaunches:0});
  if(lite){
   await page.evaluate(()=>{for(const key of ['test-course','crab-chief'])window.__game.campaign.active.levels[key].cleared=true;});
   await page.getByRole('button',{name:'Next island',exact:true}).click();
   await page.locator('[data-level-key="test-course"]').dblclick();
   await page.waitForFunction(()=>window.__game.getCurrentLevel().id==='test'&&!window.__game.gameFlow.blocksGameplay,null,{timeout:120000});
   await page.keyboard.press('p');await page.waitForTimeout(400);
   assert.match(await page.locator('.game-panel-subtitle').textContent(),/Uga Ambush/);
   await page.getByRole('button',{name:'LEVEL SELECT',exact:true}).click();
   await page.locator('[data-level-key="crab-chief"]').dblclick();
   await page.getByRole('button',{name:'SWITCH LEVEL',exact:true}).click();
   await page.waitForFunction(()=>window.__game.getCurrentLevel().id==='crab-chief'&&!window.__game.gameFlow.blocksGameplay,null,{timeout:120000});
   assert.ok(await page.evaluate(()=>window.__game.getBossDiagnostics()));
   assert.equal(await page.locator('.boss-name').textContent(),'HIGH CHIEF UGA HA KU');
   await page.keyboard.press('p');await page.waitForTimeout(400);
   assert.match(await page.locator('.game-panel-subtitle').textContent(),/High Chief Uga Ha ku/);
   checks.push({renamedCourse:'test',renamedBoss:'crab-chief',bossRuntime:true});
  }
  if(!lite){
   await page.evaluate(()=>{window.__game.campaign.active.levels['crab-chief'].cleared=true;});
   await page.getByRole('button',{name:'Next island',exact:true}).click();
   await page.locator('[data-level-key="crab-chief"]').dblclick();
   await page.waitForFunction(()=>window.__game.getCurrentLevel().id==='crab-chief'&&!window.__game.gameFlow.blocksGameplay,null,{timeout:120000});
   assert.equal(await page.locator('.boss-name').textContent(),'HIGH CHIEF UGA HA KU');
   await page.waitForTimeout(500);await page.screenshot({path:output+'/production-chief-full.png'});
   checks.push({render:'full',bossName:'High Chief Uga Ha ku',healthHUD:true});
  }
  await page.close();
 }
 assert.deepEqual(errors,[]);console.log(JSON.stringify({checks,errors}));
}finally{await writeFile(output+'/production-report.json',JSON.stringify({checks,errors},null,2));await browser.close();}
