// Mobile touch controls: an 8-way D-pad, face-button diamond, visible
// R2/L2 controls, pause and a gentle camera peek. Legacy vertical flicks in
// empty right-hand space remain available alongside the explicit triggers.
// Active only on coarse-pointer devices (or force-enabled with '?touch' for
// testing) — desktop keeps keyboard/gamepad
// untouched. The same class also flips the HUD into its compact phone layout
// via the body.tc-on styles below.
//
// Input flow: Input.update() polls this object every render frame and merges
// it exactly like the gamepad, so edge detection (pressed/released) comes for
// free and replays record touch play like any other input.

import { sfx } from './audio';
import { TouchScreenAwake } from './touchScreenAwake';

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
  label: string;
  // diamond offsets in button-radius units from the cluster centre
  dx: number;
  dy: number;
  tickRate: number; // audio feedback pitch per button
}

// diamond offsets in % of the cluster box from its centre — at 38% button
// size, ±31% puts every button edge EXACTLY at the box edge (no overflow,
// no clipping, even visual padding against the mirrored D-pad)
const BTNS: BtnDef[] = [
  { key: 'tri', glyph: '△', label: 'Grind', dx: 0, dy: -31, tickRate: 2.4 },
  { key: 'o', glyph: '○', label: 'Grab', dx: 31, dy: 0, tickRate: 2.0 },
  { key: 'x', glyph: '×', label: 'Jump', dx: 0, dy: 31, tickRate: 1.7 },
  { key: 'sq', glyph: '□', label: 'Spin', dx: -31, dy: 0, tickRate: 2.2 },
];

type TriggerKey = 'transfer' | 'inventory';
const buttonPresses = (): Record<BtnDef['key'], Set<number>> => ({
  x: new Set(), o: new Set(), sq: new Set(), tri: new Set(),
});

// R2 swipe gate: a clear, fast, mostly-vertical upward flick — button taps
// (short travel) and slides between buttons (slow / horizontal) never fire it.
const SWIPE_MIN_PX = 64;
const SWIPE_MAX_MS = 320;
const SWIPE_MIN_VEL = 0.35; // px per ms
// Touch has no physical trigger to keep depressed. Preserve a short trigger
// pulse across input polling; rail-ollie trajectories never depend on R2.
const SWIPE_HOLD_MS = 450;
// The unobstructed upper screen is a small, anchored virtual right stick.
// Reaching full intent should take a deliberate drag, not a tiny camera nudge.
const LOOK_DRAG_PX = 110;

/** One shared touch/coarse-pointer gate for input and presentation policy. */
export function touchControlsRequested(): boolean {
  return (
    (typeof matchMedia === 'function' &&
      (matchMedia('(pointer: coarse)').matches || matchMedia('(any-pointer: coarse)').matches)) ||
    new URLSearchParams(window.location.search).has('touch')
  );
}

export class TouchControls {
  enabled = false;
  moveX = 0;
  moveY = 0;
  lookX = 0;
  lookY = 0;
  jumpHeld = false;
  grabHeld = false;
  spinHeld = false;
  grindHeld = false;

  private triggerPulses = new Map<number, { key: TriggerKey; until: number; pending: boolean }>();
  private dirIdx = -1; // active D-pad sector, -1 = neutral (hysteresis state)
  private padPointer: number | null = null;
  private lookPointer: number | null = null;
  private lookStartX = 0;
  private lookStartY = 0;
  private padEl!: HTMLElement;
  private padContact!: HTMLElement;
  private lookCue!: HTMLElement;
  private lookContact!: HTMLElement;
  private pauseEl!: HTMLButtonElement;
  private pausePointer: number | null = null;
  private arrowEls!: Record<'up' | 'down' | 'left' | 'right', HTMLElement>;
  private btnEls = new Map<string, HTMLElement>();
  private prevBtn = { x: false, o: false, sq: false, tri: false };
  // Unconsumed edges retain their owners. Cancelling one finger must never
  // erase a completed tap (or a shared held button) belonging to another.
  private pressedBtn = buttonPresses();
  private jumpReleases = new Set<number>();
  private jumpCancellation = false;
  private transferPresses = new Set<number>();
  private directionTap: [number, number] | null = null;
  private directionOwner: number | null = null;
  private mapMode = false;
  private graphicsBlocked = false;
  private screenAwake = new TouchScreenAwake();
  private pageActive = true;
  private captures = new Map<number, HTMLElement>();
  private pointerOwners = new Map<number, number>();
  private pointerStarts = new Map<number, { x: number; y: number; type: string }>();
  // Touch IDs and Pointer IDs are different namespaces. Associate only a
  // unique matching START position, so native partial lifts can recover a
  // missing pointerup without cancelling the other thumb.
  private nativeContacts = new Map<number, { pointer: number | null; x: number; y: number }>();
  private nextOwner = 0;
  private triggerTouches = new Map<number, TriggerKey>();
  private triggerEls = new Map<TriggerKey, HTMLButtonElement>();
  private layoutDirty = true;
  private padBounds!: DOMRect;
  private buttonBounds = new Map<BtnDef['key'], DOMRect>();
  private viewportWidth = window.innerWidth;
  private viewportHeight = window.innerHeight;
  // every live right-hand pointer: which button it holds + swipe bookkeeping
  private rightTouches = new Map<
    number,
    { btn: BtnDef['key'] | null; x0: number; y0: number; t0: number; swiped: TriggerKey | null; onBtn: boolean }
  >();

