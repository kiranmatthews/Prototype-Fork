import './menu.css';
import { CRYSTAL_TRIALS } from '../levels/crystal-trials';
import { REJECTED_CRYSTAL_TRIALS } from '../levels/crystal-trials/rejects';
import type { PlaytestRuntime, PlaytestSelection } from './runtime';

const $ = (id: string) => document.getElementById(id)!;
let reject = false, selected = 0, runtime: PlaytestRuntime | undefined, loading = false;
const options = () => reject ? REJECTED_CRYSTAL_TRIALS : CRYSTAL_TRIALS;
function refresh() {
  $('challenge-tab').setAttribute('aria-pressed', String(!reject));
  $('reject-tab').setAttribute('aria-pressed', String(reject));
  const list = $('challenge-options'); list.replaceChildren();
  const items = options();
  items.forEach((trial, i) => {
    const button = document.createElement('button');
    button.textContent = 'attempt' in trial ? String(trial.attempt) : String(trial.id);
    button.ariaLabel = trial.name;
    button.classList.toggle('selected', i === selected);
    button.setAttribute('aria-pressed', String(i === selected));
    button.onclick = () => { selected = i; refresh(); };
    list.appendChild(button);
  });
  if (reject) {
    const button = document.createElement('button');button.textContent = '0';
    button.ariaLabel = '0 / Original grid layout';button.classList.toggle('selected', selected === items.length);
    button.onclick = () => { selected = items.length;refresh(); };list.appendChild(button);
  }
  const trial = items[selected];
  $('challenge-selected').textContent = trial?.name ?? '0 / Original grid layout';
  $('challenge-description').textContent = trial?.brief ?? 'The first eight challenges in their superseded grid arrangement.';
  $('challenge-course').textContent = reject ? 'All rejects' : 'Whole course';
}
const showMenu = (status?: string) => {
  runtime?.pause();$('challenge-menu').hidden = false;$('challenge-hud').hidden = true;
  document.body.classList.add('challenge-menu-open', 'game-shell-modal');
  $('challenge-resume').hidden = !runtime;$('challenge-retry').hidden = !runtime;
  if (status) $('challenge-status').textContent = status;
};
const resume = () => {
  $('challenge-menu').hidden = true;$('challenge-hud').hidden = false;
  document.body.classList.remove('challenge-menu-open', 'game-shell-modal');runtime?.resume();
};
async function play(course = false) {
  if (loading) return;loading = true;
  const buttons = document.querySelectorAll<HTMLButtonElement>('#challenge-menu button');buttons.forEach(b => b.disabled = true);
  $('challenge-status').textContent = 'Loading the playtest…';
  try {
    runtime ??= await (await import('./runtime')).createPlaytest(showMenu);
    const selection: PlaytestSelection = selected === options().length && reject && !course
      ? { kind: 'grid' } : { kind: reject ? 'reject' : 'challenge', index: course ? undefined : selected };
    await runtime.load(selection);resume();
    $('challenge-status').textContent = 'Paused. Resume your run or choose another layout.';
  } catch (error) {
    $('challenge-status').textContent = 'Could not load. Check your connection, then press Play to retry.';
    console.error(error);
  } finally { loading = false;buttons.forEach(b => b.disabled = false); }
}
$('challenge-tab').onclick = () => { reject = false;selected = 0;refresh(); };
$('reject-tab').onclick = () => { reject = true;selected = 0;refresh(); };
$('challenge-play').onclick = () => void play();
$('challenge-course').onclick = () => void play(true);
$('challenge-resume').onclick = resume;
$('challenge-retry').onclick = () => { runtime?.retry();resume(); };
refresh();
