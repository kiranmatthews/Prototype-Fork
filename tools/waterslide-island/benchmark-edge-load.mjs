import {readFile,mkdir,writeFile} from 'node:fs/promises';
import assert from 'node:assert/strict';
import ts from 'typescript';
const baselinePath=process.argv[2];
if(!baselinePath)throw Error('Usage: node tools/waterslide-island/benchmark-edge-load.mjs /path/to/baseline-level.ts [local-preview-url]');
const base=(process.argv[3]||'http://127.0.0.1:5348').replace(/\/$/,'');
const source=await readFile(baselinePath,'utf8'),ast=ts.createSourceFile('old.ts',source,ts.ScriptTarget.Latest,true);
const owner=ast.statements.find(n=>ts.isClassDeclaration(n)&&n.name?.text==='Level');
const method=owner.members.find(n=>n.name?.getText(ast)==='systemicEdgeAlreadyAuthored').getText(ast);
const compiled=ts.transpileModule(method.replace('private systemicEdgeAlreadyAuthored','function systemicEdgeAlreadyAuthored'),{compilerOptions:{target:ts.ScriptTarget.ES2022}}).outputText;
// Only the test response changes. The original distance predicate needs Vector3;
// use the actual input vector constructor without adding a second Three instance.
const original=compiled.replace('function systemicEdgeAlreadyAuthored','systemicEdgeAlreadyAuthored').replaceAll('new THREE.Vector3()','new start.constructor()');
const {chromium}=await import(process.env.PLAYWRIGHT_MODULE||'playwright'),output=process.env.ISLAND_EDGE_LOAD_OUTPUT||'/private/tmp/slipstream-edge-load-pairs';await mkdir(output,{recursive:true});
const browser=await chromium.launch({channel:'chrome',headless:true}),rows=[];
try{
 for(const [i,variant]of ['before','after','after','before','before','after'].entries()){
  const context=await browser.newContext({viewport:{width:1280,height:720},serviceWorkers:'block'}),page=await context.newPage(),errors=[];let patches=0;
  page.on('pageerror',e=>errors.push(e.message));page.on('console',m=>{if(m.type()==='error')errors.push(m.text());});
  await page.route('**/assets/level-*.js',async route=>{
   const response=await route.fetch();let body=await response.text();
   const pattern=/systemicEdgeAlreadyAuthored\([^)]*\)\{[\s\S]*?\}(?=buildSystemicSurfaceEdgeRails\(\)\{)/;
   assert.equal([...body.matchAll(new RegExp(pattern.source,'g'))].length,1,'production coverage method must be found exactly once');
   if(variant==='before')body=body.replace(pattern,original);
   patches++;await route.fulfill({response,body});
  });
  await page.addInitScript(()=>{window.loadTasks=[];new PerformanceObserver(list=>{for(const e of list.getEntries())window.loadTasks.push(e.duration);}).observe({type:'longtask',buffered:true});});
  const start=Date.now();await page.goto(base+'/?playtest&level=slipstream-race',{timeout:180000});
  await page.waitForFunction(()=>window.__game?.getSkateRace()?.active&&!window.__game.gameFlow.blocksGameplay,null,{timeout:180000});
  const readyMs=Date.now()-start;
  const state=await page.evaluate(()=>{const g=window.__game,l=g.getLevel();return{rails:l.surfaceEdgeRails.length,gl:g.renderer.getContext().getError(),longTasks:window.loadTasks};});
  const row={i,variant,readyMs,patches,errors,...state};rows.push(row);console.log(JSON.stringify(row));
  await writeFile(output+'/report.json',JSON.stringify(rows,null,2));assert.equal(patches,1);assert.equal(state.rails,1640);assert.equal(state.gl,0);assert.deepEqual(errors,[]);
  await context.close();
 }
}finally{await browser.close();}
