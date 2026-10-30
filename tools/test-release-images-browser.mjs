import assert from 'node:assert/strict';
import {createServer} from 'node:http';
import {readFile,mkdir,writeFile} from 'node:fs/promises';
import path from 'node:path';

const {chromium}=await import(process.env.PLAYWRIGHT_MODULE||'playwright');
const manifest=JSON.parse(await readFile('release-images/manifest.json','utf8'));
const out=process.env.IMAGE_REVIEW_OUT||'/tmp/release-images-browser';
const routes=new Map();
for(const [index,row] of manifest.files.entries()){
 routes.set('/source/'+index,{file:'public/'+row.file,type:'image/png'});
 routes.set('/release/'+index,{file:'release-images/encoded/'+row.sha256+'.webp',type:'image/webp'});
}
const server=createServer(async(req,res)=>{
 if(req.url==='/'){res.setHeader('Content-Type','text/html');res.end('<!doctype html><title>Lossless release image review</title>');return;}
 const entry=routes.get(req.url);
 if(!entry){res.statusCode=404;res.end();return;}
 try{res.setHeader('Content-Type',entry.type);res.end(await readFile(entry.file));}catch{res.statusCode=500;res.end();}
});
await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));
const browser=await chromium.launch({headless:true,channel:'chrome'}),report={images:[],errors:[]};
try{
 const page=await browser.newPage();page.on('pageerror',e=>report.errors.push(e.message));
 await page.goto('http://127.0.0.1:'+server.address().port+'/');
 for(const [index,row] of manifest.files.entries()){
  const result=await page.evaluate(async index=>{
   const load=async prefix=>{const image=new Image();image.src='/'+prefix+'/'+index;await image.decode();return image;};
   const [source,packed]=await Promise.all([load('source'),load('release')]);
   const canvas=document.createElement('canvas');canvas.width=source.width;canvas.height=source.height;
   const ctx=canvas.getContext('2d',{willReadFrequently:true});
   ctx.drawImage(source,0,0);const a=ctx.getImageData(0,0,canvas.width,canvas.height).data;
   ctx.clearRect(0,0,canvas.width,canvas.height);ctx.drawImage(packed,0,0);const b=ctx.getImageData(0,0,canvas.width,canvas.height).data;
   let changed=0,max=0,opaqueChanged=0,alphaChanged=0;
   for(let i=0;i<a.length;i++)if(a[i]!==b[i]){changed++;max=Math.max(max,Math.abs(a[i]-b[i]));if(i%4===3)alphaChanged++;else if(a[i-i%4+3]===255)opaqueChanged++;}
   const composites=[];
   for(const background of ['black','white']){
    ctx.fillStyle=background;ctx.fillRect(0,0,canvas.width,canvas.height);ctx.drawImage(source,0,0);const x=ctx.getImageData(0,0,canvas.width,canvas.height).data;
    ctx.fillStyle=background;ctx.fillRect(0,0,canvas.width,canvas.height);ctx.drawImage(packed,0,0);const y=ctx.getImageData(0,0,canvas.width,canvas.height).data;
    let max=0;for(let i=0;i<x.length;i++)max=Math.max(max,Math.abs(x[i]-y[i]));composites.push({background,max});
   }
   return{source:[source.width,source.height],packed:[packed.width,packed.height],changed,max,opaqueChanged,alphaChanged,composites,channels:a.length};
  },index);
  assert.deepEqual(result.source,[row.width,row.height]);assert.deepEqual(result.packed,result.source);
  report.images.push({file:row.file,...result});
 }
 // PNG/WebP decoder premultiplication can round translucent RGB differently.
 // Alpha and opaque pixels must be exact; composited output may differ by one
 // 8-bit rounding step. The preparation tool separately compares raw RGBA.
 for(const row of report.images){assert.equal(row.alphaChanged,0,row.file);assert.equal(row.opaqueChanged,0,row.file);assert.ok(row.composites.every(c=>c.max<=1),row.file+' changed composited pixels');}
 assert.deepEqual(report.errors,[]);report.passed=true;
}finally{
 await mkdir(out,{recursive:true});await writeFile(path.join(out,'browser.json'),JSON.stringify(report,null,2)+'\n');
 await browser.close();await new Promise(resolve=>server.close(resolve));
}
console.log(`PASS ${report.images.length} native-size PNG/WebP pairs: exact alpha and opaque pixels, at most one compositing rounding step.`);
