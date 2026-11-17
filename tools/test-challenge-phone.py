import os,json,base64
from pathlib import Path
from playwright.sync_api import sync_playwright
out=Path(os.environ.get('CRYSTAL_PHONE_OUT','/workspace/crystal-trials/phone'));out.mkdir(parents=True,exist_ok=True)
url=os.environ.get('CRYSTAL_PHONE_URL','http://127.0.0.1:5173/challenge-playtest.html?touch')
report={'url':url,'errors':[],'passed':False}
with sync_playwright() as pw:
 browser=pw.chromium.launch(executable_path='/usr/bin/chromium',headless=True,args=['--no-sandbox','--disable-dev-shm-usage','--use-angle=swiftshader','--enable-unsafe-swiftshader'])
 context=browser.new_context(viewport={'width':390,'height':844},is_mobile=True,has_touch=True,device_scale_factor=1,service_workers='block')
 page=context.new_page();page.set_default_timeout(300000)
 page.on('pageerror',lambda e:report['errors'].append(str(e)))
 page.on('console',lambda m:report['errors'].append(m.text) if m.type=='error' else None)
 cdp=context.new_cdp_session(page);cdp.send('Network.enable');cdp.send('Network.setCacheDisabled',{'cacheDisabled':True})
 resources={}
 cdp.on('Network.responseReceived',lambda e:resources.update({e['requestId']:{'url':e['response']['url'],'status':e['response']['status'],'type':e['type'],'bytes':0}}))
 cdp.on('Network.loadingFinished',lambda e:resources.get(e['requestId'],{}).update(bytes=e['encodedDataLength']))
 def frames(n):
  frame=page.evaluate('window.__game.frameStats.totalFixedSteps');page.wait_for_function('n=>window.__game.frameStats.totalFixedSteps>=n',arg=frame+n)
 def bounds():
  return page.evaluate('''() => [...document.querySelectorAll('#challenge-menu button')].filter(e=>e.getClientRects().length).map(e=>{const r=e.getBoundingClientRect();return {text:e.textContent,x:r.x,y:r.y,w:r.width,h:r.height}})''')
 try:
  page.goto(url,wait_until='networkidle')
  assert page.locator('#challenge-options button').count()>=9
  report['menuBytes']=sum(r['bytes'] for r in resources.values())
  page.screenshot(path=str(out/'menu-portrait.png'));report['portraitButtons']=bounds()
  page.locator('#challenge-play').tap()
  page.wait_for_function('window.__game?.getLevel() && !window.__game.paused && document.getElementById("challenge-menu").hidden')
  frames(15)
  page.wait_for_load_state('networkidle')
  report['firstPlayBytes']=sum(r['bytes'] for r in resources.values())
  report['start']=page.evaluate('window.__game.player.pos.toArray()')
  assert page.evaluate('!window.__game.player.freeSkate && !window.__game.getLevel().skatepark'), 'Playtest forced park or mounted controls'
  native=page.evaluate('''() => {const c=window.__game.renderer.domElement;return [c.width,c.height,innerWidth,innerHeight,devicePixelRatio]}''')
  assert native[:2]==[int(n*native[4]) for n in native[2:4]],native
  report['nativePortrait']=native
  pad=page.locator('.tc-pad').bounding_box();x=pad['x']+pad['width']/2;y=pad['y']+pad['height']*.18
  cdp.send('Input.dispatchTouchEvent',{'type':'touchStart','touchPoints':[{'x':x,'y':y,'id':1}]});frames(35)
  cdp.send('Input.dispatchTouchEvent',{'type':'touchEnd','touchPoints':[]});frames(15)
  report['afterTouch']=page.evaluate('window.__game.player.pos.toArray()')
  assert report['afterTouch'][2]<report['start'][2]-2,'Touch pad did not move the player'
  assert page.evaluate('!window.__game.player.freeSkate'), 'Direction alone mounted the board'
  page.screenshot(path=str(out/'play-portrait.png'))
  jump=page.locator('.tc-btn[aria-label="Jump"]').bounding_box()
  fingers=[{'x':x,'y':y,'id':1},{'x':jump['x']+jump['width']/2,'y':jump['y']+jump['height']/2,'id':2}]
  cdp.send('Input.dispatchTouchEvent',{'type':'touchStart','touchPoints':fingers})
  page.wait_for_function('window.__game.player.freeSkate',timeout=30000)
  cdp.send('Input.dispatchTouchEvent',{'type':'touchEnd','touchPoints':[]});frames(90)
  brake=page.locator('.tc-btn[aria-label="Grab"]').bounding_box()
  cdp.send('Input.dispatchTouchEvent',{'type':'touchStart','touchPoints':[{'x':brake['x']+brake['width']/2,'y':brake['y']+brake['height']/2,'id':3}]})
  page.wait_for_function('!window.__game.player.freeSkate && window.__game.player.grounded',timeout=30000)
  cdp.send('Input.dispatchTouchEvent',{'type':'touchEnd','touchPoints':[]})
  report['touchLocomotion']=['walk','mount','dismount']
  page.locator('.tc-pause').tap();page.wait_for_function('window.__game.paused && !document.getElementById("challenge-menu").hidden')
  for w,h,dpr in [(844,390,3),(1280,800,1)]:
   cdp.send('Emulation.setDeviceMetricsOverride',{'width':w,'height':h,'deviceScaleFactor':dpr,'mobile':True})
   page.wait_for_function('q=>{const c=window.__game.renderer.domElement;return c.width===q[0]&&c.height===q[1]}',arg=[w*dpr,h*dpr])
   page.locator('#challenge-resume').tap();frames(3)
   report.setdefault('drawingBuffers',[]).append(page.evaluate('[window.__game.renderer.domElement.width,window.__game.renderer.domElement.height]'))
   page.locator('.tc-pause').tap();page.wait_for_function('window.__game.paused')
  cdp.send('Emulation.setDeviceMetricsOverride',{'width':390,'height':844,'deviceScaleFactor':1,'mobile':True})
  page.locator('#challenge-retry').tap();frames(15)
  assert abs(page.evaluate('window.__game.player.pos.z-window.__game.getCurrentLevel().data.spawn[2]'))<3,'Retry did not reset the single trial'
  # Isolate the finish menu from route timing. The native routes earn every
  # crystal; here seed its real collectible and ride the last stretch by touch.
  page.evaluate('''() => {
    const g=window.__game, level=g.getLevel(), p=g.player;
    const gate=g.getCurrentLevel().data.components.find(c=>c.t==='gate');
    level.skateCollectathon.collect(level.skateCollectathon.tokens[0].box);
    const start=p.pos.clone().fromArray(gate.p);start.y+=.8;start.z+=13;
    p.respawn(level,false,false,{position:start,heading:p.axisF.clone().set(0,0,-1)});
  }''')
  cdp.send('Input.dispatchTouchEvent',{'type':'touchStart','touchPoints':[{'x':x,'y':y,'id':1}]})
  try: page.wait_for_function('window.__game.paused && window.__game.player.state==="finished"',timeout=30000)
  finally: cdp.send('Input.dispatchTouchEvent',{'type':'touchEnd','touchPoints':[]})
  assert page.locator('#challenge-resume').is_hidden()
  assert page.locator('#challenge-retry').inner_text()=='Replay 1'
  assert page.locator('#challenge-play').inner_text()=='Play 2'
  page.locator('#challenge-play').tap()
  page.wait_for_function('window.__game.getCurrentLevel().id==="phone-challenge-1" && !window.__game.paused')
  report['advancedTo']=2
  page.set_viewport_size({'width':844,'height':390});frames(10)
  page.screenshot(path=str(out/'play-landscape.png'))
  page.locator('.tc-pause').tap();page.wait_for_function('window.__game.paused')
  report['landscapeButtons']=bounds();page.screenshot(path=str(out/'menu-landscape.png'))
  page.locator('#reject-tab').tap();page.locator('#challenge-play').tap()
  page.wait_for_function('window.__game.getCurrentLevel().id.startsWith("phone-reject") && !window.__game.paused');frames(10)
  assert page.evaluate('window.__game.getLevel().skateCollectathon.exitReady'), 'Reject gate is locked'
  page.locator('.tc-pause').tap();page.wait_for_function('window.__game.paused');page.locator('#challenge-options button').last.tap();page.locator('#challenge-play').tap()
  page.wait_for_function('window.__game.getCurrentLevel().id.startsWith("phone-grid") && !window.__game.paused');frames(10)
  report['gridCrystals']=page.evaluate('window.__game.getLevel().skateCollectathon.tokens.length')
  assert report['gridCrystals']==8
  page.locator('.tc-pause').tap();page.wait_for_function('window.__game.paused')
  page.locator('#challenge-tab').tap();page.locator('#challenge-course').tap()
  page.wait_for_function('window.__game.getCurrentLevel().id === "phone-challenge-all" && !window.__game.paused');frames(15)
  report['wholeCourseCrystals']=page.evaluate('window.__game.getLevel().skateCollectathon.tokens.length')
  assert report['wholeCourseCrystals']==25
  page.screenshot(path=str(out/'whole-course.png'))
  # Start just before station 2 with the previous crystal already earned.
  # Bank its crate with normal skating input, then use the actual Retry button.
  expected=page.evaluate('''() => {
    const g=window.__game, level=g.getLevel(), p=g.player, cp=level.checkpoints[1];
    level.skateCollectathon.collect(level.skateCollectathon.tokens[0].box);
    const start=cp.spawnPos.clone();start.y+=.15;start.z+=22;
    p.respawn(level,false,false,{position:start,heading:p.axisF.clone().set(0,0,-1)});
    return cp.spawnPos.z;
  }''')
  page.keyboard.down('ArrowUp');page.keyboard.down('Space')
  try: page.wait_for_function('window.__game.getLevel().checkpoints[1].active',timeout=30000)
  finally: page.keyboard.up('ArrowUp');page.keyboard.up('Space')
  hint=page.locator('#challenge-hint').inner_text()
  assert hint.startswith('2 · '),f'Checkpoint 2 announced {hint!r}'
  page.locator('.tc-pause').tap()
  page.wait_for_function('window.__game.paused && !document.getElementById("challenge-menu").hidden')
  retry=page.locator('#challenge-retry').inner_text()
  assert retry=='From checkpoint',f'Checkpoint 2 offered {retry!r}'
  page.locator('#challenge-retry').tap();frames(5)
  actual=page.evaluate('window.__game.player.pos.z')
  assert abs(actual-expected)<3,f'Retry placed the rider at {actual}, expected checkpoint {expected}'
  assert page.evaluate('window.__game.getLevel().skateCollectathon.collected')==1,'Retry lost the first crystal'
  report['checkpointRetry']={'challenge':2,'crystals':1}
  page.locator('.tc-pause').tap();page.wait_for_function('window.__game.paused')
  page.locator('#reject-tab').tap();report['rejectChoices']=page.locator('#challenge-options button').count()
  assert report['rejectChoices']==101,'Missing preserved layouts in the rejects picker'
  page.locator('#challenge-course').tap()
  page.wait_for_function('window.__game.getCurrentLevel().id === "phone-reject-all" && !window.__game.paused');frames(15)
  report['archiveCrystals']=page.evaluate('window.__game.getLevel().skateCollectathon.tokens.length')
  assert report['archiveCrystals']==100,'The rejects course lost a preserved attempt'
  assert page.evaluate('window.__game.getLevel().skateCollectathon.exitReady')
  page.screenshot(path=str(out/'whole-archive.png'))
  page.wait_for_load_state('networkidle')
  rows=sorted(resources.values(),key=lambda r:r['bytes'],reverse=True)
  report.update(bytes=sum(r['bytes'] for r in rows),resources=rows)
  assert not any('/levels.json' in r['url'] or '/offline-manifest' in r['url'] for r in rows),'Downloaded unrelated game pack'
  if ':5173' not in url: assert report['bytes'] <= 50_000_000, f"Phone transfer exceeded 50 MB: {report['bytes']}"
  assert not report['errors'],report['errors']
  report['passed']=True
 except Exception as e:report['failure']=str(e)
 (out/'smoke.json').write_text(json.dumps(report,indent=2)+'\n')
 print(json.dumps({k:v for k,v in report.items() if k!='resources'}),flush=True)
 browser.close()
assert report['passed'],report.get('failure')
