// Keyboard + Gamepad API + touch overlay input, merged into one snapshot per
// frame. DualShock 4 exposes the browser "standard" mapping:
//   buttons[0] = Cross (X), buttons[1] = Circle, buttons[2] = Square,
//   buttons[3] = Triangle, buttons[8] = Share (reset), buttons[9] = Options
//   (pause), buttons[12..15] = d-pad,
//   axes[0/1] = left stick.

import { TouchControls } from './touch';

export class Input {
  // ALL directional input is digital: -1, 0, or +1. Analog sticks are
  // thresholded into a d-pad — there is no analog magnitude anywhere.
  moveX = 0; // analog, -1 left .. +1 right (keyboard/d-pad = full ±1)
  moveY = 0; // analog, +1 forward .. -1 brake; (moveX, moveY) is unit-clamped

  jumpHeld = false;
  grindHeld = false;
  spinHeld = false;
  grabHeld = false;
  transferHeld = false; // R2: spine transfer during a pipe hang

  // Edge-triggered flags. They accumulate until a fixed-step consumes them,
  // so a press between fixed steps is never dropped.
  jumpPressed = false;
  jumpReleased = false;
  grindPressed = false;
  spinPressed = false;
  grabPressed = false;
  transferPressed = false;
  restartPressed = false;
  pausePressed = false;

  gamepadName = 'no controller';

  // Pad routing is by CLAIMED SLOT, never by hardcoded slot number: one
  // physical DualShock connected over USB while still paired via Bluetooth
  // registers TWICE (two slots mirroring the same device), so "slot 1" can be
  // a copy of pad 1 while the real second controller sits at slot 2.
  // null = unclaimed. The merged (P1) input claims whatever its scan lands on;
  // a pad-only (P2) input claims by activity — see pollGamepad.
  claimedSlot: number | null = null;
  // The other player's Input. Its claimed slot is off limits, and any slot
  // mirroring that pad's live state is treated as the same physical device.
  rival: Input | null = null;
  // Claim-by-activity debounce: a mirror copy can lead/lag its twin by a
  // frame around button transitions, so one differing frame proves nothing.
  private claimStreak = 0;
  private claimCandidate = -1;

  private keys = new Set<string>();
  private touch: TouchControls | null = null;
  private prevJump = false;
  private prevGrind = false;
  private prevSpin = false;
  private prevGrab = false;
  private prevTransfer = false;
  private prevRestart = false;
  private prevPause = false;

