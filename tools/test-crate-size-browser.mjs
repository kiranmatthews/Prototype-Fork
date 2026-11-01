import assert from 'node:assert/strict';
import { mkdir, writeFile } from 'node:fs/promises';
import { homedir } from 'node:os';
import { join } from 'node:path';
const { chromium } = await import(process.env.PLAYWRIGHT_MODULE || join(homedir(), '.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright/index.mjs'));
const base=process.argv[2]||'http://127.0.0.1:5376/';
const output=process.env.CRATE_BROWSER_OUTPUT||'/private/tmp/crate-size-browser';
await mkdir(output,{recursive:true});
const browser=await chromium.launch({channel:'chrome',headless:true});
const results=[];
try {
  for(const test of [
    {name:'lite-stack',level:'flats',lite:true},
    {name:'native-stack',level:'flats',native:true},
    {name:'bonus-lane',level:'bonus-easy'},
    {name:'foundry',level:'codex-lab',native:true},
  ]) {
    if(process.env.CRATE_BROWSER_CASES&&!process.env.CRATE_BROWSER_CASES.split(',').includes(test.name))continue;
    const errors=[],context=await browser.newContext({viewport:{width:test.native?1920:1280,height:test.native?1080:720},deviceScaleFactor:1,serviceWorkers:'block'});
    await context.addInitScript(test=>{
      if(test.native)localStorage.setItem('solProtoRenderQuality.v1',JSON.stringify({version:1,enabled:false,baseHeight:720,outputMultiplier:1,fixed60:true}));
    },test);
    const page=await context.newPage();
    page.on('pageerror',e=>errors.push(e.message));
    page.on('console',m=>{if(m.type()==='error')errors.push(m.text());});
    try {
      await page.goto(new URL(`?playtest&launchReview&level=${test.level}${test.lite?'&lite':''}`,base).href);
      await page.waitForFunction(()=>window.__game&&!window.__game.gameFlow.blocksGameplay,null,{timeout:180000});
      const evidence=await page.evaluate(async test=>{
        const g=window.__game,l=g.getLevel(),p=g.player,V=p.pos.constructor;
        if(g.launchReview)g.launchReview.rate=0;
        await Promise.all(l.crates.map(c=>c.woodCrate?.ready??c.explosiveBundle?.ready));
        const expected=1.152;
        const wrongSizes=l.crates.filter(c=>Math.abs(c.box.max.y-c.box.min.y-(l.skateRace&&c.mystery?2*expected:expected))>1e-6).length;
        const wood=l.crates.filter(c=>c.woodCrate).map(c=>{
          c.mesh.updateWorldMatrix(true,true);
          const size=new c.box.constructor().setFromObject(c.woodCrate.visual).getSize(new V());
          return {loaded:c.woodCrate.assetsLoaded,size:size.toArray()};
        });
        let collapse=null,contact=null,target;
        if(test.level==='flats'){
          const column=l.crates.filter(c=>Math.abs(c.mesh.position.x-(30-2.5*expected))<.01&&Math.abs(c.mesh.position.z-(-40-2.5*expected))<.01).sort((a,b)=>a.box.min.y-b.box.min.y);
          if(column.length!==6)throw Error(`Expected a six-high column; got ${column.length}`);
          l.breakCrate(column[0]);for(let i=0;i<240;i++)l.update(1/60);
          collapse={base:column[1].box.min.y,gaps:column.slice(2).map((c,i)=>c.box.min.y-column[i+1].box.max.y)};
          l.reset(true);
          const c=column.at(-1);p.respawn(l,true);p.state='air';p.grounded=false;p.spinTimer=0;p.slamActive=false;p.freeSkate=false;p.speed=0;
          p.prevPos.set(c.mesh.position.x,c.box.max.y+.2,c.mesh.position.z);p.pos.set(c.mesh.position.x,c.box.max.y-.06,c.mesh.position.z);p.vVel=-10;p.collide(l);
          contact={broken:!c.alive,bounce:p.vVel};
          l.reset(true);target=new V(30,93.2,-40);
        }else if(test.level==='codex-lab'){
          for(const c of l.crates.filter(c=>c.bang))l.triggerBang(c);
          target=l.crates.find(c=>c.bang&&c.groupIds?.includes(102)).mesh.position.clone();target.z-=9;
        }else target=l.crates[6].mesh.position.clone();
        p.pos.copy(target).add(new V(-8,1,8));p.prevPos.copy(p.pos);p.collapseRenderInterpolation();
        const render=g.renderer.render.bind(g.renderer);
        g.renderer.render=(scene,camera)=>{
          if(camera===g.camera){camera.fov=45;camera.position.copy(target).add(test.level==='codex-lab'?new V(24,22,27):new V(9,6,10));camera.lookAt(target);camera.updateProjectionMatrix();}
          return render(scene,camera);
        };
        return {id:g.getCurrentLevel().id,crates:l.crates.length,wrongSizes,wood,collapse,contact,
          size:[g.renderer.domElement.width,g.renderer.domElement.height],render:g.getRenderQualitySizes()};
      },test);
      assert.equal(evidence.wrongSizes,0);
      assert.ok(evidence.wood.every(c=>c.loaded&&c.size.every(n=>Math.abs(n-1.152)<.005)),'native wood geometry must match enlarged collision');
      if(evidence.collapse){assert.ok(Math.abs(evidence.collapse.base-90)<.001);assert.ok(evidence.collapse.gaps.every(n=>Math.abs(n)<.001));assert.ok(evidence.contact.broken&&evidence.contact.bounce>0);}
      if(test.native)assert.deepEqual(evidence.size,[1920,1080]);
      await page.evaluate(()=>new Promise(resolve=>requestAnimationFrame(()=>requestAnimationFrame(resolve))));
      await page.screenshot({path:join(output,`${test.name}.png`)});
      assert.deepEqual(errors,[]);
      results.push({name:test.name,...evidence,errors});
      console.log(`PASS ${test.name}: ${evidence.crates} enlarged crates; wood/collision match; ${evidence.collapse?'stack collapse/reset and stomp; ':''}no console errors`);
    }finally{await context.close();}
  }
}finally{await browser.close();await writeFile(join(output,'results.json'),JSON.stringify(results,null,2)+'\n');}
