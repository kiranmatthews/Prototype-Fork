import assert from 'node:assert/strict';
import {mkdir,readFile,writeFile} from 'node:fs/promises';
import {gunzipSync} from 'node:zlib';
const {chromium}=await import(process.env.PLAYWRIGHT_MODULE||'playwright');
const base=process.argv[2]||'http://127.0.0.1:5187/';
const lite=process.argv.includes('--lite');
const output=process.env.SKYSTREAM_DROP_OUTPUT||'/private/tmp/skystream-drop-browser';
const native=JSON.parse(await readFile(process.env.SKYSTREAM_DROP_NATIVE||'/private/tmp/skystream-drop-camera-fixed/native.json','utf8'));
const replay=JSON.parse(gunzipSync(await readFile(new URL('./fixtures/skystream-drop-replay.json.gz',import.meta.url))));
await mkdir(output,{recursive:true});
const browser=await chromium.launch({headless:true,channel:'chrome'}),errors=[],cuts=[];
let replaySamples=[],stamp;
try{
  const page=await browser.newPage({viewport:{width:1600,height:1000},deviceScaleFactor:1,serviceWorkers:'block'});
  page.on('pageerror',e=>errors.push(e.message));page.on('console',m=>{if(m.type()==='error')errors.push(m.text());});
  const url=new URL(base);url.search=`?playtest&level=skystream${lite?'&lite':''}`;
  await page.goto(url.href,{waitUntil:'domcontentloaded',timeout:180000});
  await page.waitForFunction(()=>window.__game&&!window.__game.gameFlow.blocksGameplay,null,{timeout:180000});
  stamp=await page.locator('.hud-build').textContent();assert.match(stamp,/Codex\/sol fork/);
  await page.evaluate(replay=>{
    const g=window.__game;g.loadReplay(replay);g.gameFlow.hide();
    g.renderQualitySettings.setRegularResolution(null);g.crtGuestSettings.setEnabled(false);
    const p=g.player,l=g.getLevel(),input={consumeEdges(){}};
    // Exact earlier input; render the approach, departure, rescue and catch.
    for(let i=0;i<3600;i++){
      g.replayer.feed(input,p.camDir);p.step(1/60,input,l);l.update(1/60);p.flushLevelCrateRewards(l);p.commitRenderStep(l);
    }
    p.collapseRenderInterpolation();
    const review=window.__dropReview={samples:[],done:false};
    const restore=p.restoreRenderPose.bind(p),step=p.step.bind(p);
    window.__dropNative={restore,step};
    p.restoreRenderPose=()=>{
      if(!review.done){
        const f=g.replayer.frame,eye=g.camera.position.toArray(),ndc=p.renderPosition.clone().add(p.pos.clone().set(0,1.3,0)).project(g.camera);
        review.samples.push({f,eye,ndc:ndc.toArray(),p:p.pos.toArray(),state:p.state,grounded:p.grounded});
        if(f>=3820)review.done=true;
      }
      restore();
    };
  },replay);
  for(const f of [3720,3765]){
    await page.waitForFunction(f=>window.__game.replayer.frame>=f,f,{timeout:60000});
    await page.screenshot({path:`${output}/replay-${f}.png`});
  }
  await page.waitForFunction(()=>window.__dropReview.done,null,{timeout:60000});
  replaySamples=await page.evaluate(()=>window.__dropReview.samples);
  const problem=replaySamples.filter(s=>s.f>=3701&&s.f<=3741);
  assert.ok(problem.length>=12,'Reported replay jump was not rendered');
  assert.ok(problem.every(s=>Math.abs(s.ndc[0])<1&&Math.abs(s.ndc[1])<1),'Replay lost the rider');
  let frozen=0;
  for(let i=1;i<problem.length;i++)if(problem[i].eye.every((v,k)=>v===problem[i-1].eye[k]))frozen++;
  assert.equal(frozen,0,'Replay still freezes through the recoverable drop');
  await page.evaluate(()=>{const g=window.__game;g.replayer.end();g.player.restoreRenderPose=window.__dropNative.restore;g.switchLevel('skystream');g.gameFlow.hide();});
  for(const [index,cut] of native.cuts.entries()){
    await page.evaluate(cut=>{
      const g=window.__game,p=g.player,l=g.getLevel(),r=window.__dropReview={samples:[],frame:0,done:false,air:false,landing:null};
      p.respawn(l,true,false,{position:p.pos.clone().fromArray(cut.start).add(p.pos.clone().set(0,.1,0)),heading:p.pos.clone().fromArray(cut.heading)});
      p.step=(dt,input,level)=>{
        if(r.done)return;
        const sample=cut.inputs[r.frame];
        if(!sample){r.done=true;return;}
        p.camDir.set(Math.sin(sample.yaw),0,Math.cos(sample.yaw));
        window.__dropNative.step(dt,{...input,...sample},level);r.frame++;
        if(!p.grounded)r.air=true;
        if(r.air&&p.grounded&&p.pos.y<cut.start[1]-12){r.landing=p.pos.toArray();r.done=true;}
        if(p.isBailing||['dead','gameover'].includes(p.state)){r.failure=p.state;r.done=true;}
      };
      p.restoreRenderPose=()=>{
        const ndc=p.renderPosition.clone().add(p.pos.clone().set(0,1.3,0)).project(g.camera);
        let minY=Infinity,maxY=-Infinity;
        const bounds=p.cameraPoseBounds;
        if(bounds)for(const x of [bounds.min.x,bounds.max.x])for(const y of [bounds.min.y,bounds.max.y])for(const z of [bounds.min.z,bounds.max.z]){
          const q=p.pos.clone().set(x,y,z).project(g.camera);minY=Math.min(minY,q.y);maxY=Math.max(maxY,q.y);
        }
        if(!r.done||r.landing)r.samples.push({f:r.frame,eye:g.camera.position.toArray(),ndc:ndc.toArray(),minY,maxY,p:p.pos.toArray(),state:p.state,grounded:p.grounded});
        window.__dropNative.restore();
      };
    },cut);
    const flight=cut.rows.filter(row=>!row.grounded);
    const midway=flight[Math.floor(flight.length*.65)].f;
    await page.waitForFunction(f=>window.__dropReview.frame>=f||window.__dropReview.done,midway,{timeout:60000});
    await page.screenshot({path:`${output}/shortcut-${index+1}-drop.png`});
    await page.waitForFunction(()=>window.__dropReview.done,null,{timeout:60000});
    await page.waitForTimeout(350);
    await page.screenshot({path:`${output}/shortcut-${index+1}-landing.png`});
    const result=await page.evaluate(()=>window.__dropReview);cuts.push({name:cut.name,...result});
    assert.ok(result.landing&&!result.failure,`${cut.name}: did not land (${result.failure})`);
    const airborne=result.samples.filter(s=>!s.grounded);
    assert.ok(airborne.length>=20,cut.name+': insufficient rendered flight');
    assert.ok(airborne.every(s=>Math.abs(s.ndc[0])<1&&Math.abs(s.ndc[1])<1),cut.name+': rider left frame');
    const touchdown=result.samples.filter(s=>s.f===result.frame&&s.grounded);
    assert.ok(touchdown.length>=5&&touchdown.every(s=>s.minY>=-1&&s.maxY<=1),cut.name+': touchdown cropped the rider');
  }
  if(!lite){
    await page.evaluate(()=>{window.__game.renderQualitySettings.setRegularResolution(720);window.__game.crtGuestSettings.setEnabled(true);});
    await page.screenshot({path:`${output}/landing-normal.png`});
  }
  assert.deepEqual(errors,[]);
}finally{
  await writeFile(`${output}/report.json`,JSON.stringify({base,lite,stamp,replaySamples,cuts,errors}));
  await browser.close();
}
console.log(JSON.stringify({base,lite,stamp,replayFrames:replaySamples.length,cuts:cuts.map(c=>({name:c.name,frames:c.frame,landing:c.landing})),errors}));
