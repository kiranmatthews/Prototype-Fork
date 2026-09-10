import type { RooAtlasMetrics } from '../../src/roo-type/bake';
import type { RooVectorSource } from '../../src/roo-type/geometry';
import { RooColorProjector, type ColorLayer } from './color-projection';

type Palette='bonus'|'counter';
interface Candidate {glyph:string;palette:Palette;file:string;prompt:string;colorBounds:[number,number,number,number];background:string;status:string}
interface Reference {native:string;ink:[number,number,number,number];box?:[number,number,number,number];origin?:[number,number]}
const base='/art/roo-reference-match/';
const load=(src:string)=>new Promise<HTMLImageElement>((resolve,reject)=>{const image=new Image();image.onload=()=>resolve(image);image.onerror=()=>reject(new Error(src));image.src=src;});

export async function bakeModelFont(allowPartial=false){
  const [source,report,alphabet,numbers]=await Promise.all([
    fetch('/fonts/roo-bevel-source-v1.json').then(r=>r.json()) as Promise<RooVectorSource>,
    fetch(base+'review.json').then(r=>r.json()),
    fetch(base+'analysis/alphabet-references.json').then(r=>r.json()) as Promise<Record<string,Reference>>,
    fetch(base+'analysis/number-references.json').then(r=>r.json()) as Promise<Record<string,Reference>>,
  ]);
  const candidates:Record<string,Candidate>={};
  for(const c of report.candidates as Candidate[])if(c.status!=='rejected'&&['magenta','transparent'].includes(c.background))candidates[c.glyph]=c;
  for(const [char,file]of Object.entries(report.provisionalWord as Record<string,string>))candidates[char]=report.candidates.find((c:Candidate)=>c.file===file);
  const missing=Object.entries(source.glyphs).filter(([c,g])=>g.commands.length&&!candidates[c]).map(([c])=>c);
  if(missing.length&&!allowPartial)throw new Error(`Image-model passes missing: ${missing.join(' ')}`);
  const projector=new RooColorProjector(),capPixels=384;
  const rendered:Record<Palette,Record<string,ReturnType<RooColorProjector['render']>>>={bonus:{},counter:{}};
  const provenance:Record<string,{model:string;prompt:string;reference?:string}>={};
  const titleOrigins:Record<string,number>={B:542,O:681,N:810,U:944,S:1070};
  for(const [char,glyph]of Object.entries(source.glyphs)){
    if(!glyph.commands.length||!candidates[char])continue;
    const c=candidates[char],image=await load(base+c.file);
    let ref:ColorLayer|undefined,refFile:string|undefined;
    if(char in titleOrigins){
      const m=report.measuredTitleGlyphs[char];refFile=`analysis/${char}-reference-native.png`;
      ref={image:await load(base+refFile),colorBounds:[m.x-titleOrigins[char],m.y-55,m.width,m.height]};
    }else{
      const r=alphabet[char]??numbers[char];if(r){refFile=r.native;ref={image:await load(base+r.native),colorBounds:r.ink};}
    }
    // Preserve Roo's cap band. The alphabet's measured width supplies optical
    // fitting; standalone counters share the reference's 106% width treatment.
    const sample=alphabet[char]??numbers[char],sampleCap=alphabet[char]?59:107;
    const widthScale=sample?sample.ink[2]/((glyph.bounds[2]-glyph.bounds[0])*sampleCap):1.06;
    const vertical={scale:1,offset:0};
    if(sample){
      const origin=sample.box??sample.origin!;
      const capTop=alphabet[char]?(char<='M'?482:568):760;
      const inkTop=(origin[1]+sample.ink[1]-capTop)/sampleCap;
      vertical.scale=sample.ink[3]/sampleCap/(glyph.bounds[3]-glyph.bounds[1]);
      vertical.offset=1-inkTop-glyph.bounds[3]*vertical.scale;
    }
    for(const palette of ['bonus','counter'] as const){
      rendered[palette][char]=projector.render(glyph,{image,colorBounds:c.colorBounds},capPixels,widthScale,true,ref,{source:c.palette,target:palette},vertical);
    }
    provenance[char]={model:c.file,prompt:c.prompt,reference:refFile};
  }
  projector.dispose();
  const atlases:Record<string,{canvas:HTMLCanvasElement;metrics:RooAtlasMetrics}>= {};
  for(const palette of ['bonus','counter'] as const){
    const glyphs:RooAtlasMetrics['glyphs']={},items:Array<{canvas:HTMLCanvasElement;x:number;y:number}>=[];
    const atlasWidth=2048,gutter=4;let x=gutter,y=gutter,row=0;
    for(const [char,glyph]of Object.entries(source.glyphs)){
      if(!glyph.commands.length){glyphs[char]={x:0,y:0,width:0,height:0,left:0,top:0,advance:glyph.advance,inkLeft:0,inkRight:0};continue;}
      const r=rendered[palette][char];if(!r)continue;
      if(x+r.canvas.width+gutter>atlasWidth){x=gutter;y+=row+gutter;row=0;}
      glyphs[char]={x,y,width:r.canvas.width,height:r.canvas.height,left:r.left,top:r.top,advance:r.advance,inkLeft:glyph.bounds[0]*r.widthScale,inkRight:glyph.bounds[2]*r.widthScale,inkTop:r.inkTop,inkBottom:r.inkBottom};
      items.push({canvas:r.canvas,x,y});x+=r.canvas.width+gutter;row=Math.max(row,r.canvas.height);
    }
    const canvas=document.createElement('canvas');canvas.width=atlasWidth;canvas.height=y+row+gutter;
    const ctx=canvas.getContext('2d')!;for(const item of items)ctx.drawImage(item.canvas,item.x,item.y);
    const metrics:RooAtlasMetrics={version:2,palette,capPixels,width:canvas.width,height:canvas.height,fontSha256:source.sha256,capBand:source.capBand,glyphs,kern:{...source.kern},layouts:{BONUS:{width:626/165,glyphs:[...'BONUS'].map(char=>{const r=report.measuredTitleGlyphs[char];return{char,x:(r.x-546)/165,y:(r.y-60)/165,width:r.width/165,height:r.height/165};})}}};
    for(const n of '0123456789')metrics.kern[n+'/']=-.035;
    metrics.kern['23']=-.016;
    atlases[palette]={canvas,metrics};
  }
  return{atlases,rendered,source,provenance,missing,measuredTitleGlyphs:report.measuredTitleGlyphs};
}
