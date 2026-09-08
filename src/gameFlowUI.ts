// Game-owned menus and campaign screens. The live DOM remains the semantic
// input/accessibility owner; GameFlowSurface can mirror its known geometry into
// the pre-CRT render path without turning the menu into canvas hit regions.

import type * as THREE from "three";
import type { ResultsViewport } from "./resultsPresentation";
import { runLoadingTransition, type LoadingTransitionPhase } from "./presentationLoading";
import { rooReady } from "./roofont";
import { inputPrompts, CONTROLLER_FAMILIES, PROMPT_FAMILY_NAMES } from "./inputPrompts";
import { actionButtonDown } from "./inputBindings";
import {
  CAMPAIGN_ISLANDS,
  CAMPAIGN_LEVELS,
  CAMPAIGN_SAVE_SLOTS,
  CAMPAIGN_TIME_RELIC_TARGET_SECONDS,
  CampaignStore,
  TIME_MEDALS, defaultMedalTimes, medalForTime, earnedTimeMedal,
  type MedalTimes, type TimeMedal,
  campaignLevelByKey,
  type CampaignSaveV1,
  type GameAudioOptions,
  type GamePlayMode,
} from "./campaign";
import type { GameFlowVortexContext } from "./gameFlowVortexProfiles";
import {
  GameFlowSurface,
  snapshotGameFlowSurface,
  type GameFlowSurfaceDiagnostics,
  type GameFlowSurfaceSize,
} from "./gameFlowSurface";

type GameScreen =
  | "launch"
  | "new-slots"
  | "load-slots"
  | "confirm-new"
  | "save-load"
  | "confirm-save"
  | "confirm-load"
  | "confirm-quit-main"
  | "pause"
  | "progress"
  | "options"
  | "gameover"
  | "results";

export interface PauseScreenState {
  levelName: string;
  inWarpRoom: boolean;
}

export type ResultsScreenState =
  | {
      kind: "normal";
      levelName: string;
      boxes: number;
      totalBoxes: number;
      crystal: boolean;
      boxGem: boolean;
      comboGem: boolean;
      firstClear: boolean;
      timeTrialUnlocked?: boolean;
      relicTarget?: number;
      medalTimes?: MedalTimes;
    }
  | {
      kind: "time-trial";
      levelName: string;
      actualTime: number;
      relicTarget: number;
      medalTimes?: MedalTimes;
      medal?: TimeMedal | null;
      boxes: number;
      totalBoxes: number;
      bestTimes: number[];
    };

export interface GameFlowUICallbacks {
  onNewGame: (slot: number) => void;
  onLoadGame: (slot: number) => void;
  /** Host banks the live inventory before asking CampaignStore to save. */
  onSaveGame: () => boolean;
  /** Returns whether both the preference and any enabling flush succeeded. */
  onAutosaveChange: (enabled: boolean) => boolean;
  /** `saveFirst` distinguishes Save & Quit from explicit discard. */
  onQuitToMain: (saveFirst: boolean) => boolean;
  onResume: () => void;
  onRestart: () => void;
  onQuitLevel: () => void;
  onGameOverRetry: () => void;
  onGameOverQuit: () => void;
  onResultsRetry: () => void;
  onResultsContinue: () => void;
  onAudioOptions: (options: GameAudioOptions) => void;
  onSkateboardTuning?: (open: boolean) => void;
  getPlayMode: () => GamePlayMode;
  onPlayMode: (mode: GamePlayMode) => void;
  getRelicTarget?: (levelId: string) => number;
  getMedalTargets?: (levelId: string) => MedalTimes;
  prepareLoadingVortex?: () => Promise<void>;
  waitForLevelData?: () => Promise<void>;
  waitForDestinationAssets?: () => Promise<void>;
  prepareDestinationFrame?: () => Promise<void>;
  onTransitionComplete?: () => void;
}

function element<K extends keyof HTMLElementTagNameMap>(
  tag: K,
  className = "",
): HTMLElementTagNameMap[K] {
  const node = document.createElement(tag);
  node.className = className;
  return node;
}

function formatDate(timestamp: number): string {
  try {
    return new Intl.DateTimeFormat(undefined, {
      month: "short",
      day: "numeric",
      hour: "numeric",
      minute: "2-digit",
    }).format(new Date(timestamp));
  } catch {
    return "saved";
  }
}

// Developer chrome deliberately sits outside the semantic GameFlow tree. When
// M exposes it, these are the only body surfaces exempted from modal inerting.
const DEBUG_CHROME_SELECTOR = [
  ".secondary-text-tuner",
  ".side-wrap",
  ".hud-build",
  ".hud-capbadge",
  "[data-crt-guest-panel-host]",
  "[data-render-quality-panel-host]",
  "[data-skateboard-panel-host]",
  "[data-spin-panel-host]",
  "visual-treatment-panel",
  ".ed-panel",
  ".ed-popwrap",
  ".ed-marquee",
  ".ast-root",
  ".clab",
  ".pst",
].join(",");

export class GameFlowUI {
  private root = element("div", "game-shell");
  private panel = element("section", "game-shell-panel");
  private transitionCurtain = element("div", "game-transition-curtain");
  private cursor = element("div", "game-cartoon-cursor");
  private screen: GameScreen | null = null;
  private previousScreen: GameScreen | null = null;
  private navButtons: HTMLButtonElement[] = [];
  private selected = 0;
  private transitionActive = false;
  private loadingVortexActive = false;
  private destinationRevealing = false;
  private transitionPhase: LoadingTransitionPhase | null = null;
  private pauseState: PauseScreenState | null = null;
  private mapDirect = false;
  private pendingNewSlot = 1;
  private pendingLoadSlot = 1;
  private slotOrigin: "launch" | "warp" = "launch";
  private operationStatus = "";
  private operationStatusError = false;
  private options: GameAudioOptions;
  private previousPad = { up: false, down: false, left: false, right: false, accept: false, back: false };
  private thumbnail: HTMLCanvasElement | null = null;
  private thumbnailCaptured = false;
  private gameplayFrameRequested = true;
  private debugVisible = localStorage.getItem("solProtoDebugChrome") === "visible";
  private reducedMotion = window.matchMedia?.("(prefers-reduced-motion: reduce)").matches ?? false;
  private inertedElements: HTMLElement[] = [];
  private modalAriaHidden = new Map<HTMLElement, string | null>();
  private focusBeforeModal: HTMLElement | null = null;
  private readonly gameFlowSurface: GameFlowSurface;
  private preCrtComposited = false;
  private preCrtHandoffPending = false;
  private focusFrame: number | null = null;
  private layoutObserver: ResizeObserver | null = null;
  private pointerSelectionArmed = false;
  private pointerClientX: number | null = null;
  private pointerClientY: number | null = null;
  private cursorFadeUntil = 0;
  private maskReady = document.body.classList.contains("game-flow-mask-ready");

  constructor(
    private campaign: CampaignStore,
    private callbacks: GameFlowUICallbacks,
    initialOptions: GameAudioOptions,
  ) {
    this.options = { ...initialOptions };
    this.gameFlowSurface = new GameFlowSurface(
      () =>
        snapshotGameFlowSurface({
          root: this.root,
          panel: this.panel,
          buttons: this.navButtons,
          screen: this.screen,
          transitionActive: this.transitionActive && !this.destinationRevealing && this.transitionPhase !== "cover",
          thumbnail: this.thumbnail,
          thumbnailCaptured: this.thumbnailCaptured,
          maskReady: this.maskReady,
        }),
      () => {
        if (
          (this.preCrtComposited || this.preCrtHandoffPending) &&
          this.screen
        )
          this.requestGameplayFrame();
      },
    );
    this.injectStyle();
    this.root.setAttribute("role", "dialog");
    this.root.setAttribute("aria-modal", "true");
    this.root.hidden = true;
    this.transitionCurtain.setAttribute("aria-hidden", "true");
    // A permanently transparent fixed layer is still eligible for compositor
    // promotion. Keep the curtain out of layout entirely between transitions;
    // transition() reveals it one settled opacity-0 frame before activation.
    this.transitionCurtain.hidden = true;
    this.cursor.innerHTML = `
      <svg viewBox="0 0 54 64" aria-hidden="true">
        <path d="M6 4 47 35 29 39 39 57 29 62 19 43 7 55Z"/>
        <path class="game-cursor-shine" d="M11 12 37 33 24 35 31 49 27 51 18 36 11 44Z"/>
      </svg>`;
    this.root.append(this.panel, this.cursor);
    document.body.append(this.root, this.transitionCurtain);
    document.body.classList.toggle("game-debug-hidden", !this.debugVisible);
    document.body.classList.toggle("game-debug-visible", this.debugVisible);
    this.root.setAttribute("aria-modal", String(!this.debugVisible));
    window.addEventListener("pointermove", (event) => {
      const moved =
        event.clientX !== this.pointerClientX ||
        event.clientY !== this.pointerClientY;
      this.pointerClientX = event.clientX;
      this.pointerClientY = event.clientY;
      if (
        !this.screen ||
        this.transitionActive ||
        this.isDeveloperChromeTarget(event.target)
      ) {
        this.setCursorVisible(false);
        return;
      }
      this.cursor.style.transform = `translate3d(${event.clientX - 6}px, ${event.clientY - 4}px, 0)`;
      this.setCursorVisible(true);
      if (moved) {
        this.pointerSelectionArmed = true;
        const target = event.target instanceof Element
          ? event.target.closest<HTMLButtonElement>(".game-menu-button")
          : null;
        if (target) this.selectPointerButton(target);
      }
    });
    window.addEventListener("pointerout", (event) => {
      if (!event.relatedTarget) {
        this.setCursorVisible(false);
      }
    });
    window.addEventListener("keydown", (event) => this.onKey(event));
    window.addEventListener("input-prompts-changed", () => this.requestGameplayFrame());
    window.addEventListener("resize", () => this.invalidatePreCrt());
    window.visualViewport?.addEventListener("resize", () => this.invalidatePreCrt());
    window.visualViewport?.addEventListener("scroll", () => this.invalidatePreCrt());
    this.panel.addEventListener("scroll", () => this.invalidatePreCrt(), {
      passive: true,
    });
    if (typeof ResizeObserver === "function") {
      this.layoutObserver = new ResizeObserver(() => this.invalidatePreCrt());
      this.observePreCrtLayout();
    }
    void rooReady.then(() => this.invalidatePreCrt());
  }

  get blocksGameplay(): boolean {
    return this.transitionActive || this.screen !== null;
  }

  get currentScreen(): GameScreen | null {
    return this.screen;
  }

  /** Map utilities cover a live scenic background, not a paused gameplay run. */
  get liveMapBackground(): boolean {
    return this.mapDirect && this.screen !== null && !this.transitionActive;
  }

  get revealingDestination(): boolean { return this.destinationRevealing; }

  get loadingPhase(): LoadingTransitionPhase | null { return this.transitionPhase; }

