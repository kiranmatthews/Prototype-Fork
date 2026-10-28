import assert from 'node:assert/strict';import {writeFile} from 'node:fs/promises';import {createServer} from 'vite';import * as THREE from 'three';
const server=await createServer({appType:'custom',logLevel:'silent',server:{middlewareMode:true}});let crowd;
try{
 const {indexCrowdGeometry}=await server.ssrLoadModule('/src/golf-cart/crowdGeometry.ts');
 // Duplicate positions with different normals/articulation are not weldable.
 // Include signed zero and a one-bit difference: this is exact indexing.
 const g=new THREE.BufferGeometry();
 g.setAttribute('position',new THREE.Float32BufferAttribute([0,0,0,1,0,0,0,1,0,0,0,0,0,1,0,1,0,0,0,0,0,1,0,0,0,1,0],3));
 g.setAttribute('normal',new THREE.Float32BufferAttribute([0,0,1,0,0,1,0,0,1,0,0,1,0,0,1,0,0,1,-0,0,1,0,0,1,0,0,1],3));
 g.setAttribute('crowdSegment',new THREE.Float32BufferAttribute([0,0,0,0,0,0,0,1,0],1));
 const asBits=a=>new Uint32Array(a.array.buffer,a.array.byteOffset,a.array.length),before=Object.fromEntries(Object.entries(g.attributes).map(([k,a])=>[k,asBits(a).slice()]));
 indexCrowdGeometry(g);assert.equal(g.attributes.position.count,5);assert.equal(g.index.count,9);
 const expanded=g.toNonIndexed();for(const [k,bits]of Object.entries(before))assert.deepEqual(asBits(expanded.attributes[k]),bits,'Every corner retains the exact attribute bits, including its normal and articulation');
 g.dispose();expanded.dispose();
 const {StadiumCrowd}=await server.ssrLoadModule('/src/golf-cart/stadiumCrowd.ts');crowd=new StadiumCrowd();
 const people=crowd.sections[0].geometry,seats=crowd.root.children[1].geometry;
 assert.ok(crowd.count>64000&&crowd.count<70000);assert.equal(crowd.sections.length,196);assert.equal(people.index.count,1224);assert.equal(seats.index.count,72);
 assert.ok(people.attributes.position.count<1224*.6,'Complete spectator geometry avoids most duplicate vertex transforms');
 assert.ok(crowd.sections.every(m=>m.geometry===people&&m.frustumCulled),'One complete geometry, culled by stand section');
 const versions=crowd.sections.map(m=>[m.instanceMatrix.version,m.instanceColor.version]);for(const t of [0,.1,1,15,999])crowd.update(t);assert.deepEqual(crowd.sections.map(m=>[m.instanceMatrix.version,m.instanceColor.version]),versions,'Animation has no per-frame instance uploads');
 const bytes=g=>Object.values(g.attributes).reduce((n,a)=>n+a.array.byteLength,0)+(g.index?.array.byteLength??0);
 const raw=people.toNonIndexed(),rawSeats=seats.toNonIndexed();
 const report={passed:true,spectators:crowd.count,sections:crowd.sections.length,exactCornerBits:true,people:{corners:people.index.count,vertices:people.attributes.position.count,beforeBytes:bytes(raw),afterBytes:bytes(people),triangles:people.index.count/3},seats:{corners:seats.index.count,vertices:seats.attributes.position.count,beforeBytes:bytes(rawSeats),afterBytes:bytes(seats)},staticInstanceBuffers:true};
 raw.dispose();rawSeats.dispose();
 const {COCONUT_CART_RALLY_LEVEL}=await server.ssrLoadModule('/src/levels/coconut-cart-rally.ts'),flags=COCONUT_CART_RALLY_LEVEL.components.filter(c=>c.tex==='rally-cloth');
 assert.equal(flags.length,25);let seams=0,free=0,triangles=0;
 for(const flag of flags){
  assert.equal(flag.solid,false);assert.equal(flag.castShadow,false);assert.equal(flag.uvs.length/2,flag.vertices.length/3);assert.equal(flag.colors.length,flag.vertices.length);
  assert.ok(flag.vertices.every(Number.isFinite));assert.ok(flag.indices.every(n=>n>=0&&n<flag.vertices.length/3));
  for(let i=0;i<flag.uvs.length;i+=2){const v=flag.uvs[i+1];assert.ok(v===-1||(v>=0&&v<=1));if(v===0)seams++;if(v>0)free++;}
  triangles+=flag.indices.length/3;
 }
 assert.equal(seams,25*28*5,'Every pennant has a complete pinned top seam');assert.ok(free>12000);report.bunting={spans:flags.length,pennants:flags.length*28,seams,freeVertices:free,triangles};
 let geometryDisposals=0;people.addEventListener('dispose',()=>geometryDisposals++);seats.addEventListener('dispose',()=>geometryDisposals++);crowd.dispose();crowd=null;assert.equal(geometryDisposals,2);report.sharedGeometryDisposals=geometryDisposals;
 await writeFile(process.env.RALLY_PRESENTATION_REPORT??'/private/tmp/rally-pass4-presentation.json',JSON.stringify(report,null,2));console.log('PASS festival presentation',JSON.stringify(report));
}finally{crowd?.dispose();await server.close();}
