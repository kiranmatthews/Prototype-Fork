import { UNITY_OCEAN_DEFAULTS, type CoastWater, type UnityOceanParams, type OceanColor } from './unityOcean';
import { createMapOceanDefaults } from './mapOceanPreset';
import { readForkStudioDraft } from './localGameStorage';
import { applyMapOutline, cleanMapOutline, mapOutlineParams, type MapOutlineKey, type MapOutlineParams } from './mapIslandOutline';
import type { IslandShoreFoam } from './islandShoreFoam';

export type OceanContext = 'map' | 'level';
export const OCEAN_TUNING_KEY = 'solProtoOceanTuning.v2';
export const OCEAN_DEBUG_KEYS = ['water','horizon','reflection','prepass','refraction','caustics','intersection','freeze','wireframe'] as const;
export type OceanDebugKey = typeof OCEAN_DEBUG_KEYS[number];
export type OceanColorKey = 'shallow'|'deep'|'peak'|'shadow'|'specular'|'intersection';
export type OceanNumericKey = { [K in keyof UnityOceanParams]: UnityOceanParams[K] extends number ? K : never }[keyof UnityOceanParams];
export type OceanFieldPath = readonly [OceanNumericKey] | readonly [OceanColorKey, keyof OceanColor];
type ParamsPatch = { [K in keyof UnityOceanParams]?: UnityOceanParams[K] extends number ? number : Partial<OceanColor> };
interface Profile { params: ParamsPatch; debug: Partial<Record<OceanDebugKey, boolean>>; outline: Partial<MapOutlineParams> }
interface StorageLike { getItem(key:string):string|null; setItem(key:string,value:string):void }

export function cloneOceanParams(source: UnityOceanParams): UnityOceanParams {
  return { ...source, shallow:{...source.shallow},deep:{...source.deep},peak:{...source.peak},shadow:{...source.shadow},specular:{...source.specular},intersection:{...source.intersection} };
}
function cleanProfile(raw: unknown): Profile {
  const result: Profile={params:{},debug:{},outline:{}};
  if(!raw||typeof raw!=='object')return result;
  const value=raw as Record<string,unknown>;
  result.outline=cleanMapOutline(value.outline);
  if(value.params&&typeof value.params==='object') {
    const params=value.params as Record<string,unknown>, out=result.params as Record<string,unknown>;
    for(const [key,base] of Object.entries(UNITY_OCEAN_DEFAULTS)) {
      const entry=params[key];
      if(typeof base==='number') { if(typeof entry==='number'&&Number.isFinite(entry))out[key]=entry; }
      else if(entry&&typeof entry==='object') {
        const color:Record<string,number>={};
        for(const channel of ['r','g','b','a']) {const n=(entry as Record<string,unknown>)[channel];if(typeof n==='number'&&Number.isFinite(n))color[channel]=n;}
        if(Object.keys(color).length)out[key]=color;
      }
    }
  }
  if(value.debug&&typeof value.debug==='object')for(const key of OCEAN_DEBUG_KEYS) {
    const enabled=(value.debug as Record<string,unknown>)[key];if(typeof enabled==='boolean')result.debug[key]=enabled;
  }
  return result;
}
function merge(base: UnityOceanParams, patch: ParamsPatch): UnityOceanParams {
  const result=cloneOceanParams(base), out=result as unknown as Record<string,unknown>;
  for(const [key,value] of Object.entries(patch))out[key]=typeof value==='number'?value:{...(out[key] as object),...value};
  return result;
}
export function defaultOceanDebug(water: CoastWater | null, key: OceanDebugKey): boolean {
  if(key==='water'||key==='horizon')return true;
  if(key==='freeze'||key==='wireframe')return false;
  return water?.stats.quality!=='lite';
}

