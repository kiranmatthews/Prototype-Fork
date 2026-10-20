import assert from 'node:assert/strict';
import {readFile,writeFile} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import {createServer} from 'vite';
import ts from 'typescript';

// The shared level import builds this geometry even when opening Slipstream.
// Supply the saved original source; never replace live game files to compare.
const baselinePath=process.argv[2];
if(!baselinePath)throw Error('Usage: node tools/waterslide-island/benchmark-tunnel-startup.mjs /path/to/original-hollowwake-descent.ts [report.json]');
const digest=value=>createHash('sha256').update(JSON.stringify(value)).digest('hex');
const reference=JSON.parse(await readFile(new URL('../fixtures/hollowwake-tunnel-baseline.json',import.meta.url),'utf8')).collision;
const server=await createServer({appType:'custom',logLevel:'silent',server:{middlewareMode:true,hmr:false,ws:false}});
try{
 const mod=await server.ssrLoadModule('/src/levels/hollowwake-descent.ts'),route=await server.ssrLoadModule('/src/levels/hollowwake-route.ts');
 const names=['HOLLOWWAKE_FORKS','hollowCentre','hollowPoint','hollowTangent','hollowRadius','hollowGapApplies','hollowGroup'];
 const methods={},calls={};
 const validate=result=>{assert.equal(digest(result.meshes),reference.collisionSha256);assert.equal(digest(result.tunnels),reference.tunnelsSha256);};
 for(const [variant,path]of Object.entries({before:baselinePath,after:new URL('../../src/levels/hollowwake-descent.ts',import.meta.url)})){
  const source=await readFile(path,'utf8'),ast=ts.createSourceFile('tunnel.ts',source,ts.ScriptTarget.Latest,true);
  const functions=ast.statements.filter(n=>ts.isFunctionDeclaration(n)&&['otherBoreDistance','tube'].includes(n.name?.text));assert.equal(functions.length,2);
  const code=ts.transpileModule(functions.map(n=>n.getText(ast)).join('\n'),{compilerOptions:{target:ts.ScriptTarget.ES2022,module:ts.ModuleKind.None}}).outputText;
  const compile=source=>new Function(...names,'HOLLOWWAKE_GAPS',`return function(specs){const C=[],HOLLOWWAKE_TUNNELS=[];let calls=0;${source}for(const {a,b,branch}of specs)tube(a,b,branch);return{meshes:C,tunnels:HOLLOWWAKE_TUNNELS,calls};}`)(...names.map(n=>route[n]),mod.HOLLOWWAKE_GAPS);
  assert.ok(code.includes('if (branch < 0)'),'locate the unchanged clearance query for counting');
  const counted=compile(code.replace('if (branch < 0)','calls++; if (branch < 0)'))(mod.HOLLOWWAKE_TUNNELS);validate(counted);calls[variant]=counted.calls;
  methods[variant]=compile(code);
 }
 for(let i=0;i<2;i++){methods.before(mod.HOLLOWWAKE_TUNNELS);methods.after(mod.HOLLOWWAKE_TUNNELS);}
 const rows=[];
 for(let round=0;round<6;round++)for(const variant of round%2?['after','before']:['before','after']){
  const start=performance.now(),result=methods[variant](mod.HOLLOWWAKE_TUNNELS),ms=performance.now()-start;
  validate(result);rows.push({round,variant,ms});
 }
 const median=variant=>{const a=rows.filter(r=>r.variant===variant).map(r=>r.ms).sort((a,b)=>a-b);return(a[2]+a[3])/2;};
 const report={reference,calls,rows,medianBeforeMs:median('before'),medianAfterMs:median('after')};
 if(process.argv[3])await writeFile(process.argv[3],JSON.stringify(report,null,2)+'\n');console.log(JSON.stringify(report));
}finally{await server.close();}
