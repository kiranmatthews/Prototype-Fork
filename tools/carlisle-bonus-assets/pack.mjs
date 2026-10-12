import {createRequire} from 'node:module';
const sharp=createRequire('/Users/kiki/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/package.json')('sharp');
import {mkdir,readFile,writeFile} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import {fileURLToPath} from 'node:url';
const output=new URL('../../public/carlisle-bonus/',import.meta.url);
await mkdir(output,{recursive:true});
const manifest=[];
for(const name of ['sky','canyon-matte','ruins-matte','hanging-moss']){
 const source=new URL(`references/${name}.png`,import.meta.url),bytes=await readFile(source);
 const dest=new URL(`${name}.webp`,output);
 await sharp(bytes).webp({quality:93,alphaQuality:100,effort:6}).toFile(fileURLToPath(dest));
 const meta=await sharp(fileURLToPath(dest)).metadata();
 manifest.push({name,file:`carlisle-bonus/${name}.webp`,width:meta.width,height:meta.height,alpha:meta.hasAlpha,
  sourceSha256:createHash('sha256').update(bytes).digest('hex'),bytes:(await readFile(dest)).length,provider:'OpenAI built-in image_gen'});
}
await writeFile(new URL('manifest.json',output),JSON.stringify({version:1,assets:manifest},null,2)+'\n');
console.log(manifest);
