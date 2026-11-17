// Side-on stretches always read left to right (owner's rule, 17 November 2026).
// The side camera stands south of a turned stretch (+Z, looking -Z), so screen
// right is +X: every side-scroll travel zone heads east ('E'), any fixed side
// view over one looks from the south, and every bonus round runs toward +X.
// A course that doubles back plays the westward leg into the screen instead.
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {createServer} from 'vite';
const storage=new Map();
globalThis.localStorage={getItem:k=>storage.get(k)??null,setItem:(k,v)=>storage.set(k,String(v)),removeItem:k=>storage.delete(k)};
globalThis.window={location:{search:'?lite'},addEventListener(){}};
// Hand-built courses register their zones in code rather than as components.
const levelSource=await readFile(new URL('../src/level.ts',import.meta.url),'utf8');
assert.doesNotMatch(levelSource,/zones\.push\(\{[^}]*dir:\s*["']W["']/,'a hand-built course scrolls right to left');
const server=await createServer({configFile:false,appType:'custom',logLevel:'silent',optimizeDeps:{noDiscovery:true},server:{middlewareMode:true,hmr:false,ws:false,watch:null}});
try{
 const {BUILTIN_LEVELS}=await server.ssrLoadModule('/src/level.ts');
 const problems=[];let zones=0,bonuses=0;
 for(const entry of BUILTIN_LEVELS){
  const data=entry.data;if(!data)continue;
  const components=data.components??[];
  for(const zone of components.filter(c=>c.t==='zone'&&(c.dir==='E'||c.dir==='W'))){
   zones++;
   if(zone.dir==='W'){problems.push(`${entry.id}: "${zone.nm??'zone'}" scrolls right to left`);continue;}
   for(const view of components.filter(c=>c.t==='camnode'&&c.cameraView&&c.cameraPosition&&c.cameraTarget&&c.s)){
    const inside=Math.abs(zone.p[0]-view.p[0])<=view.s[0]/2&&Math.abs(zone.p[2]-view.p[2])<=view.s[2]/2;
    if(inside&&view.cameraPosition[2]<=view.cameraTarget[2])problems.push(`${entry.id}: "${view.nm??'camera view'}" looks at a side-on stretch from the north`);
   }
  }
  if(data.hudMode==='bonus'){
   const gate=components.find(c=>c.t==='gate');if(!gate)continue;bonuses++;
   if(gate.p[0]<=data.spawn[0])problems.push(`${entry.id}: the bonus round runs right to left`);
  }
 }
 assert.deepEqual(problems,[],problems.join('\n'));
 assert.ok(zones>0&&bonuses>0,'nothing was checked');
 console.log(`PASS side-on stretches read left to right: ${zones} side-scroll zones and ${bonuses} bonus rounds across ${BUILTIN_LEVELS.length} built-in levels.`);
}finally{await server.close();}
