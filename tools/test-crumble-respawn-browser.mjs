// Verify the normal game in an isolated browser save, locally or on GitHub Pages.
import assert from 'node:assert/strict';
import { mkdir, writeFile } from 'node:fs/promises';
const { chromium } = await import(process.env.PLAYWRIGHT_MODULE || 'playwright');
const base=process.argv[2]||'http://127.0.0.1:5307/';
const output=process.env.FALLAWAY_OUTPUT||'/private/tmp/fallaway-respawn/browser';
await mkdir(output,{recursive:true});
const browser=await chromium.launch({headless:true,channel:'chrome'});
const reports=[],errors=[];
try {
  for(const lite of [true,false]) {
    const page=await browser.newPage({viewport:{width:1280,height:720}});
    page.on('pageerror',e=>errors.push(e.message));
    page.on('console',m=>{if(m.type()==='error')errors.push(m.text());});
    await page.goto(`${base}?playtest&level=sky${lite?'&lite':''}`);
    await page.waitForFunction(()=>window.__game&&!window.__game.gameFlow.blocksGameplay&&window.__game.player.grounded,null,{timeout:120000});
    const stamp=await page.locator('.hud-build').textContent();assert.match(stamp,/Codex\/sol fork/);
    const course=await page.evaluate(()=>{
      const g=window.__game,l=g.getLevel(),c=l.crumbles[0];
      if(!c)throw Error('Sky Bridge did not load its fallaway platforms');
      const spawn={grounded:g.player.grounded,position:g.player.pos.toArray(),pads:l.crumbles.length};
      g.player.respawn(l,true,true,{position:c.base.clone().setY(c.base.y+c.mesh.geometry.parameters.height/2+.15),heading:c.base.clone().set(0,0,-1)});
      return spawn;
    });
    await page.waitForFunction(()=>window.__game.getLevel().crumbles[0].state==='shake');
    const landing=await page.evaluate(()=>{
      const g=window.__game,l=g.getLevel(),p=g.player;
      const landed=p.grounded&&p.groundHit?.crumbleId===0;
      p.pos.copy(l.spawnPos);p.pos.y+=.1;p.prevPos.copy(p.pos);p.speed=0;p.vVel=0;p.grounded=false;
      const probe={elapsed:0,drop:null,returned:null,samples:[]};window.__fallawayProbe=probe;
      const native=l.update.bind(l);
      l.update=dt=>{const before=l.crumbles[0].state;native(dt);probe.elapsed+=dt;const c=l.crumbles[0];
        if(before==='shake'&&c.state==='fall')probe.drop=probe.elapsed;
        if(probe.drop!==null&&probe.returned===null){
          probe.samples.push({t:probe.elapsed-probe.drop,state:c.state,visible:c.mesh.visible,scale:c.mesh.scale.x,solid:l.groundMeshes.includes(c.mesh)});
          if(c.state==='idle')probe.returned=probe.elapsed-probe.drop;
        }};
      return landed;
    });
    assert.equal(landing,true,'normal player landing must trigger the actual course pad');
    await page.waitForFunction(()=>window.__fallawayProbe.returned!==null,null,{timeout:30000});
    const courseReturn=await page.evaluate(()=>window.__fallawayProbe);
    assert.ok(courseReturn.returned>=9.99&&courseReturn.returned<=10.03);
    assert.ok(courseReturn.samples.some(s=>s.state==='gone'&&s.visible&&s.scale<.9&&!s.solid));
    console.log(`${lite?'lite':'full'} Sky Bridge: supported landing and ${courseReturn.returned.toFixed(3)}s return`);

    // A compact editor-built fixture keeps the entire animation close in frame.
    await page.evaluate(()=>{
      const g=window.__game;
      const data={v:1,name:'Fallaway animation review',spawn:[0,.1,5],killY:-14,
        components:[
          {t:'platform',p:[0,-.5,5],s:[9,1,6],tex:'stone'},
          {t:'crumble',p:[0,0,-1],s:[5,.5,4],shake:.85,tex:'bridge-timber'},
          {t:'platform',p:[0,-.5,-7],s:[9,1,6],tex:'stone'},
          {t:'checkpoint',p:[3,0,5]},
          {t:'gate',p:[0,0,-8]},
        ]};
      const id=g.saveUserLevel({id:'',name:data.name,data});
      if(!id||!g.switchLevel(id))throw Error('Could not load editor fixture');g.gameFlow.hide();
    });
    await page.waitForFunction(()=>window.__game.player.grounded&&!window.__game.gameFlow.blocksGameplay);
    await page.evaluate(()=>{
      const g=window.__game,l=g.getLevel(),p=g.player;
      const probe={elapsed:0,drop:null,returned:null};window.__fallawayProbe=probe;
      const native=l.update.bind(l);
      l.update=dt=>{const before=l.crumbles[0].state;native(dt);probe.elapsed+=dt;
        if(before==='shake'&&l.crumbles[0].state==='fall')probe.drop=probe.elapsed;
        if(probe.drop!==null&&probe.returned===null&&l.crumbles[0].state==='idle')probe.returned=probe.elapsed-probe.drop;};
      p.respawn(l,true,true,{position:p.pos.clone().set(0,.15,-1),heading:p.pos.clone().set(0,0,-1)});
    });
    await page.waitForFunction(()=>window.__game.getLevel().crumbles[0].state==='shake');
    await page.evaluate(()=>{const p=window.__game.player;p.pos.set(0,.1,4.1);p.prevPos.copy(p.pos);p.speed=0;p.vVel=0;p.grounded=false;});
    await page.waitForFunction(()=>window.__game.getLevel().crumbles[0].state==='gone');
    await page.screenshot({path:`${output}/${lite?'lite':'full'}-absent.png`});
    await page.waitForFunction(()=>{const c=window.__game.getLevel().crumbles[0];return c.state==='gone'&&c.mesh.visible&&c.t>=9.35;},null,{timeout:30000});
    await page.screenshot({path:`${output}/${lite?'lite':'full'}-returning.png`});
    await page.waitForFunction(()=>window.__fallawayProbe.returned!==null);
    await page.screenshot({path:`${output}/${lite?'lite':'full'}-restored.png`});
    const fixtureReturn=await page.evaluate(()=>window.__fallawayProbe.returned);
    assert.ok(fixtureReturn>=9.99&&fixtureReturn<=10.03);
    // Re-land without resetting the level, then stand through the second collapse.
    const snapBefore=await page.evaluate(()=>{const p=window.__game.player;p.pos.set(0,.3,-1);p.prevPos.copy(p.pos);p.vVel=0;p.grounded=false;return p.renderSnapVersion;});
    await page.waitForFunction(()=>window.__game.player.grounded&&window.__game.getLevel().crumbles[0].state==='shake');
    await page.waitForFunction(()=>window.__game.player.state==='dead',null,{timeout:15000});
    await page.waitForFunction(snap=>{const p=window.__game.player;return p.grounded&&p.state!=='dead'&&p.renderSnapVersion!==snap;},snapBefore,{timeout:15000});
    const respawn=await page.evaluate(()=>({grounded:window.__game.player.grounded,pad:window.__game.getLevel().crumbles[0].state,scale:window.__game.getLevel().crumbles[0].mesh.scale.toArray()}));
    assert.equal(respawn.pad,'idle');assert.deepEqual(respawn.scale,[1,1,1]);
    await page.evaluate(()=>{const p=window.__game.player;p.pos.set(3,2.2,5);p.prevPos.copy(p.pos);p.vVel=0;p.grounded=false;});
    await page.waitForFunction(()=>window.__game.getLevel().activeCheckpoint!==null);
    await page.evaluate(()=>{const p=window.__game.player;p.pos.set(0,1.4,-8);p.prevPos.copy(p.pos);p.vVel=0;p.grounded=false;});
    await page.waitForFunction(()=>window.__game.player.state==='finished'||window.__game.gameFlow.blocksGameplay);
    reports.push({lite,stamp,course,courseReturn:courseReturn.returned,fixtureReturn,respawn,checkpoint:true,finish:true});
    await page.close();
  }
  assert.deepEqual(errors,[]);
  console.log(JSON.stringify({reports,errors},null,2));
} finally {await writeFile(`${output}/results.json`,JSON.stringify({base,reports,errors},null,2));await browser.close();}
