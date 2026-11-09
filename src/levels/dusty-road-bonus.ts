import type {CustomComponent,DecorKind} from '../level';
import {desertPlantSize,isDesertCactus,type DesertPlantKind} from '../desertPlants';
import {DESERT_CANYON_LEVEL} from './desert-canyon';
import {makeBonusCourse} from './bonus-course-kit';

/** A side-on pocket of the same canyon: a high cache, a switch bridge,
 * then a five-bounce stack. The shared kit supplies measured jump distances. */
export const DUSTY_ROAD_BONUS_COURSE=makeBonusCourse({
  name:'Bonus: Cactus Cache',patterns:['upper','bridge','finite'],
  style:{color:'#ce9869',accent:'#e9c88a',tex:'desert-trail',sky:'bryce-golden-hour'},
});
const data=DUSTY_ROAD_BONUS_COURSE.data,C=data.components;
type P=[number,number,number];

// Rounded sandstone shelves keep every playable landing interval. The
// bevels are actual closed geometry; the centre travel plane stays flat.
function shelf(component:CustomComponent){
  const [w,h,d]=component.s!,top=component.p[1]+h/2;
  const vertices:number[]=[],indices:number[]=[],uvs:number[]=[];
  const ring=(width:number,depth:number,y:number,r:number)=>{
    for(const [cx,cz,start]of [[width/2-r,depth/2-r,0],[-width/2+r,depth/2-r,90],[-width/2+r,-depth/2+r,180],[width/2-r,-depth/2+r,270]]){
      for(let n=0;n<5;n++){
        const a=(start+n*22.5)*Math.PI/180,x=cx+Math.cos(a)*r,z=cz+Math.sin(a)*r;
        vertices.push(x,y,z);uvs.push(x,z);
      }
    }
  };
  const r=Math.min(.7,w*.12);ring(w,d,0,r);ring(w+.28,d+.28,-.4,r+.14);ring(w*.94,d*.88,-1.8,r);
  const n=20;
  for(let i=0;i<n;i++){
    const next=(i+1)%n;
    for(let band=0;band<2;band++){const a=band*n+i,b=band*n+next;indices.push(a,b,a+n,b,b+n,a+n);}
  }
  for(let i=1;i<n-1;i++){indices.push(0,i+1,i);indices.push(n*2,n*2+i,n*2+i+1);}
  Object.assign(component,{p:[component.p[0],top,0],s:undefined,vertices,indices,uvs,
    tex:'desert-sandstone',nm:component.outline?'Switch-revealed sandstone bridge':'Rounded sandstone cache shelf'});
}
for(const component of C){
  if(component.t==='mesh'&&component.s)shelf(component);
  if(component.t==='camnode'&&component.cameraView){component.cameraFollowDistance=20.5;component.cameraFollowTargetHeight=4.8;}
}
const prop=(dkind:DecorKind,p:P,s:P,yaw:number,nm:string)=>
  C.push({t:'decor',dkind,p,s,yaw,scenerySolid:isDesertCactus(dkind)||dkind.startsWith('deserthoodoo'),grp:90,nm});
const plant=(kind:DesertPlantKind,p:P,height:number,yaw=0)=>
  prop(kind,p,desertPlantSize(kind,height),yaw,'Cactus Cache · rooted '+kind);

// Native RockGenerator sculpts at full detail, sharing the parent's paints.
for(let i=0;i<9;i++){
  const x=-16+i*16;
  prop(i%3===0?'deserthoodoocap':'deserthoodoofluted',[x,-19,-17-i%2*5],
    [13+i%2*4,27+i%3*5,12],i*47,'Weathered pillars behind the cache');
  prop('deserthoodoobuttress',[x+4,-31,-68-i%3*13],
    [30,46+i%3*10,27],i*67,'Sunlit distant canyon wall');
}
for(const [x,w]of [[-5,11],[14,27],[33.5,10],[56.5,11],[74,24],[95,17]]){
  prop('deserthoodoobuttress',[x,-16,-1.6],[w,15.8,8.4],90,'Rock pedestal beneath the playable shelf');
}
for(const [x,y]of [[-8,0],[4,0],[22,0],[34,0],[57,0],[66,0],[80,0],[97,0]]){
  prop('deserttalus',[x,y-1.6,-4.5],[6.8,2,4.6],x*13,'Rooted planting shoulder');
  plant(x%3?'canyonpricklypear':'canyonsaguaro',[x,y-.1,-4.6],3.7+(x%3+3)*.3,x*29);
  plant('canyondrygrass',[x+1.9,y-.1,-3.8],1.2,x*17);
  plant('canyondryweed',[x-1.4,y-.1,-4.1],1.35,x*37);
}
plant('canyonbarrel',[-12,-1,4.8],3,24);
plant('canyonpricklypear',[104,-1,4.4],4.5,60);
Object.assign(data,{startWarpPad:false,keepPlayFog:true,hugeDropBail:false,
  atmosphere:{...DESERT_CANYON_LEVEL.atmosphere,fogNear:85,fogFar:360,drawDistance:480}});
data.desertHeat=[];
data.groups!.push({id:90,nm:'Painted hoodoos and oversized desert plants',editorOnly:true});
export const DUSTY_ROAD_BONUS_LEVEL=data;
