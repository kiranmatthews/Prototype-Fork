// DOM overlay: Crash-style game HUD (counters that pop, THPS trick plate),
// plus the debug/menu and tuning panels tucked into collapsible side tabs.

import { LEVEL_NAMES } from './level';
import { TUNING, TUNING_RANGES, TUNING_INFO, TUNING_SECTIONS, TUNING_VERSION, TuningKey } from './tuning';

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
  comboHasTrick: boolean;
  tricks: string;
  fruit: number;
  lives: number;
  crates: string;
  hasCrystal: boolean;
  hasGem: boolean;
}

declare const __BUILD_TAG__: string; // injected by vite.config define

export class UI {
  private statsEl: HTMLElement;
  private msgTitle: HTMLElement;
  private msgSub: HTMLElement;
  private msgWrap: HTMLElement;
  private flashEl: HTMLElement;
  private fadeEl: HTMLElement;
  private fadeTimer: number | null = null;
  private wumpaRowEl!: HTMLElement; // hidden during time trials
  private livesRowEl!: HTMLElement;
  private ttClockEl!: HTMLElement; // the big trial clock, top center
  private ttFreezeEl!: HTMLElement;
  private ttResultsEl!: HTMLElement;
  private ttOn = false;
  private balanceWrap: HTMLElement;
  private balanceNeedle: HTMLElement;
  private vBalanceWrap!: HTMLElement;
  private vBalanceNeedle!: HTMLElement;
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
  // Score/combo tickers: displayed numbers chase the real ones fast (arcade feel).
  private dispScore = 0;
  private dispCombo = 0;
  private comboState: 'none' | 'active' | 'cashin' | 'bail' = 'none';
  private comboBailEnd = 0; // performance.now() timestamp the bail drop finishes
  private msgTimer: number | undefined;
  private levelButtons: HTMLElement[] = [];
  private sliderEls = new Map<
    TuningKey,
    { input: HTMLInputElement; value: HTMLInputElement; sync?: () => void }
  >();
  // Bookmarked slider names (green) — persisted attention markers, no effect.
  private tunerMarks = new Set<string>(
    JSON.parse(localStorage.getItem('protoTunerMarks') ?? '[]') as string[],
  );
  // Build defaults, captured before any saved tuning is applied — so a new
  // build's numbers are always recoverable under the "defaults" button.
  private defaults = { ...TUNING };

  // wired up by main.ts
  onLevelSelect: (id: number) => void = () => {};
  onLifeCheat: () => void = () => {};
  onSaveReplay: (() => void) | null = null;
  onToggleVideo: (() => void) | null = null;
  onLoadReplay: ((text: string) => void) | null = null;
  onEditorOpen: (() => void) | null = null;
  onEditCopy: (() => void) | null = null;
  // fired when a side tab (MENU / TUNER) is clicked, BEFORE the panel
  // toggles — main.ts uses it to close the editor so the panel isn't a
  // hidden husk while the tools own the screen
  onSideTab: ((side: 'left' | 'right') => void) | null = null;
  private recBtn!: HTMLButtonElement;
  private replayBadge!: HTMLElement;
  private recBadge!: HTMLElement;

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
    // The level EDITOR lives on the Custom level (8): build/arrange your own
    // course, then hit TEST in the editor panel to play it.
    const editBtn = document.createElement('button');
    editBtn.className = 'hud-levelbtn hud-editbtn';
    editBtn.textContent = '✎ LEVEL EDITOR';
    editBtn.addEventListener('click', () => {
      if (this.onEditorOpen) this.onEditorOpen();
      editBtn.blur();
    });
    statsWrap.appendChild(editBtn);
    // Any built-in level can be CAPTURED into the editor as a component copy:
    // the current level's geometry loads into the Custom slot for editing
    // (the previous custom level is backed up first).
    const copyBtn = document.createElement('button');
    copyBtn.className = 'hud-levelbtn hud-editbtn';
    copyBtn.textContent = '⧉ EDIT A COPY OF THIS LEVEL';
    copyBtn.title = 'capture the current level into the editor (custom slot is backed up)';
    copyBtn.addEventListener('click', () => {
      if (this.onEditCopy) this.onEditCopy();
      copyBtn.blur();
    });
    statsWrap.appendChild(copyBtn);


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
      // store the defaults alongside, so a future build can tell which keys
      // were DELIBERATE tweaks (only those survive across default changes)
      localStorage.setItem(
        'protoTuning',
        JSON.stringify({ __v: TUNING_VERSION, tuning: TUNING, defaults: this.defaults }),
      );
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
    // ---- playtest capture: input replays + gameplay video ----
    // 'save replay' downloads the input take since the last level load as a
    // .json (F8). 'load replay' / dragging the file onto the game plays it
    // back. 'rec video' toggles a .webm recording of the canvas (F9).
    const capRow = div('hud-tunebtns');
    const mkCapBtn = (label: string, fn: () => void): HTMLButtonElement => {
      const b = document.createElement('button');
      b.className = 'hud-levelbtn';
      b.textContent = label;
      b.addEventListener('click', () => {
        fn();
        b.blur();
      });
      capRow.appendChild(b);
      return b;
    };
    mkCapBtn('save replay', () => this.onSaveReplay && this.onSaveReplay());
    const filePick = document.createElement('input');
    filePick.type = 'file';
    filePick.accept = '.json,application/json';
    filePick.style.display = 'none';
    filePick.addEventListener('change', () => {
      const f = filePick.files && filePick.files[0];
      if (f) f.text().then((txt) => this.onLoadReplay && this.onLoadReplay(txt));
      filePick.value = '';
    });
    capRow.appendChild(filePick);
    mkCapBtn('load replay', () => filePick.click());
    this.recBtn = mkCapBtn('rec video', () => this.onToggleVideo && this.onToggleVideo());
    panel.appendChild(capRow);
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
    this.fadeEl = div('hud-fade'); // death blackout curtain

