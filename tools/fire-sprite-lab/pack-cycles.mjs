// Lossless native-resolution packing. No frame trimming, stretching or painting.
import {readFile,writeFile,mkdir} from 'node:fs/promises';
import {resolve,dirname,basename} from 'node:path';
import {fileURLToPath} from 'node:url';
import {createHash} from 'node:crypto';
const sharp=(await import(process.env.SHARP_MODULE||'sharp')).default;
const root=resolve(dirname(fileURLToPath(import.meta.url)),'../..');
const version=process.argv[2]||'v3';
if(!['v2','v3'].includes(version))throw Error('Expected v2 or v3');
const output=resolve(root,'public/fire-sprites',version);
const sequence=version==='v3'?JSON.parse(await readFile(resolve(root,'docs/fire-sprite-lab/v3/sequence.json'),'utf8')):null;
const cycles={};
for(const family of ['narrow','medium','broad']){
  const path=resolve(root,'docs/fire-sprite-lab',version,family+'-cycle.json');
  const input=sequence?{fps:sequence.fps,frames:sequence.families[family].map(f=>({file:'../../../'+f.file}))}:JSON.parse(await readFile(path,'utf8'));
  await mkdir(resolve(output,family),{recursive:true});
  if(sequence)await writeFile(path,JSON.stringify(input,null,2)+'\n');
  const frames=[];
  let width,height;
  for(const entry of input.frames){
    const file=resolve(dirname(path),entry.file),png=await readFile(file);
    const meta=await sharp(png).metadata();
    width??=meta.width;height??=meta.height;
    if(!meta.hasAlpha||meta.width!==width||meta.height!==height)throw Error('Inconsistent frame canvas: '+file);
    const rgba=await sharp(png).ensureAlpha().raw().toBuffer();
    let bottom=height-1;
    // Ignore barely visible alpha noise; find the solid connected foot.
    for(;bottom>=0;bottom--){
      let count=0;
      for(let x=0;x<width;x++)if(rgba[(bottom*width+x)*4+3]>=128)count++;
      if(count>width*.04)break;
    }
    let sumX=0,count=0;
    for(let y=Math.max(0,bottom-Math.round(height*.065));y<=bottom;y++)
      for(let x=0;x<width;x++)if(rgba[(y*width+x)*4+3]>=128){sumX+=x;count++;}
    if(!count)throw Error('No solid foot: '+file);
    frames.push({file:version==='v3'?entry.file.replace('../../../',''):family+'/'+basename(file),png,rgba,anchor:[(sumX/count+.5)/width,1-(bottom+.5)/height],
      sha256:createHash('sha256').update(png).digest('hex')});
  }
  if(frames.length>64)throw Error('Shader supports at most 64 source drawings per family.');
  const columns=Math.floor(4096/width),maxRows=Math.floor(4096/height),capacity=columns*maxRows,pages=[];
  for(let first=0;first<frames.length;first+=capacity){
    const subset=frames.slice(first,first+capacity),rows=Math.ceil(subset.length/columns);
    const file=family+'/atlas-'+pages.length+(version==='v3'?'.webp':'.png');
    const packed=Buffer.alloc(width*columns*height*rows*4);
    subset.forEach((f,i)=>{
      const left=(i%columns)*width,top=Math.floor(i/columns)*height;
      for(let y=0;y<height;y++)f.rgba.copy(packed,((top+y)*width*columns+left)*4,y*width*4,(y+1)*width*4);
    });
    const image=sharp(packed,{raw:{width:width*columns,height:height*rows,channels:4}});
    const atlas=await (version==='v3'?image.webp({lossless:true,effort:6}):image.png({compressionLevel:9})).toBuffer();
    // Verify exact alpha and every visible RGB pixel against the native original.
    // WebP may normalise hidden RGB at alpha zero; original PNGs remain in art.
    for(let i=0;i<subset.length;i++){
      const decoded=await sharp(atlas).extract({left:(i%columns)*width,top:Math.floor(i/columns)*height,width,height}).raw().toBuffer();
      const original=subset[i].rgba;
      for(let k=0;k<decoded.length;k+=4){
        if(decoded[k+3]!==original[k+3]||(original[k+3]!==0&&(decoded[k]!==original[k]||decoded[k+1]!==original[k+1]||decoded[k+2]!==original[k+2])))throw Error('Packing changed visible pixels: '+subset[i].file);
      }
    }
    await writeFile(resolve(output,file),atlas);
    pages.push({file,columns,rows,first,count:subset.length,width:width*columns,height:height*rows});
  }
  if(pages.length>8)throw Error('Expected at most eight native texture pages.');
  cycles[family]={id:family,width,height,fps:input.fps,frameCount:frames.length,pages,
    frames:frames.map(({file,anchor,sha256})=>({file,anchor,sha256}))};
}
await writeFile(resolve(output,'cycles.json'),JSON.stringify(cycles,null,2)+'\n');
console.log(JSON.stringify(Object.fromEntries(Object.entries(cycles).map(([k,c])=>[k,{frames:c.frameCount,canvas:[c.width,c.height],pages:c.pages.map(p=>[p.width,p.height])}]))));
