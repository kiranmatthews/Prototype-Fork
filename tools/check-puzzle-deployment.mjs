// Read-only smoke check of the deployed production bundle, plus real menu entry.
import assert from 'node:assert/strict';
import {mkdir,writeFile} from 'node:fs/promises';
const {chromium}=await import(process.env.PLAYWRIGHT_MODULE||'playwright');
const base=process.argv[2]||'https://kiranmatthews.github.io/Prototype-Fork/';
const out=process.env.PUZZLE_DEPLOY_OUTPUT||'/private/tmp/puzzle-deployment';
await mkdir(out,{recursive:true});
const browser=await chromium.launch({headless:true,channel:'chrome'}),reports=[];
try{
 for(const [id,total,target] of [['crate-primer',22,9.8],['switchyard',26,9],['clockwork-gauntlet',36,9.2]]){
  const page=await browser.newPage({viewport:{width:1280,height:720}}),errors=[];
  page.on('pageerror',e=>errors.push(e.message));page.on('console',m=>{if(m.type()==='error')errors.push(m.text());});
  const url=new URL(base);url.search=`?playtest&level=${id}&puzzle-release=20261002`;
  await page.goto(url.href);
  await page.waitForFunction(id=>window.__game?.getCurrentLevel().id===id&&!window.__game.gameFlow.blocksGameplay
   &&window.__game.getLoadingDiagnostics().pending.length===0,id,{timeout:120000});
  const report=await page.evaluate(()=>{const g=window.__game,l=g.getLevel();return{
   id:g.getCurrentLevel().id,name:l.name,total:l.totalCrates,grounded:g.player.grounded,spawn:g.player.pos.toArray(),
   stamp:document.querySelector('.hud-build')?.textContent,
   lives:l.crates.filter(c=>c.life).map(c=>c.box.min.y),
   views:l.cameraViews.length,bonusTotal:l.bonusCrateTotal,
  };});
  assert.equal(report.total,total);assert.ok(report.grounded);assert.equal(report.views,1);assert.equal(report.bonusTotal,0);
  assert.ok(report.stamp?.includes('Codex/sol fork'),`Wrong deployment stamp: ${report.stamp}`);
  assert.ok(report.lives.some(y=>Math.abs(y-target)<.02),'Deployment has stale puzzle target heights');
  await page.screenshot({path:`${out}/${id}-published.png`});
  if(id==='crate-primer'){
   await page.keyboard.press('Escape');
   await page.getByRole('button',{name:'LEVEL SELECT',exact:true}).click();
   for(let turn=0;turn<3&&!await page.locator('[data-island="puzzle-trials"]').count();turn++)
    await page.getByRole('button',{name:'Next island',exact:true}).click();
   await page.getByText(/^PUZZLE TRIALS$/i,{exact:true}).waitFor();
   const text=await page.locator('body').innerText();
   for(const name of ['Crate Primer','Switchyard','Clockwork Gauntlet'])assert.ok(text.toLowerCase().includes(name.toLowerCase()));
   await page.screenshot({path:`${out}/puzzle-trials-level-select.png`});report.menu='All three available on Puzzle Trials';
  }
  assert.deepEqual(errors,[]);reports.push({...report,errors});await page.close();
 }
 await writeFile(`${out}/verified.json`,JSON.stringify({base,reports},null,2));
 console.log(JSON.stringify(reports,null,2));console.log('PASS deployed full-render trilogy, supported spawns, final targets, build stamp and real Puzzle Trials menu.');
}finally{await browser.close();}
