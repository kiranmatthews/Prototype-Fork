// Validate all four authored sky presets and gameplay with the real renderer.
// Works against Vite, a production preview, or GitHub Pages in an isolated save.
import assert from 'node:assert/strict';
import {mkdir,writeFile} from 'node:fs/promises';
const {chromium}=await import(process.env.PLAYWRIGHT_MODULE||'playwright');
const base=process.argv[2]||'http://127.0.0.1:5322/';
const output=process.env.SKY_REVIEW_OUTPUT||'/private/tmp/sky-horizon-review/game';
await mkdir(output,{recursive:true});
const browser=await chromium.launch({headless:true,channel:'chrome'}),reports=[],errors=[];
try{
 for(const lite of process.argv.includes('--lite-only')?[true]:[true,false]){
  const page=await browser.newPage({viewport:{width:1280,height:720}});
  page.on('pageerror',e=>errors.push(e.message));page.on('console',m=>{if(m.type()==='error')errors.push(m.text());});
  await page.goto(new URL(`?playtest&level=beachfront${lite?'&lite':''}`,base).href);
  await page.waitForFunction(()=>window.__game&&!window.__game.gameFlow.blocksGameplay&&window.__game.player.grounded,null,{timeout:120000});
  const stamp=await page.locator('.hud-build').textContent();assert.match(stamp,/Codex\/sol fork/);
  await page.keyboard.down('ArrowUp');await page.waitForTimeout(500);await page.keyboard.up('ArrowUp');
  const actual=await page.evaluate(()=>{const g=window.__game,p=g.player;return {grounded:p.grounded,position:p.pos.toArray(),water:g.getLevel().water?.stats,glError:g.renderer.getContext().getError()}});
  assert.equal(actual.glError,0);
  for(const preset of lite?['coast']:['coast','day','sunset','night']){
   // Playtest saves are intentionally ephemeral; reload a registered course,
   // then install the fixture in the live runtime for this independent case.
   await page.goto(new URL(`?playtest&level=beachfront${lite?'&lite':''}`,base).href);
   await page.waitForFunction(()=>window.__game?.player.grounded&&!window.__game.gameFlow.blocksGameplay,null,{timeout:120000});
   const fixtureId=await page.evaluate(preset=>{
    const g=window.__game,data={v:1,name:`Sky sea ${preset}`,sky:preset,spawn:[0,1.6,5],killY:-14,
      atmosphere:{backdrop:'painted sky',drawDistance:900},
      ocean:{p:[12,-.36,0],length:100,width:120,seaward:1,geometryVersion:2},
      components:[{t:'platform',p:[0,1,0],s:[10,1,22],tex:'stone'},
       {t:'checkpoint',p:[3,1.5,5]},{t:'gate',p:[0,1.5,-8]}]};
    const id=g.saveUserLevel({id:'',name:data.name,data});if(!id||!g.switchLevel(id))throw Error('Cannot load sky fixture');g.gameFlow.hide();return id;
   },preset);
   await page.waitForFunction(()=>window.__game?.player.grounded&&!window.__game.gameFlow.blocksGameplay,null,{timeout:120000});
   const loaded=await page.evaluate(()=>({id:window.__game.getCurrentLevel().id,name:window.__game.getLevel().captureData().name}));
   assert.equal(loaded.id,fixtureId);console.log(`${lite?'lite':'full'} ${preset}: loaded ${loaded.name}`);
   if(!lite){
    await page.waitForFunction(()=>{const g=window.__game,s=g.scene.getObjectByName('Infinite sky and sea backdrop');return s?.visible&&s.material.userData.skyArtwork==='painted'&&s.material.map?.source.data.width>1&&g.getLevel().water.group.visible;});
    await page.evaluate(()=>{const g=window.__game,w=g.getLevel().water,update=w.update.bind(w);w.debug.freeze=true;
     w.update=(dt,c)=>{const s=window.skyView;if(s){c.position.set(...s.p);c.up.set(0,1,0);c.lookAt(...s.target);c.rotateZ(s.roll||0);c.fov=s.fov||65;c.updateProjectionMatrix();c.updateMatrixWorld(true);}return update(dt,c);};});
    for(const [name,p,target,roll,fov] of [
     ['waterline',[30,1,10],[700,1,-100],0,65],
     ['elevated',[0,70,0],[700,20,-100],0,65],
     ['summit',[0,430,0],[300,0,-50],0,75],
     ['wide',[100,100,-300],[-500,80,-500],.5,105],
     ['reverse',[-300,12,100],[-800,12,800],0,65],
     ['zenith',[0,20,0],[0,300,-.1],0,90],
    ]){
     await page.evaluate(s=>window.skyView=s,{p,target,roll,fov});await page.waitForTimeout(150);
     await page.screenshot({path:`${output}/${preset}-${name}.png`});
    }
    await page.evaluate(()=>window.skyView=null);
   }
   const visual=await page.evaluate(()=>{const g=window.__game,l=g.getLevel(),s=g.scene.getObjectByName('Infinite sky and sea backdrop');return {preset:l.skyPreset,skyTriangles:s.geometry.index.count/3,seaTriangles:l.water.group.getObjectByName('Unity ocean horizon fill').geometry.index.count/3,glError:g.renderer.getContext().getError(),water:l.water.stats};});
   assert.equal(visual.skyTriangles,2);assert.equal(visual.seaTriangles,2);assert.equal(visual.glError,0);
   // Exercise supported spawn, pit respawn, checkpoint landing and gate entry.
   const snap=await page.evaluate(()=>{const p=window.__game.player;p.pos.set(30,-20,0);p.prevPos.copy(p.pos);p.vVel=0;p.grounded=false;return p.renderSnapVersion;});
   await page.waitForFunction(snap=>{const p=window.__game.player;return p.grounded&&p.state!=='dead'&&p.renderSnapVersion!==snap;},snap,{timeout:15000});
   await page.evaluate(()=>{const p=window.__game.player;p.pos.set(3,3,5);p.prevPos.copy(p.pos);p.vVel=0;p.grounded=false;});
   await page.waitForFunction(()=>window.__game.getLevel().activeCheckpoint!==null);
   await page.evaluate(()=>{const p=window.__game.player;p.pos.set(0,2,-8);p.prevPos.copy(p.pos);p.vVel=0;p.grounded=false;});
   await page.waitForFunction(()=>window.__game.player.state==='finished'||window.__game.gameFlow.blocksGameplay);
   reports.push({lite,stamp,actual,visual,respawn:true,checkpoint:true,finish:true});
  }
  await page.close();
 }
 assert.deepEqual(errors,[]);console.log(JSON.stringify({cases:reports.length,presets:reports.map(r=>r.visual.preset),errors}));
}finally{await writeFile(`${output}/results.json`,JSON.stringify({base,reports,errors},null,2));await browser.close();}
