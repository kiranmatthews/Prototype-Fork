// Analysis-only comparison. Model RGB files stay unmodified; a Roo path clips
// their display here so painted checkerboards cannot obscure material review.
import { RooColorProjector } from './color-projection';
const asset='/art/roo-reference-match/';
const [source,inputs,report]=await Promise.all([
 fetch('/fonts/roo-bevel-source-v1.json').then(r=>r.json()),
 fetch(asset+'inputs/manifest.json').then(r=>r.json()),
 fetch(asset+'review.json').then(r=>r.json()),
]);
const load=(src:string)=>new Promise<HTMLImageElement>((resolve,reject)=>{const image=new Image();image.onload=()=>resolve(image);image.onerror=reject;image.src=src;});
const oldMetrics=await fetch('/fonts/roo-counter-v1.json').then(r=>r.json());
const oldBonus=await load('/fonts/roo-bonus-v1.png'),oldCounter=await load('/fonts/roo-counter-v1.png');
let zoom=1,raw=false;
const projector=new RooColorProjector();
const projectionRecords:Array<{file:string;canvas:HTMLCanvasElement;ink:{x:number;y:number;width:number;height:number}}>=[];
const canvases:Array<{canvas:HTMLCanvasElement;draw:(ctx:CanvasRenderingContext2D,width:number,height:number)=>void}>=[];
function cell(row:HTMLElement,title:string,note:string,draw:(ctx:CanvasRenderingContext2D,w:number,h:number)=>void,kind=''){
 const div=document.createElement('div');div.className=`cell ${kind}`;div.innerHTML=`<h2>${title}</h2><canvas></canvas><small>${note}</small>`;row.append(div);
 canvases.push({canvas:div.querySelector('canvas')!,draw});
}
function pathFor(char:string){
 const path=new Path2D();
 for(const p of source.glyphs[char].commands){if(p.type==='M')path.moveTo(p.x,p.y);else if(p.type==='L')path.lineTo(p.x,p.y);else if(p.type==='Q')path.quadraticCurveTo(p.x1,p.y1,p.x,p.y);else if(p.type==='C')path.bezierCurveTo(p.x1,p.y1,p.x2,p.y2,p.x,p.y);else if(p.type==='Z')path.closePath();}
 return path;
}
if(report.provisionalWord){
 const row=document.createElement('div');row.className='row';row.style.gridTemplateColumns='1fr 1fr';document.getElementById('rows')!.append(row);
 const reference=await load(asset+'analysis/BONUS-reference-native.png');
 cell(row,'Original BONUS reference','626 × 162 px colored word, with the original surround still visible.',(ctx,w,h)=>{const s=Math.min(zoom,(w-20)/reference.width);ctx.drawImage(reference,(w-reference.width*s)/2,(h-reference.height*s)/2,reference.width*s,reference.height*s);},'reference');
 const rendered:Record<string,ReturnType<RooColorProjector['render']>>={};
 const matched:Record<string,ReturnType<RooColorProjector['render']>>={};
 const refOrigins:Record<string,number>={B:542,O:681,N:810,U:944,S:1070};
 for(const [char,file]of Object.entries(report.provisionalWord)){
   const candidate=report.candidates.find((c:any)=>c.file===file),image=await load(asset+file);
   rendered[char]=projector.render(source.glyphs[char],{image,colorBounds:candidate.colorBounds},512,report.wordLayout.widthScale);
   projectionRecords.push({file:candidate.file,...rendered[char]});
   const refImage=await load(asset+`analysis/${char}-reference-native.png`),m=report.measuredTitleGlyphs[char];
   matched[char]=projector.render(source.glyphs[char],{image,colorBounds:candidate.colorBounds},512,report.wordLayout.widthScale,true,{image:refImage,colorBounds:[m.x-refOrigins[char],m.y-55,m.width,m.height]});
   projectionRecords.push({file:`reference-match-${candidate.file.split('/').pop()}`,...matched[char]});
 }
 cell(row,'Model-per-letter BONUS — unapproved','Each letter passed through the image model. Individual glyph sizes/positions measured from the reference.',(ctx,w,h)=>{
   const s=Math.min(zoom,(w-20)/626),left=(w-626*s)/2,top=(h-162*s)/2;
   for(const char of 'BONUS'){
     const p=rendered[char],r=report.measuredTitleGlyphs[char],sx=r.width*s/p.ink.width,sy=r.height*s/p.ink.height;
     ctx.drawImage(p.canvas,left+(r.x-546)*s-p.ink.x*sx,top+(r.y-60)*s-p.ink.y*sy,p.canvas.width*sx,p.canvas.height*sy);
   }
 });
 const matchRow=document.createElement('div');matchRow.className='row';matchRow.style.gridTemplateColumns='1fr 1fr';document.getElementById('rows')!.append(matchRow);
 cell(matchRow,'Original BONUS reference','Original pixels; same framing as the comparison above.',(ctx,w,h)=>{const s=Math.min(zoom,(w-20)/reference.width);ctx.drawImage(reference,(w-reference.width*s)/2,(h-reference.height*s)/2,reference.width*s,reference.height*s);},'reference');
 cell(matchRow,'Reference lighting + model detail — unapproved','Reference owns the visible light/color; each model pass supplies finer detail. Roo geometry supplies alpha.',(ctx,w,h)=>{
   const s=Math.min(zoom,(w-20)/626),left=(w-626*s)/2,top=(h-162*s)/2;
   for(const char of 'BONUS'){
     const p=matched[char],r=report.measuredTitleGlyphs[char],sx=r.width*s/p.ink.width,sy=r.height*s/p.ink.height;
     ctx.drawImage(p.canvas,left+(r.x-546)*s-p.ink.x*sx,top+(r.y-60)*s-p.ink.y*sy,p.canvas.width*sx,p.canvas.height*sy);
   }
 });
}
for(const [char,nativeH,referenceName]of [['B',162,'B-reference'],['0',93,'0-reference']]as const){
 const row=document.createElement('div');row.className='row';document.getElementById('rows')!.append(row);
 const reference=await load(asset+`analysis/${referenceName}-native.png`),glyph=source.glyphs[char],bounds=glyph.bounds;
 cell(row,'Supplied reference',`${char} · ${nativeH} px colored height · original pixels`,(ctx,w,h)=>{ctx.drawImage(reference,(w-reference.width*zoom)/2,(h-reference.height*zoom)/2,reference.width*zoom,reference.height*zoom);},'reference');
 cell(row,'Published v1 — rejected','Generic mesh treatment; retained as a failure baseline.',(ctx,w,h)=>{const g=oldMetrics.glyphs[char],cap=nativeH/(bounds[3]-bounds[1])*zoom;ctx.drawImage(char==='B'?oldBonus:oldCounter,g.x,g.y,g.width,g.height,(w-g.width/256*cap)/2,(h-g.height/256*cap)/2,g.width/256*cap,g.height/256*cap);},'bad');
 for(const candidate of report.candidates.filter((c:any)=>c.glyph===char).slice(-2)){
  const image=await load(asset+candidate.file);
  const projected=candidate.background==='magenta'
    ?projector.render(glyph,{image,colorBounds:candidate.colorBounds},512,report.opticalWidthScale??1):null;
  if(projected)projectionRecords.push({file:candidate.file,...projected});
  cell(row,`${candidate.file.split('/').pop()} — ${candidate.status}`,candidate.issues.join('; '),(ctx,w,h)=>{
    if(raw){const s=Math.min(w/image.width,h/image.height);ctx.drawImage(image,(w-image.width*s)/2,(h-image.height*s)/2,image.width*s,image.height*s);return;}
    const cap=nativeH/(bounds[3]-bounds[1])*zoom;
    if(projected){const pw=projected.canvas.width/512*cap,ph=projected.canvas.height/512*cap;ctx.drawImage(projected.canvas,(w-pw)/2,(h-ph)/2,pw,ph);return;}
    const aspect=report.opticalWidthScale??1;
    ctx.save();ctx.translate(w/2-(bounds[0]+bounds[2])/2*cap*aspect,h/2+(bounds[1]+bounds[3])/2*cap);ctx.scale(cap*aspect,-cap);ctx.clip(pathFor(char));
    const [cx,cy,cw,ch]=candidate.colorBounds;
    ctx.translate(bounds[0],bounds[3]);ctx.scale((bounds[2]-bounds[0])/cw,-(bounds[3]-bounds[1])/ch);
    ctx.drawImage(image,cx,cy,cw,ch,0,0,cw,ch);ctx.restore();
  },candidate.status==='rejected'?'bad':'');
 }
}
projector.dispose();
Object.assign(window,{rooReferenceReview:{report,projections:()=>projectionRecords.map(p=>({file:p.file,ink:p.ink,png:p.canvas.toDataURL('image/png')}))}});
function paint(){for(const{canvas,draw}of canvases){const w=canvas.clientWidth,h=zoom===1?235:430;canvas.style.height=`${h}px`;canvas.width=w*2;canvas.height=h*2;const ctx=canvas.getContext('2d')!;ctx.scale(2,2);ctx.imageSmoothingQuality='high';draw(ctx,w,h);}document.getElementById('status')!.textContent=`${raw?'Raw image output, including its actual background.':'Roo vector-clipped color-layer preview, with 106% optical width. Source RGB files remain unchanged.'}\nFont SHA: ${inputs.fontSha256}\n${report.acceptance}`;}
document.getElementById('native')!.onclick=()=>{zoom=1;paint();};document.getElementById('large')!.onclick=()=>{zoom=2;paint();};document.getElementById('raw')!.onclick=()=>{raw=!raw;paint();};new ResizeObserver(paint).observe(document.body);paint();
