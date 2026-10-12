import {readFile,writeFile,stat} from 'node:fs/promises';
import {createHash} from 'node:crypto';
const root=new URL('../../',import.meta.url);
const read=async p=>JSON.parse(await readFile(new URL(p,root),'utf8'));
const captures=await read('docs/blockworks-art/captures/manifest.json');
const prompts=await read('tools/blockworks-art/prompts.json');
const ledger=await read('tools/blockworks-art/storyboard-ledger.json');
const mode=process.argv[2]||'next',count=Number(process.argv[3]||4);
const pending=prompts.views.filter(s=>!ledger.views[s.id]);
if(mode==='next')console.log(JSON.stringify(pending.slice(0,count)));
else if(mode==='status')console.log(JSON.stringify({captures:captures.shots.length,generated:Object.keys(ledger.views).length,remaining:pending.length,reviewed:Object.values(ledger.views).filter(v=>v.state==='reviewed').length,repair:Object.entries(ledger.views).filter(([,v])=>v.review?.startsWith('rejected')).map(([id])=>id)},null,2));
else if(mode==='gate'){
 const problems=[];
 if(captures.shots.length!==prompts.views.length)problems.push('Capture/prompt coverage differs');
 if(captures.errors.length)problems.push('Capture console errors are unresolved');
 for(const s of captures.shots){const v=ledger.views[s.id];
  if(!v||v.state!=='reviewed'||v.review?.startsWith('rejected')){problems.push(`${s.id}: storyboard missing or not reviewed`);continue;}
  if(v.captureSha256&&v.captureSha256!==s.sha256)problems.push(`${s.id}: source capture changed after generation`);
  try{const bytes=await readFile(new URL(v.output,root));if(v.sha256&&createHash('sha256').update(bytes).digest('hex')!==v.sha256)problems.push(`${s.id}: output hash changed`);}catch{problems.push(`${s.id}: output file missing`);}
 }
 console.log(JSON.stringify({readyForMeshy:problems.length===0,captures:captures.shots.length,problems},null,2));
 if(problems.length)process.exitCode=1;
}else throw Error('Usage: queue.mjs next [count] | status | gate');
