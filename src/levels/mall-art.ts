import scene from './mall-art.json';
import { mallArt } from '../mallArt';
import type { CustomComponent } from '../level';

type P = [number, number, number];
/** Static world-space PS1 visuals. Measured native surfaces own all contact. */
export function mallVisuals(point:(x:number,y:number,z:number)=>P):CustomComponent[] {
 const result:CustomComponent[]=[],materials=new Map(scene.materials.map(m=>[m.checksum,m]));
 for(const sector of scene.sectors)for(const mesh of sector.meshes){
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
    tex:mallArt(kind)?kind:'solid',color:'#ffffff',opacity,
    doubleSided:material.double||!material.single,grp:64,nm:`PS1 Mall scenery ${sector.id}:${mesh.id}`});
  }
 }
 return result;
}
