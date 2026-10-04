import assert from 'node:assert/strict';
import {mkdir,writeFile} from 'node:fs/promises';
const {chromium}=await import(process.env.PLAYWRIGHT_MODULE||'playwright');
const base=(process.argv.find(a=>/^https?:/.test(a))||'http://127.0.0.1:5189').replace(/\/$/,'');
const respawnOnly=process.argv.includes('--respawn-only');
const journeyOnly=process.argv.includes('--journey-only')||respawnOnly;
const output='/private/tmp/custard-creek-browser';await mkdir(output,{recursive:true});
const browser=await chromium.launch({headless:true,channel:'chrome'}),errors=[],report={base,checks:[],errors};
const page=await browser.newPage({viewport:{width:1280,height:720}});
page.setDefaultNavigationTimeout(120000);
page.on('pageerror',e=>errors.push(e.message));page.on('console',m=>{if(m.type()==='error')errors.push(m.text());});
const ready=()=>page.waitForFunction(()=>window.__game&&!window.__game.gameFlow.blocksGameplay,null,{timeout:120000});
try {
  for(const lite of journeyOnly?[]:[true,false]) {
    await page.goto(`${base}/?playtest&level=custard-creek${lite?'&lite':''}`);await ready();
    await page.waitForTimeout(700);
    const spawn=await page.evaluate(()=>({level:window.__game.getCurrentLevel().id,grounded:window.__game.player.grounded,pos:window.__game.player.pos.toArray()}));
    assert.equal(spawn.level,'custard-creek');assert.equal(spawn.grounded,true);
    await page.keyboard.down('ArrowUp');await page.keyboard.down('Space');
    await page.waitForTimeout(16000);
    await page.keyboard.up('ArrowUp');await page.keyboard.up('Space');
    const ride=await page.evaluate(()=>{const p=window.__game.player;return{position:p.pos.toArray(),speed:p.speed,broken:p.cratesBroken,deaths:p.totalDeaths,grounded:p.grounded,skating:p.boardRolling};});
    assert.equal(ride.deaths,0);assert.ok(ride.broken>=10);assert.ok(ride.position[2]<-180);
    await page.screenshot({path:`${output}/${lite?'lite':'full'}-carve.png`});
    report.checks.push({render:lite?'lite':'full',spawn,ride});
  }
  if(journeyOnly) {
    await page.goto(`${base}/?playtest&level=custard-creek`,{waitUntil:'domcontentloaded'});await ready();
    const installController=async()=>{
      const g=window.__game,m=await import('./src/levels/custard-creek.ts');window.__creek=m;
      window.__creekPoll=g.input.pollGamepad;
      window.__creekDeathProbe=false;
      window.__creekDeaths=0;
      const onDeath=g.player.onDeath;window.__creekOnDeath=onDeath;
      g.player.onDeath=function(...args){window.__creekDeaths++;return onDeath.apply(this,args);};
      // Controller fixture supplies ordinary device samples to Input.poll.
      // The live Player, camera, collision and fixed-step loop own all motion.
      g.input.pollGamepad=()=>{
        const p=g.player,s=m.custardProgress(p.pos),ahead=s+6;
        const cp=m.CUSTARD_CREEK_CHECKPOINTS.find(c=>Math.abs(c.s-ahead)<14);
        const gap=m.CUSTARD_CREEK_GAPS.find(g=>ahead>g.a-30&&ahead<g.b+30);
        let u=m.custardBoxOffset(ahead);
        if(cp)u*=Math.max(0,(Math.abs(cp.s-ahead)-8)/6);
        else if(gap)u=3.9*Math.max(0,Math.min(1,(ahead-(gap.a-30))/14,((gap.b+30)-ahead)/14));
        const target=m.custardPoint(ahead,u),dx=target[0]-p.pos.x,dz=target[2]-p.pos.z,len=Math.hypot(dx,dz)||1;
        const f=p.courseInputDirection(g.getLevel())??g.getLevel().laneDirAt(p.pos.x,p.pos.y,p.pos.z)??{x:0,z:-1};
        const n=Math.hypot(f.x,f.z)||1,fx=f.x/n,fz=f.z/n;
        return {id:'Creek controller fixture',mapping:'standard',connected:true,index:0,
          axes:window.__creekDeathProbe?[.72,-.7,0,0]:[(dx*-fz+dz*fx)/len,-(dx*fx+dz*fz)/len,0,0],
          buttons:Array.from({length:18},(_,i)=>({pressed:i===0,value:i===0?1:0}))};
      };
    };
    await page.evaluate(installController);
    if(!respawnOnly) {
    let lastSection=-1,state,deadline=Date.now()+300000;
    while(Date.now()<deadline) {
      state=await page.evaluate(()=>{
        const g=window.__game,p=g.player,m=window.__creek,s=m.custardProgress(p.pos),f=m.custardTangent(s),c=m.custardPoint(s);
        const u=(p.pos.x-c[0])*-f[2]+(p.pos.z-c[2])*f[0];
        const cp=m.CUSTARD_CREEK_CHECKPOINTS.find(c=>Math.abs(c.s-s)<14);
        const gap=m.CUSTARD_CREEK_GAPS.find(g=>s>g.a-30&&s<g.b+30);
        let target=m.custardBoxOffset(s);
        if(cp)target=0;else if(gap)target=3.9*Math.max(0,Math.min(1,(s-(gap.a-30))/14,((gap.b+30)-s)/14));
        return {s,u,target,state:p.state,deaths:window.__creekDeaths,broken:p.cratesBroken,grounded:p.grounded,board:p.boardRolling,checkpoints:g.getLevel().checkpoints.filter(c=>c.active).length};
      });
      assert.equal(state.deaths,0,`browser journey died at ${JSON.stringify(state)}`);
      if(state.state==='finished')break;
      const section=Math.floor(state.s/280);if(section!==lastSection){console.log('Browser carve',JSON.stringify(state));lastSection=section;}
      await page.waitForTimeout(700);
    }
    await page.evaluate(()=>{window.__game.input.pollGamepad=window.__creekPoll;window.__game.player.onDeath=window.__creekOnDeath;});
    assert.equal(state.state,'finished');assert.equal(state.deaths,0);
    await page.screenshot({path:output+'/finish-full.png'});report.checks.push({test:'Full-render production controller spawn-to-gate journey',...state});
    }
    // Fresh run: bank a real checkpoint, then skate off the verge and wait for
    // the ordinary death/respawn flow to restore that checkpoint.
    await page.goto(`${base}/?playtest&level=custard-creek&lite`);await ready();
    await page.evaluate(installController);
    await page.waitForFunction(()=>window.__game.getLevel().checkpoints[0].active,null,{timeout:30000});
    console.log('Checkpoint banked',await page.evaluate(()=>({position:window.__game.player.pos.toArray(),speed:window.__game.player.speed,board:window.__game.player.boardRolling})));
    await page.evaluate(()=>{window.__creekDeathProbe=true;});
    await page.waitForFunction(()=>window.__creekDeaths>=1,null,{timeout:30000});
    await page.evaluate(()=>{window.__game.input.pollGamepad=window.__creekPoll;window.__game.player.onDeath=window.__creekOnDeath;});
    await page.waitForFunction(()=>{const p=window.__game.player;return p.grounded&&!p.isBailing&&!['dead','gameover'].includes(p.state);},null,{timeout:30000});
    const respawn=await page.evaluate(()=>{const g=window.__game,p=g.player,cp=g.getLevel().checkpoints[0];return {deaths:window.__creekDeaths,distance:p.pos.distanceTo(cp.spawnPos),grounded:p.grounded};});
    assert.equal(respawn.deaths,1);assert.ok(respawn.distance<1);report.checks.push({test:'Real checkpoint contact, death drop and supported respawn',...respawn});
  }
  if(!journeyOnly) {
  if(process.argv.includes('--capture-preview')) {
    const image=await page.evaluate(async()=>{
      const THREE=await import('./node_modules/three/build/three.module.js'),m=await import('./src/levels/custard-creek.ts'),g=window.__game;
      g.gameFlow.showPause({levelName:'Custard Creek',inWarpRoom:false});
      const camera=new THREE.PerspectiveCamera(58,16/9,.1,650),p=m.custardPoint(76,15,15),target=m.custardPoint(172,0,0);
      camera.position.fromArray(p);camera.lookAt(...target);camera.updateMatrixWorld(true);g.scene.updateMatrixWorld(true);
      const render=g.renderer,old=render.getRenderTarget(),view=render.getViewport(new THREE.Vector4()),scissor=render.getScissor(new THREE.Vector4()),test=render.getScissorTest();
      const rt=new THREE.WebGLRenderTarget(640,360);rt.texture.colorSpace=THREE.SRGBColorSpace;
      const bytes=new Uint8Array(640*360*4),canvas=document.createElement('canvas');canvas.width=640;canvas.height=360;
      const ctx=canvas.getContext('2d'),pixels=ctx.createImageData(640,360),visible=g.player.group.visible;
      try {
        g.player.group.visible=false;render.setRenderTarget(rt);render.setScissorTest(false);render.clear();render.render(g.scene,camera);render.readRenderTargetPixels(rt,0,0,640,360,bytes);
        for(let y=0;y<360;y++)pixels.data.set(bytes.subarray((359-y)*640*4,(360-y)*640*4),y*640*4);ctx.putImageData(pixels,0,0);
        return canvas.toDataURL('image/jpeg',.92).split(',')[1];
      }finally{g.player.group.visible=visible;render.setRenderTarget(old);render.setViewport(view);render.setScissor(scissor);render.setScissorTest(test);rt.dispose();}
    });
    await writeFile(new URL('../public/level-previews/custard-creek.jpg',import.meta.url),Buffer.from(image,'base64'));
    report.checks.push('Actual creek scene captured for Level Select thumbnail');
  }
  await page.goto(`${base}/?playtest&level=test`);await ready();
  await page.evaluate(()=>{const g=window.__game;g.campaign.startEphemeral();g.campaign.commitClear('test',{});g.campaign.setMapFocus('test-course');g.switchLevel('warproom');});
  const selected=key=>page.waitForFunction(key=>document.querySelector('.world-map-ui')?.dataset.selectedKey===key&&!document.querySelector('.world-map-ui')?.classList.contains('is-moving'),key,{timeout:60000});
  await selected('test-course');await page.keyboard.press('ArrowDown',{delay:80});await selected('custard-creek');
  await page.waitForFunction(()=>window.__game.getMapPresentationDiagnostics()?.shownKey==='custard-creek'&&!window.__game.getMapPresentationDiagnostics().flipping);
  const map=await page.evaluate(()=>({name:document.querySelector('.world-map-level-name')?.textContent,position:window.__game.player.pos.toArray(),unlocked:window.__game.campaign.levelUnlocked('custard-creek')}));
  assert.equal(map.name,'CUSTARD CREEK');assert.equal(map.unlocked,true);assert.ok(Math.hypot(map.position[0]+111,map.position[1]-2.4,map.position[2]-46)<.05);
  await page.screenshot({path:output+'/map-full.png'});report.map=map;
  await page.keyboard.press('ArrowUp',{delay:80});await selected('test-course');
  await page.keyboard.press('ArrowDown',{delay:80});await selected('custard-creek');
  await page.keyboard.press('Enter',{delay:80});await page.waitForFunction(()=>window.__game.getCurrentLevel().id==='custard-creek'&&!window.__game.gameFlow.blocksGameplay,null,{timeout:120000});
  report.checks.push('Native map Down/Up branch traversal and Enter launches Custard Creek');
  const context=await browser.newContext({viewport:{width:390,height:844},hasTouch:true,isMobile:true}),touch=await context.newPage();
  touch.on('pageerror',e=>errors.push(e.message));touch.on('console',m=>{if(m.type()==='error')errors.push(m.text());});
  await touch.goto(`${base}/?playtest&level=test&lite`);await touch.waitForFunction(()=>window.__game&&!window.__game.gameFlow.blocksGameplay,null,{timeout:120000});
  await touch.evaluate(()=>{const g=window.__game;g.campaign.startEphemeral();g.campaign.commitClear('test',{});g.campaign.setMapFocus('custard-creek');g.switchLevel('warproom');});
  await touch.waitForFunction(()=>document.querySelector('.world-map-ui')?.dataset.selectedKey==='custard-creek'&&!window.__game.gameFlow.blocksGameplay,null,{timeout:120000});
  await touch.locator('.world-map-action').filter({hasText:'LEVEL STATS'}).tap();
  await touch.waitForFunction(()=>window.__game.gameFlow.currentScreen==='level-select');
  await touch.evaluate(()=>window.__game.gameFlow.updateLevelSelectChoice('custard-creek',true));
  const row=touch.locator('[data-level-key="custard-creek"]');await row.scrollIntoViewIfNeeded();
  assert.equal(await row.isDisabled(),false);await touch.waitForTimeout(500);
  const thumb=await touch.locator('.game-level-preview img').evaluate(e=>({loaded:e.complete&&e.naturalWidth>0,src:e.src})).catch(async()=>await touch.locator('img.game-level-preview').evaluate(e=>({loaded:e.complete&&e.naturalWidth>0,src:e.src})));
  assert.ok(thumb.loaded);assert.match(thumb.src,/custard-creek\.jpg/);
  await touch.screenshot({path:output+'/level-select-touch.png'});await row.tap();
  await touch.waitForFunction(()=>window.__game.getCurrentLevel().id==='custard-creek'&&!window.__game.gameFlow.blocksGameplay,null,{timeout:120000});
  report.checks.push('390×844 touch Level Select shows the actual thumbnail and launches Custard Creek');
  await context.close();
  }
  assert.deepEqual(errors,[]);console.log(JSON.stringify(report,null,2));
}finally{await writeFile(output+(journeyOnly?'/journey-report.json':'/report.json'),JSON.stringify(report,null,2));await browser.close();}
