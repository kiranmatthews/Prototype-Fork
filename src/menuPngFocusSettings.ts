import profile from './menu-png-focus-profile.json';
export interface MenuPngFocusSettings {
  rateHz:number;
  whitePercent:number;
  whiteBrightness:number;
  whiteDesaturation:number;
  inactiveSaturation:number;
  inactiveBrightness:number;
}
export const MENU_PNG_FOCUS_KEY='solProtoMenuPngFocusV2';
export const MENU_PNG_FOCUS_EVENT='menu-png-focus-settings';
export const MENU_PNG_FOCUS_DEFAULTS:Readonly<MenuPngFocusSettings>={rateHz:profile.fps/profile.cycle.length,whitePercent:100*profile.cycle.filter(frame=>frame==='white').length/profile.cycle.length,whiteBrightness:1.94,whiteDesaturation:1,inactiveSaturation:.35,inactiveBrightness:1};
export const MENU_PNG_FOCUS_RANGES:Record<keyof MenuPngFocusSettings,readonly[number,number,number]>={rateHz:[0,15,.25],whitePercent:[0,100,1],whiteBrightness:[1,4,.01],whiteDesaturation:[0,1,.01],inactiveSaturation:[0,1,.01],inactiveBrightness:[.2,1.5,.01]};
function valid(raw:Partial<MenuPngFocusSettings>):MenuPngFocusSettings {
  const result={...MENU_PNG_FOCUS_DEFAULTS};for(const key of Object.keys(result) as (keyof MenuPngFocusSettings)[]){const v=raw[key];if(typeof v==='number'&&Number.isFinite(v)){const[min,max]=MENU_PNG_FOCUS_RANGES[key];result[key]=Math.max(min,Math.min(max,v));}}return result;
}
function read(){try{return valid(JSON.parse(localStorage.getItem(MENU_PNG_FOCUS_KEY)||'{}'));}catch{return {...MENU_PNG_FOCUS_DEFAULTS};}}
let settings=read(),revision=0;
export const getMenuPngFocusSettings=():Readonly<MenuPngFocusSettings>=>settings;
export const menuPngFocusRevision=()=>revision;
export function setMenuPngFocusSettings(patch:Partial<MenuPngFocusSettings>):void {
  settings=valid({...settings,...patch});revision++;try{localStorage.setItem(MENU_PNG_FOCUS_KEY,JSON.stringify(settings));}catch{/* Keep the live preview usable. */}window.dispatchEvent(new Event(MENU_PNG_FOCUS_EVENT));
}
export function resetMenuPngFocusSettings():void{setMenuPngFocusSettings({...MENU_PNG_FOCUS_DEFAULTS});}
if(typeof window!=='undefined')window.addEventListener('storage',event=>{if(event.key!==MENU_PNG_FOCUS_KEY)return;settings=read();revision++;window.dispatchEvent(new Event(MENU_PNG_FOCUS_EVENT));});
