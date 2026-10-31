import assert from 'node:assert/strict';
import {mkdir,writeFile} from 'node:fs/promises';
const {chromium}=await import(process.env.PLAYWRIGHT_MODULE||'playwright');
const base=process.argv[2]||'http://127.0.0.1:5483/';
const out=process.env.MOVING_PLATFORM_REVIEW_OUTPUT||'/private/tmp/moving-platform-collision-browser';
await mkdir(out,{recursive:true});
const browser=await chromium.launch({channel:'chrome',headless:true});
const report={base,results:[],errors:[]};
try{
  for(const lite of process.argv.includes('--full')?[false]:[true,false]){
    const page=await browser.newPage({viewport:{width:1920,height:1080},deviceScaleFactor:1,serviceWorkers:'block'});
    page.on('pageerror',e=>report.errors.push(e.message));
    page.on('console',m=>{if(m.type()==='error')report.errors.push(m.text());});
    await page.addInitScript(()=>{navigator.getGamepads=()=>[];});
    const url=new URL(base);url.search=`?playtest&level=carlisle-coast&art=harbour${lite?'&lite':''}`;
    console.log(`Loading ${lite?'lite':'full'} Carlisle lift review`);
    await page.goto(url.href,{waitUntil:'domcontentloaded',timeout:180000});
    await page.waitForFunction(()=>window.__game&&!window.__game.gameFlow.blocksGameplay,null,{timeout:180000});
    const stamp=await page.locator('.hud-build').textContent();assert.match(stamp,/Codex\/sol fork/);
    await page.evaluate(async()=>{
      const g=window.__game,p=g.player,l=g.getLevel(),V=p.pos.constructor;
      g.campaign.startEphemeral();g.renderQualitySettings.setRegularResolution(null);g.crtGuestSettings.setEnabled(false);
      await Promise.all([l.prepareJungleAssets(),p.preparePresentationAssets()]);
      const q=window.__liftReview={budget:0,tick:false,samples:[],mesh:null};
      const step=p.step.bind(p),update=l.update.bind(l),consume=g.input.consumeEdges.bind(g.input);
      g.input.consumeEdges=()=>{};
      p.step=(dt,input,level)=>{
        if(q.budget<=0)return;
        step(dt,input,level);consume();q.budget--;q.tick=true;
        const m=q.mesh,local=m.worldToLocal(p.pos.clone());
        q.samples.push({position:p.pos.toArray(),local:local.toArray(),grounded:p.grounded,
          mover:p.groundHit?.moverId,state:p.state,bail:p.isBailing,vy:p.vVel,top:m.geometry.boundingBox.max.y,
          edge:m.geometry.boundingBox.max.z,half:{...p.hitboxHalf}});
      };
      l.update=dt=>{if(q.tick){update(dt);q.tick=false;}};
      q.prepare=(name,phase,ride=false)=>{
        const mover=l.movers.find(m=>m.mesh.name===name);if(!mover)throw Error(`Missing ${name}`);
        const m=q.mesh=mover.mesh;m.geometry.computeBoundingBox();
        l.time=phase;update(0);l.meshSideCollisions.resetMotion();
        const box=m.geometry.boundingBox;
        const at=()=>m.localToWorld(new V(0,box.max.y+(ride ? .12 : -1.1),ride?0:box.max.z+.7));
        const heading=new V(0,0,-1).transformDirection(m.matrixWorld);
        p.respawn(l,true,true,{position:at(),heading});update(0);l.meshSideCollisions.resetMotion();
        p.pos.copy(at());p.prevPos.copy(p.pos);p.freeSkate=p.airFromSkate=false;p.speed=0;p.vVel=ride?0:4;
        p.state='air';p.grounded=false;p.camDir.copy(heading);p.axisF.copy(heading);
        p.axisL.set(-heading.z,0,heading.x);p.commitRenderStep(l);p.collapseRenderInterpolation();
        q.samples=[];
        return {name,phase,id:m.userData.moverId,center:m.position.toArray(),edge:box.max.z};
      };
      const render=g.renderer.render.bind(g.renderer);
      g.renderer.render=(...args)=>{
        if(args[1]===g.camera&&q.mesh){
          const m=q.mesh,b=m.geometry.boundingBox;
          g.camera.position.copy(m.localToWorld(new V(7,b.max.y+5,b.max.z+9)));
          g.camera.fov=48;g.camera.lookAt(m.localToWorld(new V(0,b.max.y-.1,b.max.z-1)));
          g.camera.updateProjectionMatrix();
        }
        return render(...args);
      };
    });
    const advance=async frames=>{
      await page.evaluate(n=>window.__liftReview.budget=n,frames);
      await page.waitForFunction(()=>window.__liftReview.budget===0,null,{timeout:60000});
      return page.evaluate(()=>window.__liftReview.samples);
    };
    const cases=[];
    for(const name of ['Tide steps · 3','Counterweight 3'])for(const phase of [0,6,12]){
      const setup=await page.evaluate(({name,phase})=>window.__liftReview.prepare(name,phase),{name,phase});
      await page.keyboard.down('ArrowUp');const samples=await advance(8);await page.keyboard.up('ArrowUp');
      for(const s of samples){
        assert.ok(s.position.every(Number.isFinite));
        assert.ok(s.local[2]>=setup.edge+.25,`${name}, phase ${phase}: entered front side ${JSON.stringify(s)}`);
        assert.equal(s.bail,false);
      }
      assert.ok(Math.min(...samples.map(s=>s.local[2]))<setup.edge+.67,`${name}: keyboard approach never reached the edge`);
      cases.push({setup,samples});
      if(!lite&&phase===6)await page.screenshot({path:`${out}/${name.startsWith('Tide')?'tide':'counterweight'}-edge-native.png`});
    }
    const rides=[];
    for(const name of ['Tide steps · 3','Counterweight 3']){
      const setup=await page.evaluate(name=>window.__liftReview.prepare(name,2,true),name);
      const samples=await advance(150);
      for(const s of samples.slice(30)){
        assert.ok(s.grounded&&s.mover===setup.id,`${name}: lost native top support`);
        assert.ok(Math.abs(s.local[1]-s.top)<.04,`${name}: rider height drift`);
        assert.equal(s.bail,false);
      }
      rides.push({setup,first:samples[30],last:samples.at(-1)});
    }
    const canvas=await page.evaluate(()=>{const c=window.__game.renderer.domElement;return[c.width,c.height];});
    assert.deepEqual(canvas,lite?[960,540]:[1920,1080]);
    if(!lite){
      await page.evaluate(()=>window.__liftReview.prepare('Counterweight 3',6));
      await page.keyboard.down('ArrowUp');await advance(8);await page.keyboard.up('ArrowUp');
      await page.evaluate(()=>{const g=window.__game;g.renderQualitySettings.setRegularResolution(480);g.crtGuestSettings.setEnabled(true);});
      await page.waitForTimeout(120);await page.screenshot({path:`${out}/counterweight-edge-normal.png`});
    }
    report.results.push({lite,stamp,canvas,cases,rides});
    await page.close();
  }
  assert.deepEqual(report.errors,[]);
  console.log('PASS both authored lift sections: rising jump side blocking at three phases, top landings/riding, MAX/normal presentation and clean consoles.');
}finally{await writeFile(`${out}/results.json`,JSON.stringify(report,null,2));await browser.close();}
