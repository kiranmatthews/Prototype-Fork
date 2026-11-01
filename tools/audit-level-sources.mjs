// Read source-owned level definitions directly from immutable Git revisions.
// No checkout, worktree, authored source or published pack is changed.
import {execFileSync} from 'node:child_process';
import {createHash} from 'node:crypto';
import {createRequire} from 'node:module';
import {mkdir,readFile,writeFile} from 'node:fs/promises';
import path from 'node:path';
import {gzipSync} from 'node:zlib';
import {build} from 'esbuild';
import ts from 'typescript';

const out=process.env.LEVEL_AUDIT_OUTPUT||'/private/tmp/level-preservation-audit';
const require=createRequire(import.meta.url),hash=text=>createHash('sha256').update(text).digest('hex');
const git=(...args)=>execFileSync('git',args,{maxBuffer:192*1024*1024});
const blobs=new Map(),snapshots=new Map(),results=[];
let cachedBytes=0;
globalThis.window={location:{search:'?lite'},addEventListener(){}};
globalThis.localStorage={getItem(){return null;},setItem(){}};
await mkdir(out+'/source-snapshots',{recursive:true});
const history=process.argv.includes('--history');
let revisions=process.argv.filter(a=>/^[a-f0-9]{7,40}$/.test(a));
if(history){
  const runs=(await readFile(out+'/all-deployments.jsonl','utf8')).trim().split('\n').map(line=>JSON.parse(line));
  revisions=[...new Set(runs.filter(r=>r.conclusion==='success').sort((a,b)=>a.created_at.localeCompare(b.created_at)).map(r=>r.head_sha))];
}
if(!revisions.length)revisions=[git('rev-parse','HEAD').toString().trim()];
let previous=null;
for(const [at,revision]of revisions.entries()){
  const tree=new Map(git('ls-tree','-r','-z',revision).toString().split('\0').filter(Boolean).map(line=>{
    const [meta,name]=line.split('\t');return [name,meta.split(' ')[2]];
  }));
  const content=name=>{
    const oid=tree.get(name);if(!oid)throw Error('Missing Git source '+name);
    if(!blobs.has(oid)){
      const text=git('cat-file','blob',oid).toString();
      while(cachedBytes+text.length>64*1024*1024&&blobs.size){
        const first=blobs.keys().next().value;cachedBytes-=blobs.get(first).length;blobs.delete(first);
      }
      blobs.set(oid,text);cachedBytes+=text.length;
    }
    return blobs.get(oid);
  };
  if(!tree.has('src/level.ts')){results.push({revision,status:'pre-source-registry'});continue;}
  const source=content('src/level.ts'),ast=ts.createSourceFile('level.ts',source,ts.ScriptTarget.Latest,true);
  let declaration;
  for(const statement of ast.statements)if(ts.isVariableStatement(statement))
    for(const variable of statement.declarationList.declarations)if(variable.name.getText(ast)==='BUILTIN_LEVELS')declaration=variable;
  if(!declaration?.initializer){results.push({revision,status:'pre-source-registry'});continue;}
  const initializer=declaration.initializer.getText(ast),used=new Set();
  const visit=node=>{if(ts.isIdentifier(node))used.add(node.text);ts.forEachChild(node,visit);};visit(declaration.initializer);
  const imports=[];
  for(const statement of ast.statements){
    if(!ts.isImportDeclaration(statement)||!statement.importClause)continue;
    const clause=statement.importClause,bindings=clause.namedBindings;
    const names=[clause.name?.text,...(bindings&&ts.isNamedImports(bindings)?bindings.elements.map(e=>e.name.text):bindings?[bindings.name.text]:[])];
    if(names.some(name=>used.has(name)))imports.push(statement.getText(ast));
  }
  const entry=imports.join('\n')+'\nexport const levels='+initializer+';';
  if(previous?.entry===entry&&previous.inputs.every(([name,oid])=>tree.get(name)===oid)){
    results.push({revision,status:'unchanged',sameAs:previous.revision});continue;
  }
  const inputs=new Set();
  try{
    const bundled=await build({entryPoints:['audit:entry'],bundle:true,format:'cjs',platform:'node',write:false,logLevel:'silent',plugins:[{
      name:'immutable-git-sources',setup(b){
        b.onResolve({filter:/^audit:entry$/},()=>({path:'src/__level_audit.ts',namespace:'git'}));
        b.onResolve({filter:/.*/,namespace:'git'},args=>{
          if(!args.path.startsWith('.'))return {path:args.path,external:true};
          const stem=path.posix.normalize(path.posix.join(path.posix.dirname(args.importer),args.path));
          const name=[stem,stem+'.ts',stem+'.js',stem+'.json',stem+'/index.ts',stem+'/index.js'].find(p=>tree.has(p));
          if(!name)throw Error('Missing '+args.path+' from '+args.importer);
          return {path:name,namespace:'git'};
        });
        b.onLoad({filter:/.*/,namespace:'git'},args=>{
          if(args.path==='src/__level_audit.ts')return {contents:entry,loader:'ts'};
          inputs.add(args.path);return {contents:content(args.path),loader:args.path.endsWith('.json')?'json':'ts'};
        });
      }
    }]});
    const module={exports:{}};new Function('require','module','exports',bundled.outputFiles[0].text)(require,module,module.exports);
    const entries=[];
    for(const level of module.exports.levels){
      if(!level.data){entries.push({id:level.id,name:level.name,kind:'builder'});continue;}
      const json=JSON.stringify(level),sha=hash(json);
      let record=snapshots.get(sha);
      if(!record){record={sha,id:level.id,name:level.name,components:level.data.components.length,revisions:[]};snapshots.set(sha,record);await writeFile(out+'/source-snapshots/'+sha+'.json.gz',gzipSync(json));}
      record.revisions.push(revision);entries.push({id:level.id,sha});
    }
    const dependencies=[...inputs].map(name=>[name,tree.get(name)]);
    previous={entry,inputs:dependencies,revision};
    results.push({revision,status:'evaluated',inputs:dependencies,entries});
  }catch(error){results.push({revision,status:'error',error:String(error)});previous=null;}
  await writeFile(out+'/source-history'+(history?'':'-candidate')+'.json',JSON.stringify({results,snapshots:[...snapshots.values()]},null,2)+'\n');
  console.log(JSON.stringify({at:at+1,total:revisions.length,revision:revision.slice(0,8),status:results.at(-1).status,unique:snapshots.size,...(results.at(-1).status==='error'?{error:results.at(-1).error}:{})}));
}
await writeFile(out+'/source-history'+(history?'':'-candidate')+'.json',JSON.stringify({results,snapshots:[...snapshots.values()]},null,2)+'\n');
console.log(JSON.stringify({complete:true,revisions:results.length,evaluated:results.filter(r=>r.status==='evaluated').length,errors:results.filter(r=>r.status==='error').length,snapshots:snapshots.size}));
