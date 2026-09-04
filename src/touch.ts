// Mobile touch controls: a translucent 8-way D-pad (left thumb), the PS
// face-button diamond (right thumb), a top-left pause button, and quick
// vertical swipes on the right half: upward for R2, downward for L2 inventory.
// Active only on coarse-pointer devices (or force-enabled with '?touch' for
// testing) — desktop keeps keyboard/gamepad
// untouched. The same class also flips the HUD into its compact phone layout
// via the body.tc-on styles below.
//
// Input flow: Input.update() polls this object every render frame and merges
// it exactly like the gamepad, so edge detection (pressed/released) comes for
// free and replays record touch play like any other input.

import { sfx } from './audio';

// 8 sectors, 45° apart, index 0 = East, counter-clockwise (atan2 space).
// Diagonals emit both axes at ±1; Input's unit-clamp normalizes them.
const SECTOR_XY: [number, number][] = [
  [1, 0],
  [1, 1],
  [0, 1],
  [-1, 1],
  [-1, 0],
  [-1, -1],
  [0, -1],
  [1, -1],
];

interface BtnDef {
  key: 'x' | 'o' | 'sq' | 'tri';
  glyph: string;
  // diamond offsets in button-radius units from the cluster centre
  dx: number;
  dy: number;
  tickRate: number; // audio feedback pitch per button
}

// diamond offsets in % of the cluster box from its centre — at 38% button
// size, ±31% puts every button edge EXACTLY at the box edge (no overflow,
// no clipping, even visual padding against the mirrored D-pad)
const BTNS: BtnDef[] = [
  { key: 'tri', glyph: '△', dx: 0, dy: -31, tickRate: 2.4 },
  { key: 'o', glyph: '○', dx: 31, dy: 0, tickRate: 2.0 },
  { key: 'x', glyph: '×', dx: 0, dy: 31, tickRate: 1.7 },
  { key: 'sq', glyph: '□', dx: -31, dy: 0, tickRate: 2.2 },
];

// R2 swipe gate: a clear, fast, mostly-vertical upward flick — button taps
// (short travel) and slides between buttons (slow / horizontal) never fire it.
const SWIPE_MIN_PX = 64;
const SWIPE_MAX_MS = 320;
const SWIPE_MIN_VEL = 0.35; // px per ms
// Touch has no physical trigger to keep depressed. Hold the emulated R2 long
// enough to cover an in-place rail-air spin without lateral transfer.
const SWIPE_HOLD_MS = 450;

/** One shared touch/coarse-pointer gate for input and presentation policy. */
export function touchControlsRequested(): boolean {
  return (
    (typeof matchMedia === 'function' && matchMedia('(pointer: coarse)').matches) ||
    window.location.search.includes('touch')
  );
}

export class TouchControls {
  enabled = false;
  moveX = 0;
  moveY = 0;
  jumpHeld = false;
  grabHeld = false;
  spinHeld = false;
  grindHeld = false;

  private transferUntil = 0;
  private inventoryUntil = 0;
  private dirIdx = -1; // active D-pad sector, -1 = neutral (hysteresis state)
  private padPointer: number | null = null;
  private padEl!: HTMLElement;
  private arrowEls!: Record<'up' | 'down' | 'left' | 'right', HTMLElement>;
  private btnEls = new Map<string, HTMLElement>();
  private prevBtn = { x: false, o: false, sq: false, tri: false };
  // every live right-hand pointer: which button it holds + swipe bookkeeping
  private rightTouches = new Map<
    number,
    { btn: BtnDef['key'] | null; x0: number; y0: number; t0: number; swiped: boolean; onBtn: boolean }
  >();

  constructor(private onPause: () => void = () => {}) {
    this.enabled = touchControlsRequested();
    if (!this.enabled) return;
    document.body.classList.add('tc-on');
    this.injectStyle();
    this.buildDpad();
    this.buildButtons();
    this.buildPauseButton();
    // iOS zoom killers: pinch (gesture*) and double-tap (dblclick) must never
    // scale the game. touch-action handles modern Safari; these catch the rest.
    const kill = (e: Event): void => e.preventDefault();
    document.addEventListener('gesturestart', kill);
    document.addEventListener('gesturechange', kill);
    document.addEventListener('dblclick', kill);
    (window as unknown as Record<string, unknown>).__touch = this; // test hook
  }

