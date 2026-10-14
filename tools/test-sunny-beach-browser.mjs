import assert from 'node:assert/strict';
import {createRequire} from 'node:module';
import {mkdir,writeFile} from 'node:fs/promises';
const require=createRequire(process.env.PLAYWRIGHT_MODULE||import.meta.url);
const {chromium}=require('playwright');
const base=process.argv.find(a=>a.startsWith('http'))||'http://127.0.0.1:5307/';
const full=process.argv.includes('--full');
const browser=await chromium.launch({channel:'chrome',headless:true});
const page=await browser.newPage({viewport:{width:1440,height:900}}),errors=[],report={base,full};
page.on('pageerror',e=>errors.push(String(e)));page.on('console',m=>{if(m.type()==='error')errors.push(m.text())});
try{
 await page.addInitScript(()=>{navigator.getGamepads=()=>[]});
 await page.goto(new URL(`?playtest&level=beachfront${full?'':'&lite'}`,base).href);
 await page.waitForFunction(()=>window.__game&&!window.__game.gameFlow.blocksGameplay,null,{timeout:120000});
 await page.evaluate(async()=>{const g=window.__game;await Promise.all([g.player.preparePresentationAssets(),g.getLevel().prepareJungleAssets()]);});
 await page.waitForFunction(()=>window.__game.player.grounded);
 report.spawn=await page.evaluate(()=>({p:window.__game.player.pos.toArray(),grounded:window.__game.player.grounded,stamp:document.querySelector('.hud-build')?.textContent}));
 assert.match(report.spawn.stamp,/Codex\/sol fork/);
 const start=report.spawn.p;
 await page.keyboard.down('ArrowUp');await page.waitForTimeout(650);await page.keyboard.up('ArrowUp');
 report.nativeMove=await page.evaluate(()=>window.__game.player.pos.toArray());
 assert.ok(Math.hypot(report.nativeMove[0]-start[0],report.nativeMove[2]-start[2])>.5);
 report.structure=await page.evaluate(()=>{
  const g=window.__game,l=g.getLevel(),p=g.player;
  const data=l.captureData(),a=l.gateSpec;
  const copied=g.saveUserLevel({id:'',name:'Sunny beach export QA',data});
  const saved=copied?g.findLevel(copied)?.data:null;
  const portable={valid:!!saved,decor:saved?.components.filter(c=>c.t==='decor').length??0,
    cliffs:saved?.components.filter(c=>c.dkind==='sunnycliff').length??0,flowers:saved?.components.filter(c=>c.dkind==='sunnyhibiscus').length??0};
  if(copied)g.deleteUserLevel(copied);
  window.sunnyQA={nativeStep:p.step.bind(p),nativeUpdate:l.update.bind(l)};
  p.step=()=>{};l.update=()=>{};
  const ray=p.raycaster,origin=p.pos.clone(),direction=p.pos.clone().set(0,-1,0);
  const height=(x,z)=>{ray.set(origin.set(x,15,z),direction);ray.far=40;return ray.intersectObjects(l.groundMeshes,false)[0]?.point.y??null;};
  const join=[];for(let z=-700;z>=-763;z-=.4){const x=z>=-710?(710+z)*.15+1:z>=-738?1:0;join.push({x,z,y:height(x,z)});}
  window.sunnyQA.height=height;
  return {portable,gate:a,components:data.components.length,duplicateRails:data.components.filter(c=>c.t==='rail').length,gates:data.components.filter(c=>c.t==='gate').length,crystals:data.components.filter(c=>c.t==='crystal').length,checkpoints:l.checkpoints.length,
    foam:data.shoreFoam?.length,oceanLook:data.ocean?.look,sand:data.components.filter(c=>c.tex==='sunny-sand').length,join,
    assetErrors:l.jungleAssets?.errors??[]};
 });
 assert.equal(report.structure.gates,1);assert.equal(report.structure.crystals,1);assert.equal(report.structure.checkpoints,8);
 assert.equal(report.structure.foam,5);assert.equal(report.structure.oceanLook,'sunny-beach');assert.ok(report.structure.sand>=5);
 assert.deepEqual(report.structure.assetErrors,[]);
 assert.equal(report.structure.duplicateRails,0,'woodpath rails regenerate only from their source components');
 assert.ok(report.structure.portable.valid&&report.structure.portable.cliffs>80&&report.structure.portable.flowers>100,'complete native/editor scenery capture');
 assert.ok(report.structure.join.every(s=>s.y!==null&&s.y>-.2),'continuous supported beach/island join');
 // Each journey uses real player input and native collision. Position is set
 // only at the start of a case; no teleports occur during a crossing.
 report.crossings=await page.evaluate(()=>{
  const g=window.__game,l=g.getLevel(),p=g.player,q=window.sunnyQA;
  const neutral={moveX:0,moveY:0,jumpHeld:false,jumpPressed:false,jumpReleased:false,grindHeld:false,grindPressed:false,spinHeld:false,spinPressed:false,grabHeld:false,grabPressed:false,transferHeld:false,transferPressed:false,inventoryHeld:true,restartPressed:false};
  const point=d=>{const t=d/384;return [46*Math.sin(Math.PI*t)**2*Math.sin(2*Math.PI*t),1.05,-756-d];};
  const cases=[{name:'departure pier',start:[3.5,2,-694],endZ:-770},
    {name:'first jump',d:68,end:100,jump:80}, {name:'first rope',d:154,end:182,jump:164},
    {name:'second jump',d:238,end:270,jump:250},{name:'second rope',d:315,end:344,jump:325}];
  return cases.map(c=>{
    p.respawn(l,true);l.setRunModesEnabled(false);p.lives=99;
    const at=c.start??point(c.d);p.pos.set(...at);p.settle(l);p.laneCursor.s=-1;
    const initialLives=p.lives;let jumped=false,air=0,ground=0,rope=0,maxY=p.pos.y,frames=0;
    for(;frames<1800;frames++){
      const d=-p.pos.z-756;
      const target=c.start?[0,1.05,p.pos.z-4]:point(Math.min(384,d+4));
      const dx=target[0]-p.pos.x,dz=target[2]-p.pos.z,n=Math.hypot(dx,dz)||1;
      const input={...neutral,moveY:1,moveX:Math.max(-.8,Math.min(.8,(dx*p.axisL.x+dz*p.axisL.z)/n))};
      if(c.jump!==undefined&&d>=c.jump&&!jumped&&p.grounded){input.jumpHeld=input.jumpPressed=true;jumped=true;}
      else if(jumped&&d<c.jump+10)input.jumpHeld=true;
      if(c.name.includes('rope')){input.grindHeld=true;input.grindPressed=frames===0;}
      p.rawInput=input;q.nativeStep(1/60,input,l);q.nativeUpdate(1/60);
      if(p.grounded)ground++;else air++;if(p.state==='rope'||p.state==='grind')rope++;maxY=Math.max(maxY,p.pos.y);
      if(p.state==='dead'||p.lives<initialLives)break;
      if(p.pos.z<(c.endZ??-756-c.end)&&p.grounded)break;
    }
    return {name:c.name,p:p.pos.toArray(),frames,air,ground,rope,maxY,jumped,state:p.state,alive:p.state!=='dead'&&p.lives===initialLives,passed:p.pos.z<(c.endZ??-756-c.end)&&p.grounded};
  });
 });
 console.log(JSON.stringify(report.crossings,null,2));
 for(const row of report.crossings)assert.ok(row.passed&&row.alive,`${row.name} did not complete`);
 // Restore the running game for native checkpoint, water recovery and finish.
 await page.evaluate(()=>{const g=window.__game,l=g.getLevel(),p=g.player,q=window.sunnyQA;p.step=q.nativeStep;l.update=q.nativeUpdate;p.respawn(l,true);p.pos.set(1,1.1,-736.6);p.prevPos.copy(p.pos);p.vVel=0;p.grounded=false;p.laneCursor.s=-1;});
 await page.waitForTimeout(300);
 await page.keyboard.press('KeyF');
 await page.waitForFunction(()=>window.__game.getLevel().activeCheckpoint&&window.__game.player.grounded);
 report.checkpoint=await page.evaluate(()=>window.__game.getLevel().currentSpawn.toArray());
 const snap=await page.evaluate(()=>{const p=window.__game.player;p.pos.set(50,2,-925);p.prevPos.copy(p.pos);p.vVel=0;p.grounded=false;return p.renderSnapVersion;});
 await page.waitForFunction(()=>window.__game.player.state==='dead',null,{timeout:15000});
 await page.waitForFunction(s=>{const p=window.__game.player;return p.grounded&&p.state!=='dead'&&p.renderSnapVersion!==s;},snap,{timeout:15000});
 report.respawn=await page.evaluate(()=>window.__game.player.pos.toArray());
 assert.ok(Math.abs(report.respawn[2]-report.checkpoint[2])<3);
 await page.evaluate(()=>{const g=window.__game,l=g.getLevel(),p=g.player;const gate=l.captureData().components.find(c=>c.t==='gate');p.pos.set(gate.p[0],gate.p[1]+.5,gate.p[2]);p.prevPos.copy(p.pos);p.vVel=0;p.grounded=false;});
 await page.waitForFunction(()=>window.__game.player.state==='finished'||window.__game.gameFlow.blocksGameplay,null,{timeout:15000});
 report.finish=await page.evaluate(()=>({state:window.__game.player.state,glError:window.__game.renderer.getContext().getError()}));
 assert.equal(report.finish.glError,0);assert.deepEqual(errors,[]);
 console.log('PASS native movement, connector, four island crossings, checkpoint, water recovery, finish, portable capture and clean console.');
}finally{
 await mkdir('docs/sunny-beach/qa',{recursive:true});
 await writeFile(`docs/sunny-beach/qa/${full?'full':'lite'}.json`,JSON.stringify({...report,errors},null,2));
 await browser.close();
}
