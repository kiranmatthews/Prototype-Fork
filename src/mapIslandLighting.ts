import * as THREE from 'three';
import { campaignLevelByKey, type CampaignIslandId } from './campaign';
import { atmosphereColor, type CustomAtmosphereData, type ResolvedAtmosphere } from './levelAtmosphere';

type LightFields = Pick<ResolvedAtmosphere, 'fogColor'|'ambientSky'|'ambientGround'|'ambientIntensity'|'sunColor'|'sunIntensity'|'fillColor'|'fillIntensity'>;
type Look = {
  fog:THREE.Color; sky:THREE.Color; ground:THREE.Color; sun:THREE.Color; fill:THREE.Color;
  ambient:number; key:number; bounce:number;
};
type Rig = {
  hemi:THREE.HemisphereLight; sun:THREE.DirectionalLight; fill:THREE.DirectionalLight;
  fog:THREE.Fog|null; background:THREE.Color; haze:THREE.Color;
};

// The island's atmosphere carries its theme without changing course lighting
// or adding more lights. The same rig blends smoothly during an ocean pan.
const ISLAND_LIGHT:Partial<Record<CampaignIslandId,Partial<LightFields>>>={
  'island-2':{fogColor:'#b2b8bd',ambientSky:'#b9c9df',ambientGround:'#8a7757',sunColor:'#ffcf95',sunIntensity:2.35},
  'island-3':{fogColor:'#727d99',ambientSky:'#a2b5d6',ambientGround:'#444353',ambientIntensity:.9,sunColor:'#b7cbee',sunIntensity:1.7,fillColor:'#b5a4d1',fillIntensity:.4},
  'island-4':{fogColor:'#b6ced6',ambientGround:'#85946b',sunColor:'#fff0d4',sunIntensity:2.25},
  'island-5':{fogColor:'#7d7489',ambientSky:'#b4a9c9',ambientGround:'#583e3c',ambientIntensity:1.2,sunColor:'#ffc4a4',sunIntensity:2.35,fillColor:'#b5c6eb',fillIntensity:.55},
  'hidden-shores':{fogColor:'#d7d7e6',ambientSky:'#e4e4f3',ambientGround:'#a89c83',ambientIntensity:1.2,sunColor:'#fff0cc',sunIntensity:2.25,fillColor:'#d5c8ec',fillIntensity:.4},
};
function makeLook(values:LightFields):Look {
  return {fog:atmosphereColor(values.fogColor),sky:atmosphereColor(values.ambientSky),ground:atmosphereColor(values.ambientGround),
    sun:atmosphereColor(values.sunColor),fill:atmosphereColor(values.fillColor),ambient:values.ambientIntensity,key:values.sunIntensity,bounce:values.fillIntensity};
}

export class MapIslandLighting {
  private readonly looks=new Map<CampaignIslandId,Look>();
  private readonly base:Look;
  private initialized=false;
  constructor(private readonly rig:Rig,base:ResolvedAtmosphere,authored?:CustomAtmosphereData){
    this.base=makeLook(base);
    for(const [id,values] of Object.entries(ISLAND_LIGHT)){
      // Explicit editor fields retain priority over the per-island defaults.
      const resolved={...base,...values};
      for(const key of Object.keys(values) as (keyof LightFields)[])
        if(authored?.[key]!==undefined)Object.assign(resolved,{[key]:authored[key]});
      this.looks.set(id as CampaignIslandId,makeLook(resolved));
    }
  }
  update(progressKey:string,dt:number):void {
    const island=campaignLevelByKey(progressKey)?.islandId;
    const look=(island&&this.looks.get(island))||this.base;
    const blend=this.initialized?1-Math.exp(-2.2*Math.max(0,dt)):1;
    this.initialized=true;
    const {hemi,sun,fill,fog,background,haze}=this.rig;
    hemi.color.lerp(look.sky,blend);hemi.groundColor.lerp(look.ground,blend);
    sun.color.lerp(look.sun,blend);fill.color.lerp(look.fill,blend);
    hemi.intensity=THREE.MathUtils.lerp(hemi.intensity,look.ambient,blend);
    sun.intensity=THREE.MathUtils.lerp(sun.intensity,look.key,blend);
    fill.intensity=THREE.MathUtils.lerp(fill.intensity,look.bounce,blend);
    fog?.color.lerp(look.fog,blend);background.lerp(look.fog,blend);haze.lerp(look.fog,blend);
  }
}