/** Sparse, independent overrides; each ocean retains its own authored baseline. */
export class OceanTuningStore {
  private profiles: Record<OceanContext,Profile>={map:cleanProfile(null),level:cleanProfile(null)};
  private revisions: Record<OceanContext,number>={map:0,level:0};
  private defaults: Record<OceanContext,UnityOceanParams>={map:createMapOceanDefaults(),level:cloneOceanParams(UNITY_OCEAN_DEFAULTS)};
  private instances=new WeakMap<CoastWater,{base:UnityOceanParams;context:OceanContext;revision:number;quality:string}>();
  private saveFailed=false;
  private outlines=new WeakMap<IslandShoreFoam,number>();
  constructor(private storage?:StorageLike) {
    try {
      const saved=JSON.parse(storage?.getItem(OCEAN_TUNING_KEY)??'null');
      if(saved?.version===2){this.profiles={map:cleanProfile(saved.map),level:cleanProfile(saved.level)};return;}
      // The old studio was the in-level Unity preset. Never import it into the map.
      const old=JSON.parse(storage?readForkStudioDraft(storage,'solProtoUnityOceanStudioV1','unityOceanStudioV1')??'null':'null');
      if(old?.version===1)this.profiles.level=cleanProfile(old);
    } catch { /* malformed/private storage falls back to authored defaults */ }
  }
  params(context:OceanContext):UnityOceanParams { return merge(this.defaults[context],this.profiles[context].params); }
  get persistenceError():boolean { return this.saveFailed; }
  debug(context:OceanContext):Readonly<Profile['debug']> { return {...this.profiles[context].debug}; }
  setField(context:OceanContext,path:OceanFieldPath,value:number):void {
    if(!Number.isFinite(value))return;
    const patch=this.profiles[context].params as Record<string,unknown>;
    if(path.length===1)patch[path[0]]=value;
    else patch[path[0]]={...(patch[path[0]] as object??{}),[path[1]]:value};
    this.changed(context);
  }
  setDebug(context:OceanContext,key:OceanDebugKey,value:boolean):void { this.profiles[context].debug[key]=value;this.changed(context); }
  outline():MapOutlineParams { return mapOutlineParams(this.profiles.map.outline); }
  setOutline(key:MapOutlineKey,value:number):void {
    const clean=cleanMapOutline({[key]:value});
    if(clean[key]===undefined)return;
    Object.assign(this.profiles.map.outline,clean);this.changed('map');
  }
  applyOutline(shore:IslandShoreFoam):void {
    if(this.outlines.get(shore)===this.revisions.map)return;
    applyMapOutline(shore,this.outline());this.outlines.set(shore,this.revisions.map);
  }
  reset(context:OceanContext):void { this.profiles[context]=cleanProfile(null);this.changed(context); }
  serialize(context:OceanContext):string { return JSON.stringify({context,params:this.params(context),debug:this.debug(context),...(context==='map'?{outline:this.outline()}:{})},null,2); }
  apply(water:CoastWater,context:OceanContext):void {
    let entry=this.instances.get(water);
    if(!entry){entry={base:cloneOceanParams(water.params),context,revision:-1,quality:''};this.instances.set(water,entry);this.defaults[context]=cloneOceanParams(entry.base);}
    const quality=water.stats.quality;
    if(entry.context===context&&entry.revision===this.revisions[context]&&entry.quality===quality)return;
    Object.assign(water.params,merge(entry.base,this.profiles[context].params));
    for(const key of OCEAN_DEBUG_KEYS)water.debug[key]=this.profiles[context].debug[key]??defaultOceanDebug(water,key);
    entry.context=context;entry.revision=this.revisions[context];entry.quality=quality;
    water.markWavesDirty();
  }
  private changed(context:OceanContext):void {
    this.revisions[context]++;
    try {
      this.saveFailed=!this.storage;
      this.storage?.setItem(OCEAN_TUNING_KEY,JSON.stringify({version:2,...this.profiles}));
    }catch{this.saveFailed=true;}
  }
}
function browserStorage(): StorageLike | undefined { try {return typeof localStorage==='undefined'?undefined:localStorage;}catch{return undefined;} }
export const oceanTuning = new OceanTuningStore(browserStorage());
