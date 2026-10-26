import {createRequire} from 'node:module';
const {chromium}=createRequire(import.meta.url)(process.env.PLAYWRIGHT_MODULE||'playwright');
import {writeFile} from 'node:fs/promises';
const browser=await chromium.launch({channel:'chrome',headless:true}),page=await browser.newPage({viewport:{width:600,height:600}}),errors=[];
page.on('pageerror',e=>errors.push(e.message));
await page.goto(`${process.argv[2]??'http://127.0.0.1:5497'}/race-powerups-review.html`);
const icons=await page.evaluate(async()=>{
 const THREE=await import('/node_modules/three/build/three.module.js'),{createRaceItemModel,disposeRaceItemModel}=await import('/src/race/items.ts');
 const renderer=new THREE.WebGLRenderer({antialias:true,alpha:true,preserveDrawingBuffer:true});renderer.setSize(192,192);renderer.setClearColor(0,0);renderer.outputColorSpace=THREE.SRGBColorSpace;
 const result={};
 for(const kind of ['tnt','nitro']){
  const scene=new THREE.Scene(),model=createRaceItemModel(kind);await model.userData.explosiveBundle.ready;if(!model.userData.explosiveBundle.loaded)throw Error('Authored model failed to load');scene.add(model);
  scene.add(new THREE.HemisphereLight(0xcceaff,0x3c2916,2.4));const key=new THREE.DirectionalLight(0xffe2b6,3);key.position.set(-3,6,5);scene.add(key);
  const camera=new THREE.PerspectiveCamera(32,1,.1,30),box=new THREE.Box3().setFromObject(model),center=box.getCenter(new THREE.Vector3()),size=box.getSize(new THREE.Vector3());camera.position.copy(center).add(new THREE.Vector3(.65,.45,1).normalize().multiplyScalar(Math.max(size.x,size.y,size.z)*2.1));camera.lookAt(center);renderer.render(scene,camera);result[kind]=renderer.domElement.toDataURL('image/webp',.93);disposeRaceItemModel(model);
 }
 renderer.dispose();return result;
});
for(const [kind,url]of Object.entries(icons))await writeFile(new URL(`../public/race-items/${kind}.webp`,import.meta.url),Buffer.from(url.split(',')[1],'base64'));
await browser.close();console.log(JSON.stringify({baked:Object.keys(icons),errors}));
