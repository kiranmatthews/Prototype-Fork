import assert from 'node:assert/strict';
import {build} from 'esbuild';
import {mkdir,writeFile} from 'node:fs/promises';
const bundled=await build({stdin:{contents:"export {CarlisleSteelDecks} from './src/carlisleSteelDecks'; export * as THREE from 'three'; export {CARLISLE_TIDAL_RELAY_LEVEL} from './src/levels/carlisle-tidal-relay';",resolveDir:process.cwd()},bundle:true,format:'esm',write:false});
const {CarlisleSteelDecks,THREE,CARLISLE_TIDAL_RELAY_LEVEL:level}=await import('data:text/javascript;base64,'+Buffer.from(bundled.outputFiles[0].text).toString('base64'));
const decks=new CarlisleSteelDecks(),root=new THREE.Group(),report={decks:[],errors:[]};
for(const c of level.components.filter(c=>c.t==='mover'&&c.bounce===undefined)){
 // Carlisle stores its native boxes as authored meshes, rather than relying
 // on primitive generation. Prove their eight corners before fitting a shell.
 if(c.vertices){
  const corners=new Set();for(let i=0;i<c.vertices.length;i+=3)corners.add(c.vertices.slice(i,i+3).join(':'));
  const expected=new Set();for(const x of [-1,1])for(const y of [-1,1])for(const z of [-1,1])expected.add([x*c.s[0]/2,y*c.s[1]/2,z*c.s[2]/2].join(':'));
  assert.deepEqual(corners,expected,'a rectangular shell must not replace a shaped mover');assert.equal(c.indices.length,36);
 }
 const parent=new THREE.Group();root.add(parent);decks.add(c.s,parent);parent.updateMatrixWorld(true);
 const [w,h,d]=c.s,shell=parent.children[0],bounds=new THREE.Box3().setFromObject(shell,true),row={name:c.nm,size:c.s,bounds:{min:bounds.min.toArray(),max:bounds.max.toArray()},raySamples:0,maxContactDepth:0};
 assert.ok(bounds.min.toArray().every((n,i)=>n>=-c.s[i]/2-1e-6));assert.ok(bounds.max.toArray().every((n,i)=>n<=c.s[i]/2+1e-6));
 shell.traverse(n=>{if(!n.isMesh)return;for(const a of Object.values(n.geometry.attributes))for(const v of a.array)assert.ok(Number.isFinite(v),'non-finite geometry');});
 // Probe the whole interior, including panel seams: the visible skin stays
 // continuous and less than 17cm below native support, with no raised obstacle.
 const ray=new THREE.Raycaster();for(let iz=0;iz<=17;iz++)for(let ix=0;ix<=11;ix++){
  const x=(ix/11-.5)*(w-1.5),z=(iz/17-.5)*(d-1.5);ray.set(new THREE.Vector3(x,h/2+1,z),new THREE.Vector3(0,-1,0));const hit=ray.intersectObject(shell,true)[0];assert.ok(hit,'hole through the steel deck');const depth=h/2-hit.point.y;assert.ok(depth>=-1e-6&&depth<.17,'visible surface does not match native support');row.maxContactDepth=Math.max(row.maxContactDepth,depth);row.raySamples++;
 }
 report.decks.push(row);
}
assert.equal(report.decks.length,20);report.diagnostics={...decks.diagnostics};assert.equal(decks.diagnostics.templates,8);
const geoCount=new Set(root.children.flatMap(p=>p.children[0].children.map(m=>m.geometry.uuid))).size;assert.equal(geoCount,8*4,'template geometry was duplicated');report.sharedGeometryCount=geoCount;
decks.dispose();assert.ok(root.children.every(p=>!p.children.length));report.disposal=true;report.passed=true;
await mkdir('art/carlisle-shipyard/steel-decks',{recursive:true});await writeFile('art/carlisle-shipyard/steel-decks/geometry.json',JSON.stringify(report,null,2)+'\n');
console.log(JSON.stringify({passed:true,decks:report.decks.length,raySamples:report.decks.reduce((n,r)=>n+r.raySamples,0),...report.diagnostics,sharedGeometryCount:geoCount,disposal:true}));
