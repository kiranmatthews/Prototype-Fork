import './menu.css';
import { CRYSTAL_TRIALS } from '../levels/crystal-trials';
import { REJECTED_CRYSTAL_TRIALS } from '../levels/crystal-trials/rejects';
import type { PlaytestRuntime, PlaytestSelection } from './runtime';

const $ = (id: string) => document.getElementById(id)!;
let reject = false, selected = 0, runtime: PlaytestRuntime | undefined, loading = false;
const options = () => reject ? REJECTED_CRYSTAL_TRIALS : CRYSTAL_TRIALS;
function select(index: number) {
  selected = index;
  const trial = options()[index];
  $('challenge-options').querySelectorAll('button').forEach((button, i) => {
    button.classList.toggle('selected', i === index);
    button.setAttribute('aria-pressed', String(i === index));
  });
  $('challenge-selected').textContent = trial?.name ?? '0 / Original grid layout';
  $('challenge-description').textContent = trial?.brief ?? 'The first eight challenges in their superseded grid arrangement.';
  $('challenge-play').textContent = `Play ${trial && 'attempt' in trial ? trial.attempt : trial?.id ?? 0}`;
  const active = runtime?.selection;
  if (runtime?.finished && active?.index !== undefined) {
    $('challenge-retry').hidden = active.kind === (reject ? 'reject' : 'challenge') && active.index === index;
  }
}
function refresh() {
  $('challenge-tab').setAttribute('aria-pressed', String(!reject));
  $('reject-tab').setAttribute('aria-pressed', String(reject));
  const list = $('challenge-options'); list.replaceChildren();
  const items = options();
  items.forEach((trial, i) => {
    const button = document.createElement('button');
    button.textContent = 'attempt' in trial ? String(trial.attempt) : String(trial.id);
    button.ariaLabel = trial.name;
    button.onclick = () => select(i);
    list.appendChild(button);
  });
  if (reject) {
    const button = document.createElement('button');button.textContent = '0';
    button.ariaLabel = '0 / Original grid layout';
    button.onclick = () => select(items.length);list.appendChild(button);
  }
  list.scrollTop = 0;
  select(selected);
  $('challenge-course').textContent = reject ? 'All rejects' : 'Whole course';
}
const showMenu = (status?: string) => {
  runtime?.pause();$('challenge-menu').hidden = false;$('challenge-hud').hidden = true;
  document.body.classList.add('challenge-menu-open', 'game-shell-modal');
  const active = runtime?.selection, finished = runtime?.finished;
  $('challenge-resume').hidden = !active || !!finished;
  $('challenge-retry').hidden = !active;
  const number = active?.kind === 'challenge' && active.index !== undefined ? CRYSTAL_TRIALS[active.index].id : undefined;
  $('challenge-retry').textContent = runtime?.checkpointRetry ? 'From checkpoint'
    : finished ? (number ? `Replay ${number}` : 'Replay') : 'Retry';
  if (finished && active?.kind === 'challenge' && active.index !== undefined) {
    const next = active.index + 1;
    if (reject) { reject = false;refresh(); }
    select(next < CRYSTAL_TRIALS.length ? next : active.index);
    $('challenge-options').querySelector('.selected')?.scrollIntoView({block: 'nearest'});
  }
  $('challenge-status').textContent = status ?? 'Paused. Resume your run or choose another layout.';
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
  } catch (error) {
    showMenu('Could not load. Check your connection, then press Play to retry.');
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
