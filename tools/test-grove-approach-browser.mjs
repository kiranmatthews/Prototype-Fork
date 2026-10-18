import assert from 'node:assert/strict';
import {writeFile} from 'node:fs/promises';
const {chromium}=await import(process.env.PLAYWRIGHT_MODULE||'playwright');
const base=process.argv.find(a=>a.startsWith('http'))??'http://127.0.0.1:5259';
const browser=await chromium.launch({channel:'chrome',headless:true}),page=await browser.newPage({viewport:{width:1440,height:900}}),errors=[],report={};
page.on('pageerror',e=>errors.push(e.message));page.on('console',m=>{if(m.type()==='error')errors.push(m.text());});
try{
 await page.goto(`${base}/?playtest&level=jungle-minefield`,{timeout:60000});
 await page.waitForFunction(()=>window.__game?.getCurrentLevel().id==='jungle-minefield'&&!window.__game.gameFlow.blocksGameplay,null,{timeout:60000});
 await page.evaluate(async()=>{const g=window.__game;await Promise.all([g.getLevel().prepareJungleAssets(),g.player.preparePresentationAssets()]);});
 await page.screenshot({path:'/private/tmp/grove-revision-tunnel.png'});
 const pose=async(s,x=0)=>{
  await page.evaluate(({s,x})=>{const g=window.__game,V=g.player.pos.constructor;g.player.respawn(g.getLevel(),true,false,{position:new V(x,.1,-s),heading:new V(0,0,-1)});},{s,x});
  await page.waitForFunction(()=>window.__game.player.grounded);await page.waitForTimeout(700);
 };
 report.clues=[];
 for(const id of [1,2,5,6,7]){
  const field=await page.evaluate(id=>window.__game.getLevel().minefields.data.find(f=>f.id===id),id),start=-field.p[2]-field.s[1]/2;
  if(id===2){await pose(start-40);await page.screenshot({path:'/private/tmp/grove-expanded-camp.png'});}
  const clueS=await page.evaluate(id=>-window.__game.getLevel().captureData().components.find(c=>c.dkind===`groveclue${id}`).p[2],id);
  await pose(clueS-2);
  await page.screenshot({path:`/private/tmp/grove-revision-clue-${id}.png`});
  await pose(start-6);
  const bounds=await page.evaluate(id=>{
   const g=window.__game,V=g.player.pos.constructor,c=g.getLevel().captureData().components.find(c=>c.dkind===`groveclue${id}`),a=c.yaw*Math.PI/180;
   const world=[-.5,.5].flatMap(x=>[0,1].map(y=>new V(c.p[0]+x*c.s[0]*Math.cos(a),c.p[1]+y*c.s[1],c.p[2]-x*c.s[0]*Math.sin(a))));
   const behindCamera=world.every(p=>p.clone().applyMatrix4(g.camera.matrixWorldInverse).z>=-g.camera.near);
   const points=world.map(p=>p.project(g.camera));
   return{left:Math.min(...points.map(p=>p.x)),right:Math.max(...points.map(p=>p.x)),behindCamera};
  },id);
  assert.ok(bounds.behindCamera||bounds.right<-.55,`clue ${id} overlaps the central field view`);report.clues.push({id,...bounds});
  if(id===1)await page.screenshot({path:'/private/tmp/grove-revision-first-field.png'});
 }
 const start=await page.evaluate(()=>{const f=window.__game.getLevel().minefields.data[0];return-f.p[2]-f.s[1]/2;});
 await pose(start-1,2.3);
 await page.evaluate(start=>{
  const g=window.__game,p=g.player,V=p.pos.constructor,burst=g.puffs.burst.bind(g.puffs);
  window.groveBlasts=[];
  g.puffs.burst=(name,x,y,z,options)=>{burst(name,x,y,z,options);if(name==='boomTnt')window.groveBlasts.push({x,y,z,nearby:g.puffs.pool.filter(p=>p.live&&p.pos.distanceTo(new V(x,y,z))<2).length});};
  p.pos.set(2.3,.01,-start-.35);p.prevPos.copy(p.pos);p.settle(g.getLevel());
 },start);
 await page.waitForFunction(()=>window.groveBlasts?.length>0);
 report.blast=await page.evaluate(()=>({first:window.groveBlasts[0],state:window.__game.player.state,fields:window.__game.getLevel().minefields.fields.filter(f=>f.detonated).map(f=>f.data.id)}));
 assert.ok(Math.abs(report.blast.first.x-2.3)<.05);assert.ok(Math.abs(report.blast.first.z+start+.35)<.05);
 assert.ok(report.blast.first.nearby>=5,'contact blast was starved by remote effects');assert.deepEqual(report.blast.fields,[1]);assert.equal(report.blast.state,'dead');
 await page.screenshot({path:'/private/tmp/grove-revision-contact-blast.png'});
 assert.deepEqual(errors,[]);report.pass=true;
}finally{await writeFile('/private/tmp/grove-approach-review.json',JSON.stringify({...report,errors},null,2));await browser.close();}
console.log(JSON.stringify(report));
