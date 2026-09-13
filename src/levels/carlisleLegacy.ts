import type {LevelEntry} from '../level';

// Only the unchanged published Test Course follows the new source version.
// Any local edit, including a renamed copy, retains its authored data.
const checked=new WeakMap<object,boolean>();
export function isOriginalTestCourse(entry:LevelEntry):boolean {
 if(entry.id!=='test'||entry.name!=='Test Course'||!entry.data)return false;
 const previous=checked.get(entry.data);if(previous!==undefined)return previous;
 const json=JSON.stringify(entry.data);let a=2166136261,b=2246822519;
 if(json.length===31264)for(let i=0;i<json.length;i++){const c=json.charCodeAt(i);a=Math.imul(a^c,16777619);b=Math.imul(b^c,3266489917);}
 const match=json.length===31264&&(a>>>0)===0x43b5749b&&(b>>>0)===0x74039a85;
 checked.set(entry.data,match);return match;
}
