// Lossless native-resolution packing. No frame trimming, stretching or painting.
import {readFile,writeFile} from 'node:fs/promises';
import {resolve,dirname,basename} from 'node:path';
import {fileURLToPath} from 'node:url';
import {createHash} from 'node:crypto';
const sharp=(await import(process.env.SHARP_MODULE||'sharp')).default;
const root=resolve(dirname(fileURLToPath(import.meta.url)),'../..');
const output=resolve(root,'public/fire-sprites/v2');
const cycles={};
for(const family of ['narrow','medium','broad']){
  const path=resolve(root,'docs/fire-sprite-lab/v2',family+'-cycle.json');
  const input=JSON.parse(await readFile(path,'utf8'));
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
    frames.push({file:family+'/'+basename(file),png,rgba,anchor:[(sumX/count+.5)/width,1-(bottom+.5)/height],
      sha256:createHash('sha256').update(png).digest('hex')});
  }
  if(frames.length>16)throw Error('Shader supports at most 16 source drawings per family.');
  const columns=Math.floor(4096/width),maxRows=Math.floor(4096/height),capacity=columns*maxRows,pages=[];
  for(let first=0;first<frames.length;first+=capacity){
    const subset=frames.slice(first,first+capacity),rows=Math.ceil(subset.length/columns);
    const file=family+'/atlas-'+pages.length+'.png';
    const packed=Buffer.alloc(width*columns*height*rows*4);
    subset.forEach((f,i)=>{
      const left=(i%columns)*width,top=Math.floor(i/columns)*height;
      for(let y=0;y<height;y++)f.rgba.copy(packed,((top+y)*width*columns+left)*4,y*width*4,(y+1)*width*4);
    });
    const atlas=await sharp(packed,{raw:{width:width*columns,height:height*rows,channels:4}}).png({compressionLevel:9}).toBuffer();
    // Verify every packed cell against its original RGBA pixels.
    for(let i=0;i<subset.length;i++){
      const decoded=await sharp(atlas).extract({left:(i%columns)*width,top:Math.floor(i/columns)*height,width,height}).raw().toBuffer();
      if(!decoded.equals(subset[i].rgba))throw Error('Packing changed pixels: '+subset[i].file);
    }
    await writeFile(resolve(output,file),atlas);
    pages.push({file,columns,rows,first,count:subset.length,width:width*columns,height:height*rows});
  }
  if(pages.length>2)throw Error('Expected at most two native texture pages.');
  cycles[family]={id:family,width,height,fps:input.fps,frameCount:frames.length,pages,
    frames:frames.map(({file,anchor,sha256})=>({file,anchor,sha256}))};
}
await writeFile(resolve(output,'cycles.json'),JSON.stringify(cycles,null,2)+'\n');
console.log(JSON.stringify(Object.fromEntries(Object.entries(cycles).map(([k,c])=>[k,{frames:c.frameCount,canvas:[c.width,c.height],pages:c.pages.map(p=>[p.width,p.height])}]))));
