import { ROO_ATLAS_METRICS } from './atlas-metrics';
import { layoutRooAtlas, loadRooAtlases, RooAtlasPainter, rooAtlasGlyphRect, rooAtlasUrl, ROO_ATLAS_EVENT } from './atlas';
import type { RooTextHandle, RooTextOptions, RooPaletteName } from '../roo-text.js';
import { getRooAppearance, ROO_APPEARANCE_EVENT, rooLightWeights, subscribeRooLight } from './settings';

const NS='http://www.w3.org/2000/svg';
const compositionListeners=new Set<()=>void>();
let compositionObserver:MutationObserver|undefined;
function observeComposition(listener:()=>void):()=>void {
  compositionListeners.add(listener);
  if(!compositionObserver&&typeof MutationObserver!=='undefined'){
    compositionObserver=new MutationObserver(()=>{for(const update of compositionListeners)update();});
    compositionObserver.observe(document.documentElement,{subtree:true,attributes:true,attributeFilter:['data-precrt-composited']});
  }
  return()=>{compositionListeners.delete(listener);if(!compositionListeners.size){compositionObserver?.disconnect();compositionObserver=undefined;}};
}
function node<K extends keyof SVGElementTagNameMap>(tag:K,attrs:Record<string,string|number>={}) {
  const element=document.createElementNS(NS,tag);
  for(const [key,value]of Object.entries(attrs))element.setAttribute(key,String(value));
  return element;
}

/** Same baked glyphs and cap band for the direct DOM/lite and pre-CRT paths. */
export async function createBakedRooText(host:HTMLElement,options:RooTextOptions):Promise<RooTextHandle|null> {
  await loadRooAtlases();
  if(!new RooAtlasPainter().ready)return null;
  const palette=(options.palette??host.dataset.rooPalette??'bonus') as RooPaletteName,metrics=ROO_ATLAS_METRICS[palette];
  if(!metrics)return null;
  const svg=node('svg',{class:'roo-text-svg is-ready',role:'img',preserveAspectRatio:'xMidYMid meet',overflow:'visible'});
  const defs=node('defs'),semantic=node('text',{'font-family':'Roo'}),art=node('g');
  art.style.isolation='isolate';svg.style.isolation='isolate';
  const frames=Array.from({length:metrics.lightFrames??1},()=>node('g'));
  for(const frame of frames){frame.style.mixBlendMode='plus-lighter';art.append(frame);}
  defs.append(semantic);svg.append(defs,art);
  host.classList.add('roo-text-host');host.replaceChildren(svg);
  let destroyed=false,baked=true,currentText='',nativeInk=true;
  const updateLight=()=>{
    // Canvas already animates the visible copy beneath CRT. Updating hundreds
    // of hidden SVG layers still costs style/raster work on mobile Safari.
    if(!host.isConnected||!nativeInk)return;
    const weights=baked&&frames.length===3?rooLightWeights():[1,0,0];
    for(const [i,frame]of frames.entries())frame.setAttribute('opacity',String(weights[i]??0));
  };
  async function setText(raw:string){
    if(destroyed)return;
    // Keep exact SVG layout/semantics, but do not instantiate hundreds of
    // clipped atlas images for an invisible duplicate of the Canvas lettering.
    nativeInk=!host.closest('[data-precrt-composited]');
    currentText=raw;const text=raw.toUpperCase();semantic.textContent=options.decorative?'':text;svg.setAttribute('aria-label',text);for(const frame of frames)frame.replaceChildren();
    const layout=layoutRooAtlas(metrics,text,(options.tracking??0)/200+getRooAppearance().tracking);baked=!!layout;
    if(!layout){
      // Rare unsupported symbols retain readable text instead of disappearing.
      const fallback=node('text',{x:0,y:metrics.capBand.top/metrics.capBand.height,'font-family':'Roo, sans-serif',
        'font-size':metrics.capBand.unitsPerEm/metrics.capBand.height,fill:palette==='bonus'?'#78ec39':'#ffc22b'});
      fallback.textContent=text;if(nativeInk)frames[0].append(fallback);
      const ctx=document.createElement('canvas').getContext('2d')!;
      ctx.font=`400 ${200*metrics.capBand.unitsPerEm/metrics.capBand.height}px Roo, sans-serif`;
      svg.setAttribute('viewBox',`-.03 -.1425 ${Math.max(.06,ctx.measureText(text).width/200+.06)} 1.285`);
      updateLight();host.dispatchEvent(new Event('roo-layout'));
      return;
    }
    if(nativeInk)for(const entry of layout.glyphs){
      const g=metrics.glyphs[entry.char];
      const rect=rooAtlasGlyphRect(metrics,entry);
      for(const [i,frame]of frames.entries()){
        const glyph=node('svg',{x:rect.x,y:rect.y,width:rect.width,height:rect.height,
          viewBox:`${g.x} ${g.y} ${g.width} ${g.height}`,overflow:'hidden',preserveAspectRatio:'none'});
        glyph.append(node('image',{href:rooAtlasUrl(palette,i),width:metrics.width,height:metrics.height}));
        frame.append(glyph);
      }
    }
    svg.setAttribute('viewBox',`${layout.min-.03} -.1425 ${Math.max(.06,layout.width+.06)} 1.285`);
    updateLight();host.dispatchEvent(new Event('roo-layout'));
  }
  await setText(options.text??host.dataset.rooText??'BONUS');
  if(options.decorative)svg.setAttribute('aria-hidden','true');
  const unsubscribe=subscribeRooLight(updateLight),appearanceChanged=()=>void setText(currentText);
  const stopComposition=observeComposition(()=>{
    const shouldDrawNative=!host.closest('[data-precrt-composited]');
    if(nativeInk!==shouldDrawNative)void setText(currentText);
  });
  window.addEventListener(ROO_APPEARANCE_EVENT,appearanceChanged);
  window.addEventListener(ROO_ATLAS_EVENT,appearanceChanged);
  return {element:svg,setText,destroy(){destroyed=true;unsubscribe();stopComposition();window.removeEventListener(ROO_APPEARANCE_EVENT,appearanceChanged);window.removeEventListener(ROO_ATLAS_EVENT,appearanceChanged);svg.remove();}};
}
