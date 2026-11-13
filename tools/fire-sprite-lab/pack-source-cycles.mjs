// Preserve the supplied CC0 flipbooks at their native resolution. Imagegen
// supplies one shared painting; its palette is sampled once for all frames.
import {readFile,writeFile,mkdir,copyFile} from 'node:fs/promises';
import {resolve,dirname} from 'node:path';
import {fileURLToPath} from 'node:url';
import {createHash} from 'node:crypto';
const sharp=(await import(process.env.SHARP_MODULE||'sharp')).default;
const root=resolve(dirname(fileURLToPath(import.meta.url)),'../..');
const output=resolve(root,'public/fire-sprites/v5');
const sourcePage='https://unity.com/blog/engine-platform/free-vfx-image-sequences-flipbooks';
const license='https://creativecommons.org/publicdomain/zero/1.0/';
const hash=b=>createHash('sha256').update(b).digest('hex');
const painting='art/fire-sprites/v5/clean-pilot/120.png';
const paintBytes=await readFile(resolve(root,painting));
const {data:paintPixels,info:paintSize}=await sharp(paintBytes).ensureAlpha().raw().toBuffer({resolveWithObject:true});
const points=[[550,430],[570,500],[590,650],[570,800],[600,930],[600,1020]];
const paint={file:'paint-master.png',sha256:hash(paintBytes),swatches:points.map(([x,y])=>Array.from(paintPixels.subarray((y*paintSize.width+x)*4,(y*paintSize.width+x)*4+3)))};
await mkdir(output,{recursive:true});await copyFile(resolve(root,painting),resolve(output,paint.file));
const motions={},checks=[];
for(const name of ['Flame02','Flame03']){
  const directory=`art/fire-sprites/v5/source/${name}`;
  const png=await readFile(resolve(root,directory,'atlas.png'));
  const tga=await readFile(resolve(root,directory,`${name}_16x4.tga`));
  const {data:rgba,info}=await sharp(png).ensureAlpha().raw().toBuffer({resolveWithObject:true});
  const width=info.width/16,height=info.height/4;
  if(tga[2]!==2||tga[16]!==32||tga.readUInt16LE(12)!==info.width||tga.readUInt16LE(14)!==info.height)throw Error('Unexpected native TGA format');
  // The PNG conversion must retain the complete native TGA, including alpha.
  for(let y=0;y<info.height;y++)for(let x=0;x<info.width;x++){
    const sourceY=(tga[17]&32)?y:info.height-1-y,k=(y*info.width+x)*4,s=18+tga[0]+(sourceY*info.width+x)*4;
    if(rgba[k]!==tga[s+2]||rgba[k+1]!==tga[s+1]||rgba[k+2]!==tga[s]||rgba[k+3]!==tga[s+3])throw Error('TGA conversion changed pixels: '+name);
  }
  const frames=[];let footX=0,footY=0,total=0;
  for(let i=0;i<64;i++){
    const raw=Buffer.alloc(width*height*4),left=(i%16)*width,top=Math.floor(i/16)*height;
    for(let y=0;y<height;y++)rgba.copy(raw,y*width*4,((top+y)*info.width+left)*4,((top+y)*info.width+left+width)*4);
    let bottom=height-1;
    for(;bottom>=0;bottom--){let count=0;for(let x=0;x<width;x++){const k=(bottom*width+x)*4;if(raw[k+3]>128&&raw[k]>100)count++;}if(count>width*.05)break;}
    for(let y=Math.max(0,bottom-3);y<=bottom;y++)for(let x=0;x<width;x++){const k=(y*width+x)*4;if(raw[k+3]>128&&raw[k]>100){footX+=x+.5;footY+=bottom+.5;total++;}}
    const file=`${directory}/${String(i).padStart(2,'0')}.png`;
    const bytes=await sharp(raw,{raw:{width,height,channels:4}}).png({compressionLevel:9}).toBuffer();
    await writeFile(resolve(root,file),bytes);frames.push({file,sha256:hash(bytes)});
  }
  const anchor=[footX/total/width,1-footY/total/height];
  const file=`${name.toLowerCase()}/atlas.webp`;await mkdir(dirname(resolve(output,file)),{recursive:true});
  const webp=await sharp(png).webp({lossless:true,effort:6}).toBuffer();
  const restored=await sharp(webp).ensureAlpha().raw().toBuffer();
  for(let k=0;k<rgba.length;k+=4)if(rgba[k+3]!==restored[k+3]||(rgba[k+3]&&[0,1,2].some(c=>rgba[k+c]!==restored[k+c])))throw Error('Lossless packing changed visible pixels: '+name);
  await writeFile(resolve(output,file),webp);
  const source={author:'Thomas Iché / Unity Technologies, Unity Labs Paris',license:'CC0-1.0',licenseUrl:license,page:sourcePage,download:`https://unity3d.com/files/labs/downloads/vfx/assets01/${name}/${name}-flipbooks.zip`,tgaSha256:hash(tga)};
  motions[name]={motionId:name,source,width,height,fps:48,frameCount:64,paint,pages:[{file,columns:16,rows:4,first:0,count:64,width:info.width,height:info.height}],frames:frames.map(f=>({...f,anchor}))};
  checks.push({source:name,tgaSha256:hash(tga),atlasPngSha256:hash(png),nativeAtlas:[info.width,info.height],nativeFrame:[width,height],frameCount:64,anchor,exactTgaPixels:true,exactRuntimeAlphaAndVisibleRGB:true,runtimeBytes:webp.length});
}
const cycles={narrow:{id:'narrow',...motions.Flame03},medium:{id:'medium',...motions.Flame02},broad:{id:'broad',...motions.Flame02}};
for(const [family,data]of Object.entries(cycles)){
  await mkdir(resolve(output,family),{recursive:true});await copyFile(resolve(root,data.frames[0].file),resolve(output,family,'key.png'));
}
await writeFile(resolve(output,'cycles.json'),JSON.stringify(cycles,null,2)+'\n');
await copyFile(resolve(root,'art/fire-sprites/v5/source/NOTICE.txt'),resolve(output,'NOTICE.txt'));
await writeFile(resolve(output,'provenance.json'),JSON.stringify({version:5,uniqueMotionSequences:2,uniqueSourceFrames:128,sourcePage,license,paint:{...paint,method:'One built-in image_gen painting, sampled once for the fixed palette shared by every source frame',original:painting,prompt:'docs/fire-sprite-lab/v5/prompts/clean-120.txt',samplePixels:points},sources:checks},null,2)+'\n');
await writeFile(resolve(root,'docs/fire-sprite-lab/v5/native-audit.json'),JSON.stringify({status:'Pixel preservation only — browser motion review required',painting:{file:painting,width:paintSize.width,height:paintSize.height,sha256:paint.sha256,samplePixels:points},checks},null,2)+'\n');
console.log(JSON.stringify({uniqueFrames:128,paint:painting,checks},null,2));
