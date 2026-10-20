import {readFile,writeFile,mkdir,copyFile,unlink} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import {fileURLToPath} from 'node:url';
import {join,resolve} from 'node:path';
const {default:sharp}=await import(process.env.SHARP_MODULE||'sharp');
const root=fileURLToPath(new URL('../../',import.meta.url)),path=join(root,'tools/waterslide-assets/image-prompts.json');
const data=JSON.parse(await readFile(path,'utf8')),archive=join(root,'.img2threejs/waterslide-art/item-pictures');await mkdir(archive,{recursive:true});
for(const [name,item] of Object.entries(data.items)){
 if(!item.file.startsWith('public/race-items/'))continue;
 const source=item.sourceFile?resolve(root,item.sourceFile):resolve(root,item.file),original=join(archive,name+'.png');
 if(!item.sourceFile)await copyFile(source,original);
 const output=join(root,'public/race-items',name+'.webp');
 await sharp(original).resize(512,512,{fit:'contain',background:{r:0,g:0,b:0,alpha:0}}).webp({quality:93,alphaQuality:100,effort:6}).toFile(output);
 const meta=await sharp(output).metadata();if(!meta.hasAlpha)throw Error('Missing alpha: '+name);
 item.sourceFile='.img2threejs/waterslide-art/item-pictures/'+name+'.png';item.sourceSha256=item.sourceSha256??item.sha256;
 item.file='public/race-items/'+name+'.webp';item.sha256=createHash('sha256').update(await readFile(output)).digest('hex');item.runtimeSize=[meta.width,meta.height];
 if(source.endsWith('.png')&&source!==original)await unlink(source);
 console.log(name,(await readFile(output)).length);
}
await writeFile(path,JSON.stringify(data,null,2)+'\n');
