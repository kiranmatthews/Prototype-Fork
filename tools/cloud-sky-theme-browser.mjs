import assert from 'node:assert/strict';
import {mkdir,writeFile} from 'node:fs/promises';

const {chromium}=await import(process.env.PLAYWRIGHT_MODULE||'playwright');
const base=process.argv.find(a=>/^https?:/.test(a))||'http://127.0.0.1:5188/';
const lite=process.argv.includes('--lite'),out=process.env.CLOUD_SKY_OUTPUT||'/private/tmp/cloud-sky-theme';
await mkdir(out,{recursive:true});
const browser=await chromium.launch({channel:'chrome',headless:true});
const page=await browser.newPage({viewport:{width:1600,height:1000},deviceScaleFactor:1});
const report={base,lite,views:[],errors:[]};
page.on('pageerror',e=>report.errors.push(e.message));
page.on('console',m=>{if(m.type()==='error')report.errors.push(m.text());});
const ready=id=>page.waitForFunction(id=>window.__game?.getCurrentLevel().id===id&&!window.__game.gameFlow.blocksGameplay,id,{timeout:180000});
async function inspect(name,expected){
 await page.waitForTimeout(700);
 const state=await page.evaluate(()=>{
  const g=window.__game,sky=g.scene.getObjectByName('Distant sky backdrop'),gl=g.renderer.getContext();
  const program=sky&&g.renderer.properties.get(sky.material).currentProgram;
  const location=program&&gl.getUniformLocation(program.program,'uCloudRoadSky');
  return {level:g.getCurrentLevel().id,stamp:document.querySelector('.hud-build')?.textContent,
   skyPreset:g.getLevel().skyPreset,skyArtwork:sky?.material.userData.skyArtwork,
   skystreamTint:location?gl.getUniform(program.program,location):null,
   skystreamSun:g.scene.getObjectByName('Skystream sun · occluded lens flare')?.visible,
   cloudPass:g.cloudPathPass.diagnostics,canvas:[g.renderer.domElement.width,g.renderer.domElement.height],
   position:g.player.pos.toArray(),grounded:g.player.grounded};
 });
 assert.match(state.stamp,/Codex\/sol fork/);assert.equal(state.skystreamSun,expected&&!lite);
 if(!lite){assert.equal(state.skystreamTint,expected?1:0);assert.equal(state.skyArtwork,'painted');}
 assert.ok(state.cloudPass.clouds>0);assert.equal(state.cloudPass.height,360);
 report.views.push({name,...state});await page.screenshot({path:out+'/'+name+'.png'});
 console.log(JSON.stringify({name,level:state.level,tint:state.skystreamTint,sun:state.skystreamSun,clouds:state.cloudPass.clouds}));
}
try{
 await page.goto(new URL('?playtest&level=sky'+(lite?'&lite':''),base).href,{waitUntil:'domcontentloaded',timeout:180000});await ready('sky');
 await page.evaluate(()=>{const g=window.__game;g.renderQualitySettings.setRegularResolution(null);g.crtGuestSettings.setEnabled(false);});
 await inspect('sky-native',false);
 assert.equal(report.views.at(-1).skyPreset,'clouds');assert.equal(report.views.at(-1).cloudPass.clouds,12);
 await page.evaluate(()=>{const g=window.__game,p=g.player;p.respawn(g.getLevel(),true,false,{position:p.pos.clone().set(0,.1,-150),heading:p.pos.clone().set(0,0,-1)});});
 await inspect('sky-high-span-native',false);
 await page.evaluate(()=>{const g=window.__game;g.renderQualitySettings.setRegularResolution(720);g.crtGuestSettings.setEnabled(true);});
 await inspect('sky-normal',false);
 await page.evaluate(()=>window.__game.enterBonusRound());await ready('bonus:sky');
 await page.evaluate(()=>{const g=window.__game,p=g.player;g.renderQualitySettings.setRegularResolution(null);g.crtGuestSettings.setEnabled(false);p.respawn(g.getLevel(),true,false,{position:p.pos.clone().set(25,.1,0),heading:p.pos.clone().set(1,0,0)});});
 await inspect('sky-bonus-native',false);assert.equal(report.views.at(-1).cloudPass.clouds,6);
 await page.evaluate(()=>window.__game.returnFromBonus(false));await ready('sky');await inspect('sky-return',false);
 if(!lite){
  await page.evaluate(()=>window.__game.switchLevel('skystream'));await ready('skystream');await inspect('skystream-native',true);
  await page.evaluate(()=>window.__game.enterBonusRound());await ready('bonus:skystream');await inspect('skystream-bonus-native',true);
  await page.evaluate(()=>window.__game.switchLevel('bonus-skystream'));await ready('bonus-skystream');await inspect('skystream-standalone-bonus',true);
  await page.evaluate(()=>window.__game.switchLevel('sky'));await ready('sky');await inspect('sky-after-skystream',false);
 }
 assert.deepEqual(report.errors,[]);console.log('PASS cloud platforms retain the original sky; Skystream alone keeps its tint and sun');
}finally{await writeFile(out+'/report.json',JSON.stringify(report,null,2));await browser.close();}
