import {build} from 'esbuild';
import assert from 'node:assert/strict';
import {mkdir,writeFile} from 'node:fs/promises';
import {homedir} from 'node:os';
import {pathToFileURL} from 'node:url';
const {chromium}=await import(process.env.PLAYWRIGHT_MODULE||pathToFileURL(homedir()+'/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright/index.mjs').href);
const base=(process.env.ROOFTOP_BASE||'http://127.0.0.1:5267').replace(/\/$/,''),before=process.argv.includes('--before'),lite=process.argv.includes('--lite'),native=process.argv.includes('--native');
const out=process.env.ROOFTOP_OUTPUT||`docs/rooftop-kook/${before?'before':native?'native':lite?'lite':'full'}`;
await mkdir(out,{recursive:true});
const fixture=await build({entryPoints:['src/levels/codex-lab.ts'],bundle:true,format:'esm',write:false});
const browser=await chromium.launch({channel:'chrome',headless:true}),page=await browser.newPage({viewport:native?{width:2560,height:1440}:{width:1440,height:900},deviceScaleFactor:1,serviceWorkers:'block'}),errors=[],failed=[];
page.on('pageerror',e=>errors.push(e.message));page.on('console',m=>{if(m.type()==='error')errors.push(m.text());});
page.on('response',r=>{if(r.status()>=400)failed.push({url:r.url().split('?')[0],status:r.status()});});
await page.route('**/rooftop-kook-fixture.js',r=>r.fulfill({contentType:'application/javascript',body:fixture.outputFiles[0].text}));
try{
 await page.goto(`${base}/?playtest&level=rooftop-relay${lite?'&lite':''}`,{waitUntil:'domcontentloaded',timeout:180000});
 await page.waitForFunction(()=>window.__game?.getCurrentLevel().id==='rooftop-relay'&&!window.__game.gameFlow.blocksGameplay,null,{timeout:180000});
 if(native)await page.evaluate(()=>{window.__game.renderQualitySettings.setRegularResolution(null);window.__game.crtGuestSettings.setEnabled(false);});
 const scenes=await page.evaluate(async()=>{const m=await import('/rooftop-kook-fixture.js');return m.ROOFTOP_DISTRICTS.flatMap(d=>[{id:`${d.index}-arrival`,s:d.a+6},{id:`${d.index}-vista`,s:m.ROOFTOP_ROOFS[d.first+2].a+12}]).concat(m.ROOFTOP_FORKS.flatMap(f=>[{id:`fork-${f.index}-split`,s:f.a+2,route:`fork-${f.index}`},{id:`fork-${f.index}-merge`,s:f.b-2,route:`fork-${f.index}`}]),[{id:'finish',s:m.ROOFTOP_LENGTH-28}]);});
 const report={base,lite,native,scenes:[],errors,failed};
 for(const scene of scenes){
  if(process.env.ROOF_SCENES&&!process.env.ROOF_SCENES.split(',').includes(scene.id))continue;
  await page.evaluate(async({s,route})=>{const m=await import('/rooftop-kook-fixture.js'),g=window.__game,p=g.player,l=g.getLevel(),q=m.rooftopPoint(s,route||'main'),yaw=m.rooftopYaw(s)*Math.PI/180;
   p.respawn(l,true,false,{position:p.pos.clone().set(q[0],q[1]+.12,q[2]),heading:p.camDir.clone().set(-Math.sin(yaw),0,-Math.cos(yaw))});
  },scene);
  await page.waitForTimeout(1200);
  await page.evaluate(()=>window.__game.getLevel().prepareJungleAssets());
  await page.waitForTimeout(400);
  const data=await page.evaluate(()=>{const g=window.__game,meshDetail={native:0,reduced:0,automaticLod:0};g.getLevel().root.traverseVisible(o=>{if(o.isLOD)meshDetail.automaticLod++;if(o.isMesh&&o.userData.jungleAsset){if((o.userData.sceneryLod??0)===0)meshDetail.native++;else meshDetail.reduced++;}});return{grounded:g.player.grounded,position:g.player.pos.toArray(),state:g.player.state,camera:g.camera.position.toArray(),assets:g.getLevel().jungleAssetDiagnostics,meshDetail,buffer:[g.renderer.domElement.width,g.renderer.domElement.height],resolution:g.renderQualitySettings.regularResolution,crt:g.crtGuestSettings.enabled,render:g.renderer.info.render,stamp:document.querySelector('.hud-build')?.textContent};});
  if(native){assert.deepEqual(data.buffer,[2560,1440]);assert.equal(data.resolution,'max');assert.equal(data.crt,false);}
  assert.equal(data.meshDetail.reduced,0);assert.equal(data.meshDetail.automaticLod,0);
  await page.screenshot(native?{path:`${out}/${scene.id}.png`}:{path:`${out}/${scene.id}.jpg`,type:'jpeg',quality:91});
  report.scenes.push({...scene,...data});console.log(scene.id,JSON.stringify(data));
 }
 await writeFile(`${out}/review.json`,JSON.stringify(report,null,2)+'\n');
 if(errors.length||failed.length)throw Error(JSON.stringify({errors,failed}));
}finally{await browser.close();}
