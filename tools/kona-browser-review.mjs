import assert from 'node:assert/strict';
import {mkdir,writeFile} from 'node:fs/promises';
const {chromium}=await import(process.env.PLAYWRIGHT_MODULE||'playwright');
const base=process.env.KONA_URL||'http://127.0.0.1:5283';
const output=process.env.KONA_OUTPUT||'/private/tmp/kona-review';
await mkdir(output,{recursive:true});
const browser=await chromium.launch({headless:true,channel:'chrome'});
const page=await browser.newPage({viewport:{width:1440,height:900},serviceWorkers:'block'}),errors=[];
page.on('pageerror',e=>errors.push(e.message));
page.on('console',m=>{if(m.type()==='error')errors.push(m.text());});
try {
 await page.goto(`${base}/?playtest&level=kona${process.env.KONA_FULL?'':'&lite'}`,{timeout:180000});
 await page.waitForFunction(()=>window.__game?.getCurrentLevel().id==='kona'&&!window.__game.gameFlow.blocksGameplay,null,{timeout:180000});
 await page.waitForTimeout(2000);
 const report=await page.evaluate(async()=>{
  const g=window.__game,p=g.player,l=g.getLevel(),m=await import('/src/levels/kona.ts');
  return {name:l.name,sourceMatches:JSON.stringify(g.getCurrentLevel().data)===JSON.stringify(m.KONA_LEVEL),position:p.pos.toArray(),grounded:p.grounded,state:p.state,mounted:p.boardRolling,ground:p.groundHit?.name,components:m.KONA_LEVEL.components.length,meshes:l.groundMeshes.length,rails:l.rails.length,pipes:m.KONA_PIPES.length,checkpoints:l.checkpoints.length,stamp:document.querySelector('.hud-build')?.textContent,render:g.getRenderFrameStats()};
 });
 await page.screenshot({path:`${output}/${process.env.KONA_FULL?'full':'lite'}-spawn.png`});
 const png=await page.evaluate(async()=>{
  const g=window.__game,T=await import('/node_modules/.vite/deps/three.js'),cam=new T.OrthographicCamera(-115,115,71.875,-71.875,.1,600);
  g.renderer.setPixelRatio(1);g.renderer.setSize(1440,900,false);
  cam.position.set(-113,162,153);cam.lookAt(0,0,0);cam.updateMatrixWorld();
  const fog=g.scene.fog;g.scene.fog=null;g.renderer.render(g.scene,cam);g.scene.fog=fog;return g.renderer.domElement.toDataURL('image/png');
 });
 await writeFile(`${output}/${process.env.KONA_FULL?'full':'lite'}-overview.png`,Buffer.from(png.split(',')[1],'base64'));
 for(const [name,u,v,y] of [['tombstone',440,373,2],['snake-head',680,278,1.4],['spine',712,583,1],['street',925,500,.6]]){
  const shot=await page.evaluate(async({u,v,y})=>{
   const g=window.__game,T=await import('/node_modules/.vite/deps/three.js'),m=await import('/src/levels/kona.ts'),p=m.konaMapPoint(u,v,y),cam=new T.PerspectiveCamera(55,1.6,.1,500);
   cam.position.set(p[0]-12,p[1]+12,p[2]+17);cam.lookAt(...p);cam.updateMatrixWorld();const fog=g.scene.fog;g.scene.fog=null;g.renderer.render(g.scene,cam);g.scene.fog=fog;return g.renderer.domElement.toDataURL('image/png');
  },{u,v,y});await writeFile(`${output}/${name}.png`,Buffer.from(shot.split(',')[1],'base64'));
 }
 console.log(JSON.stringify({...report,errors},null,2));
 await writeFile(`${output}/${process.env.KONA_FULL?'full':'lite'}-report.json`,JSON.stringify({...report,errors},null,2));
 assert.equal(report.sourceMatches,true);assert.equal(report.grounded,true);assert.equal(report.mounted,true);
 assert.equal(report.pipes,3);assert.match(report.stamp,/Codex\/sol fork/);assert.deepEqual(errors,[]);
} finally {await browser.close();}
