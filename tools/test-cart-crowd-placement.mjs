import assert from 'node:assert/strict';
import {readFile,writeFile} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import {createServer} from 'vite';
import * as THREE from 'three';

const server=await createServer({appType:'custom',logLevel:'silent',server:{middlewareMode:true}});
let crowd;
try{
 const {COCONUT_CART_RALLY_LEVEL:level}=await server.ssrLoadModule('/src/levels/coconut-cart-rally.ts');
 const {StadiumCrowd}=await server.ssrLoadModule('/src/golf-cart/stadiumCrowd.ts');
 crowd=new StadiumCrowd();
 const stands=level.components.filter(c=>c.nm==='Stepped stadium grandstand');
 const snapshot=JSON.parse(await readFile('public/levels.json','utf8')).levels.find(l=>l.id==='coconut-cart-rally').data;
 const digest=value=>createHash('sha256').update(JSON.stringify(value)).digest('hex');
 assert.equal(digest(level),digest(snapshot),'The crowd fix must preserve the complete published course geometry');
 assert.equal(crowd.count,32958,'Keep every spectator');assert.equal(crowd.sections.length,stands.length);
 const ray=new THREE.Raycaster(),matrix=new THREE.Matrix4(),point=new THREE.Vector3(),down=new THREE.Vector3(0,-1,0),unsupported=[];
 const geometry=new THREE.BufferGeometry(),material=new THREE.MeshBasicMaterial({side:THREE.DoubleSide});
 const stand=new THREE.Mesh(geometry,material);let checked=0,maxAnchorError=0;
 for(const [section,people]of crowd.sections.entries()){
  const source=stands[section],seats=crowd.root.children[section*2+1];
  geometry.setAttribute('position',new THREE.Float32BufferAttribute(source.vertices,3));geometry.setIndex(source.indices);geometry.computeBoundingSphere();geometry.computeBoundingBox();
  stand.position.set(...source.p);stand.updateMatrixWorld(true);
  for(let i=0;i<people.count;i++){
   people.getMatrixAt(i,matrix);point.setFromMatrixPosition(matrix);
   const anchor=point.clone();seats.getMatrixAt(i,matrix);point.setFromMatrixPosition(matrix);
   assert.ok(point.distanceTo(anchor)<1e-5,'People and their seats share the same supported root');
   ray.set(anchor.clone().addScaledVector(down,-.02),down);ray.near=0;ray.far=.04;
   const hits=ray.intersectObject(stand,false);
   let error=Math.min(...hits.map(hit=>Math.abs(hit.point.y-anchor.y)));
   if(error>.001){
    // An instance exactly on a panel seam may round just outside either
    // raycast triangle. Measure the real Float32 surface within 1 mm there.
    const triangle=new THREE.Triangle(),nearest=new THREE.Vector3(),positions=geometry.attributes.position,indices=geometry.index;
    for(let j=0;j<indices.count;j+=3){
     triangle.a.fromBufferAttribute(positions,indices.getX(j));triangle.b.fromBufferAttribute(positions,indices.getX(j+1));triangle.c.fromBufferAttribute(positions,indices.getX(j+2));
     error=Math.min(error,triangle.closestPointToPoint(anchor,nearest).distanceTo(anchor));
    }
   }
   if(error>.001)unsupported.push({section,index:i,position:anchor.toArray(),error});
   else maxAnchorError=Math.max(maxAnchorError,error);
   checked++;
  }
 }
 geometry.dispose();material.dispose();
 assert.deepEqual(unsupported,[],'Every crowd/seat root must lie on a rendered grandstand triangle');
 const versions=crowd.sections.map(m=>m.instanceMatrix.version);for(const t of [0,5,55,3600])crowd.update(t);
 assert.deepEqual(crowd.sections.map(m=>m.instanceMatrix.version),versions,'Cheering still uses static instance buffers');
 const report={passed:true,checked,sections:stands.length,unsupported:unsupported.length,maxAnchorError,courseGeometryUnchanged:true,gpuOnlyAnimation:true};
 await writeFile(process.env.CART_CROWD_REPORT??'/private/tmp/cart-crowd-placement.json',JSON.stringify(report,null,2)+'\n');console.log('PASS crowd placement',JSON.stringify(report));
}finally{crowd?.dispose();await server.close();}
