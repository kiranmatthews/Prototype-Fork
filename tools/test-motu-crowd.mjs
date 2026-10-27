import assert from 'node:assert/strict';
import {execFileSync} from 'node:child_process';
import {writeFile} from 'node:fs/promises';
import {createServer} from 'vite';
import * as THREE from 'three';
import ts from 'typescript';

// Compare the optional-layout refactor directly with the immutable release
// implementation, including every vertex, instance transform and colour.
const baseline=execFileSync('git',['show','37b69e6524faa1b448772b18107c818aac3a43f8:src/golf-cart/stadiumCrowd.ts'],{encoding:'utf8'})
  .replaceAll("'./","'/src/golf-cart/").replaceAll("'../","'/src/");
const server=await createServer({appType:'custom',logLevel:'silent',server:{middlewareMode:true},plugins:[{
  name:'motu-crowd-baseline',resolveId(id){if(id==='motu-crowd-baseline')return '\0motu-crowd-baseline.ts';},
  load(id){if(id==='\0motu-crowd-baseline.ts')return ts.transpileModule(baseline,{compilerOptions:{target:ts.ScriptTarget.ES2022,module:ts.ModuleKind.ESNext}}).outputText;},
}]});
let before,after;
try{
  const {StadiumCrowd:Previous}=await server.ssrLoadModule('motu-crowd-baseline');
  const {StadiumCrowd}=await server.ssrLoadModule('/src/golf-cart/stadiumCrowd.ts');
  before=new Previous();after=new StadiumCrowd();
  assert.equal(before.count,32958);assert.equal(after.count,before.count);
  assert.equal(after.root.children.length,before.root.children.length);
  for(let i=0;i<before.root.children.length;i++){
    const a=before.root.children[i],b=after.root.children[i];assert.equal(b.name,a.name);
    assert.deepEqual(b.instanceMatrix.array,a.instanceMatrix.array);
    assert.deepEqual(b.instanceColor?.array,a.instanceColor?.array);
    for(const key of Object.keys(a.geometry.attributes))assert.deepEqual(b.geometry.attributes[key].array,a.geometry.attributes[key].array);
    assert.deepEqual(b.geometry.index.array,a.geometry.index.array);
  }
  const shaderA={uniforms:{},vertexShader:''},shaderB={uniforms:{},vertexShader:''};
  before.sections[0].material.onBeforeCompile(shaderA);after.sections[0].material.onBeforeCompile(shaderB);
  assert.equal(shaderB.vertexShader,shaderA.vertexShader);
  const versions=after.sections.map(m=>m.instanceMatrix.version);after.update(12);after.update(200);
  assert.deepEqual(after.sections.map(m=>m.instanceMatrix.version),versions);
  const report={passed:true,spectators:after.count,sections:after.sections.length,geometryIdentical:true,placementsIdentical:true,coloursIdentical:true,animationShaderIdentical:true};
  await writeFile('/private/tmp/motu-crowd-regression.json',JSON.stringify(report,null,2));console.log(JSON.stringify(report));
}finally{before?.dispose();after?.dispose();await server.close();}