  /** Leave the live character shot clear of the real responsive card bounds. */
  resultsSceneViewport(width: number, height: number): ResultsViewport {
    const card = this.panel.querySelector(".game-results-card")?.getBoundingClientRect();
    const beside = width > 760 && height > 560 || width / height > 1.3;
    if (beside) return { x: 18, y: 18, width: Math.max(80, (card?.left ?? width * 0.5) - 36), height: height - 36 };
    return { x: 18, y: 12, width: width - 36, height: Math.max(80, (card?.top ?? height * 0.5) - 24) };
  }

  get needsPauseThumbnail(): boolean {
    return this.screen === "pause" && !!this.thumbnail && !this.thumbnailCaptured;
  }

  get vortexContext(): GameFlowVortexContext | null {
    // Loading wins while leaving Game Over, so the bone-mask stage is released
    // before the warp field carries the transition back to gameplay.
    if (this.loadingVortexActive) return "warp";
    if (this.screen === "gameover") return "gameover";
    if (
      this.screen === "launch" ||
      this.screen === "new-slots" ||
      (this.screen === "load-slots" && this.slotOrigin === "launch") ||
      this.screen === "confirm-new"
    )
      return "menu";
    return null;
  }

  get vortexBackgroundActive(): boolean {
    return this.vortexContext !== null;
  }

  get vortexGameOverMaskActive(): boolean {
    return this.vortexContext === "gameover";
  }

  private setCursorVisible(visible: boolean): void {
    const changed = this.cursor.classList.contains("visible") !== visible;
    if (changed) this.cursorFadeUntil = performance.now() + 160;
    this.cursor.classList.toggle("visible", visible);
    if (this.preCrtComposited && (changed || visible)) this.requestGameplayFrame();
  }

  get developerChromeVisible(): boolean {
    return this.debugVisible;
  }

  get gameFlowSurfaceDiagnostics(): GameFlowSurfaceDiagnostics & {
    composited: boolean;
  } {
    return {
      ...this.gameFlowSurface.diagnostics,
      composited: this.preCrtComposited,
    };
  }

  /**
   * Request presentation ownership without hiding the semantic DOM yet. The
   * class flips only after drawPreCrt has painted successfully in this task, so
   * the browser's next composite contains exactly one menu image.
   */
  setPreCrtComposited(composited: boolean): void {
    if (composited) {
      if (this.preCrtComposited || this.preCrtHandoffPending) return;
      this.preCrtHandoffPending = true;
      this.root.toggleAttribute("data-precrt-handoff-pending", true);
      this.gameFlowSurface.invalidate();
      return;
    }

    const owned = this.preCrtComposited || this.preCrtHandoffPending;
    this.preCrtComposited = false;
    this.preCrtHandoffPending = false;
    this.root.classList.remove("precrt-composited");
    this.root.removeAttribute("data-precrt-composited");
    this.root.removeAttribute("data-precrt-handoff-pending");
    if (this.thumbnailCaptured)
      this.root.classList.remove("pause-thumbnail-pending");
    if (owned) this.gameFlowSurface.deactivate();
  }

  /** Paint the cached menu quad into the caller's completed pre-CRT target. */
  drawPreCrt(
    renderer: THREE.WebGLRenderer,
    inputSize: Readonly<GameFlowSurfaceSize>,
    target: THREE.WebGLRenderTarget | null = renderer.getRenderTarget(),
  ): boolean {
    if (!this.preCrtComposited && !this.preCrtHandoffPending) return false;
    const drawn = this.gameFlowSurface.drawPreCrt(renderer, inputSize, target);
    if (drawn && this.preCrtHandoffPending) {
      this.preCrtHandoffPending = false;
      this.preCrtComposited = true;
      this.root.removeAttribute("data-precrt-handoff-pending");
      this.root.classList.remove("pause-thumbnail-pending");
      this.root.classList.add("precrt-composited");
      this.root.toggleAttribute("data-precrt-composited", true);
    }
    return drawn;
  }

  /** Modal screens hold a still gameplay frame until their world changes. */
  requestGameplayFrame(): void {
    this.gameplayFrameRequested = true;
  }

  consumeGameplayFrameRequest(): boolean {
    if (!this.gameplayFrameRequested) return false;
    this.gameplayFrameRequested = false;
    return true;
  }

  showLaunch(): void {
    this.mapDirect = false;
    this.slotOrigin = "launch";
    this.operationStatus = "";
    this.screen = "launch";
    this.render();
  }

  hide(): void {
    this.cancelScheduledFocus();
    this.setPreCrtComposited(false);
    this.gameFlowSurface.deactivate();
    this.cursor.classList.remove("visible");
    this.screen = null;
    this.previousScreen = null;
    this.mapDirect = false;
    this.slotOrigin = "launch";
    this.operationStatus = "";
    this.root.classList.remove("pause-thumbnail-pending");
    this.root.hidden = true;
    document.body.classList.remove("game-shell-modal", "game-shell-paused", "game-shell-results");
    this.syncVortexBodyClass();
    this.releaseModalFocus();
    this.layoutObserver?.disconnect();
  }

  showPause(state: PauseScreenState): void {
    this.pauseState = state;
    this.mapDirect = false;
    this.screen = "pause";
    this.render();
  }

  /** Open one map-owned utility directly, without a redundant pause submenu. */
  showMapSection(section: "progress" | "options" | "save-load" | "quit"): void {
    this.pauseState = { levelName: "THE ISLAND MAP", inWarpRoom: true };
    this.mapDirect = true;
    this.slotOrigin = "warp";
    this.operationStatus = "";
    this.operationStatusError = false;
    this.screen = section === "quit" ? "confirm-quit-main" : section;
    this.render();
  }

  /** Options/Escape/P routing is polled by the gameplay Input owner. */
  handlePauseToggle(): boolean {
    if (document.body.classList.contains("game-skateboard-tuning-open")) {
      this.callbacks.onSkateboardTuning?.(false);
      return true;
    }
    if (this.transitionActive) return true;
    if (this.screen === "confirm-new") {
      this.screen = "new-slots";
      this.render();
      return true;
    }
    if (this.screen === "new-slots") {
      this.screen = "launch";
      this.render();
      return true;
    }
    if (this.screen === "confirm-load") {
      this.screen = "load-slots";
      this.render();
      return true;
    }
    if (this.screen === "load-slots") {
      this.screen = this.slotOrigin === "warp" ? "save-load" : "launch";
      this.render();
      return true;
    }
    if (this.screen === "confirm-save") {
      this.screen = "save-load";
      this.render();
      return true;
    }
    if (this.screen === "confirm-quit-main") {
      this.backToMapOrPause();
      return true;
    }
    if (this.screen === "save-load") {
      this.backToMapOrPause();
      return true;
    }
    if (this.screen === "options") {
      this.callbacks.onAudioOptions({ ...this.options });
      this.backToMapOrPause();
      return true;
    }
    if (this.screen === "progress") {
      this.backToMapOrPause();
      return true;
    }
    if (this.screen === "pause") {
      this.callbacks.onResume();
      return true;
    }
    return this.screen !== null;
  }

  showGameOver(levelName: string): void {
    this.mapDirect = false;
    this.pauseState = { levelName, inWarpRoom: false };
    this.maskReady = document.body.classList.contains("game-flow-mask-ready");
    this.screen = "gameover";
    this.render();
  }

  showResults(state: ResultsScreenState): void {
    this.mapDirect = false;
    this.screen = "results";
    this.renderResults(state);
  }

  setWarpRoom(active: boolean): void {
    document.body.classList.toggle("game-warp-room", active);
    document.body.classList.toggle("game-world-map", active);
  }

  captureGameplay(source: HTMLCanvasElement): void {
    const target = this.thumbnail;
    if (!target || this.screen !== "pause" || this.thumbnailCaptured) return;
    const width = Math.max(1, source.width);
    const height = Math.max(1, source.height);
    const targetWidth = 640;
    const targetHeight = 360;
    if (target.width !== targetWidth || target.height !== targetHeight) {
      target.width = targetWidth;
      target.height = targetHeight;
    }
    const context = target.getContext("2d");
    try {
      if (!context) {
        this.root.classList.remove("pause-thumbnail-pending");
        return;
      }
      // The card is always 16:9. Crop the live viewport around its centre
      // instead of stretching portrait/ultrawide gameplay when Canvas intrinsic
      // dimensions settle on the first pause frame.
      const targetAspect = targetWidth / targetHeight;
      const sourceAspect = width / height;
      let sourceX = 0;
      let sourceY = 0;
      let sourceWidth = width;
      let sourceHeight = height;
      if (sourceAspect > targetAspect) {
        sourceWidth = height * targetAspect;
        sourceX = (width - sourceWidth) * 0.5;
      } else {
        sourceHeight = width / targetAspect;
        sourceY = (height - sourceHeight) * 0.5;
      }
      context.drawImage(
        source,
        sourceX,
        sourceY,
        sourceWidth,
        sourceHeight,
        0,
        0,
        targetWidth,
        targetHeight,
      );
      this.thumbnailCaptured = true;
      // The pause surface was drawn before this copy existed. Queue exactly one
      // new frozen frame so its cached thumbnail can join the pre-CRT card.
      this.invalidatePreCrt();
      this.requestGameplayFrame();
    } catch {
      // A lost WebGL frame should not make the pause menu unusable.
      this.root.classList.remove("pause-thumbnail-pending");
    }
  }

  update(now = performance.now()): void {
    if (this.preCrtComposited && now < this.cursorFadeUntil) this.requestGameplayFrame();
    void now;
    // Input already polls gamepads for gameplay. Do not repeat that scan and
    // allocate an Array/state object on every ordinary gameplay frame.
    if (!this.screen) return;
    if (this.screen === "gameover") {
      const maskReady = document.body.classList.contains("game-flow-mask-ready");
      if (maskReady !== this.maskReady) {
        this.maskReady = maskReady;
        this.invalidatePreCrt();
      }
    }
    const { up, down, left, right, accept, back } = this.readGamepad();
    if (document.body.classList.contains("game-skateboard-tuning-open")) {
      if (back && !this.previousPad.back) this.callbacks.onSkateboardTuning?.(false);
      Object.assign(this.previousPad, { up, down, left, right, accept, back });
      return;
    }
    if (this.transitionActive) {
      Object.assign(this.previousPad, { up, down, left, right, accept, back });
      return;
    }
    if ((up && !this.previousPad.up) || (left && !this.previousPad.left)) this.moveSelection(-1);
    if ((down && !this.previousPad.down) || (right && !this.previousPad.right)) this.moveSelection(1);
    if (accept && !this.previousPad.accept) this.activateSelection();
    if (back && !this.previousPad.back) this.goBack();
    Object.assign(this.previousPad, { up, down, left, right, accept, back });
  }

