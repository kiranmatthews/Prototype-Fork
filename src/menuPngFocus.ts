import profile from './menu-png-focus-profile.json';
import {getMenuPngFocusSettings,menuPngFocusRevision,type MenuPngFocusSettings} from './menuPngFocusSettings';
import './menu-png-focus.css';

export const MENU_PNG_FOCUS_FPS=profile.fps;
export function menuPngReferenceFrame(elapsedMs:number):number {
  return Math.floor(Math.max(0,elapsedMs)*MENU_PNG_FOCUS_FPS/1000+1e-7)%profile.cycle.length;
}
export function menuPngColourFilter(selected:boolean,white:boolean,settings:Readonly<MenuPngFocusSettings>=getMenuPngFocusSettings()):string {
  if(!selected)return `saturate(${settings.inactiveSaturation}) brightness(${settings.inactiveBrightness})`;
  // The orange phase is exactly the existing neutral PNG, with no filter.
  return white?`saturate(${1-settings.whiteDesaturation}) brightness(${settings.whiteBrightness})`:'none';
}
const reduced=typeof matchMedia==='function'?matchMedia('(prefers-reduced-motion: reduce)'):null;
const states=new WeakMap<HTMLElement,{focused:HTMLButtonElement|null;origin:number;phase:string;revision:number;buttons:HTMLButtonElement[]}>();
/** Runs in the existing presentation frame, before the PNG text is drawn.
 * Only CSS filter properties change: no glyph replacement, pixel writes,
 * rewrites of source imagery, or changes to the font painter.
 */
export function updateMenuPngFocus(root:HTMLElement,now:number,refresh=false):boolean {
  if(typeof root.style?.setProperty!=='function')return false;
  root.classList.add('png-menu-focus');
  let state=states.get(root);
  if(!state){state={focused:null,origin:now,phase:'',revision:-1,buttons:[]};states.set(root,state);refresh=true;}
  const focused=root.querySelector<HTMLButtonElement>('.game-menu-button.selected:not(:disabled)');
  if(state.focused!==focused){state.focused=focused;state.origin=now;refresh=true;}
  if(state.revision!==menuPngFocusRevision()){state.revision=menuPngFocusRevision();refresh=true;}
  if(refresh)state.buttons=[...root.querySelectorAll<HTMLButtonElement>('.game-menu-button:not(.game-control-hint):not(.game-map-close)')];
  const settings=getMenuPngFocusSettings(),position=(Math.max(0,now-state.origin)*settings.rateHz/1000)%1;
  const white=!reduced?.matches&&settings.rateHz>0&&position<settings.whitePercent/100;
  const frame=Math.floor(position*profile.cycle.length+1e-7)%profile.cycle.length,phase=white?'white':'orange';
  root.dataset.menuPngFrame=String(frame);
  if(!refresh&&phase===state.phase)return false;
  state.phase=phase;root.dataset.menuPngPhase=phase;
  for(const button of state.buttons){
    const filter=menuPngColourFilter(button===focused,white,settings);
    button.style.setProperty('--menu-png-colour-filter',filter);
  }
  return true;
}
