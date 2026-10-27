import assert from 'node:assert/strict';
import {mkdir,writeFile} from 'node:fs/promises';
const {chromium}=await import(process.env.PLAYWRIGHT_MODULE||'playwright');
const base=process.argv.find(a=>a.startsWith('http'))||'http://127.0.0.1:5278';
const native=process.argv.includes('--native'),full=native||process.argv.includes('--full');
const bonus=process.argv.includes('--bonus'),id=bonus?'bonus-jungle-gate':'jungle-gate-run';
const tour=process.argv.includes('--tour'),views=[[17.2,1,0],[147,3,0],[245,5,0],[372.6,7,0],[473,14,0],[625,9,0],[733,8,0],[885.8,7.4,0],[984,11,0],[1117,8,0],[1195,8,0],[1292.8,24,0]];
const output=process.env.ANCIENT_GATES_OUTPUT||'/private/tmp/ancient-gates-inspect';await mkdir(output,{recursive:true});
const tag=`${bonus?'bonus':tour?'tour':'main'}-${native?'native':full?'full':'lite'}`;
const browser=await chromium.launch({headless:true,channel:'chrome'}),errors=[];
try{
 const page=await browser.newPage({viewport:native?{width:2560,height:1440}:{width:1440,height:900},deviceScaleFactor:1,serviceWorkers:'block'});
 page.on('pageerror',e=>errors.push(e.message));page.on('console',m=>{if(m.type()==='error')errors.push(m.text());});
 await page.goto(`${base}/?playtest&level=${id}${full?'':'&lite'}`,{timeout:240000});
 await page.waitForFunction(id=>window.__game?.getCurrentLevel().id===id&&!window.__game.gameFlow.blocksGameplay,id,{timeout:240000});
 if(native)await page.evaluate(()=>{window.__game.renderQualitySettings.setRegularResolution(null);window.__game.crtGuestSettings.setEnabled(false);});
 const shots=[];
 for(let i=0;i<(bonus?1:12);i++){
  if(tour&&!bonus)await page.evaluate(at=>{const g=window.__game;g.player.respawn(g.getLevel(),true,false,{position:g.player.pos.clone().set(at[0],at[1]+.12,at[2])});},views[i]);
  else if(i)await page.evaluate(()=>{const g=window.__game;g.player.warpCheckpoint(g.getLevel(),1);});
  await page.waitForTimeout(full?2000:500);
  await page.evaluate(()=>window.__game.getLevel().prepareJungleAssets());
  await page.waitForTimeout(150);
  const state=await page.evaluate(()=>{const g=window.__game;return{position:g.player.pos.toArray(),grounded:g.player.grounded,ground:g.player.groundHit?.name,camera:g.camera.position.toArray(),buffer:[g.renderer.domElement.width,g.renderer.domElement.height],assets:g.getLevel().jungleAssetDiagnostics,render:{...g.renderer.info.render},stamp:document.querySelector('.hud-build')?.textContent};});
  await page.screenshot({path:`${output}/${tag}-${String(i).padStart(2,'0')}.png`});shots.push(state);
 }
 await writeFile(`${output}/${tag}.json`,JSON.stringify({shots,errors},null,2));
 console.log(JSON.stringify({shots:shots.length,errors,buffer:shots[0].buffer,stamp:shots[0].stamp}));
 assert.deepEqual(errors,[]);assert.ok(shots.every(s=>s.grounded));
 assert.ok(shots.every(s=>!s.assets?.errors?.length),'All authored scenery assets must load');
 if(native)assert.deepEqual(shots[0].buffer,[2560,1440]);
}finally{await browser.close();}
