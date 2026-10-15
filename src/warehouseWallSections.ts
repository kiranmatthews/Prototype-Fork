import * as THREE from 'three';

/** Cut a complete Meshy wall section to an architectural opening. Scale its
 * face uniformly and interpolate the existing atlas UVs at cuts; never stretch
 * or repeat a texture to fill narrow window piers. A separate native wall
 * supplies containment and seals the hidden cut edges. */
export function fitWarehouseWallSection(source:THREE.BufferGeometry,nominal:readonly number[],size:readonly number[],baseAligned=false,variant=0):THREE.BufferGeometry {
 const [w,h,d]=size,scale=Math.max(w/nominal[0],h/nominal[1]);
 const g=source.clone();if(variant>=4)g.rotateY(Math.PI);
 g.scale(scale,scale,d/nominal[2]);
 const anchor=variant%4;
 if(anchor===1||anchor===2)g.translate((nominal[0]*scale-w)/2*(anchor===1?1:-1),0,0);
 if(!baseAligned)g.translate(0,(h-nominal[1]*scale)/2,0);
 const names=['position',...Object.keys(g.attributes).filter(n=>n!=='position')];
 let stride=0;const layout=names.map(name=>{const attribute=g.getAttribute(name),offset=stride;stride+=attribute.itemSize;return {name,attribute,offset,size:attribute.itemSize};});
 const data=layout.map(()=>[] as number[]),index=g.index,count=index?.count??g.getAttribute('position').count;
 const vertex=(i:number)=>layout.flatMap(({attribute:a,size})=>Array.from({length:size},(_,j)=>j===0?a.getX(i):j===1?a.getY(i):j===2?a.getZ(i):a.getW(i)));
 const planes=[(v:number[])=>v[0]+w/2,(v:number[])=>w/2-v[0],(v:number[])=>v[1],(v:number[])=>h-v[1]];
 for(let at=0;at<count;at+=3){
  let polygon=[0,1,2].map(j=>vertex(index?index.getX(at+j):at+j));
  for(const distance of planes){
   const cut:number[][]=[];
   for(let i=0;i<polygon.length;i++){
    const a=polygon[i],b=polygon[(i+1)%polygon.length],da=distance(a),db=distance(b),insideA=da>=0,insideB=db>=0;
    if(insideA)cut.push(a);
    if(insideA!==insideB){const t=da/(da-db);cut.push(a.map((x,j)=>x+(b[j]-x)*t));}
   }
   polygon=cut;if(polygon.length<3)break;
  }
  for(let i=1;i+1<polygon.length;i++)for(const v of[polygon[0],polygon[i],polygon[i+1]])
   layout.forEach(({offset,size},j)=>{for(let c=0;c<size;c++)data[j].push(v[offset+c]);});
 }
 const out=new THREE.BufferGeometry();
 layout.forEach(({name,size},i)=>out.setAttribute(name,new THREE.Float32BufferAttribute(data[i],size)));
 out.normalizeNormals();out.computeBoundingBox();out.computeBoundingSphere();g.dispose();return out;
}
