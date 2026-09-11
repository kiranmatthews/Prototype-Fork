import fs from 'node:fs/promises';
import {createHash} from 'node:crypto';
import {fileURLToPath} from 'node:url';
import {editRasterManifest} from './manifest-store.mjs';
const [id,sourcePath]=process.argv.slice(2);if(!/^[0-9a-f]{4}$/.test(id??'')||!sourcePath)throw new Error('Use: register-raster-output.mjs <codepoint hex> <generated PNG>');
const char=String.fromCodePoint(parseInt(id,16)),art=new URL('../../art/roo-reference-match/',import.meta.url);
const bytes=await fs.readFile(sourcePath),model=`raster-v6/masters/u${id}.png`;
const sha=createHash('sha256').update(bytes).digest('hex');
await editRasterManifest(async manifest=>{
 const glyph=manifest.glyphs[char];if(!glyph)throw new Error('Unknown glyph');
 if(glyph.modelSha256&&glyph.modelSha256!==sha)throw new Error('The neutral master is frozen; register a separate explicit candidate instead');
 await fs.mkdir(new URL('raster-v6/masters/',art),{recursive:true});await fs.writeFile(new URL(model,art),bytes);
 Object.assign(glyph,{model,generatedSource:sourcePath,modelSha256:sha,status:'generated'});
});
console.log(JSON.stringify({glyph:char,file:fileURLToPath(new URL(model,art)),sha256:sha}));
