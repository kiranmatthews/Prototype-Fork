// Major-beat full-render review uses the actual close gameplay camera.
import assert from 'node:assert/strict';
import {mkdir,writeFile} from 'node:fs/promises';
const {chromium}=await import(process.env.PLAYWRIGHT_MODULE||'playwright');
const base=(process.argv[2]||'http://127.0.0.1:5231').replace(/\/$/,'');
const out=process.env.TREEHOUSE_REVIEW_OUTPUT||'/private/tmp/treehouse-trials-review';
const lite=process.argv.includes('--lite');
const visual=process.argv.includes('--visual');
await mkdir(out,{recursive:true});
const browser=await chromium.launch({channel:'chrome',headless:true});
const errors=[],report={base,errors,scenes:[]};
try {
  const page=await browser.newPage({viewport:process.argv.includes('--portrait')?{width:390,height:844}:{width:1280,height:720}});
  page.on('pageerror',e=>errors.push(e.message));
  page.on('console',m=>{if(m.type()==='error')errors.push(m.text());});
  await page.goto(`${base}/?playtest&level=treehouse-trail${lite?'&lite':''}`);
  await page.waitForFunction(()=>window.__game&&!window.__game.gameFlow.blocksGameplay,null,{timeout:180000});
  await page.evaluate(async()=>window.__game.getLevel().prepareJungleAssets());
  await page.waitForTimeout(1500);
  await page.screenshot({path:`${out}/00-balcony.png`});
  report.spawn=await page.evaluate(()=>({position:window.__game.player.pos.toArray(),grounded:window.__game.player.grounded,stamp:document.querySelector('.hud-build')?.textContent}));
  assert.equal(report.spawn.grounded,true);
  assert.match(report.spawn.stamp,/Codex\/sol fork/);
  const caveShift=await page.evaluate(()=>{
    const pipe=window.__game.getLevel().captureData().components.find(c=>c.nm==='Long sunlit cavern timber halfpipe');
    return (pipe?.p[2]??-319)+319;
  });
  for(const [name,position] of [
    ['01-clearing',[1,0,9]],['02-downhill',[35,-3,-42]],
    ['03-coastal-settlement',[35,-14,-174]],['04-hut-corridor',[35,-14,-195]],
    ['05-shallow-river',[35,-14,-225]],['06-cave-climb',[35,-14,-246+caveShift]],
    ['07-cavern-halfpipe',[35,-7.2,-303+caveShift]],['08-broken-bridge',[35,-7.2,-355+caveShift]],
    ['09-jungle-exit',[35,-7.2,-386+caveShift]],
  ]) {
    await page.evaluate(position=>{
      const g=window.__game,l=g.getLevel();g.campaign.startEphemeral();
      g.player.respawn(l,true,false,{position:g.player.pos.clone().set(...position),heading:g.player.camDir.clone().set(0,0,-1)});
    },position);
    await page.waitForTimeout(visual?1200:2100);
    await page.evaluate(async()=>window.__game.getLevel().prepareJungleAssets());
    const sample=await page.evaluate(()=>{
      const g=window.__game,l=g.getLevel();return {position:g.player.pos.toArray(),grounded:g.player.grounded,
        deaths:g.player.totalDeaths,state:g.player.state,assets:l.jungleAssetDiagnostics,
        render:g.getRenderFrameStats(),memory:g.renderer.info.memory,lights:g.scene.children.filter(o=>o.isLight).length};
    });
    report.scenes.push({name,...sample});
    assert.ok(sample.position.every(Number.isFinite),`${name} finite position`);
    assert.equal(sample.grounded,true,`${name} supported review location`);
    assert.deepEqual(sample.assets.errors,[],`${name} assets`);
    await page.screenshot({path:`${out}/${name}.png`});
  }
  if(!visual){
  // The optional play smoke is separate from the quick scene capture.
  const before=await page.evaluate(()=>({time:window.__game.getLevel().jungleAssetDiagnostics.windTime,memory:{...window.__game.renderer.info.memory}}));
  await page.waitForTimeout(2500);
  const after=await page.evaluate(()=>({time:window.__game.getLevel().jungleAssetDiagnostics.windTime,memory:{...window.__game.renderer.info.memory}}));
  assert.ok(after.time>before.time);
  assert.ok(after.memory.geometries<=before.memory.geometries,'idle geometry residency does not grow');
  assert.ok(after.memory.textures<=before.memory.textures,'idle texture residency does not grow');
  report.animation={before,after};
  await page.evaluate(()=>{
    const g=window.__game;g.campaign.startEphemeral();
    g.player.respawn(g.getLevel(),true,false,{position:g.player.pos.clone().set(35,-1.7,-35),heading:g.player.camDir.clone().set(0,0,-1)});
  });
  await page.waitForTimeout(1500);
  await page.keyboard.down('ArrowUp');
  await page.waitForFunction(()=>window.__game.player.pos.z<-41.5,null,{timeout:12000});
  await page.keyboard.down('Space');
  await page.waitForFunction(()=>window.__game.player.pos.z<-44.9,null,{timeout:12000});
  await page.keyboard.up('Space');
  await page.waitForFunction(()=>window.__game.player.pos.z<-53&&window.__game.player.grounded,null,{timeout:12000});
  await page.keyboard.up('ArrowUp');
  await page.waitForTimeout(800);
  report.keyboardJump=await page.evaluate(()=>({position:window.__game.player.pos.toArray(),deaths:window.__game.player.totalDeaths,grounded:window.__game.player.grounded}));
  assert.equal(report.keyboardJump.deaths,0,'real keyboard clears first downhill pit');
  assert.equal(report.keyboardJump.grounded,true);
  await page.screenshot({path:`${out}/keyboard-ramp-landing.png`});
  report.frameTiming=await page.evaluate(async()=>{
    const times=[];let previous=performance.now();
    for(let i=0;i<90;i++)await new Promise(resolve=>requestAnimationFrame(now=>{times.push(now-previous);previous=now;resolve();}));
    times.sort((a,b)=>a-b);return {medianMs:times[45],p95Ms:times[85],frames:times.length};
  });
  }
  assert.deepEqual(errors,[],'full-render browser errors');
  console.log(JSON.stringify({spawn:report.spawn,scenes:report.scenes.map(s=>({name:s.name,calls:s.render.calls,triangles:s.render.triangles,textureMiB:s.assets.textureMiB})),errors,out}));
}finally{await writeFile(`${out}/report.json`,JSON.stringify(report,null,2));await browser.close();}
