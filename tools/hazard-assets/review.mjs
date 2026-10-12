import assert from 'node:assert/strict';
import {mkdir,writeFile} from 'node:fs/promises';
const {chromium}=await import(process.env.PLAYWRIGHT_MODULE||'playwright');
const base=process.env.HAZARD_URL||'http://127.0.0.1:5198/';
const out=new URL('../../docs/hazard-review/',import.meta.url);
// Keep generated review evidence in docs, not in the public pack.
await mkdir(out,{recursive:true});
const browser=await chromium.launch({channel:'chrome',headless:true});
const page=await browser.newPage({viewport:{width:1440,height:810}}),errors=[];
page.on('pageerror',e=>errors.push(e.message));
page.on('console',m=>{if(m.type()==='error')errors.push(m.text());});
try{
  await page.goto(base+'?playtest&level=astra-chimeworks&lite',{timeout:180000});
  await page.waitForFunction(()=>window.__game&&!window.__game.gameFlow.blocksGameplay,null,{timeout:180000});
  const report=await page.evaluate(async()=>{
    const moduleSource=await (await fetch('/src/hazardVisuals.ts')).text();
    const THREE=await import(moduleSource.match(/import \* as THREE from "([^"]+)"/)[1]);
    const {Level,BUILTIN_LEVELS}=await import('/src/level.ts');
    const hazards=BUILTIN_LEVELS.flatMap(entry=>(entry.data?.components??[])
      .filter(c=>c.t==='crusher'||c.t==='pendulum').map(c=>({...c,nm:entry.id+': '+(c.nm??c.t)})));
    const levels=BUILTIN_LEVELS.filter(entry=>entry.data?.components.some(c=>c.t==='crusher'||c.t==='pendulum')).map(entry=>({id:entry.id,
      crushers:entry.data.components.filter(c=>c.t==='crusher').length,
      pendulums:entry.data.components.filter(c=>c.t==='pendulum'&&c.dkind!=='ghostaxe').length,
      axes:entry.data.components.filter(c=>c.t==='pendulum'&&c.dkind==='ghostaxe').length}));
    const fixture={v:1,name:'Global hazard QA',spawn:[0,1,8],killY:-50,
      components:[{t:'platform',p:[0,-.5,0],s:[30,1,30]},{t:'gate',p:[0,0,-10]},...hazards]};
    const scene=new THREE.Scene(),l=new Level(scene,{id:'hazard-review',name:fixture.name,data:fixture});
    await l.prepareJungleAssets();l.update(0);scene.updateMatrixWorld(true);
    const failures=[];const check=(value,label)=>{if(!value)failures.push(label);};
    check(l.hazardAssetDiagnostics.errors.length===0,'asset load errors');
    for(const [i,cr]of l.crushers.entries()){
      check(cr.mesh.userData.hazardAssetReady,'crusher '+i+' missing shared boulder');
      check(!cr.mesh.material.visible,'crusher '+i+' still renders cube');
      const model=cr.mesh.getObjectByName('Meshy crusher boulder'),bounds=new THREE.Box3().setFromObject(model.levels[0].object,true);
      check(bounds.min.distanceTo(cr.box.min)<.03&&bounds.max.distanceTo(cr.box.max)<.03,
        'crusher '+i+' model no longer fits hitbox '+JSON.stringify({visual:[bounds.min.toArray(),bounds.max.toArray()],hitbox:[cr.box.min.toArray(),cr.box.max.toArray()]}));
    }
    for(const [i,pd]of l.pendulums.entries()){
      if(pd.pivot.userData.ghostSkin==='ghostaxe'){
        check(!pd.pivot.userData.hazardAsset,'axe '+i+' received a ball skin');continue;
      }
      check(pd.pivot.userData.hazardAssetReady,'pendulum '+i+' asset missing');
      const weight=pd.pivot.getObjectByName('Meshy iron weight'),chain=pd.pivot.getObjectByName('Meshy interlocking chain');
      check(!!weight&&!!chain,'pendulum '+i+' missing a part');
      check(chain.levels[0].object.isInstancedMesh,'chain '+i+' not instanced');
      check(weight.levels.length===2&&chain.levels.length===2,'missing near/far LOD');
      check(Math.abs(weight.position.y+pd.len+.95)<1e-8,'weight does not follow bob origin');
      for(const t of [0,.4,1.1,3.3]){
        l.time=t;l.update(0);scene.updateMatrixWorld(true);
        const center=new THREE.Vector3(0,-pd.len,0).applyMatrix4(pd.pivot.matrixWorld);
        check(center.distanceTo(pd.box.getCenter(new THREE.Vector3()))<1e-5,'yaw/phase mismatch '+i);
      }
    }
    // Render the actual imported parts in a neutral close-up for material/chain review.
    const {HazardVisuals}=await import('/src/hazardVisuals.ts'),visuals=new HazardVisuals();
    const studio=new THREE.Scene();studio.background=new THREE.Color('#c5c9c6');
    studio.add(new THREE.HemisphereLight(0xffffff,0x68745e,3));
    const sun=new THREE.DirectionalLight(0xffeed9,4);sun.position.set(4,7,6);studio.add(sun);
    const pivot=new THREE.Group();pivot.position.set(0,5,0);studio.add(pivot);visuals.pendulum(pivot,4.6,[]);
    const crusher=new THREE.Mesh(new THREE.BoxGeometry(3,2.8,2.6),new THREE.MeshBasicMaterial());
    crusher.position.set(-3.4,1.4,0);studio.add(crusher);visuals.crusher(crusher,[3,2.8,2.6]);await visuals.ready();
    const camera=new THREE.PerspectiveCamera(39,1440/1000,.1,100);camera.position.set(7,5.8,11);camera.lookAt(-1.4,2.3,0);
    const renderer=new THREE.WebGLRenderer({antialias:true,preserveDrawingBuffer:true});renderer.setSize(1440,1000);
    renderer.setPixelRatio(1);renderer.outputColorSpace=THREE.SRGBColorSpace;renderer.toneMapping=THREE.ACESFilmicToneMapping;
    renderer.render(studio,camera);const image=renderer.domElement.toDataURL('image/png');
    const result={levels,crushers:l.crushers.length,pendulums:l.pendulums.length,assets:l.hazardAssetDiagnostics,failures,image};
    const roots=[...l.crushers.map(cr=>cr.mesh.getObjectByName('Meshy crusher boulder')),...l.pendulums.map(pd=>pd.pivot.getObjectByName('Meshy iron ball and interlocking chain'))].filter(Boolean);
    l.dispose();check(roots.every(root=>!root.parent),'hazard model survives level disposal');
    visuals.dispose();crusher.geometry.dispose();crusher.material.dispose();renderer.dispose();
    return result;
  });
  await writeFile(new URL('models.png',out),Buffer.from(report.image.split(',')[1],'base64'));delete report.image;
  await writeFile(new URL('global-review.json',out),JSON.stringify({...report,errors},null,2));
  console.log(JSON.stringify({...report,errors},null,2));
  assert.deepEqual(report.failures,[]);assert.deepEqual(errors,[]);
}finally{await browser.close();}
