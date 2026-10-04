import assert from 'node:assert/strict';
import {mkdir,readFile,writeFile} from 'node:fs/promises';
const {chromium}=await import(process.env.PLAYWRIGHT_MODULE||'/Users/kiki/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright/index.mjs');
const base=process.argv.find(arg=>/^http/.test(arg))||'http://127.0.0.1:5189/';
const full=process.argv.includes('--full'),output='/private/tmp/splat-valley-review';
await mkdir(output,{recursive:true});
const controls=(await readFile(new URL('./puzzle-controls.mjs',import.meta.url),'utf8')).replace('export function puzzleControls','function puzzleControls');
const journey=(await readFile(new URL('./splat-valley-pilot.mjs',import.meta.url),'utf8')).replace(/^import .*\n/,'').replace('export function* splatValleyJourney','return function* splatValleyJourney');
const browser=await chromium.launch({headless:true,channel:'chrome'});
try {
  const page=await browser.newPage({viewport:{width:1440,height:900}}),errors=[],warnings=[];
  page.on('pageerror',error=>errors.push(error.message));
  page.on('console',message=>{if(message.type()==='error')errors.push(message.text());if(message.type()==='warning')warnings.push(message.text());});
  await page.goto(`${base}?playtest&level=splat-valley${full?'':'&lite'}`);
  await page.waitForFunction(()=>window.__game?.getCurrentLevel().id==='splat-valley'&&!window.__game.gameFlow.blocksGameplay,null,{timeout:90000});
  await page.waitForTimeout(500);
  const scenery=await page.evaluate(()=>window.__game.getLevel().splatScenery.diagnostics);
  assert.equal(scenery.status,'ready'); assert.ok(scenery.splats>100000);
  await page.screenshot({path:`${output}/spawn-${full?'full':'lite'}.png`});
  await page.evaluate(source=>{
    const pilotFactory=new Function(source)(),g=window.__game,p=g.player,l=g.getLevel();
    const report=window.splatReview={stage:'spawn',actions:[],evidence:[],done:false,failure:null,frame:0};
    const r={p,l,report,frame:0},pilot=pilotFactory(r);let next=pilot.next(),last={},advanced=false;
    const die=p.die.bind(p);
    p.die=()=>{report.death={frame:r.frame,position:p.pos.toArray(),body:{min:p.playerBox.min.toArray(),max:p.playerBox.max.toArray()},
      pits:l.killBoxes.map(box=>({min:box.min.toArray(),max:box.max.toArray(),hit:box.intersectsBox(p.playerBox)})),stack:new Error().stack};return die();};
    const step=p.step.bind(p),commit=p.commitRenderStep.bind(p);
    p.step=(dt,input,level)=>{
      if(report.done)return;
      const sample=next.value??{};
      for(const key of ['moveX','moveY'])input[key]=sample[key]??0;
      for(const key of ['jumpHeld','grindHeld','spinHeld','grabHeld','transferHeld']){
        input[key]=sample[key]??false;input[key.replace('Held','Pressed')]=input[key]&&!last[key];
      }
      input.jumpReleased=sample.jumpReleased??(!input.jumpHeld&&!!last.jumpHeld);input.restartPressed=false;
      last={...sample};step(dt,input,level);advanced=true;
    };
    p.commitRenderStep=(...args)=>{
      commit(...args);if(!advanced||report.done)return;advanced=false;r.frame++;report.frame=r.frame;
      try{next=pilot.next();if(next.done){report.done=true;report.result=next.value;}}
      catch(error){report.done=true;report.failure=String(error);report.position=p.pos.toArray();}
    };
  },controls+'\n'+journey);
  const captured=new Set();let state;
  for(let tick=0;tick<1600;tick++) {
    await page.waitForTimeout(250);state=await page.evaluate(()=>window.splatReview);
    if(!state)throw Error('Game reloaded during the source-spawn journey');
    if(!captured.has(state.stage)) {
      captured.add(state.stage);console.log(JSON.stringify({stage:state.stage,frame:state.frame}));
      if(/gap|lookout|checkpoint|descending/.test(state.stage))await page.screenshot({path:`${output}/${state.stage.replaceAll(' ','-')}-${full?'full':'lite'}.png`});
    }
    if(state.done)break;
  }
  await page.screenshot({path:`${output}/finish-${full?'full':'lite'}.png`});
  await writeFile(`${output}/journey-${full?'full':'lite'}.json`,JSON.stringify({...state,errors,warnings},null,2));
  console.log(JSON.stringify({result:state?.result,failure:state?.failure,death:state?.death,errors,precisionWarnings:warnings.filter(w=>/toHalfFloat|splat/i.test(w))}));
  assert.ok(state?.done);assert.equal(state.failure,null);assert.equal(state.result.state,'finished');assert.deepEqual(errors,[]);
  assert.deepEqual(warnings.filter(w=>/toHalfFloat|splat/i.test(w)),[]);
} finally {await browser.close();}
