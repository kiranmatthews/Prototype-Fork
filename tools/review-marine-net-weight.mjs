import assert from 'node:assert/strict';
import {mkdir,writeFile} from 'node:fs/promises';
const {chromium}=await import(process.env.PLAYWRIGHT_MODULE||'playwright');
const base=process.argv[2]||'http://127.0.0.1:5483/';
const out=process.env.TRAMPOLINE_REVIEW_OUTPUT||'/private/tmp/marine-net-weight-route';
await mkdir(out,{recursive:true});
const browser=await chromium.launch({channel:'chrome',headless:true});
const report={base,errors:[]};
try{
  const page=await browser.newPage({viewport:{width:1920,height:1080},deviceScaleFactor:1,serviceWorkers:'block'});
  page.on('pageerror',e=>report.errors.push(e.message));page.on('console',m=>{if(m.type()==='error')report.errors.push(m.text());});
  await page.addInitScript(()=>{navigator.getGamepads=()=>[];});
  const url=new URL(base);url.search='?playtest&level=carlisle-coast&art=harbour';
  console.log('Loading actual Carlisle route');
  await page.goto(url.href,{waitUntil:'domcontentloaded',timeout:180000});
  await page.waitForFunction(()=>window.__game&&!window.__game.gameFlow.blocksGameplay,null,{timeout:180000});
  report.stamp=await page.locator('.hud-build').textContent();assert.match(report.stamp,/Codex\/sol fork/);
  await page.evaluate(async()=>{
    const g=window.__game,p=g.player,l=g.getLevel(),V=p.pos.constructor;
    g.campaign.startEphemeral();g.renderQualitySettings.setRegularResolution(null);g.crtGuestSettings.setEnabled(false);
    await Promise.all([l.prepareJungleAssets(),p.preparePresentationAssets()]);
    const net=l.groundMeshes.find(m=>m.userData.marineNet&&m.userData.moverId===undefined);
    net.geometry.computeBoundingBox();net.updateMatrixWorld(true);
    const at=net.localToWorld(new V(0,net.geometry.boundingBox.max.y+.1,0));
    p.respawn(l,true,true,{position:at});p.freeSkate=false;p.speed=0;
    const q=window.__weightReview={net,budget:60};
    const step=p.step.bind(p),consume=g.input.consumeEdges.bind(g.input);g.input.consumeEdges=()=>{};
    p.step=(dt,input,level)=>{if(q.budget<=0)return;step(dt,input,level);consume();q.budget--;};
    const render=g.renderer.render.bind(g.renderer);
    g.renderer.render=(...args)=>{
      if(args[1]===g.camera){
        const center=net.localToWorld(new V(0,net.geometry.boundingBox.max.y,0));
        g.camera.position.copy(net.localToWorld(new V(10,7,13)));
        g.camera.fov=44;g.camera.lookAt(center);g.camera.updateProjectionMatrix();
      }
      return render(...args);
    };
  });
  const advance=async frames=>{
    await page.evaluate(frames=>window.__weightReview.budget=frames,frames);
    await page.waitForFunction(()=>window.__weightReview.budget===0,null,{timeout:60000});
    return page.evaluate(()=>{
      const p=window.__game.player,m=window.__weightReview.net,local=m.worldToLocal(p.pos.clone());
      return{position:p.pos.toArray(),local:local.toArray(),grounded:p.grounded,net:p.groundHit?.mesh===m,
        offset:p.netRenderOffset.toArray(),launchId:p.trampolineLaunchId,bail:p.isBailing,weight:structuredClone(m.userData.marineNet)};
    });
  };
  report.center=await advance(60);assert.ok(report.center.grounded&&report.center.net&&!report.center.bail);
  assert.ok(report.center.weight.weightDepth>.6&&report.center.offset[1]<-.6);
  await page.screenshot({path:`${out}/center-native.png`});
  console.log('Standing dent captured; walking sideways with keyboard');
  await page.keyboard.down('ArrowRight');report.walk=await advance(30);await page.keyboard.up('ArrowRight');
  report.standing=await advance(24);
  assert.ok(report.standing.grounded&&report.standing.net&&!report.standing.bail);
  assert.equal(report.standing.launchId,report.center.launchId);assert.equal(report.standing.weight.impacts,0);
  assert.ok(Math.hypot(report.standing.local[0]-report.center.local[0],report.standing.local[2]-report.center.local[2])>1);
  assert.ok(Math.abs(report.standing.weight.weightAt[0]-report.standing.local[0])<.03);
  assert.ok(Math.abs(report.standing.weight.weightAt[1]-report.standing.local[2])<.03);
  await page.screenshot({path:`${out}/walk-native.png`});
  report.canvas=await page.evaluate(()=>{const c=window.__game.renderer.domElement;return[c.width,c.height];});
  assert.deepEqual(report.canvas,[1920,1080]);
  await page.evaluate(()=>{const g=window.__game;g.renderQualitySettings.setRegularResolution(480);g.crtGuestSettings.setEnabled(true);});
  await page.waitForTimeout(150);await page.screenshot({path:`${out}/walk-normal.png`});
  await page.keyboard.down('Space');await advance(6);await page.keyboard.up('Space');
  report.departure=await advance(1);assert.equal(report.departure.grounded,false);
  report.released=await advance(70);assert.equal(report.released.weight.weightDepth,0);
  assert.deepEqual(report.errors,[]);
  console.log('PASS actual-route walking dent, foot seating, local follow, no walk bounce, jump release, MAX/normal render and clean console.');
}finally{await writeFile(`${out}/results.json`,JSON.stringify(report,null,2));await browser.close();}
