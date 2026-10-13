import * as THREE from 'three';
import type { CustomComponent } from './level';

/** Two local pools spill moving scarlet light onto the real quarry geometry.
 * The emitter cards are source-owned; selection changes uniforms, not lights. */
export class NightworksLighting {
  readonly root=new THREE.Group();
  private readonly lights=[new THREE.PointLight(),new THREE.PointLight()];
  private readonly anchors:{point:THREE.Vector3;color:THREE.Color;power:number;range:number}[];
  private readonly distances:number[]=[];
  constructor(components:readonly CustomComponent[],private readonly clock:{value:number}){
    this.root.name='Caldera fissure light pools';
    this.anchors=components.filter(c=>c.tex==='nightworks-heat'&&c.amp!==undefined).map(c=>({
      point:new THREE.Vector3(...(c.to??c.p)),color:new THREE.Color(c.color??'#ff381b'),power:c.amp!,range:c.radius??52}));
    for(const light of this.lights){light.name='Caldera red spill';light.userData.calderaLight=true;light.decay=1.35;light.castShadow=false;this.root.add(light);}
  }
  update(camera:THREE.Camera):void {
    for(let i=0;i<this.anchors.length;i++)this.distances[i]=camera.position.distanceToSquared(this.anchors[i].point);
    for(const light of this.lights){
      let index=-1,best=Infinity;
      for(let i=0;i<this.anchors.length;i++)if(this.distances[i]<best){best=this.distances[i];index=i;}
      if(index<0){light.intensity=0;continue;}
      this.distances[index]=Infinity;
      const a=this.anchors[index],pulse=.85+.17*Math.sin(this.clock.value*.83+index*1.9)+.045*Math.sin(this.clock.value*3.1+index);
      light.position.copy(a.point);light.color.copy(a.color);light.distance=a.range;
      light.intensity=a.power*pulse*(1-THREE.MathUtils.smoothstep(Math.sqrt(best),a.range,a.range+25));
    }
  }
  dispose():void {for(const light of this.lights)light.dispose();this.root.removeFromParent();this.root.clear();}
}
