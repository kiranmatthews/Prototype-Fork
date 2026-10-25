import type {JungleAssetSpec} from './jungleAssets';
import * as THREE from 'three';

/** Meshy scenery; dimensions are updated from the prepared source geometry. */
export const ROOFTOP_KOOK_ASSETS = {
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

/** Polygon roof grain follows its authored curved centreline; wall shingle
 * courses follow the facade perimeter. Geometry and collision are untouched. */
export function applyKookPolygonUVs(geometry:THREE.BufferGeometry,outline:readonly (readonly number[])[],width:number,depth:number,wall=false):void {
 const p=geometry.getAttribute('position'),n=geometry.getAttribute('normal'),uv=geometry.getAttribute('uv');
 const cross=outline.length/2,centres=Array.from({length:Math.floor(cross)},(_,i)=>
  [(outline[i][0]+outline[outline.length-1-i][0])/2,(outline[i][1]+outline[outline.length-1-i][1])/2]);
 const path=wall?[...outline,outline[0]]:centres;
 const repeatX=Math.max(1,Math.round(width/4)),repeatY=Math.max(1,Math.round(depth/4));
 for(let k=0;k<p.count;k++){
  let nearest=Infinity,along=0,across=0,arc=0;
  for(let i=1;i<path.length;i++){
   const a=path[i-1],b=path[i],dx=b[0]-a[0],dz=b[1]-a[1],length=Math.hypot(dx,dz);if(length<.001)continue;
   const px=p.getX(k)-a[0],pz=p.getZ(k)-a[1],t=THREE.MathUtils.clamp((px*dx+pz*dz)/(length*length),0,1),distance=Math.hypot(px-dx*t,pz-dz*t);
   if(distance<nearest){nearest=distance;along=arc+t*length;across=(px*dz-pz*dx)/length;}
   arc+=length;
  }
  const facade=wall&&Math.abs(n.getY(k))<.6;
  uv.setXY(k,(facade?along:across)/(repeatX*4),(facade?p.getY(k):along)/(repeatY*4));
 }
 uv.needsUpdate=true;
}
