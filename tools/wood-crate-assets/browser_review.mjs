import assert from 'node:assert/strict';
import {mkdir,writeFile} from 'node:fs/promises';
const {chromium}=await import(process.env.PLAYWRIGHT_MODULE||'playwright');
const base=process.argv.find(arg=>/^https?:/.test(arg))||'http://127.0.0.1:5187';
const output=new URL('../../docs/wood-crate-evidence/',import.meta.url).pathname;
await mkdir(output,{recursive:true});
const browser=await chromium.launch({headless:true,channel:'chrome'});
const reports=[];
try {
  for(const full of [false,true]) {
    const page=await browser.newPage({viewport:{width:1280,height:800}}),errors=[],milkRequests=[];
    page.on('pageerror',e=>errors.push(e.message));
    page.on('console',m=>{if(m.type()==='error')errors.push(m.text());});
    page.on('request',r=>{if(/hud\/milk-bottle|props\/milk-crate/.test(r.url()))milkRequests.push(r.url());});
    await page.goto(new URL(`?playtest&level=jungle${full?'':'&lite'}`,base).href);
    await page.waitForFunction(()=>window.__game&&!window.__game.gameFlow.blocksGameplay,null,{timeout:90000});
    const initial=await page.evaluate(()=>{
      const g=window.__game,l=g.getLevel();g.campaign.startEphemeral();
      const crates=l.crates.filter(c=>c.woodCrate);
      return {level:g.getCurrentLevel().id,crateCount:crates.length,
        loaded:crates.every(c=>c.woodCrate.assetsLoaded),noCartons:l.crates.every(c=>!c.carton),
        triangles:crates[0].woodCrate.visual.geometry.index.count/3,
        sharedGeometry:crates.every(c=>c.woodCrate.visual.geometry===crates[0].woodCrate.visual.geometry),
        sharedMaterial:crates.filter(c=>!c.multiHit).every(c=>c.woodCrate.visual.material===crates.find(c=>!c.multiHit).woodCrate.visual.material),
        loading:g.getLoadingDiagnostics()};
    });
    assert.ok(initial.crateCount>10&&initial.loaded&&initial.noCartons&&initial.sharedGeometry&&initial.sharedMaterial);
    assert.equal(initial.triangles,182);
    await page.evaluate(()=>{
      const g=window.__game,l=g.getLevel(),p=g.player;
      const input=g.input.update.bind(g.input);g.input.update=()=>{input();g.input.inventoryHeld=true;};
      p.fruit=42;g.ui.resetHudTransients(p.fruitCollectionRevision,false);
      const c=l.crates.find(c=>c.woodCrate&&!c.multiHit);
      p.step=()=>{};p.group.visible=false;
      const render=g.renderer.render.bind(g.renderer);
      g.renderer.render=(scene,camera)=>{
        if(scene===g.scene&&camera===g.camera){
          const q=c.mesh.position;camera.position.set(q.x+2.0,q.y+1.35,q.z+2.35);camera.fov=36;camera.lookAt(q);camera.updateProjectionMatrix();
        }
        return render(scene,camera);
      };
      window.woodReviewCrate=c;
    });
    await page.waitForTimeout(1700);
    const hud=await page.evaluate(()=>({label:window.__game.ui.wumpaIcon.getAttribute('aria-label'),
      fruit:window.__game.player.fruit,bottle:!!window.__game.ui.milkBottle,
      iconName:window.__game.ui.iconSlots[1].spin.children[0].name,
      visibility:window.__game.ui.hudVisibilityFrame,fruitRect:window.__game.ui.wumpaIcon.getBoundingClientRect().toJSON()}));
    assert.ok(hud.visibility.showFruit, 'fruit HUD must be visible');assert.equal(hud.label,'Orange fruit: 42/100');assert.equal(hud.bottle,false);assert.match(hud.iconName,/orange fruit/);
    await page.screenshot({path:`${output}/crate-hud-${full?'full':'lite'}.png`});
    const variants=await page.evaluate(async()=>{
      const g=window.__game,l=g.getLevel(),p=g.player,c=window.woodReviewCrate;
      const before=c.box.clone(),visual=c.woodCrate.visual;
      l.setTimeTrial(true);const trial=!visual.visible&&c.mesh.material.visible;
      l.setTimeTrial(false);const restored=visual.visible&&!c.mesh.material.visible&&c.box.equals(before);
      const multi=l.crates.find(c=>c.multiHit);
      const sequence=[];
      if(multi)for(let i=0;i<5;i++){sequence.push(l.hitMultiCrate(multi));}
      l.reset(true);
      p.fruit=99;const lives=p.lives,deaths=p.totalDeaths;p.collectFruit();
      return {trial,restored,multiSequence:sequence,rollover:p.fruit,award:p.endlessDeaths?p.totalDeaths<=deaths:p.lives===lives+1};
    });
    assert.ok(variants.trial&&variants.restored&&variants.rollover===0&&variants.award);
    if(variants.multiSequence.length)assert.deepEqual(variants.multiSequence,[4,3,2,1,0]);
    assert.deepEqual(milkRequests,[]);assert.deepEqual(errors,[]);
    reports.push({full,initial,hud,variants,milkRequests,errors});
    console.log(JSON.stringify(reports.at(-1)));
    await page.close();
  }
  await writeFile(`${output}/browser.json`,JSON.stringify(reports,null,2)+'\n');
} finally {await browser.close();}
