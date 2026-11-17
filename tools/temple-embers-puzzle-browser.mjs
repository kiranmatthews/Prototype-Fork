import assert from 'node:assert/strict';
import {mkdir,writeFile} from 'node:fs/promises';
import {createServer} from 'vite';
import {hydrateTempleRoute} from './temple-night-browser-space.mjs';
import {puzzleControls} from './puzzle-controls.mjs';
import {runLanternStair} from './temple-embers-pilot.mjs';
const {chromium}=await import(process.env.PLAYWRIGHT_MODULE||'playwright');
const base=process.argv.find(a=>/^https?:/.test(a))||'http://127.0.0.1:5362/';
const output=process.env.TEMPLE_PUZZLE_OUTPUT||'/private/tmp/temple-embers-puzzle-browser';
const server=await createServer({appType:'custom',logLevel:'silent',server:{middlewareMode:true,hmr:false,ws:false,watch:null}});
let descriptor,start;
try{
 const {JUNGLE_TERRACES_ROUTE:r}=await server.ssrLoadModule('/src/levels/jungle-sequels.ts');
 start=r.toWorld(506,34.62,8);
 descriptor={end:r.end,step:.25,sourceComponents:r.sourceComponents,frames:Array.from({length:(r.end+20)*4+1},(_,i)=>({...r.frameAt(i/4-20),y:r.groundAt(i/4-20)}))};
}finally{await server.close();}
await mkdir(output,{recursive:true});
const browser=await chromium.launch({headless:true,channel:'chrome'}),errors=[];
try{
 const page=await browser.newPage({viewport:{width:1440,height:900}});
 page.on('pageerror',e=>errors.push(e.message));page.on('console',m=>{if(m.type()==='error')errors.push(m.text());});
 await page.goto(new URL(`?playtest&level=jungle-terraces${process.argv.includes('--lite')?'&lite':''}`,base).href);
 await page.waitForFunction(()=>window.__game?.getCurrentLevel().id==='jungle-terraces'&&!window.__game.gameFlow.blocksGameplay,null,{timeout:180000});
 await page.addScriptTag({content:`window.hydrateTempleRoute=${hydrateTempleRoute.toString()};window.puzzleControls=${puzzleControls.toString()};window.runLanternStair=${runLanternStair.toString()};`});
 await page.evaluate(({descriptor,start})=>{
  const g=window.__game,p=g.player,l=g.getLevel(),route=window.hydrateTempleRoute(descriptor);
  p.respawn(l,true,false,{position:p.pos.clone().set(...start)});
  const report=window.templePuzzle={stage:'start',actions:[],evidence:[],frame:0,done:false,failure:null};
  const vec=p=>p.clone().set(...route.toLocal(p.toArray())),wrappers=new WeakMap();
  const crate=c=>{if(wrappers.has(c))return wrappers.get(c);const mesh=new Proxy(c.mesh,{get(o,k){if(k==='position')return vec(o.position);const v=o[k];return typeof v==='function'?v.bind(o):v;}});const out=new Proxy(c,{get(o,k){return k==='mesh'?mesh:o[k];}});wrappers.set(c,out);return out;};
  const pp=new Proxy(p,{get(o,k){if(k==='pos')return vec(o.pos);const v=o[k];return typeof v==='function'?v.bind(o):v;}});
  const ll=new Proxy(l,{get(o,k){if(k==='crates')return o.crates.map(crate);const v=o[k];return typeof v==='function'?v.bind(o):v;}});
  const r={p:pp,l:ll,source:{components:descriptor.sourceComponents},report,get frame(){return report.frame;}};
  const gen=window.runLanternStair(r,window.puzzleControls(r));let next=gen.next(),last={},advanced=false;
  const step=p.step.bind(p),commit=p.commitRenderStep.bind(p);
  p.step=(dt,input,level)=>{
   if(report.done)return step(dt,input,level);
   const sample=next.value??{},f=route.frameAt(route.toLocal(p.pos.toArray())[0]);
   const cam=p.courseInputDirection(l)??p.camDir,mx=sample.moveX??0,my=sample.moveY??0,dx=f.fx*mx+f.fz*my,dz=f.fz*mx-f.fx*my;
   input.moveX=Math.round((dx*-cam.z+dz*cam.x)*100)/100;input.moveY=Math.round((dx*cam.x+dz*cam.z)*100)/100;
   for(const h of ['jumpHeld','spinHeld','grabHeld','grindHeld','transferHeld']){input[h]=sample[h]??false;const e=h.replace('Held','Pressed');input[e]=sample[e]??(input[h]&&!last[h]);}
   input.jumpReleased=sample.jumpReleased??(!input.jumpHeld&&!!last.jumpHeld);input.restartPressed=false;last={...sample};step(dt,input,level);advanced=true;
  };
  p.commitRenderStep=(...args)=>{commit(...args);if(!advanced||report.done)return;advanced=false;report.frame++;
   try{next=gen.next();if(next.done){report.done=true;report.result=next.value;}}catch(error){report.done=true;report.failure=String(error);}
  };
 },{descriptor,start});
 const shots=new Set();
 for(let i=0;i<900;i++){
  await page.waitForTimeout(200);const state=await page.evaluate(()=>({stage:window.templePuzzle.stage,frame:window.templePuzzle.frame,done:window.templePuzzle.done,failure:window.templePuzzle.failure}));
  if(!shots.has(state.stage)){shots.add(state.stage);console.log(JSON.stringify(state));
   if(/restore the complete|restored tower at 519|upper lantern offering|rejoin/.test(state.stage))await page.screenshot({path:`${output}/stage-${shots.size}.png`});}
  if(state.done)break;
 }
 const report=await page.evaluate(()=>window.templePuzzle);await page.screenshot({path:`${output}/finish.png`});
 await writeFile(`${output}/result.json`,JSON.stringify({report,errors},null,2));
 assert.equal(report.done,true);assert.equal(report.failure,null);assert.equal(report.result.deaths,0);assert.deepEqual(errors,[]);
 console.log('PASS real browser lantern staircase',report.frame);
}finally{await browser.close();}
