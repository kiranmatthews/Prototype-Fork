export interface VertBoardReleaseState {
  /**
   * 0 = no mounted vert-air sequence, 1 = launch spent,
   * 2 = spine-transfer release spent, 3 = board-abandon release spent.
   */
  stage: 0 | 1 | 2 | 3;
  pressArmed: boolean;
  holdT: number;
}

export interface VertBoardReleaseInput {
  jumpPressed: boolean;
  jumpHeld: boolean;
  jumpReleased: boolean;
}

export type VertBoardReleaseAction = 'none' | 'transfer' | 'abandon';

export interface VertBoardReleaseResult {
  action: VertBoardReleaseAction;
  /** The release edge belongs exclusively to this sequence. */
  consumed: boolean;
  /** Normalized hold charge, clamped over the first 0.4 seconds. */
  charge: number;
}

const HOLD_CHARGE_TIME = 0.4;

export const SPINE_TRANSFER_DIRECTION_DOT = 0.35;

/**
 * Resolve the screen-space stick through the live camera-forward basis, then
 * require a deliberate component toward the adjacent pipe. This is separate
 * from the release transaction: an incorrectly aimed second release is still
 * spent, but it cannot teleport the rider across the spine.
 */
export function spineTransferDirectionHeld(
  moveX: number,
  moveY: number,
  screenForwardX: number,
  screenForwardZ: number,
  transferDirectionX: number,
  transferDirectionZ: number,
): boolean {
  const forwardLength = Math.hypot(screenForwardX, screenForwardZ);
  const transferLength = Math.hypot(transferDirectionX, transferDirectionZ);
  if (
    !Number.isFinite(moveX) ||
    !Number.isFinite(moveY) ||
    !Number.isFinite(forwardLength) ||
    !Number.isFinite(transferLength) ||
    forwardLength <= 1e-6 ||
    transferLength <= 1e-6
  ) return false;

  const fx = screenForwardX / forwardLength;
  const fz = screenForwardZ / forwardLength;
  const worldX = fx * moveY - fz * moveX;
  const worldZ = fz * moveY + fx * moveX;
  const toward =
    (worldX * transferDirectionX + worldZ * transferDirectionZ) /
    transferLength;
  return toward > SPINE_TRANSFER_DIRECTION_DOT;
}

export function createVertBoardReleaseState(): VertBoardReleaseState {
  return { stage: 0, pressArmed: false, holdT: 0 };
}

export function resetVertBoardRelease(state: VertBoardReleaseState): void {
  state.stage = 0;
  state.pressArmed = false;
  state.holdT = 0;
}

export function beginVertBoardRelease(state: VertBoardReleaseState): void {
  state.stage = 1;
  state.pressArmed = false;
  state.holdT = 0;
}

/**
 * Advances the mounted vert-air release chain. A transfer release is consumed
 * even when the runtime finds no destination; target resolution deliberately
 * lives outside this input transaction.
 */
export function stepVertBoardRelease(
  state: VertBoardReleaseState,
  dt: number,
  input: Readonly<VertBoardReleaseInput>,
): VertBoardReleaseResult {
  if (state.stage === 0 || state.stage === 3) {
    state.pressArmed = false;
    state.holdT = 0;
    return { action: 'none', consumed: false, charge: 0 };
  }

  if (input.jumpPressed && !state.pressArmed) {
    state.pressArmed = true;
    state.holdT = 0;
  }
  if (state.pressArmed && input.jumpHeld) {
    state.holdT += Math.max(0, dt);
  }

  if (!input.jumpReleased || !state.pressArmed) {
    return { action: 'none', consumed: false, charge: 0 };
  }

  const action: VertBoardReleaseAction = state.stage === 1 ? 'transfer' : 'abandon';
  const charge = Math.min(1, Math.max(0, state.holdT / HOLD_CHARGE_TIME));
  state.stage = state.stage === 1 ? 2 : 3;
  state.pressArmed = false;
  state.holdT = 0;
  return { action, consumed: true, charge };
}