  constructor(private onPause: () => void = () => {}) {
    this.enabled = touchControlsRequested();
    if (!this.enabled) return;
    document.body.classList.add('tc-on');
    this.injectStyle();
    this.buildDpad();
    this.buildButtons();
    this.buildLookSurface();
    this.buildPauseButton();
    this.installReleaseSafety();
    // iOS zoom killers: pinch (gesture*) and double-tap (dblclick) must never
    // scale the game. touch-action handles modern Safari; these catch the rest.
    const kill = (e: Event): void => e.preventDefault();
    // Scope native gesture suppression to game surfaces. Editor fields and
    // bounded menu lists retain their normal interaction and scrolling.
    const gameGesture = (e: Event): void => {
      if ((e.target as Element | null)?.closest?.('.tc-zone, .tc-look, .tc-pause, #app')) kill(e);
    };
    document.addEventListener('gesturestart', gameGesture, { passive: false });
    document.addEventListener('gesturechange', gameGesture, { passive: false });
    document.addEventListener('dblclick', gameGesture, { passive: false });
    (window as unknown as Record<string, unknown>).__touch = this; // test hook
  }

  transferActive(): boolean {
    return this.triggerActive('transfer');
  }

  inventoryActive(): boolean {
    return this.triggerActive('inventory');
  }

  private triggerActive(key: TriggerKey): boolean {
    for (const held of this.triggerTouches.values()) if (held === key) return true;
    const now = performance.now();
    for (const pulse of this.triggerPulses.values()) if (pulse.key === key && (pulse.pending || pulse.until > now)) return true;
    return false;
  }

  /** Preserve a quick tap even when pointer down/up both land between RAFs. */
  consumeButtonPress(key: BtnDef['key']): boolean {
    const pressed = this.pressedBtn[key].size > 0;
    this.pressedBtn[key].clear();
    return pressed;
  }

  consumeJumpRelease(): boolean {
    const released = this.jumpReleases.size > 0;
    this.jumpReleases.clear();
    return released;
  }

  consumeJumpCancellation(): boolean {
    const cancelled = this.jumpCancellation;
    this.jumpCancellation = false;
    return cancelled;
  }

  consumeTransferPress(): boolean {
    const pressed = this.transferPresses.size > 0;
    this.transferPresses.clear();
    return pressed;
  }

  /** A frame stall cannot expire a gesture before the game ever observes it. */
  beginFrame(): void {
    this.syncAvailability();
    const now = performance.now();
    for (const pulse of this.triggerPulses.values()) {
      if (!pulse.pending) continue;
      pulse.pending = false; pulse.until = now + SWIPE_HOLD_MS;
    }
  }

  /** Recheck synchronously before polling, including between observer turns. */
  syncAvailability(): void {
    this.screenAwake.sync(this.pageActive && !this.controlsBlocked());
    const now = performance.now();
    for (const [owner, pulse] of this.triggerPulses) if (!pulse.pending && pulse.until <= now) this.triggerPulses.delete(owner);
    if (this.controlsBlocked()) this.releaseAll(true);
    else {
      if (this.padBlocked()) {
        if (this.padPointer !== null) this.releasePointer(this.padPointer, true);
        this.directionTap = null; this.directionOwner = null;
      }
      if (this.buttonsBlocked()) {
        for (const id of [...this.rightTouches.keys(), ...this.triggerTouches.keys()]) this.releasePointer(id, true);
        for (const presses of Object.values(this.pressedBtn)) presses.clear();
        this.jumpReleases.clear(); this.transferPresses.clear(); this.triggerPulses.clear();
      }
      if (this.lookBlocked() && this.lookPointer !== null) this.releasePointer(this.lookPointer, true);
      if (this.pauseBlocked() && this.pausePointer !== null) this.releasePointer(this.pausePointer, true);
      this.refreshTriggers();
    }
  }

  /** One discrete map-navigation pulse from the most recent D-pad sector. */
  consumeDirectionTap(): [number, number] | null {
    const tap = this.directionTap;
    this.directionTap = null;
    return tap;
  }

  /** The touch map owns its input; do not carry a held gameplay button across. */
  setMapMode(on: boolean): void {
    if (on === this.mapMode) return;
    this.mapMode = on;
    this.releaseAll(true);
  }

  /** Interruptions discard intent; ordinary lifts retain between-frame taps. */
  private releaseAll(discardPresses: boolean): void {
    for (const id of new Set([
      ...this.captures.keys(), ...this.rightTouches.keys(), ...this.triggerTouches.keys(),
      ...[this.padPointer, this.lookPointer, this.pausePointer].filter((id): id is number => id !== null),
    ])) this.releasePointer(id, discardPresses);
    if (discardPresses) {
      for (const presses of Object.values(this.pressedBtn)) presses.clear();
      this.jumpReleases.clear(); this.transferPresses.clear();
      this.directionTap = null;
      this.directionOwner = null;
      this.triggerPulses.clear(); this.refreshTriggers();
      this.nativeContacts.clear();
    }
  }

