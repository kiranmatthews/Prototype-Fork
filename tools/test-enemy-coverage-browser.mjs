// Audit every source level, synced pack entry and editor route with real GLBs.
// A Vite URL is required for the source-catalog pass; all UI runs use real main.ts.
import assert from 'node:assert/strict';
import {mkdir,readFile,writeFile} from 'node:fs/promises';
const {chromium}=await import(process.env.PLAYWRIGHT_MODULE||'playwright');
const base=process.argv[2]||'http://127.0.0.1:5197/';
const output=process.env.ENEMY_COVERAGE_OUTPUT||'/private/tmp/enemy-coverage';await mkdir(output,{recursive:true});
const manifest=JSON.parse(await readFile(new URL('../public/enemies/manifest.json',import.meta.url),'utf8'));
const browser=await chromium.launch({headless:true,channel:'chrome'}),rows=[],errors=[];
try{
 const page=await browser.newPage({viewport:{width:1280,height:720}});
 page.on('pageerror',e=>errors.push(String(e)));page.on('console',m=>{if(m.type()==='error')errors.push(m.text());});
 await page.addInitScript(()=>{localStorage.setItem('solProtoEditUnlocked','1');});
 await page.goto(new URL('?lite&playtest&level=jungle',base).href);
 await page.waitForFunction(()=>window.__game?.getLoadingDiagnostics().pending.length===0,null,{timeout:120000});
 await page.evaluate(()=>{window.__game.player.step=()=>{};});
 const catalog=await page.evaluate(async()=>{const {BUILTIN_LEVELS}=await import('/src/level.ts');
   const pack=await(await fetch('./levels.json')).json();window.__enemyEntries=[...BUILTIN_LEVELS.map(entry=>({source:'builtin',entry})),...pack.levels.map(entry=>({source:'synced',entry}))];
   return window.__enemyEntries.map(({source,entry})=>({source,id:entry.id}));});
 for(let index=0;index<catalog.length;index++)for(const editor of [false,true]){
  const row=await page.evaluate(async({index,editor})=>{
   const {Level,setEditorBuild}=await import('/src/level.ts');const {source,entry}=window.__enemyEntries[index],g=window.__game;
   const scene=new g.scene.constructor();for(const light of g.scene.children.filter(o=>o.isLight)){const copy=light.clone();copy.castShadow=false;scene.add(copy);}
   setEditorBuild(editor);let level;
   try{
    level=new Level(scene,entry);await level.prepareJungleAssets();scene.updateMatrixWorld(true);
    const actors=level.enemies.map(e=>{let triangles=0,primitiveBoxes=0;const meshes=[];
     e.group.traverse(o=>{if(o.isMesh){triangles+=(o.geometry.index?.count??o.geometry.attributes.position.count)/3;meshes.push(o.name);if(o.geometry.type==='BoxGeometry')primitiveBoxes++;}});
     return {kind:e.kind,status:e.visual.diagnostics.status,url:e.visual.diagnostics.url,meshes,triangles,primitiveBoxes};});
    const camera=g.camera.clone();for(const enemy of level.enemies){camera.position.copy(enemy.group.position).add({x:2.7,y:1.8,z:3.7});camera.lookAt(enemy.group.position.x,enemy.group.position.y+.6,enemy.group.position.z);g.renderer.render(scene,camera);}
    const capture=level.captureData();
    return {source,id:entry.id,editor,actors,capturedKinds:capture.components.filter(c=>c.t==='enemy').map(c=>c.foe??'grunt'),glError:g.renderer.getContext().getError()};
   }finally{level?.dispose();setEditorBuild(false);}
  },{index,editor});
  assert.equal(row.glError,0);
  for(const actor of row.actors){const expected=manifest.enemies.find(e=>e.kind===actor.kind);assert.ok(expected);assert.equal(actor.status,'ready',`${row.id}/${actor.kind}`);assert.equal(actor.triangles,expected.triangles);assert.equal(actor.primitiveBoxes,0);assert.ok(actor.url.includes(`enemies/${actor.kind}.glb`));}
  assert.deepEqual(row.capturedKinds.sort(),row.actors.map(a=>a.kind).sort(),`${row.id} lost enemy identity in capture`);
  rows.push(row);console.log(`${row.source} ${row.id} ${editor?'editor':'play'}: ${row.actors.length} generated enemies verified`);
 }
 // Real editor preview, actual ADD buttons, committed play and an imported copy.
 await page.keyboard.press('KeyM'); // normal developer chrome owns editor visibility
 const editorResult=await page.evaluate(async()=>{
  const g=window.__game;g.openEditor('jungle');await g.editor.getLevel().prepareJungleAssets();
  const jungle=g.editor.getLevel().enemies.map(e=>e.visual.diagnostics.status);
  g.ui.onSideTab();
  const id=g.saveUserLevel({id:'enemy-coverage-palette',name:'Enemy coverage',data:{v:1,name:'Enemy coverage',spawn:[0,.1,8],killY:-20,components:[{t:'platform',p:[0,-.5,0],s:[80,1,100]},{t:'gate',p:[0,0,-40]}]}});
  g.switchLevel(id);g.openEditor(id);g.editor.setPop('add');return{jungle,id};
 });
 assert.equal(editorResult.jungle.length,8);assert.ok(editorResult.jungle.every(s=>s==='ready'));
 for(const [index,enemy] of manifest.enemies.entries()){
  await page.evaluate(index=>window.__game.editor.controls.target.set((index-3.5)*3,0,-12),index);
  const button=page.getByRole('button',{name:`${enemy.name} (${enemy.kind})`,exact:true});
  await button.scrollIntoViewIfNeeded();await button.locator('img').evaluate(image=>image.decode());
  await button.click();await page.evaluate(()=>window.__game.editor.getLevel().prepareJungleAssets());
 }
 await page.screenshot({path:output+'/editor-roster.png'});
 const roundtrip=await page.evaluate(async()=>{
  const g=window.__game,preview=g.editor.getLevel(),data=JSON.parse(JSON.stringify(preview.captureData()));
  const editor=preview.enemies.map(e=>({kind:e.kind,status:e.visual.diagnostics.status}));
  g.ui.onSideTab();await g.getLevel().prepareJungleAssets();const play=g.getLevel().enemies.map(e=>({kind:e.kind,status:e.visual.diagnostics.status}));
  const imported=g.saveUserLevel({id:'enemy-coverage-import',name:'Imported enemy coverage',data});g.switchLevel(imported);await g.getLevel().prepareJungleAssets();
  return{editor,play,imported:g.getLevel().enemies.map(e=>({kind:e.kind,status:e.visual.diagnostics.status}))};
 });
 for(const phase of Object.values(roundtrip)){assert.equal(phase.length,8);assert.ok(phase.every(e=>e.status==='ready'));assert.equal(new Set(phase.map(e=>e.kind)).size,8);}
 rows.push({route:'real-editor-and-import',...roundtrip});assert.deepEqual(errors,[]);
 console.log('PASS all native/synced levels in play/editor, capture identity, real palette placement, commit and import.');
}finally{await writeFile(output+'/results.json',JSON.stringify({base,rows,errors},null,2));await browser.close();}
