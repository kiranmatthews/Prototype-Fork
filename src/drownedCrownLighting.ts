import * as THREE from 'three';
import { atmosphereColor, type ResolvedAtmosphere } from './levelAtmosphere';
import { DROWNED_INTERIOR_OFFSET_X, DROWNED_TREASURY_OFFSET } from './levels/pirate-sets';

type Rig={hemi:THREE.HemisphereLight;sun:THREE.DirectionalLight;fill:THREE.DirectionalLight;fog:THREE.Fog|null;sky?:THREE.Object3D;mist?:THREE.Object3D;background?:THREE.Color};
type Look={sky:THREE.Color;ground:THREE.Color;sun:THREE.Color;fill:THREE.Color;fog:THREE.Color;ambient:number;key:number;bounce:number;near:number;far:number};
const look=(sky:string,ground:string,sun:string,fill:string,fog:string,ambient:number,key:number,bounce:number,near:number,far:number):Look=>({
 sky:new THREE.Color(sky),ground:new THREE.Color(ground),sun:new THREE.Color(sun),fill:new THREE.Color(fill),fog:new THREE.Color(fog),ambient,key,bounce,near,far});
// Keep broad cave shadows cool; the directional lights carry the warm timber
// highlights instead of lifting every surface with a pale ambient wash.
const MINE=look('#83add9','#2b3047','#b7e0ee','#dec39e','#253e5d',.72,1.18,.92,28,180);
const MOONPOOL=look('#91bade','#2c3d59','#b9e5f1','#ffd7a6','#244d6a',.84,1.7,1.2,68,325);
const HOLD=look('#86b3c6','#2c2e41','#a0dde7','#ffd39b','#243946',.70,.82,1.02,30,135);
const SKYLIGHT_BACKGROUND=new THREE.Color('#b7dcef');
const CAVE_FILL_POSITION=new THREE.Vector3(-38,30,22);
const SKATE_HOLD_FILL_POSITION=new THREE.Vector3(-48,56,28);
// One broad rig spans the entire bowl, apron and upper catwalks. The long fog
// range keeps the opposite wall and the exit readable across the huge room.
const SKATE_HOLD=look('#829fc8','#47342e','#ffcf8f','#87c6ee','#304b64',.58,3.0,1.15,115,440);
const ENTRY_GALLERY=look('#c5b99e','#49302a','#ffd29a','#95c7e3','#344353',.68,2.7,1.05,115,440);
const TREASURY=look('#87acd0','#30364b','#ffd595','#91bce8','#243e58',.52,2.8,1.35,44,180);
const CABIN=look('#edc68f','#442f33','#a4dcea','#ffc579','#352a37',.44,.45,.78,35,180);

/** Source-owned looks for the harbour, caves and separately staged skate hold.
 * Existing scene lights and fog are reused; no lights, textures or shaders
 * are created during a frame. applyTheme replaces this controller on exit. */
export class DrownedCrownLighting {
 private readonly exterior:Look;
 private fillOrigin:THREE.Vector3|undefined;
 private skyAllowed:boolean|undefined;private mistAllowed:boolean|undefined;
 constructor(private readonly rig:Rig,base:ResolvedAtmosphere){
  this.exterior={sky:atmosphereColor(base.ambientSky),ground:atmosphereColor(base.ambientGround),sun:atmosphereColor(base.sunColor),
   fill:atmosphereColor(base.fillColor),fog:atmosphereColor(base.fogColor),ambient:base.ambientIntensity,key:base.sunIntensity,bounce:base.fillIntensity,near:base.fogNear,far:base.fogFar};
 }
 update(x:number,y:number,z:number):void{
  const stagedInterior=x>500;
  if(stagedInterior)x-=DROWNED_INTERIOR_OFFSET_X;
  const inside=stagedInterior?1:1-THREE.MathUtils.smoothstep(z,24,67),mine=stagedInterior?0:inside;
  const chamber=stagedInterior?0:inside*THREE.MathUtils.smoothstep(-z,38,90);
  // Entry warmth follows the whole Y8 arrival room. It does not switch off
  // when the player jumps or reaches the Y26 balcony.
  const cabin=stagedInterior?1-THREE.MathUtils.smoothstep(-z,126,160):
   THREE.MathUtils.smoothstep(y,10.5,13.5)*(1-THREE.MathUtils.smoothstep(y,22,26))*(1-THREE.MathUtils.smoothstep(Math.abs(x),11,16))*
   THREE.MathUtils.smoothstep(z,-118,-106)*(1-THREE.MathUtils.smoothstep(z,-90,-84));
  const hold=stagedInterior?0:THREE.MathUtils.smoothstep(-z,167,179)*(1-THREE.MathUtils.smoothstep(-z,207,222))*(1-THREE.MathUtils.smoothstep(y,1,5))*(1-THREE.MathUtils.smoothstep(Math.abs(x),12,20));
  // Keep the original warm reveal at the same point within the moved vault.
  const treasury=stagedInterior?THREE.MathUtils.smoothstep(-(z-DROWNED_TREASURY_OFFSET[2]),278,296):THREE.MathUtils.smoothstep(-z,278,296);
  const base=stagedInterior?SKATE_HOLD:this.exterior,entry=stagedInterior?ENTRY_GALLERY:CABIN,{hemi,sun,fill,fog}=this.rig;
  const color=(out:THREE.Color,key:'sky'|'ground'|'sun'|'fill'|'fog')=>out.copy(base[key]).lerp(MINE[key],mine).lerp(MOONPOOL[key],chamber).lerp(HOLD[key],hold).lerp(entry[key],cabin).lerp(TREASURY[key],treasury);
  const value=(key:'ambient'|'key'|'bounce'|'near'|'far')=>THREE.MathUtils.lerp(THREE.MathUtils.lerp(THREE.MathUtils.lerp(THREE.MathUtils.lerp(THREE.MathUtils.lerp(base[key],MINE[key],mine),MOONPOOL[key],chamber),HOLD[key],hold),entry[key],cabin),TREASURY[key],treasury);
  color(hemi.color,'sky');color(hemi.groundColor,'ground');color(sun.color,'sun');color(fill.color,'fill');
  hemi.intensity=value('ambient');sun.intensity=value('key');fill.intensity=value('bounce');
  this.fillOrigin??=fill.position.clone();fill.position.lerpVectors(this.fillOrigin,stagedInterior?SKATE_HOLD_FILL_POSITION:CAVE_FILL_POSITION,inside);
  if(fog){color(fog.color,'fog');fog.near=value('near');fog.far=value('far');}
  if(this.rig.background){color(this.rig.background,'fog');this.rig.background.lerp(SKYLIGHT_BACKGROUND,chamber*(1-hold)*(1-cabin)*(1-treasury));}
  if(this.rig.sky){this.skyAllowed??=this.rig.sky.visible;this.rig.sky.visible=this.skyAllowed&&inside<.99;}
  if(this.rig.mist){this.mistAllowed??=this.rig.mist.visible;this.rig.mist.visible=this.mistAllowed&&inside<.99;}
 }
}
