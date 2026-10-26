import type {JungleAssetSpec} from './jungleAssets';
import * as THREE from 'three';

/** Meshy scenery; dimensions are updated from the prepared source geometry. */
export const ROOFTOP_KOOK_ASSETS = {
 kookstormveranda:{file:'../rooftop-kook/storm-veranda',label:'Storm Parlour aged Meshy veranda',size:[26,15.97164,12.84518],wind:false,cellSize:45,normalStrength:.5,doubleSided:false,metalnessMap:true},
 kookstormrail:{file:'../rooftop-kook/storm-balustrade',label:'Storm Parlour worn white Meshy balustrade',size:[6,1.77221,.41154],wind:false,cellSize:45,normalStrength:.4,doubleSided:false,metalnessMap:true},
 kookclubhouse:{file:'../rooftop-kook/clubhouse',label:'Kook Club columned waterfront mansion',size:[40,21.68749,26.0183],wind:false,cellSize:75,normalStrength:.45,doubleSided:false,metalnessMap:true},
 kookmanor:{file:'../rooftop-kook/manor',label:'Pelican Point turret manor',size:[25.0,18.90383,20.79512],wind:false,cellSize:65,normalStrength:0,doubleSided:false},
 kookdormer:{file:'../rooftop-kook/dormer',label:'Cedar roof dormer and hydrangeas',size:[4.6,4.45673,3.68599],wind:false,cellSize:50,normalStrength:0,doubleSided:false},
 kookestate:{file:'../rooftop-kook/estate',label:'Kook town cedar estate',size:[26.0,17.71575,22.53924],wind:false,cellSize:65,normalStrength:0,doubleSided:false},
 kookcupola:{file:'../rooftop-kook/cupola',label:'Copper yacht-club cupola',size:[5.5,6.56678,5.42625],wind:false,cellSize:50,normalStrength:0,doubleSided:false},
 kookterrace:{file:'../rooftop-kook/terrace',label:'Striped parasol and Adirondack chairs',size:[5.4,4.71655,5.29424],wind:false,cellSize:50,normalStrength:0,doubleSided:false},
 kookhydrangea:{file:'../rooftop-kook/hydrangea',label:'Ivory hydrangea planter',size:[5.8,2.40065,2.67403],wind:false,cellSize:50,normalStrength:0,doubleSided:false},
} as const satisfies Record<string,JungleAssetSpec>;

export const ROOFTOP_KOOK_TEXTURES = {
 'kook-cedar':'rooftop-kook/cedar.webp',
 'kook-metal':'rooftop-kook/metal.webp',
 'kook-branch-metal':'rooftop-kook/metal.webp',
 'kook-paving':'coastal-town/paving-albedo.webp',
} as const;

/** Map the authored paired roof edges as short cross-sections, not one
 * ear-clipped cap: long diagonal triangles collapse the UVs around bends.
 * Only coplanar cap triangulation changes; every boundary and height stays. */
