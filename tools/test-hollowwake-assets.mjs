import assert from 'node:assert/strict';
import {readFile,writeFile,mkdir} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {createServer} from 'vite';
import * as THREE from 'three';
const nativeFetch=globalThis.fetch,NativeRequest=globalThis.Request,root=new URL('../',import.meta.url);
globalThis.Request=class extends NativeRequest{constructor(input,init){super(typeof input==='string'?new URL(input,'http://headless.invalid').href:input,init);}};
globalThis.self=globalThis;
globalThis.ProgressEvent??=class{constructor(type,data){this.type=type;Object.assign(this,data);}};
globalThis.createImageBitmap=async()=>({width:1024,height:1024,close(){}});
globalThis.fetch=async input=>{
 const url=typeof input==='string'?input:input.url;if(url.startsWith('blob:'))return nativeFetch(input);
 const path=new URL(url,'http://headless.invalid').pathname;
 if(!/^\/(hollowwake|drowned-crown\/excellence)\/[\w-]+\.glb$/.test(path))throw Error('Unexpected fixture asset '+path);
 return new Response(await readFile(new URL('public'+path,root)));
};
const server=await createServer({appType:'custom',logLevel:'silent',server:{middlewareMode:true,hmr:false,ws:false}}),report={meshes:0,triangles:0,vertices:0};let kit;
try{
 const {HollowwakeTunnels}=await server.ssrLoadModule('/src/hollowwakeTunnels.ts'),{HOLLOWWAKE_LEVEL}=await server.ssrLoadModule('/src/levels/hollowwake-descent.ts');
 kit=new HollowwakeTunnels();const scene=new THREE.Scene();scene.add(kit.root);
 for(const c of HOLLOWWAKE_LEVEL.components)if(c.dkind==='hollowcavebore')kit.add(c);else if(c.dkind==='hollowglowfungus')kit.addGlow(c);
 await kit.ready();assert.deepEqual(kit.diagnostics.failures,[]);assert.equal(kit.diagnostics.ready,kit.diagnostics.bores);assert.ok(kit.diagnostics.ready>300);
 kit.root.traverse(o=>{if(!o.isMesh)return;report.meshes++;const g=o.geometry;
  for(const name of ['position','normal','uv']){const a=g.getAttribute(name);assert.ok(a,`${name} exists`);assert.ok([...a.array].every(Number.isFinite),`${name} finite`);}
  assert.ok([...g.boundingBox.min.toArray(),...g.boundingBox.max.toArray(),g.boundingSphere.radius].every(Number.isFinite),'finite culling bounds');
  report.vertices+=g.getAttribute('position').count;report.triangles+=(g.index?.count??g.getAttribute('position').count)/3;
 });
 for(const p of [HOLLOWWAKE_LEVEL.spawn,[0,-85,-2470]])kit.setView(new THREE.Vector3(...p));
 report.diagnostics=kit.diagnostics;report.pass=true;console.log(JSON.stringify(report));
 const output=process.env.HOLLOWWAKE_EVIDENCE_DIR??join(tmpdir(),'hollowwake-evidence');await mkdir(output,{recursive:true});await writeFile(join(output,'asset-geometry.json'),JSON.stringify(report,null,2));
}finally{kit?.dispose();await server.close();globalThis.fetch=nativeFetch;globalThis.Request=NativeRequest;}
