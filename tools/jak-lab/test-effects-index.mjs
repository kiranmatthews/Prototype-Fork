import assert from 'node:assert/strict';
import {readFileSync,writeFileSync} from 'node:fs';
import {createRequire} from 'node:module';
import ts from 'typescript';

const nativeRequire=createRequire(import.meta.url),cache=new Map();
function load(name) {
  if(cache.has(name))return cache.get(name).exports;
  const module={exports:{}};cache.set(name,module);
  const source=readFileSync(new URL(`../../src/jak-lab/${name}.ts`,import.meta.url),'utf8');
  const js=ts.transpileModule(source,{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText;
  new Function('require','module','exports',js)(id=>id.startsWith('./')?load(id.slice(2)):nativeRequire(id),module,module.exports);
  return module.exports;
}
const {effectExhibits}=load('exhibits'),{effectCategories}=load('effectCategories');
const args=process.argv.slice(2),option=name=>args.includes(name)?args[args.indexOf(name)+1]:undefined;
const catalogue=JSON.parse(readFileSync(option('--catalogue'),'utf8')),before=JSON.stringify(catalogue);
const exhibits=effectExhibits(catalogue),categories=new Set(effectCategories.map(c=>c.id));
assert.ok(exhibits.length>700);
assert.ok(exhibits.every(e=>e.kind==='effect'&&!e.id.startsWith('model:')));
assert.ok(exhibits.every(e=>!e.model||e.death&&!e.model.background));
assert.ok(exhibits.every(e=>e.categories.length&&e.categories.every(c=>categories.has(c))));
assert.equal(new Set(exhibits.map(e=>e.id)).size,exhibits.length);
assert.equal(JSON.stringify(catalogue),before);
const byName=pattern=>exhibits.find(e=>pattern.test(e.name));
assert.ok(byName(/^eco green$/).categories.includes('eco'));
assert.ok(byName(/crate explode$/).categories.includes('impact'));
assert.ok(byName(/waterfall/).categories.includes('water'));
assert.ok(byName(/run poof sand/).categories.includes('movement'));
assert.ok(byName(/Health meter/).categories.includes('hud'));
assert.ok(byName(/sagecage bars/).categories.includes('light'));
assert.ok(!byName(/^white eco$/).categories.includes('impact'),'White is not a hit effect');
assert.ok(!byName(/training waterfall/).categories.includes('nature'),'Training is not rain');
assert.ok(!byName(/light eco mother$/).categories.includes('nature'),'Mother is not a moth');
assert.ok(byName(/mother spider leg socket/).categories.includes('creature'));
const legacy=structuredClone(catalogue);legacy.models.push({id:'removed-static-object',name:'removed-static-object',area:'common',background:false});
assert.deepEqual(effectExhibits(legacy),exhibits,'Legacy model entries must not become exhibits');
const report={status:'PASS',exhibits:exhibits.length,standaloneModels:0,scenes:0,
  categories:effectCategories.map(c=>({...c,count:exhibits.filter(e=>e.categories.includes(c.id)).length})),
  other:exhibits.filter(e=>e.categories.includes('other')).map(e=>({id:e.id,name:e.name,source:e.effect?.source.file})),
  checks:['effects only with old and scoped catalogues','all categories valid','source data immutable','unique IDs','representative semantic categories']};
if(option('--output'))writeFileSync(option('--output'),JSON.stringify(report,null,2)+'\n');
console.log(JSON.stringify({...report,other:report.other.map(e=>`${e.id}: ${e.name}`)},null,2));
