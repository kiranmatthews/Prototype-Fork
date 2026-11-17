// Pixel diagnostics direct attention to suspect individual drawings.
// They do not prove convincing motion or replace visual loop review.
import {readFile,writeFile} from 'node:fs/promises';
import {resolve,dirname} from 'node:path';
import {fileURLToPath} from 'node:url';
const root=resolve(dirname(fileURLToPath(import.meta.url)),'../..');
const sharp=(await import(process.env.SHARP_MODULE||'sharp')).default;
const record=JSON.parse(await readFile(resolve(root,'docs/fire-sprite-lab/v4/generation.json'),'utf8')),cache=new Map();
async function pixels(p){p=resolve(root,p);if(!cache.has(p))cache.set(p,await sharp(p).ensureAlpha().raw().toBuffer());return cache.get(p);}
function distance(a,b){if(a.length!==b.length)throw Error('Canvas mismatch');let d=0;for(let i=0;i<a.length;i+=4){const x=a[i+3]/255,y=b[i+3]/255;d+=Math.abs(x-y);for(let c=0;c<3;c++)d+=Math.abs(a[i+c]*x-b[i+c]*y)/255;}return d/a.length;}
const family=process.argv[2]||'narrow',results=[];
for(const f of record.frames.filter(f=>f.family===family&&f.phase%8!==0)){
 const refs=f.temporalNeighbours||f.references.map(r=>r.file);
 const a=await pixels(refs[0]),b=await pixels(refs[1]),m=await pixels(f.file);
 const da=distance(a,m),db=distance(b,m),ab=distance(a,b),ratio=da/(da+db);
 results.push({family,phase:f.phase,file:f.file,ratio:Number(ratio.toFixed(3)),differenceA:da,differenceB:db,endpointDifference:ab,reviewSuggested:ratio<.28||ratio>.72});
}
await writeFile(resolve(root,`docs/fire-sprite-lab/v4/${family}-midpoint-audit.json`),JSON.stringify({note:'Diagnostic only; inspect flagged poses visually. Not an art approval.',results},null,2)+'\n');
console.log(JSON.stringify({family,frames:record.frames.filter(f=>f.family===family).length,results:results.map(f=>({phase:f.phase,ratio:f.ratio,review:f.reviewSuggested}))}));
