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
const {DESERT_CANYON_LEVEL:main}=await load('src/levels/desert-canyon.ts');
const {DUSTY_ROAD_BONUS_LEVEL:bonus}=await load('src/levels/dusty-road-bonus.ts');
assert.ok(validDesertHeat(main.desertHeat));assert.ok(validDesertHeat(bonus.desertHeat));
assert.equal(main.desertHeat.length,42);assert.equal(bonus.desertHeat.length,7);
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
heat.configure('bonus:bryce-canyon',bonus.desertHeat);assert.equal(heat.diagnostics.patches,7);
heat.configure('warproom',patch);assert.equal(heat.diagnostics.patches,0);assert.equal(heat.diagnostics.copySize,null);
heat.dispose();hdr.dispose();
console.log('PASS desert-only scope, bounded authored pockets, bonus depth placement, near fade, HDR/size changes, draw/copy count, failure restoration and level-exit release');
