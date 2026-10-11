// Real WebGL regression: camera rays, far-plane depth, seam filtering and water layering.
// PLAYWRIGHT_MODULE=/path/to/playwright/index.mjs node tools/test-sky-horizon-browser.mjs <vite URL>
import assert from 'node:assert/strict';
import {mkdir,writeFile} from 'node:fs/promises';
const {chromium}=await import(process.env.PLAYWRIGHT_MODULE||'playwright');
const base=process.argv[2]||'http://127.0.0.1:5322/';
const output=process.env.SKY_REVIEW_OUTPUT||'/private/tmp/sky-horizon-review';
await mkdir(output,{recursive:true});
const browser=await chromium.launch({headless:true,channel:'chrome'});
const page=await browser.newPage({viewport:{width:960,height:540}}),errors=[];
page.on('pageerror',e=>errors.push(e.message));page.on('console',m=>{if(m.type()==='error')errors.push(m.text());});
try {
  await page.route('**/__sky-review',r=>r.fulfill({contentType:'text/html',body:'<!doctype html><style>body{margin:0}</style>'}));
  await page.goto(new URL('__sky-review',base).href);
  const result=await page.evaluate(async()=>{
    const check=(ok,message)=>{if(!ok)throw Error(message);};
    const source=await(await fetch('/src/skyProjection.ts')).text();
    const THREE=await import(source.match(/import\s+\*\s+as\s+THREE\s+from\s+["']([^"']+)/)[1]);
    const {installSkyProjection}=await import('/src/skyProjection.ts');
    const renderer=new THREE.WebGLRenderer({antialias:false,preserveDrawingBuffer:true});
    renderer.setSize(320,180);renderer.domElement.style.width='960px';renderer.domElement.style.height='540px';document.body.append(renderer.domElement);
    const scene=new THREE.Scene(),camera=new THREE.PerspectiveCamera(60,16/9,.1,900);
    const fog=new THREE.Color('#94c9e0'),sea={value:1};scene.background=fog;
    const canvas=document.createElement('canvas');canvas.width=256;canvas.height=128;
    const ctx=canvas.getContext('2d');ctx.fillStyle='#ed5134';ctx.fillRect(0,0,256,64);ctx.fillStyle='#113399';ctx.fillRect(0,64,256,64);
    const texture=new THREE.CanvasTexture(canvas);texture.colorSpace=THREE.SRGBColorSpace;texture.wrapS=THREE.RepeatWrapping;texture.repeat.x=2;
    const material=new THREE.MeshBasicMaterial({map:texture,depthWrite:false,transparent:true});
    const sky=new THREE.Mesh(new THREE.PlaneGeometry(2,2),material);scene.add(sky);
    const hazeStrength={value:1};
    installSkyProjection(sky,{value:fog},hazeStrength,{value:0},sea);
    const read=()=>{const p=new Uint8Array(320*180*4);renderer.getContext().readPixels(0,0,320,180,renderer.getContext().RGBA,renderer.getContext().UNSIGNED_BYTE,p);return p;};
    const draw=()=>{camera.updateProjectionMatrix();camera.updateMatrixWorld(true);renderer.render(scene,camera);return read();};
    const equal=(a,b)=>a.every((n,i)=>n===b[i]);
    camera.position.set(0,4,0);camera.lookAt(0,4,-1);let reference=draw();
    let translations=0;
    for(const p of [[100,430,-2200],[-1800,-40,350],[0,1200,0],[3000,0,2000]]){
      camera.position.set(...p);camera.lookAt(p[0],p[1],p[2]-1);check(equal(reference,draw()),'Sky changed with camera translation '+p);translations++;
    }
    const rgb=new THREE.Color('#ed5134').toArray().map(c=>Math.round(THREE.ColorManagement.fromWorkingColorSpace(new THREE.Color(c,c,c),THREE.SRGBColorSpace).r*255));
    let views=0;const v=new THREE.Vector3();
    for(const fov of [35,65,110])for(const pitch of [-Math.PI/2,-1.1,-.2,0,.5,1.5,Math.PI/2])for(const roll of [0,.62,Math.PI]){
      camera.fov=fov;camera.rotation.set(pitch,1.7,roll,'YXZ');const pixels=draw();
      for(let y=2;y<180;y+=13)for(let x=2;x<320;x+=19){
        v.set((x+.5)/320*2-1,(y+.5)/180*2-1,.5).unproject(camera).sub(camera.position).normalize();
        if(v.y>.05){const at=(y*320+x)*4;check(pixels[at]>200&&pixels[at+3]===255,'Sky has a pole hole or an invalid ray');}
        if(v.y<-.015){const at=(y*320+x)*4;check(rgb.every((c,i)=>Math.abs(c-pixels[at+i])<=1),`Painted sky leaked below horizon (${fov},${pitch},${roll},${x},${y})`);}
      }views++;
    }
    // Even an explicitly enabled painted-sky haze cannot cover an open sea.
    ctx.fillStyle='#ed5134';ctx.fillRect(0,0,256,128);texture.needsUpdate=true;
    camera.position.set(0,4,0);camera.rotation.set(0,0,0);camera.fov=60;
    const clearShore=draw();
    for(let y=86;y<=93;y++)for(let x=10;x<310;x+=13){const i=(y*320+x)*4;
      check(Math.abs(clearShore[i]-237)<=1&&Math.abs(clearShore[i+1]-81)<=1&&Math.abs(clearShore[i+2]-52)<=1,'Fog obscured the visible island shoreline');}
    ctx.fillStyle='#113399';ctx.fillRect(0,64,256,64);texture.needsUpdate=true;
    // Each pass supplies its own camera, including a reflection below sea level.
    camera.rotation.set(0,0,0);camera.fov=60;reference=draw();
    const reflected=camera.clone();reflected.position.y=-430;reflected.rotation.x=-.4;reflected.updateMatrixWorld(true);
    // Oblique projection changes only the clip-plane row, never sky directions.
    renderer.render(scene,reflected);const reflectedPixels=read();reflected.projectionMatrix.elements[2]=.1;reflected.projectionMatrix.elements[6]=.7;reflected.projectionMatrix.elements[10]=.3;
    renderer.render(scene,reflected);check(equal(reflectedPixels,read()),'Oblique reflection distorted the sky');
    check(equal(reference,draw()),'Second camera contaminated the first camera');
    for(const far of [25,160,5000]){camera.far=far;check(equal(reference,draw()),'Sky clipped with far plane '+far);}
    // The background never repaints opaque geometry beyond the old 370m dome.
    const cube=new THREE.Mesh(new THREE.BoxGeometry(120,120,50),new THREE.MeshBasicMaterial({color:'#00ff00'}));
    camera.position.set(0,4,0);camera.lookAt(0,4,-1);camera.far=2000;cube.position.set(0,4,-650);scene.add(cube);
    let pixels=draw();let at=(90*320+160)*4;check(pixels[at+1]>240&&pixels[at]<5,'Sky covered distant opaque geometry');scene.remove(cube);
    // Transparent far water is drawn after sky, so it retains its own colour.
    cube.material.transparent=true;cube.material.opacity=.5;cube.material.depthWrite=false;cube.renderOrder=-20;scene.add(cube);pixels=draw();
    check(pixels[at+1]>100,'Sky covered transparent horizon water');scene.remove(cube);
    // Filtered full-longitude wrap: both sides of the atan branch use the same mip.
    for(let y=0;y<128;y+=4){ctx.fillStyle=(y/4)%2?'#22dd44':'#ee4422';ctx.fillRect(0,y,256,4);}
    texture.needsUpdate=true;sea.value=0;hazeStrength.value=0;camera.rotation.set(.15,-Math.PI/2,0);pixels=draw();
    let maxSeam=0;for(let y=10;y<170;y++)for(let c=0;c<3;c++)maxSeam=Math.max(maxSeam,Math.abs(pixels[(y*320+157)*4+c]-pixels[(y*320+159)*4+c]),Math.abs(pixels[(y*320+160)*4+c]-pixels[(y*320+162)*4+c]));check(maxSeam<=4,'Longitude seam selected a different mip');
    // Orthographic inspection uses one parallel viewing direction.
    ctx.fillStyle='#ffcc66';ctx.fillRect(0,0,256,128);texture.needsUpdate=true;
    const ortho=new THREE.OrthographicCamera(-1000,1000,600,-600,.1,5000);ortho.position.set(1500,800,400);ortho.lookAt(1500,800,-1);ortho.updateMatrixWorld(true);renderer.render(scene,ortho);pixels=read();check(pixels[at]>240,'Orthographic sky did not cover the viewport');
    // One draw, no render targets, no extra textures for the sea/haze layers.
    check(renderer.info.render.calls===1,'Sky introduced additional draws');
    const memory={...renderer.info.memory},calls=renderer.info.render.calls;
    check(memory.textures===1,'The reflected sea must reuse the sky texture');
    check(renderer.getContext().getError()===0,'WebGL error');
    // Real ocean: elevated/sideways views beyond every old strip boundary.
    const {UnityOcean}=await import('/src/unityOcean.ts');
    const ocean=new UnityOcean({seaLevel:-35,shoreDirX:1,shoreDirZ:0,quality:'lite',
      shore:[{x:0,z:20},{x:0,z:-20}],oceanWidth:30,lateralSegments:4});
    const deadline=performance.now()+15000;
    while(!ocean.group.visible){check(performance.now()<deadline,'Ocean textures did not load');await new Promise(r=>setTimeout(r,20));}
    scene.add(ocean.group);sky.visible=false;scene.fog=null;
    camera.position.set(1400,1000,-700);camera.up.set(0,0,-1);camera.lookAt(1400,-35,-700);camera.far=25;
    ocean.update(0,camera);ocean.ribbon.visible=false;
    let oceanCases=0;
    for(const color of [0x224488,0xd08a7e,0x1b2540]){
      ocean.setSkyUrl('review',color);pixels=draw();
      const wanted=[color>>16,(color>>8)&255,color&255];
      for(let i=0;i<pixels.length;i+=4)check(wanted.every((c,k)=>Math.abs(c-pixels[i+k])<=1),'Infinite ocean exposed an edge or ignored the atmosphere');
      oceanCases++;
    }
    check(renderer.info.render.calls===1,'Far sea must remain one draw');
    check(renderer.info.render.triangles===2,'Far sea should use only two triangles');
    // A highly visible fog colour must not recolour the sea/sky join. The
    // real panorama reflection wins, without another render target or texture.
    scene.fog=new THREE.Fog(0xff00ff,1,2);ocean.setHorizonSky(texture);
    camera.position.set(1400,-34,-700);camera.up.set(0,1,0);camera.lookAt(1401,-34,-700);
    pixels=draw();const shorelinePixel=(89*320+160)*4;
    check(pixels[shorelinePixel]>220&&pixels[shorelinePixel+1]>150&&pixels[shorelinePixel+2]<160,'Fog replaced the reflected shoreline colour');
    scene.fog=null;ocean.setHorizonSky(null);camera.position.set(1400,1000,-700);camera.up.set(0,0,-1);camera.lookAt(1400,-35,-700);
    // Analytic depth still respects land above the sea, and covers submerged land.
    camera.far=3000;cube.material.transparent=false;cube.material.opacity=1;cube.material.depthWrite=true;cube.position.set(1400,100,-700);scene.add(cube);pixels=draw();
    check(pixels[at+1]>240&&pixels[at]<5,'Far sea painted over land above its surface');
    cube.position.y=-300;pixels=draw();check(pixels[at+1]<80,'Submerged land painted over the sea');
    scene.remove(cube);let disposedSky=0;texture.addEventListener('dispose',()=>disposedSky++);
    ocean.setHorizonSky(texture);ocean.dispose();check(disposedSky===0,'Water disposed the borrowed sky texture');
    check(renderer.getContext().getError()===0,'Ocean WebGL error');
    return {translations,views,reflection:true,orthographic:true,farPlanes:[25,160,5000],maxSeam,calls,memory,oceanCases,oceanTriangles:2,unobscuredShoreline:true,reflectedSkyIgnoresFog:true,borrowedTextureLifetime:true};
  });
  assert.deepEqual(errors,[]);await writeFile(`${output}/projection.json`,JSON.stringify({result,errors},null,2));console.log(JSON.stringify(result));
}finally{await browser.close();}
