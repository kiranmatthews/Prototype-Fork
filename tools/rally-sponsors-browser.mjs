import assert from 'node:assert/strict';
import {mkdir,writeFile} from 'node:fs/promises';
import {createRequire} from 'node:module';
const {chromium}=createRequire(import.meta.url)(process.env.PLAYWRIGHT_MODULE||'playwright');
const base=process.argv[2]??'http://127.0.0.1:5497',out=process.env.RALLY_SPONSORS_OUTPUT??'/private/tmp/rally-sponsors-browser';
await mkdir(out,{recursive:true});
const browser=await chromium.launch({channel:'chrome',headless:true});
const page=await browser.newPage({viewport:{width:1600,height:900},serviceWorkers:'block'}),errors=[];
page.on('pageerror',e=>errors.push(e.message));page.on('console',m=>{if(m.type()==='error')errors.push(m.text());});
try{
 await page.goto(`${base}/?playtest&level=coconut-cart-rally${process.env.RALLY_SPONSORS_LITE?'&lite':''}`,{timeout:180000});
 await page.waitForFunction(()=>window.__game?.getSkateRace()?.carts&&!window.__game.gameFlow.blocksGameplay,null,{timeout:180000});
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
 await page.screenshot({path:out+'/landing-native.png'});
 const layout=await page.evaluate(()=>{
  const g=window.__game,r=g.getSkateRace(),q=window.sponsorReview,model=r.carts.fleet.models[0];q.stage='rear';g.scene.updateMatrixWorld(true);
  const seen=new Set(),boards=[];
  g.scene.traverse(o=>{if(o.name!=='Stadium sponsor hoarding')return;const p=o.geometry.attributes.position,uv=o.geometry.attributes.uv;
   for(let i=0;i<p.count;i+=4){const a=g.player.pos.clone().fromBufferAttribute(p,i).applyMatrix4(o.matrixWorld),b=a.clone().fromBufferAttribute(p,i+1).applyMatrix4(o.matrixWorld),c=a.clone().fromBufferAttribute(p,i+2).applyMatrix4(o.matrixWorld),u=uv.getX(i),v=uv.getY(i);
    const brand=6-Math.round(v*7);if(seen.has(brand)||(Math.abs(u)>1e-4&&Math.abs(u-1)>1e-4))continue;
    seen.add(brand);const right=b.clone().sub(a).normalize(),up=c.clone().sub(a),normal=right.clone().cross(up).normalize();
    const center=a.clone().addScaledVector(right,10).addScaledVector(up,.5);if(normal.dot(g.player.pos.clone().sub(center))<0)normal.negate();
    boards.push({brand,center:center.toArray(),normal:normal.toArray()});
   }
  });q.boards=boards.sort((a,b)=>a.brand-b.brand);
  const gate=g.scene.getObjectByName('skate race finish line');gate.updateMatrixWorld(true);q.gate=gate.getWorldPosition(g.player.pos.clone());
  const render=g.renderer.render.bind(g.renderer);
  g.renderer.render=(scene,camera)=>{
   if(scene===g.scene){
    const q=window.sponsorReview;g.getLevel().standingWaterClock.value=10;r.carts.crowd.update(10);
    if(q.stage==='rear'||q.stage==='front'){
     model.root.updateMatrixWorld(true);const target=model.root.localToWorld(g.player.pos.clone().set(0,1.20,0));
     const eye=model.root.localToWorld(g.player.pos.clone().set(q.stage==='rear'?-3.3:3.3,2.5,q.stage==='rear'?4.3:-4.3));camera.position.copy(eye);camera.lookAt(target);
    }else if(q.stage==='board'){
     const b=q.boards[q.brand],target=g.player.pos.clone().fromArray(b.center);camera.position.copy(target).addScaledVector(g.player.pos.clone().fromArray(b.normal),18);camera.lookAt(target);
    }else if(q.stage==='gate'){const target=q.gate.clone().add({x:0,y:3.5,z:0});camera.position.copy(q.gate).add({x:7,y:10,z:46});camera.lookAt(target);}
    camera.updateMatrixWorld();g.getLevel().updateSceneryView(camera);r.carts.updateView(camera);
   }
   return render(scene,camera);
  };
  return {boards:q.boards,gateChildren:gate.children.map(o=>({type:o.type,name:o.name})),sameTexture:model.materials.sponsor.map===g.scene.getObjectByName('Stadium sponsor hoarding').material.map,sponsorBatches:r.carts.fleet.kit.parts.filter(p=>p.material==='sponsor').length,alphaTest:model.materials.sponsor.alphaTest,transparent:model.materials.sponsor.transparent,textureSize:[model.materials.sponsor.map.image.width,model.materials.sponsor.map.image.height]};
 });
 assert.equal(layout.boards.length,7);assert.deepEqual(layout.boards.map(b=>b.brand),[0,1,2,3,4,5,6]);assert.equal(layout.sameTexture,true);assert.equal(layout.sponsorBatches,3);assert.ok(layout.alphaTest>0&&layout.transparent);assert.deepEqual(layout.textureSize,[1024,1792]);assert.equal(layout.gateChildren.length,3);assert.ok(layout.gateChildren.every(o=>o.type==='Mesh'));
 for(const stage of ['rear','front','gate']){
  await page.evaluate(stage=>window.sponsorReview.stage=stage,stage);await page.waitForTimeout(250);await page.screenshot({path:`${out}/${stage}-native.png`});
  await page.evaluate(()=>window.__game.renderQualitySettings.setRegularResolution(720));await page.waitForTimeout(100);await page.screenshot({path:`${out}/${stage}-normal.png`});
  await page.evaluate(()=>window.__game.renderQualitySettings.setRegularResolution(null));
 }
 for(let brand=0;brand<7;brand++){
  await page.evaluate(brand=>{window.sponsorReview.stage='board';window.sponsorReview.brand=brand;},brand);await page.waitForTimeout(180);await page.screenshot({path:`${out}/board-${brand}-native.png`});
 }
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
 const report={passed:true,landing,layout,simultaneous,gl,errors};await writeFile(out+'/report.json',JSON.stringify(report,null,2));console.log(JSON.stringify(report));
}catch(error){console.log('ERRORS',errors);await page.screenshot({path:out+'/failure.png'}).catch(()=>{});throw error;}finally{await browser.close();}
