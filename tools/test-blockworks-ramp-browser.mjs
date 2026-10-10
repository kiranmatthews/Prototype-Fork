import assert from 'node:assert/strict';
import {readFile,mkdir,writeFile} from 'node:fs/promises';
const {chromium}=await import(process.env.PLAYWRIGHT_MODULE||'playwright');
const base=(process.argv.find(a=>/^https?:/.test(a))||'http://127.0.0.1:5367').replace(/\/$/,'');
const out=process.env.RAMP_BROWSER_OUTPUT||'/private/tmp/blockworks-ramp-browser';await mkdir(out,{recursive:true});
const take=JSON.parse(await readFile(new URL('./fixtures/blockworks-ramp-side-replay.json',import.meta.url),'utf8'));
const browser=await chromium.launch({headless:true,channel:'chrome'}),errors=[],results=[];
try{
 for(const lite of [true,false]){
  const page=await browser.newPage({viewport:{width:1440,height:900}});
  await page.addInitScript(()=>{navigator.getGamepads=()=>[];});
  page.on('pageerror',e=>errors.push(e.message));page.on('console',m=>{if(m.type()==='error')errors.push(m.text());});
  await page.goto(`${base}/?playtest&level=codex-lab${lite?'&lite':''}`,{timeout:120000});
  await page.waitForFunction(()=>window.__game&&!window.__game.gameFlow.blocksGameplay,null,{timeout:120000});
  await page.evaluate(async()=>{await window.__game.player.preparePresentationAssets();});
  const spawn=await page.evaluate(()=>({grounded:window.__game.player.grounded,y:window.__game.player.pos.y}));assert.equal(spawn.grounded,true);
  await page.evaluate(take=>{
   const g=window.__game,p=g.player,l=g.getLevel(),step=p.step.bind(p),consume=g.input.consumeEdges.bind(g.input);
   g.campaign.startEphemeral();p.enterLevel('codex-lab');p.endlessDeaths=true;p.respawn(l,true);
   const q=window.__rampReview={recording:true,done:false,budget:0,trace:[],sawDeath:false};
   g.input.consumeEdges=()=>{};
   p.step=(dt,input,level)=>{
    if(!q.recording&&q.budget<=0)return;
    step(dt,input,level);consume();
    const row={f:g.replayer.frame,p:p.pos.toArray(),state:p.state,g:p.grounded,bail:p.isBailing,ground:p.groundHit?.name};
    if(q.recording){q.trace.push(row);if(g.replayer.frame>=take.frames){g.replayer.end();q.recording=false;q.done=true;}}
    else q.budget--;
    if(p.state==='dead')q.sawDeath=true;
    if(p.state==='finished')q.budget=0;
   };
   g.replayer.begin(take);
  },take);
  await page.waitForFunction(()=>window.__rampReview.done,null,{timeout:90000});
  const replay=await page.evaluate(()=>window.__rampReview.trace);
  let pending=0,longest=0;for(const row of replay){pending=row.bail?pending+1:0;longest=Math.max(longest,pending);}
  assert.ok(longest<180,`replay recovery stuck: ${longest} frames`);
  assert.ok(!replay.at(-1).bail&&replay.at(-1).g,'replay must end recovered on ground');
  const stamp=await page.locator('.hud-build').textContent();assert.match(stamp,/Codex\/sol fork/);
  await page.screenshot({path:`${out}/${lite?'lite':'full'}-recovered.png`});
  results.push({lite,kind:'recorded-approach',spawn,longest,final:replay.at(-1),stamp});
  console.log(`${lite?'lite':'full'}: recorded approach escaped, longest recovery ${longest} frames`);
  const advance=async frames=>{
   await page.evaluate(frames=>{window.__rampReview.budget=frames;},frames);
   await page.waitForFunction(()=>window.__rampReview.budget===0,null,{timeout:30000});
   return page.evaluate(()=>{const p=window.__game.player;return{p:p.pos.toArray(),g:p.grounded,state:p.state,bail:p.isBailing,crawling:p.crawling};});
  };
  for(const crouch of [false,true]){
   const fixture=await page.evaluate(()=>{
    const g=window.__game,p=g.player,l=g.getLevel(),c=l.builtFromData.components.find(c=>c.nm==='Entry shelf access');
    const v=c.vertices,low=p.pos.clone().fromArray(c.p),high=low.clone();
    high.x+=(v[6]+v[9])/2;high.y+=v[7];high.z+=(v[8]+v[11])/2;
    const forward=high.clone().sub(low).setY(0).normalize(),right=forward.clone().set(-forward.z,0,forward.x);
    const centre=low.clone().lerp(high,.85).setY(low.y),start=centre.clone().addScaledVector(right,3.3);start.y+=.02;
    p.respawn(l,true,false,{position:start});
    window.__rampReview.centre=centre.toArray();window.__rampReview.right=right.toArray();
    return{centre:centre.toArray(),right:right.toArray(),width:2.4};
   });
   if(crouch)await page.keyboard.down('KeyQ');
   await page.keyboard.down('ArrowLeft');const side=await advance(crouch?240:90);
   await page.keyboard.up('ArrowLeft');if(crouch)await page.keyboard.up('KeyQ');await advance(10);
   const signed=(side.p[0]-fixture.centre[0])*fixture.right[0]+(side.p[2]-fixture.centre[2])*fixture.right[2];
   assert.ok(signed>fixture.width/2-.02,`native side entry penetrated ramp: ${JSON.stringify(side)}`);
   assert.ok(side.g&&!side.bail,'native side contact must stay supported and controllable');
   if(crouch)assert.equal(side.crawling,true,'native grab input must enter crouch');
   results.push({lite,kind:crouch?'crouched-side-entry':'walking-side-entry',side,signed});
   if(!lite)await page.screenshot({path:`${out}/full-${crouch?'crouch':'walk'}-side.png`});
  }
  if(!await page.evaluate(()=>window.__game.gameFlow.developerChromeVisible))await page.keyboard.press('KeyM');
  await page.keyboard.press('KeyL');const checkpoint=await advance(30);assert.equal(checkpoint.g,true);
  await page.evaluate(()=>{const g=window.__game,p=g.player;p.pos.y=g.getLevel().killY-2;p.prevPos.copy(p.pos);p.state='air';p.grounded=false;p.vVel=-5;});
  const respawn=await advance(240);assert.ok(respawn.g&&await page.evaluate(()=>window.__rampReview.sawDeath));
  await page.evaluate(()=>{const g=window.__game,p=g.player,l=g.getLevel(),position=l.finishGlow.getCenter(p.pos.clone());position.y+=.3;p.respawn(l,true,false,{position});});
  const finish=await advance(60);assert.equal(finish.state,'finished');
  results.push({lite,kind:'checkpoint-respawn-finish',checkpoint,respawn,finish});
  console.log(`${lite?'lite':'full'}: side contacts, checkpoint, respawn and finish passed`);
  await page.close();
 }
 assert.deepEqual(errors,[]);console.log('PASS recorded ramp recovery, native side entries, spawn, checkpoint, respawn and finish in lite/full Chrome; clean console.');
}finally{await writeFile(`${out}/report.json`,JSON.stringify({base,results,errors},null,2));await browser.close();}
