import assert from 'node:assert/strict';
import {mkdir,readFile,writeFile} from 'node:fs/promises';
import {createHash} from 'node:crypto';
const {chromium}=await import(process.env.PLAYWRIGHT_MODULE||'playwright');
const base=process.env.BLOCKWORKS_DEPLOY_URL||'https://kiranmatthews.github.io/Prototype-Fork/';
const revision=process.env.BLOCKWORKS_DEPLOY_SHA||'',out=process.env.BLOCKWORKS_BONUS_DEPLOY_OUTPUT||'docs/blockworks-art/bonus/deployment';
await mkdir(out,{recursive:true});
const captures=JSON.parse(await readFile('docs/blockworks-art/bonus/after/manifest.json','utf8'));
const hash=bytes=>createHash('sha256').update(bytes).digest('hex');
const browser=await chromium.launch({channel:'chrome',headless:true}),page=await browser.newPage({viewport:{width:1600,height:900}}),errors=[];
page.on('pageerror',e=>errors.push(e.message));page.on('console',m=>{if(m.type()==='error')errors.push(m.text());});
try{
 await page.goto(base+'?playtest&level=codex-lab&release='+encodeURIComponent(revision),{waitUntil:'domcontentloaded'});
 await page.waitForFunction(()=>window.__game&&!window.__game.gameFlow.blocksGameplay,null,{timeout:180000});
 const main=await page.evaluate(()=>{const g=window.__game,l=g.getLevel();window.hauntedParent=l;return{name:l.name,id:g.getCurrentLevel().id,bonusName:g.findLevel('bonus-codex-switchback').name,stamp:document.querySelector('.hud-build')?.textContent,atmosphere:l.atmosphere,lives:g.player.lives,fruit:g.player.fruit};});
 assert.equal(main.name,'Haunted Hassle');assert.equal(main.bonusName,'Bonus: Haunted Hassle');assert.match(main.stamp,/Codex\/sol fork/);
 await page.evaluate(()=>window.__game.enterBonusRound());
 await page.waitForFunction(()=>window.__game.getCurrentLevel().id==='bonus:codex-lab'&&!window.__game.gameFlow.blocksGameplay,null,{timeout:180000});
 const bonus=await page.evaluate(()=>{const g=window.__game,l=g.getLevel();return{name:l.name,sky:l.skyPreset,atmosphere:l.atmosphere,countedCrates:l.totalCrates,position:g.player.pos.toArray(),assets:l.blockworksArtDiagnostics,data:l.captureData()};});
 // A linked bonus session retains the parent's display name; its standalone
 // library entry and authored data carry the Bonus prefix.
 assert.equal(bonus.name,'Haunted Hassle');assert.equal(bonus.data.name,'Bonus: Haunted Hassle');assert.equal(bonus.sky,'haunted');assert.equal(bonus.countedCrates,8);assert.deepEqual(bonus.atmosphere,main.atmosphere);
 const sourceSha256=hash(JSON.stringify(bonus.data));assert.equal(sourceSha256,captures.sourceSha256,'deployed bonus geometry/art differs from reviewed source');
 const surfaceModels=Object.values(bonus.assets.surfaces.models),sceneryModels=Object.values(bonus.assets.scenery.models);
 assert.ok(surfaceModels.every(s=>s==='ready'));assert.ok(sceneryModels.every(s=>s.status==='ready'));assert.ok(Object.values(bonus.assets.mattes.textures).every(s=>s==='ready'));
 assert.equal(surfaceModels.length+sceneryModels.length,18);
 await page.keyboard.down('ArrowRight');await page.waitForTimeout(600);await page.keyboard.up('ArrowRight');await page.waitForTimeout(180);
 const movement=await page.evaluate(()=>({position:window.__game.player.pos.toArray(),grounded:window.__game.player.grounded,deaths:window.__game.player.totalDeaths}));
 assert.ok(movement.position[0]>bonus.position[0]+.3);assert.equal(movement.grounded,true);assert.equal(movement.deaths,0);
 await page.screenshot({path:out+'/haunted-hassle-bonus.png'});
 await page.evaluate(()=>window.__game.returnFromBonus(false));
 await page.waitForFunction(()=>window.__game.getCurrentLevel().id==='codex-lab'&&!window.__game.gameFlow.blocksGameplay,null,{timeout:180000});
 await page.waitForTimeout(400);
 const returned=await page.evaluate(()=>{const g=window.__game;return{name:g.getLevel().name,sameParent:g.getLevel()===window.hauntedParent,grounded:g.player.grounded,lives:g.player.lives,fruit:g.player.fruit};});
 assert.ok(returned.sameParent&&returned.grounded);assert.equal(returned.name,'Haunted Hassle');assert.equal(returned.lives,main.lives);assert.equal(returned.fruit,main.fruit);
 const response=await page.request.get(base+'level-previews/codex-switchback.jpg?release='+encodeURIComponent(revision));assert.ok(response.ok());
 const previewSha256=hash(await response.body());assert.equal(previewSha256,hash(await readFile('public/level-previews/codex-switchback.jpg')));
 delete bonus.data;const report={verifiedAt:new Date().toISOString(),revision,url:base+'?playtest&level=codex-lab',main,bonus,sourceSha256,movement,returned,previewSha256,errors};
 await writeFile(out+'/verification.json',JSON.stringify(report,null,2)+'\n');assert.deepEqual(errors,[]);console.log(JSON.stringify(report));
}finally{await browser.close();}
