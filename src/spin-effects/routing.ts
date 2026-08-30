export type SpinPresentationRoute =
  | "none"
  | "character"
  | "grounded-skate"
  | "board";

export interface SpinPresentationRouteState {
  readonly route: SpinPresentationRoute;
  readonly previousActive: boolean;
  readonly lingerStartStep: number;
  readonly lastStep: number;
}

export interface SpinPresentationRouteSample {
  readonly step: number;
  readonly active: boolean;
  readonly boardAttached: boolean;
  readonly groundedSkate: boolean;
  readonly reset?: boolean;
}

export interface SpinPresentationRouteFrame {
  readonly state: SpinPresentationRouteState;
  readonly characterActive: boolean;
  readonly characterLingering: boolean;
  readonly groundedSkateActive: boolean;
  readonly lingerTicks: number;
}

export interface GroundedSkateSpinEligibilitySample {
  readonly active: boolean;
  readonly movementState: string;
  readonly grounded: boolean;
  readonly freeSkate: boolean;
  readonly boardVisible: boolean;
}

/** The sole gameplay boundary that may begin the dedicated skate-ring route. */
export function groundedSkateSpinEligible(
  sample: Readonly<GroundedSkateSpinEligibilitySample>,
): boolean {
  return (
    sample.active &&
    sample.movementState === "ride" &&
    sample.grounded &&
    sample.freeSkate &&
    sample.boardVisible
  );
}

export function createSpinPresentationRouteState(): SpinPresentationRouteState {
  return {
    route: "none",
    previousActive: false,
    lingerStartStep: -1,
    lastStep: -1,
  };
}

/**
 * Latch one presentation route per attack. A board appearing during an active
 * character effect (or its ring handoff) permanently cancels that sequence,
 * so a quick mount/dismount cannot flash the halo back on around the deck.
 */
export function advanceSpinPresentationRoute(
  previous: Readonly<SpinPresentationRouteState>,
  sample: Readonly<SpinPresentationRouteSample>,
  ringLingerTicks: number,
): SpinPresentationRouteFrame {
  const step = Math.floor(sample.step);
  const rewound = previous.lastStep >= 0 && step < previous.lastStep;
  const reset = Boolean(sample.reset) || rewound;
  let route = reset ? ("none" as SpinPresentationRoute) : previous.route;
  const previousActive = reset ? false : previous.previousActive;
  let lingerStartStep = reset ? -1 : previous.lingerStartStep;
  const lastStep = reset ? -1 : previous.lastStep;
  const newStep = step !== lastStep;

  // Mounting is a one-way promotion for the current sequence. This also kills
  // a character-ring linger before it can overlap an attached board.
  if (sample.boardAttached && route === "character") {
    route = "board";
    lingerStartStep = -1;
  }

  // A ground-started skate spin is a one-way route too. Leaving its precise
  // ride/ground/board condition cancels the rings for the rest of that attack,
  // so an air-started spin cannot flash them on landing and a ground spin that
  // ollies cannot bring them back when the wheels return.
  if (
    route === "grounded-skate" &&
    (!sample.boardAttached || !sample.groundedSkate)
  ) {
    route = "board";
    lingerStartStep = -1;
  }

  if (sample.active && (!previousActive || route === "none")) {
    route = sample.boardAttached && sample.groundedSkate
      ? "grounded-skate"
      : sample.boardAttached
        ? "board"
        : "character";
    lingerStartStep = -1;
  } else if (newStep && !sample.active && previousActive) {
    lingerStartStep = route === "character" ? step : -1;
  }
  if (sample.active) lingerStartStep = -1;

  const elapsedLinger = lingerStartStep >= 0
    ? step - lingerStartStep
    : Number.MAX_SAFE_INTEGER;
  const characterLingering =
    route === "character" &&
    elapsedLinger >= 0 &&
    elapsedLinger < ringLingerTicks;
  if (!sample.active && !characterLingering && lingerStartStep >= 0)
    lingerStartStep = -1;

  return {
    state: {
      route,
      previousActive: newStep ? sample.active : previousActive,
      lingerStartStep,
      lastStep: step,
    },
    characterActive: sample.active && route === "character",
    characterLingering,
    groundedSkateActive:
      sample.active &&
      route === "grounded-skate" &&
      sample.boardAttached &&
      sample.groundedSkate,
    lingerTicks: lingerStartStep >= 0 ? elapsedLinger : -1,
  };
}
