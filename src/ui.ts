// DOM overlay: Crash-style game HUD (counters that pop, THPS trick plate),
// plus the debug/menu and tuning panels tucked into collapsible side tabs.

import { LEVEL_NAMES } from './level';
import { TUNING, TUNING_RANGES, TUNING_INFO, TUNING_SECTIONS, TuningKey } from './tuning';

export interface Stats {
  speed: number;
  state: string;
  grounded: boolean;
  vVel: number;
  surface: string;
  controller: string;
  jump: string;
  railDist: number;
  crates: string;
  fruit: number;
  masks: string;
  time: number;
}

export interface HudState {
  points: number;
  comboPoints: number;
  comboMult: number;
  tricks: string;
  fruit: number;
  lives: number;
  crates: string;
  hasCrystal: boolean;
  hasGem: boolean;
}

export class UI {
  private statsEl: HTMLElement;
  private msgTitle: HTMLElement;
  private msgSub: HTMLElement;
  private msgWrap: HTMLElement;
  private flashEl: HTMLElement;
  private balanceWrap: HTMLElement;
  private balanceNeedle: HTMLElement;
  private deathEl!: HTMLElement;
  // game HUD elements
  private scoreEl!: HTMLElement;
  private cratesEl!: HTMLElement;
  private wumpaEl!: HTMLElement;
  private livesEl!: HTMLElement;
  private trickPlate!: HTMLElement;
  private trickLineEl!: HTMLElement;
  private trickTotalEl!: HTMLElement;
  private crystalIcon!: HTMLElement;
  private gemIcon!: HTMLElement;
  private prevHud = { points: -1, fruit: -1, lives: -1, crates: '', crystal: false, gem: false };
  private msgTimer: number | undefined;
  private levelButtons: HTMLElement[] = [];
  private sliderEls = new Map<TuningKey, { input: HTMLInputElement; value: HTMLSpanElement }>();
  // Build defaults, captured before any saved tuning is applied — so a new
  // build's numbers are always recoverable under the "defaults" button.
  private defaults = { ...TUNING };

  // wired up by main.ts
  onLevelSelect: (id: number) => void = () => {};
  onLifeCheat: () => void = () => {};

