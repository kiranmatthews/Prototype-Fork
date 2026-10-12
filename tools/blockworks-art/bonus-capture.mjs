// Side-view authoring poses with the real bonus camera, not traversal proof.
import {mkdir,readFile,writeFile} from 'node:fs/promises';
import {createHash} from 'node:crypto';
const {chromium}=await import(process.env.PLAYWRIGHT_MODULE||'playwright');
const base=process.env.BLOCKWORKS_URL||'http://127.0.0.1:5187';
const pass=process.argv.includes('--before')?'before':'after',out='docs/blockworks-art/bonus/'+pass;
await mkdir(out,{recursive:true});
const browser=await chromium.launch({channel:'chrome',headless:true}),page=await browser.newPage({viewport:{width:1600,height:900}}),errors=[];
page.on('pageerror',e=>errors.push(e.message));page.on('console',m=>{if(m.type()==='error')errors.push(m.text());});
const views=[['arrival',-6,0,false],['gallery-approach',5,0,false],['gallery-switch',21,0,false],['gallery-revealed',13,8.4,true],['ride-works',37,0,false],['bridge-takeoff',44,0,false],['bridge-active',51,0,true],['bridge-receiver',59.5,0,true],['terrace-bounce',73,0,false],['terrace-air',74.5,8.5,false],['return-court',98,0,false],['exit',105,0,false]];
// Fill the intervals between puzzle features with overlapping ground views.
if(pass==='after')for(const x of [1,8.5,15,29,58,66,81,88,95])views.push(['route-'+String(x).replace('.','p'),x,0,false]);
const report={createdAt:new Date().toISOString(),pass,method:'Inspection poses; production bonus follow camera. Switch activation is a visual fixture, not gameplay evidence.',shots:[],errors};
try{
 await page.goto(base+'/?playtest&level=bonus-codex-switchback');
 await page.waitForFunction(()=>window.__game&&!window.__game.gameFlow.blocksGameplay,null,{timeout:120000});
 if(pass==='before'){
  await page.evaluate(async()=>{
   const g=window.__game,baseline=await(await fetch('/tools/blockworks-art/bonus-physics-baseline.json')).json();
   const {bonusCourseArt}=await import('/src/levels/bonus-course-art.ts');
   const original={...baseline.data,components:[...baseline.data.components,...bonusCourseArt('blockworks',110)]};
   const entry=g.findLevel('bonus-codex-switchback');entry.data=original;entry.name=original.name;g.switchLevel(entry.id);
  });
  await page.waitForFunction(()=>window.__game.getLevel().name==='Bonus: Blockworks Reassembly'&&!window.__game.gameFlow.blocksGameplay,null,{timeout:120000});
 }
 await page.evaluate(async()=>{const g=window.__game;await g.getLevel().prepareJungleAssets();g.renderQualitySettings.setRegularResolution(null);g.player.step=()=>{};});
 for(const [id,x,y,active]of views){
  const state=await page.evaluate(async({id,x,y,active})=>{
   const g=window.__game,l=g.getLevel(),p=g.player;l.reset(true);g.gameFlow.hide();
   p.respawn(l,false,true,{position:p.pos.clone().set(x,y+.04,0),heading:p.pos.clone().set(1,0,0)});
   if(active)for(const c of l.crates)if(c.bang)l.triggerBang(c);
   p.state='ride';p.grounded=id!=='terrace-air';p.speed=0;p.vVel=0;p.pos.set(x,y+.04,0);p.prevPos.copy(p.pos);p.resetRenderInterpolation();p.commitRenderStep(l);p.collapseRenderInterpolation();
   for(let i=0;i<45;i++)await new Promise(requestAnimationFrame);
   return{name:l.name,player:p.pos.toArray(),camera:{position:g.camera.position.toArray(),quaternion:g.camera.quaternion.toArray(),fov:g.camera.fov},assets:l.blockworksArtDiagnostics,frame:g.getRenderFrameStats()};
  },{id,x,y,active});
  const file=id+'.png';await page.screenshot({path:out+'/'+file});report.shots.push({id,x,y,active,file,sha256:createHash('sha256').update(await readFile(out+'/'+file)).digest('hex'),...state});
  console.log(JSON.stringify({captured:id,errors:errors.length}));
 }
 const source=await page.evaluate(()=>window.__game.getLevel().captureData());
 report.sourceSha256=createHash('sha256').update(JSON.stringify(source)).digest('hex');
 await writeFile(out+'/manifest.json',JSON.stringify(report,null,2)+'\n');if(errors.length)throw Error(errors.join('; '));
}finally{await browser.close();}
