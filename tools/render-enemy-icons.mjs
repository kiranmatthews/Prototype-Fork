// Render the shipped models, not stand-in drawings. Run against a Vite source server.
import assert from 'node:assert/strict';
import {mkdir,readFile,writeFile} from 'node:fs/promises';
import {createHash} from 'node:crypto';
const {chromium}=await import(process.env.PLAYWRIGHT_MODULE||'playwright');
const base=process.argv[2]||'http://127.0.0.1:5197/';
const output=new URL('../public/enemies/icons/',import.meta.url);await mkdir(output,{recursive:true});
const manifest=JSON.parse(await readFile(new URL('../public/enemies/manifest.json',import.meta.url),'utf8'));
const browser=await chromium.launch({headless:true,channel:'chrome'}),errors=[];
try{
  const page=await browser.newPage();page.on('pageerror',e=>errors.push(String(e)));page.on('console',m=>{if(m.type()==='error')errors.push(m.text());});
  await page.route('**/__enemy-icons',route=>route.fulfill({contentType:'text/html',body:'<!doctype html><title>Enemy model thumbnails</title>'}));
  await page.goto(new URL('__enemy-icons',base).href);
  const images=await page.evaluate(async()=>{
    const THREE=await import('/node_modules/three/build/three.module.js');
    const {createEnemyVisual}=await import('/src/enemies/runtime.ts');
    const {ENEMY_KINDS}=await import('/src/enemies/types.ts');
    const renderer=new THREE.WebGLRenderer({alpha:true,antialias:true,preserveDrawingBuffer:true});
    renderer.setSize(256,256);renderer.setClearColor(0,0);renderer.outputColorSpace=THREE.SRGBColorSpace;
    const scene=new THREE.Scene(),camera=new THREE.OrthographicCamera(-1,1,1,-1,.01,30);
    scene.add(new THREE.HemisphereLight(0xbfd4ff,0x8a6b46,1));
    const sun=new THREE.DirectionalLight(0xffe4ae,1.55);sun.position.set(-3,5,4);scene.add(sun);
    const fill=new THREE.DirectionalLight(0xbfd4ff,.6);fill.position.set(3,2,-2);scene.add(fill);
    const images=[];
    for(const kind of ENEMY_KINDS){
      const visual=createEnemyVisual(kind);await visual.ready;
      if(visual.diagnostics.status!=='ready')throw Error(JSON.stringify(visual.diagnostics));
      scene.add(visual.group);scene.updateMatrixWorld(true);
      const box=new THREE.Box3().setFromObject(visual.group,true),centre=box.getCenter(new THREE.Vector3());
      const size=box.getSize(new THREE.Vector3()),extent=size.length()*.52;
      camera.left=camera.bottom=-extent;camera.right=camera.top=extent;camera.updateProjectionMatrix();
      camera.position.copy(centre).add(new THREE.Vector3(3,2.1,4).normalize().multiplyScalar(5));camera.lookAt(centre);
      for(let i=0;i<3;i++)renderer.render(scene,camera);
      images.push({kind,png:renderer.domElement.toDataURL('image/png'),meshes:visual.diagnostics.meshes});
      visual.group.removeFromParent();visual.dispose();
    }
    renderer.dispose();return images;
  });
  assert.deepEqual(errors,[]);
  const rows=[];
  for(const image of images){
    const bytes=Buffer.from(image.png.split(',')[1],'base64');
    assert.ok(bytes.length>3000,'model thumbnail must contain rendered artwork');
    await writeFile(new URL(`${image.kind}.png`,output),bytes);
    rows.push({kind:image.kind,modelSha256:manifest.enemies.find(e=>e.kind===image.kind).sha256,
      pngSha256:createHash('sha256').update(bytes).digest('hex'),width:256,height:256});
  }
  await writeFile(new URL('manifest.json',output),JSON.stringify({source:'Shipped enemy GLBs rendered with Three.js',icons:rows},null,2)+'\n');
  console.log('Rendered all eight shipped enemy models as editor thumbnails.');
}finally{await browser.close();}
