import assert from 'node:assert/strict';
import { readFile, readdir } from 'node:fs/promises';
import { createServer } from 'vite';
import * as THREE from 'three';
const names=await readdir(new URL('../public/hud/milk-bottle/',import.meta.url));
assert.equal(names.filter(x=>x.endsWith('.png')).length,101);
for(let frame=0;frame<=100;frame++){
  const name=`milk_${String(frame).padStart(3,'0')}.png`;
  const png=await readFile(new URL(`../public/hud/milk-bottle/${name}`,import.meta.url));
  assert.equal(png.subarray(1,4).toString(),'PNG');
  assert.equal(png.readUInt32BE(16),256);assert.equal(png.readUInt32BE(20),256);
  assert.equal(png[25],6,'bottle frame lost RGBA transparency');
}
let active=0,peak=0;const urls=new Set();
globalThis.Image=class {
  listeners=new Map();naturalWidth=0;naturalHeight=0;width=256;height=256;
  addEventListener(name,fn){this.listeners.set(name,fn);}
  set src(value){this.url=value;urls.add(value);peak=Math.max(peak,++active);queueMicrotask(()=>{
    active--;this.naturalWidth=this.naturalHeight=256;this.onload?.();this.listeners.get('load')?.();
  });}
};
const server=await createServer({logLevel:'silent',server:{middlewareMode:true}});
try{
  const {MilkBottleFill,MilkBottleHud,prepareMilkBottleFrames}=await server.ssrLoadModule('/src/milkBottleHud.ts');
  const fill=new MilkBottleFill();
  for(const count of [0,1,25,50,75,99,100])assert.equal(fill.update(count,0,1/60),count);
  fill.reset();fill.update(98,10,0);assert.equal(fill.update(0,12,1/60),100,'full bottle skipped on rollover');
  assert.equal(fill.update(2,14,.1),100);
  const draining=fill.update(2,14,.33);assert.ok(draining>2&&draining<100,'bottle did not animate down');
  assert.equal(fill.update(2,14,.43),0,'drink never reached empty');
  assert.equal(fill.update(2,14,.25),2,'milk earned during drinking was lost visually');
  fill.update(99,100,1);fill.reset();assert.equal(fill.update(0,100,0),0,'level reset invented a refill');
  fill.reset();fill.update(99,20,0,0);assert.equal(fill.update(99,200,.01,0),99,'bonus paid visually before arrival');
  assert.equal(fill.update(1,200,.01,2),100,'bonus rollover missed full frame');
  const a=new MilkBottleHud(),b=new MilkBottleHud();a.update(25,1,0);b.update(80,1,0);
  await prepareMilkBottleFrames();
  assert.equal(urls.size,101,'frames were fetched repeatedly');assert.ok(peak<=8,'unbounded frame loading');
  assert.equal(a.displayedFrame,25);assert.equal(b.displayedFrame,80);
  const mesh=a.group.children[0],texture=mesh.material.map;
  assert.notEqual(texture,b.group.children[0].material.map,'players share a mutable bottle texture');
  assert.equal(texture.colorSpace,THREE.SRGBColorSpace);assert.equal(texture.generateMipmaps,false);
  mesh.material=mesh.material.clone();mesh.material.opacity=.4;
  a.update(51,27,0);
  assert.equal(mesh.material.map,texture,'fill changes allocated another GPU texture');
  assert.equal(mesh.material.opacity,.4,'fill update erased reveal fade');
  assert.ok(texture.image.url.endsWith('milk_051.png'));
  assert.equal(b.displayedFrame,80,'P1 changed P2 fill');
  assert.deepEqual(a.group.rotation.toArray(),[0,0,0,'XYZ'],'PNG bottle acquired rotation');
  const {presentationAssets}=await server.ssrLoadModule('/src/presentationLoading.ts');
  assert.equal(presentationAssets.diagnostics.pending.length,0,'frames left loading gate pending');
  console.log('PASS 101 RGBA bottle frames, exact fill selection, animated drink/empty rollover, bonus/reset handling, bounded shared loading and independent clone-safe HUD textures.');
}finally{await server.close();}