  transferActive(): boolean {
    return performance.now() < this.transferUntil;
  }

  inventoryActive(): boolean {
    return performance.now() < this.inventoryUntil;
  }

  private buildPauseButton(): void {
    const button = document.createElement('button');
    button.type = 'button';
    button.className = 'tc-pause';
    button.setAttribute('aria-label', 'Pause game');
    button.innerHTML = '<span aria-hidden="true"></span><span aria-hidden="true"></span>';
    button.addEventListener('pointerdown', () => button.classList.add('on'));
    const release = (): void => button.classList.remove('on');
    button.addEventListener('pointerup', release);
    button.addEventListener('pointercancel', release);
    button.addEventListener('pointerleave', release);
    button.addEventListener('click', (event) => {
      event.preventDefault();
      button.blur();
      sfx.play('footstep1', 0.32, 2.5);
      this.onPause();
    });
    document.body.appendChild(button);
  }

  // ---------- D-PAD (left zone) ----------

  private buildDpad(): void {
    const zone = document.createElement('div');
    zone.className = 'tc-zone tc-left';
    const pad = document.createElement('div');
    pad.className = 'tc-pad';
    this.padEl = pad;
    const arrows = {} as Record<'up' | 'down' | 'left' | 'right', HTMLElement>;
    const glyphs = { up: '▲', down: '▼', left: '◀', right: '▶' } as const;
    for (const dir of ['up', 'down', 'left', 'right'] as const) {
      const a = document.createElement('div');
      a.className = `tc-arrow tc-a-${dir}`;
      a.textContent = glyphs[dir];
      pad.appendChild(a);
      arrows[dir] = a;
    }
    this.arrowEls = arrows;
    zone.appendChild(pad);
    document.body.appendChild(zone);

    // One continuous surface: the WHOLE lower-left zone steers relative to the
    // visible pad's centre, so the invisible hit area is far bigger than the
    // drawn arrows and the thumb can slide between directions without lifting.
    const down = (e: PointerEvent): void => {
      if (this.padPointer !== null) return; // first touch drives, extras ignored
      this.padPointer = e.pointerId;
      this.capture(zone, e);
      this.steer(e.clientX, e.clientY);
      e.preventDefault();
    };
    const move = (e: PointerEvent): void => {
      if (e.pointerId !== this.padPointer) return;
      this.steer(e.clientX, e.clientY);
      e.preventDefault();
    };
    const up = (e: PointerEvent): void => {
      if (e.pointerId !== this.padPointer) return;
      this.padPointer = null;
      this.dirIdx = -1;
      this.moveX = 0;
      this.moveY = 0;
      this.paintArrows();
    };
    zone.addEventListener('pointerdown', down);
    zone.addEventListener('pointermove', move);
    zone.addEventListener('pointerup', up);
    zone.addEventListener('pointercancel', up);
    zone.addEventListener('contextmenu', (e) => e.preventDefault());
  }

  private steer(cx: number, cy: number): void {
    const r = this.padEl.getBoundingClientRect();
    const dx = cx - (r.left + r.width / 2);
    const dy = cy - (r.top + r.height / 2);
    const dist = Math.hypot(dx, dy);
    // radial hysteresis: engage past 16px, only drop back to neutral inside 10px
    if (this.dirIdx === -1 && dist < 16) return;
    if (dist < 10) {
      this.dirIdx = -1;
      this.moveX = 0;
      this.moveY = 0;
      this.paintArrows();
      return;
    }
    const ang = Math.atan2(-dy, dx); // screen-up = +Y = forward
    const idx = ((Math.round(ang / (Math.PI / 4)) % 8) + 8) % 8;
    if (this.dirIdx !== -1 && idx !== this.dirIdx) {
      // angular hysteresis: hold the current sector until the thumb is
      // clearly (30° > the 22.5° boundary) into a neighbour — no flicker
      // when resting right on a boundary.
      // The wrap has to fold into [0,PI] the hard way. `centre` runs 0..315deg
      // but atan2 returns -180..180deg, so the raw gap reaches 315+180=495deg;
      // the old `2PI - diff` only corrects a gap under 2PI, and past that it
      // went NEGATIVE, which sails under the 30deg test and pins the sector.
      // That locked the whole bottom of the pad: down-right could not step to
      // down, down could not step to down-left, down-left could not step to
      // left — the thumb had to be lifted back to the dead zone to escape.
      const centre = this.dirIdx * (Math.PI / 4);
      const diff = Math.abs(((ang - centre + Math.PI * 3) % (Math.PI * 2)) - Math.PI);
      if (diff < (Math.PI / 180) * 30) return;
    }
    if (idx !== this.dirIdx) {
      this.dirIdx = idx;
      [this.moveX, this.moveY] = SECTOR_XY[idx];
      this.paintArrows();
    }
  }

