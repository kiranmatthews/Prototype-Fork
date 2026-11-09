import * as THREE from 'three';
import {WorldSolids,solidContact,type SolidSurface,type SolidQuery} from './worldSolids';
import {DESERT_VISTA_ASSETS} from './desertVistaCatalog';
import {elevationAtZ} from './levels/desert-canyon';
import {isDesertCactus} from './desertPlants';
export const hasDesertContacts=(id:string)=>
  id==='bryce-canyon'||id==='bonus:bryce-canyon'||id==='bonus-bryce-canyon';

/** Scope player scenery contacts to the canyon's actual authored geometry.
 * The shared BVH already tracks asynchronous/instanced assets, independently
 * of render visibility. Grass, weeds and decorative scree remain soft. */
export function isDesertRock(mesh:THREE.Mesh):boolean {
  const kind=mesh.userData.jungleAsset as string|undefined;
  if(kind?.startsWith('deserthoodoo')||kind==='desertsurveyrim')return true;
  const vista=DESERT_VISTA_ASSETS[kind as keyof typeof DESERT_VISTA_ASSETS];
  return vista?.groundSurface===true||mesh.name==='Continuous carved canyon terrain';
}

/** The usable rim and bonus pad remain safe. Cross the right shoulder and
 * drop three metres below the road to die; the post-finish gem route stays
 * on the left of this boundary. Height is relative to the descending rim. */
export function inDesertValleyDrop(position:{x:number;y:number;z:number}):boolean {
  if(position.z> -2380||position.z< -5024)return false;
  const rim=elevationAtZ(position.z);
  return position.x>rim.x+20&&position.y<rim.y-3;
}

export class DesertContacts {
  private readonly hit=solidContact();
  private readonly cactusQuery:SolidQuery={low:0,high:1,radius:.35,
    ignore:surface=>!isDesertCactus(surface.mesh.userData.jungleAsset)};
  private readonly rockQuery:SolidQuery={low:0,high:1,radius:.35,ignoreGround:true,
    ignore:surface=>!isDesertRock(surface.mesh)};
  constructor(private readonly solids:WorldSolids,private readonly valley:boolean){}
  private fit(query:SolidQuery,half:{x:number;y:number;z:number}):void {
    query.radius=Math.max(half.x,half.z);
    query.low=Math.min(query.radius,half.y);query.high=Math.max(query.low,half.y*2-query.radius);
  }
  fatal(previous:THREE.Vector3,position:THREE.Vector3,half:{x:number;y:number;z:number}):boolean {
    if(this.valley&&inDesertValleyDrop(position))return true;
    this.fit(this.cactusQuery,half);
    if(!this.solids.cast(previous,position,this.cactusQuery,this.hit))return false;
    position.copy(this.hit.position).addScaledVector(this.hit.normal,this.hit.depth+.004);
    return true;
  }
  resolve(previous:THREE.Vector3,position:THREE.Vector3,half:{x:number;y:number;z:number},
    normal:THREE.Vector3,grounded:boolean):boolean {
    this.fit(this.rockQuery,half);this.rockQuery.groundStep=grounded?.8:0;
    if(!this.solids.resolve(previous,position,this.rockQuery,this.hit))return false;
    normal.copy(this.hit.normal);return true;
  }
  get lastSurface():SolidSurface|null{return this.hit.surface;}
}