  async transition(action: () => void | Promise<void>, options: { vortex?: boolean } = {}): Promise<void> {
    if (this.transitionActive) return;
    this.transitionActive = true;
    this.cursor.classList.remove("visible");
    this.invalidatePreCrt();
    this.transitionCurtain.hidden = false;
    // Flush the newly displayed opacity-0 state so adding .active below keeps
    // the fade-in transition instead of coalescing display + opacity in one
    // style update and appearing fully black on its first painted frame.
    void this.transitionCurtain.offsetWidth;
    try {
      await runLoadingTransition({
        phase: (phase) => {
          this.transitionPhase = phase;
          if (phase === "cover") this.transitionCurtain.classList.add("active");
          if (phase === "prepare-vortex") {
            this.loadingVortexActive = true;
            document.body.classList.add("game-shell-transitioning");
          }
          if (phase === "vortex") this.transitionCurtain.classList.add("vortex");
          if (phase === "cover-destination") this.transitionCurtain.classList.remove("vortex");
          if (phase === "prepare-destination") {
            this.loadingVortexActive = false;
            this.destinationRevealing = true;
            // Restore HUD/menu under opaque black, so it fades with the scene.
            document.body.classList.remove("game-shell-transitioning");
          }
          if (phase === "reveal") this.transitionCurtain.classList.remove("vortex", "active");
          this.syncVortexBodyClass();
          this.invalidatePreCrt();
          this.requestGameplayFrame();
        },
        prepareVortex: () => this.callbacks.prepareLoadingVortex?.() ?? Promise.resolve(),
        load: async () => { await this.callbacks.waitForLevelData?.(); await action(); },
        waitForAssets: () => this.callbacks.waitForDestinationAssets?.() ?? Promise.resolve(),
        prepareDestination: () => this.callbacks.prepareDestinationFrame?.() ?? Promise.resolve(),
      }, this.reducedMotion, options.vortex !== false);
    } finally {
      this.loadingVortexActive = false;
      this.destinationRevealing = false;
      this.transitionPhase = null;
      this.syncVortexBodyClass();
      this.requestGameplayFrame();
      this.transitionCurtain.classList.remove("vortex", "active");
      // The opacity transition has now finished. Removing the curtain from
      // layout releases its full-viewport compositor surface during gameplay.
      this.transitionCurtain.hidden = true;
      this.transitionActive = false;
      document.body.classList.remove("game-shell-transitioning");
      this.syncVortexBodyClass();
      this.invalidatePreCrt();
      this.callbacks.onTransitionComplete?.();
    }
  }

  private render(): void {
    this.claimModalFocus();
    this.cancelScheduledFocus();
    this.root.hidden = false;
    document.body.classList.add("game-shell-modal");
    document.body.classList.toggle(
      "game-shell-paused",
        this.screen === "pause" ||
        this.screen === "progress" ||
        this.screen === "options" ||
        this.screen === "save-load" ||
        this.screen === "confirm-save" ||
        this.screen === "confirm-load" ||
        this.screen === "confirm-quit-main" ||
        (this.screen === "load-slots" && this.slotOrigin === "warp"),
    );
    document.body.classList.remove("game-shell-results");
    this.panel.className = `game-shell-panel game-screen-${this.screen ?? "none"}`;
    this.panel.classList.toggle("game-map-menu-panel", this.mapDirect);
    this.root.setAttribute("aria-label", this.screenLabel());
    this.panel.replaceChildren();
    this.pointerSelectionArmed = false;
    this.thumbnail = null;
    this.thumbnailCaptured = false;
    this.root.classList.toggle(
      "pause-thumbnail-pending",
      this.screen === "pause",
    );
    this.requestGameplayFrame();
    this.navButtons = [];
    this.selected = 0;
    if (this.screen === "launch") this.renderLaunch();
    else if (this.screen === "new-slots") this.renderSlots(true);
    else if (this.screen === "load-slots") this.renderSlots(false);
    else if (this.screen === "confirm-new") this.renderConfirmNew();
    else if (this.screen === "save-load") this.renderSaveLoad();
    else if (this.screen === "confirm-save") this.renderConfirmSave();
    else if (this.screen === "confirm-load") this.renderConfirmLoad();
    else if (this.screen === "confirm-quit-main") this.renderConfirmQuitMain();
    else if (this.screen === "pause") this.renderPause();
    else if (this.screen === "progress") this.renderProgress();
    else if (this.screen === "options") this.renderOptions();
    else if (this.screen === "gameover") this.renderGameOver();
    if (this.mapDirect) {
      const close = this.button("X", () => this.goBack());
      close.classList.add("game-map-close");
      close.setAttribute("aria-label", "Close menu");
      this.panel.appendChild(close);
      this.panel.scrollTop = 0;
    }
    this.observePreCrtLayout();
    this.syncVortexBodyClass();
    this.syncSelection();
    this.seedGamepad();
  }

  private renderLaunch(): void {
    const card = element("div", "game-launch-card");
    const title = element("h1", "game-logo");
    title.innerHTML = `<span>Boolie</span> <strong>Roo</strong>`;
    const menu = element("div", "game-menu-list");
    const actions: HTMLButtonElement[] = [];
    const continueSlot = this.campaign.continueSlot();
    if (continueSlot !== null) {
      const continueButton = this.button(
        "CONTINUE",
        () => this.callbacks.onLoadGame(continueSlot),
      );
      continueButton.setAttribute(
        "aria-label",
        `Continue save slot ${continueSlot}`,
      );
      actions.push(continueButton);
    }
    actions.push(
      this.button("NEW GAME", () => {
        this.slotOrigin = "launch";
        this.previousScreen = "launch";
        this.screen = "new-slots";
        this.render();
      }),
      this.button("LOAD GAME", () => {
        this.slotOrigin = "launch";
        this.previousScreen = "launch";
        this.screen = "load-slots";
        this.render();
      }),
    );
    if (this.callbacks.onSkateboardTuning)
      actions.push(this.button("SKATEBOARD TUNING", () => this.callbacks.onSkateboardTuning?.(true)));
    menu.append(...actions);
    card.append(title, menu);
    this.panel.appendChild(card);
  }

  private renderSlots(newGame: boolean): void {
    const warpLoad = !newGame && this.slotOrigin === "warp";
    const card = element("div", "game-slot-card timber-card");
    const title = element("h2", "game-panel-title");
    title.textContent = newGame ? "NEW GAME" : "LOAD GAME";
    const subtitle = element("p", "game-panel-subtitle");
    subtitle.textContent = newGame
      ? "Choose a slot. Existing progress in that slot will be replaced."
      : warpLoad
        ? "Choose a saved adventure to load on the Island Map."
        : "Choose a saved adventure.";
    const slots = element("div", "game-save-slots");
    const saves = this.campaign.listSlots();
    for (let slot = 1; slot <= CAMPAIGN_SAVE_SLOTS; slot++) {
      const save = saves[slot - 1];
      const button = this.button("", () => {
        if (newGame && save) {
          this.pendingNewSlot = slot;
          this.screen = "confirm-new";
          this.render();
        } else if (newGame) this.callbacks.onNewGame(slot);
        else if (warpLoad) {
          // Unlike title loading, this abandons an active working session. The
          // callback cannot run until the explicit confirmation screen agrees.
          this.pendingLoadSlot = slot;
          this.screen = "confirm-load";
          this.render();
        } else this.callbacks.onLoadGame(slot);
      });
      button.classList.add("game-save-slot");
      button.disabled = !newGame && !save;
      button.appendChild(this.saveSlotContents(slot, save));
      slots.appendChild(button);
    }
    const back = this.button("BACK", () => {
      this.screen = warpLoad ? "save-load" : this.previousScreen ?? "launch";
      this.render();
    });
    back.classList.add("game-secondary-action");
    card.append(title, subtitle, slots, back);
    this.panel.appendChild(card);
  }

  private renderConfirmNew(): void {
    const card = element("div", "game-options-card timber-card");
    const title = element("h2", "game-panel-title");
    title.textContent = `REPLACE SLOT ${this.pendingNewSlot}?`;
    const warning = element("p", "game-panel-subtitle");
    warning.textContent = "This starts a new adventure and replaces the saved progress in this slot.";
    const actions = element("div", "game-menu-list");
    actions.append(
      this.button("REPLACE", () => this.callbacks.onNewGame(this.pendingNewSlot), "danger"),
      this.button("CANCEL", () => {
        this.screen = "new-slots";
        this.render();
      }),
    );
    card.append(title, warning, actions);
    this.panel.appendChild(card);
  }

  private renderSaveLoad(): void {
    const card = element("div", "game-options-card game-save-load-card timber-card");
    const title = element("h2", "game-panel-title");
    title.textContent = "SAVE / LOAD";
    const status = element("p", "game-save-status");
    const refreshStatus = (): void => {
      const slot = this.campaign.activeSlot;
      status.textContent = slot === null
        ? "NO ACTIVE SAVE"
        : `SLOT ${slot}  ·  ${
            this.campaign.dirty ? "UNSAVED CHANGES" : "PROGRESS SAVED"
          }`;
    };
    refreshStatus();
    const message = this.operationStatusLine();
    const list = element("div", "game-menu-list");
    const save = this.button("SAVE GAME", () => {
      this.operationStatus = "";
      this.operationStatusError = false;
      this.screen = "confirm-save";
      this.render();
    });
    save.disabled = this.campaign.activeSlot === null;
    const load = this.button("LOAD GAME", () => {
      this.operationStatus = "";
      this.operationStatusError = false;
      this.slotOrigin = "warp";
      this.screen = "load-slots";
      this.render();
    });
    load.disabled = !this.campaign.listSlots().some((entry) => entry !== null);
    list.append(
      save,
      load,
      this.toggleButton(
        "AUTOSAVE",
        this.campaign.autosaveEnabled,
        (enabled) => {
          const ok = this.callbacks.onAutosaveChange(enabled);
          const actual = this.campaign.autosaveEnabled;
          this.setOperationStatus(
            ok
              ? `AUTOSAVE ${actual ? "ON" : "OFF"}`
              : "AUTOSAVE COULD NOT BE FULLY SAVED",
            !ok,
          );
          refreshStatus();
          return actual;
        },
      ),
      this.button("BACK", () => {
        this.operationStatus = "";
        this.operationStatusError = false;
        this.backToMapOrPause();
      }),
    );
    card.append(title, status, message, list);
    this.panel.appendChild(card);
  }

  private renderConfirmSave(): void {
    const slot = this.campaign.activeSlot;
    const card = element("div", "game-options-card timber-card");
    const title = element("h2", "game-panel-title");
    title.textContent = slot === null ? "SAVE GAME?" : `SAVE SLOT ${slot}?`;
    const warning = element("p", "game-panel-subtitle");
    warning.textContent = this.campaign.dirty
      ? "Write your current Island Map progress to this slot?"
      : "Refresh this slot with your current progress?";
    const message = this.operationStatusLine();
    const actions = element("div", "game-menu-list");
    const cancel = this.button("CANCEL", () => {
      this.operationStatus = "";
      this.operationStatusError = false;
      this.screen = "save-load";
      this.render();
    });
    const save = this.button("SAVE GAME", () => {
      const ok = this.callbacks.onSaveGame();
      this.operationStatus = ok
        ? `GAME SAVED TO SLOT ${this.campaign.activeSlot ?? slot ?? "—"}`
        : "SAVE FAILED — PROGRESS IS STILL UNSAVED";
      this.operationStatusError = !ok;
      this.screen = ok ? "save-load" : "confirm-save";
      this.render();
    });
    save.disabled = slot === null;
    // Safe action first: keyboard/gamepad selection always starts on Cancel.
    actions.append(cancel, save);
    card.append(title, warning, message, actions);
    this.panel.appendChild(card);
  }

