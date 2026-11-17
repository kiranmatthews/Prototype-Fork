"""Full game renderer review of the revised, source-owned skating collection."""
import json,os,subprocess,base64
from pathlib import Path
from playwright.sync_api import sync_playwright
root=Path(__file__).resolve().parents[1]
evidence=Path(os.environ.get('CRYSTAL_SKATE_OUT','/workspace/crystal-sequences'))
out=evidence/'full';out.mkdir(parents=True,exist_ok=True)
exported=subprocess.run(['node','--input-type=module','-e','''
import {createServer} from 'vite';
const s=await createServer({configFile:false,server:{middlewareMode:true,hmr:false},appType:'custom',logLevel:'error'});
try {const m=await s.ssrLoadModule('/src/levels/crystal-trials.ts');console.log(JSON.stringify(m.CRYSTAL_TRIALS.map(t=>({id:`crystal-skate-review-${t.id}`,name:t.name,data:m.trialLevel(t)}))));}finally{await s.close();}
'''],cwd=root,check=True,capture_output=True,text=True)
entries=json.loads(exported.stdout)
ids=[int(x) for x in os.environ.get('CRYSTAL_REVIEW_IDS',','.join(str(i) for i in range(1,26))).split(',')]
with sync_playwright() as pw:
 browser=pw.chromium.launch(executable_path='/usr/bin/chromium',headless=True,args=['--no-sandbox','--disable-dev-shm-usage','--use-angle=swiftshader','--enable-unsafe-swiftshader'])
 page=browser.new_page(viewport={'width':480,'height':270},service_workers='block');page.set_default_timeout(600000)
 page.route_web_socket('**',lambda s:s.send('{"type":"connected"}'))
 page.add_init_script('localStorage.setItem("solProtoUserLevels",'+json.dumps(json.dumps(entries))+');localStorage.setItem("solProtoRenderQuality.v1",JSON.stringify({version:3,enabled:false,baseHeight:720,outputMultiplier:1,fixed60:true}));')
 errors=[];page.on('pageerror',lambda e:errors.append(str(e)));page.on('console',lambda m:errors.append(m.text) if m.type=='error' else None)
 page.goto('http://127.0.0.1:5173/?playtest&level=crystal-skate-review-'+str(ids[0]),wait_until='domcontentloaded')
 page.wait_for_function('window.__game?.getCurrentLevel().id.startsWith("crystal-skate-review") && !window.__game.gameFlow.blocksGameplay && !document.getElementById("game-startup")')
 page.evaluate('window.__game.campaign.startEphemeral();window.__game.renderQualitySettings.setRegularResolution(null);window.__game.crtGuestSettings.setEnabled(false)')
 def frames(n):
  f=page.evaluate('window.__game.frameStats.frame');page.wait_for_function('f=>window.__game.frameStats.frame>=f',arg=f+n)
 for i in ids:
  entry=entries[i-1];report={'id':i,'errors':errors,'passed':False,'scope':'Full renderer at 1280x720; staged views are labelled separately from input routes.'}
  try:
   if i!=ids[0]:
    assert page.evaluate('id=>window.__game.switchLevel(id)',entry['id'])
    page.wait_for_function('id=>window.__game.getCurrentLevel().id===id&&!window.__game.gameFlow.blocksGameplay',arg=entry['id'])
   page.evaluate('window.__game.trialOffset=[0,0,0]');frames(3)
   views=[]
   native=json.loads((evidence/f'{i:02}-native.json').read_text());assert native['passed']
   trace=json.loads((evidence/f'{i:02}-trace.json').read_text())
   approach=next(q for q in trace if q['p'][2]<=-4.5)
   views.append({'name':'approach','position':approach['p'],'heading':approach['heading']})
   first=next(q for q in trace if q['collected'])
   before=trace[max(0,first['frame']-40)]
   views.append({'name':'crystal-approach','position':before['p'],'heading':before['heading']})
   for section in native['sections']:
    if section['kind']==18:
     pop=next(e for e in section['evidence'] if e['action']=='grind pop')
     rider=trace[pop['frame']-18]
     views.append({'name':'moving-rail-landing','position':rider['p'],'heading':rider['heading']})
   if any(c.get('kind')=='nitrobang' for c in entry['data']['components']):
    rider=trace[-40]
    views.append({'name':'exit-approach','position':rider['p'],'heading':rider['heading']})
   if i==2:views.append({'name':'recovery-bank','position':[34,-7.85,-26],'heading':[0,0,1]})
   page.evaluate('window.__fixturePlayerStep=window.__game.player.step;window.__game.player.step=()=>{}')
   for view in views:
    page.evaluate('q=>{const g=window.__game,p=g.player;p.respawn(g.getLevel(),true,false,{position:p.pos.clone().fromArray(q.position),heading:p.axisF.clone().fromArray(q.heading??[0,0,-1])});p.snapRenderInterpolation();}',view)
    frames(3);page.set_viewport_size({'width':1280,'height':720});page.evaluate('window.dispatchEvent(new Event("resize"))');frames(2)
    page.screenshot(path=str(out/f'{i:02}-{view["name"]}.jpg'),type='jpeg',quality=88)
    view['render']=page.evaluate('[window.__game.renderer.domElement.width,window.__game.renderer.domElement.height]')
    assert view['render']==[1280,720]
    if i==5 and view['name']=='crystal-approach':
     view['ringTopPixels']=page.evaluate('''() => {
       const g=window.__game, token=g.getLevel().skateCollectathon.tokens[0];
       const ring=token.group.children.find(child=>child.geometry?.type==='TorusGeometry');
       const vertices=ring.geometry.getAttribute('position'), point=ring.position.clone();
       let top=-Infinity;
       for(let i=0;i<vertices.count;i++){
         point.fromBufferAttribute(vertices,i).applyMatrix4(ring.matrixWorld).project(g.camera);
         top=Math.max(top,point.y);
       }
       return (1-top)*g.renderer.domElement.height/2;
     }''')
     assert view['ringTopPixels']>=12,'The halfpipe crystal clips the top of the frame'
    page.set_viewport_size({'width':320,'height':180})
   page.evaluate('window.__game.player.step=window.__fixturePlayerStep;delete window.__fixturePlayerStep')
   report['stagedVisualFixtures']=views
   report['fixtureNote']='Player simulation is frozen at each explicitly staged pose; this avoids a midair fixture falling before its screenshot. Moving geometry still renders normally.'
   report['nativeSourceHash']=native.get('sourceHash')
   if i==ids[-1]:
    page.evaluate('()=>{const g=window.__game;g.player.respawn(g.getLevel(),true);g.player.snapRenderInterpolation();}')
    page.evaluate('async id=>(await import("/tools/crystal-trials-browser-runtime.mjs")).installCrystalTrialPilot(id)',i)
    page.wait_for_function('window.crystalTrialReport.done');report['pilot']=page.evaluate('window.crystalTrialReport');assert not report['pilot']['failure'],report['pilot']
   assert not errors,errors;report['passed']=True
  except Exception as e:report['failure']=str(e)
  (out/f'{i:02}-review.json').write_text(json.dumps(report,indent=2)+'\n');print(json.dumps({'id':i,'passed':report['passed'],'failure':report.get('failure')}),flush=True)
  assert report['passed'],report.get('failure')
 browser.close()
