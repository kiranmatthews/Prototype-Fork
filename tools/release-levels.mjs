import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {execFile} from 'node:child_process';
import {promisify, isDeepStrictEqual} from 'node:util';
import {lstat,mkdtemp,mkdir,readFile,realpath,rm,writeFile} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import path from 'node:path';
import {fileURLToPath} from 'node:url';

const hash=bytes=>createHash('sha256').update(bytes).digest('hex');
const within=(parent,child)=>{const relative=path.relative(parent,child);return relative===''||(!relative.startsWith('..'+path.sep)&&relative!=='..'&&!path.isAbsolute(relative));};
export const levelSnapshotHash=(entry,portable=false)=>hash(JSON.stringify(entry,(_key,value)=>{
  if(portable&&typeof value==='number')return Number(value.toFixed(9));
  if(value&&typeof value==='object'&&!Array.isArray(value))
    return Object.fromEntries(Object.entries(value).sort(([a],[b])=>a<b?-1:a>b?1:0));
  return value;
}));

/** Public source snapshots remain complete. The served sync pack only needs
 * overrides: an exactly identical built-in already exists in the game bundle.
 * Compare complete JSON values (including names/metadata), never just IDs or
 * selected fields. A reviewed stock certificate may also recognize a snapshot
 * proven exactly stock by its authoring runtime. Its full, unrounded hash must
 * match: even sub-nanometre edits to a saved snapshot must be retained. Only
 * the runtime-generated counterpart tolerates platform trig roundoff. */
export function compactPublishedLevels(pack,builtins,stockCertificates={}) {
  assert.ok(pack&&typeof pack==='object'&&!Array.isArray(pack)&&pack.v===2&&
    Object.keys(pack).every(key=>key==='v'||key==='levels')&&Array.isArray(pack.levels)&&pack.levels.length<=128,'Invalid published level pack');
  const sources=new Map(builtins.filter(entry=>entry.data).map(entry=>[entry.id,entry]));
  const levels=[],sourceBacked=[],ids=new Set();
  for(const entry of pack.levels){
    assert.ok(entry&&typeof entry==='object'&&!Array.isArray(entry)&&
      Object.keys(entry).length===3&&['id','name','data'].every(key=>Object.hasOwn(entry,key))&&
      typeof entry.id==='string'&&!ids.has(entry.id),'Invalid or duplicate published level');
    ids.add(entry.id);
    const source=sources.get(entry.id);
    // JSON conversion is deliberate: signed zero and absent undefined fields
    // have the same representation when a native level is exported to JSON.
    const certificate=stockCertificates[entry.id];
    const certified=source&&certificate&&
      levelSnapshotHash(entry)===certificate.snapshotSha256&&
      levelSnapshotHash(source,true)===certificate.portableSourceSha256;
    if(source&&(isDeepStrictEqual(entry,JSON.parse(JSON.stringify(source)))||certified)){
      sourceBacked.push(entry.id);
    }else levels.push(entry);
  }
  return {pack:{v:2,levels},sourceBacked};
}

export async function preparePublishedLevels({root,outDir}) {
  // Isolate the source registry from the build process. The SSR loader uses a
  // temporary cache and no config, optimizer, listener or network connection.
  const {stdout}=await promisify(execFile)(process.execPath,[fileURLToPath(import.meta.url),'--prepare',path.resolve(root),path.resolve(outDir)],{maxBuffer:1024*1024});
  return JSON.parse(stdout);
}

async function prepare(root,outDir) {
  const sourceDir=await realpath(path.join(root,'public'));
  const outputDir=await realpath(outDir);
  assert.ok(!within(sourceDir,outputDir)&&!within(outputDir,sourceDir),'Level output overlaps source');
  const target=path.join(outputDir,'levels.json');
  assert.ok((await lstat(target)).isFile(),'Level output must be a regular file');
  const provenance=path.join(outputDir,'provenance');
  await mkdir(provenance,{recursive:true});
  assert.equal(await realpath(provenance),provenance,'Level provenance must be a real output directory');
  const proof=path.join(provenance,'level-sync.json');
  try {assert.ok((await lstat(proof)).isFile(),'Level provenance must be a regular file');}
  catch(error){if(error.code!=='ENOENT')throw error;}
  const original=await readFile(path.join(sourceDir,'levels.json'));
  assert.ok(original.length<=64*1024*1024,'Published source archive exceeds build inspection bound');
  const cacheDir=await mkdtemp(path.join(tmpdir(),'level-sync-build-'));
  let server;
  try{
    globalThis.window={location:{search:'?lite'},addEventListener(){}};
    const {createServer}=await import('vite');
    server=await createServer({root,configFile:false,cacheDir,appType:'custom',logLevel:'silent',
      optimizeDeps:{noDiscovery:true},server:{middlewareMode:true,hmr:false,ws:false,watch:null}});
    const api=await server.ssrLoadModule('/src/level.ts');
    const certificates=JSON.parse(await readFile(path.join(root,'tools/fixtures/stock-level-snapshots.json'),'utf8'));
    assert.equal(certificates.v,1,'Unsupported stock snapshot certificate');
    const result=compactPublishedLevels(JSON.parse(original),api.BUILTIN_LEVELS,certificates.levels);
    const output=Buffer.from(JSON.stringify(result.pack)+'\n');
    assert.ok(api.levelJsonTextWithinLimits(output.toString('utf8'),api.MAX_LEVEL_PACK_BYTES,14)&&
      api.normalizeUserLevelEntries(result.pack.levels),'Published overrides exceed the bounded import contract');
    // No source is written. Repeated builds always derive from the originals.
    const report={v:1,sourceBytes:original.length,sourceSha256:hash(original),
      outputBytes:output.length,outputSha256:hash(output),
      sourceBacked:result.sourceBacked,retained:result.pack.levels.map(entry=>entry.id)};
    await writeFile(target,output);
    await writeFile(proof,JSON.stringify(report,null,2)+'\n');
    return report;
  }finally{
    await server?.close();
    await rm(cacheDir,{recursive:true,force:true});
  }
}

if(process.argv[2]==='--prepare'){
  const report=await prepare(path.resolve(process.argv[3]),path.resolve(process.argv[4]));
  process.stdout.write(JSON.stringify(report));
}
