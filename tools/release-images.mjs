import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {lstat,readFile,realpath,rm,writeFile} from 'node:fs/promises';
import path from 'node:path';

const digest = bytes => createHash('sha256').update(bytes).digest('hex');
const safePath = file => typeof file === 'string' && file.split('/').every(part => /^[\w.-]+$/.test(part) && part !== '.' && part !== '..');
async function regular(file,root){
 const info=await lstat(file);
 if(!info.isFile()||info.isSymbolicLink()||!(await realpath(file)).startsWith(root+path.sep))throw Error('Expected a contained regular release image');
 return readFile(file);
}

/** The reviewed WebPs have exactly the PNG's RGBA pixels, dimensions and
 * alpha. Only generated output is replaced; original art/export bytes stay. */
export async function prepareReleaseImages({root,outDir}){
 const source=await realpath(path.join(root,'public')),output=await realpath(outDir);
 if(source===output||source.startsWith(output+path.sep)||output.startsWith(source+path.sep))throw Error('Release image output overlaps source');
 const library=await realpath(path.join(root,'release-images'));
 const manifest=JSON.parse(await regular(path.join(library,'manifest.json'),library));
 assert.equal(manifest.v,1);assert.ok(Array.isArray(manifest.files));
 const prepared=[],seen=new Set();
 for(const row of manifest.files){
  assert.ok(safePath(row.file)&&row.file.endsWith('.png')&&!seen.has(row.file),'Invalid or repeated release image path');seen.add(row.file);
  assert.match(row.sha256,/^[a-f0-9]{64}$/);assert.match(row.sourceSha256,/^[a-f0-9]{64}$/);assert.match(row.pixelSha256,/^[a-f0-9]{64}$/);
  assert.ok(row.width>0&&row.height>0&&row.bytes<row.sourceBytes,'Release images must retain reviewed dimensions and save space');
  const original=await regular(path.join(source,row.file),source),encoded=await regular(path.join(library,'encoded',row.sha256+'.webp'),library);
  assert.equal(original.length,row.sourceBytes);assert.equal(digest(original),row.sourceSha256,'Source image changed; repeat lossless review');
  assert.equal(encoded.length,row.bytes);assert.equal(digest(encoded),row.sha256,'Reviewed image changed');
  assert.equal(encoded.toString('ascii',0,4),'RIFF');assert.equal(encoded.toString('ascii',8,12),'WEBP');
  assert.equal(original.readUInt32BE(16),row.width);assert.equal(original.readUInt32BE(20),row.height);
  const destination=path.join(output,row.file.replace(/\.png$/,'.webp'));
  if(await realpath(path.dirname(destination))!==path.dirname(destination))throw Error('Release image output cannot contain symlinks');
  try{assert.equal(digest(await regular(path.join(output,row.file),output)),row.sourceSha256);}
  catch(error){if(error.code!=='ENOENT')throw error;assert.equal(digest(await regular(destination,output)),row.sha256);}
  try{await regular(destination,output);}catch(error){if(error.code!=='ENOENT')throw error;}
  prepared.push({row,destination,encoded});
 }
 for(const {row,destination,encoded} of prepared){await writeFile(destination,encoded);await rm(path.join(output,row.file),{force:true});}
 return{images:prepared.length,savedBytes:prepared.reduce((total,{row})=>total+row.sourceBytes-row.bytes,0)};
}
