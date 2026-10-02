import * as THREE from 'three';
import type {CustomComponent} from '../level';
import {artBeam} from './waterpark-art';

type P=[number,number,number];
/** Wide, two-way promenades connect the recovered rides without filling bowls. */
export const WATERPARK_CUP_LINKS:{name:string;points:P[];width:number}[]=[
  {name:'Admission courtyard bridge',points:[[-30,12,37],[-10,15.5,46],[14,15.5,34],[12,12,11]],width:12},
  {name:'East courtyard flume bridge',points:[[65,12,-30],[80,15.5,-30],[101,15.5,-32],[138,14,-52]],width:12},
  {name:'Loop return promenade',points:[[118,0,42],[110,0,55],[92,6,54],[78,12,43],[55,15.5,35],[49,12,9]],width:12},
  {name:'Flume two-way bypass',points:[[145,18,-146],[158,18,-134],[160,16,-103],[159,14,-72],[148,14,-52]],width:10},
  {name:'Coaster upper gallery',points:[[-2,18,-158],[-2,18,-143],[12,18,-135],[145,18,-135]],width:10},
  {name:'North bridge gallery bank',points:[[36,15.5,-112],[36,15.5,-116],[36,18,-128],[36,18,-135]],width:10},
  {name:'West promenade concourse turn',points:[[-80,12,-120],[-76,12,-134],[-60,12,-140],[-36,12,-137]],width:12},
  {name:'Wave pool median connection',points:[[-28,12,-90],[-28,12,-132]],width:6},
];
export function waterparkCupLinks():CustomComponent[]{
  const components:CustomComponent[]=[];
  for(const link of WATERPARK_CUP_LINKS){
    const curve=new THREE.CatmullRomCurve3(link.points.map(p=>new THREE.Vector3(...p)),false,'centripetal');
    const steps=Math.max(16,Math.ceil(curve.getLength()/1.5)),vertices:number[]=[],indices:number[]=[],uvs:number[]=[];
    const rails:[number,number,number,number][][]=[[],[]];
    for(let i=0;i<=steps;i++){
      const p=curve.getPointAt(i/steps),t=curve.getTangentAt(i/steps),n=Math.hypot(t.x,t.z)||1;
      p.y=THREE.MathUtils.clamp(p.y,Math.min(...link.points.map(p=>p[1])),Math.max(...link.points.map(p=>p[1])));
      for(const y of [0,-.75])for(const side of [-1,1]){
        vertices.push(p.x-t.z/n*side*link.width/2,p.y+y,p.z+t.x/n*side*link.width/2);
        uvs.push(side<0?0:link.width/4,i/steps*curve.getLength()/4);
      }
      if(i<steps){const a=i*4;indices.push(a,a+1,a+4,a+1,a+5,a+4,a+2,a+6,a+3,a+3,a+6,a+7,a,a+4,a+2,a+2,a+4,a+6,a+1,a+3,a+5,a+3,a+7,a+5);}
      if(i%4===0||i===steps)for(const [r,side]of [-1,1].entries())rails[r].push([p.x-t.z/n*side*(link.width/2-.25),p.z+t.x/n*side*(link.width/2-.25),0,p.y+.6]);
      if(i%12===0)for(const side of [-1,1]){
        const x=p.x-t.z/n*side*(link.width/2-.6),z=p.z+t.x/n*side*(link.width/2-.6);
        components.push({...artBeam([x,-6,z],[x,p.y-.75,z],.55,'#50757b','Promenade steel support'),grp:93});
      }
    }
    indices.push(0,2,1,1,2,3);const end=steps*4;indices.push(end,end+1,end+2,end+1,end+3,end+2);
    components.push({t:'mesh',p:[0,0,0],vertices,indices,uvs,vert:false,solid:true,doubleSided:true,edgeGrinding:false,
      tex:'pavement',color:'#c4c5aa',nm:link.name,grp:93});
    // Leave the short median/gallery entries open; bridge rails offer optional combo lines.
    if(!/gallery|median/i.test(link.name))for(const pts of rails)components.push({t:'rail',p:[0,0,0],pts,grp:93,nm:link.name+' handrail'});
  }
  const deck=(p:P,s:P,nm:string)=>components.push({t:'platform',p,s,edgeGrinding:false,tex:'pavement',color:'#c4c5aa',grp:93,nm});
  deck([-48,11.4,-109],[44,1.2,18],'Wavebreaker coping bridge');
  deck([111,17.4,-160],[14,1.2,30],'Coaster coping bridge');
  deck([128,-.6,-10],[48,1.2,20],'Loop station crosswalk');
  for(const x of [0,34,74,104])deck([x,17.5,-142.5],[3,1,7],'Coaster gallery coping access');
  return components;
}
