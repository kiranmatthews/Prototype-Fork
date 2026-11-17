"""Controller routes through the lightweight phone entry, with touch-sized views."""
import os,json,base64
from pathlib import Path
from playwright.sync_api import sync_playwright
ids=[int(x) for x in os.environ.get('CRYSTAL_PHONE_TRIALS','1,3,5,13,16,21,25').split(',')]
pilot_scale=float(os.environ.get('CRYSTAL_PHONE_PILOT_SCALE','1'))
url=os.environ.get('CRYSTAL_PHONE_URL','http://127.0.0.1:5173/challenge-playtest.html?touch')
with sync_playwright() as pw:
 browser=pw.chromium.launch(executable_path='/usr/bin/chromium',headless=True,args=['--no-sandbox','--disable-dev-shm-usage','--use-angle=swiftshader','--enable-unsafe-swiftshader'])
 page=browser.new_page(viewport={'width':844,'height':390},is_mobile=True,has_touch=True,device_scale_factor=1,service_workers='block')
 page.route_web_socket('**',lambda s:s.send('{"type":"connected"}'))
 page.set_default_timeout(900000)
 errors=[]
 page.on('pageerror',lambda e:errors.append(str(e)))
 page.on('console',lambda m:errors.append(m.text) if m.type=='error' else None)
 page.goto(url,wait_until='networkidle')
 for trial in ids:
  out=Path(os.environ.get('CRYSTAL_PHONE_OUT','/workspace/crystal-trials')) / f'{trial:02}';out.mkdir(parents=True,exist_ok=True)
  report={'trial':trial,'url':url,'errors':errors,'passed':False,'pilotRenderScale':pilot_scale}
  try:
   page.locator('#challenge-tab').tap();page.locator('#challenge-options button').nth(trial-1).tap();page.locator('#challenge-play').tap()
   page.wait_for_function('i=>window.__game?.getCurrentLevel().id===`phone-challenge-${i}` && !window.__game.paused',arg=trial-1)
   page.evaluate('window.__game.renderer.setPixelRatio(1)')
   start=page.evaluate('window.__game.frameStats.totalFixedSteps');page.wait_for_function('n=>window.__game.frameStats.totalFixedSteps>n+12',arg=start)
   page.screenshot(path=str(out/'phone-approach-landscape.png'))
   page.evaluate('scale=>window.__game.renderer.setPixelRatio(scale)',pilot_scale)
   page.evaluate('''async id => (await import('http://127.0.0.1:5173/tools/crystal-trials-browser-runtime.mjs')).installCrystalTrialPilot(id)''',trial)
   page.wait_for_function('window.crystalTrialReport.done')
   report['pilot']=page.evaluate('window.crystalTrialReport')
   assert not report['pilot']['failure'],report['pilot']
   assert report['pilot']['deaths']==report['pilot'].get('expectedDeaths',0)
   page.wait_for_function('window.__game.paused && !document.getElementById("challenge-menu").hidden')
   assert page.locator('#challenge-resume').is_hidden(), 'A finished run offered Resume'
   assert page.locator('#challenge-play').inner_text()==f'Play {min(trial+1,25)}'
   if trial<25: assert page.locator('#challenge-retry').inner_text()==f'Replay {trial}'
   else: assert page.locator('#challenge-retry').is_hidden()
   page.screenshot(path=str(out/'phone-returned-landscape.png'))
   page.set_viewport_size({'width':390,'height':844})
   start=page.evaluate('window.__game.frameStats.frame');page.wait_for_function('n=>window.__game.frameStats.frame>n+6',arg=start)
   page.screenshot(path=str(out/'phone-returned-portrait.png'))
   assert not errors,errors
   report['passed']=True
  except Exception as e:
   report['failure']=str(e)
   try:report['pilotAtFailure']=page.evaluate('window.crystalTrialReport')
   except Exception:pass
  (out/'browser-phone.json').write_text(json.dumps(report,indent=2)+'\n')
  print(json.dumps({'trial':trial,'passed':report['passed'],'failure':report.get('failure')}),flush=True)
  assert report['passed'],report.get('failure')
  page.set_viewport_size({'width':844,'height':390})
  if not page.evaluate('window.__game.paused'): page.locator('.tc-pause').tap()
  page.wait_for_function('window.__game.paused')
 browser.close()
