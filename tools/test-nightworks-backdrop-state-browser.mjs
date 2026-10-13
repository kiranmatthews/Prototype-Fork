import assert from 'node:assert/strict';
const {chromium}=await import(process.env.PLAYWRIGHT_MODULE||'playwright');
import {mkdir,writeFile} from 'node:fs/promises';
const out=process.env.NIGHTWORKS_DEPTH_OUTPUT||'/private/tmp/nightworks-depth-proof';await mkdir(out,{recursive:true});
const base=process.argv.find(v=>/^http/.test(v))||'http://127.0.0.1:5236/';
const browser=await chromium.launch({headless:true,channel:'chrome'});
const page=await browser.newPage({viewport:{width:1440,height:900}}),errors=[];
page.on('pageerror',e=>errors.push(e.message));page.on('console',m=>{if(m.type()==='error')errors.push(m.text());});
try{
 await page.goto(`${base}?playtest&level=nightworks-after-hours`);
 await page.waitForFunction(()=>window.__game&&!window.__game.gameFlow.blocksGameplay,null,{timeout:90000});
 await page.evaluate(async()=>{const g=window.__game;await Promise.all([g.getLevel().prepareJungleAssets(),g.getLevel().prepareSurfaceImages()]);g.player.step=()=>{};});
 const proof=await page.evaluate(()=>{
   const g=window.__game,l=g.getLevel(),r=g.renderer,gl=r.getContext(),backdrop=l.nightworksBackdrop;
   const layers=['Monumental caldera horizon','Front caldera rim','Lower caldera terraces'].map(n=>l.root.getObjectByName(n));
   let source;l.root.traverse(o=>{if(o.userData.jungleAsset==='nightbasalt'&&o.isInstancedMesh)source=o;});
   const scene=new g.scene.constructor(),copies=layers.map(o=>{const c=new o.constructor(o.geometry,o.material);o.updateWorldMatrix(true,false);c.matrix.copy(o.matrixWorld);c.matrixAutoUpdate=false;c.renderOrder=o.renderOrder;c.frustumCulled=false;scene.add(c);return c;});
   copies[0].onBeforeRender=layers[0].onBeforeRender;
   const rock=new source.constructor(source.geometry,source.material,1);rock.setMatrixAt(0,new source.matrix.constructor().identity());rock.instanceMatrix.needsUpdate=true;
   rock.scale.set(110,90,110);rock.position.copy(g.camera.position).addScaledVector(g.camera.getWorldDirection(rock.position.clone()),500);rock.frustumCulled=false;scene.add(rock);
   const red=new layers[0].material.constructor({color:0xff0000,toneMapped:false});
   const previous=r.getRenderTarget(),ratio=r.getPixelRatio(),viewport=r.getViewport({copy:v=>({x:v.x,y:v.y,z:v.z,w:v.w})}),scissor=r.getScissor({copy:v=>({x:v.x,y:v.y,z:v.z,w:v.w})}),scissorTest=r.getScissorTest();
   const width=r.domElement.width,height=r.domElement.height;
   const target=backdrop.target.clone();target.setSize(320,240);
   const grab=()=>{const a=new Uint8Array(width*height*4);r.setRenderTarget(null);r.clear();r.render(scene,g.camera);gl.readPixels(0,0,width,height,gl.RGBA,gl.UNSIGNED_BYTE,a);return a;};
   const state=()=>({target:r.getRenderTarget()===target,face:r.getActiveCubeFace(),mip:r.getActiveMipmapLevel(),
     logicalViewport:r.getViewport({copy:v=>[v.x,v.y,v.z,v.w]}),physicalViewport:Array.from(gl.getParameter(gl.VIEWPORT)),
     logicalScissor:r.getScissor({copy:v=>[v.x,v.y,v.z,v.w]}),physicalScissor:Array.from(gl.getParameter(gl.SCISSOR_BOX)),
     logicalScissorTest:r.getScissorTest(),physicalScissorTest:gl.isEnabled(gl.SCISSOR_TEST),autoClear:r.autoClear,
     xr:r.xr.enabled,shadowAuto:r.shadowMap.autoUpdate,shadowNeeds:r.shadowMap.needsUpdate});
   try{
     rock.visible=false;const clean=grab();rock.visible=true;rock.material=red;const marker=grab();rock.material=source.material;const blended=grab();
     let pixels=0,total=0,max=0,changed=0;
     for(let i=0;i<clean.length;i+=4)if(marker[i]>220&&marker[i+1]<25&&marker[i+2]<25){
       pixels++;const d=Math.abs(clean[i]-blended[i])+Math.abs(clean[i+1]-blended[i+1])+Math.abs(clean[i+2]-blended[i+2]);total+=d;max=Math.max(max,d);if(d>6)changed++;
     }
     rock.visible=false;let before,after;
     copies[0].onBeforeRender=(...args)=>{before=state();layers[0].onBeforeRender(...args);after=state();};
     r.setPixelRatio(2);r.setViewport(1,2,300,200);r.setScissor(2,3,300,199);r.setScissorTest(false);
     target.viewport.set(19,13,211,157);target.scissor.set(23,17,199,143);target.scissorTest=true;r.setRenderTarget(target);
     r.render(scene,g.camera);
     return {fade:{coveredPixels:pixels,meanRgbDifference:total/Math.max(1,pixels),maxRgbDifference:max,pixelsOverSix:changed},stateBefore:before,stateAfter:after,stateEqual:JSON.stringify(before)===JSON.stringify(after)};
   }finally{scene.clear();red.dispose();rock.dispose();target.dispose();r.setPixelRatio(ratio);r.setRenderTarget(previous);r.setViewport(viewport.x,viewport.y,viewport.z,viewport.w);r.setScissor(scissor.x,scissor.y,scissor.z,scissor.w);r.setScissorTest(scissorTest);}
 });
 assert.deepEqual(errors,[]);assert.equal(proof.stateEqual,true,'nested capture must preserve logical and physical render state');
 assert.ok(proof.fade.coveredPixels>1000,'the comparison covers a real rendered rock');
 // MSAA leaves small silhouette differences: average agreement stays below two byte values per RGB channel.
 assert.ok(proof.fade.meanRgbDifference<6&&proof.fade.pixelsOverSix<proof.fade.coveredPixels*.08,'faded rock must match the backdrop');
 console.log(JSON.stringify({proof,errors},null,2));console.log('PASS native backdrop blend and high-DPI render state.');await writeFile(`${out}/blend-state.json`,JSON.stringify({proof,errors},null,2));
}finally{await browser.close();}
