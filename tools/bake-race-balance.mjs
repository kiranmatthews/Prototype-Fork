import {writeFile} from 'node:fs/promises';
import {homedir} from 'node:os';
const {chromium}=await import(homedir()+'/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright/index.mjs');
const browser=await chromium.launch({channel:'chrome',headless:true});
try{
 const page=await browser.newPage();await page.goto((process.argv[2]??'http://127.0.0.1:5248')+'/race-powerups-review.html');
 const data=await page.evaluate(async()=>{
  const THREE=await import('/node_modules/three/build/three.module.js'),{createRaceItemModel,disposeRaceItemModel}=await import('/src/race/items.ts');
  const renderer=new THREE.WebGLRenderer({antialias:true,alpha:true,preserveDrawingBuffer:true});renderer.setSize(256,256);renderer.setClearColor(0,0);renderer.outputColorSpace=THREE.SRGBColorSpace;
  const scene=new THREE.Scene(),model=createRaceItemModel('perfect-balance');scene.add(model);
  const camera=new THREE.PerspectiveCamera(32,1,.1,20);camera.position.set(.75,.35,4.5);camera.lookAt(0,0,0);
  renderer.render(scene,camera);const url=renderer.domElement.toDataURL('image/webp',.95);disposeRaceItemModel(model);renderer.dispose();return url;
 });
 await writeFile(new URL('../public/race-items/perfect-balance.webp',import.meta.url),Buffer.from(data.split(',')[1],'base64'));
 console.log('Baked Perfect Balance from its shared native item mesh.');
}finally{await browser.close();}