  private paintArrows(): void {
    const a = this.arrowEls;
    a.right.classList.toggle('on', this.moveX > 0);
    a.left.classList.toggle('on', this.moveX < 0);
    a.up.classList.toggle('on', this.moveY > 0);
    a.down.classList.toggle('on', this.moveY < 0);
  }

  // ---------- FACE BUTTONS + R2 SWIPE (right zone) ----------

  private buildButtons(): void {
    const zone = document.createElement('div');
    zone.className = 'tc-zone tc-right';
    const cluster = document.createElement('div');
    cluster.className = 'tc-cluster';
    for (const b of BTNS) {
      const el = document.createElement('div');
      el.className = 'tc-btn';
      el.textContent = b.glyph;
      el.style.left = `${50 + b.dx}%`;
      el.style.top = `${50 + b.dy}%`;
      cluster.appendChild(el);
      this.btnEls.set(b.key, el);
    }
    zone.appendChild(cluster);
    document.body.appendChild(zone);

    const down = (e: PointerEvent): void => {
      this.rightTouches.set(e.pointerId, {
        btn: this.nearestBtn(e.clientX, e.clientY, 2.1),
        x0: e.clientX,
        y0: e.clientY,
        t0: performance.now(),
        swiped: false,
        onBtn: false,
      });
      const t = this.rightTouches.get(e.pointerId)!;
      // a touch that STARTS on a button is a button press, full stop — it can
      // never turn into an R2 swipe, so circle presses don't fight the flick
      t.onBtn = t.btn !== null;
      this.capture(zone, e);
      this.refreshButtons();
      e.preventDefault();
    };
    const move = (e: PointerEvent): void => {
      const t = this.rightTouches.get(e.pointerId);
      if (!t) return;
      e.preventDefault();
      if (!t.swiped && !t.onBtn) {
        // Triggers: a quick, clearly-vertical flick from EMPTY right-half
        // space (touches that began on a button are excluded above). Up is R2;
        // down is the touch equivalent of L2 collection inventory.
        const rise = t.y0 - e.clientY;
        const dt = performance.now() - t.t0;
        if (
          Math.abs(rise) > SWIPE_MIN_PX &&
          dt < SWIPE_MAX_MS &&
          Math.abs(rise) / Math.max(dt, 1) > SWIPE_MIN_VEL &&
          Math.abs(rise) > 1.4 * Math.abs(e.clientX - t.x0)
        ) {
          t.swiped = true;
          t.btn = null; // the swipe gesture owns this touch now
          if (rise > 0) {
            this.transferUntil = performance.now() + SWIPE_HOLD_MS;
            sfx.play('woosh3', 0.4, 1.6);
          } else {
            this.inventoryUntil = performance.now() + SWIPE_HOLD_MS;
          }
          this.refreshButtons();
          return;
        }
      }
      // sliding between buttons never drops input: reassign when the thumb
      // is inside another button's (generous) circle, otherwise keep the last
      if (!t.swiped) {
        const b = this.nearestBtn(e.clientX, e.clientY, 1.6);
        if (b && b !== t.btn) {
          t.btn = b;
          this.refreshButtons();
        }
      }
    };
    const up = (e: PointerEvent): void => {
      this.rightTouches.delete(e.pointerId);
      this.refreshButtons();
    };
    zone.addEventListener('pointerdown', down);
    zone.addEventListener('pointermove', move);
    zone.addEventListener('pointerup', up);
    zone.addEventListener('pointercancel', up);
    zone.addEventListener('contextmenu', (e) => e.preventDefault());
  }

