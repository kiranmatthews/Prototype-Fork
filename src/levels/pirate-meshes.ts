import * as THREE from 'three';
import type { CustomComponent } from '../level';
export type P = [number, number, number];
export const SEA = { timber:'#754832', honey:'#b5804e', dark:'#352d2b', iron:'#394a51', brass:'#d2a557', stone:'#435c63', pale:'#8da19e', teal:'#3b817d', sail:'#d8cbb0', gold:'#efbd55' };
/** Authoring-only mesh toolkit. Output is ordinary bounded editable level data. */
export function pirateMeshes(out:CustomComponent[]) {
 let group=1;
 const setGroup=(id:number)=>{group=id;};
 const mesh=(name:string,vertices:number[],color:string,solid=false,extra:Partial<CustomComponent>={})=>{
  for(let start=0;start<vertices.length;start+=12285){
   const unique:number[]=[],indices:number[]=[],lookup=new Map<string,number>();
   for(let i=start;i<Math.min(vertices.length,start+12285);i+=3){
    const point=vertices.slice(i,i+3).map(v=>Math.round(v*1000)/1000),key=point.join(',');
    let index=lookup.get(key);if(index===undefined){index=unique.length/3;lookup.set(key,index);unique.push(...point);}indices.push(index);
   }
   out.push({t:'mesh',p:[0,0,0],vertices:unique,indices,color,tex:'solid',solid,doubleSided:true,edgeGrinding:false,grp:group,nm:name,...extra});
  }
 };
 const triangle=(v:number[],a:P,b:P,c:P)=>v.push(...a,...b,...c);
 const quad=(v:number[],a:P,b:P,c:P,d:P)=>{triangle(v,a,b,c);triangle(v,a,c,d);};
 const geometry=(name:string,g:THREE.BufferGeometry,p:P,s:P,color:string,rotation:P=[0,0,0],solid=false)=>{
  const geo=g.index?g.toNonIndexed():g;geo.scale(...s);geo.rotateX(rotation[0]);geo.rotateY(rotation[1]);geo.rotateZ(rotation[2]);geo.translate(...p);
  mesh(name,Array.from(geo.getAttribute('position').array),color,solid);geo.dispose();if(geo!==g)g.dispose();
 };
 const box=(name:string,p:P,s:P,color=SEA.timber,rotation:P=[0,0,0],solid=false)=>geometry(name,new THREE.BoxGeometry(1,1,1),p,s,color,rotation,solid);
 const beam=(name:string,a:P,b:P,r:number,color=SEA.timber,sides=6)=>{
  const g=new THREE.CylinderGeometry(r,r*.9,Math.hypot(...b.map((n,i)=>n-a[i])),sides,1);
  g.applyQuaternion(new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0,1,0),new THREE.Vector3(...b).sub(new THREE.Vector3(...a)).normalize()));
  geometry(name,g,a.map((n,i)=>(n+b[i])/2) as P,[1,1,1],color);
 };
 const rock=(name:string,p:P,s:P,seed=0,color=SEA.stone)=>{
  const g=new THREE.IcosahedronGeometry(1,0),pos=g.getAttribute('position');
  for(let i=0;i<pos.count;i++){const x=pos.getX(i),y=pos.getY(i),z=pos.getZ(i),f=1+.14*Math.sin(x*7+y*11+z*13+seed);pos.setXYZ(i,x*f,y*f,z*f);}
  geometry(name,g,p,s,color,[seed*.17,seed*.51,seed*.09]);
 };
 const rope=(name:string,a:P,b:P,sag=1,r=.07)=>{
  const points=Array.from({length:9},(_,i)=>{const t=i/8;return a.map((n,k)=>n+(b[k]-n)*t-(k===1?Math.sin(t*Math.PI)*sag:0)) as P;});
  for(let i=1;i<points.length;i++)beam(name,points[i-1],points[i],r,SEA.honey,5);
 };
 const barrel=(p:P,size=1)=>{
  const rings=[[-.01,.62],[.15,.73],[.85,.83],[1.55,.73],[1.72,.62]],v:number[]=[];
  for(let k=1;k<rings.length;k++)for(let i=0;i<10;i++){
   const pt=(ring:number,j:number):P=>[p[0]+Math.cos(j*Math.PI/5)*rings[ring][1]*size,p[1]+rings[ring][0]*size,p[2]+Math.sin(j*Math.PI/5)*rings[ring][1]*size];
   quad(v,pt(k-1,i),pt(k-1,i+1),pt(k,i+1),pt(k,i));
  }mesh('Oak barrel staves',v,SEA.timber);
  for(const y of [.18,1.48])geometry('Barrel iron hoop',new THREE.TorusGeometry(.745,.055,4,10),[p[0],p[1]+y*size,p[2]],[size,size,size],SEA.iron,[Math.PI/2,0,0]);
  geometry('Barrel lid',new THREE.CylinderGeometry(.62,.62,.07,10),[p[0],p[1]+1.72*size,p[2]],[size,size,size],SEA.honey);
 };
 const lantern=(p:P)=>{
  box('Brass lantern frame',[p[0],p[1]+.48,p[2]],[.68,1,.68],SEA.dark);
  box('Amber lantern glass',[p[0],p[1]+.48,p[2]+.35],[.44,.65,.04],'#edb564');
  out.push({t:'torch',p,rise:.8,w:.45,grp:group,nm:'Smugglers lantern'});
 };
 return {setGroup,mesh,triangle,quad,geometry,box,beam,rock,rope,barrel,lantern};
}
