import assert from 'node:assert/strict';
import {mkdir,writeFile} from 'node:fs/promises';
import {homedir} from 'node:os';
import {join} from 'node:path';
import {pathToFileURL} from 'node:url';
const {chromium}=await import(pathToFileURL(join(homedir(),'.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright/index.mjs')).href);
const base=process.env.RIPCORD_URL??'http://127.0.0.1:5246';
const out='/private/tmp/ripcord-river-browser';await mkdir(out,{recursive:true});
const full=process.argv.includes('--full'),old=process.argv.includes('--rolling'),id=old?'rolling-bones':'rumblewater-run';
const browser=await chromium.launch({headless:true,channel:'chrome'}),page=await browser.newPage({viewport:{width:1280,height:720}}),errors=[];
const report={id,full,errors};
page.on('pageerror',e=>errors.push(e.message));page.on('console',m=>{if(m.type()==='error')errors.push(m.text());});
try{
 await page.goto(`${base}/?playtest&level=${id}${full?'':'&lite'}`,{waitUntil:'domcontentloaded'});
 await page.waitForFunction(()=>window.__game&&!window.__game.gameFlow.blocksGameplay,null,{timeout:180000});
 await page.evaluate(async()=>{await window.__game.getLevel().prepareJungleAssets();window.__game.renderQualitySettings.setRegularResolution(null);});
 await page.waitForTimeout(500);
 report.start=await page.evaluate(id=>{const g=window.__game,p=g.player,l=g.getLevel();return{name:l.name,sky:g.findLevel(id).data.sky,grounded:p.grounded,position:p.pos.toArray(),cradles:l.boulder.cradles.filter(Boolean).length,pace:l.boulder.course.actors.map(a=>a.pace)};},id);
 assert.ok(report.start.grounded);
 await page.screenshot({path:`${out}/${id}-${full?'full':'lite'}-start.png`});
 if(full){
  const frame=await page.evaluate(()=>{const g=window.__game;return g.captureBonusReviewFrame();});
  await writeFile(`${out}/${id}-preview.png`,Buffer.from(frame.split(',')[1],'base64'));
 }
 // Observe the actual game loop. The pilot writes only ordinary controller inputs.
 await page.evaluate(async({old})=>{
  const g=window.__game,p=g.player,l=g.getLevel();
  const {createRumblewaterLivePilot}=await import('/tools/rumblewater-live-pilot.mjs');
  const pilot=createRumblewaterLivePilot(g,'inner-low',!old),step=p.step;
  window.__riverReview={done:false,frames:0,samples:[],failure:null};
  const review=window.__riverReview;
  p.step=function(...args){
   if(review.done)return step.apply(this,args);
   try{
    const sample=pilot.next();if(!sample){review.done=true;p.step=step;return;}
    Object.assign(args[1],sample);const result=step.apply(this,args);review.frames=pilot.frame;
    if(pilot.frame%300===0)review.samples.push({frame:pilot.frame,position:p.pos.toArray(),state:p.state});
    if(['dead','gameover'].includes(p.state))throw Error('Unexpected death at '+p.pos.toArray());
    if(p.state==='finished'){
     review.done=true;review.final={state:p.state,position:p.pos.toArray(),deaths:p.totalDeaths,crystal:p.hasCrystal,checkpoints:l.checkpoints.filter(c=>c.active).length};p.step=step;
    }
    return result;
   }catch(e){review.failure=String(e.stack??e);review.done=true;p.step=step;}
  };
 },{old});
 const progress=setInterval(async()=>{try{console.log(JSON.stringify({id,full,progress:await page.evaluate(()=>({frames:window.__riverReview?.frames,last:window.__riverReview?.samples?.at(-1)}))}));}catch{}},15000);
 try{await page.waitForFunction(()=>window.__riverReview?.done,null,{timeout:480000});}finally{clearInterval(progress);}
 report.run=await page.evaluate(()=>window.__riverReview);
 assert.equal(report.run.failure,null);assert.equal(report.run.final.state,'finished');assert.equal(report.run.final.deaths,0);
 assert.equal(report.run.final.checkpoints,old?6:4);if(!old)assert.equal(report.run.final.crystal,true);
 await page.screenshot({path:`${out}/${id}-${full?'full':'lite'}-finish.png`});
 assert.deepEqual(errors,[]);report.pass=true;
} catch(e){report.failure=e.stack;report.last=await page.evaluate(()=>window.__riverReview??null).catch(()=>null);throw e;}
finally{await writeFile(`${out}/${id}-${full?'full':'lite'}.json`,JSON.stringify(report,null,2));await browser.close();console.log(JSON.stringify(report));}