export function applyKookPolygonUVs(geometry:THREE.BufferGeometry,outline:readonly (readonly number[])[],width:number,depth:number,wall=false):void {
 const p=geometry.getAttribute('position'),n=geometry.getAttribute('normal');
 const repeatX=Math.max(1,Math.round(width/4))*4,repeatY=Math.max(1,Math.round(depth/4))*4;
 const half=outline.length/2,rows=Array.from({length:Math.floor(half)},(_,i)=>{
  const left=outline[i],right=outline[outline.length-1-i];
  return {left,right,x:(left[0]+right[0])/2,z:(left[1]+right[1])/2,width:Math.hypot(right[0]-left[0],right[1]-left[1]),along:0};
 });
 for(let i=1;i<rows.length;i++)rows[i].along=rows[i-1].along+Math.hypot(rows[i].x-rows[i-1].x,rows[i].z-rows[i-1].z);
 const cross=(a:readonly number[],b:readonly number[],c:readonly number[])=>
  (b[1]-a[1])*(c[0]-a[0])-(b[0]-a[0])*(c[1]-a[1]);
 const polygonArea=outline.reduce((sum,a,i)=>{const b=outline[(i+1)%outline.length];return sum+a[0]*b[1]-a[1]*b[0];},0);
 let stripArea=0,sign=0,valid=outline.length>=4&&Number.isInteger(half);
 for(let i=1;i<rows.length;i++){
  const a=rows[i-1],b=rows[i];
  for(const area of [cross(a.left,a.right,b.right),cross(a.left,b.right,b.left)]){
   if(Math.abs(area)<1e-7||(sign&&Math.sign(area)!==sign))valid=false;
   sign=Math.sign(area);stripArea+=area;
  }
 }
 valid&&=Math.abs(Math.abs(stripArea)-Math.abs(polygonArea))<1e-5;
 const positions:number[]=[],normals:number[]=[],uvs:number[]=[];
 const emit=(x:number,y:number,z:number,nx:number,ny:number,nz:number,u:number,v:number)=>{
  positions.push(x,y,z);normals.push(nx,ny,nz);uvs.push(u/repeatX,v/repeatY);
 };
 // Reuse the exact Float32 perimeter coordinates from the extrusion. This
 // also prevents a micron seam between the remapped caps and original sides.
 const vertex=(point:readonly number[])=>[Math.fround(point[0]),Math.fround(point[1])];
 let bottom=Infinity,top=-Infinity;
 for(let i=0;i<p.count;i++){bottom=Math.min(bottom,p.getY(i));top=Math.max(top,p.getY(i));}
 if(!wall&&valid){
  for(const [height,normal]of [[bottom,-1],[top,1]])for(let i=1;i<rows.length;i++){
   const a=rows[i-1],b=rows[i],corners=[
    {point:a.left,u:-a.width/2,v:a.along},{point:a.right,u:a.width/2,v:a.along},
    {point:b.right,u:b.width/2,v:b.along},{point:b.left,u:-b.width/2,v:b.along},
   ];
   const faces=sign===normal?[[0,1,2],[0,2,3]]:[[0,2,1],[0,3,2]];
   for(const face of faces)for(const k of face){const q=corners[k],[x,z]=vertex(q.point);emit(x,height,z,0,normal,0,q.u,q.v);}
  }
  geometry.userData.kookRoofSections=rows.length;
 }else{
  // Non-ribbon editor polygons use stable planar mapping rather than an
  // assumed centreline. Walls' hidden horizontal caps use the same fallback.
  for(let i=0;i<p.count;i++)if(Math.abs(n.getY(i))>.6)
   emit(p.getX(i),p.getY(i),p.getZ(i),n.getX(i),n.getY(i),n.getZ(i),p.getX(i),p.getZ(i));
 }
 const caps=positions.length/3;
 // Map each side triangle against one perimeter edge. Duplicated corners
 // retain a clean UV seam at the wrap, and vertical faces get vertical UVs.
 for(let i=0;i<p.count;i+=3){
  if(Math.abs(n.getY(i))>.6)continue;
  const x=(p.getX(i)+p.getX(i+1)+p.getX(i+2))/3,z=(p.getZ(i)+p.getZ(i+1)+p.getZ(i+2))/3;
  let nearest=Infinity,arc=0,edge={x:0,z:0,dx:1,dz:0,length:1,arc:0};
  for(let k=0;k<outline.length;k++){
   const a=outline[k],b=outline[(k+1)%outline.length],dx=b[0]-a[0],dz=b[1]-a[1],length=Math.hypot(dx,dz);
   if(length<1e-7)continue;
   const t=THREE.MathUtils.clamp(((x-a[0])*dx+(z-a[1])*dz)/(length*length),0,1),distance=Math.hypot(x-a[0]-t*dx,z-a[1]-t*dz);
   if(distance<nearest){nearest=distance;edge={x:a[0],z:a[1],dx,dz,length,arc};}
   arc+=length;
  }
  for(let k=i;k<i+3;k++){
   const along=edge.arc+((p.getX(k)-edge.x)*edge.dx+(p.getZ(k)-edge.z)*edge.dz)/edge.length;
   emit(p.getX(k),p.getY(k),p.getZ(k),n.getX(k),n.getY(k),n.getZ(k),along,p.getY(k));
  }
 }
 geometry.setAttribute('position',new THREE.Float32BufferAttribute(positions,3));
 geometry.setAttribute('normal',new THREE.Float32BufferAttribute(normals,3));
 geometry.setAttribute('uv',new THREE.Float32BufferAttribute(uvs,2));
 geometry.clearGroups();geometry.addGroup(0,caps,0);geometry.addGroup(caps,positions.length/3-caps,1);
 geometry.computeBoundingBox();geometry.computeBoundingSphere();
}
