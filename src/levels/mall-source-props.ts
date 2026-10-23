import props from './mall-source-props.json';
import retail from '../../docs/mall/retail-rails.json';
import type {CustomComponent} from '../level';

type P=[number,number,number];
export const MALL_SOURCE_BOXES=props.placements;
/** Original loose props, independent of the conversion's cereal additions. */
export function mallSourceProps(point:(x:number,y:number,z:number)=>P,scale:number):CustomComponent[]{
 const unit=scale*retail.registration.factor,shift=retail.registration.translation;
 const textures=new Map(props.textures.map(t=>[t.index,t]));
 return props.placements.flatMap(box=>{
  const p=point(box.position[0]*retail.registration.factor+shift[0],-box.position[1]*retail.registration.factor+shift[1],-box.position[2]*retail.registration.factor+shift[2]);
  return props.model.faces.map((face,i)=>{
   const texture=textures.get(face.textureIndex)!;
   // Decoder vertices are Y-up. This registered axis map reverses handedness,
   // so reverse each quad's winding while preserving every control position.
   const vertices=face.vertices.flatMap(v=>[-v[2]*unit,v[1]*unit,-v[0]*unit]);
   return {t:'mesh',p,vertices,indices:[0,2,1,0,3,2],
    uvs:face.uv.flatMap(v=>[v[0]/texture.width,1-v[1]/texture.height]),
    colors:face.vertices.flatMap(()=>face.color.map(c=>Math.min(1,c/128))),
    solid:false,edgeGrinding:false,doubleSided:false,tex:`mall-box-${texture.checksum}`,color:'#ffffff',
    yaw:-box.angles[1]*360/4096,grp:65,nm:`Original Mall box ${box.node}:${i}`,
    sourceBox:{id:box.node,bounds:props.model.nativeBounds as [number,number,number,number,number,number],angles:box.angles as P},
   } as CustomComponent;
  });
 });
}
