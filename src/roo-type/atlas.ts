import { trackPresentationImage } from '../presentationLoading';
import { ROO_ATLAS_METRICS } from './atlas-metrics';
import type { RooAtlasMetrics } from './bake';

export interface RooAtlasStyle {
  /** Fixed, font-wide cap-band height in output pixels. */
  size: number;
  palette?: 'bonus' | 'counter';
  tracking?: number;
  align?: CanvasTextAlign;
  maxWidth?: number;
  alpha?: number;
}
type Palette = 'bonus' | 'counter';
const images: Partial<Record<Palette,HTMLImageElement>>={};
let loading:Promise<void>|null=null;

export function loadRooAtlases():Promise<void> {
  if(!loading) loading=Promise.all((['bonus','counter'] as const).map(palette=>new Promise<void>(resolve=>{
    const image=new Image();
    const url=rooAtlasUrl(palette);
    trackPresentationImage(image,url);
    image.onload=()=>{images[palette]=image;resolve();};
    image.onerror=()=>resolve(); // Existing Roo/Canvas rendering remains the fallback.
    image.src=url;
  }))).then(()=>undefined);
  return loading;
}

export function layoutRooAtlas(metrics:RooAtlasMetrics,raw:string,tracking=0) {
  const text=raw.toUpperCase();
  const glyphs:Array<{char:string;x:number;y:number;sx:number;sy:number}>=[];
  const optical=metrics.layouts?.[text];
  if(optical){
    for(const [i,entry]of optical.glyphs.entries()){
      const g=metrics.glyphs[entry.char];if(!g)return null;
      const sx=entry.width/(g.inkRight-g.inkLeft),sy=entry.height/((g.inkBottom??1)-(g.inkTop??0));
      glyphs.push({char:entry.char,x:entry.x+i*tracking-g.inkLeft*sx,y:entry.y-(g.inkTop??0)*sy,sx,sy});
    }
    const width=optical.width+Math.max(0,glyphs.length-1)*tracking;return{glyphs,min:0,max:width,width};
  }
  let pen=0,min=Infinity,max=-Infinity;
  for(let i=0;i<text.length;i++){
    const glyph=metrics.glyphs[text[i]];
    if(!glyph)return null; // Do not quietly turn unsupported symbols into question marks.
    if(glyph.width){glyphs.push({char:text[i],x:pen,y:0,sx:1,sy:1});min=Math.min(min,pen+glyph.inkLeft);max=Math.max(max,pen+glyph.inkRight);}
    pen+=glyph.advance+(metrics.kern[text.slice(i,i+2)]??0);
    if(i<text.length-1)pen+=tracking;
  }
  if(!Number.isFinite(min))min=max=0;
  return {glyphs,min,max,width:max-min};
}

export function rooAtlasUrl(palette:Palette){return `${import.meta.env.BASE_URL}fonts/roo-${palette}-v${ROO_ATLAS_METRICS[palette].version}.png`;}

export function rooAtlasGlyphRect(metrics:RooAtlasMetrics,entry:{char:string;x:number;y:number;sx:number;sy:number}){
  const g=metrics.glyphs[entry.char];
  return{x:entry.x+g.left*entry.sx,y:entry.y+g.top*entry.sy,width:g.width/metrics.capPixels*entry.sx,height:g.height/metrics.capPixels*entry.sy};
}

/** Uses the existing Canvas2D/CRT pass: no new WebGL context, mesh, or per-frame bake. */
export class RooAtlasPainter {
  constructor(){void loadRooAtlases();}
  get ready(){return Boolean(images.bonus&&images.counter);}

  draw(ctx:CanvasRenderingContext2D,text:string,x:number,y:number,style:RooAtlasStyle):boolean {
    const palette=style.palette??'counter',image=images[palette],metrics=ROO_ATLAS_METRICS[palette];
    if(!image||!Number.isFinite(style.size)||style.size<=0)return false;
    const layout=layoutRooAtlas(metrics,text,(style.tracking??style.size*.012)/style.size);
    if(!layout)return false;
    const size=Math.min(style.size,style.maxWidth&&layout.width>0?style.maxWidth/layout.width:style.size);
    if(size<=0)return true;
    let left=x-layout.min*size;
    if(style.align==='center')left-=layout.width*size/2;
    else if(style.align==='right'||style.align==='end')left-=layout.width*size;
    ctx.save();ctx.globalAlpha=Math.min(1,Math.max(0,style.alpha??1));ctx.shadowColor='transparent';
    ctx.imageSmoothingEnabled=true;ctx.imageSmoothingQuality='high';
    for(const entry of layout.glyphs){
      const glyph=metrics.glyphs[entry.char];
      const rect=rooAtlasGlyphRect(metrics,entry);
      ctx.drawImage(image,glyph.x,glyph.y,glyph.width,glyph.height,
        left+rect.x*size,y-size/2+rect.y*size,rect.width*size,rect.height*size);
    }
    ctx.restore();return true;
  }
}
