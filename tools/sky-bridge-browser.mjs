import assert from 'node:assert/strict';
import {mkdir,writeFile} from 'node:fs/promises';
import {createRequire} from 'node:module';
import {pathToFileURL} from 'node:url';
import {homedir} from 'node:os';
import {join} from 'node:path';
const require=createRequire(import.meta.url);
let module=process.env.PLAYWRIGHT_MODULE;
if(!module){try{module=require.resolve('playwright');}catch{module=join(homedir(),'.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright/index.mjs');}}
const {chromium}=await import(module.startsWith('/')?pathToFileURL(module).href:module);
const base=(process.argv.find(a=>/^https?:/.test(a))||'http://127.0.0.1:5199').replace(/\/$/,'');
const output=process.env.SKY_REVIEW_OUTPUT||'/private/tmp/sky-bridge-review';
await mkdir(output,{recursive:true});
const browser=await chromium.launch({headless:true,channel:'chrome'});
const page=await browser.newPage({viewport:{width:1280,height:720}}),errors=[],report={base,errors};
page.setDefaultTimeout(120000);page.setDefaultNavigationTimeout(120000);
page.on('pageerror',e=>errors.push(e.message));
page.on('console',m=>{if(m.type()==='error')errors.push(m.text());});
const ready=()=>page.waitForFunction(()=>window.__game&&!window.__game.gameFlow.blocksGameplay);
const place=async(x,z)=>{
  await page.evaluate(({x,z})=>{const g=window.__game,p=g.player,l=g.getLevel();
    p.respawn(l,true,false,{position:p.pos.clone().set(x,[-27,-122,-189].some((v,i)=>Math.abs(v-z)<[7,8,7.5][i])?.17:.07,z),heading:p.pos.clone().set(0,0,-1)});
    p.commitRenderStep(l);},{x,z});
  await page.waitForFunction(()=>window.__game.player.grounded);
};
try{
  await page.goto(`${base}/?playtest&level=sky&lite`);await ready();
  assert.equal(await page.evaluate(()=>window.__game.player.grounded),true,'supported spawn');
  report.construction=await page.evaluate(()=>{
    const l=window.__game.getLevel(),data=l.captureData(),skins=l.groundMeshes.flatMap(m=>m.children.filter(c=>c.userData.suspensionDeck).map(c=>c.userData.suspensionDeck));
    let postSockets=0;l.root.traverse(o=>{if(o.name==='Rope post socket on landing')postSockets++;});
    return {postSockets,components:data.components.length,bearers:data.components.filter(c=>c.dkind==='braidedrope').length,
      decks:skins.length,rotten:skins.filter(s=>s.rotten).length,frozen:skins.filter(s=>s.frozen).length,
      enemies:l.enemies.length,tnt:l.crates.filter(c=>c.tnt).length,nitro:l.crates.filter(c=>c.nitro).length};
  });
  assert.deepEqual({...report.construction,components:undefined},{postSockets:32,components:undefined,bearers:16,decks:14,rotten:7,frozen:3,enemies:4,tnt:4,nitro:4},'new construction release must be loaded');

  // Only normal device samples throughout this uninterrupted spawn-to-gate run.
  await page.evaluate(()=>{
    const g=window.__game,p=g.player,l=g.getLevel(),surfaces=l.captureData().components.filter(c=>c.t==='platform'||c.t==='crumble');
    const e=window.__skyRoute={frames:0,jumps:0,ice:[],falling:[],states:[],finish:false,dead:false,trace:[]};
    const poll=g.input.pollGamepad;window.__restoreSkyInput=()=>{g.input.pollGamepad=poll;};
    let hold=0,rest=0,spin=0;
    g.input.pollGamepad=()=>{
      e.frames++;
      if(p.state==='finished')e.finish=true;
      if(['dead','gameover'].includes(p.state))e.dead=true;
      const ground=surfaces.find(c=>Math.abs(p.pos.x-c.p[0])<c.s[0]/2&&Math.abs(p.pos.z-c.p[2])<=c.s[2]/2+.1);
      const distance=ground?p.pos.z-(ground.p[2]-ground.s[2]/2):null;
      if(hold>0)hold--;else if(rest>0)rest--;
      else if(p.grounded&&distance!==null&&distance<1.8&&p.pos.z>-229){hold=5;rest=12;e.jumps++;}
      if(!e.states.includes(p.state))e.states.push(p.state);
      const contact=p.groundHit,id=contact?.mesh?.userData.editorIdx;
      if(contact?.slippy&&id!==undefined&&!e.ice.includes(id))e.ice.push(id);
      if(contact?.crumbleId!==undefined&&!e.falling.includes(contact.crumbleId))e.falling.push(contact.crumbleId);
      if(e.frames%30===0)e.trace.push({p:p.pos.toArray(),state:p.state,grounded:p.grounded});
      spin++;const lane=p.pos.z<-106&&p.pos.z>-132?.95:((p.pos.z<-12&&p.pos.z>-36)||(p.pos.z<-177&&p.pos.z>-198))?-.95:0;
      const dx=lane-p.pos.x;
      const lateral=p.groundHit?.slippy?Math.max(-.22,Math.min(.22,dx*.2-p.walkVelocity.x*.18)):Math.max(-.65,Math.min(.65,dx*1.1));
      const enemy=l.enemies.some(e=>e.alive&&Math.hypot(e.group.position.x-p.pos.x,e.group.position.z-p.pos.z)<3.2);
      const bomb=l.crates.some(c=>c.alive&&(c.tnt||c.nitro)&&c.mesh.position.distanceTo(p.pos)<3);
      const wantsSpin=enemy&&!bomb||l.checkpoints.some(c=>!c.active&&Math.abs(c.spawnPos.z-p.pos.z)<2);
      const jump=hold>0,attack=wantsSpin;
      return {id:'Sky Bridge normal-input route',mapping:'standard',connected:true,index:0,
        axes:[e.finish||e.dead?0:lateral,e.finish||e.dead?0:-1,0,0],buttons:Array.from({length:18},(_,i)=>{
          const pressed=(i===0&&jump)||(i===2&&attack);return {pressed,value:pressed?1:0};})};
    };
  });
  await page.waitForFunction(()=>window.__skyRoute?.finish||window.__skyRoute?.dead);
  report.route=await page.evaluate(()=>{
    window.__restoreSkyInput();const g=window.__game;
    return {...window.__skyRoute,position:g.player.pos.toArray(),checkpoints:g.getLevel().checkpoints.map(c=>c.active)};
  });
  assert.equal(report.route.dead,false);assert.equal(report.route.finish,true);
  assert.equal(report.route.ice.length,3,'traverse all three ice slabs');
  assert.equal(report.route.falling.length,7,'traverse every falling deck');
  assert.deepEqual(report.route.checkpoints,[true,true,true]);
  console.log('PASS continuous route, 22 jumps, all ice and falling decks, three checkpoints, finish');
  await page.screenshot({path:output+'/finish.png'});

  // Independent fixture: stay on one falling deck and observe its actual
  // loss of support and ordinary pit death/respawn, without calling touchCrumble.
  await page.goto(`${base}/?playtest&level=sky&lite`);await ready();
  await place(0,-49.5);
  await page.waitForFunction(()=>window.__game.getLevel().crumbles[0].state==='shake');
  await page.waitForFunction(()=>window.__game.getLevel().crumbles[0].state==='fall'&&!window.__game.player.grounded);
  report.collapse=await page.evaluate(()=>({state:window.__game.getLevel().crumbles[0].state,
    grounded:window.__game.player.grounded,warning:window.__game.getLevel().crumbles[0].mesh.children.some(c=>c.name.includes('warning bindings'))}));
  await page.waitForFunction(()=>window.__game.player.state==='dead');
  await page.waitForFunction(()=>window.__game.player.grounded&&window.__game.player.state==='ride');
  report.collapse.respawn=await page.evaluate(()=>({position:window.__game.player.pos.toArray(),
    allRestored:window.__game.getLevel().crumbles.every(c=>c.state==='idle'&&c.mesh.visible)}));
  assert.equal(report.collapse.warning,true);assert.equal(report.collapse.respawn.allRestored,true);
  assert.ok(report.collapse.respawn.position[2]>0,'fall returns to supported spawn');
  console.log('PASS collapse removes support and death restores the complete platform');

  // Bank a real checkpoint by spinning its crate, then walk off the edge.
  await place(0,-64.8);await page.keyboard.down('ArrowUp');await page.keyboard.down('KeyF');
  await page.waitForFunction(()=>window.__game.getLevel().checkpoints[0].active);
  await page.keyboard.up('ArrowUp');await page.keyboard.up('KeyF');
  await page.keyboard.down('ArrowRight');await page.keyboard.down('ArrowUp');await page.waitForTimeout(500);
  await page.keyboard.press('Space',{delay:100});
  await page.waitForFunction(()=>window.__game.player.state==='dead');await page.keyboard.up('ArrowRight');await page.keyboard.up('ArrowUp');
  await page.waitForFunction(()=>window.__game.player.grounded&&window.__game.player.state==='ride');
  report.checkpoint=await page.evaluate(()=>({position:window.__game.player.pos.toArray(),active:window.__game.getLevel().checkpoints[0].active}));
  assert.equal(report.checkpoint.active,true);assert.ok(Math.abs(report.checkpoint.position[2]+67)<4);

  // Enter on foot, release the actual key, and measure visible forward carry.
  await place(0,-22);await page.keyboard.down('ArrowUp');await page.waitForTimeout(650);await page.keyboard.up('ArrowUp');
  const before=await page.evaluate(()=>({z:window.__game.player.pos.z,speed:window.__game.player.walkVelocity.length()}));
  await page.waitForTimeout(650);
  const after=await page.evaluate(()=>({z:window.__game.player.pos.z,speed:window.__game.player.walkVelocity.length(),ice:window.__game.player.groundHit?.slippy}));
  report.iceRelease={before,after,carry:before.z-after.z};
  assert.equal(after.ice,true);assert.ok(report.iceRelease.carry>.4,'ice release stopped immediately');
  assert.ok(after.speed>before.speed*.6,'ice erased release momentum');

  // Finish in the real full renderer; review both desktop and portrait.
  await page.goto(`${base}/?playtest&level=sky`);await ready();
  await page.evaluate(()=>window.__game.getLevel().prepareJungleAssets());await page.waitForTimeout(700);
  report.full=await page.evaluate(()=>({sky:window.__game.getLevel().skyPreset,
    stamp:document.querySelector('.hud-build')?.textContent,
    calls:window.__game.renderer.info.render.calls,triangles:window.__game.renderer.info.render.triangles,
    textures:window.__game.renderer.info.memory.textures,geometries:window.__game.renderer.info.memory.geometries,
    fog:{near:window.__game.scene.fog.near,far:window.__game.scene.fog.far,color:window.__game.scene.fog.color.getHexString()}}));
  assert.equal(report.full.sky,'clouds');assert.match(report.full.stamp,/Codex\/sol fork/);
  await page.screenshot({path:output+'/full-spawn.png'});
  await place(0,-23);await page.waitForTimeout(500);await page.screenshot({path:output+'/full-ice.png'});
  await place(0,-38);await page.waitForTimeout(500);await page.screenshot({path:output+'/full-falling.png'});
  await page.setViewportSize({width:390,height:844});await page.waitForTimeout(500);
  await page.screenshot({path:output+'/portrait.png'});
  await page.setViewportSize({width:1280,height:720});await place(0,5);await page.waitForTimeout(500);
  if(process.argv.includes('--capture-preview')){
    const png=await page.evaluate(()=>{
      const g=window.__game,r=g.renderer,camera=g.camera.clone(),oldTarget=r.getRenderTarget(),visible=g.player.group.visible;
      camera.position.set(8,7.5,-7);camera.lookAt(0,.3,-33);camera.updateMatrixWorld(true);
      g.player.group.visible=false;g.scene.updateMatrixWorld(true);
      try{r.setRenderTarget(null);r.setViewport(0,0,r.domElement.width,r.domElement.height);r.setScissorTest(false);
        r.clear();r.render(g.scene,camera);return r.domElement.toDataURL('image/png').split(',')[1];}
      finally{g.player.group.visible=visible;r.setRenderTarget(oldTarget);}
    });
    await writeFile(output+'/preview.png',Buffer.from(png,'base64'));
  }
  assert.deepEqual(errors,[],'browser console errors');
  console.log(JSON.stringify({...report,route:{...report.route,trace:undefined}},null,2));
}finally{await writeFile(output+'/review.json',JSON.stringify(report,null,2));await browser.close();}