    // Build stamp: baked at compile time. If a playtest doesn't show a
    // change, check this first — it answers "which build am I running?".
    const stamp = div('hud-build');
    stamp.textContent = 'build ' + __BUILD_TAG__;
    document.body.appendChild(stamp);

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
    this.wumpaRowEl = wumpaRow;
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
    this.livesRowEl = livesRow;

    // TIME TRIAL: the big top-center clock (per-frame, centisecond digits)
    // and the ranked-times card shown at the gate.
    this.ttClockEl = div('hud-ttclock');
    const ttTime = div('hud-tttime');
    this.ttClockEl.appendChild(ttTime);
    this.ttFreezeEl = div('hud-ttfreeze');
    this.ttClockEl.appendChild(this.ttFreezeEl);
    this.ttClockEl.style.display = 'none';
    this.ttResultsEl = div('hud-ttresults');
    this.ttResultsEl.style.display = 'none';
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

    // VERTICAL balance meter for MANUALS: up/down on the stick fights the
    // needle (nose at the top, tail at the bottom); left/right stays steering.
    this.vBalanceWrap = div('hud-vbalance');
    this.vBalanceNeedle = div('hud-vbalance-needle');
    const vCenter = div('hud-vbalance-center');
    const noseTick = div('hud-vbalance-cap');
    noseTick.style.top = '2px';
    const tailTick = div('hud-vbalance-cap');
    tailTick.style.bottom = '2px';
    this.vBalanceWrap.appendChild(vCenter);
    this.vBalanceWrap.appendChild(noseTick);
    this.vBalanceWrap.appendChild(tailTick);
    this.vBalanceWrap.appendChild(this.vBalanceNeedle);
    this.vBalanceWrap.style.display = 'none';

    // Playtest capture badges: ▶ REPLAY while a take plays back, ● REC while
    // the canvas is being recorded to video.
    this.replayBadge = div('hud-capbadge');
    this.replayBadge.textContent = '▶ REPLAY';
    this.replayBadge.style.display = 'none';
    this.recBadge = div('hud-capbadge hud-recbadge');
    this.recBadge.textContent = '● REC';
    this.recBadge.style.display = 'none';