  private renderConfirmLoad(): void {
    const save = this.campaign.listSlots()[this.pendingLoadSlot - 1] ?? null;
    const card = element("div", "game-options-card timber-card");
    const title = element("h2", "game-panel-title");
    title.textContent = `LOAD SLOT ${this.pendingLoadSlot}?`;
    const warning = element("p", "game-panel-subtitle");
    warning.textContent = this.campaign.dirty
      ? "Unsaved progress in the current game will be lost."
      : "Load this save and return to the Island Map?";
    const actions = element("div", "game-menu-list");
    const cancel = this.button("CANCEL", () => {
      this.screen = "load-slots";
      this.render();
    });
    const load = this.button(
      "LOAD GAME",
      () => this.callbacks.onLoadGame(this.pendingLoadSlot),
      this.campaign.dirty ? "danger" : "",
    );
    load.disabled = save === null;
    // Warp-origin loading is the destructive path; never focus it by default.
    actions.append(cancel, load);
    card.append(title, warning, actions);
    this.panel.appendChild(card);
  }

  private renderConfirmQuitMain(): void {
    const dirty = this.campaign.dirty;
    const card = element("div", "game-options-card timber-card");
    const title = element("h2", "game-panel-title");
    title.textContent = "QUIT TO MAIN MENU?";
    const warning = element("p", "game-panel-subtitle");
    warning.textContent = dirty
      ? "You have unsaved progress. Save it before leaving?"
      : "Are you sure? Save your current progress before leaving?";
    const message = this.operationStatusLine();
    const actions = element("div", "game-menu-list");
    actions.append(
      this.button("CANCEL", () => {
        this.operationStatus = "";
        this.operationStatusError = false;
        this.backToMapOrPause();
      }),
    );
    const saveAndQuit = this.button(
      "SAVE & QUIT",
      () => this.attemptQuitToMain(true),
    );
    saveAndQuit.disabled = this.campaign.activeSlot === null;
    actions.append(
      saveAndQuit,
      this.button(
        "QUIT WITHOUT SAVING",
        () => this.attemptQuitToMain(false),
        "danger",
      ),
    );
    card.append(title, warning, message, actions);
    this.panel.appendChild(card);
  }

  private attemptQuitToMain(saveFirst: boolean): void {
    if (this.callbacks.onQuitToMain(saveFirst)) return;
    this.operationStatus = saveFirst
      ? "SAVE FAILED — STILL ON THE ISLAND MAP"
      : "COULD NOT RETURN TO THE MAIN MENU";
    this.operationStatusError = true;
    this.screen = "confirm-quit-main";
    this.render();
  }

  private operationStatusLine(): HTMLElement {
    const status = element(
      "p",
      `game-operation-status${this.operationStatusError ? " error" : ""}`,
    );
    status.setAttribute("role", "status");
    status.setAttribute("aria-live", "polite");
    status.textContent = this.operationStatus;
    return status;
  }

  private setOperationStatus(message: string, error: boolean): void {
    this.operationStatus = message;
    this.operationStatusError = error;
    const status = this.panel.querySelector<HTMLElement>(".game-operation-status");
    if (status) {
      status.textContent = message;
      status.classList.toggle("error", error);
    }
    this.invalidatePreCrt();
  }

  private backToMapOrPause(): void {
    if (this.mapDirect) {
      this.callbacks.onResume();
      return;
    }
    this.screen = "pause";
    this.render();
  }

  private saveSlotContents(slot: number, save: CampaignSaveV1 | null): HTMLElement {
    const contents = element("span", "game-save-slot-inner");
    const number = element("strong", "game-slot-number");
    number.textContent = `SLOT ${slot}`;
    const detail = element("span", "game-slot-detail");
    if (!save) detail.textContent = "EMPTY";
    else {
      const totals = this.campaign.totals(save);
      detail.textContent = `${totals.percent}%  ·  ${save.lives} LIVES  ·  ${save.fruit} FRUIT`;
    }
    const date = element("small", "game-slot-date");
    date.textContent = save ? formatDate(save.updatedAt).toUpperCase() : "START FRESH";
    contents.append(number, detail, date);
    return contents;
  }

  private renderPause(): void {
    const state = this.pauseState ?? { levelName: "THE ISLAND MAP", inWarpRoom: false };
    const layout = element("div", "game-pause-layout");
    const preview = element("div", "game-pause-preview timber-card");
    this.thumbnail = element("canvas", "game-pause-thumbnail");
    const name = element("div", "game-preview-name");
    name.textContent = state.levelName;
    preview.append(this.thumbnail, name);

    const actions = element("div", "game-pause-actions timber-card");
    const paused = element("div", "game-eyebrow");
    paused.textContent = state.inWarpRoom ? "ISLAND MAP" : "PAUSED";
    const list = element("div", "game-menu-list");
    list.append(this.button("RESUME", this.callbacks.onResume));
    const openOptions = (): void => {
      this.previousScreen = "pause";
      this.screen = "options";
      this.render();
    };
    if (state.inWarpRoom) {
      list.append(
        this.button("SAVE / LOAD", () => {
          this.operationStatus = "";
          this.operationStatusError = false;
          this.slotOrigin = "warp";
          this.screen = "save-load";
          this.render();
        }),
        this.button("OPTIONS", openOptions),
        this.button("QUIT TO MAIN MENU", () => {
          this.operationStatus = "";
          this.operationStatusError = false;
          this.screen = "confirm-quit-main";
          this.render();
        }, "danger"),
      );
    } else {
      list.append(
        this.button("OPTIONS", openOptions),
        this.button("RESTART", this.callbacks.onRestart),
        this.button("QUIT LEVEL", this.callbacks.onQuitLevel, "danger"),
      );
    }
    actions.append(paused, list);

    const progress = this.progressCard();
    layout.append(preview, actions, progress);
    this.panel.appendChild(layout);
  }

  private renderProgress(): void {
    const layout = element("div", "game-progress-layout");
    const summary = this.progressCard();
    const ledger = element("div", "game-progress-ledger timber-card");
    const title = element("h2", "game-panel-title");
    title.textContent = "ISLAND PROGRESS";
    ledger.appendChild(title);
    for (const island of CAMPAIGN_ISLANDS) {
      const section = element("section", "game-progress-island");
      const heading = element("h3", "game-progress-island-name");
      heading.textContent = island.name.toUpperCase();
      section.appendChild(heading);
      for (const key of island.levelKeys) {
        const definition = campaignLevelByKey(key);
        if (!definition) continue;
        const progress = this.campaign.levelProgress(definition.levelId);
        const unlocked = this.campaign.levelUnlocked(key);
        const row = element(
          "div",
          `game-progress-level${unlocked ? "" : " locked"}${definition.boss ? " boss" : ""}`,
        );
        const name = element("strong", "game-progress-level-name");
        name.textContent = `${definition.boss ? "★ " : ""}${definition.name.toUpperCase()}`;
        const rewards = element("span", "game-progress-level-rewards");
        rewards.textContent = unlocked
          ? `${progress?.crystal ? "◆" : "·"} ${progress?.boxGem ? "◇" : "·"} ${progress?.comboGem ? "⬙" : "·"} · ${earnedTimeMedal(progress)?.toUpperCase() ?? "NO"} MEDAL`
          : "LOCKED";
        const timing = element("small", "game-progress-level-time");
        const targets = this.callbacks.getMedalTargets?.(definition.levelId) ?? defaultMedalTimes(this.callbacks.getRelicTarget?.(definition.levelId) ?? definition.relicTime);
        timing.textContent = progress?.cleared
          ? `BEST ${progress.bestTime === undefined ? "—" : this.formatTime(progress.bestTime)} · ${TIME_MEDALS.map(tier => `${tier.toUpperCase()} ${this.formatTime(targets[tier])}`).join(" · ")}`
          : unlocked
            ? "NOT YET CLEARED"
            : "CLEAR THE CONNECTED PATH";
        row.append(name, rewards, timing);
        section.appendChild(row);
      }
      ledger.appendChild(section);
    }
    const back = this.button("BACK TO MAP", () => this.backToMapOrPause());
    back.classList.add("game-secondary-action", "game-progress-back");
    ledger.appendChild(back);
    layout.append(summary, ledger);
    this.panel.appendChild(layout);
  }

  private renderOptions(): void {
    const card = element("div", "game-options-card timber-card");
    const title = element("h2", "game-panel-title");
    title.textContent = "OPTIONS";
    const toggles = element("div", "game-menu-list game-toggle-list");
    const promptStyle = this.button("", () => {
      const index = inputPrompts.controllerOverride === null ? -1 : CONTROLLER_FAMILIES.indexOf(inputPrompts.controllerOverride);
      inputPrompts.setControllerOverride(CONTROLLER_FAMILIES[index + 1] ?? null);
      syncPromptStyle(); this.invalidatePreCrt();
    });
    promptStyle.classList.add("game-toggle", "game-prompt-style");
    promptStyle.innerHTML = '<span>PROMPT STYLE</span><strong></strong>';
    const syncPromptStyle = () => {
      const selected = inputPrompts.controllerOverride;
      promptStyle.querySelector("strong")!.textContent = selected ? ({ps4:'PS4',ps5:'PS5',xbox:'XBOX',steamdeck:'DECK',switch:'SWITCH'}[selected]) : "AUTO";
      promptStyle.setAttribute("aria-label", `Controller prompts: ${selected ? PROMPT_FAMILY_NAMES[selected] : 'Automatic'}. Activate to change.`);
    };
    syncPromptStyle();
    if (this.pauseState?.inWarpRoom) {
      const description = element('p', 'game-panel-subtitle');
      const modeButton = this.button('', () => {
        const next = this.callbacks.getPlayMode() === 'modern' ? 'classic' : 'modern';
        this.callbacks.onPlayMode(next);
        syncMode();
        this.invalidatePreCrt();
      });
      modeButton.classList.add('game-toggle', 'game-play-mode');
      modeButton.innerHTML = '<span>PLAY MODE</span><strong></strong>';
      const syncMode = (): void => {
        const mode = this.callbacks.getPlayMode();
        modeButton.querySelector('strong')!.textContent = mode.toUpperCase();
        modeButton.dataset.playMode = mode;
        modeButton.setAttribute('aria-label', `Play mode: ${mode}. Activate to switch.`);
        description.textContent = mode === 'modern'
          ? 'Endless lives. Deaths are counted. No Game Over.'
          : 'Limited lives. Lose your last life and face Game Over.';
      };
      syncMode();
      toggles.append(modeButton, description);
    }
    if (this.callbacks.onSkateboardTuning)
      toggles.append(this.button("SKATEBOARD TUNING", () => this.callbacks.onSkateboardTuning?.(true)));
    toggles.append(
      this.toggleButton("SOUND EFFECTS", !this.options.sfxMuted, (enabled) => {
        this.options.sfxMuted = !enabled;
        return enabled;
      }),
      this.toggleButton("BACKGROUND MUSIC", !this.options.musicMuted, (enabled) => {
        this.options.musicMuted = !enabled;
        return enabled;
      }),
      promptStyle,
      this.button("BACK", () => {
        this.callbacks.onAudioOptions({ ...this.options });
        if (this.mapDirect) this.callbacks.onResume();
        else {
          this.screen = this.previousScreen ?? "pause";
          this.render();
        }
      }),
    );
    card.append(title, toggles);
    this.panel.appendChild(card);
  }

