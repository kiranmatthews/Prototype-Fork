// Technical contact sheet for inspecting the two references before imagegen.
import {readFile} from 'node:fs/promises';
import {resolve,dirname} from 'node:path';
import {fileURLToPath} from 'node:url';
const root=resolve(dirname(fileURLToPath(import.meta.url)),'../..');
const sharp=(await import(process.env.SHARP_MODULE||'sharp')).default;
const targets=JSON.parse(await readFile(resolve(root,'docs/fire-sprite-lab/v3/next.json'),'utf8'));
const layers=[];let y=0;
for(const [family,t] of Object.entries(targets)){
 for(const [i,f] of [t.left,t.right].entries()){
  const b=await sharp(resolve(root,f.file)).resize({width:400,height:280,fit:'contain',background:'#152127'}).flatten({background:'#152127'}).png().toBuffer();
  layers.push({input:b,left:i*400,top:y+20});
  const label=Buffer.from('<svg width="400" height="20"><text x="8" y="15" fill="white" font-size="13">'+family+' '+f.id+' → '+t.id+'</text></svg>');
  layers.push({input:label,left:i*400,top:y});
 }
 y+=300;
}
await sharp({create:{width:800,height:900,channels:3,background:'#152127'}}).composite(layers).png().toFile('/private/tmp/fire-v3-next.png');
