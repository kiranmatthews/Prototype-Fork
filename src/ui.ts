// DOM debug/tuning overlay: live stats on the left, tuning sliders on the
// right, big center messages for death/finish. Deliberately ugly and dense.

import { LEVEL_NAMES } from './level';
import { TUNING, TUNING_RANGES, TuningKey } from './tuning';

export interface Stats {
  speed: number;
  state: string;
  grounded: boolean;
  vVel: number;
  surface: string;
  controller: string;
  railDist: number;
  crates: string;
  fruit: number;
  time: number;
}

export class UI {
  private statsEl: HTMLElement;
  private msgTitle: HTMLElement;
  private msgSub: HTMLElement;
  private msgWrap: HTMLElement;
  private flashEl: HTMLElement;
  private balanceWrap: HTMLElement;
  private balanceNeedle: HTMLElement;
  private msgTimer: number | undefined;
  private levelButtons: HTMLElement[] = [];

  // wired up by main.ts
  onLevelSelect: (id: number) => void = () => {};

  constructor() {
    this.injectStyle();

    const statsWrap = div('hud-stats');
    const levelRow = div('hud-levelrow');
    LEVEL_NAMES.forEach((name, i) => {
      const btn = document.createElement('button');
      btn.className = 'hud-levelbtn';
      btn.textContent = `${i + 1}· ${name}`;
      btn.addEventListener('click', () => {
        this.onLevelSelect(i);
        btn.blur(); // give the keyboard back to the game
      });
      levelRow.appendChild(btn);
      this.levelButtons.push(btn);
    });
    statsWrap.appendChild(levelRow);
    const stats = div('hud-statlines');
    statsWrap.appendChild(stats);
    this.statsEl = stats;

    const panel = div('hud-tuning');
    panel.innerHTML = '<div class="hud-title">TUNING</div>';
    for (const key of Object.keys(TUNING_RANGES) as TuningKey[]) {
      panel.appendChild(this.sliderRow(key));
    }

    const help = div('hud-help');
    help.textContent =
      'stick/arrows: up=go down=back left/right=sidestep (also in air) · X/Space: jump · ' +
      'Triangle/E: hold to grind (balance with left/right!) · Square/F: spin · ' +
      'Circle/Q: air grab / ground slide (jump out for distance) · R/Options: restart run';

    this.msgWrap = div('hud-msg');
    this.msgTitle = div('hud-msg-title');
    this.msgSub = div('hud-msg-sub');
    this.msgWrap.appendChild(this.msgTitle);
    this.msgWrap.appendChild(this.msgSub);
    this.msgWrap.style.display = 'none';

    this.flashEl = div('hud-flash');

    // THPS-style grind balance meter (visible only while grinding).
    this.balanceWrap = div('hud-balance');
    this.balanceNeedle = div('hud-balance-needle');
    const balanceCenter = div('hud-balance-center');
    this.balanceWrap.appendChild(balanceCenter);
    this.balanceWrap.appendChild(this.balanceNeedle);
    this.balanceWrap.style.display = 'none';

    for (const el of [statsWrap, panel, help, this.msgWrap, this.flashEl, this.balanceWrap]) {
      document.body.appendChild(el);
    }
  }

  setLevel(id: number): void {
    this.levelButtons.forEach((b, i) => b.classList.toggle('active', i === id));
  }

  // value in [-1, 1]; pegging either end is a bail.
  updateBalance(visible: boolean, value: number): void {
    this.balanceWrap.style.display = visible ? 'block' : 'none';
    if (!visible) return;
    const pct = 50 + value * 46;
    this.balanceNeedle.style.left = pct + '%';
    this.balanceNeedle.style.background = Math.abs(value) > 0.7 ? '#e2483d' : '#8fd4a8';
  }

  setStats(s: Stats): void {
    const railDist = isFinite(s.railDist) ? s.railDist.toFixed(2) + 'm' : '-';
    this.statsEl.innerHTML =
      `<div class="hud-title">DEBUG</div>` +
      row('speed', s.speed.toFixed(1)) +
      row('state', s.state) +
      row('grounded', String(s.grounded)) +
      row('vVel', s.vVel.toFixed(1)) +
      row('surface', s.surface) +
      row('controller', s.controller) +
      row('rail dist', railDist) +
      row('crates', s.crates) +
      row('wumpa', String(s.fruit)) +
      row('time', s.time.toFixed(2) + 's');
  }

  // durationMs = 0 keeps the message up until the next showMessage/hide.
  showMessage(title: string, sub: string, durationMs: number): void {
    this.msgTitle.textContent = title;
    this.msgSub.textContent = sub;
    this.msgWrap.style.display = 'block';
    if (this.msgTimer !== undefined) window.clearTimeout(this.msgTimer);
    if (durationMs > 0) {
      this.msgTimer = window.setTimeout(() => this.hideMessage(), durationMs);
    }
  }

