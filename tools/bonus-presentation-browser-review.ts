// Dev-only, visible controls for reviewing production bonus presentation.
import '../src/main';
const status = document.querySelector('#status')!;
const errors: string[] = [];
window.addEventListener('error', event => errors.push(event.message));
const samples: object[] = [];
let previous = '', jumpTimer = 0;
const game = () => (window as any).__game;
const act = (id: string, action: (g: any) => void) => document.querySelector(id)!.addEventListener('click', () => {
  const g = game(); if (g && !g.gameFlow.blocksGameplay) action(g);
  (document.activeElement as HTMLElement)?.blur();
});
act('#pad', g => {
  const pad = g.getLevel().bonusPlatformDiagnostics;
  if (!pad) return;
  g.player.pos.set(pad.x, pad.topY + 0.02, pad.z);
  g.player.settle(g.getLevel());
  g.player.prepareStartPresentation(g.getLevel());
  g.getLevel().cancelBonusEntry();
  samples.length = 0;
});
act('#jump', () => {
  window.dispatchEvent(new KeyboardEvent('keydown', {code: 'Space', key: ' ', bubbles: true}));
  window.clearTimeout(jumpTimer);
  jumpTimer = window.setTimeout(() => window.dispatchEvent(new KeyboardEvent('keyup', {code:'Space',key:' ',bubbles:true})), 180);
});
act('#fail', g => { g.player.pos.y = g.getLevel().killY - 2; g.player.grounded = false; });
act('#finish', g => {
  const gate = g.getLevel().captureData().components.find((c: any) => c.t === 'gate');
  if (!gate) return;
  g.player.pos.set(gate.p[0], gate.p[1] + .1, gate.p[2]);
  g.player.settle(g.getLevel()); g.player.prepareStartPresentation(g.getLevel());
});
document.querySelector('#hide')!.addEventListener('click', () => (document.querySelector('#review') as HTMLElement).hidden = true);
function review() {
  requestAnimationFrame(review);
  const g = game(); if (!g) return;
  const p = g.player, departure = g.getBonusDeparture();
  const state = { level:g.getCurrentLevel().id, phase:departure?.phase ?? g.gameFlow.loadingPhase ?? 'play',
    elapsed:departure?.elapsed, lift:departure?.offsetY, runTime:p.runTime, position:p.pos.toArray(),
    grounded:p.grounded, state:p.state, camera:g.camera.position.toArray(), lives:p.lives, fruit:p.fruit,
    completed:g.getLevel().bonusRoundCompleted, hudBonus:document.querySelector('.game-hud-layer')?.classList.contains('hud-bonus'),
    errors };
  const marker = state.level + ':' + state.phase;
  if (marker !== previous || (departure && samples.length < 150)) { samples.push({...state}); previous=marker; }
  status.textContent = JSON.stringify({current:state, transitions:samples.filter((_:object,i:number)=>!i||(samples[i-1] as any).phase!==(samples[i] as any).phase)},null,1);
  (window as any).bonusReview = { samples, errors };
}
review();
