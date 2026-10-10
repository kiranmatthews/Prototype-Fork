import type {CustomComponent} from '../level';
import type {Point} from './blockworks-geometry';
export interface SkateBlock {p:Point;top:number;width:number;depth:number;yaw:number;}
export interface SkateWedge {name:string;low:Point;high:Point;width:number;group:number;gated:boolean;}
export function addSkateWedge(components:CustomComponent[],ramps:SkateWedge[],from:SkateBlock,to:SkateBlock,group:number,name:string,width=2.4,gated=false){
 if(Math.abs(to.top-from.top)<.1)return;
 const low=from.top<to.top?from:to,high=from.top<to.top?to:from;
 const dx=high.p[0]-low.p[0],dz=high.p[2]-low.p[2],distance=Math.hypot(dx,dz),fx=dx/distance,fz=dz/distance;
 const extent=(b:SkateBlock)=>{const a=b.yaw*Math.PI/180,x=Math.cos(a)*fx-Math.sin(a)*fz,z=Math.sin(a)*fx+Math.cos(a)*fz;return Math.min(Math.abs(x)<1e-6?Infinity:b.width/2/Math.abs(x),Math.abs(z)<1e-6?Infinity:b.depth/2/Math.abs(z));};
 const highEdge=extent(high),rise=high.top-low.top;
 const length=Math.max(rise*3.5,distance-extent(low)-highEdge+.8);
 const highPoint:Point=[high.p[0]-fx*(highEdge-.08),high.top,high.p[2]-fz*(highEdge-.08)];
 const lowPoint:Point=[highPoint[0]-fx*length,low.top,highPoint[2]-fz*length];
 addWedgeBetween(components,ramps,lowPoint,highPoint,width,group,name,gated);
}
export function addWedgeBetween(components:CustomComponent[],ramps:SkateWedge[],lowPoint:Point,highPoint:Point,width:number,group:number,name:string,gated=false){
 const dx=highPoint[0]-lowPoint[0],dz=highPoint[2]-lowPoint[2],length=Math.hypot(dx,dz),fx=dx/length,fz=dz/length,rise=highPoint[1]-lowPoint[1];
 const right:Point=[-fz,0,fx],vertices:number[]=[];
 for(const [along,y,side] of [[0,0,-1],[0,0,1],[length,rise,1],[length,rise,-1],[0,-.15,-1],[0,-.15,1],[length,-.15,1],[length,-.15,-1]])vertices.push(fx*along+right[0]*side*width/2,y,fz*along+right[2]*side*width/2);
 components.push({t:'mesh',p:lowPoint,vertices,indices:[0,1,2,0,2,3,4,7,6,4,6,5,0,3,7,0,7,4,1,5,6,1,6,2,0,4,5,0,5,1,3,2,6,3,6,7],vert:false,solidSides:true,tex:'solid',color:'#bdc5cd',grp:group,nm:name,...(gated?{outline:true,}:{})});
 ramps.push({name,low:lowPoint,high:highPoint,width,group,gated});
}
export function addSkateLid(components:CustomComponent[],block:SkateBlock,group:number){
 const w=block.width/2,d=block.depth/2;
 components.push({t:'mesh',p:[block.p[0],block.top,block.p[2]],yaw:block.yaw,vertices:[-w,0,d,w,0,d,w,0,-d,-w,0,-d,-w,-.22,d,w,-.22,d,w,-.22,-d,-w,-.22,-d],indices:[0,1,2,0,2,3,4,7,6,4,6,5,0,4,5,0,5,1,1,5,6,1,6,2,2,6,7,2,7,3,3,7,4,3,4,0],vert:false,tex:'solid',color:'#9daab8',outline:true,grp:group,nm:'Switch-built skate deck'});
}
