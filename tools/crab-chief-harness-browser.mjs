// Complete device samples with the same edge semantics as Input.poll.
export function chiefInput(sample = {}, previous = {}) {
  const input = { moveX: 0, moveY: 0, jumpHeld: false, jumpPressed: false, jumpReleased: false,
    spinHeld: false, spinPressed: false, grindHeld: false, grindPressed: false,
    grabHeld: false, grabPressed: false, transferHeld: false, transferPressed: false, restartPressed: false };
  Object.assign(input, sample);
  const length = Math.hypot(input.moveX, input.moveY); if (length > 1) { input.moveX /= length; input.moveY /= length; }
  for (const held of ['jumpHeld', 'spinHeld', 'grindHeld', 'grabHeld', 'transferHeld']) {
    const pressed = held.replace('Held', 'Pressed'); if (!(pressed in sample)) input[pressed] = !!input[held] && !previous[held];
  }
  if (!('jumpReleased' in sample)) input.jumpReleased = !input.jumpHeld && !!previous.jumpHeld;
  return input;
}
