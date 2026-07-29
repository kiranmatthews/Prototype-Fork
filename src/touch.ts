// Mobile touch controls: a translucent 8-way D-pad (left thumb), the PS
// face-button diamond (right thumb), and a quick upward swipe on the right
// half for R2 (spine transfers). Active only on coarse-pointer devices (or
// force-enabled with '?touch' for testing) — desktop keeps keyboard/gamepad
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
const SWIPE_HOLD_MS = 130; // how long the R2 "press" stays held for the poll

export class TouchControls {
  enabled = false;
  moveX = 0;
  moveY = 0;
  jumpHeld = false;
  grabHeld = false;
  spinHeld = false;
  grindHeld = false;

  private transferUntil = 0;
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

  constructor() {
    this.enabled =
      (typeof matchMedia === 'function' && matchMedia('(pointer: coarse)').matches) ||
      window.location.search.includes('touch');
    if (!this.enabled) return;
    document.body.classList.add('tc-on');
    this.injectStyle();
    this.buildDpad();
    this.buildButtons();
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

  // ---------- D-PAD (left zone) ----------

  private buildDpad(): void {
    const zone = document.createElement('div');
    zone.className = 'tc-zone tc-left';
    const pad = document.createElement('div');
    pad.className = 'tc-pad';
    this.padEl = pad;
    // faint centre hub ties the four arms into one visibly-centred plus
    const hub = document.createElement('div');
    hub.className = 'tc-hub';
    pad.appendChild(hub);
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
      const centre = this.dirIdx * (Math.PI / 4);
      let diff = Math.abs(ang - centre);
      if (diff > Math.PI) diff = 2 * Math.PI - diff;
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
        // R2: a quick, clearly-vertical upward flick from EMPTY right-half
        // space (touches that began on a button are excluded above)
        const rise = t.y0 - e.clientY;
        const dt = performance.now() - t.t0;
        if (
          rise > SWIPE_MIN_PX &&
          dt < SWIPE_MAX_MS &&
          rise / Math.max(dt, 1) > SWIPE_MIN_VEL &&
          rise > 1.4 * Math.abs(e.clientX - t.x0)
        ) {
          t.swiped = true;
          t.btn = null; // the swipe gesture owns this touch now
          this.transferUntil = performance.now() + SWIPE_HOLD_MS;
          sfx.play('woosh3', 0.4, 1.6);
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
      .tc-left { left: 0; width: 50vw; height: 46%; }
      .tc-right { right: 0; width: 50vw; height: 78%; }
      /* the two groups: identical footprint, identical height, identical
         distance from their screen edge — a matched pair */
      .tc-pad, .tc-cluster {
        position: absolute;
        bottom: max(8px, calc(env(safe-area-inset-bottom) - 20px));
        width: min(39vw, 195px); height: min(39vw, 195px);
        pointer-events: none;
      }
      .tc-pad { left: 14px; }
      .tc-cluster { right: 14px; }
      /* shared glass finish: frosted fill, hairline light edge, soft drop */
      .tc-arrow, .tc-btn, .tc-hub {
        box-sizing: border-box;
        background: rgba(244, 238, 218, 0.30);
        border: 1px solid rgba(255, 255, 255, 0.38);
        -webkit-backdrop-filter: blur(6px) saturate(1.15);
        backdrop-filter: blur(6px) saturate(1.15);
        box-shadow: 0 2px 6px rgba(20, 14, 4, 0.16), inset 0 1px 0 rgba(255, 255, 255, 0.3);
        transition: background 0.06s, transform 0.06s, color 0.06s;
      }
      .tc-hub {
        position: absolute; left: 34%; top: 34%; width: 32%; height: 32%;
        border-radius: 20%; background: rgba(244, 238, 218, 0.18);
        box-shadow: none;
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
      body.tc-on .hud-tl { top: max(8px, env(safe-area-inset-top)); left: 42px; }
      body.tc-on .hud-tr { top: max(8px, env(safe-area-inset-top)); right: 42px; }
      body.tc-on .hud-counter { gap: 7px; margin-bottom: 4px; }
      body.tc-on .hud-num { font-size: 26px; letter-spacing: 1px; }
      body.tc-on .hud-icon { width: 30px; height: 30px; }
      body.tc-on .hud-icon-crate { border-width: 3px; border-radius: 4px; }
      body.tc-on .hud-icon-crystal { width: 17px; height: 25px; }
      body.tc-on .hud-icon-gem { width: 21px; height: 16px; }
      body.tc-on .hud-relics { gap: 6px; }
      body.tc-on .hud-scoreplate {
        right: 42px; top: calc(max(8px, env(safe-area-inset-top)) + 38px);
      }
      body.tc-on .hud-scorelabel { font-size: 9px; letter-spacing: 3px; }
      body.tc-on .hud-scorenum { font-size: 17px; letter-spacing: 2px; }
      body.tc-on .hud-ttclock { top: max(8px, env(safe-area-inset-top)); right: 42px; }
      body.tc-on .hud-tttime { font-size: 30px; letter-spacing: 2px; }
      body.tc-on .hud-ttfreeze { font-size: 11px; }
      body.tc-on .hud-ttresults { min-width: 0; width: 78vw; padding: 12px 14px 10px; }
      body.tc-on .hud-ttres-time { font-size: 32px; }
      body.tc-on .hud-boosts { bottom: 44%; }
      body.tc-on .hud-trickplate { bottom: 35%; }
      body.tc-on .hud-trickline { font-size: 15px; letter-spacing: 1px; }
      body.tc-on .hud-tricktotal { font-size: 23px; letter-spacing: 2px; }
      body.tc-on .hud-msg-title { font-size: 30px; letter-spacing: 3px; }
      body.tc-on .hud-msg-sub { font-size: 12px; }
      body.tc-on .hud-balance { width: 170px; bottom: 31%; }
      body.tc-on .hud-vbalance { left: calc(50% + 72px); bottom: 29%; height: 110px; }
      body.tc-on .hud-death { font-size: 34px; }
      /* The HUD readouts are drawn glyphs now (hudfont.ts), not text: an
         outline, an inline and a fill inside each letter. The sizes above were
         picked for flat type and turn those into smudges on a phone, so the
         small ones step up — and GAME OVER, which the desktop rule sets to
         76px, has to come back down to fit a portrait screen. */
      body.tc-on .hud-scorelabel { font-size: 13px; }
      body.tc-on .hud-scorenum { font-size: 21px; }
      body.tc-on .hud-ttfreeze { font-size: 14px; }
      body.tc-on .hud-trickline { font-size: 20px; }
      body.tc-on .hud-tricktotal { font-size: 26px; }
      body.tc-on .hud-boostlabel { font-size: 13px; }
      body.tc-on .hud-death-title { font-size: 40px; }

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
