// Keyboard + Gamepad API input, merged into one snapshot per frame.
// DualShock 4 exposes the browser "standard" mapping:
//   buttons[0] = Cross (X), buttons[1] = Circle, buttons[2] = Square,
//   buttons[3] = Triangle, buttons[9] = Options, buttons[12..15] = d-pad,
//   axes[0/1] = left stick.

import { CONST } from './tuning';

export class Input {
  moveX = 0; // -1 left .. +1 right
  moveY = 0; // +1 forward .. -1 brake

  jumpHeld = false;
  grindHeld = false;
  spinHeld = false;
  grabHeld = false;

  // Edge-triggered flags. They accumulate until a fixed-step consumes them,
  // so a press between fixed steps is never dropped.
  jumpPressed = false;
  jumpReleased = false;
  grindPressed = false;
  spinPressed = false;
  grabPressed = false;
  restartPressed = false;

  gamepadName = 'no controller';

  private keys = new Set<string>();
  private prevJump = false;
  private prevGrind = false;
  private prevSpin = false;
  private prevGrab = false;
  private prevRestart = false;

  constructor() {
    window.addEventListener('keydown', (e) => {
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
        if (e.code === 'KeyR') this.restartPressed = true;
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
    let restart = k.has('KeyR');

    const pad = this.pollGamepad();
    if (pad) {
      const dz = CONST.deadzone;
      const ax = pad.axes[0] ?? 0;
      const ay = pad.axes[1] ?? 0;
      if (Math.abs(ax) > dz) moveX = ax;
      if (Math.abs(ay) > dz) moveY = -ay; // stick up = forward
      // D-pad
      if (pad.buttons[12]?.pressed) moveY = 1;
      if (pad.buttons[13]?.pressed) moveY = -1;
      if (pad.buttons[14]?.pressed) moveX = -1;
      if (pad.buttons[15]?.pressed) moveX = 1;

      jump = jump || !!pad.buttons[0]?.pressed; // Cross
      grab = grab || !!pad.buttons[1]?.pressed; // Circle
      spin = spin || !!pad.buttons[2]?.pressed; // Square
      grind = grind || !!pad.buttons[3]?.pressed; // Triangle
      restart = restart || !!pad.buttons[9]?.pressed; // Options
    }

    this.moveX = Math.max(-1, Math.min(1, moveX));
    this.moveY = Math.max(-1, Math.min(1, moveY));

    this.jumpHeld = jump;
    this.grindHeld = grind;
    this.spinHeld = spin;
    this.grabHeld = grab;

    this.jumpPressed = this.jumpPressed || (jump && !this.prevJump);
    this.jumpReleased = this.jumpReleased || (!jump && this.prevJump);
    this.grindPressed = this.grindPressed || (grind && !this.prevGrind);
    this.spinPressed = this.spinPressed || (spin && !this.prevSpin);
    this.grabPressed = this.grabPressed || (grab && !this.prevGrab);
    this.restartPressed = this.restartPressed || (restart && !this.prevRestart);

    this.prevJump = jump;
    this.prevGrind = grind;
    this.prevSpin = spin;
    this.prevGrab = grab;
    this.prevRestart = restart;
  }

  // Called after the first fixed step of each frame so a single press only
  // fires once.
  consumeEdges(): void {
    this.jumpPressed = false;
    this.jumpReleased = false;
    this.grindPressed = false;
    this.spinPressed = false;
    this.grabPressed = false;
    this.restartPressed = false;
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