  private releasePointer(id: number, cancelled: boolean): void {
    if (!this.ownsPointer(id) && !this.captures.has(id)) return;
    const owner = this.pointerOwners.get(id)!;
    if (id === this.padPointer) {
      this.padPointer = null; this.dirIdx = -1;
      this.moveX = this.moveY = 0; this.paintArrows();
      this.padEl.classList.remove('engaged');
      this.padContact.style.left = this.padContact.style.top = '50%';
      if (cancelled && this.directionOwner === owner) this.directionTap = null;
    }
    if (id === this.lookPointer) this.clearLook();
    const touch = this.rightTouches.get(id);
    if (touch) {
      const wasJump = this.jumpHeld;
      this.rightTouches.delete(id); this.refreshButtons(cancelled ? null : owner);
      if (cancelled && wasJump && !this.jumpHeld) this.jumpCancellation = true;
    }
    const trigger = this.triggerTouches.get(id);
    if (trigger === 'inventory' && !cancelled) {
      this.triggerPulses.set(owner, { key: 'inventory', until: performance.now() + SWIPE_HOLD_MS, pending: true });
    }
    this.triggerTouches.delete(id);
    if (this.pausePointer === id) {
      this.pausePointer = null;
      this.pauseEl.classList.remove('on');
    }
    if (cancelled) {
      for (const presses of Object.values(this.pressedBtn)) presses.delete(owner);
      this.jumpReleases.delete(owner); this.transferPresses.delete(owner);
      this.triggerPulses.delete(owner);
    }
    this.refreshTriggers();
    // Drop ownership BEFORE releasing capture: lostpointercapture may fire
    // synchronously. A normal lift's queued tap must survive that later event.
    const captured = this.captures.get(id);
    this.captures.delete(id);
    this.pointerOwners.delete(id);
    this.pointerStarts.delete(id);
    for (const [identifier, contact] of this.nativeContacts) {
      if (contact.pointer === id) this.nativeContacts.delete(identifier);
    }
    try { if (captured?.hasPointerCapture(id)) captured.releasePointerCapture(id); } catch { /* detached surface */ }
  }

  private installReleaseSafety(): void {
    // Capture-phase window listeners also see releases outside a control when
    // Safari fails to retain pointer capture, or a panel stops propagation.
    window.addEventListener('pointerup', e => {
      const touch = this.rightTouches.get(e.pointerId);
      if (touch && !touch.onBtn && !touch.swiped && Number.isFinite(e.clientX) && Number.isFinite(e.clientY)) this.moveButton(e);
      this.releasePointer(e.pointerId, false);
    }, true);
    window.addEventListener('pointercancel', e => this.releasePointer(e.pointerId, true), true);
    window.addEventListener('lostpointercapture', e => this.releasePointer(e.pointerId, true), true);
    // Move routing uses the same safety path as releases. Even without capture
    // a thumb crossing another zone stays with its original control.
    window.addEventListener('pointermove', e => {
      if (!this.ownsPointer(e.pointerId)) return;
      this.syncAvailability();
      if ((e.pointerType === 'mouse' || e.pointerType === 'pen') && e.buttons === 0) {
        this.releasePointer(e.pointerId, true); return;
      }
      if (!Number.isFinite(e.clientX) || !Number.isFinite(e.clientY)) return;
      if (e.pointerId === this.padPointer) this.steer(e.clientX, e.clientY);
      else if (e.pointerId === this.lookPointer) this.moveLook(e);
      else if (this.rightTouches.has(e.pointerId)) this.moveButton(e);
      if (this.ownsPointer(e.pointerId)) e.preventDefault();
    }, { capture: true, passive: false });
    // A new primary touch proves the previous touch sequence has ended. Do not
    // time out held fingers: long steering/grind holds are valid input.
    window.addEventListener('pointerdown', e => {
      if (e.pointerType === 'touch' && e.isPrimary) this.releaseAll(false);
      // A fresh down with an already-owned ID starts a new contact. Recover
      // that finger independently when its preceding release was lost.
      else if (this.ownsPointer(e.pointerId)) this.releasePointer(e.pointerId, true);
    }, true);
    document.addEventListener('touchstart', e => {
      const live = new Set(Array.from(e.touches, t => t.identifier));
      for (const [identifier, contact] of this.nativeContacts) {
        if (live.has(identifier)) continue;
        if (contact.pointer !== null) this.releasePointer(contact.pointer, false);
        this.nativeContacts.delete(identifier);
      }
      for (const t of Array.from(e.changedTouches)) {
        this.nativeContacts.set(t.identifier, { pointer: null, x: t.clientX, y: t.clientY });
      }
      this.matchNativeContacts();
    }, { capture: true, passive: true });
    const nativeRelease = (e: TouchEvent, cancelled: boolean): void => {
      for (const t of Array.from(e.changedTouches ?? [])) {
        const contact = this.nativeContacts.get(t.identifier);
        if (contact?.pointer != null) this.releasePointer(contact.pointer, cancelled);
        this.nativeContacts.delete(t.identifier);
      }
      if (e.touches.length === 0) { this.releaseAll(cancelled); this.nativeContacts.clear(); }
    };
    document.addEventListener('touchend', e => nativeRelease(e, false), { capture: true, passive: true });
    document.addEventListener('touchcancel', e => nativeRelease(e, true), { capture: true, passive: true });
    window.addEventListener('blur', () => {
      this.pageActive = false; this.screenAwake.sync(false); this.releaseAll(true);
    });
    window.addEventListener('focus', () => { this.pageActive = true; this.syncAvailability(); });
    window.addEventListener('pagehide', () => {
      this.pageActive = false; this.screenAwake.sync(false); this.releaseAll(true);
    });
    window.addEventListener('pageshow', () => {
      this.pageActive = true; this.layoutDirty = true; this.releaseAll(true); this.syncAvailability();
    });
    const graphics = (e: Event, blocked: boolean): void => {
      if (!(e.target as Element | null)?.closest?.('#app')) return;
      this.graphicsBlocked = blocked;
      document.body.classList.toggle('tc-graphics-lost', blocked);
      this.releaseAll(true);
    };
    document.addEventListener('webglcontextlost', e => graphics(e, true), true);
    document.addEventListener('webglcontextrestored', e => graphics(e, false), true);
    window.addEventListener('orientationchange', () => { this.layoutDirty = true; this.releaseAll(true); });
    const resize = (): void => {
      this.layoutDirty = true;
      if (window.innerWidth !== this.viewportWidth || window.innerHeight !== this.viewportHeight) {
        this.viewportWidth = window.innerWidth; this.viewportHeight = window.innerHeight;
        this.releaseAll(true);
      }
    };
    window.addEventListener('resize', resize);
    window.visualViewport?.addEventListener('resize', resize);
    document.addEventListener('visibilitychange', () => {
      if (document.hidden) { this.screenAwake.sync(false); this.releaseAll(true); }
      else this.syncAvailability();
    });
    new MutationObserver(() => this.syncAvailability())
      .observe(document.body, { attributes: true, attributeFilter: ['class'] });
  }

