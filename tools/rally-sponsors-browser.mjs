import assert from 'node:assert/strict';
import {mkdir,readFile,writeFile} from 'node:fs/promises';
import {createRequire} from 'node:module';
const {chromium}=createRequire(import.meta.url)(process.env.PLAYWRIGHT_MODULE||'playwright');
const base=process.argv[2]??'http://127.0.0.1:5497',out=process.env.RALLY_SPONSORS_OUTPUT??'/private/tmp/rally-sponsors-browser';
const atlas=JSON.parse(await readFile(new URL('./rally-sponsors/atlas.json',import.meta.url),'utf8'));
const crops=atlas.entries.map((entry,brand)=>({brand,name:entry.name,aspect:entry.aspect,uv:entry.cropUV??entry.uv}));
await mkdir(out,{recursive:true});
const browser=await chromium.launch({channel:'chrome',headless:true});
const page=await browser.newPage({viewport:{width:1600,height:900},serviceWorkers:'block'}),errors=[];
page.on('pageerror',e=>errors.push(e.message));page.on('console',m=>{if(m.type()==='error')errors.push(m.text());});
try{
 await page.goto(`${base}/?playtest&level=coconut-cart-rally${process.env.RALLY_SPONSORS_LITE?'&lite':''}`,{timeout:180000});
 await page.waitForFunction(()=>window.__game?.getSkateRace()?.carts&&!window.__game.gameFlow.blocksGameplay,null,{timeout:180000});
 await page.waitForFunction(()=>{let n=0;window.__game.scene.traverse(o=>{if(o.isInstancedMesh&&o.userData.jungleAsset==='coastv2buttress')n+=o.count;});return n>0;},null,{timeout:90000});
 const introText=await page.locator('.comp-intro').innerText();
 assert.ok(introText.includes('Win the race to earn the gem'),'Rally intro explains the winning objective');
 await page.screenshot({path:out+'/intro-native.png'});
 await page.mouse.click(1450,600);
 await page.evaluate(()=>{
  const g=window.__game,r=g.getSkateRace();g.renderQualitySettings.setRegularResolution(null);r.canStartTimeTrial=()=>true;r.start('time-trial',251027);r.phase='running';r.elapsed=10;
  const drive=r.carts.drive.bind(r.carts),step=r.step.bind(r),landing=r.carts.audio.landing.bind(r.carts.audio),play=g.sfx.playManaged.bind(g.sfx);
  const analyser=g.sfx.ctx.createAnalyser();analyser.fftSize=4096;g.sfx.master.connect(analyser);const samples=new Float32Array(analyser.fftSize);
  const q=window.sponsorReview={stage:'drive',landings:[],shots:[],boards:[],masterPeak:0};
  r.carts.audio.landing=(hit,listener,human)=>{q.landings.push({...hit,health:r.carts.fleet.physics.carts[hit.cart].health});return landing(hit,listener,human);};
  g.sfx.playManaged=(key,name,gain,rate)=>{const stop=play(key,name,gain,rate);if(name==='kartLanding')q.shots.push({key,name,gain,rate,played:!!stop,buffer:!!g.sfx.buffers.get(name)});return stop;};
  r.step=(dt,input)=>{if(q.stage==='drive'){step(dt,drive(0));analyser.getFloatTimeDomainData(samples);for(const x of samples)q.masterPeak=Math.max(q.masterPeak,Math.abs(x));}};
 });
 await page.waitForFunction(()=>window.sponsorReview.shots.length>0,null,{timeout:70000});
 await page.waitForTimeout(800);
 const landing=await page.evaluate(()=>{
  const g=window.__game,c=g.getSkateRace().carts.fleet.physics.carts[0],buffer=g.sfx.buffers.get('kartLanding'),data=buffer?.getChannelData(0);let sum=0,peak=0;
  if(data)for(const x of data){sum+=x*x;peak=Math.max(peak,Math.abs(x));}
  return {masterPeak:window.sponsorReview.masterPeak,events:window.sponsorReview.landings,shots:window.sponsorReview.shots,grounded:c.grounded,rolls:c.rolls,progress:g.getSkateRace().riders[0].progress,buffer:{duration:buffer?.duration,rms:data?Math.sqrt(sum/data.length):0,peak}};
 });
 assert.ok(landing.shots[0].played&&landing.shots[0].buffer,'Ordinary ramp touchdown plays a decoded landing sample');
 assert.ok(landing.masterPeak>0&&landing.masterPeak<.98,'The real engine/landing mix retains output headroom');
 assert.equal(landing.events.length,landing.shots.length);assert.equal(landing.rolls,0);assert.ok(landing.buffer.duration>.65&&landing.buffer.rms>.15);
 assert.equal(await page.locator('[data-race-boxes]').count(),0,'Rally running HUD has no crate objective');
 await page.screenshot({path:out+'/landing-native.png'});
 const layout=await page.evaluate(crops=>{
  const g=window.__game,r=g.getSkateRace(),q=window.sponsorReview,model=r.carts.fleet.models[0];q.stage='rear';g.scene.updateMatrixWorld(true);
  const seen=new Set(),boards=[],allBoards=[],near=(a,b)=>Math.abs(a-b)<1e-5;
  g.scene.traverse(o=>{if(o.name!=='Stadium sponsor hoarding')return;const p=o.geometry.attributes.position,uv=o.geometry.attributes.uv;
   const point=i=>g.player.pos.clone().fromBufferAttribute(p,i).applyMatrix4(o.matrixWorld);
   for(let i=0;i<p.count;i+=4){
    if(uv.getX(i)<0)continue; // Negative-U faces are the shared metal backing.
    const art=crops.find(c=>near(uv.getX(i),c.uv[0])&&near(uv.getY(i),c.uv[1]));
    if(!art)continue;
    const [left,bottom,right,top]=art.uv;
    let last=i,width=0,height=0,quads=0,complete=false;
    for(let j=i;j+3<p.count;j+=4){
     // A patch is a run of horizontal quads, from the crop's left to right edge.
     if(uv.getX(j)<left-1e-5||uv.getX(j+1)>right+1e-5||!near(uv.getY(j),bottom)||!near(uv.getY(j+2),top))break;
     if(j>i&&!near(uv.getX(j),uv.getX(j-3)))break;
     width+=point(j).distanceTo(point(j+1));height+=point(j).distanceTo(point(j+2));quads++;last=j;
     if(near(uv.getX(j+1),right)){complete=true;break;}
    }
    if(!complete)continue;
    const a=point(i),b=point(last+1),c=point(i+2),d=point(last+3);
    const center=a.clone().add(b).add(c).add(d).multiplyScalar(.25);
    const horizontal=b.clone().sub(a).add(d.clone().sub(c)),vertical=c.clone().sub(a).add(d.clone().sub(b));
    const normal=horizontal.cross(vertical).normalize();
    height/=quads;
    const placement={brand:art.brand,name:art.name,center:center.toArray(),normal:normal.toArray(),width,height,aspect:width/height,sourceAspect:art.aspect,quads,cropUV:art.uv};
    allBoards.push(placement);if(!seen.has(art.brand)){seen.add(art.brand);boards.push(placement);}
    i=last;
   }
  });q.boards=boards.sort((a,b)=>a.brand-b.brand);
  q.corners=[-250,-700,-1300].flatMap(z=>[-1,1].map(sign=>allBoards.filter(b=>[0,6,7].includes(b.brand)&&Math.sign(b.normal[0])===sign).sort((a,b)=>Math.abs(a.center[2]-z)-Math.abs(b.center[2]-z))[0]));
  // Include the narrowest CCR container, where fixed-height backings used to leave large borders.
  q.corners.push(allBoards.filter(b=>b.brand===7).sort((a,b)=>a.width-b.width)[0]);
  q.rocks=g.getLevel().builtFromData.components.filter(c=>c.nm?.startsWith('Rally Meshy rock')).map(c=>{const at=r.course.project(g.player.pos.clone().fromArray(c.p));return {name:c.nm,position:c.p,s:at.s,offset:at.offset};}).sort((a,b)=>a.s-b.s);
  const gate=g.scene.getObjectByName('skate race finish line');gate.updateMatrixWorld(true);q.gate=gate.getWorldPosition(g.player.pos.clone());
  const render=g.renderer.render.bind(g.renderer),sceneryView=g.getLevel().updateSceneryView.bind(g.getLevel());
  // This inspection camera owns streaming too; the parked gameplay camera
  // must not retire a distant inspection cell earlier in the same frame.
  g.getLevel().updateSceneryView=()=>{};
  g.renderer.render=(scene,camera)=>{
   if(scene===g.scene){
    const q=window.sponsorReview;g.getLevel().standingWaterClock.value=10;r.carts.crowd.update(10);
    if(q.stage==='rear'||q.stage==='front'){
     model.root.updateMatrixWorld(true);const target=model.root.localToWorld(g.player.pos.clone().set(0,1.20,0));
     const eye=model.root.localToWorld(g.player.pos.clone().set(q.stage==='rear'?-3.3:3.3,2.5,q.stage==='rear'?4.3:-4.3));camera.position.copy(eye);camera.lookAt(target);
    }else if(q.stage==='board'||q.stage==='corner'){
     const b=q.stage==='corner'?q.corners[q.corner]:q.boards[q.brand],target=g.player.pos.clone().fromArray(b.center);camera.position.copy(target).addScaledVector(g.player.pos.clone().fromArray(b.normal),18);camera.lookAt(target);
    }else if(q.stage==='rock'){const rock=q.rocks[q.rock],target=g.player.pos.clone().fromArray(rock.position).add({x:0,y:7,z:0}),eye=r.course.sample(rock.s-30,-Math.sign(rock.offset)*6);eye.y+=8;camera.position.copy(eye);camera.lookAt(target);}
    else if(q.stage==='gate'){const target=q.gate.clone().add({x:0,y:3.5,z:0});camera.position.copy(q.gate).add({x:7,y:10,z:46});camera.lookAt(target);}
    camera.updateMatrixWorld();sceneryView(camera);r.carts.updateView(camera);
   }
   return render(scene,camera);
  };
  return {rocks:q.rocks,boards:q.boards,corners:q.corners,artworkPatches:allBoards.length,maxAspectError:Math.max(...allBoards.map(b=>Math.abs(b.aspect/b.sourceAspect-1))),boardAlphaTest:g.scene.getObjectByName('Stadium sponsor hoarding').material.alphaTest,boardTransparent:g.scene.getObjectByName('Stadium sponsor hoarding').material.transparent,gateChildren:gate.children.map(o=>({type:o.type,name:o.name})),sameTexture:model.materials.sponsor.map===g.scene.getObjectByName('Stadium sponsor hoarding').material.map,sponsorBatches:r.carts.fleet.kit.parts.filter(p=>p.material==='sponsor').length,alphaTest:model.materials.sponsor.alphaTest,transparent:model.materials.sponsor.transparent,textureSize:[model.materials.sponsor.map.image.width,model.materials.sponsor.map.image.height]};
 },crops);
 assert.equal(layout.rocks.length,14);assert.ok(layout.boards.find(b=>b.brand===2).width<=5.65,'Trashed is a small overlay sticker');
 assert.equal(layout.boards.length,crops.length);assert.deepEqual(layout.boards.map(b=>b.brand),crops.map(c=>c.brand));assert.ok(layout.boards.every(b=>b.width>0&&b.height>0&&b.quads>0));assert.ok(layout.maxAspectError<.02,'Artwork keeps its source proportions around every curved wall');assert.ok(layout.boardAlphaTest>=.03&&!layout.boardTransparent);assert.equal(layout.sameTexture,true);assert.equal(layout.sponsorBatches,3);assert.ok(layout.alphaTest>0&&layout.transparent);assert.deepEqual(layout.textureSize,[atlas.width,atlas.height]);assert.equal(layout.gateChildren.length,3);assert.ok(layout.gateChildren.every(o=>o.type==='Mesh'));
 for(const stage of ['rear','front','gate']){
  await page.evaluate(stage=>window.sponsorReview.stage=stage,stage);await page.waitForTimeout(250);await page.screenshot({path:`${out}/${stage}-native.png`});
  await page.evaluate(()=>window.__game.renderQualitySettings.setRegularResolution(720));await page.waitForTimeout(100);await page.screenshot({path:`${out}/${stage}-normal.png`});
  await page.evaluate(()=>window.__game.renderQualitySettings.setRegularResolution(null));
 }
 for(let brand=0;brand<crops.length;brand++){
  await page.evaluate(brand=>{window.sponsorReview.stage='board';window.sponsorReview.brand=brand;},brand);await page.waitForTimeout(180);await page.screenshot({path:`${out}/board-${brand}-native.png`});
  if([0,1,2,3,4,5,7].includes(brand)){await page.evaluate(()=>window.__game.renderQualitySettings.setRegularResolution(720));await page.waitForTimeout(180);await page.screenshot({path:`${out}/board-${brand}-normal.png`});await page.evaluate(()=>window.__game.renderQualitySettings.setRegularResolution(null));}
 }
 for(let corner=0;corner<layout.corners.length;corner++){
  await page.evaluate(corner=>{window.sponsorReview.stage='corner';window.sponsorReview.corner=corner;},corner);await page.waitForTimeout(180);await page.screenshot({path:`${out}/corner-${corner}-native.png`});
 }
 for(let rock=0;rock<layout.rocks.length;rock++){
  await page.evaluate(rock=>{window.sponsorReview.stage='rock';window.sponsorReview.rock=rock;},rock);await page.waitForFunction(rock=>{const g=window.__game,p=window.sponsorReview.rocks[rock].position;let found=false;g.scene.traverse(o=>{if(!o.isInstancedMesh||o.userData.jungleAsset!=='coastv2buttress')return;for(let i=0;i<o.count;i++){const m=o.matrixWorld.clone();o.getMatrixAt(i,m);m.premultiply(o.matrixWorld);const at=g.player.pos.clone().setFromMatrixPosition(m);if(at.distanceTo(g.player.pos.clone().fromArray(p))<.1){window.sponsorReview.rocks[rock].triangles=(o.geometry.index?.count??o.geometry.attributes.position.count)/3;window.sponsorReview.rocks[rock].lod=o.userData.sceneryLod;found=true;}}});return found;},rock,{timeout:60000});await page.waitForTimeout(180);await page.screenshot({path:`${out}/rock-${rock}-native.png`});
  if(rock<2){await page.evaluate(()=>window.__game.renderQualitySettings.setRegularResolution(720));await page.waitForTimeout(150);await page.screenshot({path:`${out}/rock-${rock}-normal.png`});await page.evaluate(()=>window.__game.renderQualitySettings.setRegularResolution(null));}
 }
 layout.rocks=await page.evaluate(()=>window.sponsorReview.rocks);assert.ok(layout.rocks.every(rock=>rock.triangles===10720&&rock.lod===0),'Every streamed Meshy rock retains complete geometry');
 // Same-frame pack touchdown, with the player in a stolen higher-index kart.
 // The actual managed Web Audio path must start the player even after a rival.
 await page.waitForTimeout(60);
 const simultaneous=await page.evaluate(()=>{
  const g=window.__game,c=g.getSkateRace().carts,q=window.sponsorReview,start=q.shots.length,listener=g.player.pos;
  for(const cart of [0,7,1])c.audio.landing({cart,x:listener.x,y:listener.y,z:listener.z,strength:18,airTime:.7},listener,7);
  return q.shots.slice(start);
 });
 assert.equal(simultaneous.filter(s=>s.played).length,2);assert.equal(simultaneous.find(s=>s.key==='rally-landing-7').played,true);assert.equal(simultaneous.find(s=>s.key==='rally-landing-1').played,false);
 const gl=await page.evaluate(()=>window.__game.renderer.getContext().getError());assert.equal(gl,0);assert.deepEqual(errors,[]);
 const report={passed:true,introText,crateHudRemoved:true,landing,layout,simultaneous,gl,errors};await writeFile(out+'/report.json',JSON.stringify(report,null,2));console.log(JSON.stringify(report));
}catch(error){console.log('ERRORS',errors);await page.screenshot({path:out+'/failure.png'}).catch(()=>{});throw error;}finally{await browser.close();}