  // padOnly: the split-screen P2 input — one claimed gamepad only, no
  // keyboard, no touch overlay, no listeners.
  constructor(private padOnly = false) {
    if (this.padOnly) return; // pad-only: polling does everything
    this.touch = new TouchControls();
    window.addEventListener('keydown', (e) => {
      // typing in a panel field (tuner numbers, editor coordinates) must not
      // drive the game — 'p' in an input used to pause, 'r' restarted…
      const t = e.target as HTMLElement | null;
      if (t && (t.tagName === 'INPUT' || t.tagName === 'TEXTAREA' || t.tagName === 'SELECT')) return;
      if (['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'Space'].includes(e.code)) {
        e.preventDefault();
      }
      this.keys.add(e.code);
      // Edge flags are set straight from the event so even a press shorter
      // than one frame is never dropped.
      if (!e.repeat) {
        if (e.code === 'Space') this.jumpPressed = true;
        if (e.code === 'KeyE') this.grindPressed = true;
        if (e.code === 'KeyF') this.spinPressed = true;
        if (e.code === 'KeyQ') this.grabPressed = true;
        if (e.code === 'KeyT') this.transferPressed = true;
        if (e.code === 'KeyR') this.restartPressed = true;
        if (e.code === 'KeyP' || e.code === 'Escape') this.pausePressed = true;
      }
    });
    window.addEventListener('keyup', (e) => {
      this.keys.delete(e.code);
      if (e.code === 'Space') this.jumpReleased = true;
    });
    window.addEventListener('blur', () => this.keys.clear());
    window.addEventListener('gamepadconnected', (e) => {
      this.gamepadName = e.gamepad.id;
    });
    window.addEventListener('gamepaddisconnected', () => {
      this.gamepadName = 'no controller';
    });
  }

  // Poll once per render frame, before the fixed-step loop runs.
  update(): void {
    const solo = this.padOnly;
    const k = this.keys;
    let moveX = solo ? 0 : (k.has('ArrowRight') || k.has('KeyD') ? 1 : 0) - (k.has('ArrowLeft') || k.has('KeyA') ? 1 : 0);
    let moveY = solo ? 0 : (k.has('ArrowUp') || k.has('KeyW') ? 1 : 0) - (k.has('ArrowDown') || k.has('KeyS') ? 1 : 0);

    let jump = !solo && k.has('Space');
    let grind = !solo && k.has('KeyE');
    let spin = !solo && k.has('KeyF');
    let grab = !solo && k.has('KeyQ');
    let transfer = !solo && k.has('KeyT');
    let restart = !solo && k.has('KeyR');
    let pause = !solo && (k.has('KeyP') || k.has('Escape'));

    const pad = this.pollGamepad();
    if (pad) {
      // ANALOG stick: radial deadzone, then rescaled so a full push is 1.
      // Passing the true direction through (not snapping to 8 ways) is what
      // keeps ground carves smooth instead of locking to 45° increments.
      const ax = pad.axes[0] ?? 0;
      const ay = pad.axes[1] ?? 0;
      const mag = Math.hypot(ax, ay);
      if (mag > 0.22) {
        const scaled = Math.min(1, (mag - 0.22) / (1 - 0.22));
        moveX = (ax / mag) * scaled;
        moveY = (-ay / mag) * scaled; // stick up = forward
      }
      // D-pad stays digital
      if (pad.buttons[12]?.pressed) moveY = 1;
      if (pad.buttons[13]?.pressed) moveY = -1;
      if (pad.buttons[14]?.pressed) moveX = -1;
      if (pad.buttons[15]?.pressed) moveX = 1;

      jump = jump || !!pad.buttons[0]?.pressed; // Cross
      grab = grab || !!pad.buttons[1]?.pressed; // Circle
      spin = spin || !!pad.buttons[2]?.pressed; // Square
      grind = grind || !!pad.buttons[3]?.pressed; // Triangle
      transfer = transfer || !!pad.buttons[7]?.pressed; // R2 = spine transfer
      restart = restart || !!pad.buttons[8]?.pressed; // Share = reset
      pause = pause || !!pad.buttons[9]?.pressed; // Options = pause
    }

    // Touch overlay merges like a second gamepad: the D-pad only speaks when
    // touched, and edge flags fall out of the shared prev* comparison below.
    const tc = this.touch;
    if (tc && tc.enabled) {
      if (tc.moveX !== 0 || tc.moveY !== 0) {
        moveX = tc.moveX;
        moveY = tc.moveY;
      }
      jump = jump || tc.jumpHeld;
      grab = grab || tc.grabHeld;
      spin = spin || tc.spinHeld;
      grind = grind || tc.grindHeld;
      transfer = transfer || tc.transferActive(); // R2 = the upward swipe
      if (this.gamepadName === 'no controller') this.gamepadName = 'touch';
    }

    // Clamp the combined vector to unit length (keyboard diagonals become
    // 0.707/0.707) so downstream drive code can use components directly —
    // no separate diagonal normalization, and analog magnitudes survive.
    const m = Math.hypot(moveX, moveY);
    if (m > 1) {
      moveX /= m;
      moveY /= m;
    }
    // Quantise to 2dp HERE, at the source. replay.ts records these axes
    // rounded to 2dp; if the sim consumed the full-precision value instead,
    // the recorded stream was not the stream the run actually used and any
    // analog-stick take diverged on playback (keyboard, being exactly 0/±1
    // and ±0.707, was unaffected — which is why it went unnoticed). Rounding
    // before the sim sees it makes "recorded" and "consumed" identical by
    // construction. 0.01 on a normalised axis is far below the deadzone.
    this.moveX = Math.round(moveX * 100) / 100;
    this.moveY = Math.round(moveY * 100) / 100;

    this.jumpHeld = jump;
    this.grindHeld = grind;
    this.spinHeld = spin;
    this.grabHeld = grab;
    this.transferHeld = transfer;

    this.jumpPressed = this.jumpPressed || (jump && !this.prevJump);
    this.jumpReleased = this.jumpReleased || (!jump && this.prevJump);
    this.grindPressed = this.grindPressed || (grind && !this.prevGrind);
    this.spinPressed = this.spinPressed || (spin && !this.prevSpin);
    this.grabPressed = this.grabPressed || (grab && !this.prevGrab);
    this.transferPressed = this.transferPressed || (transfer && !this.prevTransfer);
    this.restartPressed = this.restartPressed || (restart && !this.prevRestart);
    this.pausePressed = this.pausePressed || (pause && !this.prevPause);

    this.prevJump = jump;
    this.prevGrind = grind;
    this.prevSpin = spin;
    this.prevGrab = grab;
    this.prevTransfer = transfer;
    this.prevRestart = restart;
    this.prevPause = pause;
  }

  // Drop the claimed pad and restart the audition from scratch (2P toggles).
  releaseClaim(): void {
    this.claimedSlot = null;
    this.claimCandidate = -1;
    this.claimStreak = 0;
  }

  // Called after the first fixed step of each frame so a single press only
  // fires once.
  consumeEdges(): void {
    this.jumpPressed = false;
    this.jumpReleased = false;
    this.grindPressed = false;
    this.spinPressed = false;
    this.grabPressed = false;
    this.transferPressed = false;
    this.restartPressed = false;
    this.pausePressed = false;
  }

  private pollGamepad(): Gamepad | null {
    if (!navigator.getGamepads) return null;
    const pads = navigator.getGamepads();
    if (this.claimedSlot !== null) {
      const pad = pads[this.claimedSlot];
      if (pad && pad.connected) {
        this.gamepadName = pad.id;
        return pad;
      }
      this.claimedSlot = null; // pad went away — fall through and re-claim
    }
    const rivalSlot = this.rival ? this.rival.claimedSlot : null;
    if (!this.padOnly) {
      // Merged (P1) input: first connected pad that isn't the other player's.
      // The scan result is claimed so the rival's exclusion check sees it.
      for (const pad of pads) {
        if (!pad || !pad.connected || pad.index === rivalSlot) continue;
        this.claimedSlot = pad.index;
        this.gamepadName = pad.id;
        return pad;
      }
      return null;
    }
    // Pad-only (P2) input: claim the first slot showing deliberate input that
    // is provably NOT the rival's device — its state must differ from the
    // rival pad's for a few consecutive polls, because a USB+Bluetooth mirror
    // matches its twin except for one-frame leads around transitions.
    const rivalPad = rivalSlot !== null ? pads[rivalSlot] : null;
    for (const pad of pads) {
      if (!pad || !pad.connected || pad.index === rivalSlot) continue;
      if (!padActive(pad) || (rivalPad && sameState(pad, rivalPad))) continue;
      if (pad.index !== this.claimCandidate) {
        this.claimCandidate = pad.index;
        this.claimStreak = 0;
      }
      if (++this.claimStreak >= 4) {
        this.claimedSlot = pad.index;
        this.gamepadName = pad.id;
        return pad;
      }
      return null; // still auditioning this slot
    }
    this.claimCandidate = -1;
    this.claimStreak = 0;
    return null;
  }
}

// Any deliberate input: a button down or the stick clearly off center.
function padActive(pad: Gamepad): boolean {
  if (pad.buttons.some((b) => b.pressed)) return true;
  return Math.hypot(pad.axes[0] ?? 0, pad.axes[1] ?? 0) > 0.35;
}

// Same physical device test for a mirror copy (same id, same live state).
// The axis tolerance is wide because the two HID streams sample the stick at
// slightly different times — a fast whip can put them ~0.3 apart for a frame.
function sameState(a: Gamepad, b: Gamepad): boolean {
  if (a.id !== b.id) return false;
  const nb = Math.max(a.buttons.length, b.buttons.length);
  for (let i = 0; i < nb; i++) {
    if (!!a.buttons[i]?.pressed !== !!b.buttons[i]?.pressed) return false;
  }
  const na = Math.max(a.axes.length, b.axes.length);
  for (let i = 0; i < na; i++) {
    if (Math.abs((a.axes[i] ?? 0) - (b.axes[i] ?? 0)) > 0.35) return false;
  }
  return true;
}
