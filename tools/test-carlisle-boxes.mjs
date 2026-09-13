import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {runInThisContext} from 'node:vm';
import {createServer} from 'vite';
import * as THREE from 'three';
const h=await readFile(new URL('validate-editor-roundtrip.mjs',import.meta.url),'utf8');
runInThisContext(h.slice(h.indexOf('function installHeadlessDom()'),h.indexOf('\nfunction round('))+'\ninstallHeadlessDom();');
const nativeFetch=globalThis.fetch;globalThis.self=globalThis;globalThis.createImageBitmap=async()=>({width:1024,height:1024,close(){}});
globalThis.ProgressEvent??=class{constructor(type,data){this.type=type;Object.assign(this,data);}};
globalThis.fetch=async input=>{const url=typeof input==='string'?input:input.url;if(url.startsWith('blob:'))return nativeFetch(input);try{return new Response(await readFile(new URL('../public'+new URL(url,'http://headless.invalid').pathname,import.meta.url)));}catch{return new Response('',{status:404});}};
const server=await createServer({logLevel:'silent',server:{middlewareMode:true},appType:'custom'});
let level;
try{
 const {Level,normalizeCustomLevelData}=await server.ssrLoadModule('/src/level.ts');
 const {CARLISLE_COAST_LEVEL:data,CARLISLE_CRATES:boxes,CARLISLE_CRATE_SECTIONS:sections}=await server.ssrLoadModule('/src/levels/carlisle-coast.ts');
 const {CITY_BEAM_DEPTH,CITY_BEAM_WIDTH}=await server.ssrLoadModule('/src/cityAssets.ts');
 const normalized=normalizeCustomLevelData(data);assert.ok(normalized);assert.ok(boxes.length>=130&&boxes.length<=210,'a complete level-wide box pass');
 assert.equal(normalized.components.filter(c=>c.cameraCutaway).length,data.components.filter(c=>c.cameraCutaway).length,'cutaway flags survive editor normalization');
 const invalid=structuredClone(data);invalid.components[0].cameraCutaway='yes';assert.equal(normalizeCustomLevelData(invalid),null,'cutaway flags must be booleans');
 assert.equal(sections.length,20);assert.ok(sections.every(s=>s.count>0));
 const kinds=new Set(boxes.map(c=>c.kind));for(const kind of ['wood','metal','bouncy','metalbounce','mystery','multihit','life','mask','tnt','nitro','bang','nitrobang'])assert.ok(kinds.has(kind),kind);
 assert.equal(boxes.filter(c=>c.kind==='bang').length,2,'two distinct optional switch puzzles');
 const clear=boxes.filter(c=>c.kind==='nitrobang');assert.equal(clear.length,1);assert.ok(Math.abs(clear[0].p[0]-152)>=3,'finish route stays clear');
 level=new Level(new THREE.Scene(),{id:'test',name:data.name,data});await level.prepareJungleAssets();level.root.updateMatrixWorld(true);
 assert.deepEqual(level.cityAssetDiagnostics.errors,[]);assert.equal(level.crates.length,boxes.length,'no automatic duplicate box/switch');
 const ray=new THREE.Raycaster(),up=new THREE.Vector3(0,1,0),down=up.clone().negate();
 const floor=(x,y,z)=>{ray.set(new THREE.Vector3(x,y,z),down);ray.far=5;return ray.intersectObjects(level.groundMeshes,false)[0];};
 const supportErrors=[],wallErrors=[],railErrors=[];
 for(const [i,c] of level.crates.entries()){
  const x=(c.box.min.x+c.box.max.x)/2,z=(c.box.min.z+c.box.max.z)/2,y=c.box.min.y;
  const support=floor(x,y+.025,z),below=level.crates.find(other=>other!==c&&Math.abs(other.box.max.y-y)<.025&&Math.abs(other.box.min.x-c.box.min.x)<.025&&Math.abs(other.box.min.z-c.box.min.z)<.025);
  if(!below&&(!support||Math.abs(support.point.y-y)>.025))supportErrors.push({i,x,y,z,floor:support?.point.y});
  if(level.walls.some(b=>b.containsPoint(new THREE.Vector3(x,y+.45,z))))wallErrors.push({i,x,y,z});
  for(const rail of level.rails.filter(r=>r.object.userData.cityRail)){
   const contact=rail.closestXZ(new THREE.Vector3(x,y,z));
   if(contact.distXZ<.48+CITY_BEAM_WIDTH/2+.08&&contact.point.y+.09>y&&contact.point.y-.47<c.box.max.y)railErrors.push({i,x,y,z,rail:rail.object.userData.editorIdx});
  }
 }
 assert.deepEqual(supportErrors,[],'every box has ground or an authored stack beneath it');
 assert.deepEqual(wallErrors,[],'no boxes inside a collision wall');assert.deepEqual(railErrors,[],'box routes leave all visible grind beams clear');
 // Keep the dangerous landing/run-up parts empty; optional paths may carry
 // their own bounce puzzle away from these central travel corridors.
 for(const [x,z0,z1] of [[0,-288,-298],[0,-330,-350],[0,-410,-421],[0,-488,-502],[0,-575,-567],[0,-655,-666],[0,-818,-838],[0,-910,-919],[0,-1013,-1023],[0,-1565,-1581],[152,-1856,-1870],[152,-1955,-1959],[152,-2145,-2151],[152,-2220,-2228],[152,-2234,-2239]])
  assert.ok(boxes.every(c=>Math.abs(c.p[0]-x)>5||c.p[2]<Math.min(z0,z1)||c.p[2]>Math.max(z0,z1)),`clear run-up/landing ${z0}..${z1}`);
 let surfaceProbes=0,minGroundClearance=Infinity;
 for(const rail of level.rails.filter(r=>r.object.userData.cityRail))for(let t=.31;t<rail.totalLength-.1;t+=.73){
  const p=rail.pointAt(t),tangent=rail.tangentAt(t),normal=up.clone().addScaledVector(tangent,-tangent.y).normalize();
  ray.set(p.clone().addScaledVector(normal,1),normal.clone().negate());ray.far=2;
  const hit=ray.intersectObject(rail.object,true)[0];assert.ok(hit,'visible rail surface');
  const height=hit.point.clone().sub(p).dot(normal);assert.ok(Math.abs(height-.09)<.006,`top contact ${height} at ${p.toArray()}`);surfaceProbes++;
  const ground=floor(p.x,p.y+1,p.z);
  if(ground){const clearance=p.y+(.09-CITY_BEAM_DEPTH)*normal.y-ground.point.y;minGroundClearance=Math.min(minGroundClearance,clearance);assert.ok(clearance>.04,`beam buried in road at ${p.toArray()}: ${clearance}`);}
 }
 // Foreground scenery is cut away only in side view; real colliders remain.
 const camera=new THREE.Vector3(125,-10,-1711),beforeWalls=level.walls.map(b=>b.clone());
 level.updateCityVisibility(camera,false);
 const tagged=[];level.root.traverse(o=>{if(o.userData.cameraCutaway)tagged.push(o);});assert.ok(tagged.length>5,'foreground groups are explicitly marked');
 level.updateCityVisibility(camera,true);assert.ok(tagged.every(o=>!o.visible),'foreground obstruction hidden');
 level.updateCityVisibility(camera,false);assert.ok(tagged.some(o=>o.visible),'foreground restores for other views');
 assert.ok(beforeWalls.every((b,i)=>b.equals(level.walls[i])),'cutaway is render-only');
 // Both switches reveal only their own six-step crate stacks.
 for(const switchBox of level.crates.filter(c=>c.bang)){
  const pending=level.crates.filter(c=>c.pending),own=pending.filter(c=>c.groupIds.some(id=>switchBox.groupIds.includes(id)));
  assert.equal(own.length,6);level.breakCrate(switchBox);assert.ok(own.every(c=>!c.pending));assert.ok(pending.filter(c=>!own.includes(c)).every(c=>c.pending));
 }
 console.log(`PASS ${boxes.length} boxes in ${sections.length} sections, 12 box types, support/wall/rail clearance, both switch puzzles, ${surfaceProbes} actual rail-surface probes (min beam/road clearance ${minGroundClearance.toFixed(3)} m), side-view cutaway and collider retention.`);
}finally{level?.dispose();await server.close();}
