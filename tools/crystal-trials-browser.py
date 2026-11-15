"""Review one source-owned crystal trial in the running app."""
import base64
import json
import os
import hashlib
import re
import fcntl
import subprocess
from pathlib import Path
from playwright.sync_api import sync_playwright

trial = int(os.environ.get('CRYSTAL_TRIAL', '1'))
mode = os.environ.get('CRYSTAL_RENDER', 'lite')
out = Path(f'/workspace/crystal-trials/{trial:02}')
out.mkdir(parents=True, exist_ok=True)
# Independent queues share a result only for the same source snapshot.
lock = open(f'/tmp/crystal-browser-{trial}-{mode}.lock', 'w')
fcntl.flock(lock, fcntl.LOCK_EX)
root = Path(__file__).resolve().parents[1]
files = set()
def collect(path):
    path = path.resolve()
    if path in files or not path.exists(): return
    files.add(path)
    for rel in re.findall(r"from ['\"](\.[^'\"]+)['\"]", path.read_text()):
        base = path.parent / rel
        for suffix in ('', '.ts', '.mjs'):
            dependency = Path(str(base) + suffix)
            if dependency.is_file() and 'src/levels/crystal-trials/' in str(dependency.resolve()): collect(dependency)
collect(root / f'src/levels/crystal-trials/{trial:02}.ts')
for name in ['src/level.ts','src/player.ts','src/main.ts','src/tuning.ts','src/skateCollectathon.ts',
             'tools/puzzle-controls.mjs','tools/crystal-trials-browser-runtime.mjs','tools/crystal-trials-pilots/common.mjs',
             f'tools/crystal-trials-pilots/{trial}.mjs' if trial > 10 else 'tools/crystal-trials-pilot.mjs']:
    files.add(root / name)
if mode == 'lite': files.add(root / 'src/levels/crystal-trials.ts')
fingerprint = hashlib.sha256(b''.join(str(p.relative_to(root)).encode()+p.read_bytes() for p in sorted(files))).hexdigest()
previous = out / f'browser-{mode}.json'
if previous.exists():
    old = json.loads(previous.read_text())
    if old.get('passed') and old.get('fingerprint') == fingerprint:
        print(json.dumps({'trial':trial,'mode':mode,'passed':True,'reusedExactSource':True}),flush=True)
        raise SystemExit(0)
report = {'trial': trial, 'mode': mode, 'errors': [], 'fingerprint': fingerprint}
visual_review = mode == 'full' and os.environ.get('CRYSTAL_FULL_ROUTE') != '1'
if visual_review:
    lite = json.loads((out / 'browser-lite.json').read_text())
    lite_files = files | {root / 'src/levels/crystal-trials.ts'}
    lite_fingerprint = hashlib.sha256(b''.join(str(p.relative_to(root)).encode()+p.read_bytes() for p in sorted(lite_files))).hexdigest()
    assert lite.get('passed') and not lite.get('errors') and lite.get('fingerprint') == lite_fingerprint, 'Current-source browser route must pass before full-render fixtures'
    report['routeEvidence'] = 'browser-lite.json'
if mode == 'full':
    for old_picture in out.glob('full-*.png'): old_picture.unlink()

# Load the source trial directly through the ordinary user-level registry. This
# avoids constructing the entire full-render corridor before an isolated review.
initial_id = 'crystal-trials'
initial_entry = None
if mode == 'full':
    exported = subprocess.run(['node', '--input-type=module', '-e', '''
      import {createServer} from 'vite';
      const server=await createServer({configFile:false,server:{middlewareMode:true,hmr:false},appType:'custom',logLevel:'error'});
      try {
        const m=await server.ssrLoadModule('/src/levels/crystal-trials.ts');
        const t=m.CRYSTAL_TRIALS.find(t=>t.id===Number(process.argv[1]));
        console.log(JSON.stringify(m.trialLevel(t)));
      } finally {await server.close();}
    ''', str(trial)], cwd=root, check=True, capture_output=True, text=True)
    data = json.loads(exported.stdout)
    initial_id = f'crystal-review-{trial}'
    initial_entry = {'id':initial_id,'name':data['name'],'data':data}

