import assert from 'node:assert/strict';
import fs from 'node:fs';
const { chromium } = await import(process.env.PLAYWRIGHT_MODULE || 'playwright');
const out=process.env.SIDE_CAMERA_OUTPUT || '/private/tmp/side-camera-review';fs.mkdirSync(out,{recursive:true});
const base=process.argv[2]||'http://127.0.0.1:5317/';const browser=await chromium.launch({headless:true,channel:'chrome'});const reports=[],errors=[];
try{
 for(const id of ['crate-primer','switchyard','clockwork-gauntlet','bonus-jungle-terraces']){
  const page=await browser.newPage({viewport:{width:390,height:844}});page.on('pageerror',e=>errors.push(String(e)));page.on('console',m=>{if(m.type()==='error')errors.push(m.text());});
  await page.goto(base+`?playtest&level=${id}&lite`);await page.waitForFunction(()=>window.__game&&!window.__game.gameFlow.blocksGameplay,null,{timeout:120000});await page.waitForTimeout(500);
  const row=await page.evaluate(()=>{const g=window.__game,p=g.player,c=p.cam,l=g.getLevel();return{id:g.getCurrentLevel().id,state:p.state,grounded:p.grounded,eye:c.position.toArray(),position:p.pos.toArray(),feet:p.pos.clone().project(c).toArray(),head:p.pos.clone().add(p.pos.clone().set(0,2.8,0)).project(c).toArray(),fov:c.fov,views:l.cameraViews,route:l.laneDirAt(p.pos.x,p.pos.y,p.pos.z)};});
  assert.equal(row.id,id,'requested side-scroll was not loaded');assert.ok(row.grounded);assert.ok(Math.abs(row.feet[0])<1&&row.feet[1]>-1&&row.head[1]<1,JSON.stringify(row));
  const range=Math.hypot(row.eye[0]-row.position[0],row.eye[1]-row.position[1]-1.3,row.eye[2]-row.position[2]);assert.ok(range<8,`${id}: still zoomed out ${range}`);
  reports.push({...row,range});await page.screenshot({path:`${out}/portrait-${id}.png`});await page.close();
 }
 assert.deepEqual(errors,[]);console.log('PASS',JSON.stringify(reports));
}finally{fs.writeFileSync(out+'/results.json',JSON.stringify({base,reports,errors},null,2));await browser.close();}