  // nearest face button within `reach` button-radii (generous invisible area)
  private nearestBtn(x: number, y: number, reach: number): BtnDef['key'] | null {
    let best: BtnDef['key'] | null = null;
    let bestD = Infinity;
    for (const [key, el] of this.btnEls) {
      const r = el.getBoundingClientRect();
      const d = Math.hypot(x - (r.left + r.width / 2), y - (r.top + r.height / 2));
      if (d < (r.width / 2) * reach && d < bestD) {
        bestD = d;
        best = key as BtnDef['key'];
      }
    }
    return best;
  }

  private refreshButtons(): void {
    const held = { x: false, o: false, sq: false, tri: false };
    for (const t of this.rightTouches.values()) if (t.btn) held[t.btn] = true;
    for (const b of BTNS) {
      this.btnEls.get(b.key)!.classList.toggle('on', held[b.key]);
      // audio tick on the press edge only — release stays silent
      if (held[b.key] && !this.prevBtn[b.key]) sfx.play('footstep1', 0.28, b.tickRate);
    }
    this.prevBtn = held;
    this.jumpHeld = held.x;
    this.grabHeld = held.o;
    this.spinHeld = held.sq;
    this.grindHeld = held.tri;
  }

  // Pointer capture keeps move/up events flowing when the thumb wanders off
  // the zone; synthetic test events carry ids the browser doesn't know.
  private capture(el: HTMLElement, e: PointerEvent): void {
    try {
      el.setPointerCapture(e.pointerId);
    } catch {
      /* synthetic pointer in tests */
    }
  }

