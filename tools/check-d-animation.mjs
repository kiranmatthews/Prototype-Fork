import {readFileSync,writeFileSync,mkdtempSync,mkdirSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {gunzipSync} from 'node:zlib';
import {spawnSync} from 'node:child_process';

// Run every independent D regression even if an earlier family fails. Keep
// complete evidence per check, not a green summary that hides an early exit.
const output=process.argv[2]??mkdtempSync(join(tmpdir(),'d-animation-'));
mkdirSync(output,{recursive:true});
const bank=name=>{
  const path=join(output,`${name}.json`);
  writeFileSync(path,gunzipSync(readFileSync(new URL(`../public/motion-study/${name}/motion.json.gz`,import.meta.url))));return path;
};
const jak=bank('jak'),skate=bank('skate');
const tests=[
  ...['direct-motion','double-jump','idle','locomotion','ledge-flip','ledge-traverse','precision-jumps','rubber-motion','ui-tuning']
    .map(name=>[`test-jak-${name}.mjs`,jak]),
  ['test-playable-skate-motion.mjs',skate],
  ['test-jump-skate-integration.mjs',skate,jak],
  ['test-skate-equipment-ground.mjs',skate],
  ...['skate-native-actions','skate-abandon-presentation','skate-stance-continuity','skate-dismount-flow',
    'skate-mount-reveal','skate-speed-recovery-motion','gameplay-animation-lifecycle','pancake-slam','keyed-slide','animation-ik','character-animation-runtime','character-elasticity']
    .map(name=>[`test-${name}.mjs`]),
];
// Existing scenario tests that do not replace their player's animation runtime
// now also run with the actual default D document and source presentation.
const gameplay=new Set(['swim-controls','ice-slide-carry','skate-entry','grind-ollie-intent',
  'grind-catch-buffer','grind-drop-in','halfpipe-steering','park-halfpipe-vert','ledge-crates',
  'kite-controls','kite-grab','kite-spring','kite-finish','trampoline-controls','trampoline-contact',
  'trampoline-roll-landing','world-map-locomotion'].map(name=>`test-${name}.mjs`));
tests.push(...[...gameplay].map(file=>[file]));
const results=[];
for(const [file,...args] of tests){
  const start=Date.now(),result=spawnSync(process.execPath,[`tools/${file}`,...args],{
    env:{...process.env,...(gameplay.has(file)?{GAMEPLAY_ANIMATION_SCHEME:'D'}:{})},encoding:'utf8',maxBuffer:32*1024*1024});
  const log=join(output,file.replace('.mjs','.log'));
  writeFileSync(log,(result.stdout??'')+(result.stderr??'')+(result.error?String(result.error):''));
  const row={file,status:result.status===0?'pass':'fail',exitCode:result.status,signal:result.signal,seconds:(Date.now()-start)/1000,log};
  results.push(row);console.log(JSON.stringify(row));
  writeFileSync(join(output,'results.json'),JSON.stringify(results,null,2));
}
process.exitCode=results.every(r=>r.status==='pass')?0:1;
