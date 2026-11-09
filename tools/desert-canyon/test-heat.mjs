import assert from 'node:assert/strict';
import {build} from 'esbuild';
import * as THREE from 'three';
const load=async path=>{
  const result=await build({entryPoints:[path],bundle:true,platform:'node',format:'esm',write:false,packages:'external'});
  // External package imports resolve from this task checkout, not a data URL.
  const {writeFile,unlink}=await import('node:fs/promises');
  const file=new URL('./.heat-test-bundle.mjs',import.meta.url);await writeFile(file,result.outputFiles[0].text);
  try{return await import(file.href+'?source='+encodeURIComponent(path));}finally{await unlink(file);}
};
const {validDesertHeat,hasDesertHeat}=await load('src/desertHeatData.ts');
const {DesertHeatMirage}=await load('src/desertHeatMirage.ts');
const {DESERT_CANYON_LEVEL:main,desertPoint,DESERT_LENGTH}=await load('src/levels/desert-canyon.ts');
const {DUSTY_ROAD_BONUS_LEVEL:bonus}=await load('src/levels/dusty-road-bonus.ts');
assert.ok(validDesertHeat(main.desertHeat));assert.ok(validDesertHeat(bonus.desertHeat));
assert.ok(main.desertHeat.length<=128,'stay within the existing instanced-patch budget');
assert.equal(bonus.desertHeat.length,7);
assert.ok(main.desertHeat.every(p=>p.strength>=1.45&&p.strength<=1.75),'improve coverage without increasing distortion strength');
// Sample between checkpoints too: the next stretch of road needs a band before
// it disappears around another bend. Actual terrain occlusion is checked by
// heat-route-review.html using frozen GPU frames from the gameplay camera.
const routeCamera=new THREE.PerspectiveCamera(70,16/9,.1,2000),frustum=new THREE.Frustum(),projection=new THREE.Matrix4();
for(let s=155;s<DESERT_LENGTH-80;s+=25){
  const at=new THREE.Vector3(...desertPoint(s)),ahead=new THREE.Vector3(...desertPoint(s+14));
  const heading=ahead.clone().sub(at).setY(0).normalize();
  routeCamera.position.copy(at).addScaledVector(heading,-8);routeCamera.position.y+=3.6;
  routeCamera.lookAt(ahead);routeCamera.updateMatrixWorld();
  frustum.setFromProjectionMatrix(projection.multiplyMatrices(routeCamera.projectionMatrix,routeCamera.matrixWorldInverse));
  assert.ok(main.desertHeat.some(p=>{
    const centre=new THREE.Vector3(...p.p),depth=-centre.clone().applyMatrix4(routeCamera.matrixWorldInverse).z;
    return depth>=30&&depth<=120&&frustum.intersectsSphere(new THREE.Sphere(centre,Math.hypot(...p.size)));
  }),`no heat band ahead of the gameplay camera at ${s} m`);
}
assert.ok(hasDesertHeat('bonus:bryce-canyon'),'normal campaign bonus transition has a colon ID');
assert.ok(main.desertHeat.every(p=>p.size[0]>p.size[1]*4));
assert.ok(bonus.desertHeat.every(p=>p.p[2]<-30),'bonus heat belongs behind all playable shelves');
for(const id of ['jungle','warproom','factory-fuss','bonus-factory-fuss','bryce-canyon-copy','bonus-jungle'])assert.equal(hasDesertHeat(id),false);
for(const data of [null,{},[{p:[0,NaN,0],size:[1,1],strength:1}],[{p:[0,0,0],size:[0,1],strength:1}],
  [{p:[0,0,0],size:[1,1],strength:4}],Array(129).fill(main.desertHeat[0])])assert.equal(validDesertHeat(data),false);
const heat=new DesertHeatMirage(),camera=new THREE.PerspectiveCamera(45,16/9,.1,2000),scene=new THREE.Scene();
camera.updateMatrixWorld();const patch=[{p:[0,0,-100],size:[20,3],strength:1.5}];
let bound=null,draws=0,copies=0,throwOnHeat=false,width=1280,height=720;
const renderer={autoClear:false,getRenderTarget:()=>bound,getActiveCubeFace:()=>0,getActiveMipmapLevel:()=>0,
  getViewport:v=>v.set(0,0,width,height),setViewport(){},setRenderTarget:t=>{bound=t;},
  getCurrentViewport:v=>v.set(0,0,width,height),getDrawingBufferSize:v=>v.set(width,height),
  copyFramebufferToTexture(texture){copies++;assert.equal(texture.image.width,width);},
  render(s){draws++;if(s!==scene&&throwOnHeat)throw new Error('heat draw failed');}};
heat.configure('jungle',patch);assert.equal(heat.render(renderer,scene,camera,null),false);assert.equal(copies,0);
heat.configure('bryce-canyon',patch);assert.equal(heat.render(renderer,scene,camera,null),true);
assert.equal(draws,2);assert.equal(copies,1);assert.equal(renderer.autoClear,false);
const hdr=new THREE.WebGLRenderTarget(640,360,{type:THREE.HalfFloatType});width=640;height=360;
heat.render(renderer,scene,camera,hdr);assert.equal(heat.diagnostics.textureType,THREE.HalfFloatType);assert.equal(bound,null);
assert.deepEqual(heat.diagnostics.copySize,[640,360]);
throwOnHeat=true;assert.throws(()=>heat.render(renderer,scene,camera,hdr),/heat draw failed/);
assert.equal(bound,null);assert.equal(renderer.autoClear,false);throwOnHeat=false;
camera.position.z=-90;camera.updateMatrixWorld();assert.equal(heat.render(renderer,scene,camera,null),false,'heat fades away near the player');
camera.position.z=-70;camera.updateMatrixWorld();assert.equal(heat.render(renderer,scene,camera,null),true,'next bend can shimmer before the old 35 m exclusion');
heat.configure('bonus:bryce-canyon',bonus.desertHeat);assert.equal(heat.diagnostics.patches,7);
heat.configure('warproom',patch);assert.equal(heat.diagnostics.patches,0);assert.equal(heat.diagnostics.copySize,null);
heat.dispose();hdr.dispose();
console.log('PASS route camera coverage every 25 m, unchanged strength/budget, desert-only scope, bonus depth placement, near fade, HDR/size changes, draw/copy count, failure restoration and level-exit release');
