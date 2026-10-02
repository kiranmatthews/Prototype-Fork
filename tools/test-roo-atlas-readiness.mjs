import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import vm from 'node:vm';
import ts from 'typescript';

const listeners=new Map(),requests=[];
let offline=true,decodes=0;
class Image {
  naturalWidth=0;naturalHeight=0;
  set src(url){
    this.url=url;requests.push(url);
    queueMicrotask(()=>{
      const fail=offline&&url.includes('counter')&&(url.includes('-light1')||!url.includes('cap256'));
      if(fail)this.onerror?.();
      else{this.naturalWidth=512;this.naturalHeight=512;this.onload?.();}
    });
  }
  get src(){return this.url;}
  async decode(){decodes++;await Promise.resolve();}
}
const source=(await readFile(new URL('../src/roo-type/atlas.ts',import.meta.url),'utf8'))
  .replace(/^import .*$/gm,'').replace(/^export /gm,'').replaceAll('import.meta.env.BASE_URL',"''");
const context=vm.createContext({Image,Map,Set,Promise,Event,queueMicrotask,setTimeout,clearTimeout,
  window:{addEventListener:(type,handler)=>listeners.set(type,handler),dispatchEvent(){}},
  displayAtlasCap:()=>128,ROO_ATLAS_METRICS:{bonus:{version:10,lightFrames:3},counter:{version:10,lightFrames:3}},
  trackPresentationImage(){},getRooAppearance:()=>({tracking:0}),rooLightPosition:()=>0,rooLightWeights:()=>[1,0,0]});
vm.runInContext(ts.transpileModule(source,{compilerOptions:{target:ts.ScriptTarget.ES2020,module:ts.ModuleKind.None}}).outputText,context);
await vm.runInContext('loadRooAtlases()',context);
let state=vm.runInContext('rooAtlasDiagnostics()',context);
assert.equal(state.ready,true);assert.equal(state.degraded,true);assert.equal(state.revision,1);
assert.ok(decodes>=5,'publish must await loaded pixel decodes');
assert.equal(vm.runInContext("rooAtlasUrl('counter',0)",context),'fonts/roo-counter-v10-cap256.png');
assert.equal(vm.runInContext("rooAtlasUrl('counter',1)",context),'fonts/roo-counter-v10-cap256.png','missing shimmer must reuse readable neutral pixels');
assert.ok(requests.includes('fonts/roo-counter-v10-cap128.png'));
offline=false;
await listeners.get('online')();
state=vm.runInContext('rooAtlasDiagnostics()',context);
assert.equal(state.ready,true);assert.equal(state.degraded,false);assert.equal(state.revision,2);
assert.equal(vm.runInContext("rooAtlasUrl('counter',1)",context),'fonts/roo-counter-v10-light1-cap128.png','online recovery must restore the complete atlas');
console.log('PASS decoded PNG publication, alternate neutral resolution, optional-light fallback and online recovery.');
