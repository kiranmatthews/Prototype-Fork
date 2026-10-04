import assert from 'node:assert/strict';
import {writeFile} from 'node:fs/promises';
const {chromium}=await import(process.env.PLAYWRIGHT_MODULE||'playwright');
const base=process.argv.find(a=>/^https?:/.test(a))||'http://127.0.0.1:5187';
const browser=await chromium.launch({headless:true,channel:'chrome'});
try {
  const page=await browser.newPage({viewport:{width:1280,height:800}}),errors=[];
  page.on('pageerror',e=>errors.push(e.message));page.on('console',m=>{if(m.type()==='error')errors.push(m.text());});
  await page.goto(new URL('?playtest&level=codex-lab&lite',base).href);
  await page.waitForFunction(()=>window.__game&&!window.__game.gameFlow.blocksGameplay,null,{timeout:90000});
  await page.evaluate(async()=>{const g=window.__game;g.campaign.startEphemeral();g.restoreBuiltin('codex-lab');g.switchLevel('codex-lab');await g.getLevel().prepareJungleAssets();});
  await page.waitForTimeout(600);
  const spawn=await page.evaluate(()=>{const g=window.__game,l=g.getLevel(),p=g.player;return {id:g.getCurrentLevel().id,name:l.captureData().name,grounded:p.grounded,position:p.pos.toArray(),floor:l.floorY(p.pos.x,p.pos.z,p.pos.y),crates:l.crates.filter(c=>c.woodCrate).length,loaded:l.crates.filter(c=>c.woodCrate).every(c=>c.woodCrate.assetsLoaded)};});
  assert.ok(spawn.grounded&&spawn.loaded&&spawn.crates>0);
  const checkpoint=await page.evaluate(()=>{const g=window.__game,l=g.getLevel(),p=g.player;p.warpCheckpoint(l,1);return {active:!!l.activeCheckpoint,position:p.pos.toArray(),spawn:l.currentSpawn.toArray()};});
  assert.ok(checkpoint.active);
  await page.evaluate(()=>{const g=window.__game,p=g.player,l=g.getLevel();p.state='air';p.grounded=false;p.pos.y=l.killY-2;p.prevPos.copy(p.pos);});
  await page.waitForFunction(()=>window.__game.player.state==='dead',null,{timeout:5000});
  await page.waitForFunction(()=>window.__game.player.state==='ride'&&window.__game.player.grounded,null,{timeout:15000});
  const respawn=await page.evaluate(()=>{const g=window.__game,l=g.getLevel(),p=g.player;return {deaths:p.totalDeaths,position:p.pos.toArray(),distance:p.pos.distanceTo(l.currentSpawn)};});
  assert.ok(respawn.distance<.2, JSON.stringify(respawn));
  const contact=await page.evaluate(()=>{
    const g=window.__game,l=g.getLevel(),p=g.player,c=l.crates.find(c=>c.woodCrate&&!c.multiHit&&!c.pending);
    const before=p.cratesBroken;
    p.state='air';p.grounded=false;p.spinTimer=0;p.slamActive=false;p.freeSkate=false;p.speed=0;
    p.prevPos.set(c.mesh.position.x,c.box.max.y+.15,c.mesh.position.z);p.pos.set(c.mesh.position.x,c.box.max.y-.05,c.mesh.position.z);p.vVel=-10;p.collide(l);
    return {alive:c.alive,awarded:p.cratesBroken-before,bounce:p.vVel};
  });
  assert.equal(contact.alive,false);assert.equal(contact.awarded,1);assert.ok(contact.bounce>0);
  const finish=await page.evaluate(async()=>{
    const g=window.__game,l=g.getLevel(),p=g.player;
    const source=(await import('/src/levels/codex-lab.ts')).CODEX_LAB_LEVEL;
    const gate=source.components.find(c=>c.t==='gate');
    const yaw=(gate.yaw||0)*Math.PI/180,heading=p.axisF.clone().set(-Math.sin(yaw),0,-Math.cos(yaw));
    const position=p.pos.clone().set(...gate.p).addScaledVector(heading,-2.4);position.y+=.05;
    p.respawn(l,true,true,{position,heading});p.speed=0;p.freeSkate=false;
    const update=g.input.update.bind(g.input);g.input.update=()=>{update();g.input.moveX=0;g.input.moveY=1;};
    return {gate:gate.p,yaw:gate.yaw};
  });
  await page.waitForFunction(()=>window.__game.player.state==='finished',null,{timeout:15000});
  assert.deepEqual(errors,[]);
  const report={spawn,checkpoint,respawn,contact,finish,errors};
  await writeFile(new URL('../../docs/wood-crate-evidence/lab-smoke.json',import.meta.url),JSON.stringify(report,null,2)+'\n');
  console.log(JSON.stringify(report));
} finally {await browser.close();}
