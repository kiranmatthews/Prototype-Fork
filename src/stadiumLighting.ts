import * as THREE from 'three';
import type {CustomComponent} from './level';

/** Six real spotlights cover the nearby fixture pairs. Reusing a fixed pool
 * keeps the shader light count stable while every authored lamp stays lit.
 * The outer slots fade to zero before reassignment; no shadow-map passes. */
export class StadiumLighting {
 readonly root=new THREE.Group();
 private readonly lights=Array.from({length:6},()=>new THREE.SpotLight('#e9f3ff',0,135,.85,.65,2));
 private readonly anchors:{position:THREE.Vector3;target:THREE.Vector3;power:number;range:number}[];
 private readonly order:number[];
 constructor(components:readonly CustomComponent[]){
  this.root.name='Stadium floodlight illumination';
  this.anchors=components.filter(c=>c.tex==='rally-lamp').map(c=>({
   position:new THREE.Vector3(c.p[0],c.p[1]+(c.rise??33),c.p[2]),target:new THREE.Vector3(...(c.to??[c.p[0],c.p[1],c.p[2]])),power:c.amp??7500,range:c.radius??135
  }));
  this.order=this.anchors.map((_,i)=>i);
  for(const light of this.lights){light.name='Stadium floodlight spill';light.castShadow=false;this.root.add(light,light.target);}
 }
 update(camera:THREE.Camera){
  // Course depth is stable through both local corners. Pair selection prevents
  // one bank monopolising the pool when the player passes close to a stand.
  const z=camera.position.z;
  this.order.sort((a,b)=>Math.abs(this.anchors[a].target.z-z)-Math.abs(this.anchors[b].target.z-z));
  for(let slot=0;slot<this.lights.length;slot++){
   const light=this.lights[slot],a=this.anchors[this.order[slot]];
   if(!a){light.intensity=0;continue;}
   light.position.copy(a.position);light.target.position.copy(a.target);light.distance=a.range;
   const distance=Math.abs(a.target.z-z),next=this.anchors[this.order[this.lights.length]];
   const edge=next?Math.abs(next.target.z-z):Infinity;
   // Tunnel lamps are closer together than towers. Fade the outer pool slots
   // before either layout reassigns them, including at both tunnel portals.
   const rangeFade=1-THREE.MathUtils.smoothstep(distance,a.range*.925,a.range*1.52);
   const poolFade=Number.isFinite(edge)?1-THREE.MathUtils.smoothstep(distance,Math.max(0,edge-28),Math.max(.01,edge-4)):1;
   light.intensity=a.power*rangeFade*poolFade;
  }
 }
 get diagnostics(){return {fixtures:this.anchors.length,pool:this.lights.length,shadowMaps:0,lights:this.lights.map(l=>({position:l.position.toArray(),target:l.target.position.toArray(),intensity:l.intensity,range:l.distance}))};}
 dispose(){for(const light of this.lights)light.dispose();this.root.removeFromParent();this.root.clear();}
}
