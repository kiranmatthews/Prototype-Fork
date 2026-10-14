import * as THREE from 'three';
import { atmosphereColor, type ResolvedAtmosphere } from './levelAtmosphere';

type Rig={hemi:THREE.HemisphereLight;sun:THREE.DirectionalLight;fill:THREE.DirectionalLight;fog:THREE.Fog|null;sky?:THREE.Object3D;mist?:THREE.Object3D;background?:THREE.Color};
type Look={sky:THREE.Color;ground:THREE.Color;sun:THREE.Color;fill:THREE.Color;fog:THREE.Color;ambient:number;key:number;bounce:number;near:number;far:number};
const look=(sky:string,ground:string,sun:string,fill:string,fog:string,ambient:number,key:number,bounce:number,near:number,far:number):Look=>({
 sky:new THREE.Color(sky),ground:new THREE.Color(ground),sun:new THREE.Color(sun),fill:new THREE.Color(fill),fog:new THREE.Color(fog),ambient,key,bounce,near,far});
const MINE=look('#7099bf','#24243c','#a6e6f2','#8cacd2','#22354f',.56,.78,.9,24,170);
const MOONPOOL=look('#7fa1c4','#24253a','#a4dcea','#c4d2d7','#203e57',.62,1.05,1.3,55,290);
const HOLD=look('#9ba9b6','#393240','#80d3df','#f2ca8d','#273746',.68,.65,1.12,30,125);
const CAVE_FILL_POSITION=new THREE.Vector3(-38,30,22);
const CABIN=look('#edc68f','#442f33','#a4dcea','#ffc579','#352a37',.44,.45,.78,35,180);

/** A source-owned view-light profile: warm harbour, cool cave and warm cabin.
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
  const inside=1-THREE.MathUtils.smoothstep(z,24,67),chamber=inside*THREE.MathUtils.smoothstep(-z,38,90);
  const cabin=THREE.MathUtils.smoothstep(y,10.5,13.5)*(1-THREE.MathUtils.smoothstep(y,22,26))*(1-THREE.MathUtils.smoothstep(Math.abs(x),11,16))*
   THREE.MathUtils.smoothstep(z,-118,-106)*(1-THREE.MathUtils.smoothstep(z,-90,-84));
  const hold=THREE.MathUtils.smoothstep(-z,167,179)*(1-THREE.MathUtils.smoothstep(-z,207,222))*(1-THREE.MathUtils.smoothstep(y,1,5))*(1-THREE.MathUtils.smoothstep(Math.abs(x),12,20));
  const base=this.exterior,{hemi,sun,fill,fog}=this.rig;
  const color=(out:THREE.Color,key:'sky'|'ground'|'sun'|'fill'|'fog')=>out.copy(base[key]).lerp(MINE[key],inside).lerp(MOONPOOL[key],chamber).lerp(HOLD[key],hold).lerp(CABIN[key],cabin);
  const value=(key:'ambient'|'key'|'bounce'|'near'|'far')=>THREE.MathUtils.lerp(THREE.MathUtils.lerp(THREE.MathUtils.lerp(THREE.MathUtils.lerp(base[key],MINE[key],inside),MOONPOOL[key],chamber),HOLD[key],hold),CABIN[key],cabin);
  color(hemi.color,'sky');color(hemi.groundColor,'ground');color(sun.color,'sun');color(fill.color,'fill');
  hemi.intensity=value('ambient');sun.intensity=value('key');fill.intensity=value('bounce');
  this.fillOrigin??=fill.position.clone();fill.position.lerpVectors(this.fillOrigin,CAVE_FILL_POSITION,inside);
  if(fog){color(fog.color,'fog');fog.near=value('near');fog.far=value('far');}
  if(this.rig.background)color(this.rig.background,'fog');
  if(this.rig.sky){this.skyAllowed??=this.rig.sky.visible;this.rig.sky.visible=this.skyAllowed&&inside<.99;}
  if(this.rig.mist){this.mistAllowed??=this.rig.mist.visible;this.rig.mist.visible=this.mistAllowed&&inside<.99;}
 }
}
