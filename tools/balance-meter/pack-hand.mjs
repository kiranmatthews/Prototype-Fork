// Pack image-model artwork using the existing matte/alpha sprite pipeline.
// CANVAS_MODULE may point at a bundled @napi-rs/canvas installation.
import fs from 'node:fs/promises';
import {createHash} from 'node:crypto';
import {pathToFileURL} from 'node:url';
import {createRequire} from 'node:module';
import ts from 'typescript';
const {createCanvas,ImageData}=await import(process.env.CANVAS_MODULE?pathToFileURL(process.env.CANVAS_MODULE).href:'@napi-rs/canvas');
const require=createRequire(process.env.CANVAS_MODULE?pathToFileURL(process.env.CANVAS_MODULE):import.meta.url),{PNG}=require('pngjs');
const root=new URL('../../',import.meta.url),source=new URL('art/balance-meter/v2/glove-matte-source.png',root),out=new URL('public/hud/balance-v2/',root);
globalThis.document={createElement:()=>createCanvas(1,1)};globalThis.ImageData=ImageData;
const code=ts.transpileModule(await fs.readFile(new URL('../roo-type/raster-material.ts',import.meta.url),'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2020}}).outputText;
const module={exports:{}};new Function('module','exports',code)(module,module.exports);
const raw=await fs.readFile(source),decoded=PNG.sync.read(raw),image=createCanvas(decoded.width,decoded.height);
image.getContext('2d').putImageData(new ImageData(new Uint8ClampedArray(decoded.data),decoded.width,decoded.height),0,0);
const cut=module.exports.modelCutout(image,{preserveBlack:true});
const bounds=cut.bounds,width=320,height=Math.round(320*bounds[3]/bounds[2])+16,canvas=createCanvas(width,height),ctx=canvas.getContext('2d');
ctx.imageSmoothingEnabled=true;ctx.imageSmoothingQuality='high';
const scale=Math.min((width-16)/bounds[2],(height-16)/bounds[3]),w=bounds[2]*scale,h=bounds[3]*scale;
ctx.drawImage(cut.canvas,...bounds,(width-w)/2,(height-h)/2,w,h);
const pixels=ctx.getImageData(0,0,width,height).data;
let right=0;for(let y=0;y<height;y++)for(let x=0;x<width;x++)if(pixels[(y*width+x)*4+3]>180)right=Math.max(right,x);
let total=0,count=0;for(let y=0;y<height;y++)for(let x=right-3;x<=right;x++)if(pixels[(y*width+x)*4+3]>180){total+=y;count++;}
const tip=[right/width,total/count/height],png=PNG.sync.write({width,height,data:Buffer.from(pixels)});
await fs.mkdir(out,{recursive:true});await fs.writeFile(new URL('glove.png',out),png);
const assetPath=new URL('src/balanceMeterAssets.ts',root),text=await fs.readFile(assetPath,'utf8');
const assets=JSON.parse(text.split(' = ')[1].split(' as const;')[0]);assets.glove={file:'hud/balance-v2/glove.png',tip};
await fs.writeFile(assetPath,'// Meter cels: tools/balance-meter/bake.mjs. Glove: tools/balance-meter/pack-hand.mjs.\nexport const BALANCE_METER_ASSETS = '+JSON.stringify(assets)+' as const;\n');
const prompts={};for(const name of ['three-finger-selected.txt','glove-matte.txt'])prompts[name]=await fs.readFile(new URL('art/balance-meter/v2/prompts/'+name,root),'utf8');
const provenance={generator:'built-in image_gen',anatomy:'three fingers plus thumb; one pointing index, two curled fingers, one folded thumb',source:'art/balance-meter/v2/glove-matte-source.png',sourceSha256:createHash('sha256').update(raw).digest('hex'),runtimeSha256:createHash('sha256').update(png).digest('hex'),background:cut.background,preserveBlack:true,sourceBounds:bounds,width,height,tip,prompts};
await fs.writeFile(new URL('provenance.json',out),JSON.stringify(provenance,null,2)+'\n');
console.log(JSON.stringify({file:'public/hud/balance-v2/glove.png',bytes:png.length,width,height,tip,background:cut.background}));