  private controlsBlocked(): boolean {
    const body = document.body.classList;
    return this.mapMode || this.graphicsBlocked || body.contains('world-map-active') ||
      !this.enabled || document.hidden || body.contains('game-shell-modal') ||
      body.contains('game-shell-transitioning') || body.contains('bonus-travel-active') || body.contains('game-startup-loading') ||
      body.contains('ed-active') || body.contains('tool-panel-open') ||
      body.contains('character-lab-open') || body.contains('animation-studio-open') ||
      body.contains('game-field-studio-open');
  }

  private padBlocked(): boolean { return this.controlsBlocked() || document.body.classList.contains('side-panel-left-open'); }
  private buttonsBlocked(): boolean { return this.controlsBlocked() || document.body.classList.contains('side-panel-right-open'); }
  private pauseBlocked(): boolean { return this.controlsBlocked() || this.lookBlocked(); }
  private ownsPointer(id: number): boolean {
    return id === this.padPointer || id === this.lookPointer || id === this.pausePointer ||
      this.rightTouches.has(id) || this.triggerTouches.has(id);
  }

  private accepts(e: PointerEvent): boolean {
    return !this.ownsPointer(e.pointerId) && (e.button === undefined || e.button === 0) &&
      Number.isFinite(e.clientX) && Number.isFinite(e.clientY);
  }

  private measureLayout(): void {
    if (!this.layoutDirty) return;
    this.padBounds = this.padEl.getBoundingClientRect();
    for (const [key, el] of this.btnEls) this.buttonBounds.set(key as BtnDef['key'], el.getBoundingClientRect());
    this.layoutDirty = false;
  }

  private startOwnership(e: PointerEvent): void {
    this.pointerOwners.set(e.pointerId, ++this.nextOwner);
    this.pointerStarts.set(e.pointerId, { x: e.clientX, y: e.clientY, type: e.pointerType });
    this.matchNativeContacts();
  }

  private matchNativeContacts(): void {
    const matched = new Set([...this.nativeContacts.values()].map(t => t.pointer));
    for (const contact of this.nativeContacts.values()) {
      if (contact.pointer !== null) continue;
      const candidates = [...this.pointerStarts].filter(([id, start]) => !matched.has(id) &&
        start.type === 'touch' && Math.hypot(start.x - contact.x, start.y - contact.y) <= 1);
      // Ambiguous coincident fingers use the zero-contact fallback instead.
      if (candidates.length !== 1) continue;
      contact.pointer = candidates[0][0]; matched.add(contact.pointer);
    }
  }

  // ---------- GENTLE LOOK (free upper screen) ----------

  private buildLookSurface(): void {
    const zone = document.createElement('div');
    zone.className = 'tc-look';
    zone.setAttribute('aria-hidden', 'true');
    const cue = document.createElement('div');
    cue.className = 'tc-look-cue';
    const contact = document.createElement('div');
    contact.className = 'tc-contact tc-look-contact';
    cue.appendChild(contact); zone.appendChild(cue);
    this.lookCue = cue; this.lookContact = contact;
    document.body.appendChild(zone);

    const down = (e: PointerEvent): void => {
      if (!this.accepts(e) || this.lookPointer !== null || this.lookBlocked()) return;
      this.lookPointer = e.pointerId;
      this.lookStartX = e.clientX;
      this.lookStartY = e.clientY;
      this.lookX = 0;
      this.lookY = 0;
      cue.classList.add('on');
      cue.style.left = `clamp(calc(var(--tc-left-edge) + 38px), ${e.clientX}px, calc(100% - var(--tc-right-edge) - 38px))`;
      cue.style.top = `clamp(calc(var(--tc-top-edge) + 38px), ${e.clientY}px, calc(100% - 38px))`;
      this.capture(zone, e);
      e.preventDefault();
    };
    zone.addEventListener('pointerdown', down);
    zone.addEventListener('contextmenu', (e) => e.preventDefault());
  }

