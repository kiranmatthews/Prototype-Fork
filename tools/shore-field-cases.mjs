import * as THREE from 'three';

/** Varied authored coast shapes, including duplicate-cell edges and ties. */
export function shoreFieldCases(){
 const bounds=(minX,minZ,maxX,maxZ)=>new THREE.Box3(new THREE.Vector3(minX,-50,minZ),new THREE.Vector3(maxX,50,maxZ));
 const plane=(width,length,slope,divisions=8)=>{
  const geometry=new THREE.PlaneGeometry(width,length,divisions,divisions).rotateX(-Math.PI/2),p=geometry.attributes.position;
  for(let i=0;i<p.count;i++)p.setY(i,-p.getX(i)*slope);
  geometry.computeVertexNormals();return new THREE.Mesh(geometry,new THREE.MeshStandardMaterial());
 };
 const bed=plane(96,112,0);bed.position.y=-3.25;
 const long=plane(120,1500,.12,1);
 const crossing=[plane(210,240,.18,18),plane(210,240,.18,18)];crossing[1].rotation.y=Math.PI;
 const rotated=plane(180,270,.23,24);rotated.position.set(-37,7,-61);rotated.rotation.y=.63;rotated.scale.set(.83,1.4,1.17);
 const island=new THREE.Mesh(new THREE.CylinderGeometry(14,44,12,36,6),new THREE.MeshStandardMaterial());island.position.set(-19,-1,23);
 const rippled=plane(230,190,0,34),p=rippled.geometry.attributes.position;
 for(let i=0;i<p.count;i++)p.setY(i,Math.sin(p.getX(i)*.08)*2.2+Math.cos(p.getZ(i)*.09)*1.7);
 rippled.geometry.computeVertexNormals();rippled.position.set(11,.025,-21);
 const skipped=[plane(100,100,.2),plane(100,100,.3),plane(100,100,.4)];skipped[0].visible=false;skipped[1].material.transparent=true;skipped[2].userData.noWaterShore=true;
 const instance=new THREE.InstancedMesh(new THREE.BoxGeometry(20,20,20),new THREE.MeshStandardMaterial(),1);instance.setMatrixAt(0,new THREE.Matrix4());skipped.push(instance);
 const cases=[
  {name:'empty',meshes:[],seaLevel:0,bounds:bounds(-44,-31,99,71)},
  {name:'bed-only',meshes:[bed],seaLevel:0,bounds:bounds(-64,-64,64,64)},
  {name:'long-straight',meshes:[long],seaLevel:0,bounds:bounds(-96,-800,96,800)},
  {name:'opposing-ties',meshes:crossing,seaLevel:0,bounds:bounds(-121,-130,117,141)},
  {name:'rotated-scaled-negative',meshes:[rotated],seaLevel:7,bounds:bounds(-210,-270,160,170)},
  {name:'island',meshes:[island],seaLevel:0,bounds:bounds(-107,-93,89,109)},
  {name:'ripples',meshes:[rippled],seaLevel:.025,bounds:bounds(-140,-145,150,125)},
  {name:'excluded-meshes',meshes:skipped,seaLevel:0,bounds:bounds(-64,-64,64,64)},
 ];
 for(const fixture of cases)for(const mesh of fixture.meshes)mesh.updateMatrixWorld(true);
 return cases;
}
export function disposeShoreCases(cases){
 for(const fixture of cases)for(const mesh of fixture.meshes){mesh.geometry.dispose();for(const material of Array.isArray(mesh.material)?mesh.material:[mesh.material])material.dispose();if(mesh.isInstancedMesh)mesh.dispose();}
}
