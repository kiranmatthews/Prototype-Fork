import * as THREE from 'three';
import type {Rail} from './rails';
import {puffs} from './puffs';
import {sfx} from './audio';

/** World-space pressure fields. Safe regions are gameplay data, never ground art.
 * Ground spots use feet-centre coordinates; rails remain ordinary native rails. */
export interface MinefieldData {
  id:number;
  p:[number,number,number]; // ground centre
  s:[number,number]; // width, depth
  spots?:[number,number,number][]; // world x,z,radius
  rectangles?:[number,number,number,number][]; // world centre x,z,width,depth
}
const tuple=(v:unknown,n:number):v is number[]=>Array.isArray(v)&&v.length===n&&v.every(x=>typeof x==='number'&&Number.isFinite(x)&&Math.abs(x)<=100000);
export function validMinefields(value:unknown):value is MinefieldData[]{
  if(!Array.isArray(value)||value.length>32)return false;
  const ids=new Set<number>();let area=0;
  return value.every(f=>{
    if(!f||typeof f!=='object'||Object.keys(f).some(k=>!['id','p','s','spots','rectangles'].includes(k))||
      !Number.isInteger(f.id)||f.id<1||f.id>1000||ids.has(f.id)||!tuple(f.p,3)||!tuple(f.s,2)||
      f.s.some((v:number)=>v<=0||v>500))return false;
    ids.add(f.id);area+=f.s[0]*f.s[1];
    return area<=50000&&(['spots','rectangles'] as const).every(key=>f[key]===undefined||
      Array.isArray(f[key])&&f[key].length<=256&&f[key].every((r:unknown)=>tuple(r,key==='spots'?3:4)&&r.slice(2).every(v=>v>0&&v<=500)));
  });
}
export function inMinefield(f:MinefieldData,x:number,z:number):boolean{
  return Math.abs(x-f.p[0])<=f.s[0]/2&&Math.abs(z-f.p[2])<=f.s[1]/2;
}
export function minefieldSafe(f:MinefieldData,x:number,z:number):boolean{
  return !!(f.spots?.some(([sx,sz,r])=>Math.hypot(x-sx,z-sz)<=r)||
    f.rectangles?.some(([sx,sz,w,d])=>Math.abs(x-sx)<=w/2&&Math.abs(z-sz)<=d/2));
}
export class Minefields {
  readonly fields:{data:MinefieldData;mines:THREE.Vector3[];detonated:boolean;age:number}[];
  readonly trappedRails:{rail:Rail;id:number}[]=[];
  constructor(readonly data:MinefieldData[]){
    this.fields=data.map(data=>{
      const mines:THREE.Vector3[]=[];
      for(let z=data.p[2]-data.s[1]/2+.45;z<data.p[2]+data.s[1]/2;z+=1.05)
        for(let x=data.p[0]-data.s[0]/2+.45;x<data.p[0]+data.s[0]/2;x+=1.05)
          if(!minefieldSafe(data,x,z))mines.push(new THREE.Vector3(x,data.p[1]-.6,z));
      return{data,mines,detonated:false,age:0};
    });
  }
  get mineCount():number{return this.fields.reduce((n,f)=>n+f.mines.length,0);}
  trigger(id:number,origin:THREE.Vector3):boolean{
    const field=this.fields.find(f=>f.data.id===id);
    if(!field||field.detonated)return false;
    field.detonated=true;field.age=0;
    // The shared puff pool is bounded. Reserve the first, full-size blast for
    // the actual contact before distant charges can consume its particle slots.
    puffs.burst('boomTnt',origin.x,Math.max(field.data.p[1],origin.y)+.15,origin.z,{count:18});
    // All charges still detonate atomically. Smaller sampled bursts fill the
    // field from the contact outward, without flooding the shared particle pool.
    const stride=Math.max(1,Math.ceil(field.mines.length/24)),bursts:THREE.Vector3[]=[];
    for(let i=0;i<field.mines.length;i+=stride)bursts.push(field.mines[i]);
    bursts.sort((a,b)=>a.distanceToSquared(origin)-b.distanceToSquared(origin));
    for(const p of bursts)puffs.burst('boomTnt',p.x,p.y+.7,p.z,{count:2,strength:.55});
    sfx.play('tntBoom',1,.7);return true;
  }
  triggerAt(p:THREE.Vector3):void{
    for(const f of this.fields)if(inMinefield(f.data,p.x,p.z)&&Math.abs(p.y-f.data.p[1])<12)this.trigger(f.data.id,p);
  }
  /** Called after native contact resolution, before ordinary blast handling. */
  contact(pos:THREE.Vector3,previous:THREE.Vector3,grounded:boolean,grind:Rail|null):boolean{
    for(const {rail,id}of this.trappedRails){
      if(grind===rail){this.trigger(id,rail.closest(pos).point);continue;}
      const chest=pos.clone().add(new THREE.Vector3(0,.45,0));
      const contact=rail.closest(chest);
      if(contact.distance<.6)this.trigger(id,contact.point);
    }
    for(const f of this.fields){
      const d=f.data;
      if(grounded&&Math.abs(pos.y-d.p[1])<.22&&!f.detonated){
        // Swept foot pressure also catches a fast board crossing a narrow unsafe
        // interval between safe cells, without applying ground rules in flight.
        const n=Math.abs(previous.y-d.p[1])<.005?Math.min(64,Math.max(1,Math.ceil(pos.distanceTo(previous)/.12))):1;
        for(let i=1;i<=n;i++){
          const t=i/n,x=THREE.MathUtils.lerp(previous.x,pos.x,t),z=THREE.MathUtils.lerp(previous.z,pos.z,t);
          if(inMinefield(d,x,z)&&!minefieldSafe(d,x,z)){this.trigger(d.id,new THREE.Vector3(x,d.p[1],z));break;}
        }
      }
      if(f.detonated&&f.age<1.15&&inMinefield(d,pos.x,pos.z)&&pos.y<d.p[1]+4.5&&pos.y>d.p[1]-2)return true;
    }
    return false;
  }
  update(dt:number):void{for(const f of this.fields)if(f.detonated)f.age+=dt;}
  reset():void{for(const f of this.fields){f.detonated=false;f.age=0;}}
}
