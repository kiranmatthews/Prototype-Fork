import assert from 'node:assert/strict';
import {mkdir,writeFile} from 'node:fs/promises';
import {createRequire} from 'node:module';
import {homedir} from 'node:os';
import {join} from 'node:path';
const require=createRequire(import.meta.url);
let module;try{module=require.resolve('playwright');}catch{module=join(homedir(),'.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright/index.mjs');}
const {chromium}=await import(module),base=process.env.CARLISLE_URL||'http://127.0.0.1:5240';
const out=process.env.CARLISLE_OUTPUT||'docs/carlisle-bonus/parent-review';await mkdir(out,{recursive:true});
const browser=await chromium.launch({channel:'chrome',headless:true}),page=await browser.newPage({viewport:{width:1440,height:900}});
const errors=[],report={base,errors,turns:[]};page.on('pageerror',e=>errors.push(e.message));page.on('console',m=>{if(m.type()==='error')errors.push(m.text());});
try{
 await page.goto(`${base}/?playtest&level=test${process.argv.includes('--lite')?'&lite':''}`);
 await page.waitForFunction(()=>window.__game&&!window.__game.gameFlow.blocksGameplay,null,{timeout:180000});
 await page.evaluate(async()=>{const g=window.__game;g.restoreBuiltin('test');await g.switchLevel('test');g.campaign.startEphemeral();await g.getLevel().prepareJungleAssets();});
 await page.waitForFunction(()=>!window.__game.gameFlow.blocksGameplay,null,{timeout:180000});
 for(const [name,x,y] of [['west-turn',4,-19],['west-exit',16,-19],['east-approach',138.75,-16],['east-turn',152,-16]]){
  await page.evaluate(({x,y})=>{const g=window.__game,p=g.player;p.respawn(g.getLevel(),true,false,{position:p.pos.clone().set(x,y+.2,-1720),heading:p.camDir.clone().set(1,0,0)});p.invulnTimer=100;p.invulnSilent=true;p.lives=30;},{x,y});
  await page.waitForTimeout(1800);await page.evaluate(async()=>window.__game.getLevel().prepareJungleAssets());await page.waitForTimeout(250);
  const sample=await page.evaluate(()=>{const g=window.__game,p=g.player,l=g.getLevel(),target=p.pos.clone().add(p.pos.clone().set(0,1,0));
   const ray=p.raycaster,visible=[];l.root.traverse(o=>{if(!o.isMesh||o.userData.editorGhost)return;for(let a=o;a;a=a.parent)if(!a.visible)return;visible.push(o);});
   ray.set(g.camera.position,target.clone().sub(g.camera.position).normalize());ray.far=g.camera.position.distanceTo(target)-.5;
   const hits=ray.intersectObjects(visible,false);
   return{position:p.pos.toArray(),camera:g.camera.position.toArray(),grounded:p.grounded,occluders:hits.slice(0,3).map(h=>({name:h.object.name,kind:h.object.userData.jungleAsset,point:h.point.toArray()})),contacts:l.carlisleScenery.meshes.length,assets:l.jungleAssetDiagnostics};});
  await page.screenshot({path:`${out}/${name}.png`});report.turns.push({name,...sample});
  assert.equal(sample.grounded,true,`${name}: supported turn`);assert.equal(sample.occluders.length,0,`${name}: no scenery between camera and player`);
 }
 report.standing=await page.evaluate(()=>{
  const g=window.__game,p=g.player,l=g.getLevel(),ray=p.raycaster;
  let selected,mesh,mid;
  for(const candidate of l.carlisleScenery.meshes.filter(m=>m.name.includes('fractured toe'))){
   const box=candidate.geometry.boundingBox.clone().applyMatrix4(candidate.matrixWorld);mid=box.getCenter(p.pos.clone());const size=box.getSize(p.pos.clone());
   for(const dx of [-.2,0,.2])for(const dz of [-.2,0,.2]){
   ray.set(mid.clone().set(mid.x+size.x*dx,box.max.y+1,mid.z+size.z*dz),mid.clone().set(0,-1,0));ray.far=size.y+2;
   const hit=ray.intersectObject(candidate,false)[0];if(!hit)continue;
   const normal=hit.face.normal.clone().transformDirection(candidate.matrixWorld);if(normal.y<.94)continue;
   const body=box.clone().set(hit.point.clone().add(mid.clone().set(-.42,.08,-.42)),hit.point.clone().add(mid.clone().set(.42,1.7,.42)));
   if(l.walls.some(w=>w.intersectsBox(body))||l.carlisleScenery.resolve(hit.point,hit.point,.4,1.7))continue;
   let supported=true;
   for(const ox of [-.32,.32])for(const oz of [-.32,.32]){
    ray.set(hit.point.clone().add(mid.clone().set(ox,.3,oz)),mid.clone().set(0,-1,0));ray.far=.6;
    const ground=ray.intersectObjects(l.groundMeshes,false)[0];if(!ground||Math.abs(ground.point.y-hit.point.y)>.15)supported=false;
   }
   if(supported){selected=hit;mesh=candidate;break;}
   }
   if(selected)break;
  }
  if(!selected)throw Error('Missing standable visible rock face');
  const feet=selected.point.clone();p.respawn(l,true,false,{position:feet.clone().add(mid.clone().set(0,.2,0)),heading:mid.clone().set(0,0,-1)});p.invulnTimer=100;p.invulnSilent=true;
  return{name:mesh.name,feet:feet.toArray()};
 });
 await page.waitForTimeout(900);
 report.standing.after=await page.evaluate(()=>{const p=window.__game.player;return{position:p.pos.toArray(),grounded:p.grounded,surface:p.surfaceName};});
 assert.equal(report.standing.after.grounded,true,'player stands on scenery');
 assert.ok(Math.abs(report.standing.after.position[1]-report.standing.feet[1])<.1,'feet meet the exact displayed sandstone cap');
 await page.keyboard.down('ArrowUp');await page.waitForTimeout(200);await page.keyboard.up('ArrowUp');
 report.walked=await page.evaluate(()=>{const p=window.__game.player;return{position:p.pos.toArray(),grounded:p.grounded};});
 assert.ok(Math.hypot(report.walked.position[0]-report.standing.after.position[0],report.walked.position[2]-report.standing.after.position[2])>.1,'real input moves along the scenery');
 await page.screenshot({path:`${out}/walkable-sandstone.png`});
 assert.deepEqual(errors,[]);
 console.log(JSON.stringify({turns:report.turns.map(t=>({name:t.name,occluders:t.occluders,contacts:t.contacts})),standing:report.standing,walked:report.walked,errors}));
}finally{await writeFile(`${out}/report.json`,JSON.stringify(report,null,2)+'\n');await browser.close();}