  private injectStyle(): void {
    const style = document.createElement('style');
    style.textContent = `
      /* ---------- touch control surfaces ---------- */
      .tc-zone {
        position: fixed; bottom: 0; z-index: 14; touch-action: none;
        -webkit-user-select: none; user-select: none; -webkit-touch-callout: none;
        -webkit-tap-highlight-color: transparent;
      }
      body.tc-on {
        --tc-size: clamp(136px, 40vh, 168px);
        --tc-size: clamp(136px, 40dvh, 168px);
        --tc-left-edge: max(12px, env(safe-area-inset-left));
        --tc-right-edge: max(12px, env(safe-area-inset-right));
        --tc-bottom-edge: max(10px, env(safe-area-inset-bottom));
        --tc-top-edge: max(8px, env(safe-area-inset-top));
      }
      .tc-pause {
        position: fixed; z-index: 14;
        top: var(--tc-top-edge); left: var(--tc-left-edge);
        width: 48px; height: 48px; padding: 0;
        display: flex; align-items: center; justify-content: center; gap: 6px;
        border-radius: 14px;
        border: 1px solid rgba(255, 255, 255, 0.45);
        background: rgba(244, 238, 218, 0.34);
        box-shadow: 0 2px 7px rgba(20, 14, 4, 0.22), inset 0 1px 0 rgba(255,255,255,.32);
        -webkit-backdrop-filter: blur(5px) saturate(1.1);
        backdrop-filter: blur(5px) saturate(1.1);
        touch-action: manipulation;
        -webkit-tap-highlight-color: transparent;
      }
      .tc-pause span {
        display: block; width: 6px; height: 21px; border-radius: 2px;
        background: rgba(48, 42, 31, 0.72);
        box-shadow: inset 1px 1px 0 rgba(255,255,255,.25);
      }
      .tc-pause.on { transform: scale(.92); background: rgba(255,246,208,.68); }
      body.game-shell-modal .tc-pause,
      body.ed-active .tc-pause,
      body.tc-on.tool-panel-open .tc-pause { display: none !important; }
      .tc-left { left: 0; width: 50vw; height: 52%; }
      .tc-right { right: 0; width: 50vw; height: 62%; }
      /* the two groups: identical footprint, identical height, identical
         distance from their screen edge — a matched pair */
      .tc-pad, .tc-cluster {
        position: absolute;
        bottom: var(--tc-bottom-edge);
        width: var(--tc-size); height: var(--tc-size);
        pointer-events: none;
      }
      .tc-pad { left: var(--tc-left-edge); }
      .tc-cluster { right: var(--tc-right-edge); }
      /* shared glass finish: frosted fill, hairline light edge, soft drop */
      .tc-arrow, .tc-btn {
        box-sizing: border-box;
        background: rgba(244, 238, 218, 0.30);
        border: 1px solid rgba(255, 255, 255, 0.38);
        -webkit-backdrop-filter: blur(6px) saturate(1.15);
        backdrop-filter: blur(6px) saturate(1.15);
        box-shadow: 0 2px 6px rgba(20, 14, 4, 0.16), inset 0 1px 0 rgba(255, 255, 255, 0.3);
        transition: background 0.06s, transform 0.06s, color 0.06s;
      }
      .tc-arrow {
        position: absolute; width: 34%; height: 34%;
        border-radius: 22%;
        display: flex; align-items: center; justify-content: center;
        font: 600 clamp(13px, 4vw, 19px)/1 -apple-system, system-ui, sans-serif;
        color: rgba(52, 44, 30, 0.55);
      }
      .tc-arrow.on {
        background: rgba(255, 246, 208, 0.68); transform: scale(0.94);
        color: rgba(40, 36, 26, 0.85);
      }
      .tc-a-up { left: 33%; top: 0; border-radius: 30% 30% 14% 14%; }
      .tc-a-down { left: 33%; bottom: 0; border-radius: 14% 14% 30% 30%; }
      .tc-a-left { left: 0; top: 33%; border-radius: 30% 14% 14% 30%; }
      .tc-a-right { right: 0; top: 33%; border-radius: 14% 30% 30% 14%; }
      .tc-btn {
        position: absolute; width: 38%; height: 38%;
        transform: translate(-50%, -50%);
        border-radius: 50%;
        display: flex; align-items: center; justify-content: center;
        font: 600 clamp(15px, 4.6vw, 22px)/1 -apple-system, system-ui, sans-serif;
        color: rgba(52, 44, 30, 0.55);
      }
      .tc-btn.on {
        background: rgba(255, 246, 208, 0.68);
        transform: translate(-50%, -50%) scale(0.92);
        color: rgba(40, 36, 26, 0.85);
      }

      /* ---------- compact phone HUD ---------- */
      body.tc-on #app { touch-action: none; }
      body.tc-on .hud-tl {
        top: max(8px, env(safe-area-inset-top));
        left: max(72px, calc(env(safe-area-inset-left) + 64px));
      }
      body.tc-on .hud-tr {
        top: max(8px, env(safe-area-inset-top));
        right: max(42px, calc(env(safe-area-inset-right) + 8px));
      }
      body.tc-on .hud-life-row {
        right: max(42px, calc(env(safe-area-inset-right) + 8px));
        top: max(8px, env(safe-area-inset-top));
        bottom: auto;
      }
      body.tc-on .game-hud-layer:not(.hud-run-mode):not(.hud-bonus) .hud-tr {
        top: max(72px, calc(env(safe-area-inset-top) + 64px));
      }
      body.tc-on .hud-counter { gap: 9px; margin-bottom: 5px; }
      body.tc-on .hud-icon { width: 55px; height: 55px; }
      body.tc-on .hud-life-face-wrap { width: 55px; height: 55px; }
      body.tc-on .hud-box-total { font-size: 25px; margin-bottom: 7px; }
      body.tc-on .hud-icon-crystal { width: 27px; height: 39px; }
      body.tc-on .hud-icon-gem { width: 34px; height: 26px; }
      body.tc-on .hud-relics { gap: 9px; }
      /* no inset: the clock is a row of the .hud-tr column now, not a fixed
         element pinned to the same corner the score is in */
      body.tc-on .hud-ttresults { min-width: 0; width: 78vw; padding: 12px 14px 10px; }
      body.tc-on .hud-boosts { bottom: 44%; }
      body.tc-on .hud-trickplate { bottom: 35%; }
      body.tc-on .hud-msg-sub { font-size: 12px; }
      body.tc-on .hud-balance { width: 170px; bottom: 31%; }
      body.tc-on .hud-vbalance { left: calc(50% + 72px); bottom: 29%; height: 110px; }
      body.tc-on .hud-death { font-size: 34px; }
      /* Phone sizes for the Roo readouts. Like the desktop rules these are
         CAP HEIGHTS in px — the label's box is one viewBox tall, so the
         font-size IS the drawn letter (see the .roo-line note in ui.ts).
         Everything is a portrait-sized step down from the desktop scale,
         holding the same order: counters lead, trial clock matches, trick
         total under, score and captions under that.

         Raised alongside the desktop scale, each by its own ratio, because
         the same too-timid pass shrank both. The phone is where a small
         readout hurts most — it's a 6" screen at arm's length with a thumb
         over one corner of it — so this tracks the desktop step for step. */
      body.tc-on .hud-num { font-size: 45px; letter-spacing: 1px; }
      body.tc-on .hud-scorelabel { font-size: 14px; letter-spacing: 3px; }
      body.tc-on .hud-scorenum { font-size: 23px; letter-spacing: 2px; }
      body.tc-on .hud-tttime { font-size: 50px; letter-spacing: 2px; }
      body.tc-on .hud-ttfreeze { font-size: 14px; }
      body.tc-on .hud-ttres-time { font-size: 49px; }
      body.tc-on .hud-trickline { font-size: 19px; letter-spacing: 1px; }
      body.tc-on .hud-tricktotal { font-size: 33px; letter-spacing: 2px; }
      body.tc-on .hud-msg-title { font-size: 45px; letter-spacing: 3px; }
      body.tc-on .hud-boostlabel { font-size: 16px; }
      body.tc-on .hud-death-title { font-size: 58px; }
      body.tc-on .hud-special { inset: -6px; width: auto; }
      body.tc-on .game-hud-layer.hud-bonus .hud-tl {
        position: static;
      }
      body.tc-on .game-hud-layer.hud-bonus .hud-fruit-row {
        left: max(12px, env(safe-area-inset-left));
        bottom: calc(var(--tc-bottom-edge) + var(--tc-size) + 10px);
      }
      body.tc-on .game-hud-layer.hud-bonus .hud-crate-row {
        left: 42%;
        bottom: calc(var(--tc-bottom-edge) + var(--tc-size) + 10px);
      }
      body.tc-on .game-hud-layer.hud-bonus .hud-life-row {
        top: auto;
        bottom: calc(var(--tc-bottom-edge) + var(--tc-size) + 10px);
      }
      body.tc-on .hud-bonus-title { top: max(8px, env(safe-area-inset-top)); }
      body.tc-on .hud-build { display: none; }

      /* A presentation panel opened from TUNER owns the screen until closed;
         dormant touch hit zones must not sit invisibly underneath it. */
      body.tc-on.tool-panel-open .tc-zone {
        display: none !important;
      }
      body.tc-on.side-panel-left-open .tc-left,
      body.tc-on.side-panel-right-open .tc-right {
        display: none !important;
      }

      /* ---------- panels that actually fit a phone ---------- */
      body.tc-on .hud-stats {
        min-width: 0; width: min(76vw, 330px);
        max-height: calc(100dvh - 16px); overflow-y: auto;
        touch-action: pan-y;
      }
      body.tc-on .hud-tuning { touch-action: pan-y; }
      /* standalone (home-screen) mode renders behind the Dynamic Island:
         drop the side tabs below it */
      body.tc-on .side-wrap { top: max(10px, env(safe-area-inset-top)); }
      /* the level list is one row per level: keep it a column, just fatter */
      body.tc-on .hud-levelrow { gap: 6px; }
      body.tc-on .hud-levelbtn { font-size: 12px; padding: 10px 4px; }
      body.tc-on .hud-levelitem .hud-leveleditbtn { flex: 0 0 40px; }
      body.tc-on .hud-tuning { width: min(78vw, 320px); max-height: calc(100dvh - 16px); }
      body.tc-on .hud-slider { grid-template-columns: 84px 1fr 46px; }
      body.tc-on .hud-slider input[type=range] { height: 30px; }
      body.tc-on .side-tab { width: 34px; padding: 14px 4px; font-size: 11px; }
      body.tc-on .side-wrap { z-index: 16; }
      body.tc-on .side-wrap.left.collapsed { transform: translateX(calc(-100% + 34px)); }
      body.tc-on .side-wrap.right.collapsed { transform: translateX(calc(100% - 34px)); }
    `;
    document.head.appendChild(style);
  }
}
