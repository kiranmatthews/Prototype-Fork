import assert from 'node:assert/strict';
import {mkdir,writeFile} from 'node:fs/promises';
import {resolve} from 'node:path';
const {chromium}=await import(process.env.PLAYWRIGHT_MODULE||'playwright');
const base=process.argv.find(v=>v.startsWith('http'))||'http://127.0.0.1:5318';
const journey=process.argv.includes('--journey'),bonus=process.argv.includes('--bonus'),full=process.argv.includes('--full');
const smoke=process.argv.includes('--smoke');
const selectedViews=process.argv.find(v=>v.startsWith('--views='))?.slice(8).split(',');
const out=process.env.BANANA_BAY_OUTPUT||resolve('docs/banana-bay/evidence');await mkdir(out,{recursive:true});
const browser=await chromium.launch({headless:true,channel:'chrome'}),errors=[],failed=[];
const page=await browser.newPage({viewport:{width:1600,height:1000},deviceScaleFactor:1});
page.setDefaultTimeout(90000);
page.on('pageerror',e=>errors.push(e.message));
page.on('console',m=>{if(m.type()==='error')errors.push(m.text());});
page.on('requestfailed',r=>{if(!r.failure()?.errorText?.includes('ERR_ABORTED'))failed.push({url:r.url(),error:r.failure()?.errorText});});
await page.addInitScript(()=>{localStorage.setItem('solProtoCloudPulled','1');});
try{
  const id=bonus?'bonus-beachside-run':'beachfront';
  await page.goto(`${base}/?playtest&level=${id}${full?'':'&lite'}`);
  await page.waitForFunction(()=>window.__game&&!window.__game.gameFlow.blocksGameplay,null,{timeout:120000});
  await page.evaluate(async()=>{
    const g=window.__game,l=g.getLevel();await Promise.all([l.prepareJungleAssets(),l.prepareSurfaceImages()]);
    g.renderQualitySettings.setRegularResolution(null);
  });
  if(smoke){
    assert.equal(bonus,false,'lifecycle smoke starts in the parent course');
    const report={cases:[],errors,failed};
    const snapshot=()=>page.evaluate(()=>{const g=window.__game,p=g.player,l=g.getLevel();return {
      id:g.getCurrentLevel().id,p:p.pos.toArray(),state:p.state,grounded:p.grounded,deaths:p.totalDeaths,lives:p.lives,
      checkpoint:l.activeCheckpoint?.spawnPos.toArray()??null,spawn:l.currentSpawn.toArray(),bonusDone:l.bonusRoundCompleted,
    };});
    await page.waitForFunction(()=>window.__game.player.grounded);
    const start=await snapshot();
    await page.keyboard.down('ArrowUp');await page.waitForTimeout(500);await page.keyboard.up('ArrowUp');
    const moved=await snapshot();assert.ok(Math.hypot(moved.p[0]-start.p[0],moved.p[2]-start.p[2])>1,'real keyboard movement');
    report.cases.push({name:'supported spawn and keyboard movement',start,end:moved});
    await page.evaluate(()=>{
      const g=window.__game,l=g.getLevel(),cp=l.checkpoints[0],V=g.player.pos.constructor;
      g.player.respawn(l,true,false,{position:cp.spawnPos.clone().add(new V(0,.08,1.2)),heading:new V(0,0,-1)});
    });
    await page.waitForFunction(()=>window.__game.player.grounded);
    await page.keyboard.down('f');
    await page.waitForFunction(()=>window.__game.getLevel().checkpoints[0].active,null,{timeout:30000});
    await page.keyboard.up('f');
    report.cases.push({name:'checkpoint hit with keyboard spin',end:await snapshot()});
    console.log('SMOKE',JSON.stringify(report.cases.at(-1)));
    await page.evaluate(()=>{const g=window.__game;for(let i=0;i<20&&g.player.warpCheckpoint(g.getLevel(),1);i++);});
    await page.waitForFunction(()=>window.__game.player.grounded);
    const bank=await snapshot();assert.ok(bank.checkpoint&&bank.p[2]<-1290);
    await page.keyboard.down('ArrowUp');
    await page.waitForFunction(()=>window.__game.player.pos.y<0,null,{timeout:30000});
    await page.keyboard.up('ArrowUp');
    await page.waitForFunction(()=>window.__game.player.state==='dead',null,{timeout:30000});
    const fallen=await snapshot();
    try{await page.waitForFunction(()=>{const p=window.__game.player;return p.grounded&&p.state==='ride';},null,{timeout:30000});}
    catch(e){console.log('RECOVERY DIAGNOSTIC',JSON.stringify({bank,end:await snapshot(),ui:await page.locator('body').innerText()}));throw e;}
    const recovered=await snapshot();assert.ok(Math.hypot(recovered.p[0]-bank.spawn[0],recovered.p[2]-bank.spawn[2])<1);
    assert.ok(recovered.deaths===bank.deaths+1||recovered.lives===bank.lives-1,'one recorded fall in Modern or Retro mode');
    report.cases.push({name:'walk into lagoon gap and recover at banked checkpoint',start:bank,fallen,end:recovered});
    console.log('SMOKE',JSON.stringify(report.cases.at(-1)));
    await page.evaluate(async()=>{
      const g=window.__game,{SUNNY_BEACH_LEVEL}=await import('/src/levels/sunny-beach.ts'),pad=SUNNY_BEACH_LEVEL.components.find(c=>c.t==='bonusplatform'),V=g.player.pos.constructor;
      g.player.respawn(g.getLevel(),true,false,{position:new V(...pad.to).add(new V(0,.08,0)),heading:new V(0,0,-1)});
    });
    await page.waitForFunction(()=>window.__game.player.grounded);
    const beforeBonus=await snapshot();await page.evaluate(()=>window.__game.enterBonusRound());
    await page.waitForFunction(()=>window.__game.getCurrentLevel().id==='bonus:beachfront'&&!window.__game.gameFlow.blocksGameplay,null,{timeout:120000});
    const entered=await snapshot();assert.ok(entered.grounded);
    await page.evaluate(()=>window.__game.returnFromBonus(false));
    await page.waitForFunction(()=>window.__game.getCurrentLevel().id==='beachfront'&&!window.__game.gameFlow.blocksGameplay,null,{timeout:120000});
    await page.waitForFunction(()=>window.__game.player.grounded);
    const returned=await snapshot();assert.equal(returned.bonusDone,false);assert.equal(returned.deaths,beforeBonus.deaths);
    assert.ok(Math.hypot(returned.p[0]-beforeBonus.p[0],returned.p[2]-beforeBonus.p[2])<1);
    report.cases.push({name:'parent bonus entry and failed-bonus return preserve the parent',before:beforeBonus,entered,returned});
    await page.screenshot({path:`${out}/lifecycle-${full?'full':'lite'}.jpg`,type:'jpeg',quality:85});
    await writeFile(`${out}/lifecycle-${full?'full':'lite'}.json`,JSON.stringify(report,null,2));
    console.log('PASS',JSON.stringify(report));
  }else if(journey){
    await page.evaluate(async bonus=>{
      const g=window.__game,p=g.player,l=g.getLevel();
      const sourceModule=await import('/src/levels/sunny-beach.ts'),route=await import('/src/levels/banana-bay-route.ts');
      const {resolveBonusLevel}=await import('/src/levels/themed-bonuses.ts'),{CONST}=await import('/src/tuning.ts');
      const {runBananaBay}=await import('/tools/banana-bay-pilot.mjs');
      const {runSwitchyardJourney}=await import('/tools/puzzle-switchyard-pilot.mjs');
      const source=bonus?resolveBonusLevel('beachfront'):sourceModule.SUNNY_BEACH_LEVEL;
      const report=window.bayReview={frame:0,done:false,failed:null,stage:'start',actions:[],evidence:[],samples:[]};
      const fields=['moveX','moveY','jumpHeld','jumpPressed','jumpReleased','grindHeld','grindPressed','spinHeld','spinPressed','grabHeld','grabPressed','transferHeld','transferPressed','restartPressed'];
      let last={},advanced=false;
      const normalize=sample=>{
        const input=Object.fromEntries(fields.map(k=>[k,k==='moveX'||k==='moveY'?0:false]));Object.assign(input,sample);
        const len=Math.hypot(input.moveX,input.moveY);if(len>1){input.moveX/=len;input.moveY/=len;}
        input.moveX=Math.round(input.moveX*100)/100;input.moveY=Math.round(input.moveY*100)/100;
        for(const held of ['jumpHeld','grindHeld','spinHeld','grabHeld','transferHeld'])if(!(held.replace('Held','Pressed') in sample))input[held.replace('Held','Pressed')]=!!input[held]&&!last[held];
        if(!('jumpReleased' in sample))input.jumpReleased=!input.jumpHeld&&!!last.jumpHeld;
        return input;
      };
      const snapshot=()=>({frame:report.frame,p:p.pos.toArray(),state:p.state,grounded:p.grounded,deaths:p.totalDeaths,cratesBroken:p.cratesBroken,ground:p.groundHit?.name});
      const context={p,l,source,sourceModule,route,report,trace:[],dt:CONST.fixedStep,TUNING:g.TUNING,get frame(){return report.frame;}};
      const generator=(bonus?runSwitchyardJourney:runBananaBay)(context);let pending=generator.next();
      const step=p.step.bind(p),commit=p.commitRenderStep.bind(p);
      p.step=(dt,input,level)=>{
        if(report.done)return;
        try{last=normalize(pending.value??{});Object.assign(input,last);step(dt,input,level);advanced=true;}
        catch(e){report.failed={message:String(e),snapshot:snapshot()};report.done=true;}
      };
      p.commitRenderStep=(...args)=>{
        commit(...args);if(!advanced||report.done)return;advanced=false;report.frame++;
        if(report.frame%30===0)report.samples.push(snapshot());
        try{pending=generator.next();if(pending.done){report.done=true;report.result=pending.value;report.end=snapshot();}}
        catch(e){report.failed={message:String(e),snapshot:snapshot()};report.done=true;}
      };
    },bonus);
    const captured=new Set();
    for(let i=0;i<3600;i++){
      await page.waitForTimeout(500);
      const s=await page.evaluate(()=>({done:window.bayReview.done,frame:window.bayReview.frame,stage:window.bayReview.stage,p:window.__game.player.pos.toArray()}));
      const bucket=bonus?Math.floor(s.p[0]/67):Math.floor(-s.p[2]/300);
      if(!captured.has(bucket)&&bucket>=0&&s.frame>45){await page.screenshot({path:`${out}/${id}-${bucket}-${full?'full':'lite'}.jpg`,type:'jpeg',quality:85});captured.add(bucket);}
      if(i%60===0)console.log(JSON.stringify(s));
      if(s.done)break;
    }
    const report=await page.evaluate(()=>window.bayReview);
    await writeFile(`${out}/${id}-${full?'full':'lite'}-journey.json`,JSON.stringify({...report,errors,failedRequests:failed},null,2));
    await page.screenshot({path:`${out}/${id}-finish-${full?'full':'lite'}.jpg`,type:'jpeg',quality:85});
    console.log(JSON.stringify({done:report.done,failed:report.failed,result:report.result,errors,failedRequests:failed}));
    assert.ok(report.done);assert.equal(report.failed,null);assert.equal(report.end.state,'finished');
  }else{
    const views=bonus?[
      {name:'bonus-arrival',p:[2,.1,0]},
      {name:'bonus-high-cargo',p:[68,.1,0]},
      {name:'bonus-wharf',p:[132,.1,0]},
    ]:[
      {name:'main-arrival',distance:25},
      {name:'main-split-pier',distance:155},
      {name:'main-high-parcel',distance:180},
      {name:'main-cargo-lane',distance:448},
      {name:'main-ferry',finale:114},
      {name:'main-breakwater',finale:161},
      {name:'main-finish',finale:230},
    ];
    const evidence=[];
    for(const view of views.filter(v=>!selectedViews||selectedViews.includes(v.name))){
      const before=await page.evaluate(async view=>{
        const g=window.__game,l=g.getLevel(),p=g.player;
        const {bayCoastPoint,bayFinalePoint}=await import('/src/levels/banana-bay-route.ts');
        const {Vector3,Raycaster}=await import('/node_modules/three/build/three.module.js');
        const q=view.distance!==undefined?bayCoastPoint(view.distance):view.finale!==undefined?bayFinalePoint(view.finale):view.p;
        // Isolated visual starts are explicit: they are not traversal evidence.
        const probe=new Raycaster(new Vector3(q[0],30,q[2]),new Vector3(0,-1,0),0,100),hit=l.raycastGround(probe)[0];
        p.respawn(l,true,false,{position:new Vector3(q[0],(hit?.point.y??q[1])+.06,q[2]),heading:new Vector3(0,0,-1)});
        return {name:view.name,target:q,top:hit?.point.y};
      },view);
      await page.waitForTimeout(1700);
      await page.screenshot({path:`${out}/${view.name}-${full?'full':'lite'}-native.jpg`,type:'jpeg',quality:90});
      const native=await page.evaluate(()=>{
        const g=window.__game;return {p:g.player.pos.toArray(),grounded:g.player.grounded,state:g.player.state,
          resolution:g.renderQualitySettings.regularResolution,enabled:g.renderQualitySettings.enabled,
          sizes:g.getRenderQualitySizes(),drawingBuffer:[g.renderer.domElement.width,g.renderer.domElement.height],viewport:[innerWidth,innerHeight],dpr:devicePixelRatio};
      });
      assert.equal(native.enabled,false);assert.equal(native.resolution,'max');
      assert.equal(native.drawingBuffer[0],Math.round(native.viewport[0]*(full?1:.5))*native.dpr);
      assert.equal(native.drawingBuffer[1],Math.round(native.viewport[1]*(full?1:.5))*native.dpr);
      await page.evaluate(()=>window.__game.renderQualitySettings.setRegularResolution(720));
      await page.waitForTimeout(500);
      await page.screenshot({path:`${out}/${view.name}-${full?'full':'lite'}-normal.jpg`,type:'jpeg',quality:85});
      await page.evaluate(()=>window.__game.renderQualitySettings.setRegularResolution(null));
      evidence.push({...before,...native});
    }
    await writeFile(`${out}/${id}-${full?'full':'lite'}-${selectedViews?'extra-views':'views'}.json`,JSON.stringify({evidence,errors,failed},null,2));
    console.log(JSON.stringify({evidence,errors,failed}));
  }
  assert.deepEqual(errors,[],'browser console');assert.deepEqual(failed,[],'failed asset requests');
}finally{await browser.close();}
