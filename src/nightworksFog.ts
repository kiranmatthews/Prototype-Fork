import * as THREE from 'three';
import type { CustomComponent } from './level';

/** A distant volcano needs a long camera range. Ordinary quarry props can
 * still stop rendering once the opaque distance fog has swallowed them.
 * Identity wrappers keep phase-pad, pickup and effect visibility independent;
 * collision meshes and their local/world coordinates never change. */
export class NightworksFogVisibility {
  private entries: { wrapper: THREE.Group; point: THREE.Vector3; radius: number }[]=[];
  constructor(root: THREE.Group, components: readonly CustomComponent[]) {
    for(const object of [...root.children]){
      const c=components[object.userData.editorIdx];
      if(!c||object.userData.assetBatchRoot||c.dkind==='nightvolcano'||c.fog===false||c.invisible)continue;
      let radius=Math.hypot(...(c.s??[c.w??2,c.rise??3,c.len??2]))/2+12;
      for(const p of c.pts??[])radius=Math.max(radius,Math.hypot(p[0],p[1],p[3]??0)+12+(c.w??0)+(c.rise??0));
      if(c.vertices)for(let i=0;i<c.vertices.length;i+=3)
        radius=Math.max(radius,Math.hypot(c.vertices[i]*(c.s?.[0]??1),c.vertices[i+1]*(c.s?.[1]??1),c.vertices[i+2]*(c.s?.[2]??1))+12);
      radius+=Math.abs(c.amp??0)+(c.range??0);
      const wrapper=new THREE.Group();wrapper.name='Quarry fog visibility';wrapper.userData.editorIdx=object.userData.editorIdx;
      wrapper.matrixAutoUpdate=false;root.add(wrapper);wrapper.add(object);
      this.entries.push({wrapper,point:new THREE.Vector3(...c.p),radius});
    }
  }
  update(primary: THREE.Vector3, far: number, secondary?: THREE.Vector3):void {
    for(const {wrapper,point,radius}of this.entries){
      const limit=(far+radius)*(far+radius);
      wrapper.visible=far===Infinity||point.distanceToSquared(primary)<=limit||!!secondary&&point.distanceToSquared(secondary)<=limit;
    }
  }
}
