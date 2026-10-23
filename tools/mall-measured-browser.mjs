import assert from 'node:assert/strict';
import {mkdir,writeFile} from 'node:fs/promises';
import {build} from 'esbuild';
const {chromium}=await import(process.env.PLAYWRIGHT_MODULE||'playwright');
const base=process.argv.find(s=>s.startsWith('http'))||'http://127.0.0.1:5284',full=process.argv.includes('--full'),inspect=process.argv.includes('--inspect');
const out='/private/tmp/mall-recreation/measured';await mkdir(out,{recursive:true});
const fixture=await build({stdin:{contents:"export * as source from './src/levels/mall-measured';export {createMeasuredMallPilot} from './tools/mall-measured-pilot.mjs';export {Vector3,Raycaster,Box3} from 'three';",resolveDir:process.cwd()},bundle:true,format:'esm',write:false});
const browser=await chromium.launch({headless:true,channel:'chrome'}),page=await browser.newPage({viewport:{width:1440,height:900},serviceWorkers:'block'}),errors=[];
let progressTimer;
page.on('pageerror',e=>errors.push(e.message));page.on('console',m=>{if(m.type()==='error')errors.push(m.text());});
await page.route('**/mall-measured-fixture.js',r=>r.fulfill({contentType:'application/javascript',body:fixture.outputFiles[0].text}));
try{
 await page.goto(`${base}/?playtest&level=mall${full?'':'&lite'}`,{timeout:120000});
 await page.waitForFunction(()=>window.__game?.getCurrentLevel().id==='mall'&&!window.__game.gameFlow.blocksGameplay,null,{timeout:120000});
 await page.waitForTimeout(1800);
 const initial=await page.evaluate(async()=>{const {source,Box3,Vector3}=await import('/mall-measured-fixture.js'),g=window.__game,p=g.player;return{sourceMatches:JSON.stringify(source.MALL_LEVEL)===JSON.stringify(g.getCurrentLevel().data),components:g.getCurrentLevel().data.components.length,position:p.pos.toArray(),grounded:p.grounded,bodyBounds:new Box3().setFromObject(p.bodyGroup).getSize(new Vector3()).toArray(),stats:source.MALL_SURVEY_STATS,draw:g.renderer.info.render};});
 console.log(JSON.stringify({initial,errors}));await page.screenshot({path:`${out}/${full?'full':'lite'}-spawn.png`});
 if(inspect){assert.equal(errors.length,0);returnEarly();}else{
 await page.evaluate(async()=>{
  const {source,createMeasuredMallPilot,Vector3,Raycaster,Box3}=await import('/mall-measured-fixture.js'),g=window.__game,p=g.player,l=g.getLevel(),pilot=createMeasuredMallPilot(source);
  // Auto-kick can travel while the browser loads and captures the first view.
  // Start the input-only route at the same fresh supported spawn as native.
  p.respawn(l,true,false);
  const canonical=o=>JSON.stringify(o,(_k,v)=>typeof v==='number'?Math.round(v*1e7)/1e7:v);
  const r=window.mallMeasuredReview={frames:0,done:false,error:null,evidence:pilot.evidence,sourceMatches:canonical(source.MALL_LEVEL)===canonical(g.getCurrentLevel().data),tuning:JSON.stringify(g.TUNING),samples:[],obstructions:[],startedAt:performance.now(),arcadeHeadroom:[]};
  if(!r.sourceMatches)throw Error('Stale measured Mall source');
  const update=g.input.update.bind(g.input),step=p.step.bind(p),render=g.renderer.render.bind(g.renderer);let sample={};const ray=new Raycaster(),a=new Vector3(),d=new Vector3(),scenery=[],headBox=new Box3(),headCenter=new Vector3(),up=new Vector3(0,1,0);
  l.root.traverse(o=>{if(o.isMesh&&o.visible&&!o.userData.editorGhost)scenery.push(o);});
  g.input.pollGamepad=()=>{const x=sample.moveX||0,y=sample.moveY||0,n=Math.hypot(x,y),v=n?.22+.78*Math.min(1,n):0,held={0:!!sample.jumpHeld,1:!!sample.grabHeld,2:!!sample.spinHeld,3:!!sample.grindHeld};return{id:'Measured Mall test controller',index:0,connected:true,mapping:'standard',axes:n?[x/n*v,-y/n*v,0,0]:[0,0,0,0],buttons:Array.from({length:18},(_,i)=>({pressed:!!held[i],touched:!!held[i],value:held[i]?1:0}))};};
  p.step=(dt,input,level)=>{if(r.done)return;try{sample=pilot.sample(p,l);update();step(dt,input,level);pilot.observe(p,l);r.frames++;r.state=p.state;r.source=source.mallSourcePoint(...p.pos.toArray());r.stage=pilot.stage;if(r.frames%15===0)r.samples.push({frame:r.frames,source:r.source,state:p.state,speed:p.speed,ground:p.groundHit?.name});if(p.state==='finished')r.done=true;}catch(e){r.error=String(e);r.done=true;}if(r.done){r.tuningUnchanged=r.tuning===JSON.stringify(g.TUNING);r.wallSeconds=(performance.now()-r.startedAt)/1000;}};
  g.renderer.render=(scene,camera)=>{render(scene,camera);if(scene!==g.scene||r.done)return;a.copy(p.renderPosition);a.y+=1.25;d.subVectors(camera.position,a);ray.set(a,d.clone().normalize());ray.near=.15;ray.far=d.length()-.2;const h=ray.intersectObjects(scenery,false).find(h=>h.object.visible&&h.distance>.15);if(h)r.obstructions.push({frame:r.frames,source:r.source,name:h.object.name,distance:h.distance});
   if(r.source?.[0]>3500&&r.source[0]<4400&&p.grounded&&r.frames%3===0){
    headBox.setFromObject(p.headPresentation??p.headM);headBox.getCenter(headCenter);a.set(headCenter.x,p.renderPosition.y+.5,headCenter.z);ray.set(a,up);ray.near=0;ray.far=12;
    const roof=ray.intersectObjects(scenery,false).find(h=>h.object.visible);if(roof&&!headBox.isEmpty())r.arcadeHeadroom.push({frame:r.frames,source:r.source,roof:roof.object.name,headTop:headBox.max.y,roofY:roof.point.y,margin:roof.point.y-headBox.max.y});
   }
  };
 });
 progressTimer=setInterval(()=>page.evaluate(()=>{const r=window.mallMeasuredReview,g=window.__game;return r?{frames:r.frames,stage:r.stage,source:r.source,error:r.error,blocked:g?.gameFlow.blocksGameplay}: {reviewMissing:true,level:g?.getCurrentLevel().id};}).then(s=>console.log(JSON.stringify({progress:s}))).catch(()=>{}),15000);
 for(const [name,x] of [['concourse',-9000],['atrium',-2100],['arcade',4000],['arcade-clearance',4200],['courtyard',9000],['exit',12800]]){
  await page.waitForFunction(x=>{const r=window.mallMeasuredReview;return r?.done||r?.stage===2&&r.source[0]>x;},x,{timeout:180000});
  if(await page.evaluate(()=>window.mallMeasuredReview.done))break;
  await page.screenshot({path:`${out}/${full?'full':'lite'}-${name}.png`});
 }
 await page.waitForFunction(()=>window.mallMeasuredReview?.done,null,{timeout:180000});
 const result=await page.evaluate(()=>window.mallMeasuredReview);await page.screenshot({path:`${out}/${full?'full':'lite'}-end.png`});await writeFile(`${out}/${full?'full':'lite'}-browser.json`,JSON.stringify({...result,errors},null,2));console.log(JSON.stringify({...result,samples:undefined,obstructions:result.obstructions.length,errors}));assert.equal(result.error,null);assert.equal(result.state,'finished');assert.equal(errors.length,0);
 }
}catch(error){
 await page.screenshot({path:`${out}/${full?'full':'lite'}-failure.png`}).catch(()=>{});
 const state=await page.evaluate(()=>({review:window.mallMeasuredReview,level:window.__game?.getCurrentLevel().id,blocked:window.__game?.gameFlow.blocksGameplay})).catch(()=>null);
 await writeFile(`${out}/${full?'full':'lite'}-failure.json`,JSON.stringify({error:String(error),state,errors},null,2));throw error;
}finally{clearInterval(progressTimer);await browser.close();}
function returnEarly(){}
