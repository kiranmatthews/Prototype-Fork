import assert from 'node:assert/strict';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {readFile,writeFile,mkdir} from 'node:fs/promises';
const {chromium}=await import(process.env.PLAYWRIGHT_MODULE??'playwright');
const base=(process.argv.find(a=>/^https?:/.test(a))??'http://127.0.0.1:5254').replace(/\/$/,'');
const full=process.argv.includes('--full'),output=process.env.LEVEL_POLISH_BROWSER??join(tmpdir(),'level-polish-browser');
const traces=process.env.LEVEL_POLISH_TRACES??join(tmpdir(),'level-polish-pilots');await mkdir(output,{recursive:true});
const cases=JSON.parse(await readFile(`${traces}/report.json`,'utf8')).filter(c=>c.pass&&(!process.env.POLISH_CASE||c.name.includes(process.env.POLISH_CASE)));
assert.ok(cases.length);
const browser=await chromium.launch({headless:true,channel:'chrome'}),reports=[];
try{const page=await browser.newPage({viewport:{width:1280,height:720}});let errors=[];
 page.on('pageerror',e=>errors.push(e.message));page.on('console',m=>{if(m.type()==='error')errors.push(m.text());});
 for(const item of cases){errors=[];const fixture=JSON.parse(await readFile(`${traces}/${item.name}.json`,'utf8'));
  await page.goto(`${base}/?playtest&level=${item.id}${full?'':'&lite'}`);
  await page.waitForFunction(()=>window.__game&&!window.__game.gameFlow.blocksGameplay&&window.__game.getLoadingDiagnostics().pending.length===0,null,{timeout:120000});
  await page.evaluate(f=>{
   const g=window.__game,p=g.player,l=g.getLevel();l.time=0;l.update(0);g.scene.updateMatrixWorld(true);
   p.endlessDeaths=true;p.respawn(l,true,false,{position:p.pos.clone().fromArray(f.start)});
   const q=window.__placementReplay={index:0,frames:f.inputs.length,inputs:f.inputs,done:false,states:[]};
   const step=p.step.bind(p),commit=p.commitRenderStep.bind(p);let advanced=false;
   p.step=(dt,input,level)=>{if(q.done)return;Object.assign(input,q.inputs[q.index]);step(dt,input,level);advanced=true;};
   p.commitRenderStep=(...args)=>{commit(...args);if(!advanced||q.done)return;advanced=false;q.index++;
    if(q.index%30===0)q.states.push({frame:q.index,state:p.state,p:p.pos.toArray(),deaths:p.totalDeaths});
    if(q.index>=q.frames){q.done=true;q.end={state:p.state,p:p.pos.toArray(),deaths:p.totalDeaths,bailing:p.isBailing,grounded:p.grounded,checkpoints:l.checkpoints.filter(c=>c.active).length};}
   };
  },fixture);
  await page.waitForFunction(()=>window.__placementReplay?.done,null,{timeout:Math.max(90000,fixture.frames/60*1500)});
  await page.waitForTimeout(300);
  const result=await page.evaluate(()=>({end:window.__placementReplay.end,states:window.__placementReplay.states,frames:window.__placementReplay.index}));
  result.stamp=await page.locator('.hud-build').textContent();result.name=item.name;result.errors=errors;
  await page.screenshot({path:`${output}/${item.name}.jpg`,type:'jpeg',quality:85});reports.push(result);
  await writeFile(`${output}/report.json`,JSON.stringify({base,full,reports},null,2));
  console.log(JSON.stringify({name:result.name,end:result.end,frames:result.frames,stamp:result.stamp,errors}));
  assert.deepEqual(errors,[],`${item.name} browser console`);
  assert.match(result.stamp,/Codex\/sol fork/);
  assert.equal(result.end.state,fixture.end.state,item.name+' end state');assert.equal(result.end.deaths,fixture.end.deaths,item.name+' death count');
  assert.equal(result.end.bailing,false,item.name+' bailing');
  assert.ok(Math.hypot(...result.end.p.map((v,i)=>v-fixture.end.position[i]))<.7,item.name+' replay deviated');
 }
}finally{await browser.close();}
console.log(`PASS ${reports.length} real-browser native fixed-step placement replays; clean consoles`);
