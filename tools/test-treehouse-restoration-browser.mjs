import assert from 'node:assert/strict';
import {mkdir,writeFile} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {createServer} from 'vite';
import {treehouseSurfaceCases} from './treehouse-surface-cases.mjs';
const {chromium}=await import(process.env.PLAYWRIGHT_MODULE||'playwright');
const base=process.argv.find(a=>/^https?:/.test(a))??'http://127.0.0.1:5340/';
const full=process.argv.includes('--full'),out=process.env.TREEHOUSE_BROWSER_OUTPUT??join(tmpdir(),'treehouse-restoration-browser');
const server=await createServer({appType:'custom',logLevel:'silent',server:{middlewareMode:true}});
let cases;try{
 const {TREEHOUSE_TRAIL_LEVEL}=await server.ssrLoadModule('/src/levels/treehouse-trail.ts');
 const {treehouseTrialPoint}=await server.ssrLoadModule('/src/levels/treehouse-trials-continuity.ts');
 cases=treehouseSurfaceCases(TREEHOUSE_TRAIL_LEVEL,treehouseTrialPoint);
}finally{await server.close();}
await mkdir(out,{recursive:true});
const browser=await chromium.launch({headless:true,channel:'chrome'}),page=await browser.newPage({viewport:{width:1440,height:900}}),errors=[];
page.on('pageerror',e=>errors.push(e.message));page.on('console',m=>{if(m.type()==='error')errors.push(m.text());});
try{
 await page.goto(new URL(`?playtest&level=treehouse-trail${full?'':'&lite'}`,base).href);
 await page.waitForFunction(()=>window.__game,null,{timeout:120000});
 await page.evaluate(cases=>{
  const g=window.__game,p=g.player,l=g.getLevel(),V=p.pos.constructor;
  if(g.frameStats.totalFixedSteps!==0)throw Error('Install before the first simulation tick');
  const report=window.treehouseRestoration={done:false,rows:[],index:0,tuning:JSON.stringify(g.TUNING),stamp:document.querySelector('.hud-build')?.textContent};
  let c,from,to,heading,last={},frame=0,row,started=false,advanced=false;
  const begin=()=>{
   c=cases[report.index];from=new V(...c.start);to=new V(...c.target);heading=to.clone().sub(from).setY(0).normalize();
   p.respawn(l,true,false,{position:from,heading});last={};frame=0;
   row={name:c.name,below:false,bailed:false,minY:p.pos.y,maxY:p.pos.y,furthest:0,reached:false,trace:[]};
  };
  const native=p.step.bind(p),commit=p.commitRenderStep.bind(p);
  p.step=(dt,input,level)=>{
   if(report.done)return;
   if(!started){begin();started=true;}
   const f=p.courseInputDirection(l)??p.camDir,scale=1/(Math.hypot(f.x,f.z)||1),pace=frame<2?0:c.board?1:.6;
   const sample={moveX:(heading.x*-f.z+heading.z*f.x)*scale*pace,moveY:(heading.x*f.x+heading.z*f.z)*scale*pace,jumpHeld:frame>=2&&c.board,grindHeld:false,spinHeld:false,grabHeld:false,transferHeld:false,jumpCancelled:false,restartPressed:false};
   const length=Math.hypot(sample.moveX,sample.moveY);if(length>1){sample.moveX/=length;sample.moveY/=length;}
   sample.moveX=Math.round(sample.moveX*100)/100;sample.moveY=Math.round(sample.moveY*100)/100;
   for(const key of ['jumpHeld','grindHeld','spinHeld','grabHeld','transferHeld'])sample[key.replace('Held','Pressed')]=sample[key]&&!last[key];
   sample.jumpReleased=!sample.jumpHeld&&!!last.jumpHeld;last={...sample};Object.assign(input,sample);native(dt,input,level);advanced=true;
  };
  p.commitRenderStep=(...args)=>{
   commit(...args);if(!advanced||report.done)return;advanced=false;frame++;
   if(frame<=2)return;
   row.minY=Math.min(row.minY,p.pos.y);row.maxY=Math.max(row.maxY,p.pos.y);row.furthest=Math.max(row.furthest,p.pos.clone().sub(from).dot(heading));
   row.below ||= p.pos.y<c.floor;row.bailed ||= p.isBailing||p.totalDeaths>0;
   row.reached=c.pipe?row.maxY>c.approachHeight:p.pos.clone().sub(to).dot(heading)>.5;
   if(frame%6===0||row.below||row.bailed)row.trace.push({frame,position:p.pos.toArray(),state:p.state,grounded:p.grounded,vert:p.groundHit?.vert,ground:p.groundHit?.name,speed:p.speed,impact:p.worldImpactDiagnostics??null});
   if(row.below||row.bailed||(!c.pipe&&row.reached)||(c.pipe&&p.pos.y>c.crest+.2)||frame>=(c.maxFrames??300)+2){
    row.position=p.pos.toArray();row.frames=frame;report.rows.push(row);report.index++;started=false;
    if(report.index>=cases.length){report.done=true;report.tuningUnchanged=JSON.stringify(g.TUNING)===report.tuning;report.failedAssets=g.getLoadingDiagnostics().failed;}
   }
  };
 },cases);
 for(let i=0;i<2400;i++){
  await page.waitForTimeout(250);const state=await page.evaluate(()=>({done:window.treehouseRestoration.done,index:window.treehouseRestoration.index}));
  if(i%120===0)console.log(JSON.stringify(state));if(state.done)break;
 }
 const report=await page.evaluate(()=>window.treehouseRestoration);
 await writeFile(out+'/report.json',JSON.stringify({base,full,report,errors},null,2));await page.screenshot({path:out+'/finish.png'});
 assert.equal(report.done,true);assert.equal(report.rows.length,cases.length);assert.equal(report.tuningUnchanged,true);assert.deepEqual(errors,[]);assert.deepEqual(report.failedAssets,[]);
 for(const row of report.rows)assert.ok(row.reached&&!row.below&&!row.bailed,`${row.name}: ${JSON.stringify({...row,trace:undefined})}`);
 assert.match(report.stamp,/Codex\/sol fork/);
 console.log(`PASS ${report.rows.length} independent Treehouse walking/skating cases in the ${full?'full':'lite'} normal browser loop.`);
}finally{await browser.close();}
