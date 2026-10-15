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
const server=await createServer({appType:'custom',logLevel:'silent',server:{middlewareMode:true,hmr:false,ws:false}}),report={meshes:0,triangles:0,vertices:0,closedRims:0,openEdges:0};let kit;
try{
 const {HollowwakeTunnels}=await server.ssrLoadModule('/src/hollowwakeTunnels.ts'),{HOLLOWWAKE_LEVEL}=await server.ssrLoadModule('/src/levels/hollowwake-descent.ts');
 kit=new HollowwakeTunnels();const scene=new THREE.Scene();scene.add(kit.root);
 for(const c of HOLLOWWAKE_LEVEL.components)if(c.dkind==='hollowcavebore')kit.add(c);else if(c.dkind==='hollowglowfungus')kit.addGlow(c);
 await kit.ready();assert.deepEqual(kit.diagnostics.failures,[]);assert.equal(kit.diagnostics.ready,kit.diagnostics.bores);assert.ok(kit.diagnostics.ready>300);
 kit.root.traverse(o=>{if(!o.isMesh)return;report.meshes++;const g=o.geometry;
  for(const name of ['position','normal','uv']){const a=g.getAttribute(name);assert.ok(a,`${name} exists`);assert.ok([...a.array].every(Number.isFinite),`${name} finite`);}
  assert.ok([...g.boundingBox.min.toArray(),...g.boundingBox.max.toArray(),g.boundingSphere.radius].every(Number.isFinite),'finite culling bounds');
  report.vertices+=g.getAttribute('position').count;report.triangles+=(g.index?.count??g.getAttribute('position').count)/3;
  assert.ok(g.userData.rockThickness>=2,'fitted skin has real rock thickness');report.closedRims+=g.userData.closedRims;
  const p=g.getAttribute('position'),keys=Array.from({length:p.count},(_,i)=>[p.getX(i),p.getY(i),p.getZ(i)].join(',')),edges=new Map();
  for(let i=0;i<g.index.count;i+=3){const v=[0,1,2].map(j=>keys[g.index.getX(i+j)]);if(new Set(v).size<3)continue;for(let j=0;j<3;j++){const a=v[j],b=v[(j+1)%3],key=a<b?a+'|'+b:b+'|'+a;edges.set(key,(edges.get(key)||0)+1);}}
  const open=[...edges.values()].filter(n=>n===1).length;report.openEdges+=open;
  assert.equal(open,0,'cut rock is closed after position welding');
 });
 for(const p of [HOLLOWWAKE_LEVEL.spawn,[0,-85,-2470]])kit.setView(new THREE.Vector3(...p));
 const m=await server.ssrLoadModule('/src/levels/hollowwake-descent.ts'),{BoulderChase,BoulderChaseCamera}=await server.ssrLoadModule('/src/boulderChase.ts');report.sightlines=[];
 for(const at of [0,180,200,220,270,364,610,1400,2470]){
  const p=new THREE.Vector3(...m.hollowPoint(at,m.hollowFork(at)?0:-1)),chase=new BoulderChase(m.HOLLOWWAKE_LEVEL.boulderChase,Array.from({length:6},()=>({mesh:new THREE.Mesh(),box:new THREE.Box3(),r:6.2,speed:0})),p);
  for(const f of chase.forks)f.choice=0;chase.reset(p);chase.actors[chase.stage].drop=0;chase.actors[chase.stage].reveal=0;
  const camera=new THREE.PerspectiveCamera(50,16/9,.1,300);new BoulderChaseCamera().update(camera,chase,p,32,1/60,true);kit.setView(camera.position);scene.updateMatrixWorld(true);const meshes=[];kit.root.traverseVisible(o=>{if(o.isMesh)meshes.push(o);});
  const target=chase.sampleCamera(chase.project(p)-28,new THREE.Vector3()).add(new THREE.Vector3(0,6.2,0)),direction=target.clone().sub(camera.position),ray=new THREE.Raycaster(camera.position,direction.clone().normalize(),0,direction.length()-6.2),hits=ray.intersectObjects(meshes,false);assert.equal(hits.length,0,'tunnel art obscures the pursuing boulder at '+at);report.sightlines.push({at,hits:hits.slice(0,3).map(h=>({distance:h.distance,point:h.point.toArray(),group:h.object.parent.name,thickness:h.object.geometry.userData.rockThickness}))});
 }
 // This first-fork view formerly hit a floating strip left by module end caps.
 const p=new THREE.Vector3(...m.hollowPoint(220,0)),chase=new BoulderChase(m.HOLLOWWAKE_LEVEL.boulderChase,Array.from({length:6},()=>({mesh:new THREE.Mesh(),box:new THREE.Box3(),r:6.2,speed:0})),p);
 chase.reset(p);for(const f of chase.forks)f.choice=0;chase.actors[chase.stage].drop=0;chase.actors[chase.stage].reveal=0;
 const camera=new THREE.PerspectiveCamera(50,16/9,.1,300);new BoulderChaseCamera().update(camera,chase,p,0,1/60,true);kit.setView(camera.position);const meshes=[];kit.root.traverseVisible(o=>{if(o.isMesh)meshes.push(o);});
 const ray=new THREE.Raycaster();ray.setFromCamera(new THREE.Vector2(-.27,.62),camera);ray.far=55;report.forkStripHits=ray.intersectObjects(meshes,false).length;assert.equal(report.forkStripHits,0,'no cap strip across the first fork');
 report.diagnostics=kit.diagnostics;report.pass=true;console.log(JSON.stringify(report));
 const output=process.env.HOLLOWWAKE_EVIDENCE_DIR??join(tmpdir(),'hollowwake-evidence');await mkdir(output,{recursive:true});await writeFile(join(output,'asset-geometry.json'),JSON.stringify(report,null,2));
}finally{kit?.dispose();await server.close();globalThis.fetch=nativeFetch;globalThis.Request=NativeRequest;}
