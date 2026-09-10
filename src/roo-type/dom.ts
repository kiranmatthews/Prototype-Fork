import { ROO_ATLAS_METRICS } from './atlas-metrics';
import { layoutRooAtlas, loadRooAtlases, RooAtlasPainter, rooAtlasGlyphRect, rooAtlasUrl } from './atlas';
import type { RooTextHandle, RooTextOptions, RooPaletteName } from '../roo-text.js';

const NS='http://www.w3.org/2000/svg';
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
  const tracking=(options.tracking??-2.5)/200;
  const svg=node('svg',{class:'roo-text-svg is-ready',role:'img',preserveAspectRatio:'xMidYMid meet',overflow:'visible'});
  const defs=node('defs'),semantic=node('text',{'font-family':'Roo'}),art=node('g');
  defs.append(semantic);svg.append(defs,art);
  host.classList.add('roo-text-host');host.replaceChildren(svg);
  let destroyed=false;
  async function setText(raw:string){
    if(destroyed)return;
    const text=raw.toUpperCase();semantic.textContent=text;svg.setAttribute('aria-label',text);art.replaceChildren();
    const layout=layoutRooAtlas(metrics,text,tracking);
    if(!layout){
      // Rare unsupported symbols retain readable text instead of disappearing.
      const fallback=node('text',{x:0,y:metrics.capBand.top/metrics.capBand.height,'font-family':'Roo, sans-serif',
        'font-size':metrics.capBand.unitsPerEm/metrics.capBand.height,fill:palette==='bonus'?'#78ec39':'#ffc22b'});
      fallback.textContent=text;art.append(fallback);
      const ctx=document.createElement('canvas').getContext('2d')!;
      ctx.font=`400 ${200*metrics.capBand.unitsPerEm/metrics.capBand.height}px Roo, sans-serif`;
      svg.setAttribute('viewBox',`-.03 -.1425 ${Math.max(.06,ctx.measureText(text).width/200+.06)} 1.285`);
      return;
    }
    for(const entry of layout.glyphs){
      const g=metrics.glyphs[entry.char];
      const rect=rooAtlasGlyphRect(metrics,entry);
      const glyph=node('svg',{x:rect.x,y:rect.y,width:rect.width,height:rect.height,
        viewBox:`${g.x} ${g.y} ${g.width} ${g.height}`,overflow:'hidden',preserveAspectRatio:'none'});
      glyph.append(node('image',{href:rooAtlasUrl(palette),width:metrics.width,height:metrics.height}));
      art.append(glyph);
    }
    svg.setAttribute('viewBox',`${layout.min-.03} -.1425 ${Math.max(.06,layout.width+.06)} 1.285`);
  }
  await setText(options.text??host.dataset.rooText??'BONUS');
  return {element:svg,setText,destroy(){destroyed=true;svg.remove();}};
}
