import { createBakedRooText } from './dom';
import './menu.css';
import { layoutRooAtlas } from './atlas';
import { ROO_ATLAS_METRICS } from './atlas-metrics';
import { getRooAppearance } from './settings';
import type { RooTextHandle } from '../roo-text.js';

export const rooMenuText=(text:string)=>text.toUpperCase().replace(/[‘’]/g,"'").replace(/[“”]/g,'"').replace(/[–—]/g,'-').replace(/…/g,'...').replace(/×/g,'X');
export const rooMenuTitle=(node:Element)=>!!node.closest('.game-logo,.game-panel-title,.game-over-title,.comp-card h1,.comp-countdown>strong');
export const rooMenuPalette=(node:Element)=>node.closest('.game-logo')?'counter' as const:rooMenuTitle(node)||!!node.closest('.timber-card')?'bonus' as const:'counter' as const;

/** Decorate the existing semantic menu; hit targets and control hints stay owned by it. */
export function installRooMenuText(root:HTMLElement,onLayout:()=>void):()=>void {
  if(typeof MutationObserver==='undefined'||typeof document.createTreeWalker!=='function')return()=>{};
  const handles=new Map<HTMLElement,RooTextHandle>();let queued=false,disposed=false;
  async function decorate(textNode:Text){
    const parent=textNode.parentElement,text=textNode.textContent??'';if(!parent||!text.trim())return;
    if(parent.closest('svg,[data-roo-menu],.secondary-silver,.input-glyph,script,style'))return;
    if(!/\bRoo\b/.test(getComputedStyle(parent).fontFamily))return;
    const normalized=rooMenuText(text.trim()),palette=rooMenuPalette(parent);
    if(!layoutRooAtlas(ROO_ATLAS_METRICS[palette],normalized,getRooAppearance().tracking))return;
    const wrapper=document.createElement('span');wrapper.className='roo-menu-label';wrapper.dataset.rooMenu='';
    const source=document.createElement('span');source.className='roo-menu-source';source.textContent=text;
    const art=document.createElement('span');art.className='roo-menu-art';art.setAttribute('aria-hidden','true');
    wrapper.append(source,art);textNode.replaceWith(wrapper);
    const fit=()=>{
      const svg=art.querySelector('svg');if(!svg)return;
      svg.style.width=`${svg.viewBox.baseVal.width*.882}em`;
      svg.style.height='1.13337em';wrapper.dataset.ready='true';onLayout();
    };
    art.addEventListener('roo-layout',fit);
    const handle=await createBakedRooText(art,{text:normalized,palette,tracking:0,decorative:true});
    if(!handle){wrapper.replaceWith(document.createTextNode(text));return;}
    if(disposed||!root.contains(wrapper)){handle.destroy();return;}
    handles.set(wrapper,handle);fit();
  }
  function scan(){
    queued=false;if(disposed)return;
    for(const [wrapper,handle]of handles)if(!root.contains(wrapper)){handle.destroy();handles.delete(wrapper);}
    const walker=document.createTreeWalker(root,NodeFilter.SHOW_TEXT),nodes:Text[]=[];
    while(walker.nextNode())nodes.push(walker.currentNode as Text);
    for(const text of nodes)void decorate(text);
  }
  const observer=new MutationObserver(()=>{if(!queued){queued=true;queueMicrotask(scan);}});
  observer.observe(root,{childList:true,characterData:true,subtree:true});scan();
  return()=>{disposed=true;observer.disconnect();for(const handle of handles.values())handle.destroy();handles.clear();};
}
