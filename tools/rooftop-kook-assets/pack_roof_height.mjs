// Format-only conversion of the ImageGen height map. Every decoded channel is exact.
import {createRequire} from 'node:module';
import {readFile,writeFile} from 'node:fs/promises';
import {createHash} from 'node:crypto';
const require=createRequire(process.env.ROOFTOP_GLTF_PACKAGE||import.meta.url),sharp=require('sharp');
const source='tools/rooftop-kook-assets/references/metal-height.png',output='public/rooftop-kook/metal-height.webp';
const original=await readFile(source),encoded=await sharp(original).webp({lossless:true,effort:6}).toBuffer();
const a=await sharp(original).ensureAlpha().raw().toBuffer({resolveWithObject:true}),b=await sharp(encoded).ensureAlpha().raw().toBuffer({resolveWithObject:true});
if(!a.data.equals(b.data)||a.info.width!==b.info.width||a.info.height!==b.info.height)throw Error('Height map pixels changed');
await writeFile(output,encoded);
const hash=data=>createHash('sha256').update(data).digest('hex');
await writeFile('tools/rooftop-kook-assets/metal-height-packing.json',JSON.stringify({source,output,sourceBytes:original.length,bytes:encoded.length,sourceSha256:hash(original),sha256:hash(encoded),width:a.info.width,height:a.info.height,decodedRgbaSha256:hash(a.data),exactDecodedChannels:true},null,2)+'\n');
console.log('PASS exact height-map pixels;',original.length-encoded.length,'bytes saved');