  private renderGameOver(): void {
    const wrap = element("div", "game-over-layout");
    const fallback = element("div", "game-over-mask-fallback");
    fallback.setAttribute("aria-hidden", "true");
    const content = element("div", "game-over-copy");
    const title = element("h2", "game-over-title");
    title.textContent = "GAME OVER";
    const question = element("p", "game-over-question");
    question.textContent = "RETRY LEVEL?";
    const list = element("div", "game-menu-list game-over-actions");
    list.append(
      this.button("YES", this.callbacks.onGameOverRetry),
      this.button("NO", this.callbacks.onGameOverQuit, "danger"),
    );
    content.append(title, question, list);
    wrap.append(fallback, content);
    this.panel.appendChild(wrap);
  }

  private renderResults(state: ResultsScreenState): void {
    this.claimModalFocus();
    this.cancelScheduledFocus();
    this.root.hidden = false;
    document.body.classList.add("game-shell-modal", "game-shell-results");
    document.body.classList.remove("game-shell-paused");
    this.screen = "results";
    this.panel.className = "game-shell-panel game-screen-results";
    this.root.setAttribute(
      "aria-label",
      state.kind === "time-trial" ? "Time trial results" : "Run results",
    );
    this.panel.replaceChildren();
    this.pointerSelectionArmed = false;
    this.thumbnail = null;
    this.thumbnailCaptured = false;
    this.root.classList.remove("pause-thumbnail-pending");
    this.requestGameplayFrame();
    this.navButtons = [];
    this.selected = 0;

    const card = element(
      "div",
      `game-results-card game-results-${state.kind} timber-card`,
    );
    const eyebrow = element("div", "game-eyebrow");
    eyebrow.textContent = state.kind === "time-trial"
      ? "TIME TRIAL COMPLETE"
      : state.firstClear
        ? "COURSE CLEAR"
        : "RUN COMPLETE";
    const title = element("h2", "game-results-title");
    title.textContent = state.levelName;
    const tally = element(
      "div",
      `game-results-tally game-results-tally-${state.kind}`,
    );
    if (state.kind === "time-trial") {
      const bestTimes = state.bestTimes.filter((time) => Number.isFinite(time) && time >= 0).sort((a, b) => a - b).slice(0, 3);
      const targets = state.medalTimes ?? defaultMedalTimes(state.relicTarget);
      const medal = medalForTime(state.actualTime, targets);
      tally.innerHTML = `
        <div class="game-results-run-time"><span>YOUR TIME</span><strong>${this.formatTime(state.actualTime)}</strong></div>
        <div class="game-results-medal"><span>MEDAL</span><strong>${medal ? medal.toUpperCase() : "NONE"}</strong></div>
        ${TIME_MEDALS.map(tier => `<div><span>${tier.toUpperCase()} TARGET</span><strong>${this.formatTime(targets[tier])}</strong></div>`).join("")}
        <div><span>BOXES</span><strong>${state.boxes} / ${state.totalBoxes}</strong></div>
        <div class="game-results-bests"><span>YOUR BEST TIMES</span><strong>${bestTimes.map((time) => this.formatTime(time)).join(" · ") || "—"}</strong></div>`;
    } else {
      tally.innerHTML = `
        <div><span>BOXES</span><strong>${state.boxes} / ${state.totalBoxes}</strong></div>`;
      if (state.timeTrialUnlocked) {
        const trial = element("div", "game-results-trial-unlocked");
        trial.innerHTML = `<span>TIME TRIAL UNLOCKED</span><strong>GOLD TARGET ${this.formatTime(state.medalTimes?.gold ?? state.relicTarget ?? CAMPAIGN_TIME_RELIC_TARGET_SECONDS)}</strong>`;
        tally.appendChild(trial);
      }
    }
    const rewardNames = state.kind === "time-trial"
      ? (() => { const medal = medalForTime(state.actualTime, state.medalTimes ?? defaultMedalTimes(state.relicTarget)); return medal ? [`${medal} medal`] : []; })()
      : [state.crystal && "Crystal", state.boxGem && "Box gem", state.comboGem && "Combo gem"].filter(Boolean);
    card.setAttribute("aria-label", rewardNames.length ? `Rewards earned: ${rewardNames.join(", ")}` : "No new collectibles earned");
    const actions = element("div", "game-menu-list game-results-actions");
    actions.append(
      this.button("RETRY LEVEL", this.callbacks.onResultsRetry),
      this.button("CONTINUE", this.callbacks.onResultsContinue),
    );
    card.append(eyebrow, title, tally);
    card.append(actions);
    this.panel.appendChild(card);
    this.observePreCrtLayout();
    this.syncVortexBodyClass();
    this.syncSelection();
    this.seedGamepad();
  }

  private progressCard(): HTMLElement {
    const totals = this.campaign.totals();
    const card = element("div", "game-progress-card timber-card");
    const head = element("div", "game-progress-head");
    const title = element("h2");
    title.textContent = "PROGRESS";
    const percent = element("strong");
    percent.textContent = `${totals.percent}%`;
    head.append(title, percent);
    const bar = element("div", "game-progress-bar");
    const fill = element("span");
    fill.style.width = `${totals.percent}%`;
    bar.appendChild(fill);
    const grid = element("div", "game-progress-grid");
    grid.innerHTML = `
      <div><span>◆</span><strong>${totals.crystals}/${totals.maxLevels}</strong><small>CRYSTALS</small></div>
      <div><span>◇</span><strong>${totals.gems}/${totals.maxGems}</strong><small>GEMS</small></div>
      <div><span>◉</span><strong>${totals.relics}/${totals.maxLevels}</strong><small>MEDALS</small></div>
      <div><span>✦</span><strong>${totals.cleared}/${totals.maxLevels}</strong><small>LEVELS</small></div>`;
    const cleared = element("p", "game-progress-cleared");
    cleared.textContent = `${totals.cleared} OF ${CAMPAIGN_LEVELS.length} LEVELS CLEARED`;
    card.append(head, bar, grid, cleared);
    return card;
  }

  private toggleButton(
    label: string,
    on: boolean,
    mutate: (enabled: boolean) => boolean,
  ): HTMLButtonElement {
    let active = on;
    const button = this.button("", () => {
      active = mutate(!active);
      button.setAttribute("aria-pressed", String(active));
      button.querySelector("strong")!.textContent = active ? "ON" : "OFF";
      button.classList.toggle("toggle-off", !active);
      this.invalidatePreCrt();
    });
    button.classList.add("game-toggle");
    button.setAttribute("aria-pressed", String(on));
    button.innerHTML = `<span>${label}</span><strong>${on ? "ON" : "OFF"}</strong>`;
    button.classList.toggle("toggle-off", !on);
    return button;
  }

  private button(label: string, action: () => void, tone = ""): HTMLButtonElement {
    const button = element("button", `game-menu-button${tone ? ` ${tone}` : ""}`);
    button.type = "button";
    button.textContent = label;
    button.addEventListener("click", () => {
      if (button.disabled || this.transitionActive) return;
      action();
    });
    button.addEventListener("pointerenter", () => {
      if (this.pointerSelectionArmed) this.selectPointerButton(button);
    });
    button.addEventListener("pointerdown", () => this.cancelScheduledFocus());
    button.addEventListener("focus", () => {
      const index = this.navButtons.indexOf(button);
      if (index >= 0 && index !== this.selected) {
        this.selected = index;
        this.syncSelection(false);
      }
    });
    this.navButtons.push(button);
    return button;
  }

  private selectPointerButton(button: HTMLButtonElement): void {
    this.cancelScheduledFocus();
    const index = this.navButtons.indexOf(button);
    if (index < 0 || index === this.selected || button.disabled) return;
    this.selected = index;
    this.syncSelection(false);
  }

  private onKey(event: KeyboardEvent): void {
    if (document.body.classList.contains("game-skateboard-tuning-open")) {
      if (event.code === "Escape" || event.code === "KeyQ") {
        event.preventDefault();
        this.callbacks.onSkateboardTuning?.(false);
      }
      return;
    }
    const target = event.target as HTMLElement | null;
    const editing = target && ["INPUT", "TEXTAREA", "SELECT"].includes(target.tagName);
    if (editing) return;
    if (event.code === "KeyM" && !event.repeat) {
      this.debugVisible = !this.debugVisible;
      document.body.classList.toggle("game-debug-hidden", !this.debugVisible);
      document.body.classList.toggle("game-debug-visible", this.debugVisible);
      localStorage.setItem("solProtoDebugChrome", this.debugVisible ? "visible" : "hidden");
      this.root.setAttribute("aria-modal", String(!this.debugVisible));
      if (this.debugVisible) this.cancelScheduledFocus();
      if (this.screen) this.claimModalFocus();
      return;
    }
    if (this.isDeveloperChromeTarget(target)) return;
    if (!this.screen || this.transitionActive || event.repeat) return;
    // With developer chrome exposed, let native Tab leave the roving GameFlow
    // buttons and reach those real controls. Arrows/gamepad still own the menu.
    if (this.debugVisible && event.code === "Tab") return;
    if (event.code === "Tab") {
      event.preventDefault();
      this.moveSelection(event.shiftKey ? -1 : 1);
      return;
    }
    if (["ArrowUp", "ArrowLeft", "KeyW", "KeyA"].includes(event.code)) {
      event.preventDefault();
      this.moveSelection(-1);
    } else if (["ArrowDown", "ArrowRight", "KeyS", "KeyD"].includes(event.code)) {
      event.preventDefault();
      this.moveSelection(1);
    } else if (["Enter", "Space"].includes(event.code)) {
      event.preventDefault();
      this.activateSelection();
    } else if (event.code === "KeyQ") {
      event.preventDefault();
      this.goBack();
    }
  }

