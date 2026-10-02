import { createBakedRooText } from './dom';
import './menu.css';
import { layoutRooAtlas, ROO_ATLAS_EVENT } from './atlas';
import { ROO_ATLAS_METRICS } from './atlas-metrics';
import { getRooAppearance } from './settings';
import type { RooTextHandle } from '../roo-text.js';
import { menuAssetsReady } from './menuAssets';

const preparations = new WeakMap<HTMLElement, () => Promise<void>>();
export const waitForRooMenuText = (root: HTMLElement): Promise<void> => preparations.get(root)?.() ?? menuAssetsReady;

export const rooMenuText=(text:string)=>text.toUpperCase().replace(/[‘’]/g,"'").replace(/[“”]/g,'"').replace(/[–—]/g,'-').replace(/…/g,'...').replace(/×/g,'X');
export const rooMenuTitle=(node:Element)=>!!node.closest('.game-logo,.game-panel-title,.game-over-title,.comp-card h1,.comp-countdown>strong');
export const rooMenuPalette=(node:Element)=>node.closest('.game-logo,.game-menu-button:not(.game-control-hint)')?'counter' as const:rooMenuTitle(node)||!!node.closest('.timber-card,.comp-run-hud>strong')?'bonus' as const:'counter' as const;

/** Decorate the existing semantic menu; hit targets and control hints stay owned by it. */
export function installRooMenuText(root:HTMLElement,onLayout:()=>void):()=>void {
  if(typeof MutationObserver==='undefined'||typeof document.createTreeWalker!=='function')return()=>{};
  const handles=new Map<HTMLElement,RooTextHandle>(),pending=new Set<Promise<void>>();let queued=false,disposed=false;
  root.dataset.rooMenuPending='';
  function decorate(textNode:Text):Promise<void>|undefined{
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
    return createBakedRooText(art,{text:normalized,palette,tracking:0,decorative:true}).catch(()=>null).then(handle=>{
      // Keep one readable fallback if the network failed. Replacing it with a
      // fresh text node would trigger the observer and retry forever.
      if(!handle){wrapper.dataset.fallback='';return;}
      if(disposed||!root.contains(wrapper)){handle.destroy();return;}
      handles.set(wrapper,handle);fit();
    });
  }
  function scan(){
    queued=false;if(disposed)return;
    for(const [wrapper,handle]of handles)if(!root.contains(wrapper)){handle.destroy();handles.delete(wrapper);}
    const walker=document.createTreeWalker(root,NodeFilter.SHOW_TEXT),nodes:Text[]=[];
    while(walker.nextNode())nodes.push(walker.currentNode as Text);
    for(const text of nodes){
      const task=decorate(text);if(task){pending.add(task);void task.finally(()=>pending.delete(task));}
    }
  }
  async function prepare(){
    await menuAssetsReady;
    // Mutation delivery, async decoration and its layout event can each queue
    // more work. Publish one complete menu after the whole tree has settled.
    for(;;){
      scan();
      const active=[...pending];if(!active.length)break;
      await Promise.all(active);await Promise.resolve();
    }
    if(!disposed){root.removeAttribute('data-roo-menu-pending');onLayout();}
  }
  const atlasChanged=()=>{
    for(const wrapper of root.querySelectorAll<HTMLElement>('[data-roo-menu][data-fallback]'))
      wrapper.replaceWith(document.createTextNode(wrapper.querySelector('.roo-menu-source')?.textContent??''));
    scan();onLayout();
  };
  preparations.set(root,prepare);
  window.addEventListener(ROO_ATLAS_EVENT,atlasChanged);
  const observer=new MutationObserver(()=>{if(!queued){queued=true;queueMicrotask(scan);}});
  observer.observe(root,{childList:true,characterData:true,subtree:true});scan();
  void prepare();
  return()=>{disposed=true;observer.disconnect();preparations.delete(root);window.removeEventListener(ROO_ATLAS_EVENT,atlasChanged);for(const handle of handles.values())handle.destroy();handles.clear();};
}