  private moveLook(e: PointerEvent): void {
    this.lookX = Math.max(-1, Math.min(1, (e.clientX - this.lookStartX) / LOOK_DRAG_PX));
    this.lookY = Math.max(-1, Math.min(1, (this.lookStartY - e.clientY) / LOOK_DRAG_PX));
    const magnitude = Math.max(1, Math.hypot(this.lookX, this.lookY));
    this.lookContact.style.left = `${50 + this.lookX / magnitude * 35}%`;
    this.lookContact.style.top = `${50 - this.lookY / magnitude * 35}%`;
  }

  private clearLook(): void {
    this.lookPointer = null;
    this.lookX = 0;
    this.lookY = 0;
    this.lookCue.classList.remove('on');
    this.lookContact.style.left = this.lookContact.style.top = '50%';
  }

  private lookBlocked(): boolean {
    const body = document.body.classList;
    return (
      this.controlsBlocked() ||
      body.contains('world-map-active') ||
      body.contains('ed-active') ||
      body.contains('tool-panel-open') ||
      body.contains('character-lab-open') ||
      body.contains('animation-studio-open') ||
      body.contains('game-field-studio-open') ||
      body.contains('side-panel-left-open') ||
      body.contains('side-panel-right-open')
    );
  }

  private buildPauseButton(): void {
    const button = document.createElement('button');
    button.type = 'button';
    button.className = 'tc-pause';
    this.pauseEl = button;
    button.setAttribute('aria-label', 'Pause game');
    button.innerHTML = '<span aria-hidden="true"></span><span aria-hidden="true"></span>';
    button.addEventListener('pointerdown', e => {
      if (!this.accepts(e) || this.pauseBlocked() || this.pausePointer !== null) return;
      this.pausePointer = e.pointerId; button.classList.add('on');
      this.startOwnership(e);
      // Pause remains a standard release-to-click button: no capture so
      // dragging away cannot accidentally pause on a later lift.
    });
    button.addEventListener('pointerleave', () => button.classList.remove('on'));
    button.addEventListener('contextmenu', e => e.preventDefault());
    button.addEventListener('click', (event) => {
      event.preventDefault();
      if (this.pauseBlocked()) return;
      button.blur();
      this.releaseAll(true);
      sfx.play('footstep1', 0.32, 2.5);
      this.onPause();
    });
    document.body.appendChild(button);
  }

  // ---------- D-PAD (left zone) ----------

  private buildDpad(): void {
    const zone = document.createElement('div');
    zone.className = 'tc-zone tc-left';
    zone.setAttribute('role', 'group'); zone.setAttribute('aria-label', 'Movement controls');
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
    const contact = document.createElement('div');
    contact.className = 'tc-contact tc-pad-contact';
    contact.setAttribute('aria-hidden', 'true');
    pad.appendChild(contact); this.padContact = contact;
    zone.appendChild(pad);
    document.body.appendChild(zone);

    // One continuous surface: the WHOLE lower-left zone steers relative to the
    // visible pad's centre, so the invisible hit area is far bigger than the
    // drawn arrows and the thumb can slide between directions without lifting.
    const down = (e: PointerEvent): void => {
      if (!this.accepts(e) || this.padBlocked() || this.padPointer !== null) return; // first touch drives, extras ignored
      this.padPointer = e.pointerId;
      this.capture(zone, e);
      this.padEl.classList.add('engaged');
      this.steer(e.clientX, e.clientY);
      e.preventDefault();
    };
    zone.addEventListener('pointerdown', down);
    zone.addEventListener('contextmenu', (e) => e.preventDefault());
  }

