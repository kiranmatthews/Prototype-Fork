import assert from 'node:assert/strict';
import { mkdir, writeFile } from 'node:fs/promises';
import { runChiefJourney } from './crab-chief-pilot.mjs';
import { chiefInput } from './crab-chief-harness-browser.mjs';
const { chromium } = await import(process.env.PLAYWRIGHT_MODULE || 'playwright');
const base=process.argv[2]||'http://127.0.0.1:5187/';
const output=process.env.CHIEF_REVIEW_OUTPUT||'/private/tmp/chief-browser';
await mkdir(output,{recursive:true});
const browser=await chromium.launch({headless:true,channel:'chrome',args:['--disable-features=LocalNetworkAccessChecks']});
const results=[],errors=[];
try {
  for(const lite of [true,false]){
    const page=await browser.newPage({viewport:{width:1440,height:900}});
    page.on('pageerror',e=>errors.push(String(e)));
    page.on('console',m=>{if(m.type()==='error')errors.push(m.text());});
    const url=new URL(base);url.search=`?playtest&level=crab-chief${lite?'&lite':''}`;
    await page.goto(url.href);
    await page.waitForFunction(()=>window.__game?.getLevel()?.boss&&!window.__game.gameFlow.blocksGameplay,null,{timeout:120000});
    await page.evaluate(async()=>{const g=window.__game;await Promise.all([g.player.preparePresentationAssets(),g.getLevel().prepareJungleAssets()]);});
    const stamp=await page.locator('.hud-build').textContent();assert.match(stamp,/Codex\/sol fork/);
    await page.evaluate(({pilotSource,inputSource})=>{
      const pilot=new Function(`return (${pilotSource})`)(),sampleInput=new Function(`return (${inputSource})`)();
      const g=window.__game,p=g.player,l=g.getLevel(),boss=l.boss;
      const report=window.chiefBrowser={done:false,failed:null,frame:0,stage:'arrival',result:null,framing:[],maxTurn:0};
      const context={p,l,stage:'arrival'},generator=pilot(context);
      let next=generator.next(),last={},advanced=false,previousYaw=null;
      const native=p.step.bind(p),commit=p.commitRenderStep.bind(p);
      report.resume=()=>{p.step=native;p.commitRenderStep=commit;};
      p.step=(dt,input,level)=>{
        if(report.done)return;
        try{
          const world=next.value??{},device=p.state==='grind'?world:{...world,...p.bossInputForWorld(world.moveX??0,-(world.moveY??0))};
          const sample=sampleInput(device,last);last={...sample};Object.assign(input,sample);native(dt,input,level);advanced=true;
        }catch(error){report.failed=String(error);report.done=true;}
      };
      p.commitRenderStep=(...args)=>{
        commit(...args);if(!advanced||report.done)return;advanced=false;report.frame++;report.stage=context.stage;
        const yaw=Math.atan2(p.camDir.x,p.camDir.z);
        if(previousYaw!==null)report.maxTurn=Math.max(report.maxTurn,Math.abs(Math.atan2(Math.sin(yaw-previousYaw),Math.cos(yaw-previousYaw)))*180/Math.PI);
        previousYaw=yaw;
        if(report.frame%30===0){
          g.camera.updateMatrixWorld(true);
          const point=p.pos.clone().add({x:0,y:1,z:0}).project(g.camera);
          report.framing.push({frame:report.frame,phase:boss.phase,state:boss.state,point:point.toArray()});
        }
        try{next=generator.next();if(next.done){report.done=true;report.result=next.value;}}
        catch(error){report.failed=String(error);report.done=true;}
      };
    },{pilotSource:runChiefJourney.toString(),inputSource:chiefInput.toString()});
    await page.waitForFunction(()=>window.chiefBrowser?.done||(window.__game.getLevel().boss.phase===3&&window.__game.getLevel().boss.health===2),null,{timeout:240000});
    await page.screenshot({path:`${output}/${lite?'lite':'full'}-sand-hit.png`});
    await page.waitForFunction(()=>window.chiefBrowser?.done,null,{timeout:240000});
    const fight=await page.evaluate(()=>{const r=window.chiefBrowser;return{failed:r.failed,frame:r.frame,result:r.result,maxTurn:r.maxTurn,framing:r.framing};});
    assert.equal(fight.failed,null);assert.equal(fight.result.hits,9);assert.equal(fight.result.playerHits,0);
    await page.screenshot({path:`${output}/${lite?'lite':'full'}-victory.png`});
    console.log(JSON.stringify({lite,stage:'fight passed',frames:fight.frame,hits:fight.result.hits}));
    // A fresh page avoids the completed run's pending results transition.
    await page.goto(url.href);
    await page.waitForFunction(()=>window.__game?.getLevel()?.boss&&!window.__game.gameFlow.blocksGameplay,null,{timeout:120000});
    await page.evaluate(async()=>{const g=window.__game;await Promise.all([g.player.preparePresentationAssets(),g.getLevel().prepareJungleAssets()]);});
    // The input-only journey owns complete traversal. This separately staged
    // late-fight lagoon fall exercises real death/fade/respawn in the bundle.
    await page.evaluate(()=>{
      const g=window.__game,p=g.player,l=g.getLevel();
      g.campaign.startEphemeral();g.gameFlow.hide();p.onFinish=()=>{};
      p.respawn(l,true,false,{position:p.pos.clone().set(48,2,14)});
      l.boss.phase=3;l.boss.health=1;l.boss.state='ramp-open';l.boss.rampFormed=true;l.boss.present(0);
      p.endlessDeaths=false;window.chiefDeathSeen=false;
      const step=p.step.bind(p);p.step=(dt,input,level)=>{step(dt,input,level);if(p.state==='dead')window.chiefDeathSeen=true;};
    });
    await page.waitForFunction(()=>window.chiefDeathSeen&&window.__game.player.state==='ride',null,{timeout:30000});
    const retry=await page.evaluate(()=>{const g=window.__game,p=g.player,b=g.getLevel().boss;return{phase:b.phase,health:b.health,lives:p.lives,masks:p.masks,pos:p.pos.toArray(),ramp:b.phaseGeometry.rampActive,tongue:b.phaseGeometry.tongueActive};});
    assert.equal(retry.phase,1);assert.equal(retry.health,9);assert.equal(retry.lives,3);assert.equal(retry.masks,2);
    assert.equal(retry.ramp,false);assert.equal(retry.tongue,false);
    await page.screenshot({path:`${output}/${lite?'lite':'full'}-retry.png`});
    // Genuine held keyboard movement must stay in the visible screen frame.
    const before=await page.evaluate(()=>window.__game.player.pos.toArray());
    await page.keyboard.down('KeyD');await page.waitForTimeout(650);await page.keyboard.up('KeyD');
    const after=await page.evaluate(()=>window.__game.player.pos.toArray());
    assert.ok(after[0]>before[0]+1,'held keyboard right failed after the retry');
    // Reproduce the original early-ollie failure using native keyboard events.
    await page.evaluate(()=>{
      const g=window.__game,p=g.player,l=g.getLevel();
      p.respawn(l,true,false,{position:p.pos.clone().set(0,.12,7)});
      l.boss.phase=3;l.boss.health=3;l.boss.state='ramp-open';l.boss.rampFormed=true;l.boss.present(0);
    });
    await page.keyboard.down('KeyW');await page.keyboard.down('Space');
    await page.waitForFunction(()=>window.__game.player.pos.z<-13,null,{timeout:10000});
    await page.keyboard.up('Space');
    await page.waitForFunction(()=>window.__game.player.pos.z<-19,null,{timeout:5000});
    await page.keyboard.press('KeyF');
    await page.waitForFunction(()=>window.__game.getLevel().boss.health===2,null,{timeout:5000});
    await page.keyboard.up('KeyW');
    const earlyJump=await page.evaluate(()=>({strike:window.__game.getLevel().boss.strikes[0],pos:window.__game.player.pos.toArray()}));
    assert.equal(earlyJump.strike.kind,'sand-spin');
    await page.screenshot({path:`${output}/${lite?'lite':'full'}-early-ollie.png`});
    results.push({lite,stamp,...fight,retry,earlyJump,keyboardDisplacement:after.map((v,i)=>v-before[i])});
    console.log(JSON.stringify({lite,stamp,frames:fight.frame,hits:fight.result.hits,maxTurn:fight.maxTurn,retry}));
    await page.close();
  }
  assert.deepEqual(errors,[]);
}finally{await writeFile(`${output}/results.json`,JSON.stringify({base,results,errors},null,2));await browser.close();}
console.log('PASS production browser: lite/full nine-hit fights, lagoon death resets, held keyboard right, native early ollie, build stamps and clean consoles.');
