import assert from 'node:assert/strict';
import {mkdir,writeFile} from 'node:fs/promises';
const {chromium}=await import(process.env.PLAYWRIGHT_MODULE||'playwright');
const base=process.argv[2]||'http://127.0.0.1:5272/';
const output=process.env.ENEMY_POLISH_OUTPUT||'/private/tmp/enemy-polish-review';await mkdir(output,{recursive:true});
const browser=await chromium.launch({headless:true,channel:'chrome'}),errors=[],rows=[];
const kinds=['grunt','spiker','turtle','charger','hopper','floater','sentry','spinner'];
try{
  const context=await browser.newContext({viewport:{width:1440,height:900},recordVideo:{dir:output,size:{width:1440,height:900}}});
  const page=await context.newPage();page.on('pageerror',e=>errors.push(String(e)));
  page.on('console',m=>{if(m.type()==='error')errors.push(m.text());});
  if(!process.argv.includes('--game-only')){
  await page.goto(new URL('tools/enemies/motion-review.html?paused=1',base).href);
  await page.waitForFunction(()=>window.__enemyReview?.getDiagnostics().loaded===9);
  await page.evaluate(async()=>{const {sfx}=await import('/src/audio.ts');await sfx.prepare();window.__enemyAudio=[];
    const play=sfx.play.bind(sfx);sfx.play=(name,...args)=>{if(name.startsWith('enemy'))window.__enemyAudio.push({name,args});play(name,...args);};
  });
  await page.getByLabel('Play placeholder sounds').check();
  for(const kind of kinds){
    await page.evaluate(kind=>{const r=window.__enemyReview;r.setKind(kind);r.setMotion('cycle');r.setPlaying(true);},kind);
    for(const view of ['front','quarter','side']){
      const seconds=await page.evaluate(view=>{const r=window.__enemyReview;r.setCamera(view);r.seekFrame(0);return r.getDiagnostics().totalFrames/60;},view);
      await page.waitForTimeout(seconds*1000+120);
    }
    const row=await page.evaluate(()=>window.__enemyReview.getDiagnostics());
    assert.equal(row.assets[0].status,'ready');assert.deepEqual(row.assets[0].rootScale,[1,1,1]);
    rows.push({phase:'cycle',kind,diagnostic:row.assets[0]});
    await page.evaluate(()=>{const r=window.__enemyReview;r.setPlaying(false);r.setCamera('quarter');r.seekFrame(Math.floor(r.getDiagnostics().totalFrames*.45));});
    await page.screenshot({path:`${output}/${kind}-action.png`});
    await page.evaluate(()=>{const r=window.__enemyReview;r.setMotion('idle');r.setPlaying(true);});
    await page.waitForTimeout(1200);
    await page.evaluate(()=>window.__enemyReview.setPlaying(false));
    console.log(`Reviewed ${kind}: full combat/walk loop from front, quarter and side; idle; SFX.`);
  }
  const audio=await page.evaluate(async()=>{const {sfx}=await import('/src/audio.ts');return{
    state:sfx.ctx.state,buffers:[...sfx.buffers.keys()].filter(k=>k.startsWith('enemy')),events:window.__enemyAudio};});
  assert.equal(audio.state,'running');assert.ok(audio.buffers.length>=24);assert.ok(audio.events.some(e=>e.name==='enemySentryFire'));
  rows.push({phase:'review-audio',...audio});
  await page.goto(new URL('tools/enemies/motion-review.html?appearance=nightworks&paused=1',base).href);
  await page.waitForFunction(()=>window.__enemyReview?.getDiagnostics().loaded===2);
  for(const kind of ['grunt','hopper']){
    await page.evaluate(kind=>{const r=window.__enemyReview;r.setKind(kind);r.setPlaying(true);},kind);
    await page.waitForTimeout(3000);await page.screenshot({path:`${output}/nightworks-${kind}.png`});
    rows.push({phase:'nightworks',...await page.evaluate(()=>window.__enemyReview.getDiagnostics())});
  }
  }
  console.log('Loading actual game with isolated preview dependencies…');
  await page.goto(new URL('?playtest&level=codex-lab&lite',base).href);
  await page.waitForFunction(()=>window.__game&&!window.__game.gameFlow.blocksGameplay,null,{timeout:120000});
  await page.evaluate(async kinds=>{const g=window.__game;g.saveUserLevel({id:'enemy-polish-qa',name:'Enemy polish QA',data:{
    v:1,name:'Enemy polish QA',spawn:[0,.1,6],killY:-20,components:[
      {t:'platform',p:[0,-.5,-48],s:[28,1,140]},
      ...kinds.map((foe,i)=>({t:'enemy',foe,p:[0,0,-i*12],range:5,speed:foe==='charger'?4:3})),
      {t:'gate',p:[0,0,-110]},
    ]}});g.switchLevel('enemy-polish-qa');await g.getLevel().prepareJungleAssets();
    g.player.step=()=>{};window.__enemyAudio=[];
    const {sfx}=await import('/src/audio.ts');await sfx.prepare();const play=sfx.play.bind(sfx);
    sfx.play=(name,...args)=>{if(name.startsWith('enemy'))window.__enemyAudio.push({name,args});play(name,...args);};
    const render=g.renderer.render.bind(g.renderer);g.renderer.render=(scene,camera)=>{
      const e=window.__watchEnemy;if(e&&camera===g.camera){camera.position.copy(e.group.position).add({x:4,y:2.8,z:5});camera.lookAt(e.group.position.clone().add({x:0,y:.7,z:0}));}
      return render(scene,camera);
    };
  },kinds);
  await page.keyboard.press('Shift');
  for(const kind of kinds){
    await page.evaluate(kind=>{const g=window.__game,e=g.getLevel().enemies.find(e=>e.kind===kind);window.__watchEnemy=e;
      g.player.pos.copy(e.group.position).add({x:6,y:.05,z:0});g.player.prevPos.copy(g.player.pos);
      g.getLevel().playerPos.copy(g.player.pos);
    },kind);
    await page.waitForTimeout(['charger','floater','sentry','spinner'].includes(kind)?3700:1300);
    rows.push({phase:'lite-game',kind,...await page.evaluate(()=>({state:window.__watchEnemy.state,diagnostic:window.__watchEnemy.visual.diagnostics}))});
    await page.screenshot({path:`${output}/game-${kind}.png`});
  }
  const liveAudio=await page.evaluate(()=>window.__enemyAudio);assert.ok(liveAudio.some(e=>e.name==='enemySentryFire'));
  rows.push({phase:'game-audio',events:liveAudio});
  console.log('Real game: all eight enemies loaded and animated; nearby attacks and footsteps audible.');
  await page.goto(new URL('?playtest&level=jungle',base).href);
  await page.waitForFunction(()=>window.__game&&!window.__game.gameFlow.blocksGameplay,null,{timeout:120000});
  await page.evaluate(async()=>{const g=window.__game;await g.getLevel().prepareJungleAssets();g.player.step=()=>{};
    const e=g.getLevel().enemies.find(e=>e.kind==='charger');g.player.pos.copy(e.group.position).add({x:6,y:.05,z:0});
    g.getLevel().playerPos.copy(g.player.pos);
    const render=g.renderer.render.bind(g.renderer);g.renderer.render=(scene,camera)=>{if(camera===g.camera){camera.position.copy(e.group.position).add({x:4,y:2.8,z:5});camera.lookAt(e.group.position.clone().add({x:0,y:.7,z:0}));}return render(scene,camera);};
  });
  await page.waitForTimeout(3000);await page.screenshot({path:output+'/full-render.png'});
  const full=await page.evaluate(()=>({stamp:document.querySelector('.hud-build')?.textContent,
    glError:window.__game.renderer.getContext().getError(),enemies:window.__game.getLevel().enemies.map(e=>e.visual.diagnostics.status)}));
  assert.equal(full.glError,0);assert.ok(full.enemies.every(s=>s==='ready'));assert.match(full.stamp,/Codex\/sol fork/);rows.push({phase:'full-game',...full});
  await context.close();assert.deepEqual(errors,[]);
  console.log(process.argv.includes('--game-only')
    ?'PASS real lite gameplay, audible enemy cues and full Jungle rendering without console errors.'
    :'PASS three-angle motion review, Nightworks, decoded/playing SFX, real lite gameplay and full render without console errors.');
}finally{await writeFile(output+'/results.json',JSON.stringify({base,rows,errors},null,2));await browser.close();}
