// Inspection-only cutaway. Route validation uses the unmodified game camera.
import {mkdir} from 'node:fs/promises';
await mkdir('/private/tmp/mall-recreation',{recursive:true});
const base=process.argv.find(a=>a.startsWith('http'))||'http://127.0.0.1:5276';
const section=process.argv.includes('--section=plaza')?'plaza':null;
const {chromium}=await import(process.env.PLAYWRIGHT_MODULE||'playwright');
const browser=await chromium.launch({headless:true,channel:'chrome'}),page=await browser.newPage({viewport:{width:1800,height:1120},serviceWorkers:'block'});
try{
 await page.goto(`${base}/?playtest&level=mall&lite`,{timeout:120000});
 await page.waitForFunction(()=>window.__game?.getCurrentLevel().id==='mall'&&!window.__game.gameFlow.blocksGameplay,null,{timeout:120000});
 await page.evaluate(section=>{
  const g=window.__game,l=g.getLevel(),data=g.getCurrentLevel().data;
  g.player.step=()=>{};
  l.root.traverse(o=>{
   const c=data.components[o.userData.editorIdx];
   if(c&&(c.grp===11||c.grp===10||(c.t==='wallpath'&&(c.pts?.[0]?.[0]??0)>0)))o.visible=false;
  });
  const render=g.renderer.render.bind(g.renderer);
  g.renderer.render=(scene,camera)=>{
   if(scene===g.scene){
    scene.fog=null;camera.far=1500;
    if(section==='plaza'){camera.position.set(136,29,-220);camera.fov=46;camera.lookAt(108,-1,-264);}
    else{camera.position.set(305,280,120);camera.fov=29;camera.lookAt(45,0,-145);}
    camera.updateProjectionMatrix();camera.updateMatrixWorld(true);
   }
   render(scene,camera);
  };
  document.querySelectorAll('.hud,.game-hud-layer').forEach(e=>e.style.display='none');
 },section);
 await page.waitForTimeout(1500);await page.screenshot({path:`/private/tmp/mall-recreation/${section??'cutaway'}.png`});
}finally{await browser.close();}