  private steer(cx: number, cy: number): void {
    this.measureLayout();
    const r = this.padBounds;
    const dx = cx - (r.left + r.width / 2);
    const dy = cy - (r.top + r.height / 2);
    const dist = Math.hypot(dx, dy);
    const reach = Math.max(1, Math.min(r.width, r.height) * .37);
    const scale = Math.min(1, reach / Math.max(dist, 1));
    this.padContact.style.left = `${r.width / 2 + dx * scale}px`;
    this.padContact.style.top = `${r.height / 2 + dy * scale}px`;
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
      this.directionTap = [this.moveX, this.moveY];
      this.directionOwner = this.pointerOwners.get(this.padPointer!)!;
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
    zone.setAttribute('role', 'group'); zone.setAttribute('aria-label', 'Action controls');
    const cluster = document.createElement('div');
    cluster.className = 'tc-cluster';
    for (const b of BTNS) {
      const el = document.createElement('button');
      el.type = 'button';
      el.className = 'tc-btn';
      el.setAttribute('aria-label', b.label); el.setAttribute('aria-pressed', 'false');
      el.dataset.touchButton = b.key;
      this.addButtonInk(el, b.glyph, b.label);
      el.style.left = `${50 + b.dx}%`;
      el.style.top = `${50 + b.dy}%`;
      cluster.appendChild(el);
      this.btnEls.set(b.key, el);
      el.addEventListener('click', event => {
        event.preventDefault(); el.blur();
        if (event.detail === 0 && !this.buttonsBlocked()) {
          this.screenAwake.activate(this.pageActive && !this.controlsBlocked());
          const owner = ++this.nextOwner;
          this.pressedBtn[b.key].add(owner);
          if (b.key === 'x') this.jumpReleases.add(owner);
        }
      });
    }
    zone.appendChild(cluster);
    this.buildTriggers(zone);
    document.body.appendChild(zone);

    const down = (e: PointerEvent): void => {
      if (!this.accepts(e) || this.buttonsBlocked()) return;
      this.rightTouches.set(e.pointerId, {
        btn: this.nearestBtn(e.clientX, e.clientY, 2.1),
        x0: e.clientX,
        y0: e.clientY,
        t0: Number.isFinite(e.timeStamp) ? e.timeStamp : performance.now(),
        swiped: null,
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
    zone.addEventListener('pointerdown', down);
    zone.addEventListener('contextmenu', (e) => e.preventDefault());
  }

  private moveButton(e: PointerEvent): void {
    const t = this.rightTouches.get(e.pointerId);
    if (!t) return;
    const owner = this.pointerOwners.get(e.pointerId)!;
    if (!t.swiped && !t.onBtn) {
      // Only a clear, quick vertical flick in empty space owns a trigger.
      const rise = t.y0 - e.clientY;
      const dt = (Number.isFinite(e.timeStamp) ? e.timeStamp : performance.now()) - t.t0;
      if (
        Math.abs(rise) > SWIPE_MIN_PX &&
        dt >= 0 && dt < SWIPE_MAX_MS &&
        Math.abs(rise) / Math.max(dt, 1) > SWIPE_MIN_VEL &&
        Math.abs(rise) > 1.4 * Math.abs(e.clientX - t.x0)
      ) {
        t.swiped = rise > 0 ? 'transfer' : 'inventory';
        t.btn = null; // the swipe gesture owns this touch now
        if (rise > 0) {
          this.transferPresses.add(owner);
          sfx.play('woosh3', 0.4, 1.6);
        }
        this.triggerPulses.set(owner, { key: t.swiped, until: performance.now() + SWIPE_HOLD_MS, pending: true });
        this.refreshButtons(); this.refreshTriggers();
        return;
      }
    }
    // Slide inside another generous circle, otherwise retain the last button.
    if (!t.swiped) {
      const b = this.nearestBtn(e.clientX, e.clientY, 1.6, t.btn);
      if (b && b !== t.btn) {
        t.btn = b;
        t.onBtn = true; // Once acquired, a face button owns this gesture.
        this.refreshButtons(owner);
      }
    }
  }

  private addButtonInk(el: HTMLElement, glyph: string, label: string): void {
    for (const [className, text] of [['tc-glyph', glyph], ['tc-label', label]]) {
      const ink = document.createElement('span'); ink.className = className;
      ink.textContent = text; ink.setAttribute('aria-hidden', 'true'); el.appendChild(ink);
    }
  }

  private buildTriggers(zone: HTMLElement): void {
    const row = document.createElement('div'); row.className = 'tc-triggers';
    for (const [key, glyph, label] of [['inventory', 'L2', 'Inventory'], ['transfer', 'R2', 'Transfer']] as const) {
      const el = document.createElement('button'); el.type = 'button'; el.className = 'tc-trigger';
      el.setAttribute('aria-label', label); el.setAttribute('aria-pressed', 'false');
      el.dataset.touchTrigger = key;
      this.addButtonInk(el, glyph, label);
      el.addEventListener('pointerdown', e => {
        if (!this.accepts(e) || this.buttonsBlocked()) return;
        this.triggerTouches.set(e.pointerId, key); this.capture(el, e);
        if (key === 'transfer') this.transferPresses.add(this.pointerOwners.get(e.pointerId)!);
        this.refreshTriggers(); e.preventDefault();
      });
      el.addEventListener('click', event => {
        event.preventDefault(); el.blur();
        if (event.detail === 0 && !this.buttonsBlocked()) {
          this.screenAwake.activate(this.pageActive && !this.controlsBlocked());
          const owner = ++this.nextOwner;
          if (key === 'transfer') this.transferPresses.add(owner);
          this.triggerPulses.set(owner, { key, until: performance.now() + SWIPE_HOLD_MS, pending: true });
          this.refreshTriggers();
        }
      });
      row.appendChild(el); this.triggerEls.set(key, el);
    }
    zone.appendChild(row);
  }

  private refreshTriggers(): void {
    for (const [key, el] of this.triggerEls) {
      const held = key === 'transfer' ? this.transferActive() : this.inventoryActive();
      if (el.classList.contains('on') === held) continue;
      el.classList.toggle('on', held); el.setAttribute('aria-pressed', String(held));
    }
  }

  // nearest face button within `reach` button-radii (generous invisible area)
  private nearestBtn(x: number, y: number, reach: number, current: BtnDef['key'] | null = null): BtnDef['key'] | null {
    this.measureLayout();
    let best: BtnDef['key'] | null = null;
    let bestD = Infinity;
    let currentD = Infinity;
    for (const [key, r] of this.buttonBounds) {
      const d = Math.hypot(x - (r.left + r.width / 2), y - (r.top + r.height / 2));
      if (key === current) currentD = d;
      if (d < (r.width / 2) * reach && d < bestD) {
        bestD = d;
        best = key as BtnDef['key'];
      }
    }
    return current && best && best !== current && currentD - bestD < 8 ? current : best;
  }

  private refreshButtons(releasedOwner: number | null = null): void {
    const held = { x: false, o: false, sq: false, tri: false };
    for (const t of this.rightTouches.values()) if (t.btn) held[t.btn] = true;
    for (const b of BTNS) {
      this.btnEls.get(b.key)!.classList.toggle('on', held[b.key]);
      this.btnEls.get(b.key)!.setAttribute('aria-pressed', String(held[b.key]));
      // audio tick on the press edge only — release stays silent
      if (held[b.key] && !this.prevBtn[b.key]) {
        sfx.play('footstep1', 0.28, b.tickRate);
      }
      if (held[b.key] && (!this.prevBtn[b.key] || this.pressedBtn[b.key].size > 0)) {
        for (const [id, t] of this.rightTouches) {
          if (t.btn === b.key) this.pressedBtn[b.key].add(this.pointerOwners.get(id)!);
        }
      }
    }
    if (releasedOwner !== null && this.prevBtn.x && !held.x) this.jumpReleases.add(releasedOwner);
    this.prevBtn = held;
    this.jumpHeld = held.x;
    this.grabHeld = held.o;
    this.spinHeld = held.sq;
    this.grindHeld = held.tri;
  }

  // Pointer capture keeps move/up events flowing when the thumb wanders off
  // the zone; synthetic test events carry ids the browser doesn't know.
  private capture(el: HTMLElement, e: PointerEvent): void {
    this.screenAwake.activate(this.pageActive && !this.controlsBlocked());
    this.startOwnership(e);
    this.captures.set(e.pointerId, el);
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
        overscroll-behavior: none;
      }
      body:is(.world-map-active,.game-shell-modal,.game-shell-transitioning,.game-startup-loading,
        .ed-active,.tool-panel-open,.character-lab-open,.animation-studio-open,.game-field-studio-open,.tc-graphics-lost,.bonus-travel-active)
        :is(.tc-zone,.tc-look,.tc-pause) { display:none !important; }
      .tc-look {
        position: fixed; top: 0; left: 0; width: 100vw; height: 38%; z-index: 9;
        touch-action: none; -webkit-user-select: none; user-select: none;
        -webkit-touch-callout: none; -webkit-tap-highlight-color: transparent;
      }
      body.tc-on {
        --tc-left-edge: max(16px, calc(env(safe-area-inset-left) + 8px));
        --tc-right-edge: max(16px, calc(env(safe-area-inset-right) + 8px));
        --tc-bottom-edge: max(18px, calc(env(safe-area-inset-bottom) + 10px));
        --tc-top-edge: max(8px, env(safe-area-inset-top));
        --tc-size: min(clamp(144px, 40vh, 176px), calc((100vw - var(--tc-left-edge) - var(--tc-right-edge) - 16px) / 2));
        --tc-size: min(clamp(144px, 40dvh, 176px), calc((100vw - var(--tc-left-edge) - var(--tc-right-edge) - 16px) / 2));
        --tc-fill: rgba(19, 32, 41, .78);
        --tc-edge: rgba(241, 237, 222, .8);
        --tc-ink: #f5f0e3;
        --tc-active: #ffd278;
      }
      .tc-pause {
        position: fixed; z-index: 14;
        top: var(--tc-top-edge); left: var(--tc-left-edge);
        width: 48px; height: 48px; padding: 0;
        display: flex; align-items: center; justify-content: center; gap: 6px;
        border-radius: 14px;
        border: 2px solid var(--tc-edge);
        background: var(--tc-fill);
        box-shadow: 0 2px 6px rgba(0,0,0,.35);
        touch-action: none;
        -webkit-user-select: none; user-select: none; -webkit-touch-callout: none;
        -webkit-tap-highlight-color: transparent;
      }
      .tc-pause span {
        display: block; width: 6px; height: 21px; border-radius: 2px;
        background: var(--tc-ink);
      }
      .tc-pause.on { background: var(--tc-active); border-color: #fff2ce; }
      .tc-pause.on span { background: #202e36; }
      body.game-shell-modal .tc-pause,
      body.ed-active .tc-pause,
      body.tc-on.tool-panel-open .tc-pause { display: none !important; }
      body.game-shell-modal .tc-look,
      body.ed-active .tc-look,
      body.tool-panel-open .tc-look,
      body.character-lab-open .tc-look,
      body.animation-studio-open .tc-look,
      body.game-field-studio-open .tc-look,
      body.side-panel-left-open .tc-look,
      body.side-panel-right-open .tc-look,
      body.side-panel-left-open .tc-pause,
      body.side-panel-right-open .tc-pause { display: none !important; }
      .tc-left { left: 0; width: 50vw; height: 52%; }
      .tc-right { right: 0; width: 50vw; height: max(62%, calc(var(--tc-size) + var(--tc-bottom-edge) + 62px)); }
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
      .tc-pad { border-radius: 50%; background: rgba(19,32,41,.22); }
      /* Fixed geometry and instant ink: highlights cannot move hit targets.
         No backdrop filters or perpetual animation on a phone GPU. */
      .tc-arrow, .tc-btn, .tc-trigger {
        box-sizing: border-box;
        background: var(--tc-fill); border: 2px solid var(--tc-edge);
        box-shadow: 0 2px 6px rgba(0,0,0,.35);
        color: var(--tc-ink); padding: 0; margin: 0;
        -webkit-appearance: none; appearance: none; touch-action: none;
        -webkit-user-select: none; user-select: none; -webkit-touch-callout: none;
        -webkit-tap-highlight-color: transparent;
      }
      .tc-arrow {
        position: absolute; width: max(48px, 34%); height: max(48px, 34%);
        border-radius: 22%;
        display: flex; align-items: center; justify-content: center;
        font: 600 clamp(13px, 4vw, 19px)/1 -apple-system, system-ui, sans-serif;
      }
      .tc-arrow.on, .tc-btn.on, .tc-trigger.on {
        background: var(--tc-active); border-color: #fff2ce; color: #202e36;
      }
      .tc-a-up { left: 33%; top: 0; border-radius: 30% 30% 14% 14%; }
      .tc-a-down { left: 33%; bottom: 0; border-radius: 14% 14% 30% 30%; }
      .tc-a-left { left: 0; top: 33%; border-radius: 30% 14% 14% 30%; }
      .tc-a-right { right: 0; top: 33%; border-radius: 14% 30% 30% 14%; }
      .tc-btn {
        position: absolute; width: max(48px, 38%); height: max(48px, 38%);
        transform: translate(-50%, -50%);
        border-radius: 50%;
        display: flex; flex-direction: column; align-items: center; justify-content: center; gap: 2px;
        pointer-events: auto;
      }
      .tc-glyph { display: block; font: 700 clamp(22px, 5vw, 28px)/1 system-ui, sans-serif; text-align: center; pointer-events: none; }
      .tc-label { display: block; font: 700 9px/11px system-ui, sans-serif; text-align: center; pointer-events: none; }
      .tc-triggers {
        position: absolute; right: var(--tc-right-edge);
        bottom: calc(var(--tc-bottom-edge) + var(--tc-size) + 10px);
        width: var(--tc-size); display: grid; grid-template-columns: 1fr 1fr; gap: 8px;
      }
      .tc-trigger { min-width: 48px; height: 48px; border-radius: 14px; display: flex; flex-direction: column; align-items: center; justify-content: center; gap: 2px; }
      .tc-trigger .tc-glyph { font-size: 17px; }
      .tc-btn:focus-visible, .tc-trigger:focus-visible, .tc-pause:focus-visible { outline: 3px solid #ffd278; outline-offset: 3px; }
      .tc-contact { position: absolute; left: 50%; top: 50%; width: 16px; height: 16px; transform: translate(-50%,-50%); box-sizing: border-box; border: 2px solid #fff4dc; border-radius: 50%; background: #f6ad45; pointer-events: none; }
      .tc-pad-contact { opacity: .35; }
      .tc-pad.engaged .tc-pad-contact { opacity: 1; }
      .tc-look-cue { position: absolute; display: none; width: 72px; height: 72px; transform: translate(-50%,-50%); border: 2px solid var(--tc-edge); border-radius: 50%; background: rgba(19,32,41,.35); pointer-events: none; }
      .tc-look-cue.on { display: block; }

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
        bottom: calc(var(--tc-bottom-edge) + var(--tc-size) + 70px);
      }
      body.tc-on .game-hud-layer.hud-bonus .hud-crate-row {
        left: 50%;
        bottom: var(--tc-bottom-edge);
      }
      body.tc-on .game-hud-layer.hud-bonus .hud-crate-row .hud-num {
        font-size: min(6.6vw, 8.4vh);
      }
      body.tc-on .game-hud-layer.hud-bonus .hud-crate-row .hud-box-total {
        font-size: inherit; margin-bottom: 0;
      }
      @keyframes tcBonusCountPop { from { transform:scale(1.12); } to { transform:scale(1); } }
      body.tc-on .game-hud-layer.hud-bonus .hud-crate-row .hud-pop {
        animation:tcBonusCountPop .22s ease-out;
      }
      @media (prefers-reduced-motion: reduce) {
        body.tc-on .game-hud-layer.hud-bonus .hud-crate-row .hud-pop { animation:none; }
      }
      body.tc-on .game-hud-layer.hud-bonus .hud-crate-row .hud-icon {
        width: min(8.8vw, 9.5vh); height: min(8.8vw, 9.5vh);
      }
      body.tc-on .game-hud-layer.hud-bonus .hud-life-row {
        top: auto;
        bottom: calc(var(--tc-bottom-edge) + var(--tc-size) + 70px);
      }
      @media (orientation: portrait) {
        body.tc-on .game-hud-layer.hud-bonus .hud-bonus-title {
          top: calc(var(--tc-top-edge) + 60px);
        }
        body.tc-on .game-hud-layer.hud-bonus .hud-crate-row {
          left: 50%;
          bottom: var(--tc-bottom-edge);
        }
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
