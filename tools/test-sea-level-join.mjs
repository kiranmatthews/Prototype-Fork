// WebGL coverage test for a physically closed sky-dome/sea-plane boundary.
import assert from 'node:assert/strict';
import {mkdir,writeFile} from 'node:fs/promises';
const {chromium}=await import(process.env.PLAYWRIGHT_MODULE||'playwright');
const base=process.argv[2]||'http://127.0.0.1:5322/';
const output=process.env.SKY_REVIEW_OUTPUT||'/private/tmp/sea-level-join';await mkdir(output,{recursive:true});
const browser=await chromium.launch({headless:true,channel:'chrome'}),page=await browser.newPage(),errors=[];
page.on('pageerror',e=>errors.push(e.message));page.on('console',m=>{if(m.type()==='error')errors.push(m.text());});
try{
 await page.route('**/__sea-level-join',r=>r.fulfill({contentType:'text/html',body:'<!doctype html>'}));await page.goto(new URL('__sea-level-join',base).href);
 const result=await page.evaluate(async()=>{
  const check=(ok,m)=>{if(!ok)throw Error(m);};
  const source=await(await fetch('/src/skyProjection.ts')).text();
  const THREE=await import(source.match(/import\s+\*\s+as\s+THREE\s+from\s+["']([^"']+)/)[1]);
  const {installSkyProjection}=await import('/src/skyProjection.ts'),{UnityOcean}=await import('/src/unityOcean.ts'),{seaBackdropRadius}=await import('/src/seaBackdrop.ts');
  const renderer=new THREE.WebGLRenderer({antialias:false,preserveDrawingBuffer:true});renderer.setSize(192,108);document.body.append(renderer.domElement);
  const gl=renderer.getContext(),scene=new THREE.Scene();scene.background=new THREE.Color('#00ff00');scene.fog=new THREE.Fog('#00ff00',1,2);
  const canvas=document.createElement('canvas');canvas.width=128;canvas.height=64;const ctx=canvas.getContext('2d');ctx.fillStyle='#c04030';ctx.fillRect(0,0,128,64);
  const texture=new THREE.CanvasTexture(canvas);texture.colorSpace=THREE.SRGBColorSpace;texture.wrapS=THREE.RepeatWrapping;texture.repeat.set(2,2);texture.offset.set(0,-1);
  const sky=new THREE.Mesh(new THREE.PlaneGeometry(2,2),new THREE.MeshBasicMaterial({map:texture,depthWrite:false,transparent:true}));scene.add(sky);
  const mode={value:0};const control=installSkyProjection(sky,{value:new THREE.Color('#00ff00')},{value:1},{value:0},mode);
  let camera=new THREE.PerspectiveCamera(65,16/9,.1,900);const pixels=new Uint8Array(192*108*4);let cases=0,maxGapPixels=0,maxEdgeError=0;
  const cutRows=[];let orthographicCases=0,farPlaneCases=0;
  const blue=new THREE.DataTexture(new Uint8Array([0,0,255,255]),1,1);blue.colorSpace=THREE.SRGBColorSpace;blue.needsUpdate=true;
  const render=()=>{camera.updateProjectionMatrix();camera.updateMatrixWorld(true);renderer.render(scene,camera);gl.readPixels(0,0,192,108,gl.RGBA,gl.UNSIGNED_BYTE,pixels);};
  const positions=[[0,1,0],[1200,40,-2400],[-1000,430,2300],[2000,1200,-4000]];
  const details=[];
  for(const seaLevel of [-35,0,250]){
   const ocean=new UnityOcean({seaLevel,shoreDirX:1,shoreDirZ:0,quality:'lite',shore:[{x:0,z:20},{x:0,z:-20}],oceanWidth:30,lateralSegments:4});
   const deadline=performance.now()+15000;while(!ocean.group.visible){check(performance.now()<deadline,'Ocean textures timed out');await new Promise(r=>setTimeout(r,10));}
   scene.add(ocean.group);control.setSeaLevel(seaLevel);ocean.update(0,camera);ocean.ribbon.visible=false;ocean.setHorizonSky(texture);
   const attribute=sky.geometry.getAttribute('position'),uv=sky.geometry.getAttribute('uv'),bottom=[];
   for(let i=0;i<attribute.count;i++){check(attribute.getY(i)>=0,'Sky contains geometry below its cut');if(attribute.getY(i)===0){bottom.push(i);check(uv.getY(i)===.5,'Cut does not use exactly the bottom image edge');}}
   check(bottom.length===97,'All 96 shoreline segments need a shared sea-level edge');
   for(const [x,h,z]of positions)for(const fov of [35,65,110])for(const pitch of [-Math.PI/2,-.3,0,.7,Math.PI/2])for(const roll of [0,.6]){
    camera.position.set(x,seaLevel+h,z);camera.fov=fov;camera.rotation.set(pitch,1.7,roll,'YXZ');render();
    let gaps=0;const gapPoints=[];for(let i=0;i<pixels.length;i+=4)if(pixels[i]<20&&pixels[i+1]>230&&pixels[i+2]<20){gaps++;
      if(gapPoints.length<3){const px=(i/4)%192,py=Math.floor(i/4/192),ray=new THREE.Vector3((px+.5)/192*2-1,(py+.5)/108*2-1,.5).unproject(camera).sub(camera.position).normalize();
       const t=-h/ray.y;gapPoints.push({px,py,ray:ray.toArray(),radial:t*Math.hypot(ray.x,ray.z),radius:sky.matrixWorld.elements[0],rgb:[pixels[i],pixels[i+1],pixels[i+2]]});}}
    maxGapPixels=Math.max(maxGapPixels,gaps);check(gaps===0,`Exposed background gap: sea=${seaLevel}, height=${h}, fov=${fov}, pitch=${pitch}, roll=${roll}, pixels=${gaps}, detail=${JSON.stringify(gapPoints)}`);
    const point=new THREE.Vector3();for(const i of bottom){point.fromBufferAttribute(attribute,i).applyMatrix4(sky.matrixWorld);maxEdgeError=Math.max(maxEdgeError,Math.abs(point.y-seaLevel));}
    cases++;
   }
   // The image/sea boundary must move with its actual projected world Y,
   // rather than staying on the eye-level row when the camera climbs.
   ocean.setHorizonSky(blue);ocean.horizonMaterial.uniforms.uNearColor.value.setRGB(0,0,1);
   ocean.horizonMaterial.uniforms.uPeak.value.w=0;ocean.horizonMaterial.uniforms.uWave1.value.y=0;ocean.horizonMaterial.uniforms.uWave2.value.y=0;
   for(const height of [1,430,1200])for(const fov of [35,65,110]){
    camera.position.set(2400,seaLevel+height,-600);camera.rotation.set(0,0,0);camera.fov=fov;render();
    const radius=sky.matrixWorld.elements[0],rim=new THREE.Vector3(camera.position.x,seaLevel,camera.position.z-radius).project(camera);
    const expected=(rim.y+1)*54;let measured=-1;
    for(let y=0;y<108;y++){const i=(y*192+96)*4;if(pixels[i]<20&&pixels[i+1]<20&&pixels[i+2]>90)measured=y+.5;}
    check(Math.abs(measured-expected)<1.5,`World cut mismatch: height ${height}, expected ${expected}, rendered ${measured}`);
    cutRows.push({seaLevel,height,fov,expected,measured});
   }
   const perspective=camera;
   for(const extent of [500,3000]){
    camera=new THREE.OrthographicCamera(-extent,extent,extent*9/16,-extent*9/16,.1,900);
    const height=extent*2+100;camera.position.set(1000,seaLevel+height,2200);camera.updateMatrixWorld(true);
    const radius=seaBackdropRadius(camera.position.y,seaLevel,camera);camera.lookAt(1000,seaLevel,2200-radius);render();
    check(!pixels.some((n,i)=>i%4===0&&n<20&&pixels[i+1]>230&&pixels[i+2]<20),'Orthographic boundary gap');orthographicCases++;
   }
   camera=perspective;camera.position.set(1200,seaLevel+430,-2000);camera.rotation.set(-.15,.4,.3);render();const reference=pixels.slice();
   for(const far of [25,160,900,5000]){camera.far=far;render();check(reference.every((n,i)=>n===pixels[i]),'Backdrop changed at draw distance '+far);farPlaneCases++;}
   ocean.setHorizonSky(texture);
   // Radius and Y anchoring use the actual camera of each render, including reflection.
   camera.position.set(0,seaLevel+430,0);camera.rotation.set(.15,0,0);render();const radius=sky.matrixWorld.elements[0];
   const reflected=camera.clone();reflected.position.y=seaLevel-430;reflected.rotation.x=-.15;reflected.updateMatrixWorld(true);ocean.group.visible=false;renderer.render(scene,reflected);
   check(sky.matrixWorld.elements[13]===seaLevel,'Reflected camera moved the sky cut away from sea level');check(sky.matrixWorld.elements[0]===radius,'Reflection changed dome radius');
   details.push({seaLevel,segments:bottom.length-1,skyTriangles:sky.geometry.index.count/3,waterTriangles:ocean.group.getObjectByName('Unity ocean horizon fill').geometry.index.count/3});
   scene.remove(ocean.group);ocean.dispose();
  }
  check(maxEdgeError===0,'Sky edge was not exactly on the sea plane');check(gl.getError()===0,'WebGL error');
  control.setSeaLevel(null);check(sky.geometry.type==='PlaneGeometry','Non-ocean backdrop was not restored');
  return {cases,maxGapPixels,maxEdgeError,cutRows,orthographicCases,farPlaneCases,details,reflection:true,noFogMask:true};
 });
 assert.deepEqual(errors,[]);console.log(JSON.stringify(result));await writeFile(`${output}/result.json`,JSON.stringify({result,errors},null,2));
}finally{await browser.close();}
