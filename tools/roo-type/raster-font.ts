import type { RooAtlasMetrics } from '../../src/roo-type/bake';
import {modelCutout} from './raster-material';
import {goldToBonus} from './artwork-palette';
type Palette='bonus'|'counter';
interface LightingSource {model:string;prompt:string;generatedSource:string;modelSha256:string}
interface Master {model?:string;input:string;prompt:string;generatorPrompt?:string;style:string;generatedSource?:string;modelSha256?:string;status:string;lightSources?:Record<'left'|'right',LightingSource>}
const base='/art/roo-reference-match/';
const load=(url:string)=>new Promise<HTMLImageElement>((resolve,reject)=>{const image=new Image();image.onload=()=>resolve(image);image.onerror=()=>reject(new Error(url));image.src=url;});
export async function bakeRasterFont(partial=false){
 const [manifest,previous]=await Promise.all([
  fetch(base+'raster-v6/manifest.json').then(r=>r.json()) as Promise<{version:number;glyphs:Record<string,Master>}>,
  fetch('/fonts/roo-counter-v5.json').then(r=>r.json()) as Promise<RooAtlasMetrics>,
 ]);
 const missing=Object.entries(manifest.glyphs).filter(([,g])=>!g.model).map(([c])=>c);if(missing.length&&!partial)throw new Error('Model glyphs missing: '+missing.join(''));
 const missingLighting=Object.entries(manifest.glyphs).filter(([,g])=>!g.lightSources?.left||!g.lightSources?.right).map(([c])=>c);
 if(missingLighting.length&&!partial)throw new Error('Image-model glisten frames missing: '+missingLighting.join(''));
 const capPixels=512,padding=6;
 const rendered:Record<string,{frames:Record<Palette,HTMLCanvasElement[]>;metrics:RooAtlasMetrics['glyphs'][string];lightingReady:boolean}>={};
 const provenance:Record<string,unknown>={};
 for(const [char,master]of Object.entries(manifest.glyphs)){
  if(!master.model)continue;
  const image=await load(base+master.model),cut=modelCutout(image),old=previous.glyphs[char],bounds=cut.bounds;
  const inkHeight=(old.inkBottom!-old.inkTop!)*capPixels,scale=inkHeight/bounds[3],inkWidth=bounds[2]*scale;
  const width=Math.ceil(inkWidth)+padding*2,height=Math.ceil(inkHeight)+padding*2;
  const place=(art:ReturnType<typeof modelCutout>)=>{
   const c=document.createElement('canvas');c.width=width;c.height=height;const ctx=c.getContext('2d')!;ctx.imageSmoothingEnabled=true;ctx.imageSmoothingQuality='high';
   ctx.drawImage(art.canvas,...art.bounds,padding,padding,inkWidth,inkHeight);return c;
  };
  const neutral=place(cut),frames:Record<Palette,HTMLCanvasElement[]>={counter:[neutral],bonus:[goldToBonus(neutral)]};
  const lightBounds:Record<string,readonly number[]>={};
  for(const side of ['left','right'] as const){
   const light=master.lightSources?.[side];let frame=neutral;
   if(light){
    const lightImage=await load(base+light.model),art=modelCutout(lightImage),variant=place(art);
    // The approved bitmap supplies the fixed, complete shape. Paint the model's
    // glisten edit over it, retaining original edge pixels wherever an edit's
    // contour drifts slightly. No font-vector crop or synthetic shading.
    frame=document.createElement('canvas');frame.width=width;frame.height=height;const ctx=frame.getContext('2d')!;
    ctx.drawImage(neutral,0,0);ctx.globalCompositeOperation='source-atop';ctx.drawImage(variant,0,0);
    const pixels=ctx.getImageData(0,0,width,height),shape=neutral.getContext('2d')!.getImageData(0,0,width,height).data;
    for(let p=3;p<pixels.data.length;p+=4)pixels.data[p]=shape[p];ctx.putImageData(pixels,0,0);
    lightBounds[side]=art.bounds;variant.width=variant.height=1;art.canvas.width=art.canvas.height=1;lightImage.src='';
   }
   frames.counter.push(frame);frames.bonus.push(goldToBonus(frame));
  }
  const metrics={x:0,y:0,width,height,left:old.inkLeft-padding/capPixels,top:old.inkTop!-padding/capPixels,
   advance:old.advance+inkWidth/capPixels-(old.inkRight-old.inkLeft),inkLeft:old.inkLeft,inkRight:old.inkLeft+inkWidth/capPixels,inkTop:old.inkTop,inkBottom:old.inkBottom};
  rendered[char]={frames,metrics,lightingReady:!missingLighting.includes(char)};
  provenance[char]={...master,prompt:master.generatorPrompt??master.prompt,sourceBounds:bounds,lightBounds,background:cut.background,components:cut.components,sourceOpaquePixels:cut.opaque,lightingSource:'image-model edits of the approved neutral'};
  cut.canvas.width=cut.canvas.height=1;image.src='';
 }
 const atlasWidth=2048,gutter=4;let x=gutter,y=gutter,row=0;
 const glyphs:RooAtlasMetrics['glyphs']={};
 for(const [char,old]of Object.entries(previous.glyphs)){
  if(!old.width){glyphs[char]={...old};continue;}const r=rendered[char];if(!r)continue;
  const g={...r.metrics};if(x+g.width+gutter>atlasWidth){x=gutter;y+=row+gutter;row=0;}
  g.x=x;g.y=y;glyphs[char]=g;x+=g.width+gutter;row=Math.max(row,g.height);
 }
 const atlases:Record<string,{frames:HTMLCanvasElement[];metrics:RooAtlasMetrics}>={};
 for(const palette of ['bonus','counter'] as const){
  const frames=[0,1,2].map(frame=>{const c=document.createElement('canvas');c.width=atlasWidth;c.height=y+row+gutter;const ctx=c.getContext('2d')!;for(const [char,r]of Object.entries(rendered)){const g=glyphs[char];ctx.drawImage(r.frames[palette][frame],g.x,g.y);}return c;});
  const metrics:RooAtlasMetrics={version:6,palette,lightFrames:3,contourSource:'model-artwork',capPixels,width:atlasWidth,height:frames[0].height,fontSha256:previous.fontSha256,capBand:previous.capBand,glyphs,kern:previous.kern,layouts:previous.layouts};
  atlases[palette]={frames,metrics};
 }
 return{version:6,missing,missingLighting,provenance,rendered,atlases};
}
