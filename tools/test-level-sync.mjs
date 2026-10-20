import assert from 'node:assert/strict';
import {readFile,writeFile,mkdtemp,mkdir,symlink,rm} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import path from 'node:path';
import {runInNewContext} from 'node:vm';
import ts from 'typescript';
import {createServer} from 'vite';
import {compactPublishedLevels,preparePublishedLevels} from './release-levels.mjs';

const storage=new Map();let denyWrites=false;
globalThis.localStorage={getItem:key=>storage.get(key)??null,setItem(key,value){if(denyWrites)throw new Error('quota');storage.set(key,String(value));},removeItem:key=>storage.delete(key)};
globalThis.window={location:{search:'?lite'},addEventListener(){}};
const temp=await mkdtemp(path.join(tmpdir(),'level-sync-test-'));
const server=await createServer({configFile:false,cacheDir:path.join(temp,'cache'),appType:'custom',logLevel:'silent',optimizeDeps:{noDiscovery:true},server:{middlewareMode:true,hmr:false,ws:false,watch:null}});
try{
 const api=await server.ssrLoadModule('/src/level.ts'),sync=await server.ssrLoadModule('/src/sync.ts');
 const original=await readFile('public/levels.json'),pack=JSON.parse(original);
 const compact=compactPublishedLevels(pack,api.BUILTIN_LEVELS);
 assert.deepEqual(compact.sourceBacked,pack.levels.filter(e=>e.id!=='flats').map(e=>e.id));
 assert.deepEqual(compact.pack,{v:2,levels:pack.levels.filter(e=>e.id==='flats')});
 assert.equal(api.MAX_LEVEL_PACK_BYTES,16*1024*1024,'untrusted import allocation bound stays unchanged');
 assert.ok(api.normalizeUserLevelEntries(compact.pack.levels));
 const crown=pack.levels.find(e=>e.id==='drowned-crown');
 for(const edit of [e=>e.name+=' edited',e=>e.data.name+=' edited',e=>e.data.spawn[0]+=.000001,
  e=>e.data.components[0].color='#abcdef',e=>e.data.components[0].nm='authored metadata',e=>e.data.components.pop(),
  e=>e.data.edgeGrindingRevision=1,e=>e.id='my-crown']){
  const changed=structuredClone(crown);edit(changed);
  const result=compactPublishedLevels({v:2,levels:[changed]},api.BUILTIN_LEVELS);
  assert.deepEqual(result.pack.levels,[changed],'edited or copied stock was discarded');
 }
 const reordered={data:crown.data,name:crown.name,id:crown.id};
 assert.deepEqual(compactPublishedLevels({v:2,levels:[reordered]},api.BUILTIN_LEVELS).pack.levels,[]);
 assert.throws(()=>compactPublishedLevels({v:2,levels:[crown,crown]},api.BUILTIN_LEVELS),/duplicate/);
 assert.throws(()=>compactPublishedLevels({v:3,levels:[]},api.BUILTIN_LEVELS),/Invalid/);
 assert.throws(()=>compactPublishedLevels({v:2,levels:[],extra:true},api.BUILTIN_LEVELS),/Invalid/);
 const output=path.join(temp,'dist');await mkdir(output);await writeFile(path.join(output,'levels.json'),original);
 const proof=await preparePublishedLevels({root:process.cwd(),outDir:output});
 assert.equal(proof.sourceBytes,31636645);assert.equal(proof.outputBytes,Buffer.byteLength(JSON.stringify(compact.pack)+'\n'));
 assert.deepEqual(JSON.parse(await readFile(path.join(output,'levels.json'))),compact.pack);
 assert.deepEqual(await preparePublishedLevels({root:process.cwd(),outDir:output}),proof,'repeated build must be idempotent');
 assert.deepEqual(await readFile('public/levels.json'),original,'build changed source snapshots');
 await assert.rejects(preparePublishedLevels({root:process.cwd(),outDir:path.resolve('public')}),/overlaps source/);
 await rm(path.join(output,'levels.json'));await symlink(path.resolve('public/levels.json'),path.join(output,'levels.json'));
 await assert.rejects(preparePublishedLevels({root:process.cwd(),outDir:output}),/regular file/);

 const entry={id:'local-work',name:'Local work',data:{v:1,name:'Local work',spawn:[0,1,0],killY:-20,components:[{t:'platform',p:[0,0,0],s:[20,1,30]},{t:'gate',p:[0,.5,-10]}]}};
 assert.equal(api.setUserLevels([entry]),true);
 const old=api.getUserLevels()[0],stored=storage.get('solProtoUserLevels');
 denyWrites=true;
 assert.equal(api.restoreUserLevels(compact.pack.levels),false);
 assert.equal(api.getUserLevels()[0],old,'quota failure replaced the live library');
 assert.equal(storage.get('solProtoUserLevels'),stored,'quota failure replaced saved work');
 assert.equal(api.userLevelStorageHealthy(),true,'failed remote restore poisoned existing save status');
 assert.equal(api.setUserLevels([{...entry,name:'Session edit'}]),false);
 assert.equal(api.getUserLevels()[0].name,'Session edit','editor quota failures must remain exportable');
 const session=api.getUserLevels()[0];
 assert.equal(api.restoreUserLevels(compact.pack.levels),false);
 assert.equal(api.getUserLevels()[0],session,'restore erased an unpersisted editor session');
 assert.equal(api.userLevelStorageHealthy(),false);
 assert.doesNotThrow(()=>sync.markLevelsPulled());
 const savedStorage=globalThis.localStorage;
 globalThis.localStorage={getItem(){throw new Error('blocked');},setItem(){throw new Error('blocked');}};
 assert.equal(sync.hasPulledLevels(),false);assert.doesNotThrow(()=>sync.markLevelsPulled());globalThis.localStorage=savedStorage;
 denyWrites=false;
 assert.equal(api.restoreUserLevels(compact.pack.levels),true);assert.equal(api.userLevelStorageHealthy(),true);
 assert.deepEqual(JSON.parse(storage.get('solProtoUserLevels')),api.getUserLevels());
 const preserved=api.getUserLevels()[0];
 assert.equal(api.restoreUserLevels([{...entry,data:null}]),false);assert.equal(api.getUserLevels()[0],preserved);
 assert.equal(api.userLevelStorageHealthy(),true);

 let response=()=>new Response(JSON.stringify(compact.pack));
 globalThis.fetch=async(url,options)=>{assert.match(url,/^\.\/levels\.json\?t=\d+$/);assert.equal(options.cache,'no-store');assert.ok(options.signal instanceof AbortSignal);return response();};
 assert.deepEqual((await sync.fetchRemoteLevels()).levels,api.normalizeUserLevelEntries(compact.pack.levels));
 let cancelled=false;
 for(const factory of [()=>new Response('{'),()=>new Response('',{status:503}),
  ()=>new Response(new Uint8Array([123,255,125])),
  ()=>new Response('{"v":2,"levels":'+ '['.repeat(20)+'0'+']'.repeat(20)+'}'),
  ()=>new Response(JSON.stringify({v:2,levels:[entry,entry]})),
  ()=>new Response(JSON.stringify({v:2,levels:[entry,{...entry,id:'bad',data:null}]})),
  ()=>new Response('{}',{headers:{'content-length':String(api.MAX_LEVEL_PACK_BYTES+1)}}),
  ()=>new Response(new ReadableStream({start(c){c.enqueue(new Uint8Array(api.MAX_LEVEL_PACK_BYTES+1));},cancel(){cancelled=true;}}),{headers:{'content-length':'2'}}),
  ()=>{throw new Error('offline');}]){
  response=factory;assert.equal(await sync.fetchRemoteLevels(),null);assert.equal(api.getUserLevels()[0],preserved);
 }
 assert.equal(cancelled,true);
 const bytes=new TextEncoder().encode(JSON.stringify({v:2,levels:[{...entry,name:'Café'}]}));const split=bytes.indexOf(0xc3)+1;
 response=()=>new Response(new ReadableStream({start(c){c.enqueue(bytes.slice(0,split));c.enqueue(bytes.slice(split));c.close();}}));
 assert.equal((await sync.fetchRemoteLevels()).levels[0].name,'Café');

 // Execute the actual startup closure and manual restore handler, including
 // asynchronous authorship races; assertions exercise behavior, not spelling.
 const source=await readFile('src/main.ts','utf8'),ast=ts.createSourceFile('main.ts',source,ts.ScriptTarget.Latest,true);
 const first=ast.statements.find(n=>ts.isVariableStatement(n)&&n.declarationList.declarations.some(d=>d.name.getText(ast)==='firstRunLevelSync'));
 const force=ast.statements.find(n=>ts.isExpressionStatement(n)&&ts.isBinaryExpression(n.expression)&&n.expression.left.getText(ast)==='ui.onForceResync');
 assert.ok(first&&force);
 const js=s=>ts.transpileModule(s,{compilerOptions:{target:ts.ScriptTarget.ES2022,module:ts.ModuleKind.CommonJS}}).outputText;
 const makeContext=()=>{const events=[];return{events,getUserLevels:api.getUserLevels,restoreUserLevels:api.restoreUserLevels,
  hasPulledLevels:sync.hasPulledLevels,markLevelsPulled:sync.markLevelsPulled,current:{id:'drowned-crown'},DEFAULT_LEVEL_ID:'drowned-crown',
  findLevel:api.findLevel,switchLevel:id=>{events.push(['switch',id]);return true;},level:{},player:{respawn(){events.push(['respawn']);}},
  ui:{refreshLevels(){events.push(['refresh']);},refreshEditControls(){},setSyncStatus(...args){events.push(['status',...args]);},showMessage(...args){events.push(['message',...args]);}}};};
 const runFirst=context=>runInNewContext(js(first.getText(ast))+'\nfirstRunLevelSync;',context);
 api.setUserLevels([]);storage.delete('solProtoCloudPulled');
 let finish;const racing=makeContext();racing.fetchRemoteLevels=()=>new Promise(resolve=>finish=resolve);
 const pulling=runFirst(racing);api.saveUserLevel(entry);finish(compact.pack);await pulling;
 assert.equal(api.getUserLevels()[0].id,entry.id);assert.equal(sync.hasPulledLevels(),true);assert.deepEqual(racing.events,[]);
 api.setUserLevels([]);storage.delete('solProtoCloudPulled');denyWrites=true;
 const blocked=makeContext();blocked.fetchRemoteLevels=async()=>compact.pack;await runFirst(blocked);
 assert.deepEqual(api.getUserLevels(),[]);assert.equal(sync.hasPulledLevels(),false);assert.deepEqual(blocked.events,[]);
 denyWrites=false;
 const fresh=makeContext();fresh.fetchRemoteLevels=async()=>compact.pack;await runFirst(fresh);
 assert.equal(api.getUserLevels()[0].id,'flats');assert.equal(sync.hasPulledLevels(),true);assert.deepEqual(fresh.events,[['refresh']]);
 api.setUserLevels([entry]);storage.delete('solProtoCloudPulled');denyWrites=true;
 const manual=makeContext();manual.fetchRemoteLevels=async()=>compact.pack;runInNewContext(js(force.getText(ast)),manual);await manual.ui.onForceResync();
 assert.equal(api.getUserLevels()[0].id,entry.id);assert.equal(sync.hasPulledLevels(),false);
 assert.equal(manual.events.some(e=>e[0]==='switch'||e[0]==='respawn'||e[0]==='refresh'),false);
 assert.ok(manual.events.some(e=>e[0]==='message'&&e[1]==='RESTORE FAILED'));
 denyWrites=false;await manual.ui.onForceResync();assert.equal(api.getUserLevels()[0].id,'flats');assert.equal(sync.hasPulledLevels(),true);
 assert.ok(manual.events.some(e=>e[0]==='switch'));assert.ok(manual.events.some(e=>e[0]==='respawn'));
 console.log(JSON.stringify({pass:true,sourceBytes:proof.sourceBytes,downloadBytes:proof.outputBytes,sourceBacked:proof.sourceBacked.length,
  retained:proof.retained,checks:'exact full-data comparison, authored variants, idempotent output, original retention, bounded fetch, atomic restore, quota/session preservation and actual startup/restore handlers'}));
}finally{await server.close();await rm(temp,{recursive:true,force:true});}
