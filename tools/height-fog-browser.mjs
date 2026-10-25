import assert from 'node:assert/strict';
import {mkdir,writeFile} from 'node:fs/promises';
import {build} from 'esbuild';
const {chromium}=await import(process.env.PLAYWRIGHT_MODULE||'playwright');
const base=(process.argv[2]||'http://127.0.0.1:5267').replace(/\/$/,'');
const out=process.env.ROOFTOP_OUTPUT||'docs/rooftop-kook/coastal-detail';await mkdir(out,{recursive:true});
const fixture=await build({stdin:{contents:"export * as THREE from 'three'; export {HeightFog} from './src/heightFog';",resolveDir:process.cwd()},bundle:true,format:'esm',write:false});
const browser=await chromium.launch({headless:true,channel:'chrome'}),page=await browser.newPage(),errors=[];
page.on('pageerror',e=>errors.push(e.message));page.on('console',m=>{if(m.type()==='error')errors.push(m.text());});
try{
 await page.route('**/fog-fixture.js',r=>r.fulfill({contentType:'application/javascript',body:fixture.outputFiles[0].text}));
 await page.goto(`${base}/?lite`);
 const {samples,passes}=await page.evaluate(async()=>{
  const {THREE,HeightFog}=await import('/fog-fixture.js');
  const renderer=new THREE.WebGLRenderer();renderer.setSize(1,1);renderer.outputColorSpace=THREE.LinearSRGBColorSpace;renderer.toneMapping=THREE.NoToneMapping;
  const scene=new THREE.Scene();scene.fog=new THREE.Fog(0xffffff,100000,100001);
  const material=new THREE.MeshBasicMaterial({color:0x000000,side:THREE.DoubleSide}),mesh=new THREE.Mesh(new THREE.PlaneGeometry(.01,.01),material);scene.add(mesh);
  const camera=new THREE.PerspectiveCamera(45,1,.01,10000),target=new THREE.WebGLRenderTarget(1,1,{type:THREE.UnsignedByteType}),pixel=new Uint8Array(4),fog=new HeightFog();
  const profile={height:0,density:.08,falloff:.2,slope:[.025,0],contour:[[-200,-5],[-90,0],[-20,12],[50,18]]};
  const fixtures=[
   {name:'planar',a:[0,17,0],b:[0,10,-40],profile:{height:0,density:.16,falloff:.3}},
   {name:'across three grades',a:[10,23,30],b:[-7,4,-180],profile},
   {name:'clear roof ray',a:[3,30,20],b:[-3,19,-130],profile},
   {name:'reverse direction',a:[-3,19,-130],b:[3,30,20],profile},
   {name:'parallel at knot',a:[-15,21,-20],b:[15,15,-20],profile},
   {name:'below fog datum',a:[0,10,80],b:[-40,-18,-100],profile},
   {name:'past final knot',a:[0,35,100],b:[0,30,60],profile},
   {name:'before first knot',a:[0,3,-270],b:[5,5,-220],profile},
  ];
  const results=[];
  for(const sample of fixtures){
   const p=sample.profile;camera.position.fromArray(sample.a);camera.lookAt(new THREE.Vector3().fromArray(sample.b));camera.updateMatrixWorld();mesh.position.fromArray(sample.b);mesh.quaternion.copy(camera.quaternion);mesh.scale.setScalar(10000);scene.updateMatrixWorld(true);
   fog.update(scene,camera.position,p,new THREE.Color(0xffffff),true);renderer.setRenderTarget(target);renderer.render(scene,camera);renderer.readRenderTargetPixels(target,0,0,1,1,pixel);
   // Independent dense midpoint integration of the continuous density field.
   // This checks the actual compiled fragment shader, including knot crossings.
   let optical=0;const steps=20000,length=Math.hypot(...sample.b.map((v,i)=>v-sample.a[i]));
   for(let i=0;i<steps;i++){
    const t=(i+.5)/steps,[x,y,z]=sample.a.map((v,k)=>v+(sample.b[k]-v)*t);let datum=p.height+(p.slope?.[0]??0)*x+(p.slope?.[1]??0)*z;
    if(p.contour){const points=p.contour;let k=0;while(k<points.length-2&&z>=points[k+1][0])k++;const a=points[k],b=points[k+1];datum=a[1]+(z-a[0])*(b[1]-a[1])/(b[0]-a[0])+(p.slope?.[0]??0)*x;}
    optical+=p.density*Math.exp(-p.falloff*(y-datum))*length/steps;
   }
   results.push({name:sample.name,expected:1-Math.exp(-optical),actual:pixel[0]/255});
  }
  // Reuse the exact same world material in the fog-free HUD scene. Its
  // overlay coordinates lie below the roof datum but must never gain haze.
  camera.position.set(0,0,4);camera.lookAt(0,0,0);camera.updateMatrixWorld(true);
  mesh.position.set(0,0,0);mesh.quaternion.copy(camera.quaternion);scene.updateMatrixWorld(true);
  fog.update(scene,camera.position,{height:50,density:.16,falloff:.3},new THREE.Color(0xffffff),true);
  const worldFog=scene.fog,passes=[];
  for(const [name,sceneFog,materialFog,expected] of [
   ['world',worldFog,true,1],['HUD scene',null,true,0],['material opt-out',worldFog,false,0],['world resumed',worldFog,true,1],
  ]){
   scene.fog=sceneFog;material.fog=materialFog;material.needsUpdate=true;
   renderer.render(scene,camera);renderer.readRenderTargetPixels(target,0,0,1,1,pixel);
   passes.push({name,expected,actual:pixel[0]/255});
  }
  fog.dispose();material.dispose();mesh.geometry.dispose();target.dispose();renderer.dispose();return {samples:results,passes};
 });
 await writeFile(out+'/fog-gpu.json',JSON.stringify({samples,passes,errors},null,2)+'\n');
 for(const sample of [...samples,...passes])assert.ok(Math.abs(sample.actual-sample.expected)<.006,JSON.stringify(sample));
 assert.deepEqual(errors,[]);console.log('PASS continuous fog contour and world/HUD/material fog boundaries',JSON.stringify({samples,passes}));
}finally{await browser.close();}