    for (const el of [this.msgWrap, this.flashEl, this.fadeEl, tl, scorePlate, tr, this.ttClockEl, this.ttResultsEl, this.trickPlate, this.balanceWrap, this.vBalanceWrap, this.deathEl, this.replayBadge, this.recBadge]) {
      document.body.appendChild(el);
    }
  }

  setReplayBadge(on: boolean): void {
    this.replayBadge.style.display = on ? 'block' : 'none';
  }

  setRecBadge(on: boolean): void {
    this.recBadge.style.display = on ? 'block' : 'none';
    this.recBtn.textContent = on ? 'stop + save' : 'rec video';
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
      if (this.onSideTab) this.onSideTab(side);
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

  // Arcade ticker: step the shown number toward the target, landing exactly on
  // it. Slow + smooth — ~9% of the gap per frame (≈3× the duration of a snappy
  // count) with a 1/frame floor (twice the frames of a 2-floor), so the number
  // visibly rolls up rather than jumping.
  private ticker(cur: number, target: number): number {
    const d = target - cur;
    if (d === 0) return cur;
    const step = Math.min(Math.abs(d), Math.max(1, Math.ceil(Math.abs(d) * 0.09)));
    return cur + Math.sign(d) * step;
  }

  private startCombo(s: HudState): void {
    this.comboState = 'active';
    this.trickPlate.style.display = 'block';
    this.trickPlate.classList.remove('hud-trick-bail');
    this.trickLineEl.textContent = s.tricks.toUpperCase();
  }

  private endCombo(): void {
    this.comboState = 'none';
    this.trickPlate.style.display = 'none';
    this.trickPlate.classList.remove('hud-trick-bail');
    this.dispCombo = 0;
  }

  // Combo landed clean: freeze the total on the plate and drain it to zero while
  // the score ticks up to match.
  comboBank(amount: number): void {
    this.dispCombo = amount;
    this.comboState = 'cashin';
    this.trickPlate.style.display = 'block';
    this.trickPlate.classList.remove('hud-trick-bail');
    pop(this.scoreEl);
  }

  // Combo lost on a bail: red, shake, drop away.
  comboBail(): void {
    this.comboState = 'bail';
    this.comboBailEnd = performance.now() + 700;
    this.trickPlate.style.display = 'block';
    this.trickPlate.classList.add('hud-trick-bail');
    this.trickLineEl.textContent = 'BAILED!';
    this.trickTotalEl.textContent = 'NO';
  }

  setHUD(s: HudState): void {
    // SCORE ticker: the shown number chases the real score fast.
    if (this.prevHud.points < 0) this.dispScore = s.points; // snap on first frame
    if (s.points > this.prevHud.points && this.prevHud.points >= 0) pop(this.scoreEl);
    this.dispScore = this.ticker(this.dispScore, s.points);
    this.scoreEl.textContent = String(Math.round(this.dispScore));
    this.prevHud.points = s.points;
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
    // COMBO plate: appears the moment a REAL trick is in the combo (grind/grab/
    // wallride/slide) — not for bare platforming (spins, crate bounces, enemy
    // pops). The total tickers up while chaining; on a clean bank it drains to
    // zero as the score climbs to match; on a bail it red-shakes and drops away.
    const show = s.comboHasTrick && s.comboMult > 0;
    if (this.comboState === 'cashin') {
      if (show) {
        this.startCombo(s); // a fresh combo interrupts the cash-in
      } else {
        this.dispCombo = this.ticker(this.dispCombo, 0);
        this.trickTotalEl.textContent = String(Math.round(this.dispCombo));
        if (this.dispCombo <= 0) this.endCombo();
      }
    } else if (this.comboState === 'bail') {
      if (show) this.startCombo(s);
      else if (performance.now() >= this.comboBailEnd) this.endCombo();
    } else if (show) {
      this.startCombo(s);
      this.dispCombo = this.ticker(this.dispCombo, s.comboPoints * s.comboMult);
      this.trickTotalEl.textContent = `${Math.round(this.dispCombo)}  ×${s.comboMult}`;
    } else if (this.comboState === 'active') {
      this.endCombo(); // combo fizzled with no bank/bail signal
    }
  }

  // Saved tuning snapshot from this browser, if any — merged so that ONLY
  // keys the user deliberately moved off their build's defaults carry over;
  // everything they never touched follows the CURRENT build's numbers. (A
  // legacy flat snapshot can't tell tweaks from stale defaults — it once
  // kept a retired mechanic alive for days — so it is dropped outright.)
  private readSaved(): Partial<Record<TuningKey, number>> | null {
    try {
      const raw = JSON.parse(localStorage.getItem('protoTuning') ?? 'null') as {
        __v?: number;
        tuning?: Record<string, number>;
        defaults?: Record<string, number>;
      } | null;
      if (!raw) return null;
      if (raw.__v === undefined || !raw.tuning || !raw.defaults) {
        localStorage.removeItem('protoTuning'); // pre-versioning save: retire it
        return null;
      }
      const merged: Partial<Record<TuningKey, number>> = { ...this.defaults };
      for (const key of Object.keys(TUNING_RANGES) as TuningKey[]) {
        const v = raw.tuning[key];
        if (typeof v === 'number' && isFinite(v) && v !== raw.defaults[key]) merged[key] = v;
      }
      return merged;
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
        el.value.value = String(v);
        el.sync?.(); // checkboxes mirror the number
      }
    }
  }

  setLevel(id: number): void {
    this.levelButtons.forEach((b, i) => b.classList.toggle('active', i === id));
  }

  // THPS balance meters. Grinds show the HORIZONTAL bar (left/right needle);
  // manuals show the VERTICAL one (needle sinks toward the tail as you tip
  // back, rises toward the nose tipping forward — push the stick up/down
  // AGAINST it). bal in [-1, 1]; pegging either end is the bail. crit = the
  // last-chance beat: the needle flashes.
  updateBalance(meter: { mode: 'grind' | 'manual'; bal: number; crit: boolean } | null): void {
    const grind = meter !== null && meter.mode === 'grind';
    const manual = meter !== null && meter.mode === 'manual';
    this.balanceWrap.style.display = grind ? 'block' : 'none';
    this.vBalanceWrap.style.display = manual ? 'block' : 'none';
    if (!meter) return;
    const hot = meter.crit || Math.abs(meter.bal) > 0.7;
    const color = meter.crit
      ? Math.sin(performance.now() * 0.045) > 0
        ? '#ff2d1e'
        : '#ffd23f'
      : hot
        ? '#e2483d'
        : '#8fd4a8';
    if (grind) {
      this.balanceNeedle.style.left = 50 + meter.bal * 46 + '%';
      this.balanceNeedle.style.background = color;
    } else {
      // balance + = tipping BACK onto the tail -> needle drops to the bottom
      this.vBalanceNeedle.style.top = 50 + meter.bal * 44 + '%';
      this.vBalanceNeedle.style.background = color;
    }
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

  // ---- time trial ----------------------------------------------------------

  // Trial dress on/off: the big clock appears, fruit + lives counters hide.
  setTimeTrial(on: boolean): void {
    this.ttOn = on;
    this.ttClockEl.style.display = on ? 'block' : 'none';
    this.wumpaRowEl.style.display = on ? 'none' : '';
    this.livesRowEl.style.display = on ? 'none' : '';
    if (!on) this.ttResultsEl.style.display = 'none';
  }

  private static fmtTime(t: number): string {
    const m = Math.floor(t / 60);
    const s = t - m * 60;
    return `${m}:${s < 10 ? '0' : ''}${s.toFixed(2)}`;
  }

  // Called every frame while a trial runs — centisecond digits, and the whole
  // clock goes ice-blue while a time crate's freeze is counting down.
  updateTTClock(t: number, freeze: number): void {
    if (!this.ttOn) return;
    (this.ttClockEl.firstChild as HTMLElement).textContent = UI.fmtTime(t);
    const frozen = freeze > 0;
    this.ttClockEl.classList.toggle('hud-tt-frozen', frozen);
    this.ttFreezeEl.textContent = frozen ? `FROZEN ${freeze.toFixed(1)}s` : '';
  }

  // Ranked times at the gate: this run slots into the level's best list.
  showTTResults(time: number, list: number[], rank: number): void {
    const rows = list
      .slice(0, 5)
      .map((v, i) => {
        const isNew = i === rank;
        return `<div class="hud-ttrow${isNew ? ' hud-ttrow-new' : ''}"><span>${i + 1}.</span><span>${UI.fmtTime(v)}</span></div>`;
      })
      .join('');
    this.ttResultsEl.innerHTML =
      `<div class="hud-ttres-title">${rank === 0 ? 'NEW RECORD!' : 'RUN COMPLETE'}</div>` +
      `<div class="hud-ttres-time">${UI.fmtTime(time)}</div>` +
      `<div class="hud-ttres-list">${rows}</div>` +
      `<div class="hud-ttres-sub">press R / Options to go again</div>`;
    this.ttResultsEl.style.display = 'block';
  }

  hideTTResults(): void {
    this.ttResultsEl.style.display = 'none';
  }

  // Death curtain: fade to black on the way out; on respawn hold the black a
  // beat (the world teleports behind it), then reveal the checkpoint.
  deathFade(out: boolean): void {
    if (this.fadeTimer !== null) {
      clearTimeout(this.fadeTimer);
      this.fadeTimer = null;
    }
    if (out) {
      this.fadeEl.style.transition = 'opacity 0.4s ease';
      this.fadeEl.style.opacity = '1';
    } else {
      this.fadeTimer = window.setTimeout(() => {
        this.fadeTimer = null;
        this.fadeEl.style.transition = 'opacity 0.55s ease';
        this.fadeEl.style.opacity = '0';
      }, 280);
    }
  }

  private sliderRow(key: TuningKey): HTMLElement {
    const range = TUNING_RANGES[key];
    const wrap = div('hud-slider');
    wrap.title = TUNING_INFO[key]; // hover for what this number does in play
    const label = document.createElement('label');
    label.textContent = key;
    // Click the name to bookmark it (green) — pure attention bookkeeping for
    // tuning sessions, remembered like the values are, zero gameplay effect.
    if (this.tunerMarks.has(key)) label.classList.add('hud-marked');
    label.style.cursor = 'pointer';
    label.addEventListener('click', () => {
      if (this.tunerMarks.has(key)) this.tunerMarks.delete(key);
      else this.tunerMarks.add(key);
      label.classList.toggle('hud-marked');
      localStorage.setItem('protoTunerMarks', JSON.stringify([...this.tunerMarks]));
    });
    // 0/1 toggles render as a CHECKBOX, not a two-notch slider. The unused
    // input/value pair keeps the shared applyTuning refresh path happy;
    // sync() mirrors save/reset/defaults into the box.
    if (range.min === 0 && range.max === 1 && range.step === 1) {
      const box = document.createElement('input');
      box.type = 'checkbox';
      box.className = 'hud-tunercheck';
      box.checked = TUNING[key] > 0.5;
      box.addEventListener('change', () => {
        TUNING[key] = box.checked ? 1 : 0;
      });
      wrap.appendChild(label);
      wrap.appendChild(box);
      this.sliderEls.set(key, {
        input: document.createElement('input'),
        value: document.createElement('input'),
        sync: () => (box.checked = TUNING[key] > 0.5),
      });
      return wrap;
    }
    // Editable number box: click and type an exact value (or use the arrows).
    // It accepts anything and clamps to the slider's range on commit.
    const value = document.createElement('input');
    value.type = 'number';
    value.className = 'hud-tunernum';
    value.min = String(range.min);
    value.max = String(range.max);
    value.step = 'any'; // typing isn't bound to the drag step
    value.value = String(TUNING[key]);
    const input = document.createElement('input');
    input.type = 'range';
    input.min = String(range.min);
    input.max = String(range.max);
    input.step = String(range.step);
    input.value = String(TUNING[key]);
    input.addEventListener('input', () => {
      TUNING[key] = Number(input.value);
      value.value = input.value;
    });
    // Typing commits live; clamp to range only on blur/Enter so an in-progress
    // number (e.g. "1" before "12") isn't yanked to the min mid-keystroke.
    value.addEventListener('input', () => {
      const v = Number(value.value);
      if (Number.isFinite(v)) {
        TUNING[key] = v;
        input.value = String(v);
      }
    });
    const commit = (): void => {
      let v = Number(value.value);
      if (!Number.isFinite(v)) v = TUNING[key];
      v = Math.min(range.max, Math.max(range.min, v));
      TUNING[key] = v;
      input.value = String(v);
      value.value = String(v);
    };
    value.addEventListener('change', commit);
    // Keep field keystrokes (digits, WASD, arrows) out of the game's global key
    // handlers, and slider drags from stealing focus.
    for (const ev of ['keydown', 'keyup', 'keypress'])
      value.addEventListener(ev, (e) => e.stopPropagation());
    value.addEventListener('blur', commit);
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
        padding: 8px 10px; border-radius: 8px;
        box-shadow: inset 0 1px 0 rgba(255, 255, 255, 0.08), 0 6px 18px rgba(0, 0, 0, 0.45);
      }
      .hud-stats { min-width: 230px; max-width: 330px; }
      .hud-tuning { width: 250px; max-height: calc(100vh - 60px); overflow-y: auto; }
      .hud-title { color: #8fd4a8; letter-spacing: 2px; margin-bottom: 4px; }
      .hud-levelrow { display: flex; flex-wrap: wrap; gap: 4px; margin-bottom: 6px; }
      .hud-levelrow .hud-levelbtn { flex: 1 1 auto; }
      .hud-tunebtns { display: flex; gap: 4px; margin-bottom: 6px; }
      .hud-capbadge {
        position: fixed; top: 10px; left: 50%; transform: translateX(-50%);
        font: bold 12px ui-monospace, Menlo, Consolas, monospace;
        color: #ffd75e; background: rgba(20, 24, 34, 0.75);
        padding: 4px 10px; border-radius: 10px; letter-spacing: 1px;
        pointer-events: none; z-index: 40;
      }
      .hud-recbadge { color: #ff5e5e; top: 34px; }
      .hud-levelbtn {
        flex: 1; font: 10px ui-monospace, Menlo, Consolas, monospace;
        background: #1c2230; color: #9fb0c8; border: 1px solid #3a4152;
        border-radius: 6px; padding: 3px 2px; cursor: pointer; white-space: nowrap;
      }
      .hud-levelbtn:hover { background: #243044; color: #cfe3d8; }
      .hud-levelbtn.active { background: #2b4436; color: #b6f0cc; border-color: #8fd4a8; }
      .hud-row { display: flex; justify-content: space-between; gap: 12px; }
      .hud-row b { color: #eef4ff; font-weight: normal; }
      .hud-secttitle { margin: 10px 0 2px; padding-bottom: 2px; border-bottom: 1px solid rgba(143, 212, 168, 0.35); color: #8fd4a8; font-size: 11px; letter-spacing: 2px; }
      .hud-slider { display: grid; grid-template-columns: 104px 1fr 52px; gap: 6px; align-items: center; }
      .hud-slider label { color: #9fb0c8; }
      .hud-slider label.hud-marked { color: #58e08a; }
      .hud-slider input[type=range] { width: 100%; accent-color: #8fd4a8; }
      .hud-tunernum { width: 100%; text-align: right; color: #eef4ff; background: #1c2230; border: 1px solid #3a4152; border-radius: 4px; padding: 1px 2px; font: 12px/1.5 ui-monospace, Menlo, Consolas, monospace; box-sizing: border-box; }
      .hud-tunernum:focus { outline: none; border-color: #8fd4a8; background: #243044; }

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
      .side-wrap.left .side-tab { border-radius: 0 8px 8px 0; border-left: none; }
      .side-wrap.right .side-tab { border-radius: 8px 0 0 8px; border-right: none; }

      /* --- Crash-style game HUD --- */
      .hud-tl { position: fixed; top: 16px; left: 40px; z-index: 10; pointer-events: none; }
      .hud-build {
        position: fixed; bottom: 6px; left: 8px; z-index: 10; pointer-events: none;
        font: 10px ui-monospace, Menlo, Consolas, monospace; color: rgba(220, 228, 240, 0.5);
        text-shadow: 0 1px 2px rgba(0,0,0,0.6);
      }
      .hud-tr { position: fixed; top: 16px; right: 40px; z-index: 10; pointer-events: none; }
      .hud-counter { display: flex; align-items: center; gap: 14px; margin-bottom: 10px; }
      .hud-num {
        font: italic 900 clamp(44px, 8.5vh, 78px) Impact, 'Arial Black', sans-serif;
        color: #ffb43a; letter-spacing: 2px; transform: skewX(-6deg);
        text-shadow: 3px 0 0 #3a1c05, -3px 0 0 #3a1c05, 0 3px 0 #3a1c05,
          0 -3px 0 #3a1c05, 0 5px 10px rgba(0, 0, 0, 0.65);
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
        border: 5px solid #6e4f24; box-shadow: 0 4px 9px rgba(0, 0, 0, 0.55);
        border-radius: 6px;
      }
      .hud-icon-wumpa {
        border-radius: 50%;
        background: radial-gradient(circle at 35% 30%, #ffd24a, #e2521e 70%);
        box-shadow: 0 4px 9px rgba(0, 0, 0, 0.55);
      }
      .hud-relics { gap: 10px; }
      .hud-icon-crystal {
        width: clamp(30px, 5.5vh, 48px); height: clamp(42px, 7.5vh, 66px);
        background: linear-gradient(160deg, #ffd4f8 8%, #ff9af0 22%, #c03fe0 55%, #7a1898 90%);
        clip-path: polygon(50% 0%, 100% 38%, 50% 100%, 0% 38%);
        filter: drop-shadow(0 3px 5px rgba(0, 0, 0, 0.6)) drop-shadow(0 0 7px rgba(255, 120, 240, 0.6));
      }
      .hud-icon-gem {
        width: clamp(38px, 7vh, 60px); height: clamp(28px, 5vh, 44px);
        background: linear-gradient(160deg, #eaffff 8%, #bfffff 22%, #35cfe4 55%, #147a90 90%);
        clip-path: polygon(25% 0%, 75% 0%, 100% 35%, 50% 100%, 0% 35%);
        filter: drop-shadow(0 3px 5px rgba(0, 0, 0, 0.6)) drop-shadow(0 0 7px rgba(80, 220, 255, 0.6));
        align-self: center;
      }
      .hud-relic-off { opacity: 0.22; filter: grayscale(1) drop-shadow(0 3px 5px rgba(0, 0, 0, 0.6)); }
      .hud-icon-face {
        border-radius: 40%;
        background: radial-gradient(circle at 40% 35%, #f4b56a, #c96f28 75%);
        border: 3px solid rgba(0, 0, 0, 0.65);
        box-shadow: inset 2px 2px 0 rgba(255, 255, 255, 0.3), 0 4px 9px rgba(0, 0, 0, 0.55);
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

      /* score: bare gold digits under the lives counter, top-right — the
         heavy text outline reads on any background, no plate needed */
      .hud-scoreplate {
        /* tucked right under the lives face, whatever size the vh clamp gives it */
        position: fixed; top: calc(16px + clamp(52px, 9.5vh, 84px) + 4px); right: 40px;
        z-index: 10; pointer-events: none; text-align: right;
      }
      .hud-scorelabel {
        font: italic bold clamp(10px, 1.7vh, 14px) Impact, 'Arial Black', sans-serif;
        letter-spacing: 4px;
        color: #ffd24a; text-shadow: 0 2px 4px rgba(0, 0, 0, 0.75);
      }
      .hud-scorenum {
        font: italic 900 clamp(20px, 3.6vh, 32px) Impact, 'Arial Black', sans-serif;
        letter-spacing: 2px;
        color: #ffe9b0;
        text-shadow: 2px 0 0 #3a1c05, -2px 0 0 #3a1c05, 0 2px 0 #3a1c05,
          0 -2px 0 #3a1c05, 0 4px 8px rgba(0, 0, 0, 0.6);
      }

      /* TIME TRIAL: big top-center clock — bare gold digits like the score,
         ice blue while a time crate's freeze holds it still */
      .hud-ttclock {
        /* top right, in the lives counter's spot (lives hide during trials) */
        position: fixed; top: 10px; right: 36px;
        z-index: 10; pointer-events: none; text-align: right;
      }
      .hud-tttime {
        font: italic 900 clamp(40px, 7.5vh, 66px) Impact, 'Arial Black', sans-serif;
        letter-spacing: 4px; color: #f2f7ff;
        text-shadow: 3px 0 0 #101820, -3px 0 0 #101820, 0 3px 0 #101820,
          0 -3px 0 #101820, 0 5px 12px rgba(0, 0, 0, 0.6);
      }
      .hud-tt-frozen .hud-tttime { color: #6ee6ff; }
      .hud-ttfreeze {
        font: italic bold clamp(13px, 2vh, 18px) Impact, 'Arial Black', sans-serif;
        letter-spacing: 3px; color: #6ee6ff; margin-top: -4px;
        text-shadow: 2px 0 0 #06222c, -2px 0 0 #06222c, 0 2px 0 #06222c, 0 -2px 0 #06222c;
      }
      /* ranked times card at the gate */
      .hud-ttresults {
        position: fixed; z-index: 15; top: 50%; left: 50%; transform: translate(-50%, -50%);
        min-width: 280px; text-align: center; pointer-events: none;
        color: #cfe3d8;
        background: linear-gradient(180deg, rgba(26, 30, 44, 0.94), rgba(10, 12, 18, 0.94));
        border: 1px solid #3a4152; border-radius: 12px; padding: 18px 28px 14px;
        box-shadow: inset 0 1px 0 rgba(255, 255, 255, 0.08), 0 10px 30px rgba(0, 0, 0, 0.55);
        font: 14px/1.6 ui-monospace, Menlo, Consolas, monospace;
      }
      .hud-ttres-title {
        font: italic bold 26px Impact, 'Arial Black', sans-serif;
        letter-spacing: 4px; color: #ffd24a; margin-bottom: 2px;
        text-shadow: 0 2px 5px rgba(0,0,0,0.7);
      }
      .hud-ttres-time {
        font: italic 900 44px Impact, 'Arial Black', sans-serif;
        letter-spacing: 3px; color: #ffe9b0; margin-bottom: 10px;
        text-shadow: 2px 0 0 #3a1c05, -2px 0 0 #3a1c05, 0 2px 0 #3a1c05, 0 -2px 0 #3a1c05;
      }
      .hud-ttrow {
        display: flex; justify-content: space-between; gap: 24px;
        padding: 1px 6px; border-radius: 4px; color: #9fb0c8;
      }
      .hud-ttrow-new { background: #2b4436; color: #b6f0cc; }
      .hud-ttres-sub { margin-top: 10px; color: #9fb0c8; font-size: 12px; letter-spacing: 1px; }

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
          0 -2px 0 #3a1c05, 0 3px 7px rgba(0, 0, 0, 0.6);
        white-space: nowrap; overflow: hidden; text-overflow: ellipsis;
      }
      .hud-tricktotal {
        font: italic 900 clamp(28px, 5vh, 46px) Impact, 'Arial Black', sans-serif;
        letter-spacing: 4px; color: #ffb43a; transform: skewX(-6deg); margin-top: 2px;
        text-shadow: 2px 0 0 #3a1c05, -2px 0 0 #3a1c05, 0 2px 0 #3a1c05,
          0 -2px 0 #3a1c05, 0 4px 8px rgba(0, 0, 0, 0.6);
        animation: combopulse 0.5s ease-in-out infinite alternate;
      }
      @keyframes combopulse {
        from { transform: skewX(-6deg) scale(1); }
        to { transform: skewX(-6deg) scale(1.05); }
      }
      /* BAILED combo: text goes red, shakes "no", then drops away. */
      .hud-trick-bail .hud-trickline,
      .hud-trick-bail .hud-tricktotal {
        color: #ff3b30 !important;
        text-shadow: 2px 0 0 #4a0000, -2px 0 0 #4a0000, 0 2px 0 #4a0000,
          0 -2px 0 #4a0000, 0 3px 8px rgba(0, 0, 0, 0.75);
        animation: none;
      }
      .hud-trick-bail { animation: trickbail 0.7s ease-in forwards; }
      @keyframes trickbail {
        0%   { transform: translateX(-50%) translateY(0) rotate(0deg); opacity: 1; }
        9%   { transform: translateX(-50%) translateY(0) rotate(-5deg); }
        18%  { transform: translateX(-50%) translateY(0) rotate(5deg); }
        27%  { transform: translateX(-50%) translateY(0) rotate(-5deg); }
        36%  { transform: translateX(-50%) translateY(0) rotate(4deg); }
        45%  { transform: translateX(-50%) translateY(0) rotate(-2deg); }
        58%  { transform: translateX(-50%) translateY(0) rotate(0deg); opacity: 1; }
        100% { transform: translateX(-50%) translateY(64px) rotate(0deg); opacity: 0; }
      }

      .hud-msg {
        position: fixed; z-index: 11; top: 34%; left: 50%; transform: translate(-50%, -50%);
        text-align: center; color: #fff; pointer-events: none;
        text-shadow: 0 2px 6px rgba(0, 0, 0, 0.8);
      }
      .hud-msg-title {
        font: bold 52px ui-monospace, Menlo, Consolas, monospace; letter-spacing: 4px;
        text-shadow: 3px 0 0 #000, -3px 0 0 #000, 0 3px 0 #000, 0 -3px 0 #000,
          0 5px 12px rgba(0, 0, 0, 0.75);
      }
      .hud-msg-sub { font: 16px ui-monospace, Menlo, Consolas, monospace; margin-top: 8px; color: #cfe3d8; }
      .hud-flash {
        position: fixed; z-index: 12; inset: 0; background: #a3202a;
        opacity: 0; pointer-events: none;
      }
      /* death blackout: above the HUD, below the GAME OVER text */
      .hud-fade {
        position: fixed; z-index: 19; inset: 0; background: #000;
        opacity: 0; pointer-events: none;
      }
      .hud-death {
        position: fixed; z-index: 20; inset: 0; background: #000;
        display: none; flex-direction: column; align-items: center;
        justify-content: center; color: #fff;
        font: bold 54px ui-monospace, Menlo, Consolas, monospace;
        pointer-events: none; /* fullscreen INFO: it must never eat clicks */
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
        margin-left: -4px; border-radius: 4px; background: #8fd4a8;
        box-shadow: 0 2px 5px rgba(0, 0, 0, 0.5);
      }
      .hud-vbalance {
        position: fixed; z-index: 10; left: calc(50% + 96px); bottom: 22%;
        width: 14px; height: 132px;
        background: linear-gradient(90deg, rgba(8, 10, 15, 0.9), rgba(26, 30, 44, 0.9));
        border: 1px solid #3a4152; border-radius: 7px;
        box-shadow: inset 2px 0 3px rgba(0, 0, 0, 0.6), 0 1px 0 rgba(255, 255, 255, 0.12);
      }
      .hud-vbalance-center {
        position: absolute; top: 50%; left: 2px; right: 2px; height: 2px;
        margin-top: -1px; background: #5a6478;
      }
      .hud-vbalance-cap {
        position: absolute; left: 4px; right: 4px; height: 2px;
        background: #454e62; border-radius: 1px;
      }
      .hud-vbalance-needle {
        position: absolute; left: -4px; height: 8px; width: 22px;
        margin-top: -4px; border-radius: 4px; background: #8fd4a8;
        box-shadow: 0 2px 5px rgba(0, 0, 0, 0.5);
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
