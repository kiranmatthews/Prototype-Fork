// The game plays only a few of the 218 clips in the skate source-motion
// library. Its riding overlay (src/skateReferenceLab/playableMotion.ts) names
// every clip it can ask for, either literally or as a template such as
// `R_PUSH${speed}_HSTR_N_0_${part}`. This module derives that set from the
// source and builds the small file the game downloads; the skate labs keep
// the full library.
//
//   node tools/skate-gameplay-motion.mjs        rebuild the gameplay file
import {createHash} from 'node:crypto';
import {readFile,writeFile} from 'node:fs/promises';
import {gunzipSync,gzipSync,constants} from 'node:zlib';
import {fileURLToPath} from 'node:url';

const root=new URL('..',import.meta.url);
export const FULL_BANK='public/motion-study/skate/motion.json.gz';
export const GAMEPLAY_BANK='public/motion-study/skate/gameplay.json.gz';
const PLAYABLE='src/skateReferenceLab/playableMotion.ts';

export async function readBank(file){return JSON.parse(gunzipSync(await readFile(new URL(file,root))).toString('utf8'));}

/** Every clip name the playable overlay can request, resolved against the bank. */
export async function gameplayClipNames(bank){
  const source=await readFile(new URL(PLAYABLE,root),'utf8'),names=new Set(bank.clips.map(c=>c.name)),wanted=new Set();
  for(const [,name] of source.matchAll(/['"]([A-Z][A-Z0-9]*(?:_[A-Z0-9]+)+)['"]/g))if(names.has(name))wanted.add(name);
  for(const [,template] of source.matchAll(/`([A-Z][A-Z0-9_]*(?:\$\{[^}]+\}[A-Z0-9_]*)+)`/g)){
    const pattern=new RegExp('^'+template.split(/\$\{[^}]+\}/).map(part=>part.replace(/[.*+?^${}()|[\]\\]/g,'\\$&')).join('[A-Z0-9_]+')+'$');
    for(const name of names)if(pattern.test(name))wanted.add(name);
  }
  return bank.clips.map(c=>c.name).filter(name=>wanted.has(name));
}

export async function gameplayBank(){
  const bank=await readBank(FULL_BANK),keep=new Set(await gameplayClipNames(bank));
  return {...bank,scope:`Gameplay subset of the ${bank.clips.length}-clip skate study: the clips the playable overlay can request.`,
    clips:bank.clips.filter(c=>keep.has(c.name))};
}

if(process.argv[1]===fileURLToPath(import.meta.url)){
  // JSON.stringify writes -0 as 0; keep the source's signed zeros exact.
  const bank=await gameplayBank(),json=Buffer.from(JSON.stringify(bank,(_key,value)=>Object.is(value,-0)?'__negative_zero__':value).replaceAll('"__negative_zero__"','-0'));
  const packed=gzipSync(json,{level:constants.Z_BEST_COMPRESSION});
  await writeFile(new URL(GAMEPLAY_BANK,root),packed);
  const provenanceFile=new URL('public/motion-study/provenance.json',root),provenance=JSON.parse(await readFile(provenanceFile,'utf8'));
  const entry={path:'skate/gameplay.json.gz',bytes:json.length,sha256:createHash('sha256').update(json).digest('hex'),encoding:'gzip',packedBytes:packed.length};
  const at=provenance.assets.findIndex(a=>a.path===entry.path);
  if(at>=0)provenance.assets[at]=entry;else provenance.assets.splice(provenance.assets.findIndex(a=>a.path==='skate/motion.json.gz')+1,0,entry);
  await writeFile(provenanceFile,JSON.stringify(provenance,null,2)+'\n');
  console.log(`${bank.clips.length} gameplay clips, ${(packed.length/1048576).toFixed(2)} MiB packed (${(json.length/1048576).toFixed(2)} MiB JSON): ${bank.clips.map(c=>c.name).join(', ')}`);
}
