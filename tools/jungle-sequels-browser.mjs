import assert from 'node:assert/strict';
import {mkdir,writeFile} from 'node:fs/promises';
import {tmpdir} from 'node:os';
const {chromium}=await import(process.env.PLAYWRIGHT_MODULE||'playwright');
const base=process.argv.find(a=>/^https?:/.test(a))||'http://127.0.0.1:5195/';
const output=process.env.JUNGLE_BROWSER_OUTPUT||`${tmpdir()}/winding-temple-browser`;
await mkdir(output,{recursive:true});const b=await chromium.launch({headless:true,channel:'chrome'});
try{for(const id of ['jungle-terraces','jungle-skyline']){
 const page=await b.newPage({viewport:{width:1280,height:720}}),errors=[];
 page.on('pageerror',e=>errors.push(e.message));page.on('console',m=>{if(m.type()==='error')errors.push(m.text())});
 await page.goto(new URL(`?playtest&level=${id}${process.argv.includes('--lite')?'&lite':''}`,base).href);
 await page.waitForFunction(id=>window.__game?.getCurrentLevel().id===id&&!window.__game.gameFlow.blocksGameplay,id,{timeout:120000});
 await page.screenshot({path:`${output}/${id}-spawn.png`});
 await page.evaluate(async id=>{
  const g=window.__game,p=g.player,l=g.getLevel(),{JUNGLE_SEQUEL_ROUTES}=await import('/src/levels/jungle-sequels.ts'),{runTempleJourney}=await import('/tools/temple-winding-pilot.mjs');
  const route=JUNGLE_SEQUEL_ROUTES.find(q=>q.id===id),report=window.templeRun={frame:0,done:false,failure:null,trace:[],framing:[]};
  const context={p,l,route,worldDirectionInput:(d,pace=1)=>{const f=p.courseInputDirection(l)??p.camDir,n=Math.hypot(d.x,d.z);return n<.0001?{}:{moveX:(d.x*-f.z+d.z*f.x)/n*pace,moveY:(d.x*f.x+d.z*f.z)/n*pace};},lastInput:{}};
  const gen=runTempleJourney(context);let next=gen.next(),advanced=false,last={};const step=p.step.bind(p),commit=p.commitRenderStep.bind(p);
  p.step=(dt,input,level)=>{if(report.done)return step(dt,input,level);const s=next.value??{};input.moveX=s.moveX??0;input.moveY=s.moveY??0;
   const n=Math.hypot(input.moveX,input.moveY);if(n>1){input.moveX/=n;input.moveY/=n;}input.moveX=Math.round(input.moveX*100)/100;input.moveY=Math.round(input.moveY*100)/100;
   for(const h of ['jumpHeld','spinHeld','grabHeld','grindHeld','transferHeld']){input[h]=s[h]??false;const e=h.replace('Held','Pressed');input[e]=s[e]??(input[h]&&!last[h]);}
   input.jumpReleased=s.jumpReleased??(!input.jumpHeld&&!!last.jumpHeld);input.restartPressed=false;last={...s};context.lastInput=last;step(dt,input,level);advanced=true;};
  p.commitRenderStep=(...args)=>{commit(...args);if(!advanced||report.done)return;advanced=false;report.frame++;
   report.trace.push({frame:report.frame,position:p.pos.toArray(),s:route.toLocal(p.pos.toArray())[0],state:p.state,speed:p.speed,grounded:p.grounded,deaths:p.totalDeaths});
   try{next=gen.next();if(next.done){report.done=true;report.result=next.value;}}catch(error){report.done=true;report.failure=String(error);}
  };
 },id);
 const shots=new Set();for(let i=0;i<1200;i++){await page.waitForTimeout(250);const r=await page.evaluate(()=>{const r=window.templeRun;return{done:r.done,failure:r.failure,frame:r.frame,last:r.trace.at(-1)}});
  if(i%100===0)console.log(JSON.stringify({id,...r}));const bucket=Math.floor((r.last?.s??0)/100);if(!shots.has(bucket)&&r.frame>20){shots.add(bucket);await page.screenshot({path:`${output}/${id}-${bucket}.png`});}if(r.done)break;
 }
 const report=await page.evaluate(()=>window.templeRun);await writeFile(`${output}/${id}.json`,JSON.stringify({...report,errors},null,2));
 await page.screenshot({path:`${output}/${id}-finish.png`});assert.equal(report.done,true);assert.equal(report.failure,null);assert.equal(report.result.deaths,0);assert.deepEqual(errors,[]);console.log('PASS real browser winding temple',id,report.frame);await page.close();
}}finally{await b.close()}
