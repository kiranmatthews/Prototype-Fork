import json,os,base64
from pathlib import Path
from playwright.sync_api import sync_playwright
out=Path('/workspace/crate-review/coconut-cart-rally');mode=os.environ.get('RALLY_MODE','lite');report={'mode':mode,'errors':[]}
if mode=='lite' and os.environ.get('RALLY_RESUME'):
 prior=json.loads((out/'browser-lite-initial.json').read_text());report.update({k:prior[k] for k in ['keyboard','pickups'] if k in prior});report['priorFixtureFailure']=prior.get('failure')
if mode=='full' and os.environ.get('RALLY_CENTRAL_VIEW'):
 prior=json.loads((out/'browser-full-first.json').read_text());report['views']=[v for v in prior['views'] if v['name']=='before-extension-rock'];report['retainedCameraLimitation']='The left-lane fixture places the camera inside the preceding unchanged rock; central approach is inspected separately.'
with sync_playwright() as pw:
 b=pw.chromium.launch(executable_path='/usr/bin/chromium',headless=True,args=['--no-sandbox','--disable-dev-shm-usage','--use-angle=swiftshader','--enable-unsafe-swiftshader'])
 page=b.new_page(viewport={'width':240 if mode=='lite' else 480,'height':135 if mode=='lite' else 270},service_workers='block');page.set_default_timeout(300000)
 page.add_init_script("localStorage.setItem('solProtoRenderQuality.v1',JSON.stringify({version:3,enabled:false,baseHeight:720,outputMultiplier:1,fixed60:true}))")
 page.on('pageerror',lambda e:report['errors'].append(str(e)));page.on('console',lambda m:report['errors'].append(m.text) if m.type=='error' else None)
 def save():(out/('browser-'+mode+'.json')).write_text(json.dumps(report,indent=2)+'\n')
 def record(k,v):report[k]=v;save();print(k,v,flush=True)
 def frames(n):
  f=page.evaluate('window.__game.frameStats.frame');page.wait_for_function('q=>window.__game.frameStats.frame>=q',arg=f+n)
 def stage(index):
  return page.evaluate('''index=>{const g=window.__game,r=g.getSkateRace(),l=g.getLevel();r.start('time-trial',42);r.phase='running';r.elapsed=4;const box=l.crates[index],at=r.course.project(box.mesh.position).s,f=r.course.tangent(at).setY(0).normalize(),p=box.mesh.position.clone().addScaledVector(f,-8),c=r.carts,w=c.fleet.physics;Object.assign(w.spawns[0],{x:p.x,z:p.z,yaw:Math.atan2(-f.x,-f.z)});w.reset(0);c.sync();c.present(1);const a=r.riders[0];a.progress=a.previousProgress=a.anchorProgress=r.course.project(g.player.pos).s;a.anchor.copy(g.player.pos);g.player.snapRenderInterpolation();window.reviewBox=box;return{index,target:box.mesh.position.toArray(),start:g.player.pos.toArray()};}''',index)
 def pickup(index):
  setup=stage(index)
  page.evaluate('''()=>{const g=window.__game,r=g.getSkateRace(),native=r.step.bind(r),box=window.reviewBox;let n=0;window.pickup={done:false};r.step=(dt,input)=>{const c=r.carts,w=c.fleet.physics,k=w.carts[c.cartForRacer[0]],angle=Math.atan2(-(box.mesh.position.x-k.x),-(box.mesh.position.z-k.z))-k.yaw;native(dt,{...input,moveX:Math.max(-1,Math.min(1,Math.atan2(Math.sin(angle),Math.cos(angle))*2)),moveY:1,jumpHeld:true});n++;if(!box.alive||n>360){window.pickup={done:true,collected:!box.alive,frames:n,item:r.riders[0].item,falls:r.riders[0].falls,hits:k.hits,boxes:r.riders[0].boxes.size};r.step=native;}};}''')
  page.wait_for_function('window.pickup.done');v=page.evaluate('window.pickup');assert v['collected'] and v['item']=='mushroom' and v['falls']==0 and v['hits']==0 and v['boxes']==0,v;return {**setup,**v}
 def shot(name,index):
  setup=stage(index);frames(12);page.wait_for_function('(()=>{const g=window.__game;return Math.hypot(g.camera.position.x-g.player.pos.x,g.camera.position.z-g.player.pos.z)<45})()')
  page.set_viewport_size({'width':1280,'height':720});page.evaluate('window.dispatchEvent(new Event("resize"))');page.wait_for_function('window.__game.renderer.domElement.width===1280&&window.__game.renderer.domElement.height===720');frames(6)
  data=page.evaluate('window.__game.captureBonusReviewFrame()');assert data and data.startswith('data:image/png;base64,');(out/('full-'+name+'.png')).write_bytes(base64.b64decode(data.split(',')[1]))
  v=page.evaluate('(()=>{const g=window.__game,r=g.getSkateRace();return{position:g.player.pos.toArray(),camera:g.camera.position.toArray(),grounded:g.player.grounded,falls:r.riders[0].falls,render:[g.renderer.domElement.width,g.renderer.domElement.height],gl:g.renderer.getContext().getError()}})()');assert v['grounded'] and v['falls']==0 and v['gl']==0,v
  report.setdefault('views',[]).append({'name':name,**setup,**v});save();print('view',name,flush=True);page.set_viewport_size({'width':480,'height':270})
 try:
  page.goto('http://127.0.0.1:5173/?playtest&level=coconut-cart-rally'+('&lite' if mode=='lite' else ''),wait_until='domcontentloaded')
  page.wait_for_function('window.__game?.getSkateRace()?.carts&&!window.__game.gameFlow.blocksGameplay&&!document.getElementById("game-startup")')
  record('inventory',page.evaluate('(()=>{const g=window.__game,l=g.getLevel(),r=g.getSkateRace();g.renderQualitySettings.setRegularResolution(null);g.crtGuestSettings.setEnabled(false);g.campaign.startEphemeral();r.canStartTimeTrial=()=>true;return{physical:l.crates.length,items:l.crates.filter(b=>b.mystery).length,total:l.totalCrates,checkpoints:l.checkpoints.length,enemies:l.enemies.length,racers:r.riders.length,bonus:l.allowsBonus,gemReward:l.skateRace.gemReward}})()'))
  assert report['inventory']=={'physical':52,'items':52,'total':0,'checkpoints':0,'enemies':0,'racers':8,'bonus':False,'gemReward':'win'},report['inventory']
  page.get_by_role('button',name='RACE',exact=True).click();page.wait_for_function('window.__game.getSkateRace().phase==="running"')
  if mode=='lite':
   if 'keyboard' not in report:
    page.evaluate('window.__game.getSkateRace().start("time-trial",42)');page.wait_for_function('window.__game.getSkateRace().phase==="running"')
    page.keyboard.down('ArrowUp');page.keyboard.down('Space');frames(90);page.keyboard.up('ArrowUp');page.keyboard.up('Space')
    drive=page.evaluate('(()=>{const r=window.__game.getSkateRace(),c=r.carts.fleet.physics.carts[0];return{speed:c.speed,yaw:c.yaw,progress:r.riders[0].progress}})()');assert drive['speed']>5,drive
    page.keyboard.down('ArrowRight');frames(18);page.keyboard.up('ArrowRight');steer=page.evaluate('window.__game.getSkateRace().carts.fleet.physics.carts[0].yaw');assert abs(steer-drive['yaw'])>.03
    page.keyboard.down('KeyQ');frames(40);page.keyboard.up('KeyQ');brake=page.evaluate('window.__game.player.speed');assert abs(brake)<drive['speed'];record('keyboard',{'drive':drive,'steeredYaw':steer,'brakedSpeed':brake})
   rows=report.get('pickups',[])
   for index in [1,29,36,42,51]:
    if not any(v['index']==index for v in rows):rows.append(pickup(index));record('pickups',rows)
   # The final fixture is close to the exit; the real driver must cross it.
   page.evaluate('''()=>{const g=window.__game,r=g.getSkateRace(),native=r.step.bind(r);window.finishRun={done:false};let frames=0;r.step=(dt,input)=>{native(dt,r.drive(0));frames++;if(r.phase==='finished'||frames>1800){window.finishRun={done:true,frames,phase:r.phase,finish:r.riders[0].finish,falls:r.riders[0].falls,gem:g.player.gemEarned};r.step=native;}};}''')
   page.wait_for_function('window.finishRun.done');record('stagedFinish',page.evaluate('window.finishRun'));assert report['stagedFinish']['phase']=='finished' and not report['stagedFinish']['gem']
   record('retry',page.evaluate('(()=>{const g=window.__game,r=g.getSkateRace();r.reset("time-trial");return{alive:g.getLevel().crates.filter(c=>c.alive).length,item:r.riders[0].item,boxes:r.riders[0].boxes.size,phase:r.phase}})()'));assert report['retry']=={'alive':52,'item':None,'boxes':0,'phase':'grid'}
  else:
   for name,index in ([('tunnel-approach',38)] if os.environ.get('RALLY_CENTRAL_VIEW') else [('before-extension-rock',29),('tunnel-approach',36)]):shot(name,index)
  assert not report['errors'],report['errors'];report['passed']=True
 except Exception as e:
  report['passed']=False;report['failure']=str(e)
  try:report['failureState']=page.evaluate('(()=>{const g=window.__game,r=g?.getSkateRace();return{level:g?.getCurrentLevel().id,phase:r?.phase,state:g?.player.state,position:g?.player.pos.toArray(),pickup:window.pickup}})()')
  except Exception:pass
 save();print('result',mode,report['passed'],report.get('failure'),flush=True);b.close()
assert report['passed'],report.get('failure')
