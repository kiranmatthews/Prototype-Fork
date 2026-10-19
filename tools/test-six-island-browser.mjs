import assert from 'node:assert/strict';
const {chromium}=await import(process.env.PLAYWRIGHT_MODULE||'playwright');
import {mkdir,writeFile} from 'node:fs/promises';
const base=process.argv[2]||'http://127.0.0.1:5173/';
const output=process.env.ISLAND_REVIEW_DIR||'/tmp/six-island-review';await mkdir(output,{recursive:true});
const browser=await chromium.launch({headless:true,channel:process.env.BROWSER_CHANNEL||'chrome'}),errors=[],checks=[];
const active=page=>page.waitForFunction(()=>window.__game&&!window.__game.gameFlow.blocksGameplay,null,{timeout:120000});
try{
 const page=await browser.newPage({viewport:{width:1280,height:720}});
 page.on('pageerror',e=>errors.push(e.message));page.on('console',m=>{if(m.type()==='error')errors.push(m.text())});
 await page.goto(base+'?playtest&level=warproom&lite');await active(page);
 const islands=await page.evaluate(async()=>{const c=await import('/src/campaign.ts');return c.CAMPAIGN_ISLANDS;});
 // Verify actual supported hub geometry and reciprocal traversal at every edge.
 checks.push(await page.evaluate(async()=>{
  const g=window.__game,c=await import('/src/campaign.ts'),THREE=await import('/node_modules/three/build/three.module.js'),level=g.getLevel();
  const land=[];level.root.traverse(o=>{if(o.name.startsWith('world map campaign island '))land.push(o.name)});
  const failures=[];
  for(const d of c.CAMPAIGN_LEVELS){const pose=level.campaignMapPose(d.progressKey);const ray=new THREE.Raycaster(pose.position.clone().add(new THREE.Vector3(0,1,0)),new THREE.Vector3(0,-1,0),0,2);if(!ray.intersectObjects(level.groundMeshes,false).length)failures.push(d.progressKey);}
  let samples=0;
  for(const e of c.CAMPAIGN_MAP_EDGES)for(let i=0;i<=10;i++){
   const forward=level.campaignMapTravel(e.from,e.to,i/10),reverse=level.campaignMapTravel(e.to,e.from,1-i/10);
   if(!forward||!reverse||forward.position.distanceTo(reverse.position)>1e-6||!forward.position.toArray().every(Number.isFinite))failures.push(e.from+'>'+e.to);samples++;
  }
  return {kind:'map-geometry',islands:land.length,hubs:c.CAMPAIGN_LEVELS.length,samples,failures};
 }));
 assert.equal(checks.at(-1).islands,6);assert.deepEqual(checks.at(-1).failures,[]);
 await page.evaluate(()=>window.__game.gameFlow.showMapSection('level-select'));
 assert.deepEqual(await page.locator('.game-level-row').evaluateAll(rows=>rows.map(row=>row.dataset.levelKey)),['treehouse-trail']);
 assert.equal(await page.getByRole('button',{name:'Next island',exact:true}).isEnabled(),false);
 await page.evaluate(()=>{const g=window.__game;for(const progress of Object.values(g.campaign.active.levels))Object.assign(progress,{cleared:true,boxGem:true,timeMedal:'gold',cup:true,raceWon:true});g.gameFlow.showMapSection('level-select');});
 for(const [index,island] of islands.entries()){
  await page.waitForTimeout(220);
  assert.equal(await page.locator('.game-level-select-layout').getAttribute('data-island'),island.id);
  assert.deepEqual(await page.locator('.game-level-row').evaluateAll(rows=>rows.map(r=>r.dataset.levelKey)),island.levelKeys.filter(key=>key!=='secret-8'));
  const key=index===1?'tribal-run':index===3?'maynard-course-4':index===4?'quagmire-boss':index===5?'secret-7':island.levelKeys[1];
  await page.locator(`[data-level-key="${key}"]`).click();await page.waitForTimeout(150);
  if(await page.evaluate(()=>window.__game.gameFlow.levelSelectPlay.disabled)){
   const old=await page.evaluate(()=>window.__game.getCurrentLevel().id);await page.keyboard.press('Enter');await page.waitForTimeout(80);assert.equal(await page.evaluate(()=>window.__game.getCurrentLevel().id),old);
  }
  await page.screenshot({path:`${output}/menu-${island.id}.png`});
  await page.getByRole('button',{name:'Next island',exact:true}).click();
 }
 checks.push({kind:'desktop-atlas',pages:6,lockedLaunches:0});
 // Main progression travels through the real controller. Completion data stays ephemeral.
 await page.evaluate(async()=>{const g=window.__game,c=await import('/src/campaign.ts');for(const d of c.CAMPAIGN_LEVELS)Object.assign(g.campaign.active.levels[d.progressKey],{cleared:true,boxGem:true,timeMedal:'gold',cup:true,raceWon:true});g.gameFlow.hide();g.getLevel().setCampaignMapProgress('treehouse-trail',id=>g.campaign.levelProgress(id),key=>g.campaign.levelUnlocked(key));});
 const keys=islands.flatMap(i=>i.levelKeys);
 for(const key of keys.slice(1)){
  await page.keyboard.press('ArrowRight');
  await page.waitForFunction(key=>document.querySelector('.world-map-ui')?.dataset.selectedKey===key&&!document.querySelector('.world-map-ui')?.classList.contains('is-moving'),key,{timeout:15000});
  if(islands.some(i=>i.levelKeys[2]===key)||key==='secret-8'){
   await page.waitForTimeout(300);await page.screenshot({path:`${output}/map-${key}.png`});console.log('map reached',key);
  }
 }
 checks.push({kind:'keyboard-map-traversal',destinations:keys.length});
 // Planned nodes permit map travel but not confirm-entry.
 await page.keyboard.press('Enter');await page.waitForTimeout(300);assert.equal(await page.evaluate(()=>window.__game.getCurrentLevel().id),'warproom');
 await page.close();
 // Bounded touch pages and real taps at phone, landscape and 4:3 dimensions.
 for(const [width,height,touch,lite]of [[390,844,true,true],[844,390,true,true],[1024,768,false,true],[1280,720,false,false]]){
  const context=await browser.newContext({viewport:{width,height},hasTouch:touch,isMobile:touch,deviceScaleFactor:1}),p=await context.newPage();
  p.on('pageerror',e=>errors.push(e.message));p.on('console',m=>{if(m.type()==='error')errors.push(m.text())});
  await p.goto(base+'?playtest&level=warproom'+(lite?'&lite':''));await active(p);
  await p.evaluate(()=>{const g=window.__game;for(const progress of Object.values(g.campaign.active.levels))Object.assign(progress,{cleared:true,boxGem:true,timeMedal:'gold',cup:true,raceWon:true});g.gameFlow.showMapSection('level-select');});
  for(let i=0;i<6;i++){
   await p.waitForTimeout(180);
   const state=await p.evaluate(()=>{
    const f=window.__game.gameFlow,rect=e=>{const r=e.getBoundingClientRect();return {x:r.x,y:r.y,right:r.right,bottom:r.bottom,width:r.width,height:r.height}};
    const fixed=[...document.querySelectorAll('.game-level-header,.game-level-preview-frame,.game-level-detail,.game-level-list')].map(rect);
    return {island:f.levelSelectIsland,fixed,scroll:[document.querySelector('.game-shell-panel').scrollTop,document.documentElement.scrollWidth],composited:!!document.querySelector('.game-shell.precrt-composited'),rows:[...document.querySelectorAll('.game-level-row')].map(rect)};
   });
   assert.ok(state.composited);assert.equal(state.scroll[0],0);assert.ok(state.scroll[1]<=width+1);
   for(const box of state.fixed)assert.ok(box.x>=-1&&box.y>=-1&&box.right<=width+1&&box.bottom<=height+1,`${width}x${height} fixed segment outside: ${JSON.stringify(box)}`);
   for(const box of state.rows)assert.ok(box.height>=(touch?48:44)-1);
   const key=islands[i].levelKeys.filter(key=>key!=='secret-8').at(-1);await p.locator(`[data-level-key="${key}"]`).evaluate(e=>e.scrollIntoView({block:'nearest'}));
   await p.evaluate(key=>window.__game.gameFlow.updateLevelSelectChoice(key,true),key);
   await p.waitForTimeout(180);await p.screenshot({path:`${output}/${lite?'lite':'full'}-${width}x${height}-${i+1}.png`});
   if(touch)await p.getByRole('button',{name:'Next island',exact:true}).tap();else await p.getByRole('button',{name:'Next island',exact:true}).click();
  }
  checks.push({kind:'responsive',width,height,touch,lite,pages:6});console.log('responsive passed',width,height,lite?'lite':'full');
  // On a fresh save, only the opening course can start. Tap through the real host callback.
  if(touch&&width===390){await p.evaluate(()=>{const g=window.__game;g.campaign.startEphemeral();g.gameFlow.showMapSection('level-select');});await p.locator('[data-level-key="treehouse-trail"]').tap();await p.waitForFunction(()=>window.__game.getCurrentLevel().id==='treehouse-trail'&&!window.__game.gameFlow.blocksGameplay,null,{timeout:120000});checks.push({kind:'real-touch-launch',id:'treehouse-trail'});}
  await context.close();
 }
 assert.deepEqual(errors,[]);
 console.log(JSON.stringify({checks,errors}));
} finally {await writeFile(output+'/report.json',JSON.stringify({checks,errors},null,2));await browser.close();}
