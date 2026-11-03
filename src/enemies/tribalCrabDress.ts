import * as THREE from 'three';
import {mergeGeometries} from 'three/examples/jsm/utils/BufferGeometryUtils.js';

/** Simple carved rectangles leave real eye openings. These accessories follow
 * the existing crab's head and claws, outside its deformation/physics model. */
export function dressTribalCrab(head?:THREE.Object3D,left?:THREE.Object3D,right?:THREE.Object3D){
 const meshes:THREE.Mesh[]=[],material=new THREE.MeshStandardMaterial({vertexColors:true,roughness:.94});
 const wood='#784525',light='#d0a257',paint='#ece1ad',teal='#477e67';
 const build=(parent:THREE.Object3D|undefined,name:string,draw:(add:(g:THREE.BufferGeometry,color:string,p:number[],turn?:number)=>void)=>void)=>{
  if(!parent)return;
  const parts:THREE.BufferGeometry[]=[];
  draw((g,color,p,turn=0)=>{
   const flat=g.index?g.toNonIndexed():g;if(flat!==g)g.dispose();
   flat.rotateZ(turn);flat.translate(p[0],p[1],p[2]);
   const c=new THREE.Color(color),colors=new Float32Array(flat.attributes.position.count*3);
   for(let i=0;i<colors.length;i+=3)colors.set([c.r,c.g,c.b],i);
   flat.setAttribute('color',new THREE.BufferAttribute(colors,3));parts.push(flat);
  });
  const geometry=mergeGeometries(parts);for(const p of parts)p.dispose();
  const mesh=new THREE.Mesh(geometry,material);mesh.name=name;mesh.castShadow=mesh.receiveShadow=true;parent.add(mesh);meshes.push(mesh);
 };
 const box=(x:number,y:number,z:number)=>new THREE.BoxGeometry(x,y,z);
 build(head,'Tribal crab · open carved mask',add=>{
  add(box(.66,.13,.10),wood,[0,.33,.21]);
  add(box(.66,.30,.10),wood,[0,-.10,.21]);
  for(const side of [-1,1]){
   add(box(.12,.32,.10),wood,[side*.27,.13,.21]);
   add(box(.26,.045,.025),paint,[side*.17,.32,.273],side*-.12);
   add(box(.21,.04,.025),teal,[side*.18,-.14,.273],side*.18);
   add(box(.10,.35,.045),light,[side*.21,.52,.19],side*-.35);
  }
  add(box(.11,.31,.17),light,[0,.12,.24]);
  add(box(.10,.45,.045),teal,[0,.56,.19]);
  add(box(.28,.055,.03),paint,[0,-.03,.276]);
 });
 build(left,'Tribal crab · timber shield',add=>{
  for(let i=-1;i<=1;i++)add(box(.10,.42-Math.abs(i)*.05,.07),i===0?light:wood,[i*.105,.04,.15]);
  add(box(.28,.045,.025),paint,[0,.10,.20]);add(box(.045,.29,.025),teal,[0,.04,.20]);
 });
 build(right,'Tribal crab · carved wooden spear',add=>{
  add(new THREE.CylinderGeometry(.018,.025,.85,6),wood,[.04,.25,.10]);
  add(new THREE.ConeGeometry(.085,.21,4),light,[.04,.78,.10]);
  add(new THREE.CylinderGeometry(.035,.035,.09,6),teal,[.04,.64,.10]);
 });
 return{triangles:meshes.reduce((n,m)=>n+(m.geometry.index?.count??m.geometry.attributes.position.count)/3,0),
  dispose(){for(const mesh of meshes){mesh.removeFromParent();mesh.geometry.dispose();}material.dispose();}};
}
