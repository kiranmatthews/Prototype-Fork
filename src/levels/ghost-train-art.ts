import type { CustomComponent } from '../level';

export type GhostPoint = [number, number, number];
const r = (n: number) => Math.round(n * 1000) / 1000;
const sub = (a: GhostPoint,b: GhostPoint):GhostPoint => [a[0]-b[0],a[1]-b[1],a[2]-b[2]];
const cross = (a:GhostPoint,b:GhostPoint):GhostPoint => [a[1]*b[2]-a[2]*b[1],a[2]*b[0]-a[0]*b[2],a[0]*b[1]-a[1]*b[0]];
const unit = (p:GhostPoint):GhostPoint => {const n=Math.hypot(...p)||1;return p.map(v=>v/n) as GhostPoint;};

/** Authored scenery stays ordinary editable mesh data, batched by room/material. */
export class GhostArt {
  private batches = new Map<string,{p:GhostPoint;vertices:number[];indices:number[];grp:number;color:string;emissive?:string;name:string}>();
  constructor(private readonly C:CustomComponent[],private readonly cellLength=72) {}
  face(points:GhostPoint[],color:string,grp:number,name:string,emissive?:string):void {
    const ix:number[]=[];for(let i=1;i<points.length-1;i++)ix.push(0,i,i+1);
    this.indexed(points,ix,color,grp,name,emissive);
  }
  private indexed(points:GhostPoint[],indices:number[],color:string,grp:number,name:string,emissive?:string):void {
    const centre=points.reduce((p,q)=>[p[0]+q[0]/points.length,p[1]+q[1]/points.length,p[2]+q[2]/points.length] as GhostPoint,[0,0,0] as GhostPoint);
    const cell=Math.floor(-centre[2]/this.cellLength),key=`${grp}:${cell}:${color}:${emissive??''}`;
    let batch=this.batches.get(key);
    if(batch&&batch.vertices.length/3+points.length>4000){this.flush(key);batch=undefined;}
    if(!batch){batch={p:[r(centre[0]),0,r(centre[2])],vertices:[],indices:[],grp,color,emissive,name};this.batches.set(key,batch);}
    const n=batch.vertices.length/3;
    for(const p of points)batch.vertices.push(r(p[0]-batch.p[0]),r(p[1]),r(p[2]-batch.p[2]));
    batch.indices.push(...indices.map(i=>n+i));
  }
  box(p:GhostPoint,size:GhostPoint,color:string,grp:number,name:string,yaw=0,emissive?:string):void {
    const [w,h,d]=size.map(v=>v/2),a=yaw*Math.PI/180,c=Math.cos(a),s=Math.sin(a);
    const q=(x:number,y:number,z:number):GhostPoint=>[p[0]+x*c+z*s,p[1]+y,p[2]-x*s+z*c];
    const v=[q(-w,-h,-d),q(w,-h,-d),q(w,h,-d),q(-w,h,-d),q(-w,-h,d),q(w,-h,d),q(w,h,d),q(-w,h,d)];
    // Shared box corners give the stonework a slight carved highlight and
    // keep the entire 2.3 km authored interchange inside its vertex budget.
    this.indexed(v,[0,3,2,0,2,1,4,5,6,4,6,7,0,4,7,0,7,3,1,2,6,1,6,5,3,7,6,3,6,2,0,1,5,0,5,4],color,grp,name,emissive);
  }
  beam(a:GhostPoint,b:GhostPoint,width:number,color:string,grp:number,name:string,depth=width):void {
    const d=unit(sub(b,a)),u=unit(cross(d,Math.abs(d[1])>.95?[1,0,0]:[0,1,0])),v=unit(cross(u,d));
    const at=(p:GhostPoint,x:number,y:number):GhostPoint=>[p[0]+u[0]*x+v[0]*y,p[1]+u[1]*x+v[1]*y,p[2]+u[2]*x+v[2]*y];
    const w=width/2,h=depth/2,q=[at(a,-w,-h),at(a,w,-h),at(a,w,h),at(a,-w,h),at(b,-w,-h),at(b,w,-h),at(b,w,h),at(b,-w,h)];
    this.indexed(q,[0,3,2,0,2,1,4,5,6,4,6,7,0,4,7,0,7,3,1,2,6,1,6,5,3,7,6,3,6,2,0,1,5,0,5,4],color,grp,name);
  }
  ring(p:GhostPoint,radius:number,tube:number,color:string,grp:number,name:string,yaw=0,vertical=false,segments=12):void {
    const a=yaw*Math.PI/180,c=Math.cos(a),s=Math.sin(a);
    const q=(angle:number,rr:number,z:number):GhostPoint=>{
      const x=Math.cos(angle)*rr,y=vertical?Math.sin(angle)*rr:z,zz=vertical?z:Math.sin(angle)*rr;
      return[p[0]+x*c+zz*s,p[1]+y,p[2]-x*s+zz*c];
    };
    for(let i=0;i<segments;i++){
      const a0=i*Math.PI*2/segments,a1=(i+1)*Math.PI*2/segments;
      this.face([q(a0,radius-tube/2,0),q(a0,radius+tube/2,0),q(a1,radius+tube/2,0),q(a1,radius-tube/2,0)],color,grp,name);
    }
  }
  private flush(key:string):void {
    const b=this.batches.get(key);if(!b)return;
    this.C.push({t:'mesh',p:b.p,vertices:b.vertices,indices:b.indices,tex:'solid',color:b.color,
      ...(b.emissive?{emissive:b.emissive}:{}),solid:false,doubleSided:true,edgeGrinding:false,grp:b.grp,nm:b.name});
    this.batches.delete(key);
  }
  finish():void {for(const key of [...this.batches.keys()])this.flush(key);}
}
