import assert from 'node:assert/strict';
import {mkdir,writeFile} from 'node:fs/promises';
const {chromium}=await import(process.env.PLAYWRIGHT_MODULE||'playwright');
const base=process.env.HAZARD_URL||'http://127.0.0.1:5198/';
const out=new URL('../../docs/hazard-review/',import.meta.url);await mkdir(out,{recursive:true});
const browser=await chromium.launch({channel:'chrome',headless:true});
const page=await browser.newPage({viewport:{width:1440,height:810}}),errors=[],report={base,levels:[],errors};
page.on('pageerror',e=>errors.push(e.message));page.on('console',m=>{if(m.type()==='error')errors.push(m.text());});
try{
  for(const id of ['test','custard-creek','drowned-crown']){
    await page.goto(base+'?playtest&level='+id,{timeout:180000});
    await page.waitForFunction(()=>window.__game&&!window.__game.gameFlow.blocksGameplay,null,{timeout:180000});
    await page.evaluate(()=>window.__game.getLevel().prepareJungleAssets());
    await page.waitForFunction(()=>window.__game.player.grounded,null,{timeout:15000});
    const initial=await page.evaluate(()=>{const g=window.__game,l=g.getLevel();return {id:g.getCurrentLevel().id,
      assets:l.hazardAssetDiagnostics,grounded:g.player.grounded,pos:g.player.pos.toArray(),
      crushers:l.crushers.map(c=>({ready:c.mesh.userData.hazardAssetReady,size:[c.w,c.h,c.d]})),
      pendulums:l.pendulums.map(p=>({ready:p.pivot.userData.hazardAssetReady,len:p.len,links:p.pivot.userData.chainLinks}))};});
    assert.equal(initial.id,id);assert.deepEqual(initial.assets.errors,[]);
    assert.ok(initial.crushers.every(c=>c.ready)&&initial.pendulums.every(p=>p.ready));
    await page.keyboard.down('ArrowUp');await page.waitForTimeout(650);await page.keyboard.up('ArrowUp');
    initial.traversed=await page.evaluate(pos=>window.__game.player.pos.distanceTo(window.__game.player.pos.clone().fromArray(pos))>.4,initial.pos);
    assert.ok(initial.traversed,'normal movement from supported spawn');
    // View the replacement in the actual level using the ordinary player camera.
    await page.evaluate(()=>{const g=window.__game,l=g.getLevel(),p=g.player,pd=l.pendulums[0];
      const heading=p.pos.clone().set(-Math.sin(pd.yaw),0,-Math.cos(pd.yaw));
      const at=pd.pivot.position.clone().addScaledVector(heading,-7);at.y=pd.pivot.position.y-pd.len+.4;
      p.respawn(l,true,false,{position:at,heading});p.endlessDeaths=true;p.commitRenderStep(l);
    });
    await page.waitForTimeout(700);await page.screenshot({path:new URL(id+'-pendulum.png',out).pathname});
    if(id==='test'){
      await page.evaluate(()=>{const g=window.__game,l=g.getLevel(),p=g.player,c=l.crushers[0];
        p.respawn(l,true,false,{position:p.pos.clone().set(c.x,c.restY-c.h/2+.22,c.z+7),heading:p.pos.clone().set(0,0,-1)});
        p.endlessDeaths=true;l.time=-c.phase;p.commitRenderStep(l);});
      await page.waitForTimeout(900);await page.screenshot({path:new URL('test-crusher.png',out).pathname});
      // Enter the crusher's actual slam path, then allow the ordinary death/respawn flow.
      const deaths=await page.evaluate(()=>{const g=window.__game,l=g.getLevel(),p=g.player,c=l.crushers[0];
        p.respawn(l,true,false,{position:p.pos.clone().set(c.x,c.restY-c.h/2+.22,c.z)});p.endlessDeaths=true;
        l.time=c.cycle*.20-c.phase;return p.totalDeaths;});
      await page.waitForFunction(n=>window.__game.player.totalDeaths>n,deaths,{timeout:15000});
      initial.crusherDeath=true;
      await page.waitForFunction(()=>!['dead','gameover'].includes(window.__game.player.state)&&window.__game.player.grounded,null,{timeout:15000});
      initial.respawn=true;
      const swingDeaths=await page.evaluate(()=>{const g=window.__game,l=g.getLevel(),p=g.player,pd=l.pendulums[0];
        l.time=(Math.PI*2-pd.phase)/pd.speed;l.update(0);
        const at=pd.box.getCenter(p.pos.clone());at.y-=.45;p.respawn(l,true,false,{position:at});p.endlessDeaths=true;
        return p.totalDeaths;});
      await page.waitForFunction(n=>window.__game.player.totalDeaths>n,swingDeaths,{timeout:15000});initial.pendulumDeath=true;
      await page.waitForFunction(()=>!['dead','gameover'].includes(window.__game.player.state)&&window.__game.player.grounded,null,{timeout:15000});
      await page.keyboard.press('l');await page.waitForTimeout(1000);
      initial.checkpointWarp=await page.evaluate(()=>window.__game.player.grounded);assert.ok(initial.checkpointWarp);
      await page.evaluate(()=>{const g=window.__game,l=g.getLevel(),p=g.player,c=g.getCurrentLevel().data.components.find(c=>c.t==='gate');
        const yaw=(c.yaw??0)*Math.PI/180,heading=p.pos.clone().set(-Math.sin(yaw),0,-Math.cos(yaw));
        const at=p.pos.clone().fromArray(c.p).addScaledVector(heading,-5);at.y+=.12;
        p.respawn(l,true,false,{position:at,heading});p.commitRenderStep(l);});
      await page.keyboard.down('ArrowUp');await page.keyboard.down('Space');
      await page.waitForFunction(()=>window.__game.player.state==='finished',null,{timeout:15000});
      await page.keyboard.up('Space');await page.keyboard.up('ArrowUp');initial.finish=true;
    }
    report.levels.push(initial);
    console.log(JSON.stringify(initial));
  }
  report.stamp=await page.locator('.hud-build').textContent();assert.match(report.stamp,/Codex\/sol fork/);
  assert.deepEqual(errors,[]);await writeFile(new URL(process.env.HAZARD_LIVE?'published-review.json':'gameplay-review.json',out),JSON.stringify(report,null,2));
  console.log(JSON.stringify({stamp:report.stamp,errors}));
}finally{await browser.close();}
