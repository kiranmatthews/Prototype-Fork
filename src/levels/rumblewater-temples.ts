import type {CustomComponent} from '../level';
import type {CreekSampler} from './custard-terrain';
type Room={entry:number;exit:number;checkpoint:number;name:string;grp:number};

/** Original Meshy ashlar, columns, carved arches and stepped roofs. The
 * source collision shell never supplies a second visible stone surface. */
export function dressRumblewaterTemple(C:CustomComponent[],room:Room,sampler:CreekSampler,yaw:(s:number)=>number):void {
 const {point:p,height:h}=sampler,{entry,exit,checkpoint,grp,name}=room;
 const a=p(entry),b=p(exit),length=Math.hypot(b[0]-a[0],b[2]-a[2]),middle=(entry+exit)/2,floor=h(checkpoint),turn=yaw(middle);
 const prop=(dkind:CustomComponent['dkind'],s:number,u:number,y:number,size:[number,number,number],extra:Partial<CustomComponent>={})=>
  C.push({t:'decor',dkind,p:p(s,y,u),s:size,yaw:turn,scenerySolid:false,solid:false,grp,nm:`${name} · ${dkind}`,color:'#ffffff',...extra});
 const bays=Math.ceil(length/6),bay=length/bays;
 for(let i=0;i<bays;i++)prop('templeplatform',entry+(exit-entry)*(i+.5)/bays,0,floor-.28,[18,.28,bay]);
 prop('roofedtemple',middle,0,floor,[18,13.4,length-.4],{openFloor:true,vr:0,seed:grp});
 for(const side of [-1,1])prop('templewall',middle,side*8.6,floor,[length-2.9,9.2,2.6],{yaw:turn+90,seed:grp+side});
 for(const s of [entry,exit]){
  prop('hangingarch',s,0,floor,[16.4,9.8,3],{vr:2,seed:grp+Math.round(s)});
  for(const side of [-1,1])prop('templewall',s,side*8.0,floor,[3,9.2,3],{seed:grp+side+Math.round(s)});
  for(const side of [-1,1])prop('bw-hanging-vines',s-.3,side*5.4,floor+6.5,[2.3,2.8,.65],{yaw:turn+(s===entry?0:180)});
  prop('stonefrieze',s-.75,0,floor+8.5,[2,1.5,.6],{yaw:turn+180});
 }
 // Torch poles sit on modeled stone brackets, attached to the wall face.
 for(const s of [entry+6,exit-6])for(const side of [-1,1])
  prop('stonecapital',s,side*7.1,floor+1.77,[.8,.33,.8]);
 // Buttresses connect the temple platform to the gorge rather than leaving
 // unsupported facade edges hovering above the water.
 for(const s of [entry+3,middle,exit-3])for(const side of [-1,1])
  prop('coastv2buttress',s,side*12.5,floor-9,[8,13,8],{yaw:turn+side*90});
}
