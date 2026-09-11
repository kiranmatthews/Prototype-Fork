/** Appearance is shared by the lab, menus and HUD, using fork-owned storage. */
export interface RooAppearance {
  tracking: number;
  shimmer: boolean;
  lightStrength: number;
}
export const ROO_APPEARANCE_KEY='solProtoRooAppearanceV3';
export const ROO_APPEARANCE_DEFAULTS:Readonly<RooAppearance>={tracking:-.065,shimmer:true,lightStrength:.7};
export const ROO_APPEARANCE_EVENT='roo-appearance-change';
const listeners=new Set<()=>void>();
let timer:ReturnType<typeof setInterval>|undefined;
const clamp=(v:number,a:number,b:number)=>Math.max(a,Math.min(b,v));
function valid(raw:Partial<RooAppearance>):RooAppearance {
  return {tracking:Number.isFinite(raw.tracking)?clamp(raw.tracking!,-.16,.16):ROO_APPEARANCE_DEFAULTS.tracking,
    shimmer:typeof raw.shimmer==='boolean'?raw.shimmer:ROO_APPEARANCE_DEFAULTS.shimmer,
    lightStrength:Number.isFinite(raw.lightStrength)?clamp(raw.lightStrength!,0,1):ROO_APPEARANCE_DEFAULTS.lightStrength};
}
function read():RooAppearance{try{return valid(JSON.parse(localStorage.getItem(ROO_APPEARANCE_KEY)||'{}'));}catch{return {...ROO_APPEARANCE_DEFAULTS};}}
let appearance=read();
const syncCss=()=>{if(typeof document!=='undefined')document.documentElement?.style?.setProperty('--roo-tracking',`${appearance.tracking}em`);};
syncCss();
const motionMedia=typeof matchMedia==='function'?matchMedia('(prefers-reduced-motion: reduce)'):null;
export function getRooAppearance():Readonly<RooAppearance>{return appearance;}
export function setRooAppearance(change:Partial<RooAppearance>):void {
  appearance=valid({...appearance,...change});
  syncCss();
  try{localStorage.setItem(ROO_APPEARANCE_KEY,JSON.stringify(appearance));}catch{/* The current session still uses the chosen appearance. */}
  if(typeof window!=='undefined')window.dispatchEvent?.(new Event(ROO_APPEARANCE_EVENT));for(const listener of listeners)listener();
}
export function rooLightStatus():'playing'|'paused'|'reduced-motion'|'zero-strength'{
  if(!appearance.shimmer)return 'paused';
  if(motionMedia?.matches)return 'reduced-motion';
  if(appearance.lightStrength<=0)return 'zero-strength';
  return 'playing';
}
export function rooMotionEnabled():boolean{return rooLightStatus()==='playing'&&motionMedia?.matches===false;}
export function rooLightPosition(now=performance.now()):number {
  return rooMotionEnabled()?Math.sin(now/1000*Math.PI*2/11)*appearance.lightStrength:0;
}
export function rooLightWeights(position=rooLightPosition()):readonly number[]{
  const p=clamp(position,-1,1);return [1-Math.abs(p),Math.max(0,-p),Math.max(0,p)];
}
/** One slow clock, shared by all visible DOM labels and the frozen menu. */
export function subscribeRooLight(listener:()=>void):()=>void {
  listeners.add(listener);
  if(!timer&&typeof document!=='undefined'&&document.documentElement){
    let moving=rooMotionEnabled();
    timer=setInterval(()=>{const next=rooMotionEnabled();if(!document.hidden&&(next||next!==moving))for(const f of listeners)f();moving=next;},1000/24);
  }
  return()=>{listeners.delete(listener);if(!listeners.size&&timer){clearInterval(timer);timer=undefined;}};
}
if(typeof window!=='undefined')window.addEventListener('storage',event=>{
  if(event.key!==ROO_APPEARANCE_KEY)return;appearance=read();syncCss();window.dispatchEvent(new Event(ROO_APPEARANCE_EVENT));for(const listener of listeners)listener();
});
motionMedia?.addEventListener?.('change',()=>{for(const listener of listeners)listener();});
if(typeof document!=='undefined')document.addEventListener?.('visibilitychange',()=>{if(!document.hidden)for(const listener of listeners)listener();});
