import type {LevelEntry} from '../level';

// Only unchanged published snapshots follow the current source version.
// Fingerprints cover normalized data, including names and every component:
// the original Test Course and Carlisle Coast's first release (1e8868c).
// Any local edit, including a renamed copy, retains its authored data.
const published = {
 'Test Course': {length:31264,a:0x43b5749b,b:0x74039a85},
 'Carlisle Coast': {length:299391,a:0x7a75368f,b:0x3e171a3f},
} as const;
const checked=new WeakMap<object,boolean>();
export function isOriginalTestCourse(entry:LevelEntry):boolean {
 if(entry.id!=='test'||!entry.data||entry.data.name!==entry.name)return false;
 const signature=entry.name==='Test Course'?published['Test Course']:
  entry.name==='Carlisle Coast'?published['Carlisle Coast']:undefined;
 if(!signature)return false;
 // Registry entries are deeply frozen. Editable caller-owned copies must be
 // rechecked so an in-place edit cannot reuse a previously matching result.
 const cacheable=Object.isFrozen(entry.data);
 const previous=cacheable?checked.get(entry.data):undefined;
 if(previous!==undefined)return previous;
 const json=JSON.stringify(entry.data);let a=2166136261,b=2246822519;
 if(json.length===signature.length)for(let i=0;i<json.length;i++){const c=json.charCodeAt(i);a=Math.imul(a^c,16777619);b=Math.imul(b^c,3266489917);}
 const match=json.length===signature.length&&(a>>>0)===signature.a&&(b>>>0)===signature.b;
 if(cacheable)checked.set(entry.data,match);
 return match;
}
