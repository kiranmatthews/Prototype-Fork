import type * as THREE from 'three';

export type WriteFlameHeat=(x:number,y:number,z:number,width:number,height:number,heat:number,phase:number)=>void;
export interface FlameHeatSource {sprites:readonly THREE.Object3D[];write:(emit:WriteFlameHeat)=>void}
// Ownership follows the effect object; disposed levels/projectiles are not
// retained by a global list. Local positions follow the live world transform.
const sources=new WeakMap<THREE.Object3D,FlameHeatSource>();
export const getFlameHeatSource=(object:THREE.Object3D)=>sources.get(object);
export function attachFlameHeat(object:THREE.Object3D,write:FlameHeatSource['write'],sprites:readonly THREE.Object3D[]=[object]):void {
  sources.set(object,{sprites,write});
}

/** The same bounded particles that draw a flame supply its hot-air pockets. */
export class FlameHeatSamples {
  private readonly data:Float32Array;
  count=0;
  constructor(capacity:number){this.data=new Float32Array(capacity*7);}
  clear(){this.count=0;}
  add:WriteFlameHeat=(x,y,z,width,height,heat,phase)=>{
    if(heat<=.001||this.count*7>=this.data.length)return;
    const n=this.count++*7,d=this.data;
    d[n]=x;d[n+1]=y;d[n+2]=z;d[n+3]=width;d[n+4]=height;d[n+5]=heat;d[n+6]=phase;
  };
  attach(object:THREE.Object3D,sprites?:readonly THREE.Object3D[]){attachFlameHeat(object,this.write,sprites);}
  private write=(emit:WriteFlameHeat)=>{
    for(let i=0;i<this.count;i++){const n=i*7,d=this.data;emit(d[n],d[n+1],d[n+2],d[n+3],d[n+4],d[n+5],d[n+6]);}
  };
}
