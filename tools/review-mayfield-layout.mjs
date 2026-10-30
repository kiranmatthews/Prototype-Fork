import assert from 'node:assert/strict';
import {mkdir,readFile,writeFile} from 'node:fs/promises';
import {build} from 'esbuild';
const {chromium}=await import(process.env.PLAYWRIGHT_MODULE||'playwright');
const out=process.env.MAYFIELD_OUTPUT||'/tmp/mayfield-flow-audit/before',base=process.env.MAYFIELD_URL||'http://127.0.0.1:5278';
const source=JSON.parse(await readFile('art/mayfield-mall/polish-v1/manifest.json','utf8'));
const views=source.views.filter(v=>v.number!==18).map(v=>({id:v.id,title:v.title,...v.placement,...(v.number>=31?{camera:v.placement.camera.map((n,i)=>i===2?n-60:n),target:v.placement.target.map((n,i)=>i===2?n-60:n)}:{})}));
views.unshift({id:'00-garage',title:'Garage start',camera:[-14,142,89],target:[-18,140,34]});
views.push(
 {id:'41-galleria-balconies',title:'Galleria upper decks',camera:[55,150,-140],target:[-15,109,-170]},
 {id:'42-gym-approach',title:'Gym approach and orphan pavilion',camera:[85,130,-370],target:[10,82,-381]},
 {id:'43-canopy-overview',title:'Gym roof and blue canopy',camera:[-65,117,-460],target:[18,82,-464]},
 {id:'44-arcade-loading-join',title:'Arcade to loading',camera:[75,105,-741],target:[0,69,-749]},
 {id:'45-warehouse-overview',title:'Warehouse circulation',camera:[96,112,-828],target:[0,62,-845]},
 {id:'46-kona-circulation',title:'Kona circulation',camera:[95,112,-1000],target:[-45,62,-990]},
 {id:'47-atrium-upper-deck',title:'Atrium upper deck',camera:[-115,132,-1200],target:[-75,94,-1310]},
 {id:'48-atrium-interchange',title:'Snake to atrium',camera:[65,108,-1235],target:[-2,67,-1260]},
 {id:'49-exit-join',title:'Exit join',camera:[155,48,-1620],target:[113,15,-1595]},
 {id:'50-balcony-stair',title:'Interior balcony stair',camera:[12,118,-224],target:[-4,117,-183]},
 {id:'51-mezzanine-stair',title:'Sculpture mezzanine stair',camera:[-20,125,-265],target:[-49,114,-250]},
 {id:'52-gallery-doorway',title:'Atrium upper gallery doorway',camera:[-99,101,-1221],target:[-103,96,-1240]}
);
const only=process.argv.find(a=>a.startsWith('--only='))?.slice(7).split(',');
await mkdir(out+'/views',{recursive:true});
const fixture=await build({stdin:{contents:"export {MAYFIELD_MALL_LEVEL} from './src/levels/mayfield-mall';",resolveDir:process.cwd()},bundle:true,format:'esm',write:false});
const browser=await chromium.launch({headless:true,channel:'chrome'}),page=await browser.newPage({viewport:{width:1920,height:1080},deviceScaleFactor:1,serviceWorkers:'block'}),errors=[];
page.on('pageerror',e=>errors.push(e.message));page.on('console',m=>{if(m.type()==='error')errors.push(m.text());});
await page.route('**/mayfield-layout-fixture.js',r=>r.fulfill({contentType:'application/javascript',body:fixture.outputFiles[0].text}));
try{
 await page.goto(base+'/?playtest&level=mayfield-mall',{timeout:180000});
 await page.waitForFunction(()=>window.__game?.player.grounded&&!window.__game.gameFlow.blocksGameplay,null,{timeout:180000});
 await page.evaluate(async()=>{const g=window.__game,m=await import('./mayfield-layout-fixture.js');if(JSON.stringify(m.MAYFIELD_MALL_LEVEL)!==JSON.stringify(g.getCurrentLevel().data))throw Error('Stale source');g.renderQualitySettings.setRegularResolution(null);g.crtGuestSettings.setEnabled(false);g.player.step=()=>{};g.player.group.visible=false;g.player.drawFlyingFruit=()=>{};g.ui.drawIcons=()=>{};g.ui.drawGameHud=()=>{};});
 await page.waitForTimeout(1200);
 for(const v of views.filter(v=>!only||only.some(x=>v.id.startsWith(x)))){
  await page.evaluate(v=>{const g=window.__game;g.player.pos.set(...v.target);g.player.group.visible=false;},v);
  await page.waitForTimeout(80);
  const png=await page.evaluate(v=>{const g=window.__game;g.camera.position.set(...v.camera);g.camera.fov=v.fov??66;g.camera.lookAt(...v.target);g.camera.updateProjectionMatrix();g.camera.updateMatrixWorld(true);g.getLevel().updateCityVisibility(g.camera.position);return g.captureBonusReviewFrame();},v);
  assert.ok(png?.startsWith('data:image/png'));await writeFile(out+'/views/'+v.id+'.png',Buffer.from(png.split(',')[1],'base64'));console.log(v.id);
 }
 await writeFile(out+'/views.json',JSON.stringify({views,errors},null,2));assert.deepEqual(errors,[]);
}finally{await browser.close();}
