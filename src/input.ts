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

  private keys = new Set<string>();
  private touch = new TouchControls();
  private prevJump = false;
  private prevGrind = false;
  private prevSpin = false;
  private prevGrab = false;
  private prevTransfer = false;
  private prevRestart = false;
  private prevPause = false;

  constructor() {
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
    const k = this.keys;
    let moveX = (k.has('ArrowRight') || k.has('KeyD') ? 1 : 0) - (k.has('ArrowLeft') || k.has('KeyA') ? 1 : 0);
    let moveY = (k.has('ArrowUp') || k.has('KeyW') ? 1 : 0) - (k.has('ArrowDown') || k.has('KeyS') ? 1 : 0);

    let jump = k.has('Space');
    let grind = k.has('KeyE');
    let spin = k.has('KeyF');
    let grab = k.has('KeyQ');
    let transfer = k.has('KeyT');
    let restart = k.has('KeyR');
    let pause = k.has('KeyP') || k.has('Escape');

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
    if (tc.enabled) {
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
    this.moveX = moveX;
    this.moveY = moveY;

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
    for (const pad of navigator.getGamepads()) {
      if (pad && pad.connected) {
        this.gamepadName = pad.id;
        return pad;
      }
    }
    return null;
  }
}