with sync_playwright() as pw:
    browser = pw.chromium.launch(executable_path='/usr/bin/chromium', headless=True,
        args=['--no-sandbox', '--disable-dev-shm-usage', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'])
    page = browser.new_page(viewport={'width': 480, 'height': 270}, service_workers='block')
    # Freeze this review's loaded module graph while later challenges are authored.
    page.route_web_socket('**', lambda socket: socket.send('{"type":"connected"}'))
    page.set_default_timeout(900000)
    page.add_init_script("localStorage.setItem('solProtoRenderQuality.v1',JSON.stringify({version:3,enabled:false,baseHeight:720,outputMultiplier:1,fixed60:true}))")
    if initial_entry:
        page.add_init_script('localStorage.setItem("solProtoUserLevels",'+json.dumps(json.dumps([initial_entry]))+')')
    page.on('pageerror', lambda e: report['errors'].append(str(e)))
    page.on('console', lambda m: report['errors'].append(m.text) if m.type == 'error' else None)

    def save():
        (out / f'browser-{mode}.json').write_text(json.dumps(report, indent=2) + '\n')

    def frames(count):
        frame = page.evaluate('window.__game.frameStats.frame')
        page.wait_for_function('f => window.__game.frameStats.frame >= f', arg=frame + count)

    def capture(name):
        data = page.evaluate('window.__game.captureBonusReviewFrame()')
        assert data and data.startswith('data:image/png;base64,')
        (out / f'{mode}-{name}.png').write_bytes(base64.b64decode(data.split(',')[1]))
        report.setdefault('views', []).append(page.evaluate('''name => {
          const g = window.__game; return {name, position:g.player.pos.toArray(),
          camera:g.camera.position.toArray(), render:[g.renderer.domElement.width,g.renderer.domElement.height],
          gl:g.renderer.getContext().getError(), crystals:g.getLevel().skateCollectathon.tokens.filter(t=>!t.collected)
          .map(t=>({name:t.name,screen:t.group.position.clone().project(g.camera).toArray()}))}; }''', name))
        save()

    try:
        page.goto('http://127.0.0.1:5173/?playtest&level=' + initial_id + ('&lite' if mode == 'lite' else ''), wait_until='domcontentloaded')
        page.wait_for_function('id => window.__game?.getCurrentLevel().id === id && !window.__game.gameFlow.blocksGameplay && !document.getElementById("game-startup")', arg=initial_id)
        report['initial'] = page.evaluate('''() => { const g=window.__game;
          g.renderQualitySettings.setRegularResolution(null);g.crtGuestSettings.setEnabled(false);g.campaign.startEphemeral();
          return {spawn:g.player.pos.toArray(),crystals:g.getLevel().skateCollectathon.tokens.length}; }''')
        # The full renderer reviews the independently reusable source trial.
        # The lite pass and continuous native pass review its course placement.
        if mode == 'full':
            report['scope'] = 'Standalone source trial in the full game renderer'
            page.evaluate('window.__game.trialOffset=[0,0,0]')
        # A staged normal start is permitted before a trial; all traversal after
        # it uses controller samples in the real application loop.
        if trial > 1 or mode == 'full':
            report['stagedStart'] = page.evaluate('''async id => {
              const m=await import('/src/levels/crystal-trials.ts'),g=window.__game,p=g.player;
              const index=m.CRYSTAL_TRIALS.findIndex(t=>t.id===id),trial=m.CRYSTAL_TRIALS[index],o=g.trialOffset??m.trialOrigin(index);
              const position=p.pos.clone().fromArray(trial.spawn.map((v,i)=>v+o[i]));
              p.respawn(g.getLevel(),true,false,{position,heading:p.axisF.clone().set(0,0,-1)});
              p.snapRenderInterpolation();return p.pos.toArray();}''', trial)
        frames(12)
        if mode == 'full':
            page.set_viewport_size({'width': 1280, 'height': 720})
            page.evaluate('window.dispatchEvent(new Event("resize"))')
            page.wait_for_function('window.__game.renderer.domElement.width===1280')
            frames(5)
            capture('approach')
            page.set_viewport_size({'width': 320, 'height': 180})
        if visual_review:
            report['scope'] = 'Full-resolution visual fixtures; current-source real-input course route in browser-lite.json'
            native = json.loads((out / 'native.json').read_text())
            assert native.get('passed'), 'Native route must pass before reviewing its return position'
            position = native['result']['position']
            page.evaluate('''q => {const g=window.__game,p=g.player;
              p.respawn(g.getLevel(),true,false,{position:p.pos.clone().fromArray(q),heading:p.axisF.clone().set(0,0,-1)});
              p.snapRenderInterpolation();}''', position)
            report.setdefault('stagedVisualFixtures', []).append({'name':'return-fixture','position':position})
            frames(12)
        else:
            report['installed'] = page.evaluate('''async id => (await import('/tools/crystal-trials-browser-runtime.mjs')).installCrystalTrialPilot(id)''', trial)
            save()
            page.wait_for_function('window.crystalTrialReport.done')
            report['pilot'] = page.evaluate('window.crystalTrialReport')
            assert not report['pilot']['failure'], report['pilot']
            assert report['pilot']['deaths'] == report['pilot'].get('expectedDeaths', 0), report['pilot']
        if mode == 'full':
            page.set_viewport_size({'width': 1280, 'height': 720})
            page.evaluate('window.dispatchEvent(new Event("resize"))')
            page.wait_for_function('window.__game.renderer.domElement.width===1280')
            frames(3)
        capture('return-fixture' if visual_review else 'returned')
        if mode == 'full':
            page.set_viewport_size({'width': 320, 'height': 180})
            fixtures = page.evaluate('''async id => {
              const m=await import('/src/levels/crystal-trials.ts');
              return m.CRYSTAL_TRIALS.find(t=>t.id===id).reviewViews??[];}''', trial)
            for fixture in fixtures:
                page.evaluate('''async q => {
                  const m=await import('/src/levels/crystal-trials.ts'),g=window.__game,p=g.player;
                  const o=g.trialOffset??m.trialOrigin(m.CRYSTAL_TRIALS.findIndex(t=>t.id===q.id));
                  p.respawn(g.getLevel(),true,false,{position:p.pos.clone().fromArray(q.position.map((v,i)=>v+o[i])),heading:p.axisF.clone().set(0,0,-1)});
                  p.snapRenderInterpolation();}''', {'id': trial, **fixture})
                frames(12)
                page.set_viewport_size({'width': 1280, 'height': 720})
                page.evaluate('window.dispatchEvent(new Event("resize"))')
                page.wait_for_function('window.__game.renderer.domElement.width===1280')
                frames(3)
                capture(fixture['name'])
                report.setdefault('stagedVisualFixtures', []).append(fixture)
                page.set_viewport_size({'width': 320, 'height': 180})
        assert not report['errors'], report['errors']
        report['passed'] = True
    except Exception as error:
        try: report['pilotAtFailure'] = page.evaluate('window.crystalTrialReport')
        except Exception: pass
        report['passed'] = False
        report['failure'] = str(error)
    save()
    print(json.dumps(report), flush=True)
    browser.close()
assert report['passed'], report.get('failure')