  constructor() {
    this.injectStyle();

    // ---- LEFT side panel (level menu + debug), behind a collapsible tab ----
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

    // ---- RIGHT side panel (tuning sliders) ----
    // Apply any saved tuning BEFORE building the sliders, so they show it.
    const saved = this.readSaved();
    if (saved) this.applyTuning(saved);

    const panel = div('hud-tuning');
    panel.innerHTML = '<div class="hud-title">TUNING</div>';
    // save = snapshot to this browser (survives new builds); reset = back to
    // that snapshot; defaults = forget the snapshot, use the build's numbers.
    const btnRow = div('hud-tunebtns');
    const mkBtn = (label: string, fn: () => void): void => {
      const b = document.createElement('button');
      b.className = 'hud-levelbtn';
      b.textContent = label;
      b.addEventListener('click', () => {
        fn();
        b.blur();
      });
      btnRow.appendChild(b);
    };
    mkBtn('save', () => {
      localStorage.setItem('protoTuning', JSON.stringify(TUNING));
      this.showMessage('TUNING SAVED', '', 800);
    });
    mkBtn('reset', () => {
      this.applyTuning(this.readSaved() ?? this.defaults);
      this.showMessage('TUNING RESET', '', 800);
    });
    mkBtn('defaults', () => {
      localStorage.removeItem('protoTuning');
      this.applyTuning(this.defaults);
      this.showMessage('BUILD DEFAULTS', '', 800);
    });
    // Export the live values: paste the JSON into chat and they can be baked
    // in as the next build's defaults.
    mkBtn('copy', () => {
      const json = JSON.stringify(TUNING, null, 1);
      const done = (): void => this.showMessage('TUNING COPIED', 'paste it into the chat', 1600);
      if (navigator.clipboard && navigator.clipboard.writeText) {
        navigator.clipboard.writeText(json).then(done, () => window.prompt('copy your tuning:', json));
      } else {
        window.prompt('copy your tuning:', json);
      }
    });
    panel.appendChild(btnRow);
    // Sliders grouped under labelled section headers (walking, skating, ...).
    const placed = new Set<TuningKey>();
    const addSection = (title: string, keys: TuningKey[]): void => {
      if (keys.length === 0) return;
      const head = div('hud-secttitle');
      head.textContent = title;
      panel.appendChild(head);
      for (const key of keys) {
        panel.appendChild(this.sliderRow(key));
        placed.add(key);
      }
    };
    for (const sect of TUNING_SECTIONS) {
      addSection(sect.title, sect.keys.filter((k) => TUNING_RANGES[k] !== undefined));
    }
    // Anything new that hasn't been assigned a section yet still shows up.
    const leftovers = (Object.keys(TUNING_RANGES) as TuningKey[]).filter((k) => !placed.has(k));
    addSection('OTHER', leftovers);

    document.body.appendChild(this.sidePanel('left', 'MENU', statsWrap));
    document.body.appendChild(this.sidePanel('right', 'TUNER', panel));

    // ---- center messages / flash ----
    this.msgWrap = div('hud-msg');
    this.msgTitle = div('hud-msg-title');
    this.msgSub = div('hud-msg-sub');
    this.msgWrap.appendChild(this.msgTitle);
    this.msgWrap.appendChild(this.msgSub);
    this.msgWrap.style.display = 'none';
    this.flashEl = div('hud-flash');

    // ---- game HUD: Crash-style counters + THPS trick plate ----
    // top-left: crate + wumpa counters
    const tl = div('hud-tl');
    const crateRow = div('hud-counter');
    crateRow.appendChild(div('hud-icon hud-icon-crate'));
    this.cratesEl = div('hud-num');
    crateRow.appendChild(this.cratesEl);
    const wumpaRow = div('hud-counter');
    wumpaRow.appendChild(div('hud-icon hud-icon-wumpa'));
    this.wumpaEl = div('hud-num');
    wumpaRow.appendChild(this.wumpaEl);
    tl.appendChild(crateRow);
    tl.appendChild(wumpaRow);
    // relic haul: crystal + gem, ghosted until earned
    const relicRow = div('hud-counter hud-relics');
    this.crystalIcon = div('hud-icon hud-icon-crystal hud-relic-off');
    this.gemIcon = div('hud-icon hud-icon-gem hud-relic-off');
    relicRow.appendChild(this.crystalIcon);
    relicRow.appendChild(this.gemIcon);
    tl.appendChild(relicRow);

    // top-center: score plate
    const scorePlate = div('hud-scoreplate');
    const scoreLabel = div('hud-scorelabel');
    scoreLabel.textContent = 'SCORE';
    this.scoreEl = div('hud-scorenum');
    scorePlate.appendChild(scoreLabel);
    scorePlate.appendChild(this.scoreEl);

    // top-right: lives
    const tr = div('hud-tr');
    const livesRow = div('hud-counter');
    livesRow.appendChild(div('hud-icon hud-icon-face'));
    this.livesEl = div('hud-num');
    livesRow.appendChild(this.livesEl);
    tr.appendChild(livesRow);
    // Debug cheat: clicking the face banks an extra life. The HUD layer is
    // pointer-transparent, so this row opts back in.
    livesRow.style.cursor = 'pointer';
    livesRow.style.pointerEvents = 'auto';
    livesRow.title = 'click: +1 life';
    livesRow.addEventListener('click', () => {
      this.onLifeCheat();
    });

    // bottom-center: THPS trick plate
    this.trickPlate = div('hud-trickplate');
    this.trickLineEl = div('hud-trickline');
    this.trickTotalEl = div('hud-tricktotal');
    this.trickPlate.appendChild(this.trickLineEl);
    this.trickPlate.appendChild(this.trickTotalEl);
    this.trickPlate.style.display = 'none';

    // black game-over screen: any button restarts
    this.deathEl = div('hud-death');
    this.deathEl.innerHTML =
      '<div class="hud-death-title">GAME OVER</div>' +
      '<div class="hud-death-sub">press any button</div>';
    this.deathEl.style.display = 'none';

    // THPS-style grind balance meter (visible only while grinding).
    this.balanceWrap = div('hud-balance');
    this.balanceNeedle = div('hud-balance-needle');
    const balanceCenter = div('hud-balance-center');
    this.balanceWrap.appendChild(balanceCenter);
    this.balanceWrap.appendChild(this.balanceNeedle);
    this.balanceWrap.style.display = 'none';

    for (const el of [this.msgWrap, this.flashEl, tl, scorePlate, tr, this.trickPlate, this.balanceWrap, this.deathEl]) {
      document.body.appendChild(el);
    }
  }

