import * as THREE from 'three';
import {CART_RALLY_LENGTH,rallySurfacePoint,rallyMudWetness} from '../levels/cart-stadium-layout';
/** Static clumps of thrown loam break up the surface at wheel scale. Complete
 * shared geometry, chunk culling and immutable instance buffers at all ranges. */
export class RallyGroundClods {
 readonly root=new THREE.Group();
 private geometry=new THREE.IcosahedronGeometry(1,0);
 private material=new THREE.MeshStandardMaterial({color:'#b17b40',roughness:.97,flatShading:true});
 private chunks:THREE.InstancedMesh[]=[];
 readonly count:number;
 constructor(){
  this.root.name='Static track loam clumps';
  let seed=104729,total=0;const rand=()=>{seed=(Math.imul(seed,1664525)+1013904223)>>>0;return seed/4294967296;};
  const dummy=new THREE.Object3D(),colour=new THREE.Color();
  for(let start=38;start<CART_RALLY_LENGTH-30;start+=96){
   const mesh=new THREE.InstancedMesh(this.geometry,this.material,160);mesh.name='Track loam clump chunk';mesh.receiveShadow=true;mesh.frustumCulled=true;
   for(let i=0;i<160;i++){
    const s=start+rand()*Math.min(96,CART_RALLY_LENGTH-30-start),u=(rand()-.5)*32,p=rallySurfacePoint(s,u),wet=rallyMudWetness(s,u);
    const size=.045+Math.pow(rand(),2)*.15;
    dummy.position.set(p[0],p[1]-.025+size*.12,p[2]);dummy.rotation.set(rand()*.3,rand()*Math.PI*2,rand()*.3);dummy.scale.set(size*(.8+rand()),size*.48,size*(.7+rand()));dummy.updateMatrix();mesh.setMatrixAt(i,dummy.matrix);
    colour.setScalar((.7+rand()*.5)*(1-wet*.3));mesh.setColorAt(i,colour);
   }
   mesh.computeBoundingBox();mesh.computeBoundingSphere();this.root.add(mesh);this.chunks.push(mesh);total+=160;
  }
  this.count=total;
 }
 dispose(){this.root.removeFromParent();for(const m of this.chunks)m.dispose();this.geometry.dispose();this.material.dispose();}
}
