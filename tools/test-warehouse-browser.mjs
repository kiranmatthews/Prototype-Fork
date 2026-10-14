// Local and deployed Chrome checks; approach setups are explicit, then inputs only.
import assert from 'node:assert/strict';
import { mkdir, writeFile } from 'node:fs/promises';
const { chromium } = await import(process.env.PLAYWRIGHT_MODULE || 'playwright');
const base=process.argv[2]||'http://127.0.0.1:5319/';
const output=process.env.WAREHOUSE_OUTPUT||'/private/tmp/warehouse-browser';
await mkdir(output,{recursive:true});
const browser=await chromium.launch({headless:true,channel:'chrome'});
const errors=[],reports=[];
try{
 for(const lite of [true,false]){
 const page=await browser.newPage({viewport:{width:1440,height:900}});
 page.on('pageerror',e=>errors.push(e.message));
 page.on('console',m=>{if(m.type()==='error')errors.push(m.text());});
 await page.goto(`${base}?playtest&level=warehouse${lite?'&lite':''}`);
 await page.waitForFunction(()=>window.__game&&!window.__game.gameFlow.blocksGameplay&&window.__game.player.grounded,null,{timeout:120000});
 const initial=await page.evaluate(()=>{const g=window.__game,l=g.getLevel();return {pos:g.player.pos.toArray(),state:g.player.state,collectibles:l.skateCollectathon?.tokens.length,meshes:l.groundMeshes.length,stamp:document.querySelector('.hud-build')?.textContent};});
 assert.equal(initial.collectibles,5);assert.match(initial.stamp,/Codex\/sol fork/);
 await page.keyboard.down('ArrowUp');await page.waitForTimeout(1200);await page.keyboard.up('ArrowUp');
 const traversed=await page.evaluate(()=>window.__game.player.pos.z<-.5);assert.ok(traversed,'real keyboard must move the mounted rider');
 await page.screenshot({path:`${output}/${lite?'lite':'full'}-spawn.png`});
 await page.evaluate(()=>{
  const g=window.__game,p=g.player,l=g.getLevel();
  window.__warehouse={
   place(pos,heading,hard=false){p.respawn(l,hard,true,{position:p.pos.clone().fromArray(pos),heading:p.axisF.clone().fromArray(heading)});p.axisF.fromArray(heading).normalize();p.axisL.set(p.axisF.z,0,-p.axisF.x);p.speed=0;p.freeSkate=true;},
   tick(o={}){const i={moveX:0,moveY:0,jumpHeld:false,jumpPressed:false,jumpReleased:false,grindHeld:false,grindPressed:false,spinHeld:false,spinPressed:false,grabHeld:false,grabPressed:false,transferHeld:false,transferPressed:false,restartPressed:false,consumeEdges(){},...o};p.step(1/60,i,l);l.update(1/60);},
   snapshot(){return {pos:p.pos.toArray(),state:p.state,grounded:p.grounded,bail:p.isBailing,collected:l.skateCollectathon.collected};}
  };
 });
 const routes=[];
 for(const [index,start,heading] of [
  [0,[-20,.15,-67],[0,0,-1]],[1,[37,.15,-4],[0,0,-1]],
  [2,[-25,3.75,-94],[1,0,0]],[3,[-35,.15,-22],[0,0,-1]],
  [4,[0,2.15,-52],[0,0,1]],
 ]){
  const result=await page.evaluate(({index,start,heading})=>{
   const g=window.__game,p=g.player,l=g.getLevel(),t=window.__warehouse;
   t.place(start,heading,index===0);let released=false,landed=false,grind=0,frames=0;
   for(;frames<420;frames++){
    let pop=false;
    if(!released){pop=index===0?p.pos.z<-98:index===1?p.pos.z<-59:index===2?false:index===3?p.pos.z<-40.8:p.pos.z>-26.5;if(pop)released=true;}
    t.tick({moveY:1,jumpHeld:!released,jumpReleased:pop,grindHeld:index===2&&p.pos.x>3});
    if(p.state==='grind')grind++;
    if(l.skateCollectathon.tokens[index].collected&&p.grounded){landed=true;if(index!==2||grind>20)break;}
    if(p.isBailing||p.state==='dead')break;
   }
   return {...t.snapshot(),token:l.skateCollectathon.tokens[index].collected,landed,grind,frames};
  },{index,start,heading});
  routes.push(result);assert.ok(result.token&&result.landed&&!result.bail&&result.state!=='dead',JSON.stringify({index,result}));
  await page.waitForTimeout(250);
  await page.screenshot({path:`${output}/${lite?'lite':'full'}-route-${index+1}.png`});
 }
 // Actual checkpoint banking, then the normal kill plane and automatic retry.
 await page.evaluate(()=>{const t=window.__warehouse,p=window.__game.player;t.place([12,.1,-1],[0,0,-1]);p.speed=18;for(let i=0;i<25;i++)t.tick({moveY:1});});
 const checkpoint=await page.evaluate(()=>!!window.__game.getLevel().activeCheckpoint);assert.ok(checkpoint);
 const before=await page.evaluate(()=>{const g=window.__game,p=g.player;p.pos.set(10,g.getLevel().killY-8,-6);p.prevPos.copy(p.pos);p.grounded=false;return p.renderSnapVersion;});
 await page.waitForFunction(snap=>{const p=window.__game.player;return p.grounded&&p.state!=='dead'&&p.renderSnapVersion!==snap;},before,{timeout:20000});
 const retained=await page.evaluate(()=>window.__game.getLevel().skateCollectathon.collected);assert.equal(retained,5);
 await page.screenshot({path:`${output}/${lite?'lite':'full'}-goal-hud.png`});
 const finish=await page.evaluate(()=>{const t=window.__warehouse;t.place([16,1,0],[0,0,-1]);for(let i=0;i<60&&window.__game.player.state!=='finished';i++)t.tick();return t.snapshot();});
 assert.equal(finish.state,'finished');
 const locked=await page.evaluate(()=>{const t=window.__warehouse;t.place([16,1,0],[0,0,-1],true);for(let i=0;i<60;i++)t.tick();return t.snapshot();});
 assert.equal(locked.collected,0);assert.notEqual(locked.state,'finished');
 if(!lite){
  // Review-only roof cutaway. Restore all visibility and renderer state.
  const png=await page.evaluate(()=>{
   const g=window.__game,l=g.getLevel(),data=l.captureData(),hidden=[];
   l.root.traverse(o=>{const nm=data.components[o.userData.editorIdx]?.nm??'';if(/roof|truss|ceiling light/i.test(nm)&&o.visible){hidden.push(o);o.visible=false;}});
   const cam=g.camera.clone();cam.position.set(133,151,138);cam.up.set(0,1,0);cam.lookAt(0,0,-54);cam.fov=50;cam.aspect=1440/900;cam.updateProjectionMatrix();
   const target=g.renderer.getRenderTarget(),fog=g.scene.fog;g.scene.fog=null;g.renderer.setRenderTarget(null);g.renderer.render(g.scene,cam);
   const png=g.renderer.domElement.toDataURL('image/png');g.scene.fog=fog;g.renderer.setRenderTarget(target);for(const o of hidden)o.visible=true;return png;
  });
  await writeFile(`${output}/overview.png`,Buffer.from(png.split(',')[1],'base64'));
  await page.setViewportSize({width:390,height:844});
  await page.waitForTimeout(500);await page.screenshot({path:`${output}/portrait.png`});
  const goalRect=await page.locator('.hud-park-goal').boundingBox();assert.ok(goalRect&&goalRect.x>=0&&goalRect.x+goalRect.width<=390);
 }
 reports.push({lite,initial,traversed,routes,checkpoint,retained,finish,locked});
 console.log(`PASS ${lite?'lite':'full'}: keyboard, five real approaches/landings, checkpoint, pit recovery, goal retention, finish and restart`);
 await page.close();
 }
 assert.deepEqual(errors,[]);
}finally{await writeFile(`${output}/results.json`,JSON.stringify({base,reports,errors},null,2));await browser.close();}
