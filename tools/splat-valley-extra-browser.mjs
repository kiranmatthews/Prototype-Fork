import assert from 'node:assert/strict';
import {mkdir,writeFile} from 'node:fs/promises';
const {chromium}=await import(process.env.PLAYWRIGHT_MODULE||'/Users/kiki/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright/index.mjs');
const base=process.argv.find(arg=>/^http/.test(arg))||'http://127.0.0.1:5398/';
const output='/private/tmp/splat-valley-review';await mkdir(output,{recursive:true});
const browser=await chromium.launch({headless:true,channel:'chrome'});
try {
  const page=await browser.newPage({viewport:{width:1440,height:900}}),errors=[];
  page.on('pageerror',e=>errors.push(e.message));page.on('console',m=>{if(m.type()==='error')errors.push(m.text());});
  await page.goto(`${base}?playtest&level=splat-valley&lite`);
  await page.waitForFunction(()=>window.__game?.getLevel().name==='Splat Valley'&&!window.__game.gameFlow.blocksGameplay,null,{timeout:90000});
  const data=await page.evaluate(()=>window.__game.getLevel().captureData().splatScenery);assert.equal(data.asset,'valley');
  await page.keyboard.down('d');await page.waitForTimeout(1500);await page.keyboard.up('d');
  const collision=await page.evaluate(()=>({x:window.__game.player.pos.x,grounded:window.__game.player.grounded}));
  assert.ok(collision.x>4&&collision.x<5.7&&collision.grounded);console.log(JSON.stringify({collision}));
  assert.equal(await page.evaluate(()=>window.__game.player.warpCheckpoint(window.__game.getLevel(),1)),true);
  await page.waitForTimeout(300);
  const checkpoint=await page.evaluate(()=>({active:window.__game.getLevel().checkpoints[0].active,z:window.__game.player.pos.z}));
  assert.ok(checkpoint.active&&checkpoint.z<-40);
  await page.evaluate(()=>{const p=window.__game.player,previous=p.onDeath;window.splatExtra={deaths:0};p.onDeath=(...args)=>{window.splatExtra.deaths++;previous(...args);};});
  await page.keyboard.down('d');
  await page.keyboard.down('Space');await page.waitForTimeout(450);await page.keyboard.up('Space');
  await page.waitForFunction(()=>window.splatExtra.deaths>0,null,{timeout:15000});await page.keyboard.up('d');
  await page.waitForFunction(()=>{const p=window.__game.player;return p.grounded&&p.state!=='dead'&&p.state!=='gameover'&&Math.abs(p.pos.x)<1;},null,{timeout:15000});
  const respawn=await page.evaluate(()=>({deaths:window.splatExtra.deaths,position:window.__game.player.pos.toArray(),checkpoint:window.__game.getLevel().checkpoints[0].active}));
  assert.ok(respawn.checkpoint&&respawn.position[2]<-40);console.log(JSON.stringify({respawn}));
  await page.screenshot({path:`${output}/pit-respawn.png`});
  // A segment start tests the optional rail. The complete journey test uses
  // only source-spawn inputs; this fixture uses the normal respawn API.
  await page.evaluate(()=>{
    const p=window.__game.player,l=window.__game.getLevel(),V=p.pos.constructor;
    p.respawn(l,true,false,{position:new V(-3.6,6,-85.5),heading:new V(0,0,-1)});
    window.splatGrind={frame:0,grindFrames:0,done:false,death:false};
    const step=p.step.bind(p);let previousHeld=true;
    p.step=(dt,input,level)=>{
      const r=window.splatGrind;if(r.done){step(dt,input,level);return;}
      const held=r.frame<26;
      input.moveY=1;input.moveX=p.state==='grind'?Math.max(-1,Math.min(1,-p.balance*5-p.balanceVel*.7)):0;
      input.jumpHeld=held;input.jumpPressed=r.frame===0;input.jumpReleased=previousHeld&&!held;previousHeld=held;
      input.grindHeld=r.frame>=26;input.grindPressed=r.frame===26;input.spinHeld=input.spinPressed=input.restartPressed=false;
      step(dt,input,level);r.frame++;
      if(p.state==='grind'){r.grindFrames++;r.first??=p.pos.toArray();r.last=p.pos.toArray();}
      if(p.state==='dead'||p.state==='gameover'){r.death=true;r.done=true;}
      if(p.pos.z<-108&&p.grounded&&p.state!=='grind'||r.frame>600){r.done=true;r.position=p.pos.toArray();p.step=step;}
    };
  });
  await page.waitForFunction(()=>window.splatGrind.done,null,{timeout:30000});
  const grind=await page.evaluate(()=>window.splatGrind);assert.equal(grind.death,false);assert.ok(grind.grindFrames>60&&grind.last[2]<-101);console.log(JSON.stringify({grind}));
  const disposal=await page.evaluate(()=>{
    const g=window.__game;window.oldSplat=g.getLevel().splatScenery;
    const excluded=[];window.oldSplat.root.traverse(object=>{if(object.isMesh)excluded.push(!g.getLevel().groundMeshes.includes(object));});
    g.switchLevel('treehouse-trail');
    return {collisionExcluded:excluded.every(Boolean)};
  });
  await page.waitForFunction(()=>window.__game.getCurrentLevel().id==='treehouse-trail'&&!window.__game.gameFlow.blocksGameplay,null,{timeout:90000});
  assert.ok(disposal.collisionExcluded);
  assert.equal(await page.evaluate(()=>window.oldSplat.diagnostics.status),'disposed');
  assert.equal(await page.evaluate(()=>window.__game.getLevel().splatScenery),null);
  assert.deepEqual(errors,[]);
  const mobile=await browser.newPage({viewport:{width:390,height:844},isMobile:true,hasTouch:true,deviceScaleFactor:3});
  mobile.on('pageerror',e=>errors.push(e.message));mobile.on('console',m=>{if(m.type()==='error')errors.push(m.text());});
  await mobile.goto(`${base}?playtest&level=splat-valley`);
  await mobile.waitForFunction(()=>window.__game?.getLevel().splatScenery?.diagnostics.status==='ready'&&!window.__game.gameFlow.blocksGameplay,null,{timeout:90000});
  assert.equal(await mobile.evaluate(()=>window.__game.getLevel().splatScenery.diagnostics.variant),'150k');
  await mobile.screenshot({path:`${output}/mobile-full.png`});
  assert.deepEqual(errors,[]);
  await writeFile(`${output}/extra.json`,JSON.stringify({collision,checkpoint,respawn,grind,disposal,mobileVariant:'150k',errors},null,2));
  console.log('PASS normal collision, actual pit/checkpoint respawn, optional grind, scenery disposal and full mobile rendering.');
} finally {await browser.close();}
