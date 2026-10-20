import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import ts from 'typescript';
const source=await readFile(new URL('../src/contextResourceRecovery.ts',import.meta.url),'utf8');
const compiled=ts.transpileModule(source,{compilerOptions:{module:ts.ModuleKind.ESNext,target:ts.ScriptTarget.ES2022}}).outputText;
const {installContextResourceRecovery}=await import('data:text/javascript;base64,'+Buffer.from(compiled).toString('base64'));
const pairs=[['createBuffer','deleteBuffer'],['createTexture','deleteTexture'],['createFramebuffer','deleteFramebuffer'],['createRenderbuffer','deleteRenderbuffer'],['createProgram','deleteProgram'],['createShader','deleteShader'],['createVertexArray','deleteVertexArray'],['createQuery','deleteQuery'],['createSampler','deleteSampler'],['createTransformFeedback','deleteTransformFeedback'],['fenceSync','deleteSync']];
function fixture(supported=pairs){
 const canvas=new EventTarget(),handles=new WeakMap(),calls=[];
 let generation=0,lost=false;
 const gl={isContextLost:()=>lost};
 for(const [create,remove]of supported){
  gl[create]=function(...args){assert.equal(this,gl);calls.push({name:create,args});if(lost)return null;const handle={};handles.set(handle,{create,generation});return handle;};
  gl[remove]=function(handle,...args){assert.equal(this,gl);calls.push({name:remove,args:[handle,...args]});if(handle===null||lost)return;const owned=handles.get(handle);assert.ok(owned&&owned.create===create,'native rejects foreign/wrong-type handle');assert.equal(owned.generation,generation,'native rejects lost handle');};
 }
 return{gl,canvas,calls,lose(){lost=true;generation++;canvas.dispatchEvent(new Event('webglcontextlost'));},restore(){lost=false;canvas.dispatchEvent(new Event('webglcontextrestored'));}};
}
const a=fixture(),diagnostics=installContextResourceRecovery(a.canvas,a.gl),createBuffer=a.gl.createBuffer;
assert.equal(installContextResourceRecovery(a.canvas,a.gl),diagnostics);assert.equal(a.gl.createBuffer,createBuffer,'install is idempotent');
const first=pairs.map(([create])=>a.gl[create](1,2));
for(let i=0;i<pairs.length;i++){const remove=pairs[i][1];a.gl[remove](null);a.gl[remove](first[i],17);assert.deepEqual(a.calls.at(-1),{name:remove,args:[first[i],17]});}
// A synthetic event without an actual lost context must not invalidate handles.
a.canvas.dispatchEvent(new Event('webglcontextlost'));assert.equal(diagnostics().generation,0);a.gl.deleteBuffer(first[0]);
for(let round=1;round<=3;round++){
 const prior=pairs.map(([create])=>a.gl[create]());
 a.lose();a.canvas.dispatchEvent(new Event('webglcontextlost'));assert.equal(diagnostics().generation,round,'duplicate loss event cannot add a generation');
 for(const [create]of pairs)assert.equal(a.gl[create](),null,'null creation during loss is forwarded');
 a.restore();
 for(let i=0;i<pairs.length;i++){
  const [create,remove]=pairs[i],count=a.calls.length;
  a.gl[remove](prior[i]);a.gl[remove](first[i]);assert.equal(a.calls.length,count,'lost GPU storage needs no native delete');
  const fresh=a.gl[create](round);a.gl[remove](fresh);assert.equal(a.calls.at(-1).args[0],fresh,'current-generation cleanup still reaches native GL');
 }
}
assert.deepEqual(diagnostics(),{generation:3,skippedDeletes:pairs.length*6});
assert.throws(()=>a.gl.deleteTexture(a.gl.createBuffer()),/wrong-type/);
assert.throws(()=>a.gl.deleteBuffer({}),/foreign/);
const b=fixture(),otherDiagnostics=installContextResourceRecovery(b.canvas,b.gl);
assert.throws(()=>a.gl.deleteBuffer(b.gl.createBuffer()),/foreign/);
a.lose();a.restore();assert.equal(otherDiagnostics().generation,0,'contexts have independent generations');
const legacy=fixture(pairs.slice(0,6));installContextResourceRecovery(legacy.canvas,legacy.gl);
const old=legacy.gl.createBuffer();legacy.lose();legacy.restore();legacy.gl.deleteBuffer(old);
assert.equal(legacy.gl.createQuery,undefined,'unavailable APIs are not invented');
console.log('PASS lost-context resource ownership: 11 resource types, 3 resets, native/current/foreign/type checks, duplicate events, separate contexts and absent APIs.');
