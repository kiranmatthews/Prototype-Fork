import assert from 'node:assert/strict';
import {mkdir,readFile,writeFile} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import ts from 'typescript';
import {runJungleFinale} from './jungle-finale-pilot.mjs';
const {chromium}=await import(process.env.PLAYWRIGHT_MODULE||'playwright');
const base=process.argv[2]||'http://127.0.0.1:5443/';
const out=process.env.JUNGLE_FINALE_OUT||join(tmpdir(),'jungle-finale');await mkdir(out,{recursive:true});
const source=await readFile(new URL('../src/levels/jungle-ruins-finale.ts',import.meta.url),'utf8');
const compiled=ts.transpileModule(source,{compilerOptions:{module:ts.ModuleKind.ESNext,target:ts.ScriptTarget.ES2022}}).outputText;
const {RUINS_SKATE_GAPS:gaps,RUINS_CLIMB_LEDGES:ledges}=await import('data:text/javascript;base64,'+Buffer.from(compiled).toString('base64'));
const browser=await chromium.launch({channel:'chrome',headless:true}),report={base,runs:[],errors:[]};
try{
 for(const mode of (process.env.JUNGLE_FINALE_MODES||'lite,full').split(',')){
  const context=await browser.newContext({viewport:{width:1440,height:900},serviceWorkers:'block'});
  const page=await context.newPage();page.on('pageerror',e=>report.errors.push({mode,error:e.message}));page.on('console',m=>{if(m.type()==='error')report.errors.push({mode,error:m.text()});});
  await page.goto(base+'?playtest&level=jungle'+(mode==='lite'?'&lite':''),{waitUntil:'domcontentloaded',timeout:180000});
  await page.waitForFunction(()=>window.__game&&!window.__game.gameFlow.blocksGameplay&&window.__game.player.grounded,null,{timeout:180000});
  assert.match(await page.locator('.hud-build').textContent(),/Codex\/sol fork/);
  if(process.env.JUNGLE_FINALE_VALIDATE_SOURCE==='1'){
    const valid=await page.evaluate(async url=>{const {normalizeCustomLevelData}=await import(url);return !!normalizeCustomLevelData(window.__game.getLevel().captureData());},new URL('src/level.ts',base).href);
    assert.ok(valid,'complete native source survives editor validation');report.sourceValidated=true;
  }
  const stage=async(p,heading=[0,0,-1])=>{
    await page.evaluate(({p,heading})=>{const g=window.__game;g.gameFlow.hide();g.player.respawn(g.getLevel(),true,true,{position:g.player.pos.clone().fromArray(p),heading:g.player.pos.clone().fromArray(heading)});g.player.endlessDeaths=true;},{p,heading});
    await page.waitForTimeout(900);
  };
  if(process.env.JUNGLE_FINALE_GALLERY==='1'){
    for(const [name,p,heading]of [
      ['runway',[0,.1,-774],[0,0,-1]],['first-jump',[0,2.8,-836],[0,0,-1]],
      ['turning-court',[0,.1,-1344],[0,0,-1]],['lower-climb',[33,4.5,-1360],[1,0,0]],
      ['upper-climb',[106,17.7,-1360],[1,0,0]],['summit',[175,26.5,-1360],[1,0,0]],
    ]){await stage(p,heading);await page.screenshot({path:`${out}/${mode}-${name}.png`});}
  }else{
    await stage([0,.1,-690]);
    await page.evaluate(({pilot,gaps,ledges})=>{
      const g=window.__game,p=g.player,l=g.getLevel();
      const r={p,l,frame:0,stage:'start',events:[]},generator=(0,eval)('('+pilot+')')(r,gaps,ledges);
      const step=p.step.bind(p),commit=p.commitRenderStep.bind(p);let last={},next=generator.next(),failed=null,done=false,advanced=false,completed=null;
      p.step=(dt,input,level)=>{
        if(done||failed)return step(dt,input,level);
        const request=next.value,s={...input,moveX:request.moveX??0,moveY:request.moveY??0};
        const magnitude=Math.hypot(s.moveX,s.moveY);if(magnitude>1){s.moveX/=magnitude;s.moveY/=magnitude;}
        s.moveX=Math.round(s.moveX*100)/100;s.moveY=Math.round(s.moveY*100)/100;
        for(const k of ['jump','grind','spin','grab','transfer']){s[k+'Held']=!!request[k+'Held'];s[k+'Pressed']=s[k+'Held']&&!last[k+'Held'];}
        s.jumpReleased=request.jumpReleased??(!s.jumpHeld&&!!last.jumpHeld);s.restartPressed=false;last={...s};step(dt,s,level);advanced=true;
      };
      p.commitRenderStep=(...args)=>{
        commit(...args);if(done||failed||!advanced)return;advanced=false;r.frame++;
        try{next=generator.next();done=next.done;if(done){r.events=next.value;completed={position:p.pos.toArray(),state:p.state,deaths:p.totalDeaths,checkpoints:l.checkpoints.filter(c=>c.active&&c.spawnPos.z<-690).length};}if(r.frame>16000)failed='route timeout';}catch(error){failed=String(error);}
      };
      window.__finale={get status(){return{frame:r.frame,stage:r.stage,events:r.events,...(completed??{position:p.pos.toArray(),state:p.state,deaths:p.totalDeaths}),done,failed};},restore(){p.step=step;p.commitRenderStep=commit;}};
    },{pilot:runJungleFinale.toString(),gaps,ledges});
    const seen=new Set();
    for(let n=0;n<600;n++){
      await page.waitForTimeout(1000);const s=await page.evaluate(()=>window.__finale.status);
      if(!seen.has(s.stage)){seen.add(s.stage);console.log(mode,s.stage,JSON.stringify(s.position));}
      if(['clear gap 2','climb ledge 4','climb ledge 9','cross the summit finish'].includes(s.stage)&&!seen.has('shot:'+s.stage)){
        seen.add('shot:'+s.stage);await page.screenshot({path:`${out}/${mode}-${s.stage.replaceAll(' ','-')}.png`});
      }
      if(s.failed){await page.screenshot({path:`${out}/${mode}-failure.png`});report.runs.push({mode,...s});throw Error(s.failed);}
      if(s.done){assert.equal(s.state,'finished');assert.equal(s.deaths,0);assert.equal(s.checkpoints,5);report.runs.push({mode,...s});await page.screenshot({path:`${out}/${mode}-finish.png`});break;}
      if(n===599)throw Error('Browser route timeout');
    }
    await page.evaluate(()=>window.__finale.restore());
    const recovery=[];
    for(const [name,position]of [['aqueduct pit',[0,3,-853]],['climbing pit',[114,12,-1360]]]){
      const before=await page.evaluate(position=>{const g=window.__game,p=g.player,l=g.getLevel();g.gameFlow.hide();
        p.respawn(l,false,true,{position:p.pos.clone().fromArray(position),heading:p.pos.clone().set(1,0,0)});
        return {snap:p.renderSnapVersion,spawn:l.currentSpawn.toArray()};},position);
      await page.waitForFunction(()=>window.__game.player.state==='dead',null,{timeout:45000});
      await page.waitForFunction(s=>{const p=window.__game.player;return p.renderSnapVersion>s&&p.grounded&&p.state==='ride';},before.snap,{timeout:45000});
      const after=await page.evaluate(()=>window.__game.player.pos.toArray());
      assert.ok(Math.hypot(...after.map((v,i)=>v-before.spawn[i]))<3,name+' returns to the earned checkpoint');recovery.push({name,before,after});
    }
    const x=await page.evaluate(()=>window.__game.player.pos.x);await page.keyboard.down('ArrowRight');
    await page.waitForFunction(x=>window.__game.player.pos.x>x+.9,x,{timeout:20000});await page.keyboard.up('ArrowRight');
    assert.ok(await page.evaluate(()=>window.__game.player.grounded),'right-arrow walking stays supported in the climbing section');
    report.runs.at(-1).recovery=recovery;
  }
  await context.close();
 }
 assert.deepEqual(report.errors,[]);console.log('PASS Jungle finale real-browser review');
}finally{await writeFile(out+'/browser.json',JSON.stringify(report,null,2)+'\n');await browser.close();}
