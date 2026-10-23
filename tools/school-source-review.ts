import { OrthographicCamera, Vector3 } from 'three';
import { SCHOOL_SOURCE_LEVEL, SCHOOL_SOURCE_PLACES, SCHOOL_SOURCE_SCALE, SCHOOL_SOURCE_STATS, schoolSourcePlacement, schoolOriginalPoint } from '../src/levels/school-source';
import { runSchoolSourceBrowserChecks } from './school-source-lines';
import { runSchoolScaleMeasurement } from './school-source-scale';
const frame = document.createElement('iframe'), status = document.querySelector<HTMLDivElement>('#status')!;
const full = new URLSearchParams(location.search).has('full'), errors: string[] = [];
let game: any, checks: ReturnType<typeof runSchoolSourceBrowserChecks> | undefined, scaleMeasurement: ReturnType<typeof runSchoolScaleMeasurement> | undefined, overview = false;
const camera = new OrthographicCamera(-350, 350, 280, -280, .1, 1800);
camera.position.set(300, 650, 650); camera.lookAt(-30, -10, -70);
frame.id = 'game'; frame.title = 'School original geometry game'; frame.src = '/?playtest&level=school-miami' + (full ? '' : '&lite');
document.querySelector('#game-host')!.replaceWith(frame);
function bind() {
  const w = frame.contentWindow as any; if (!w?.__game) { setTimeout(bind, 250); return; }
  if (game === w.__game) return; game = w.__game;
  // This inspection session must stay playable after idle auto-kick falls.
  // Leave the saved game mode and production level settings untouched.
  game.player.endlessDeaths = true;
  const render = game.renderer.render.bind(game.renderer);
  game.renderer.render = (scene: any, current: any) => {
    if (!overview || scene !== game.scene) return render(scene, current);
    const fog = scene.fog; scene.fog = null; camera.left = -280 * current.aspect; camera.right = 280 * current.aspect; camera.updateProjectionMatrix();
    try { return render(scene, camera); } finally { scene.fog = fog; }
  };
  w.addEventListener('error', (e: ErrorEvent) => errors.push(e.message));
  const original = w.console.error.bind(w.console); w.console.error = (...a: unknown[]) => { errors.push(a.map(String).join(' ')); original(...a); };
}
frame.addEventListener('load', bind); bind();
for (const place of SCHOOL_SOURCE_PLACES) {
  const button = document.createElement('button'); button.textContent = place.name;
  button.onclick = () => { if (!game) return; overview = false; const p = game.player;
    p.respawn(game.getLevel(), true, true, { position: new Vector3(...schoolSourcePlacement(place)), heading: new Vector3(...place.heading) });
    p.speed = 0; p.freeSkate = true; p.axisF.set(...place.heading); p.axisL.set(place.heading[2], 0, -place.heading[0]); frame.contentWindow?.focus();
  }; document.querySelector('#places')!.append(button);
}
document.querySelector('#overview')!.addEventListener('click', () => { overview = true; });
document.querySelector('#play')!.addEventListener('click', () => { overview = false; frame.contentWindow?.focus(); });
document.querySelector('#checks')!.addEventListener('click', () => { if (!game || checks?.running || scaleMeasurement?.running) return; overview = false; checks = runSchoolSourceBrowserChecks(game); });
document.querySelector('#route')!.addEventListener('click', () => { if (!game || checks?.running || scaleMeasurement?.running) return; overview = false; checks = runSchoolSourceBrowserChecks(game, true); });
document.querySelector('#rail-approach')!.addEventListener('click', () => { if (!game || checks?.running || scaleMeasurement?.running) return; overview = false; checks = runSchoolSourceBrowserChecks(game, false, /courtyard ollie/); });
document.querySelector('#boundary-grind')!.addEventListener('click', () => { if (!game || checks?.running || scaleMeasurement?.running) return; overview = false; checks = runSchoolSourceBrowserChecks(game, false, /Original rail 797/); });
document.querySelector('#roof-drop')!.addEventListener('click', () => { if (!game || checks?.running || scaleMeasurement?.running) return; overview = false; checks = runSchoolSourceBrowserChecks(game, false, /roof drop/); });
document.querySelector('#measure')!.addEventListener('click', () => { if (!game || checks?.running || scaleMeasurement?.running) return; overview = false; scaleMeasurement = runSchoolScaleMeasurement(game); });
document.querySelector('#full')!.textContent = full ? 'Lite render' : 'Full render';
document.querySelector('#full')!.addEventListener('click', () => { location.search = full ? '' : '?full'; });
setInterval(() => {
  if (!game) return; const p = game.player;
  status.textContent = JSON.stringify({ level: game.getCurrentLevel().name, unitScale: SCHOOL_SOURCE_SCALE, components: SCHOOL_SOURCE_LEVEL.components.length, ...SCHOOL_SOURCE_STATS, grounded: p.grounded, state: p.state, pos: p.pos.toArray(), sourcePosition: schoolOriginalPoint(...p.pos.toArray() as [number, number, number]), speed: p.speed, checks, scaleMeasurement, errors, startupErrors: { preview: (window as any).__schoolStartupErrors ?? [], game: (frame.contentWindow as any).__schoolStartupErrors ?? [] } });
}, 300);
