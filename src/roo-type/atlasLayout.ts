import type { RooAtlasMetrics } from './bake';

// Pure layout shared by DOM/Canvas menus and the loading worker.
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

export function rooAtlasGlyphRect(metrics:RooAtlasMetrics,entry:{char:string;x:number;y:number;sx:number;sy:number}){
  const g=metrics.glyphs[entry.char];
  return{x:entry.x+g.left*entry.sx,y:entry.y+g.top*entry.sy,width:g.width/metrics.capPixels*entry.sx,height:g.height/metrics.capPixels*entry.sy};
}
