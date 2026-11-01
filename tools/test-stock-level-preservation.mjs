import assert from 'node:assert/strict';
import {readFile,writeFile} from 'node:fs/promises';
import {gunzipSync} from 'node:zlib';
import {createServer} from 'vite';
const root=process.env.LEVEL_AUDIT_OUTPUT||'/private/tmp/level-preservation-audit';
const storage=new Map();let denyRecovery=false;
globalThis.localStorage={getItem:k=>storage.get(k)??null,setItem(k,v){if(denyRecovery&&k.includes('Recovery.'))throw Error('quota');storage.set(k,String(v));}};
globalThis.window={location:{search:'?lite'},addEventListener(){}};
const server=await createServer({configFile:false,appType:'custom',logLevel:'silent',optimizeDeps:{noDiscovery:true},server:{middlewareMode:true,hmr:false,ws:false,watch:null}});
const report={current:[],history:[],edits:0,recovery:[]};
try{
 const api=await server.ssrLoadModule('/src/level.ts');
 const {migrateCrateLayout}=await server.ssrLoadModule('/src/crateDimensions.ts');
 const {isPublishedStockLevel}=await server.ssrLoadModule('/src/stockLevelArchive.ts');
 const run=(entry,meta)=>{
  const builtin=api.BUILTIN_LEVELS.find(e=>e.id===entry.id);
  const ok=api.setUserLevels([entry]);
  if(!ok){assert.equal(!!builtin?.data,false,`${entry.id}: current stock rejected`);return {...meta,id:entry.id,status:'retired-invalid-archive'};}
  const saved=storage.get('solProtoUserLevels'),selected=api.findLevel(entry.id),stored=api.getUserLevels()[0];
  if(builtin?.data){
   assert.equal(selected,builtin,`${entry.id}: old stock won source selection`);
   assert.equal(api.isOverridden(entry.id),false);
   assert.deepEqual(stored.data,entry.data,`${entry.id}: archived data changed`);
   assert.equal(api.borrowedValidatedLevelData(stored.data),null,'archived geometry must not bypass current validation');
  }
  assert.equal(storage.get('solProtoUserLevels'),saved,'lookup wrote to storage');
  return {...meta,id:entry.id,status:builtin?.data?'source':builtin?'native-builder-override':'retired',selected:selected?.id??null};
 };
 if(!process.argv.includes('--fixtures-only'))for(const builtin of api.BUILTIN_LEVELS){
  if(!builtin.data){report.current.push({id:builtin.id,status:'native-builder'});continue;}
  const entry=JSON.parse(JSON.stringify(builtin));report.current.push(run(entry,{kind:'current'}));
  for(const edit of [e=>e.data.spawn[0]+=1e-10,e=>e.name='My course',e=>e.data.name='My course',e=>e.data.edgeGrindingRevision=1,e=>e.id='my-'+e.id]){
   const changed=structuredClone(entry);edit(changed);
   assert.equal(isPublishedStockLevel(changed),false,'authored fields must disqualify stock');
   assert.ok(api.setUserLevels([changed]),changed.id+': valid author edit rejected');
   assert.deepEqual(api.findLevel(changed.id).data,api.getUserLevels()[0].data,'local authoring lost');
   if(changed.id===builtin.id)assert.equal(api.isOverridden(changed.id),true);
   report.edits++;
  }
  assert.ok(api.setUserLevels([]));
  const change=api.prepareUserLevelChange(entry);assert.ok(change);
  assert.equal(api.commitPreparedUserLevelChange(change).accepted,true);
  assert.equal(api.isOverridden(entry.id),true,'deliberate save must pin even exact stock');
 }
 for(const file of ['stock-archive-ancient-gates.json.gz','stock-archive-rooftop.json.gz']){
  const entry=JSON.parse(gunzipSync(await readFile(new URL('./fixtures/'+file,import.meta.url))));
  run(entry,{kind:'fixture',file});
  if(file.includes('rooftop')){
   assert.equal(api.normalizeCustomLevelData(entry.data),null,'known bad archive must not weaken geometry validation');
   const changed=structuredClone(entry);changed.data.spawn[0]+=.01;
   assert.equal(api.setUserLevels([changed]),false,'unrecognized invalid data must still be rejected');
   assert.ok(api.getEditData(entry.id),'editor must resolve the valid current source');
  }
 }
 if(process.argv.includes('--history')){
  for(const [file,directory] of [['pack-history.json','snapshots'],['source-history.json','source-snapshots']]){
   const history=JSON.parse(await readFile(root+'/'+file,'utf8'));
   for(const [i,snapshot]of history.snapshots.entries()){
    const entry=JSON.parse(gunzipSync(await readFile(`${root}/${directory}/${snapshot.sha}.json.gz`)));
    const crates=structuredClone(entry);migrateCrateLayout(crates.data);
    const migrated={...structuredClone(entry),data:api.migrateCustomLevel(structuredClone(entry.data))};
    const noCrates={...structuredClone(entry),data:api.migrateCustomLevel(structuredClone(entry.data),{crateLayout:false})};
    for(const [kind,variant]of [['raw',entry],['crate',crates],['migrated',migrated],['without-crates',noCrates]])
     report.history.push(run(variant,{kind,sha:snapshot.sha,directory}));
    if(i%50===0)console.log(`${directory}: ${i+1}/${history.snapshots.length}`);
   }
  }
 }
 const minimal={id:'my-work',name:'My work',data:{v:1,name:'My work',spawn:[0,1,0],killY:-20,components:[{t:'platform',p:[0,-.5,0],s:[20,1,20]},{t:'gate',p:[0,0,-8]}]}};
 for(const [index,raw]of ['{broken',[minimal,{id:'unread',name:'Do not lose',data:{v:999,components:[]}}], [minimal,minimal]].map(v=>typeof v==='string'?v:JSON.stringify(v)).entries()){
  for(const denied of [false,true]){
   storage.clear();storage.set('solProtoUserLevels',raw);denyRecovery=denied;
   const fresh=await server.ssrLoadModule('/src/level.ts?preservation='+index+'-'+denied);
   const before=fresh.getUserLevels();assert.equal(storage.get('solProtoUserLevels'),raw,'reading rewrote a partial archive');
   if(denied){
    assert.equal(fresh.restoreUserLevels([minimal]),false);
    assert.deepEqual(fresh.getUserLevels(),before,'atomic restore lost the session');
    assert.equal(storage.get('solProtoUserLevels'),raw);
    assert.equal(fresh.setUserLevels([minimal]),false);
    assert.equal(fresh.getUserLevels()[0].id,'my-work','quota-failed edit cannot be exported');
    assert.equal(storage.get('solProtoUserLevels'),raw);
    denyRecovery=false;
   }
   assert.equal(fresh.setUserLevels([minimal]),true);
   const backups=[...storage.entries()].filter(([k])=>k.includes('Recovery.'));
   assert.equal(backups.length,1);assert.equal(backups[0][1],raw,'original bytes not preserved');
   assert.equal(fresh.setUserLevels([minimal]),true);
   assert.equal([...storage.keys()].filter(k=>k.includes('Recovery.')).length,1,'duplicate archive');
   report.recovery.push({index,quotaFailure:denied,pass:true});
  }
 }
 report.pass=true;
 console.log(JSON.stringify({pass:true,current:report.current.length,authoredEdits:report.edits,historical:report.history.length,recovery:report.recovery.length}));
}finally{
 if(process.argv.includes('--history'))await writeFile(root+'/selection-after.json',JSON.stringify(report,null,2)+'\n');
 await server.close();
}