  hideMessage(): void {
    this.msgWrap.style.display = 'none';
  }

  flash(): void {
    this.flashEl.style.transition = 'none';
    this.flashEl.style.opacity = '0.55';
    requestAnimationFrame(() => {
      this.flashEl.style.transition = 'opacity 0.45s';
      this.flashEl.style.opacity = '0';
    });
  }

  private sliderRow(key: TuningKey): HTMLElement {
    const range = TUNING_RANGES[key];
    const wrap = div('hud-slider');
    const label = document.createElement('label');
    label.textContent = key;
    const value = document.createElement('span');
    value.textContent = String(TUNING[key]);
    const input = document.createElement('input');
    input.type = 'range';
    input.min = String(range.min);
    input.max = String(range.max);
    input.step = String(range.step);
    input.value = String(TUNING[key]);
    input.addEventListener('input', () => {
      TUNING[key] = Number(input.value);
      value.textContent = input.value;
    });
    // Keep slider drags from stealing keyboard control of the game.
    input.addEventListener('change', () => input.blur());
    wrap.appendChild(label);
    wrap.appendChild(input);
    wrap.appendChild(value);
    return wrap;
  }

  private injectStyle(): void {
    const style = document.createElement('style');
    style.textContent = `
      .hud-stats, .hud-tuning, .hud-help {
        position: fixed; z-index: 10; color: #cfe3d8;
        font: 12px/1.5 ui-monospace, Menlo, Consolas, monospace;
        background: rgba(14, 16, 22, 0.75); border: 1px solid #3a4152;
        padding: 8px 10px; border-radius: 4px;
      }
      .hud-stats { top: 10px; left: 10px; min-width: 230px; }
      .hud-tuning { top: 10px; right: 10px; width: 250px; max-height: calc(100vh - 80px); overflow-y: auto; }
      .hud-help { bottom: 10px; left: 50%; transform: translateX(-50%); white-space: nowrap; }
      .hud-title { color: #8fd4a8; letter-spacing: 2px; margin-bottom: 4px; }
      .hud-levelrow { display: flex; gap: 4px; margin-bottom: 6px; }
      .hud-levelbtn {
        flex: 1; font: 10px ui-monospace, Menlo, Consolas, monospace;
        background: #1c2230; color: #9fb0c8; border: 1px solid #3a4152;
        border-radius: 3px; padding: 3px 2px; cursor: pointer; white-space: nowrap;
      }
      .hud-levelbtn.active { background: #2b4436; color: #b6f0cc; border-color: #8fd4a8; }
      .hud-row { display: flex; justify-content: space-between; gap: 12px; }
      .hud-row b { color: #eef4ff; font-weight: normal; }
      .hud-slider { display: grid; grid-template-columns: 110px 1fr 34px; gap: 6px; align-items: center; }
      .hud-slider label { color: #9fb0c8; }
      .hud-slider span { text-align: right; color: #eef4ff; }
      .hud-slider input { width: 100%; accent-color: #8fd4a8; }
      .hud-msg {
        position: fixed; z-index: 11; top: 34%; left: 50%; transform: translate(-50%, -50%);
        text-align: center; color: #fff; pointer-events: none;
        text-shadow: 3px 3px 0 #000;
      }
      .hud-msg-title { font: bold 52px ui-monospace, Menlo, Consolas, monospace; letter-spacing: 4px; }
      .hud-msg-sub { font: 16px ui-monospace, Menlo, Consolas, monospace; margin-top: 8px; color: #cfe3d8; }
      .hud-flash {
        position: fixed; z-index: 12; inset: 0; background: #a3202a;
        opacity: 0; pointer-events: none;
      }
      .hud-balance {
        position: fixed; z-index: 10; left: 50%; bottom: 18%;
        transform: translateX(-50%); width: 240px; height: 14px;
        background: rgba(14, 16, 22, 0.8); border: 1px solid #3a4152;
        border-radius: 7px;
      }
      .hud-balance-center {
        position: absolute; left: 50%; top: 2px; bottom: 2px; width: 2px;
        margin-left: -1px; background: #5a6478;
      }
      .hud-balance-needle {
        position: absolute; top: -4px; width: 8px; height: 20px;
        margin-left: -4px; border-radius: 2px; background: #8fd4a8;
      }
    `;
    document.head.appendChild(style);
  }
}

function div(cls: string): HTMLElement {
  const el = document.createElement('div');
  el.className = cls;
  return el;
}

function row(label: string, value: string): string {
  return `<div class="hud-row"><span>${label}</span><b>${esc(value)}</b></div>`;
}

// Values like the gamepad name are arbitrary strings going into innerHTML.
function esc(s: string): string {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}