  private readGamepad(): typeof this.previousPad {
    let pad: Gamepad | null = inputPrompts.gamepad;
    if (!pad && navigator.getGamepads) {
      let pads: (Gamepad | null)[] = [];
      try { pads = navigator.getGamepads(); } catch { /* keyboard-only browser policy */ }
      for (let i = 0; i < pads.length; i++) {
        if (pads[i]?.connected) {
          pad = pads[i];
          break;
        }
      }
    }
    return {
      up: (pad?.axes[1] ?? 0) < -0.55 || pad?.buttons[12]?.pressed === true,
      down: (pad?.axes[1] ?? 0) > 0.55 || pad?.buttons[13]?.pressed === true,
      left: (pad?.axes[0] ?? 0) < -0.55 || pad?.buttons[14]?.pressed === true,
      right: (pad?.axes[0] ?? 0) > 0.55 || pad?.buttons[15]?.pressed === true,
      accept: actionButtonDown(pad, 'confirm'),
      back: actionButtonDown(pad, 'back'),
    };
  }

  private seedGamepad(): void {
    Object.assign(this.previousPad, this.readGamepad());
  }

  private syncVortexBodyClass(): void {
    document.body.classList.toggle(
      "game-flow-vortex",
      this.vortexBackgroundActive,
    );
  }

  private moveSelection(direction: number): void {
    const enabled = this.navButtons.filter((button) => !button.disabled);
    if (!enabled.length) return;
    const current = enabled.indexOf(this.navButtons[this.selected]);
    const next = current < 0
      ? direction < 0 ? enabled.length - 1 : 0
      : (current + direction + enabled.length) % enabled.length;
    this.selected = this.navButtons.indexOf(enabled[next]);
    this.syncSelection();
  }

  private activateSelection(): void {
    const button = this.navButtons[this.selected];
    if (button && !button.disabled) button.click();
  }

  private goBack(): void {
    if (this.screen === "confirm-new") {
      this.screen = "new-slots";
      this.render();
    } else if (this.screen === "new-slots") {
      this.screen = "launch";
      this.render();
    } else if (this.screen === "confirm-load") {
      this.screen = "load-slots";
      this.render();
    } else if (this.screen === "load-slots") {
      this.screen = this.slotOrigin === "warp" ? "save-load" : "launch";
      this.render();
    } else if (this.screen === "confirm-save") {
      this.screen = "save-load";
      this.render();
    } else if (this.screen === "confirm-quit-main" || this.screen === "save-load") {
      this.backToMapOrPause();
    } else if (this.screen === "options") {
      this.callbacks.onAudioOptions({ ...this.options });
      if (this.mapDirect) this.callbacks.onResume();
      else {
        this.screen = this.previousScreen ?? "pause";
        this.render();
      }
    } else if (this.screen === "progress") {
      this.backToMapOrPause();
    } else if (this.screen === "pause") this.callbacks.onResume();
  }

  private syncSelection(focusSelected = true): void {
    if (!this.navButtons[this.selected] || this.navButtons[this.selected].disabled)
      this.selected = this.navButtons.findIndex((button) => !button.disabled);
    this.navButtons.forEach((button, index) => {
      const active = index === this.selected && !button.disabled;
      button.classList.toggle("selected", active);
      button.setAttribute("tabindex", active ? "0" : "-1");
    });
    const selected = this.navButtons[this.selected];
    this.cancelScheduledFocus();
    if (focusSelected && selected && !selected.disabled) {
      this.focusFrame = requestAnimationFrame(() => {
        this.focusFrame = null;
        if (
          selected.isConnected &&
          this.navButtons[this.selected] === selected &&
          !selected.disabled
        )
          selected.focus({ preventScroll: true });
      });
    }
    this.invalidatePreCrt();
  }

  private cancelScheduledFocus(): void {
    if (this.focusFrame === null) return;
    cancelAnimationFrame(this.focusFrame);
    this.focusFrame = null;
  }

  private observePreCrtLayout(): void {
    const observer = this.layoutObserver;
    if (!observer) return;
    observer.disconnect();
    observer.observe(this.root);
    observer.observe(this.panel);
    for (const node of this.panel.querySelectorAll<HTMLElement>(
      ".timber-card, .game-over-layout, .game-over-copy, .game-menu-button",
    ))
      observer.observe(node);
  }

  private invalidatePreCrt(): void {
    this.gameFlowSurface.invalidate();
    if (
      (this.preCrtComposited || this.preCrtHandoffPending) &&
      this.screen
    )
      this.requestGameplayFrame();
  }

  private formatTime(time: number): string {
    const minutes = Math.floor(time / 60);
    const seconds = time - minutes * 60;
    return `${minutes}:${seconds.toFixed(2).padStart(5, "0")}`;
  }

  private screenLabel(): string {
    switch (this.screen) {
      case "launch": return "Main menu";
      case "new-slots": return "New game save slots";
      case "load-slots": return "Load game save slots";
      case "confirm-new": return `Replace save slot ${this.pendingNewSlot}`;
      case "save-load": return "Island Map save and load menu";
      case "confirm-save": return `Save game slot ${this.campaign.activeSlot ?? ""}`.trim();
      case "confirm-load": return `Load save slot ${this.pendingLoadSlot}`;
      case "confirm-quit-main": return "Quit to main menu confirmation";
      case "pause": return "Pause menu";
      case "progress": return "Campaign progress";
      case "options": return "Game options";
      case "gameover": return "Game over";
      case "results": return "Run results";
      default: return "Game menu";
    }
  }

  refreshModalTools(): void {
    if (this.screen) this.claimModalFocus();
  }

  private claimModalFocus(): void {
    if (!this.focusBeforeModal)
      this.focusBeforeModal = document.activeElement instanceof HTMLElement
        ? document.activeElement
        : null;
    this.root.setAttribute("aria-modal", String(!this.debugVisible));
    for (const child of Array.from(document.body.children)) {
      if (
        !(child instanceof HTMLElement) ||
        child === this.root ||
        child === this.transitionCurtain
      )
        continue;
      if ((this.debugVisible && this.isDeveloperChromeHost(child)) ||
          child.matches("[data-skateboard-panel-host][data-menu-open]")) {
        this.restoreModalElement(child);
        continue;
      }
      if (this.modalAriaHidden.has(child)) continue;
      this.modalAriaHidden.set(child, child.getAttribute("aria-hidden"));
      child.setAttribute("aria-hidden", "true");
      if (!child.inert) {
        child.inert = true;
        this.inertedElements.push(child);
      }
    }
  }

  private restoreModalElement(element: HTMLElement): void {
    if (this.modalAriaHidden.has(element)) {
      const previous = this.modalAriaHidden.get(element) ?? null;
      if (previous === null) element.removeAttribute("aria-hidden");
      else element.setAttribute("aria-hidden", previous);
      this.modalAriaHidden.delete(element);
    }
    const inertIndex = this.inertedElements.indexOf(element);
    if (inertIndex >= 0) {
      element.inert = false;
      this.inertedElements.splice(inertIndex, 1);
    }
  }

  private isDeveloperChromeHost(element: HTMLElement): boolean {
    return (
      element.matches(DEBUG_CHROME_SELECTOR) ||
      element.querySelector(DEBUG_CHROME_SELECTOR) !== null
    );
  }

  private isDeveloperChromeTarget(target: EventTarget | null): boolean {
    return (
      target instanceof Element &&
      target.closest(DEBUG_CHROME_SELECTOR) !== null
    );
  }

  private releaseModalFocus(): void {
    for (const element of this.inertedElements) element.inert = false;
    this.inertedElements = [];
    for (const [element, previous] of this.modalAriaHidden) {
      if (previous === null) element.removeAttribute("aria-hidden");
      else element.setAttribute("aria-hidden", previous);
    }
    this.modalAriaHidden.clear();
    this.focusBeforeModal?.focus({ preventScroll: true });
    this.focusBeforeModal = null;
  }

