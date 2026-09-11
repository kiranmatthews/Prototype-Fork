import fs from 'node:fs/promises';
import {createHash} from 'node:crypto';
import {editRasterManifest} from './manifest-store.mjs';
const [id,side,sourcePath]=process.argv.slice(2);if(!/^[0-9a-f]{4}$/.test(id??'')||!['left','right'].includes(side)||!sourcePath)throw new Error('Use: register-glisten-output.mjs <hex> <left|right> <generated PNG>');
const char=String.fromCodePoint(parseInt(id,16)),art=new URL('../../art/roo-reference-match/',import.meta.url);
const bytes=await fs.readFile(sourcePath),model=`raster-v6/lights/${side}/u${id}.png`;
await editRasterManifest(async manifest=>{
 const master=manifest.glyphs[char];if(!master?.model)throw new Error('The approved neutral must exist first');
 await fs.mkdir(new URL(`raster-v6/lights/${side}/`,art),{recursive:true});await fs.writeFile(new URL(model,art),bytes);
 master.lightSources??={};master.lightSources[side]={model,prompt:`raster-v6/lights/prompts/u${id}-${side}.txt`,generatedSource:sourcePath,modelSha256:createHash('sha256').update(bytes).digest('hex'),neutralModel:master.model};
});
console.log(JSON.stringify({glyph:char,side,model}));
