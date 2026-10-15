import {writeFile,mkdir} from 'node:fs/promises';
import assert from 'node:assert/strict';
const {chromium}=await import(process.env.PLAYWRIGHT_MODULE||'playwright');
const browser=await chromium.launch({headless:true,channel:'chrome'}),page=await browser.newPage({viewport:{width:1280,height:720}});
try{
 await page.goto('http://127.0.0.1:5229/?playtest&level=slipstream-race',{timeout:180000});await page.waitForFunction(()=>window.__game?.getSkateRace()?.active&&!window.__game.gameFlow.blocksGameplay,null,{timeout:180000});
 const shots=await page.evaluate(()=>{
  const g=window.__game,r=g.getSkateRace(),l=r.level,gate=g.scene.getObjectByName('skate race finish line');
  const take=(position,target)=>{g.camera.position.fromArray(position);g.camera.lookAt(...target);g.camera.updateMatrixWorld();g.scene.updateMatrixWorld(true);g.renderer.setRenderTarget(null);g.renderer.render(g.scene,g.camera);return g.renderer.domElement.toDataURL('image/jpeg',.9);};
  const start=l.spawnPos,f=r.course.knots[r.course.knots.length-1];
  const grid=take([start.x+18,start.y+12,start.z+25],[start.x,start.y+1,start.z-15]);
  const finish=take([f[0]+32,f[1]+18,f[2]+34],[f[0],f[1]+3,f[2]]);
  return {grid,finish,gate:gate?{visible:gate.visible,position:gate.position.toArray(),children:gate.children.length}:null};
 });
 assert.ok(shots.gate?.visible);assert.ok(shots.gate.children>60);
 await mkdir('/private/tmp/skate-race-captures',{recursive:true});
 for(const kind of ['grid','finish'])await writeFile(`/private/tmp/skate-race-captures/${kind}.jpg`,Buffer.from(shots[kind].split(',')[1],'base64'));
 console.log(JSON.stringify(shots.gate));
}finally{await browser.close();}
