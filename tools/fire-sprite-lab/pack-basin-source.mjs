// Pack a fixed orthographic projection of an independent broad campfire source.
// Only constant transparent padding is cropped. There is no resampling or warp.
import {readFile,writeFile,mkdir} from 'node:fs/promises';
import {resolve,dirname} from 'node:path';
import {fileURLToPath} from 'node:url';
import {createHash} from 'node:crypto';
const sharp=(await import(process.env.SHARP_MODULE||'sharp')).default;
const root=resolve(dirname(fileURLToPath(import.meta.url)),'../..');
const input=resolve(root,'art/fire-sprites/basin-source'),output=resolve(root,'public/fire-sprites/v5');
const hash=b=>createHash('sha256').update(b).digest('hex');
const start=0,count=200;
const source=JSON.parse(await readFile(resolve(input,'provenance.json')));
const frames=[],raws=[],thumbs=[];let left=512,top=512,right=0,bottom=0;
for(let i=0;i<200;i++){
 const file=`art/fire-sprites/basin-source/frames/${String(i).padStart(3,'0')}.png`,bytes=await readFile(resolve(root,file));
 if(hash(bytes)!==source.frames[i].pngSha256)throw Error('Source render changed: '+i);
 const {data,info}=await sharp(bytes).ensureAlpha().raw().toBuffer({resolveWithObject:true});
 if(info.width!==512||info.height!==512)throw Error('Expected native 512×512 projection');
 for(let y=0;y<512;y++)for(let x=0;x<512;x++)if(data[(y*512+x)*4+3]>0){left=Math.min(left,x);right=Math.max(right,x);top=Math.min(top,y);bottom=Math.max(bottom,y);}
 raws.push(data);frames.push({file,sha256:hash(bytes)});
 // Reduced images are used only for the numeric motion audit, never as assets.
 const thumb=await sharp(bytes).extractChannel(3).resize(64,64).raw().toBuffer();thumbs.push(thumb);
}
left=Math.max(0,left-8);top=Math.max(0,top-8);right=Math.min(511,right+8);bottom=Math.min(511,bottom+8);
const width=right-left+1,height=bottom-top+1,crop={left,top,width,height};
const delta=(a,b)=>{let d=0;for(let k=0;k<a.length;k++)d+=Math.abs(a[k]-b[k]);return d/a.length/255;};
const consecutive=thumbs.slice(1).map((a,i)=>delta(a,thumbs[i])),ordered=[...consecutive].sort((a,b)=>a-b);
const audit={sourceFrames:200,crop,consecutive:{min:ordered[0],median:ordered[99],p95:ordered[189],max:ordered.at(-1)},fullSequenceJoin:delta(thumbs[0],thumbs[199])};
const anchor=[(281.6-left)/width,1-(400-top)/height];
const pages=[],selected=frames.slice(start,start+count).map(frame=>({...frame,anchor}));
if(selected.length!==count||count>256)throw Error('Invalid source interval');
await mkdir(resolve(output,'basin'),{recursive:true});
for(let first=0;first<count;first+=64){
 const pageCount=Math.min(64,count-first),columns=8,rows=Math.ceil(pageCount/columns),composite=[];
 for(let i=0;i<pageCount;i++){
  const bytes=await sharp(raws[start+first+i],{raw:{width:512,height:512,channels:4}}).extract(crop).png().toBuffer();
  composite.push({input:bytes,left:(i%columns)*width,top:Math.floor(i/columns)*height});
 }
 const png=await sharp({create:{width:columns*width,height:rows*height,channels:4,background:{r:0,g:0,b:0,alpha:0}}}).composite(composite).png().toBuffer();
 const bytes=await sharp(png).webp({lossless:true,effort:6}).toBuffer();
 const before=await sharp(png).ensureAlpha().raw().toBuffer(),after=await sharp(bytes).ensureAlpha().raw().toBuffer();
 for(let k=0;k<before.length;k+=4)if(before[k+3]!==after[k+3]||(before[k+3]&&[0,1,2].some(c=>before[k+c]!==after[k+c])))throw Error('Packing changed visible pixels');
 const file=`basin/atlas-${pages.length}.webp`;await writeFile(resolve(output,file),bytes);
 pages.push({file,columns,rows,first,count:pageCount,width:columns*width,height:rows*height});
}
const manifest=JSON.parse(await readFile(resolve(output,'cycles.json')));
const cycle={id:'basin',motionId:'JangaFX-SmallCampfire',width,height,fps:30,frameCount:count,paint:manifest.narrow.paint,pages,frames:selected,
 source:{author:source.author,license:source.license,page:source.sourcePage,download:source.download,archiveSha256:source.archiveSha256,firstFrame:start,lastFrame:start+count-1,crop,projection:source.projection}};
manifest.basin=cycle;
await writeFile(resolve(output,'basin/cycle.json'),JSON.stringify(cycle,null,2)+'\n');
await writeFile(resolve(output,'cycles.json'),JSON.stringify(manifest,null,2)+'\n');
const provenance=JSON.parse(await readFile(resolve(output,'provenance.json')));
provenance.uniqueMotionSequences=3;provenance.uniqueSourceFrames=128+count;
provenance.sources=provenance.sources.filter(s=>s.source!==cycle.motionId);
provenance.sources.push({source:cycle.motionId,...cycle.source,frameCount:count,nativeFrame:[width,height]});
await writeFile(resolve(output,'provenance.json'),JSON.stringify(provenance,null,2)+'\n');
await sharp(raws[start],{raw:{width:512,height:512,channels:4}}).extract(crop).png().toFile(resolve(output,'basin/key.png'));
audit.selected={first:start,last:start+count-1,count,join:delta(thumbs[start],thumbs[start+count-1]),nativeFrame:[width,height],anchor,exactVisiblePixels:true,worldAspect:'width / height, with one uniform scale'};
await writeFile(resolve(root,'docs/fire-sprite-lab/basin-source/motion-audit.json'),JSON.stringify(audit,null,2)+'\n');
console.log(JSON.stringify(audit,null,2));
