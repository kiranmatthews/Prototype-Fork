import {readFile,writeFile} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import {fileURLToPath} from 'node:url';
const {default:sharp}=await import(process.env.SHARP_MODULE||'sharp');
const manifest=new URL('./image-prompts.json',import.meta.url),data=JSON.parse(await readFile(manifest,'utf8'));
for(const [name,m] of Object.entries(data.mattes)){
 const input=new URL('../../'+m.sourceFile,import.meta.url),output=new URL('../../'+m.file,import.meta.url);
 await sharp(fileURLToPath(input)).resize({width:2048,withoutEnlargement:true}).webp({quality:94,alphaQuality:100,effort:6}).toFile(fileURLToPath(output));
 const meta=await sharp(fileURLToPath(output)).metadata();if(m.transparent&&!meta.hasAlpha)throw Error(name+' must retain alpha');
 m.sha256=createHash('sha256').update(await readFile(output)).digest('hex');m.width=meta.width;m.height=meta.height;
 console.log(name,meta.width,meta.height,meta.hasAlpha);
}
await writeFile(manifest,JSON.stringify(data,null,2)+'\n');
