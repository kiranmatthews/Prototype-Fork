import scene from './mall-art.json';
import { mallArt } from '../mallArt';
import type { CustomComponent } from '../level';

type P = [number, number, number];
// COL and SCN sector indices diverge after the glass. Their object checksums
// are stable: join by checksum, never hide a render sector by collision index.
export const MALL_BREAKABLE_OBJECTS = [
 {checksum:0x85005f69,group:19,kind:'glass',label:'Entrance glass'},
 {checksum:0x6b0e3e45,group:20,kind:'glass',label:'Parking glass'},
 {checksum:0x7578cb1d,group:33,kind:'sign',label:'First upper directory'},
 {checksum:0xe5c7d68c,group:34,kind:'sign',label:'Atrium directory'},
 {checksum:0x92c0e61a,group:35,kind:'sign',label:'Arcade directory'},
 {checksum:0xc0310d7d,group:36,kind:'sign',label:'Court directory'},
 {checksum:0xb7363deb,group:37,kind:'sign',label:'Gallery directory'},
] as const;
const breakables = new Map<number, typeof MALL_BREAKABLE_OBJECTS[number]>(MALL_BREAKABLE_OBJECTS.map(o=>[o.checksum,o]));
/** Static world-space PS1 visuals. Measured native surfaces own all contact. */
export function mallVisuals(point:(x:number,y:number,z:number)=>P):CustomComponent[] {
 const result:CustomComponent[]=[],materials=new Map(scene.materials.map(m=>[m.checksum,m]));
 for(const sector of scene.sectors)for(const mesh of sector.meshes){
  const breakable=breakables.get(sector.checksum);
  const material=materials.get(mesh.material)!,pass=material.passes[0],kind=`mall-${material.checksum.toString(16).padStart(8,'0')}`;
  const alpha=mesh.colors.length?mesh.colors.filter((_v,i)=>i%4===3).reduce((a,b)=>a+b,0)/(mesh.colors.length/4)/128:1;
  const opacity=pass.flags&4096?1:Math.max(.01,Math.min(1,alpha));
  for(let start=0;start<mesh.indices.length;start+=3600){
   const map=new Map<number,number>(),vertices:number[]=[],indices:number[]=[],uvs:number[]=[],colors:number[]=[];
   for(const i of mesh.indices.slice(start,start+3600)){
    if(!map.has(i)){map.set(i,map.size);vertices.push(...point(...mesh.vertices.slice(i*3,i*3+3) as P));
     uvs.push(...(mesh.uvs.length?[mesh.uvs[i*2],1-mesh.uvs[i*2+1]]:[0,0]));
     for(let c=0;c<3;c++)colors.push(Math.min(1,Math.max(0,(mesh.colors.length?mesh.colors[i*4+c]/128:1)*pass.color[c]*2)));
    }indices.push(map.get(i)!);
   }
   result.push({t:'mesh',p:[0,0,0],vertices,indices,uvs,colors,solid:false,edgeGrinding:false,
    ...(breakable?{breakable:breakable.kind,breakGroup:breakable.group}:{}),
    tex:mallArt(kind)?kind:'solid',color:'#ffffff',opacity,
    doubleSided:material.double||!material.single,grp:64,nm:`PS1 Mall scenery ${sector.id}:${mesh.id}`});
  }
 }
 return result;
}