  // A fixed side wrapper with a vertical tab that slides the content off-screen.
  // Collapsed by default (game view); state persists per side.
  private sidePanel(side: 'left' | 'right', label: string, content: HTMLElement): HTMLElement {
    const wrap = div(`side-wrap ${side}`);
    const tab = document.createElement('button');
    tab.className = 'side-tab';
    tab.textContent = label;
    const key = 'protoPanel_' + side;
    if (localStorage.getItem(key) !== 'open') wrap.classList.add('collapsed');
    tab.addEventListener('click', () => {
      wrap.classList.toggle('collapsed');
      localStorage.setItem(key, wrap.classList.contains('collapsed') ? 'closed' : 'open');
      tab.blur();
    });
    if (side === 'left') {
      wrap.appendChild(content);
      wrap.appendChild(tab);
    } else {
      wrap.appendChild(tab);
      wrap.appendChild(content);
    }
    return wrap;
  }

  showDeathScreen(visible: boolean): void {
    this.deathEl.style.display = visible ? 'flex' : 'none';
  }

  setHUD(s: HudState): void {
    if (s.points !== this.prevHud.points) {
      this.scoreEl.textContent = String(s.points);
      pop(this.scoreEl);
      this.prevHud.points = s.points;
    }
    if (s.crates !== this.prevHud.crates) {
      this.cratesEl.textContent = s.crates;
      pop(this.cratesEl);
      this.prevHud.crates = s.crates;
    }
    if (s.fruit !== this.prevHud.fruit) {
      this.wumpaEl.textContent = String(s.fruit);
      pop(this.wumpaEl);
      this.prevHud.fruit = s.fruit;
    }
    if (s.hasCrystal !== this.prevHud.crystal) {
      this.crystalIcon.classList.toggle('hud-relic-off', !s.hasCrystal);
      if (s.hasCrystal) pop(this.crystalIcon);
      this.prevHud.crystal = s.hasCrystal;
    }
    if (s.hasGem !== this.prevHud.gem) {
      this.gemIcon.classList.toggle('hud-relic-off', !s.hasGem);
      if (s.hasGem) pop(this.gemIcon);
      this.prevHud.gem = s.hasGem;
    }
    if (s.lives !== this.prevHud.lives) {
      this.livesEl.textContent = String(s.lives);
      pop(this.livesEl);
      this.prevHud.lives = s.lives;
    }
    // The trick readout only appears once a combo actually chains — a single
    // trick isn't worth the callout (its points already land on the SCORE).
    const chained = s.comboMult > 0 && (s.tricks.includes(' + ') || s.tricks.includes('…'));
    if (chained) {
      this.trickPlate.style.display = 'block';
      this.trickLineEl.textContent = s.tricks.toUpperCase();
      this.trickTotalEl.textContent = `${s.comboPoints}  X${s.comboMult}`;
    } else {
      this.trickPlate.style.display = 'none';
    }
  }

  // Saved tuning snapshot from this browser, if any. Only keys that still
  // exist in the current build are applied, so stale saves never break a
  // newer build's numbers.
  private readSaved(): Partial<Record<TuningKey, number>> | null {
    try {
      return JSON.parse(localStorage.getItem('protoTuning') ?? 'null');
    } catch {
      return null;
    }
  }