  private injectStyle(): void {
    const style = document.createElement("style");
    style.textContent = `
      :root {
        --game-ink: #29150d;
        --game-paper: #e7ad55;
        --game-paper-light: #ffd37d;
        --game-paper-dark: #a75b27;
        --game-orange: #ff8b20;
        --game-yellow: #ffd531;
        --game-green: #79e444;
        --game-blue: #52c9f4;
      }
      .game-shell {
        position: fixed; z-index: 60; inset: 0; overflow: hidden;
        color: #fff7d6; cursor: none; pointer-events: none;
        font-family: Roo, Impact, 'Arial Black', sans-serif;
      }
      .game-shell, .game-shell * { box-sizing: border-box; }
      .game-shell[hidden] { display: none !important; }
      .game-shell::before {
        content: ''; position: absolute; inset: 0; z-index: -2;
        background: radial-gradient(circle at 50% 38%, rgba(31,58,100,.26), rgba(3,5,12,.86) 66%, #020308 100%);
      }
      /* The semantic DOM remains fully laid out and its buttons remain the real
         hit plane. The handoff class is added only after the cached surface has
         drawn in the same task, so there is never a two-image opacity crossfade. */
      .game-shell.precrt-composited::before { opacity: 0; }
      .game-shell.precrt-composited .game-shell-panel { opacity: 0; }
      .game-shell.precrt-composited .game-shell-panel,
      .game-shell.precrt-composited .game-over-mask-fallback { transition: none; }
      .game-shell.precrt-composited .game-menu-button:focus-visible { outline: none; }
      .game-shell.pause-thumbnail-pending .game-shell-panel { opacity: 0; transition: none; }
      body.game-flow-vortex .game-shell::before {
        background: radial-gradient(circle at 50% 43%, rgba(4,5,14,.08), rgba(3,5,12,.34) 62%, rgba(2,3,8,.72) 100%);
      }
      body.game-shell-results .game-shell::before { background: transparent; backdrop-filter: none; }
      .game-shell-panel { position: absolute; inset: 0; display: grid; place-items: center; overflow-y: auto; padding: max(18px, env(safe-area-inset-top)) max(18px, env(safe-area-inset-right)) max(18px, env(safe-area-inset-bottom)) max(18px, env(safe-area-inset-left)); box-sizing: border-box; pointer-events: none; transition: none; }
      .timber-card {
        position: relative; border: 5px solid #5d2d17; border-radius: 15px 10px 17px 12px;
        background:
          linear-gradient(92deg, transparent 0 12%, rgba(92,42,15,.1) 12.4% 13%, transparent 13.3% 58%, rgba(92,42,15,.08) 58.5% 59%, transparent 59.4%),
          linear-gradient(180deg, var(--game-paper-light), var(--game-paper) 56%, var(--game-paper-dark));
        color: var(--game-ink); box-shadow: inset 0 3px 0 rgba(255,255,255,.35), inset 0 -8px 0 rgba(87,36,13,.16), 0 9px 0 #35190f, 0 18px 40px rgba(0,0,0,.62); pointer-events: auto; transform: none;
      }
      .timber-card::before, .timber-card::after { content: ''; position: absolute; pointer-events: none; background: #8a491f; border: 2px solid #4a230f; border-radius: 50%; width: 9px; height: 9px; box-shadow: inset 1px 1px 0 #d98a42; }
      .timber-card::before { top: 9px; left: 10px; }
      .timber-card::after { right: 10px; bottom: 9px; }
      .game-eyebrow { color: #703315; font: 400 clamp(14px, 1.6vw, 21px)/1 Roo, Impact, sans-serif; letter-spacing: .12em; text-align: center; }
      .game-launch-card { width: min(520px, 90vw); padding: clamp(24px, 5vh, 48px) clamp(25px, 6vw, 64px) 24px; }
      .game-logo { margin: 5px 0 24px; display: grid; text-align: center; line-height: .72; filter: drop-shadow(0 6px 0 #68200e); }
      .game-logo span { font-size: clamp(66px, 12vw, 122px); color: var(--game-yellow); -webkit-text-stroke: 4px #b83a13; paint-order: stroke fill; }
      .game-logo strong { font-size: clamp(52px, 9vw, 90px); color: #ef4b2c; -webkit-text-stroke: 3px #651d12; paint-order: stroke fill; }
      .game-menu-list { display: flex; flex-direction: column; align-items: stretch; gap: 7px; }
      .game-menu-button { position: relative; min-height: 48px; border: 0; background: transparent; color: #63230e; font: 400 clamp(24px, 3.5vw, 38px)/1 Roo, Impact, sans-serif; letter-spacing: .035em; text-shadow: 0 2px 0 rgba(255,235,151,.6); cursor: none; pointer-events: auto; transition: none; transform: none; }
      .game-menu-button::before { content: ''; position: absolute; left: 2px; top: 50%; width: 0; height: 0; opacity: 0; border-top: 10px solid transparent; border-bottom: 10px solid transparent; border-left: 17px solid #218d3c; transform: translate(0, -50%); filter: drop-shadow(1px 1px 0 #103514); transition: none; }
      .game-menu-button.selected { color: #f05a20; transform: none; filter: drop-shadow(0 2px 0 #fff0a3); }
      .game-menu-button.selected:not(.game-save-slot) { background: rgba(255,244,183,.22); box-shadow: inset 0 0 0 2px rgba(240,90,32,.40); }
      .game-menu-button.selected::before { opacity: 1; }
      .game-menu-button:focus-visible { outline: none; }
      .game-menu-button.danger { color: #9a281b; }
      .game-menu-button:disabled { color: #462416; opacity: .34; filter: none; }
      .game-launch-card .game-menu-button { color: #fff4d6; text-shadow: 0 2px 3px #172536; }
      .game-launch-card .game-menu-button.selected { color: #ffe786; filter: drop-shadow(0 2px 0 #68200e); background: transparent; box-shadow: none; }
      .game-input-hint { margin: 20px 0 0; text-align: center; color: #6e3a20; font: 700 12px/1.4 ui-monospace, Menlo, monospace; letter-spacing: .06em; }
      .game-slot-card { width: min(700px, 92vw); padding: 30px clamp(22px, 5vw, 54px); }
      .game-panel-title { margin: 0; text-align: center; color: #f05a20; font: 400 clamp(40px, 7vw, 70px)/1 Roo, Impact, sans-serif; -webkit-text-stroke: 2px #6c2512; paint-order: stroke fill; }
      .game-panel-subtitle { margin: 8px 0 22px; text-align: center; color: #68341c; font: 700 14px/1.4 ui-monospace, Menlo, monospace; }
      .game-save-slots { display: grid; gap: 10px; }
      .game-save-slot { min-height: 90px; padding: 13px 24px; border: 3px solid #7f3c1b; border-radius: 9px 13px 8px 12px; background: rgba(255,226,147,.28); text-align: left; }
      .game-save-slot::before { left: -25px; }
      .game-save-slot.selected { transform: none; background: rgba(255,244,183,.68); }
      .game-save-slot-inner { display: grid; grid-template-columns: 1fr auto; gap: 5px 18px; width: 100%; }
      .game-slot-number { font-size: clamp(24px, 4vw, 35px); }
      .game-slot-detail { align-self: end; text-align: right; font-size: clamp(16px, 2.6vw, 24px); color: #7a3218; }
      .game-slot-date { grid-column: 1 / -1; font: 700 11px/1.2 ui-monospace, Menlo, monospace; color: #754a2c; }
      .game-secondary-action { margin-top: 16px; }
      .game-pause-layout { width: min(1080px, 96vw); max-height: calc(100vh - 36px); display: grid; grid-template-columns: minmax(280px, 1.1fr) minmax(250px, .72fr); grid-template-rows: auto auto; gap: 20px; align-items: start; }
      .game-pause-preview { padding: 10px 10px 18px; }
      .game-pause-thumbnail { display: block; width: 100%; aspect-ratio: 16/9; object-fit: cover; background: #090b12; border: 4px solid #54280f; box-sizing: border-box; }
      .game-preview-name { margin: 12px 4px 0; text-align: center; color: #f06420; font-size: clamp(27px, 4vw, 46px); line-height: 1; }
      .game-pause-actions { padding: 24px 42px 28px; align-self: stretch; display: flex; flex-direction: column; justify-content: center; }
      .game-pause-actions .game-eyebrow { margin-bottom: 18px; }
      .game-progress-card { grid-column: 1 / -1; padding: 18px 28px 22px; }
      .game-progress-head { display: flex; justify-content: space-between; align-items: baseline; }
      .game-progress-head h2 { margin: 0; color: #693014; font-size: clamp(24px, 3vw, 37px); }
      .game-progress-head strong { color: #f06420; font-size: clamp(42px, 6vw, 68px); line-height: .8; -webkit-text-stroke: 1px #652211; paint-order: stroke fill; }
      .game-progress-bar { height: 14px; margin: 12px 0 15px; padding: 3px; background: #6f3218; border-radius: 10px; box-shadow: inset 0 2px 3px #351509; }
      .game-progress-bar span { display: block; height: 100%; min-width: 3px; border-radius: 7px; background: linear-gradient(90deg, #62cf37, #e8e82f); box-shadow: 0 0 8px rgba(137,237,64,.8); }
      .game-progress-grid { display: grid; grid-template-columns: repeat(4, 1fr); gap: 14px; }
      .game-progress-grid div { display: grid; grid-template-columns: auto 1fr; align-items: center; column-gap: 9px; }
      .game-progress-grid span { grid-row: 1 / 3; font-size: 32px; color: #9a4ce6; }
      .game-progress-grid strong { font-size: 24px; color: #71321a; }
      .game-progress-grid small { font: 800 11px/1 ui-monospace, Menlo, monospace; color: #70492c; }
      .game-progress-cleared { margin: 12px 0 0; text-align: right; color: #754425; font: 800 11px/1 ui-monospace, Menlo, monospace; }
      .game-progress-layout { width: min(1050px, 94vw); display: grid; grid-template-columns: .72fr 1.28fr; gap: 18px; align-items: start; }
      .game-progress-layout > .game-progress-card { grid-column: 1; position: sticky; top: 0; }
      .game-progress-ledger { grid-column: 2; padding: 22px 30px 26px; }
      .game-progress-ledger .game-panel-title { font-size: clamp(34px, 5vw, 55px); }
      .game-progress-island { margin-top: 15px; }
      .game-progress-island-name { margin: 0 0 5px; color: #218d3c; font-size: 23px; letter-spacing: .04em; }
      .game-progress-level { display: grid; grid-template-columns: minmax(150px, 1fr) auto; gap: 2px 14px; align-items: center; padding: 7px 9px; border-top: 1px solid rgba(100,55,29,.22); }
      .game-progress-level-name { color: #71321a; font-size: 19px; }
      .game-progress-level-rewards { color: #8b3cd0; font: 900 17px/1 system-ui, sans-serif; letter-spacing: .16em; }
      .game-progress-level-time { grid-column: 1 / -1; color: #70492c; font: 800 9px/1.2 ui-monospace, Menlo, monospace; }
      .game-progress-level.locked { opacity: .42; }
      .game-progress-level.boss .game-progress-level-name { color: #c74a1e; }
      .game-progress-back { width: 100%; }
      .game-options-card { width: min(590px, 91vw); padding: 32px 48px 40px; }
      .game-save-load-card { width: min(620px, 92vw); }
      .game-save-status { margin: 10px 0 4px; text-align: center; color: #68341c; font: 800 14px/1.35 ui-monospace, Menlo, monospace; letter-spacing: .05em; }
      .game-operation-status { min-height: 18px; margin: 0 0 10px; text-align: center; color: #27712c; font: 800 12px/1.35 ui-monospace, Menlo, monospace; }
      .game-operation-status.error { color: #9a281b; }
      .game-toggle { display: flex; justify-content: space-between; align-items: center; gap: 12px; padding: 0 24px; }
      .game-toggle strong { color: #218d3c; flex-shrink: 0; }
      .game-toggle.toggle-off strong { color: #a52f1c; }
      .game-play-mode strong { font-size: .8em; }
      .game-over-layout { position: absolute; inset: 0; display: grid; place-items: center; background: rgba(0,0,0,.18); overflow: hidden; }
      .game-over-layout::before { content: ''; position: absolute; inset: 0; background: radial-gradient(circle at 50% 44%, rgba(176,55,13,.18), transparent 37%), radial-gradient(ellipse at 50% 100%, #220805, transparent 48%); }
      .game-over-mask-fallback { width: min(760px, 84vw, calc(72vh * 1.15)); aspect-ratio: 1.15 / 1; background: center / min(300px, 43vw) no-repeat url('${import.meta.env.BASE_URL}crossbones.png'); filter: drop-shadow(0 0 35px rgba(255,91,19,.34)); transition: none; }
      body.game-flow-mask-ready .game-over-mask-fallback { opacity: 0; }
      .game-over-copy { position: absolute; left: 50%; bottom: max(5vh, env(safe-area-inset-bottom)); transform: translateX(-50%); width: min(840px, 94vw); display: grid; grid-template-columns: 1fr auto; gap: 5px 35px; align-items: end; }
      .game-over-title { grid-column: 1 / -1; margin: 0; text-align: center; color: #ffb42f; font: 400 clamp(54px, 10vw, 112px)/.85 Roo, Impact, sans-serif; -webkit-text-stroke: 3px #5b160d; paint-order: stroke fill; filter: drop-shadow(0 6px 0 #250807); }
      .game-over-question { margin: 0; align-self: center; text-align: right; font-size: clamp(30px, 5vw, 58px); }
      .game-over-actions { min-width: 170px; }
      .game-over-actions .game-menu-button { color: #fff; text-shadow: 0 3px 0 #111; }
      .game-over-actions .game-menu-button.selected { color: #ff9b20; }
      .game-screen-results { place-items: center end; background: linear-gradient(90deg, transparent 0 38%, rgba(3,5,10,.24) 52%, rgba(3,5,10,.85) 100%); backdrop-filter: none; }
      body.game-shell-results .tc-zone, body.game-shell-results .tc-pause { display: none !important; }
      .game-results-card { width: min(540px, 46vw); min-width: 390px; padding: 26px 34px 30px; margin-right: 4vw; }
      .game-results-title { margin: 7px 0 17px; text-align: center; color: #f05a20; font-size: clamp(32px, 4vw, 52px); line-height: 1; }
      .game-results-tally { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 13px; }
      .game-results-tally-normal { grid-template-columns: 1fr; }
      .game-results-tally div { display: grid; padding: 10px 14px; background: rgba(92,43,18,.14); border: 2px solid rgba(91,41,17,.55); border-radius: 8px; }
      .game-results-tally span { color: #714326; font: 800 11px/1.2 ui-monospace, Menlo, monospace; }
      .game-results-tally strong { color: #713019; font-size: 29px; }
      .game-results-time-trial .game-results-tally { margin: 8px 0 15px; gap: clamp(8px, 2vw, 16px); }
      .game-results-time-trial .game-results-tally div { padding: 9px 7px; text-align: center; }
      .game-results-time-trial .game-results-tally strong { min-width: 0; font-size: clamp(22px, 3vw, 32px); white-space: nowrap; }
      .game-results-tally .game-results-run-time, .game-results-tally .game-results-bests { grid-column: 1 / -1; }
      .game-results-tally .game-results-trial-unlocked { margin-top: 2px; border-color: rgba(33,141,60,.58); background: rgba(75,177,83,.12); text-align: center; }
      .game-results-trial-unlocked span { color: #27712c; }
      .game-results-trial-unlocked strong { color: #218d3c; font-size: 23px; }
      .game-results-time-trial .game-results-run-time strong { color: #ee571d; font-size: clamp(45px, 6vw, 72px); line-height: 1.1; }
      .game-results-time-trial .game-results-bests strong { margin-top: 5px; font: 800 clamp(12px, 1.35vw, 17px)/1.3 ui-monospace, Menlo, monospace; }
      .game-results-time-trial .game-results-tally { grid-template-columns: repeat(3, minmax(0, 1fr)); }
      .game-results-time-trial .game-results-run-time, .game-results-time-trial .game-results-bests { grid-column: span 2; }
      .game-results-time-trial .game-results-tally strong { font-size: clamp(16px, 2.5vw, 26px); }
      .game-results-time-trial .game-results-medal strong { font-size: clamp(16px, 2.1vw, 28px); }
      .game-results-time-trial .game-results-run-time strong { font-size: clamp(34px, 4.5vw, 60px); }
      .game-results-time-trial .game-results-bests strong { font-size: clamp(12px, 1.35vw, 17px); white-space: normal; }
      .game-results-actions { margin-top: 6px; }
      .game-cartoon-cursor { position: fixed; z-index: 90; top: 0; left: 0; width: 42px; height: 50px; pointer-events: none; opacity: 0; transform: translate3d(-100px,-100px,0); transition: opacity .12s; filter: drop-shadow(4px 5px 0 rgba(31,10,5,.65)); }
      .game-cartoon-cursor.visible { opacity: 1; }
      .game-cartoon-cursor svg { width: 100%; height: 100%; overflow: visible; }
      .game-cartoon-cursor path:first-child { fill: #ff8c22; stroke: #47190c; stroke-width: 5; stroke-linejoin: round; }
      .game-cartoon-cursor .game-cursor-shine { fill: #ffd846; stroke: none; }
      .game-transition-curtain { position: fixed; z-index: 100; inset: 0; background-color: #000; opacity: 0; pointer-events: none; transition: opacity .36s ease, background-color .36s ease; }
      .game-transition-curtain[hidden] { display: none !important; }
      .game-transition-curtain.active { opacity: 1; pointer-events: auto; }
      .game-transition-curtain.active.vortex { background-color: rgba(0,0,0,.16); }
      body.game-shell-transitioning .game-shell-panel { opacity: 0; pointer-events: none; }
      body.game-shell-transitioning .game-hud-layer,
      body.game-shell-transitioning .tc-zone,
      body.game-shell-transitioning .tc-pause,
      body.game-shell-transitioning .side-wrap,
      body.game-shell-transitioning .hud-build,
      body.game-shell-transitioning [data-crt-guest-panel-host],
      body.game-shell-transitioning [data-render-quality-panel-host],
      body.game-shell-transitioning [data-skateboard-panel-host],
      body.game-shell-transitioning [data-spin-panel-host],
      body.game-shell-transitioning visual-treatment-panel { opacity: 0 !important; pointer-events: none !important; }
      body.game-shell-modal .game-hud-layer, body.game-warp-room .game-hud-layer { opacity: 0 !important; pointer-events: none !important; }
      /* M is an explicit developer override. Its tools sit above the GameFlow
         semantic buttons but below the transition curtain's hard input guard. */
      body.game-debug-visible .side-wrap,
      body.game-debug-visible .hud-build,
      body.game-debug-visible .hud-capbadge,
      body.game-debug-visible [data-crt-guest-panel-host],
      body.game-debug-visible [data-render-quality-panel-host],
      body.game-debug-visible [data-skateboard-panel-host],
      body.game-debug-visible [data-spin-panel-host],
      body.game-debug-visible visual-treatment-panel,
      body.game-debug-visible .ed-panel,
      body.game-debug-visible .ed-popwrap,
      body.game-debug-visible .ed-marquee,
      body.game-debug-visible .ast-root,
      body.game-debug-visible .clab,
      body.game-debug-visible .pst { z-index: 80 !important; }
      body.game-debug-hidden .side-wrap,
      body.game-debug-hidden .hud-build,
      body.game-debug-hidden .hud-capbadge,
      body.game-debug-hidden [data-crt-guest-panel-host],
      body.game-debug-hidden [data-render-quality-panel-host],
      body.game-debug-hidden [data-skateboard-panel-host]:not([data-menu-open]),
      body.game-debug-hidden [data-spin-panel-host],
      body.game-debug-hidden visual-treatment-panel,
      body.game-debug-hidden .ed-panel,
      body.game-debug-hidden .ed-popwrap,
      body.game-debug-hidden .ed-marquee,
      body.game-debug-hidden .ast-root,
      body.game-debug-hidden .clab,
      body.game-debug-hidden .pst { display: none !important; }
      body.game-debug-hidden.game-field-studio-open .pst { display: block !important; }
      @media (pointer: coarse) {
        .game-shell { cursor: auto; }
        .game-menu-button { cursor: pointer; min-height: 56px; }
        .game-cartoon-cursor { display: none; }
      }
      @media (max-width: 760px), (max-height: 560px) {
        .game-options-card { padding: 24px; }
        .game-shell-panel { overflow-y: auto; place-items: start center; }
        .game-launch-card { margin: auto; }
        .game-pause-layout { height: auto; grid-template-columns: 1fr; grid-template-rows: auto; gap: 14px; }
        .game-pause-preview { width: min(92vw, 520px); box-sizing: border-box; }
        .game-pause-actions { width: min(92vw, 520px); box-sizing: border-box; }
        .game-progress-card { grid-column: 1; width: min(92vw, 520px); box-sizing: border-box; }
        .game-progress-grid { grid-template-columns: 1fr 1fr; }
        .game-progress-layout { grid-template-columns: 1fr; width: min(94vw, 620px); margin: auto; padding-block: 10px; }
        .game-progress-layout > .game-progress-card, .game-progress-ledger { grid-column: 1; position: static; width: auto; }
        .game-progress-ledger { padding: 16px 20px 20px; }
        .game-progress-level { padding-block: 5px; }
        .game-over-copy { grid-template-columns: 1fr; place-items: center; bottom: 3vh; }
        .game-over-question { text-align: center; }
        .game-over-actions { flex-direction: row; min-width: min(330px, 80vw); }
        .game-over-actions .game-menu-button { flex: 1; }
        .game-screen-results { place-items: end center; padding-bottom: 3vh; background: linear-gradient(180deg, transparent 0 30%, rgba(3,5,10,.88) 100%); }
        .game-results-card { width: min(88vw, 540px); min-width: 0; margin: 0; padding: 19px 24px 22px; }
        .game-results-title { margin: 5px 0 10px; font-size: 30px; }
        .game-results-actions { flex-direction: row; gap: 8px; }
        .game-results-actions .game-menu-button { flex: 1; min-height: 42px; font-size: 22px; padding: 6px; }
      }
      @media (min-aspect-ratio: 13/10) and (max-height: 560px) {
        .game-screen-results { place-items: center end; padding: 12px; }
        .game-results-card { width: 46vw; padding: 12px 18px; }
        .game-results-title { font-size: 27px; }
        .game-results-time-trial .game-results-tally { margin: 5px 0; gap: 5px; }
        .game-results-time-trial .game-results-tally div { padding: 5px; }
        .game-results-time-trial .game-results-run-time strong { font-size: 42px; }
      }
      @media (pointer: coarse) and (orientation: landscape) and (max-height: 560px) {
        .game-shell-panel { padding: 8px max(10px, env(safe-area-inset-right)) 8px max(10px, env(safe-area-inset-left)); }
        .game-pause-layout {
          width: min(96vw, 920px); grid-template-columns: minmax(0, 1.35fr) minmax(190px, .65fr);
          grid-template-rows: auto auto; gap: 9px;
        }
        .game-pause-preview, .game-pause-actions { width: auto; min-width: 0; }
        .game-pause-actions { padding: 10px 14px 12px; }
        .game-pause-actions .game-menu-button { min-height: 44px; padding: 4px 13px; font-size: clamp(20px, 5.5vh, 29px); }
        .game-progress-card { grid-column: 1 / -1; width: auto; padding: 10px 16px 12px; }
      }
      @media (prefers-reduced-motion: reduce) {
        .game-transition-curtain { transition-duration: .01ms !important; }
      }
      /* Map utilities are real scroll surfaces, including their blank gutters.
         Keep the cancel affordance outside document flow so it cannot scroll
         off-screen. The pre-CRT surface mirrors both scrolling and this X. */
      body.tc-on .game-shell-panel.game-map-menu-panel {
        display:block; pointer-events:auto; overflow-y:auto; overflow-x:hidden;
        touch-action:pan-y; overscroll-behavior:contain; -webkit-overflow-scrolling:touch;
        padding:calc(max(12px, env(safe-area-inset-top)) + 60px) max(18px, env(safe-area-inset-right)) max(24px, env(safe-area-inset-bottom)) max(18px, env(safe-area-inset-left));
      }
      body.tc-on .game-map-menu-panel > :not(.game-map-close) { max-width:100%; margin-inline:auto; }
      body.tc-on .game-map-menu-panel .game-progress-layout { margin-block:0; }
      .game-menu-button.game-map-close {
        position:fixed; z-index:5; right:max(16px, env(safe-area-inset-right)); top:max(12px, env(safe-area-inset-top));
        width:48px; height:48px; min-height:48px; margin:0; padding:0; border:2px solid #e5e0cd; border-radius:10px;
        background:#243138; color:#fff7da; font:700 30px/1 Arial, sans-serif; text-align:center;
        pointer-events:auto; touch-action:manipulation; filter:none; text-shadow:none;
      }
      .game-menu-button.game-map-close.selected { background:#36515d; box-shadow:none; color:#fff7da; filter:none; }
      .game-menu-button.game-map-close::before { display:none; }
    `;
    document.head.appendChild(style);
  }
}
