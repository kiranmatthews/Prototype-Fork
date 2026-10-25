import assert from 'node:assert/strict';
import {mkdir,writeFile} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {createServer} from 'vite';
import {trunkContactCases,trunkRouteCases} from './treehouse-trunk-cases.mjs';
const {chromium}=await import(process.env.PLAYWRIGHT_MODULE||'playwright');
const base=process.argv.find(a=>/^https?:/.test(a))??'http://127.0.0.1:5442/';
const full=process.argv.includes('--full'),mode=full?'full':'lite',out=process.env.TREEHOUSE_TRUNK_BROWSER_OUT??join(tmpdir(),'treehouse-trunk-browser');
await mkdir(out,{recursive:true});
const server=await createServer({appType:'custom',logLevel:'silent',server:{middlewareMode:true}});
let cases;
try{const {TREEHOUSE_TRAIL_LEVEL:source}=await server.ssrLoadModule('/src/levels/treehouse-trail.ts');cases=[...trunkContactCases(source),...trunkRouteCases];}finally{await server.close();}
const browser=await chromium.launch({headless:true,channel:'chrome'}),page=await browser.newPage({viewport:{width:1440,height:900}}),errors=[];
page.on('pageerror',e=>errors.push(e.message));page.on('console',m=>{if(m.type()==='error')errors.push(m.text());});
try{
 await page.goto(new URL(`?playtest&level=treehouse-trail${full?'':'&lite'}`,base).href);
 await page.waitForFunction(()=>window.__game&&!window.__game.gameFlow.blocksGameplay,null,{timeout:120000});
 await page.evaluate(cases=>{
  const g=window.__game,p=g.player,l=g.getLevel(),V=p.pos.constructor;
  g.campaign.startEphemeral();
  const report=window.treeTrunkReview={done:false,rows:[],index:0,tuning:JSON.stringify(g.TUNING),stamp:document.querySelector('.hud-build')?.textContent};
  let c,target,last={},frame=0,row,started=false,cooldown=0;
  const native=p.step.bind(p);
  const inside=(position,w)=>{
   if(position.y+1.2<w.p[1]||position.y>w.p[1]+w.s[1]-.04)return false;
   const x=position.x-w.p[0],z=position.z-w.p[2];let hit=false;
   for(let i=0,j=w.pts.length-1;i<w.pts.length;j=i++){
    const a=w.pts[i],b=w.pts[j];if((a[1]>z)!==(b[1]>z)&&x<(b[0]-a[0])*(z-a[1])/(b[1]-a[1])+a[0])hit=!hit;
   }return hit;
  };
  p.step=(dt,input,level)=>{
   if(report.done)return;
   if(cooldown>0){cooldown--;return;}
   if(!started){
    c=cases[report.index];const from=new V(...c.start);target=new V(...c.target);
    p.respawn(l,true,false,{position:from,heading:target.clone().sub(from).setY(0).normalize()});
    last={};frame=0;row={name:c.name,mode:c.mode??'route',penetrated:false,closest:Infinity,maxY:p.pos.y,reached:false,bailed:false};started=true;
   }
   const d=target.clone().sub(p.pos).setY(0).normalize(),f=p.courseInputDirection(l)??p.camDir,scale=1/(Math.hypot(f.x,f.z)||1),pace=frame<3?0:c.mode&&c.mode!=='walk'?1:.7;
   const held=frame>=3&&(c.mode==='skate'||c.mode==='jump'&&frame<43);
   const sample={moveX:(d.x*-f.z+d.z*f.x)*scale*pace,moveY:(d.x*f.x+d.z*f.z)*scale*pace,jumpHeld:held,grindHeld:false,spinHeld:false,grabHeld:false,transferHeld:false,jumpCancelled:false,restartPressed:false};
   const length=Math.hypot(sample.moveX,sample.moveY);if(length>1){sample.moveX/=length;sample.moveY/=length;}
   sample.moveX=Math.round(sample.moveX*100)/100;sample.moveY=Math.round(sample.moveY*100)/100;
   for(const key of ['jumpHeld','grindHeld','spinHeld','grabHeld','transferHeld'])sample[key.replace('Held','Pressed')]=sample[key]&&!last[key];
   sample.jumpReleased=!sample.jumpHeld&&!!last.jumpHeld;last={...sample};Object.assign(input,sample);native(dt,input,level);frame++;
   if(frame<=3)return;
   row.closest=Math.min(row.closest,Math.hypot(p.pos.x-target.x,p.pos.z-target.z));row.maxY=Math.max(row.maxY,p.pos.y);
   row.penetrated ||= c.bands?.some(w=>inside(p.pos,w))??false;row.bailed ||= p.isBailing;row.reached=row.closest<.5;
   if(row.penetrated||p.totalDeaths>0||!c.mode&&row.reached||frame>=c.frames+3){
    row.position=p.pos.toArray();row.frames=frame;row.deaths=p.totalDeaths;report.rows.push(row);report.index++;started=false;
    if([1,4,7].includes(report.index)){report.preview=report.index;cooldown=100;}
    if(report.index===cases.length){report.done=true;report.tuningUnchanged=JSON.stringify(g.TUNING)===report.tuning;report.failedAssets=g.getLoadingDiagnostics().failed;}
   }
  };
 },cases);
 let captured=0;
 for(let i=0;i<1200;i++){
  await page.waitForTimeout(150);
  const state=await page.evaluate(()=>({done:window.treeTrunkReview.done,index:window.treeTrunkReview.index,preview:window.treeTrunkReview.preview}));
  if(full&&state.preview&&state.preview!==captured){captured=state.preview;await page.screenshot({path:`${out}/${mode}-tree-${captured}.png`});}
  if(i%100===0)console.log(JSON.stringify({mode,...state}));if(state.done)break;
 }
 const report=await page.evaluate(()=>window.treeTrunkReview);
 await writeFile(`${out}/${mode}.json`,JSON.stringify({base,mode,report,errors},null,2));
 await page.screenshot({path:`${out}/${mode}-hut-route.png`});
 assert.equal(report.done,true);assert.equal(report.rows.length,cases.length);assert.equal(report.tuningUnchanged,true);assert.deepEqual(report.failedAssets,[]);assert.deepEqual(errors,[]);assert.match(report.stamp,/Codex\/sol fork/);
 for(const row of report.rows){assert.equal(row.penetrated,false,row.name);assert.equal(row.deaths,0,row.name);if(row.mode==='route'){assert.ok(row.reached,row.name);assert.equal(row.bailed,false,row.name);}else assert.ok(row.closest<5.5,row.name);}
 console.log(`PASS ${mode}: nine native tree contacts and six nearby route traversals, with no console or asset errors.`);
}finally{await browser.close();}