  private applyTuning(vals: Partial<Record<TuningKey, number>>): void {
    for (const key of Object.keys(TUNING_RANGES) as TuningKey[]) {
      const v = vals[key];
      if (typeof v !== 'number' || !isFinite(v)) continue;
      TUNING[key] = v;
      const el = this.sliderEls.get(key);
      if (el) {
        el.input.value = String(v);
        el.value.textContent = String(v);
      }
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
      row('jump', s.jump) +
      row('rail dist', railDist) +
      row('crates', s.crates) +
      row('wumpa', String(s.fruit)) +
      row('mask', s.masks) +
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
    wrap.title = TUNING_INFO[key]; // hover for what this number does in play
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
    this.sliderEls.set(key, { input, value });
    return wrap;
  }

  private injectStyle(): void {
    const style = document.createElement('style');
    style.textContent = `
      .hud-stats, .hud-tuning {
        color: #cfe3d8;
        font: 12px/1.5 ui-monospace, Menlo, Consolas, monospace;
        background: linear-gradient(180deg, rgba(26, 30, 44, 0.92), rgba(10, 12, 18, 0.92));
        border: 1px solid #3a4152;
        padding: 8px 10px; border-radius: 4px;
        box-shadow: inset 0 1px 0 rgba(255, 255, 255, 0.08), 0 6px 18px rgba(0, 0, 0, 0.45);
      }
      .hud-stats { min-width: 230px; }
      .hud-tuning { width: 250px; max-height: calc(100vh - 60px); overflow-y: auto; }
      .hud-title { color: #8fd4a8; letter-spacing: 2px; margin-bottom: 4px; }
      .hud-levelrow { display: flex; gap: 4px; margin-bottom: 6px; }
      .hud-tunebtns { display: flex; gap: 4px; margin-bottom: 6px; }
      .hud-levelbtn {
        flex: 1; font: 10px ui-monospace, Menlo, Consolas, monospace;
        background: #1c2230; color: #9fb0c8; border: 1px solid #3a4152;
        border-radius: 3px; padding: 3px 2px; cursor: pointer; white-space: nowrap;
      }
      .hud-levelbtn:hover { background: #243044; color: #cfe3d8; }
      .hud-levelbtn.active { background: #2b4436; color: #b6f0cc; border-color: #8fd4a8; }
      .hud-row { display: flex; justify-content: space-between; gap: 12px; }
      .hud-row b { color: #eef4ff; font-weight: normal; }
      .hud-secttitle { margin: 10px 0 2px; padding-bottom: 2px; border-bottom: 1px solid rgba(143, 212, 168, 0.35); color: #8fd4a8; font-size: 11px; letter-spacing: 2px; }
      .hud-slider { display: grid; grid-template-columns: 110px 1fr 34px; gap: 6px; align-items: center; }
      .hud-slider label { color: #9fb0c8; }
      .hud-slider span { text-align: right; color: #eef4ff; }
      .hud-slider input { width: 100%; accent-color: #8fd4a8; }

      /* --- collapsible side panels --- */
      .side-wrap {
        position: fixed; top: 10px; z-index: 15; display: flex;
        align-items: flex-start; transition: transform 0.25s ease;
      }
      .side-wrap.left { left: 0; }
      .side-wrap.right { right: 0; }
      .side-wrap.left.collapsed { transform: translateX(calc(-100% + 24px)); }
      .side-wrap.right.collapsed { transform: translateX(calc(100% - 24px)); }
      .side-tab {
        width: 24px; padding: 10px 2px; cursor: pointer;
        writing-mode: vertical-rl; text-orientation: upright;
        font: bold 10px ui-monospace, Menlo, Consolas, monospace;
        letter-spacing: 2px; color: #cfe3d8;
        background: linear-gradient(180deg, rgba(26, 30, 44, 0.92), rgba(10, 12, 18, 0.92));
        border: 1px solid #3a4152;
        box-shadow: inset 0 1px 0 rgba(255, 255, 255, 0.08);
      }
      .side-wrap.left .side-tab { border-radius: 0 5px 5px 0; border-left: none; }
      .side-wrap.right .side-tab { border-radius: 5px 0 0 5px; border-right: none; }

      /* --- Crash-style game HUD --- */
      .hud-tl { position: fixed; top: 16px; left: 40px; z-index: 10; pointer-events: none; }
      .hud-tr { position: fixed; top: 16px; right: 40px; z-index: 10; pointer-events: none; }
      .hud-counter { display: flex; align-items: center; gap: 14px; margin-bottom: 10px; }
      .hud-num {
        font: italic 900 clamp(44px, 8.5vh, 78px) Impact, 'Arial Black', sans-serif;
        color: #ffb43a; letter-spacing: 2px; transform: skewX(-6deg);
        text-shadow: 3px 0 0 #3a1c05, -3px 0 0 #3a1c05, 0 3px 0 #3a1c05,
          0 -3px 0 #3a1c05, 5px 5px 0 #000;
      }
      .hud-icon {
        width: clamp(52px, 9.5vh, 84px); height: clamp(52px, 9.5vh, 84px);
        image-rendering: pixelated; flex-shrink: 0;
      }
      .hud-icon-crate {
        background:
          linear-gradient(45deg, transparent 44%, #6e4f24 44%, #6e4f24 56%, transparent 56%),
          linear-gradient(-45deg, transparent 44%, #6e4f24 44%, #6e4f24 56%, transparent 56%),
          #b08a4a;
        border: 5px solid #6e4f24; box-shadow: 4px 4px 0 #000;
      }
      .hud-icon-wumpa {
        border-radius: 50%;
        background: radial-gradient(circle at 35% 30%, #ffd24a, #e2521e 70%);
        box-shadow: 4px 4px 0 #000;
      }
      .hud-relics { gap: 10px; }
      .hud-icon-crystal {
        width: clamp(30px, 5.5vh, 48px); height: clamp(42px, 7.5vh, 66px);
        background: linear-gradient(160deg, #ffd4f8 8%, #ff9af0 22%, #c03fe0 55%, #7a1898 90%);
        clip-path: polygon(50% 0%, 100% 38%, 50% 100%, 0% 38%);
        filter: drop-shadow(3px 3px 0 #000) drop-shadow(0 0 7px rgba(255, 120, 240, 0.6));
      }
      .hud-icon-gem {
        width: clamp(38px, 7vh, 60px); height: clamp(28px, 5vh, 44px);
        background: linear-gradient(160deg, #eaffff 8%, #bfffff 22%, #35cfe4 55%, #147a90 90%);
        clip-path: polygon(25% 0%, 75% 0%, 100% 35%, 50% 100%, 0% 35%);
        filter: drop-shadow(3px 3px 0 #000) drop-shadow(0 0 7px rgba(80, 220, 255, 0.6));
        align-self: center;
      }
      .hud-relic-off { opacity: 0.22; filter: grayscale(1) drop-shadow(3px 3px 0 #000); }
      .hud-icon-face {
        border-radius: 40%;
        background: radial-gradient(circle at 40% 35%, #f4b56a, #c96f28 75%);
        border: 3px solid rgba(0, 0, 0, 0.65);
        box-shadow: inset 2px 2px 0 rgba(255, 255, 255, 0.3), 4px 4px 0 #000;
        position: relative;
      }
      .hud-icon-face::before {
        content: ''; position: absolute; left: 24%; top: 28%; width: 12%; height: 20%;
        background: #35200c;
      }
      .hud-icon-face::after {
        content: ''; position: absolute; left: 60%; top: 28%; width: 12%; height: 20%;
        background: #35200c;
      }
      .hud-pop { animation: hudpop 0.22s ease-out; }
      @keyframes hudpop {
        0% { transform: skewX(-6deg) scale(1.45); }
        100% { transform: skewX(-6deg) scale(1); }
      }

      /* score plate: dark arcade marquee — layered metal gradient, 1px top
         highlight, gold digits with a hard offset shadow */
      .hud-scoreplate {
        position: fixed; top: 14px; left: 50%; transform: translateX(-50%);
        z-index: 10; pointer-events: none; text-align: center;
        background: linear-gradient(180deg, #333a4e 0%, #1b202e 55%, #12151f 100%);
        border: 3px solid #05070c; border-radius: 7px; padding: 4px 30px 6px;
        box-shadow: inset 0 1px 0 rgba(255,255,255,0.28),
          inset 0 -8px 14px rgba(0,0,0,0.45), 4px 4px 0 rgba(0,0,0,0.5);
      }
      .hud-scorelabel {
        font: italic bold clamp(13px, 2.2vh, 20px) Impact, 'Arial Black', sans-serif;
        letter-spacing: 5px;
        color: #ffd24a; text-shadow: 2px 2px 0 #000;
      }
      .hud-scorenum {
        font: italic 900 clamp(32px, 5.5vh, 50px) Impact, 'Arial Black', sans-serif;
        letter-spacing: 4px;
        color: #ffe9b0;
        text-shadow: 2px 0 0 #3a1c05, -2px 0 0 #3a1c05, 0 2px 0 #3a1c05,
          0 -2px 0 #3a1c05, 4px 4px 0 #000;
      }

      /* THPS trick readout — bare text, no plate, reads on any background.
         The entrance animation restarts on the existing display none->block
         toggle, so a fresh combo slams in without any new JS. */
      .hud-trickplate {
        position: fixed; z-index: 10; bottom: 4%; left: 50%;
        transform: translateX(-50%); pointer-events: none; text-align: center;
        max-width: 92vw; display: none;
        animation: trickin 0.18s ease-out;
      }
      @keyframes trickin {
        0% { transform: translateX(-50%) scale(1.35); opacity: 0.3; }
        100% { transform: translateX(-50%) scale(1); opacity: 1; }
      }
      .hud-trickline {
        font: italic bold clamp(18px, 3.2vh, 30px) Impact, 'Arial Black', sans-serif;
        letter-spacing: 2px; color: #ffe08a;
        text-shadow: 2px 0 0 #3a1c05, -2px 0 0 #3a1c05, 0 2px 0 #3a1c05,
          0 -2px 0 #3a1c05, 3px 3px 0 #000;
        white-space: nowrap; overflow: hidden; text-overflow: ellipsis;
      }
      .hud-tricktotal {
        font: italic 900 clamp(28px, 5vh, 46px) Impact, 'Arial Black', sans-serif;
        letter-spacing: 4px; color: #ffb43a; transform: skewX(-6deg); margin-top: 2px;
        text-shadow: 2px 0 0 #3a1c05, -2px 0 0 #3a1c05, 0 2px 0 #3a1c05,
          0 -2px 0 #3a1c05, 4px 4px 0 #000;
        animation: combopulse 0.5s ease-in-out infinite alternate;
      }
      @keyframes combopulse {
        from { transform: skewX(-6deg) scale(1); }
        to { transform: skewX(-6deg) scale(1.05); }
      }

      .hud-msg {
        position: fixed; z-index: 11; top: 34%; left: 50%; transform: translate(-50%, -50%);
        text-align: center; color: #fff; pointer-events: none;
        text-shadow: 3px 3px 0 #000;
      }
      .hud-msg-title {
        font: bold 52px ui-monospace, Menlo, Consolas, monospace; letter-spacing: 4px;
        text-shadow: 3px 0 0 #000, -3px 0 0 #000, 0 3px 0 #000, 0 -3px 0 #000,
          5px 5px 0 rgba(0, 0, 0, 0.8);
      }
      .hud-msg-sub { font: 16px ui-monospace, Menlo, Consolas, monospace; margin-top: 8px; color: #cfe3d8; }
      .hud-flash {
        position: fixed; z-index: 12; inset: 0; background: #a3202a;
        opacity: 0; pointer-events: none;
      }
      .hud-death {
        position: fixed; z-index: 20; inset: 0; background: #000;
        display: none; flex-direction: column; align-items: center;
        justify-content: center; color: #fff;
        font: bold 54px ui-monospace, Menlo, Consolas, monospace;
      }
      .hud-death .hud-death-title { letter-spacing: 6px; }
      .hud-death .hud-death-sub {
        font-size: 16px; font-weight: normal; color: #9fb0c8; margin-top: 14px;
        letter-spacing: 2px;
      }
      .hud-balance {
        position: fixed; z-index: 10; left: 50%; bottom: 24%;
        transform: translateX(-50%); width: 240px; height: 14px;
        background: linear-gradient(180deg, rgba(8, 10, 15, 0.9), rgba(26, 30, 44, 0.9));
        border: 1px solid #3a4152; border-radius: 7px;
        box-shadow: inset 0 2px 3px rgba(0, 0, 0, 0.6), 0 1px 0 rgba(255, 255, 255, 0.12);
      }
      .hud-balance-center {
        position: absolute; left: 50%; top: 2px; bottom: 2px; width: 2px;
        margin-left: -1px; background: #5a6478;
      }
      .hud-balance-needle {
        position: absolute; top: -4px; width: 8px; height: 20px;
        margin-left: -4px; border-radius: 2px; background: #8fd4a8;
        box-shadow: 2px 2px 0 rgba(0, 0, 0, 0.55);
      }
    `;
    document.head.appendChild(style);
  }
}

// Restartable pop animation for counters that just changed.
function pop(el: HTMLElement): void {
  el.classList.remove('hud-pop');
  void el.offsetWidth; // reflow restarts the animation
  el.classList.add('hud-pop');
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
