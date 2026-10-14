// The trilogy is now bonus gameplay. Remove only its retired published entries.
import {readFile,writeFile} from 'node:fs/promises';
const file=new URL('../public/levels.json',import.meta.url),pack=JSON.parse(await readFile(file,'utf8'));
const retired=new Set(['crate-primer','switchyard','clockwork-gauntlet'].flatMap(id=>[id,`bonus-${id}`]));
const removed=pack.levels.filter(entry=>retired.has(entry.id)).map(entry=>entry.id);
pack.levels=pack.levels.filter(entry=>!retired.has(entry.id));
await writeFile(file,JSON.stringify(pack)+'\n');
console.log('Retired dedicated puzzle entries:',removed);
