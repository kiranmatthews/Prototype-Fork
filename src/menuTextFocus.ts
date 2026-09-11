import {rooInkMatrix} from './roo-type/ink';
import './menu-text-focus.css';

export const MENU_TEXT_FOCUS_KEY='solProtoMenuTextFocusV1';
export const MENU_TEXT_FOCUS_EVENT='menu-text-focus-change';
export const MENU_TEXT_FOCUS_PERIOD=900;
const motion=typeof matchMedia==='function'?matchMedia('(prefers-reduced-motion: reduce)'):null;
const read=()=>{try{return localStorage.getItem(MENU_TEXT_FOCUS_KEY)!=='false';}catch{return true;}};
let enabled=read(),timer:ReturnType<typeof setInterval>|undefined,phase=-1;
const active=new Set<()=>void>();
export const menuTextFocusEnabled=()=>enabled;
export const menuTextFocusPhase=(now=performance.now())=>enabled&&!motion?.matches?Math.floor(now/(MENU_TEXT_FOCUS_PERIOD/2))%2:0;
export const menuTextFocusColor=(selected:boolean)=>!selected?'#ac8456':menuTextFocusPhase()?'#fffefa':'#ff811d';
export const menuTextFocusStyle=(selected:boolean)=>enabled?{palette:'counter' as const,lightPosition:0,ink:!selected?'tan' as const:menuTextFocusPhase()?'white' as const:undefined}:{};
export function menuTextFocusButton(node:Element):HTMLButtonElement|null {
  return node.closest<HTMLButtonElement>('.game-shell .game-menu-button:not(.game-control-hint):not(.game-map-close),.competition-host .comp-actions button,.competition-host .comp-guide-pager button');
}
function updatePhase(){
  const next=menuTextFocusPhase();if(next===phase)return;phase=next;
  document.body.classList.toggle('menu-focus-white',!!phase);
  for(const draw of active)draw();
}
function install(){
  document.body.classList.toggle('menu-text-focus-enabled',enabled);
  if(!document.getElementById('menu-focus-inks')){
    const ns='http://www.w3.org/2000/svg',svg=document.createElementNS(ns,'svg');
    svg.id='menu-focus-inks';svg.setAttribute('aria-hidden','true');svg.style.cssText='position:absolute;width:0;height:0;overflow:hidden;pointer-events:none';
    const defs=document.createElementNS(ns,'defs');
    for(const ink of ['tan','white'] as const){
      const filter=document.createElementNS(ns,'filter');filter.id=`menu-focus-${ink}`;
      filter.setAttribute('x','-10%');filter.setAttribute('y','-10%');filter.setAttribute('width','120%');filter.setAttribute('height','120%');filter.setAttribute('color-interpolation-filters','sRGB');
      const matrix=document.createElementNS(ns,'feColorMatrix');matrix.setAttribute('type','matrix');matrix.setAttribute('values',rooInkMatrix(ink).join(' '));filter.append(matrix);defs.append(filter);
    }
    svg.append(defs);document.body.append(svg);
  }
  updatePhase();
}
export function setMenuTextFocusEnabled(value:boolean):void {
  enabled=value;try{localStorage.setItem(MENU_TEXT_FOCUS_KEY,String(value));}catch{/* Session preference remains usable. */}
  install();window.dispatchEvent(new Event(MENU_TEXT_FOCUS_EVENT));
}
/** Only visible menus run the two-state colour clock, independently of glisten. */
export function observeMenuTextFocus(root:HTMLElement,invalidate:()=>void):()=>void {
  if(typeof document==='undefined'||typeof document.getElementById!=='function'||typeof MutationObserver==='undefined')return()=>{};
  install();
  const sync=()=>{
    const visible=enabled&&!document.hidden&&!motion?.matches&&!root.hidden&&root.isConnected&&!!root.querySelector('button.selected:not(:disabled)');
    if(visible)active.add(invalidate);else active.delete(invalidate);
    if(active.size&&!timer){updatePhase();timer=setInterval(updatePhase,60);}
    if(!active.size&&timer){clearInterval(timer);timer=undefined;}
  };
  const changed=()=>{install();sync();invalidate();};
  const observer=new MutationObserver(sync);observer.observe(root,{subtree:true,childList:true,attributes:true,attributeFilter:['class','hidden']});
  window.addEventListener(MENU_TEXT_FOCUS_EVENT,changed);document.addEventListener('visibilitychange',changed);motion?.addEventListener('change',changed);sync();
  return()=>{observer.disconnect();active.delete(invalidate);if(!active.size&&timer){clearInterval(timer);timer=undefined;}window.removeEventListener(MENU_TEXT_FOCUS_EVENT,changed);document.removeEventListener('visibilitychange',changed);motion?.removeEventListener('change',changed);};
}
if(typeof window!=='undefined')window.addEventListener('storage',event=>{
  if(event.key!==MENU_TEXT_FOCUS_KEY)return;enabled=read();install();window.dispatchEvent(new Event(MENU_TEXT_FOCUS_EVENT));
});
