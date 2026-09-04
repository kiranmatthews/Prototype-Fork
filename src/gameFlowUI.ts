// Game-owned menus and campaign screens. This layer is intentionally separate
// from UI's gameplay HUD so it stays crisp, interactive, and outside the
// pre-CRT composition pass.

import "./roofont";
import {
  CAMPAIGN_LEVELS,
  CAMPAIGN_SAVE_SLOTS,
  CampaignStore,
  type CampaignSaveV1,
  type GameAudioOptions,
} from "./campaign";

type GameScreen =
  | "launch"
  | "new-slots"
  | "load-slots"
  | "confirm-new"
  | "pause"
  | "options"
  | "gameover"
  | "results";

export interface PauseScreenState {
  levelName: string;
  inWarpRoom: boolean;
}

export interface ResultsScreenState {
  levelName: string;
  time: number;
  boxes: number;
  totalBoxes: number;
  crystal: boolean;
  boxGem: boolean;
  comboGem: boolean;
  timeRelic: boolean;
  firstClear: boolean;
}

export interface GameFlowUICallbacks {
  onNewGame: (slot: number) => void;
  onLoadGame: (slot: number) => void;
  onResume: () => void;
  onRestart: () => void;
  onQuitLevel: () => void;
  onGameOverRetry: () => void;
  onGameOverQuit: () => void;
  onResultsRetry: () => void;
  onResultsContinue: () => void;
  onAudioOptions: (options: GameAudioOptions) => void;
}

const wait = (milliseconds: number): Promise<void> =>
  new Promise((resolve) => window.setTimeout(resolve, milliseconds));

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
  private pauseState: PauseScreenState | null = null;
  private pendingNewSlot = 1;
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

  constructor(
    private campaign: CampaignStore,
    private callbacks: GameFlowUICallbacks,
    initialOptions: GameAudioOptions,
  ) {
    this.options = { ...initialOptions };
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
    this.root.addEventListener("pointermove", (event) => {
      this.cursor.style.transform = `translate3d(${event.clientX - 6}px, ${event.clientY - 4}px, 0)`;
      this.cursor.classList.add("visible");
    });
    this.root.addEventListener("pointerleave", () => this.cursor.classList.remove("visible"));
    window.addEventListener("keydown", (event) => this.onKey(event));
  }

  get blocksGameplay(): boolean {
    return this.transitionActive || this.screen !== null;
  }

  get currentScreen(): GameScreen | null {
    return this.screen;
  }

  get vortexBackgroundActive(): boolean {
    return (
      this.loadingVortexActive ||
      this.screen === "launch" ||
      this.screen === "new-slots" ||
      this.screen === "load-slots" ||
      this.screen === "confirm-new" ||
      this.screen === "gameover"
    );
  }

  get vortexGameOverMaskActive(): boolean {
    return !this.loadingVortexActive && this.screen === "gameover";
  }

  get developerChromeVisible(): boolean {
    return this.debugVisible;
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
    this.screen = "launch";
    this.render();
  }

  hide(): void {
    this.cursor.classList.remove("visible");
    this.screen = null;
    this.previousScreen = null;
    this.root.hidden = true;
    document.body.classList.remove("game-shell-modal", "game-shell-paused", "game-shell-results");
    this.syncVortexBodyClass();
    this.releaseModalFocus();
  }

  showPause(state: PauseScreenState): void {
    this.pauseState = state;
    this.screen = "pause";
    this.render();
  }

  /** Options/Escape/P routing is polled by the gameplay Input owner. */
  handlePauseToggle(): boolean {
    if (this.transitionActive) return true;
    if (
      this.screen === "new-slots" ||
      this.screen === "load-slots" ||
      this.screen === "confirm-new"
    ) {
      this.screen = this.screen === "confirm-new" ? "new-slots" : "launch";
      this.render();
      return true;
    }
    if (this.screen === "options") {
      this.callbacks.onAudioOptions({ ...this.options });
      this.screen = "pause";
      this.render();
      return true;
    }
    if (this.screen === "pause") {
      this.callbacks.onResume();
      return true;
    }
    return this.screen !== null;
  }

  showGameOver(levelName: string): void {
    this.pauseState = { levelName, inWarpRoom: false };
    this.screen = "gameover";
    this.render();
  }

  showResults(state: ResultsScreenState): void {
    this.screen = "results";
    this.renderResults(state);
  }

  setWarpRoom(active: boolean): void {
    document.body.classList.toggle("game-warp-room", active);
  }

  captureGameplay(source: HTMLCanvasElement): void {
    const target = this.thumbnail;
    if (!target || this.screen !== "pause" || this.thumbnailCaptured) return;
    const width = Math.max(1, source.width);
    const height = Math.max(1, source.height);
    const targetWidth = 640;
    const targetHeight = Math.round(targetWidth * height / width);
    if (target.width !== targetWidth || target.height !== targetHeight) {
      target.width = targetWidth;
      target.height = targetHeight;
    }
    const context = target.getContext("2d");
    try {
      context?.drawImage(source, 0, 0, target.width, target.height);
      this.thumbnailCaptured = true;
    } catch {
      // A lost WebGL frame should not make the pause menu unusable.
    }
  }

  update(now = performance.now()): void {
    void now;
    // Input already polls gamepads for gameplay. Do not repeat that scan and
    // allocate an Array/state object on every ordinary gameplay frame.
    if (!this.screen) return;
    const { up, down, left, right, accept, back } = this.readGamepad();
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

  async transition(action: () => void | Promise<void>): Promise<void> {
    if (this.transitionActive) return;
    this.transitionActive = true;
    document.body.classList.add("game-shell-transitioning");
    this.transitionCurtain.hidden = false;
    // Flush the newly displayed opacity-0 state so adding .active below keeps
    // the fade-in transition instead of coalescing display + opacity in one
    // style update and appearing fully black on its first painted frame.
    void this.transitionCurtain.offsetWidth;
    this.transitionCurtain.classList.add("active");
    try {
      await wait(this.reducedMotion ? 20 : 360);
      // The black guard is now opaque: swap the main renderer to the preserved
      // Gouraud field, then reveal it as the actual loading background.
      this.loadingVortexActive = true;
      this.syncVortexBodyClass();
      this.transitionCurtain.classList.add("vortex");
      await wait(this.reducedMotion ? 20 : 120);
      await action();
      // Draw the destination exactly once while the curtain is opaque. If the
      // action resumes gameplay, normal rendering takes over after the fade.
      this.requestGameplayFrame();
      await wait(this.reducedMotion ? 20 : 150);
      this.transitionCurtain.classList.remove("vortex");
      await wait(this.reducedMotion ? 20 : 160);
      this.loadingVortexActive = false;
      this.syncVortexBodyClass();
    } finally {
      this.loadingVortexActive = false;
      this.syncVortexBodyClass();
      this.requestGameplayFrame();
      this.transitionCurtain.classList.remove("vortex", "active");
      await wait(this.reducedMotion ? 20 : 520);
      // The opacity transition has now finished. Removing the curtain from
      // layout releases its full-viewport compositor surface during gameplay.
      this.transitionCurtain.hidden = true;
      this.transitionActive = false;
      document.body.classList.remove("game-shell-transitioning");
      this.syncVortexBodyClass();
    }
  }

  private render(): void {
    this.claimModalFocus();
    this.root.hidden = false;
    document.body.classList.add("game-shell-modal");
    document.body.classList.toggle("game-shell-paused", this.screen === "pause" || this.screen === "options");
    document.body.classList.remove("game-shell-results");
    this.panel.className = `game-shell-panel game-screen-${this.screen ?? "none"}`;
    this.root.setAttribute("aria-label", this.screenLabel());
    this.panel.replaceChildren();
    this.thumbnail = null;
    this.thumbnailCaptured = false;
    this.requestGameplayFrame();
    this.navButtons = [];
    this.selected = 0;
    if (this.screen === "launch") this.renderLaunch();
    else if (this.screen === "new-slots") this.renderSlots(true);
    else if (this.screen === "load-slots") this.renderSlots(false);
    else if (this.screen === "confirm-new") this.renderConfirmNew();
    else if (this.screen === "pause") this.renderPause();
    else if (this.screen === "options") this.renderOptions();
    else if (this.screen === "gameover") this.renderGameOver();
    this.syncVortexBodyClass();
    this.syncSelection();
    this.seedGamepad();
  }

  private renderLaunch(): void {
    const card = element("div", "game-launch-card timber-card");
    const eyebrow = element("div", "game-eyebrow");
    eyebrow.textContent = "A WARPED BOARD ADVENTURE";
    const title = element("h1", "game-logo");
    title.innerHTML = `<span>BOARD</span><strong>SOL</strong>`;
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
        this.previousScreen = "launch";
        this.screen = "new-slots";
        this.render();
      }),
      this.button("LOAD GAME", () => {
        this.previousScreen = "launch";
        this.screen = "load-slots";
        this.render();
      }),
    );
    menu.append(...actions);
    const hint = element("p", "game-input-hint");
    hint.textContent = "ARROWS / STICK TO CHOOSE  ·  PRIMARY BUTTON / ENTER TO SELECT";
    card.append(eyebrow, title, menu, hint);
    this.panel.appendChild(card);
  }

  private renderSlots(newGame: boolean): void {
    const card = element("div", "game-slot-card timber-card");
    const title = element("h2", "game-panel-title");
    title.textContent = newGame ? "NEW GAME" : "LOAD GAME";
    const subtitle = element("p", "game-panel-subtitle");
    subtitle.textContent = newGame
      ? "Choose a slot. Existing progress in that slot will be replaced."
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
        else this.callbacks.onLoadGame(slot);
      });
      button.classList.add("game-save-slot");
      button.disabled = !newGame && !save;
      button.appendChild(this.saveSlotContents(slot, save));
      slots.appendChild(button);
    }
    const back = this.button("BACK", () => {
      this.screen = this.previousScreen ?? "launch";
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
    const state = this.pauseState ?? { levelName: "THE WARP ROOM", inWarpRoom: false };
    const layout = element("div", "game-pause-layout");
    const preview = element("div", "game-pause-preview timber-card");
    this.thumbnail = element("canvas", "game-pause-thumbnail");
    const name = element("div", "game-preview-name");
    name.textContent = state.levelName;
    preview.append(this.thumbnail, name);

    const actions = element("div", "game-pause-actions timber-card");
    const paused = element("div", "game-eyebrow");
    paused.textContent = state.inWarpRoom ? "WARP ROOM" : "PAUSED";
    const list = element("div", "game-menu-list");
    list.append(
      this.button("RESUME", this.callbacks.onResume),
      this.button("OPTIONS", () => {
        this.previousScreen = "pause";
        this.screen = "options";
        this.render();
      }),
    );
    if (!state.inWarpRoom) {
      list.append(
        this.button("RESTART", this.callbacks.onRestart),
        this.button("QUIT LEVEL", this.callbacks.onQuitLevel, "danger"),
      );
    }
    actions.append(paused, list);

    const progress = this.progressCard();
    layout.append(preview, actions, progress);
    this.panel.appendChild(layout);
  }

  private renderOptions(): void {
    const card = element("div", "game-options-card timber-card");
    const title = element("h2", "game-panel-title");
    title.textContent = "OPTIONS";
    const toggles = element("div", "game-menu-list game-toggle-list");
    toggles.append(
      this.toggleButton("SOUND EFFECTS", !this.options.sfxMuted, () => {
        this.options.sfxMuted = !this.options.sfxMuted;
      }),
      this.toggleButton("BACKGROUND MUSIC", !this.options.musicMuted, () => {
        this.options.musicMuted = !this.options.musicMuted;
      }),
      this.button("BACK", () => {
        this.callbacks.onAudioOptions({ ...this.options });
        this.screen = this.previousScreen ?? "pause";
        this.render();
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
    this.root.hidden = false;
    document.body.classList.add("game-shell-modal", "game-shell-results");
    document.body.classList.remove("game-shell-paused");
    this.screen = "results";
    this.panel.className = "game-shell-panel game-screen-results";
    this.root.setAttribute("aria-label", "Run results");
    this.panel.replaceChildren();
    this.thumbnail = null;
    this.thumbnailCaptured = false;
    this.requestGameplayFrame();
    this.navButtons = [];
    this.selected = 0;

    const card = element("div", "game-results-card timber-card");
    const eyebrow = element("div", "game-eyebrow");
    eyebrow.textContent = state.firstClear ? "COURSE CLEAR" : "RUN COMPLETE";
    const title = element("h2", "game-results-title");
    title.textContent = state.levelName;
    const tally = element("div", "game-results-tally");
    tally.innerHTML = `
      <div><span>TIME</span><strong>${this.formatTime(state.time)}</strong></div>
      <div><span>BOXES</span><strong>${state.boxes} / ${state.totalBoxes}</strong></div>`;
    const awards = element("div", "game-results-awards");
    awards.append(
      this.award("CRYSTAL", state.crystal, "◆"),
      this.award("BOX GEM", state.boxGem, "◇"),
      this.award("COMBO GEM", state.comboGem, "✦"),
      this.award("TIME RELIC", state.timeRelic, "◉"),
    );
    const actions = element("div", "game-menu-list game-results-actions");
    actions.append(
      this.button("RETRY LEVEL", this.callbacks.onResultsRetry),
      this.button("CONTINUE", this.callbacks.onResultsContinue),
    );
    card.append(eyebrow, title, tally, awards, actions);
    this.panel.appendChild(card);
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
      <div><span>◉</span><strong>${totals.relics}/${totals.maxLevels}</strong><small>RELICS</small></div>
      <div><span>✦</span><strong>${totals.cleared}/${totals.maxLevels}</strong><small>LEVELS</small></div>`;
    const cleared = element("p", "game-progress-cleared");
    cleared.textContent = `${totals.cleared} OF ${CAMPAIGN_LEVELS.length} LEVELS CLEARED`;
    card.append(head, bar, grid, cleared);
    return card;
  }

  private award(label: string, earned: boolean, icon: string): HTMLElement {
    const item = element("div", `game-award${earned ? " earned" : ""}`);
    const glyph = element("span");
    glyph.textContent = icon;
    const copy = element("small");
    copy.textContent = earned ? label : `${label} —`;
    item.append(glyph, copy);
    return item;
  }

  private toggleButton(label: string, on: boolean, mutate: () => void): HTMLButtonElement {
    const button = this.button("", () => {
      mutate();
      const active = label === "SOUND EFFECTS" ? !this.options.sfxMuted : !this.options.musicMuted;
      button.setAttribute("aria-pressed", String(active));
      button.querySelector("strong")!.textContent = active ? "ON" : "OFF";
      button.classList.toggle("toggle-off", !active);
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
      const index = this.navButtons.indexOf(button);
      if (index >= 0) {
        this.selected = index;
        this.syncSelection();
      }
    });
    this.navButtons.push(button);
    return button;
  }

  private onKey(event: KeyboardEvent): void {
    const target = event.target as HTMLElement | null;
    const editing = target && ["INPUT", "TEXTAREA", "SELECT"].includes(target.tagName);
    if (editing) return;
    if (event.code === "KeyM" && !event.repeat) {
      this.debugVisible = !this.debugVisible;
      document.body.classList.toggle("game-debug-hidden", !this.debugVisible);
      localStorage.setItem("solProtoDebugChrome", this.debugVisible ? "visible" : "hidden");
      return;
    }
    if (!this.screen || this.transitionActive || event.repeat) return;
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
    let pad: Gamepad | null = null;
    if (navigator.getGamepads) {
      const pads = navigator.getGamepads();
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
      accept: pad?.buttons[0]?.pressed === true,
      back: pad?.buttons[1]?.pressed === true,
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
    } else if (this.screen === "new-slots" || this.screen === "load-slots") {
      this.screen = "launch";
      this.render();
    } else if (this.screen === "options") {
      this.callbacks.onAudioOptions({ ...this.options });
      this.screen = this.previousScreen ?? "pause";
      this.render();
    } else if (this.screen === "pause") this.callbacks.onResume();
  }

  private syncSelection(): void {
    if (!this.navButtons[this.selected] || this.navButtons[this.selected].disabled)
      this.selected = this.navButtons.findIndex((button) => !button.disabled);
    this.navButtons.forEach((button, index) => {
      const active = index === this.selected && !button.disabled;
      button.classList.toggle("selected", active);
      button.setAttribute("tabindex", active ? "0" : "-1");
    });
    const selected = this.navButtons[this.selected];
    if (selected && !selected.disabled)
      requestAnimationFrame(() => selected.focus({ preventScroll: true }));
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
      case "pause": return "Pause menu";
      case "options": return "Audio options";
      case "gameover": return "Game over";
      case "results": return "Run results";
      default: return "Game menu";
    }
  }

  private claimModalFocus(): void {
    if (!this.focusBeforeModal)
      this.focusBeforeModal = document.activeElement instanceof HTMLElement
        ? document.activeElement
        : null;
    if (this.modalAriaHidden.size) return;
    for (const child of Array.from(document.body.children)) {
      if (
        !(child instanceof HTMLElement) ||
        child === this.root ||
        child === this.transitionCurtain
      )
        continue;
      this.modalAriaHidden.set(child, child.getAttribute("aria-hidden"));
      child.setAttribute("aria-hidden", "true");
      if (!child.inert) {
        child.inert = true;
        this.inertedElements.push(child);
      }
    }
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
        color: #fff7d6; cursor: none; pointer-events: auto;
        font-family: Roo, Impact, 'Arial Black', sans-serif;
      }
      .game-shell, .game-shell * { box-sizing: border-box; }
      .game-shell[hidden] { display: none !important; }
      .game-shell::before {
        content: ''; position: absolute; inset: 0; z-index: -2;
        background: radial-gradient(circle at 50% 38%, rgba(31,58,100,.26), rgba(3,5,12,.86) 66%, #020308 100%);
      }
      body.game-flow-vortex .game-shell::before {
        background: radial-gradient(circle at 50% 43%, rgba(4,5,14,.08), rgba(3,5,12,.34) 62%, rgba(2,3,8,.72) 100%);
      }
      body.game-shell-results .game-shell::before { background: transparent; backdrop-filter: none; }
      .game-shell-panel { position: absolute; inset: 0; display: grid; place-items: center; overflow-y: auto; padding: max(18px, env(safe-area-inset-top)) max(18px, env(safe-area-inset-right)) max(18px, env(safe-area-inset-bottom)) max(18px, env(safe-area-inset-left)); box-sizing: border-box; transition: opacity .18s ease; }
      .timber-card {
        position: relative; border: 5px solid #5d2d17; border-radius: 15px 10px 17px 12px;
        background:
          linear-gradient(92deg, transparent 0 12%, rgba(92,42,15,.1) 12.4% 13%, transparent 13.3% 58%, rgba(92,42,15,.08) 58.5% 59%, transparent 59.4%),
          linear-gradient(180deg, var(--game-paper-light), var(--game-paper) 56%, var(--game-paper-dark));
        color: var(--game-ink); box-shadow: inset 0 3px 0 rgba(255,255,255,.35), inset 0 -8px 0 rgba(87,36,13,.16), 0 9px 0 #35190f, 0 18px 40px rgba(0,0,0,.62);
      }
      .timber-card::before, .timber-card::after { content: ''; position: absolute; pointer-events: none; background: #8a491f; border: 2px solid #4a230f; border-radius: 50%; width: 9px; height: 9px; box-shadow: inset 1px 1px 0 #d98a42; }
      .timber-card::before { top: 9px; left: 10px; }
      .timber-card::after { right: 10px; bottom: 9px; }
      .game-eyebrow { color: #703315; font: 400 clamp(14px, 1.6vw, 21px)/1 Roo, Impact, sans-serif; letter-spacing: .12em; text-align: center; }
      .game-launch-card { width: min(520px, 90vw); padding: clamp(24px, 5vh, 48px) clamp(25px, 6vw, 64px) 24px; transform: rotate(-.35deg); }
      .game-logo { margin: 5px 0 24px; display: grid; text-align: center; line-height: .72; filter: drop-shadow(0 6px 0 #68200e); }
      .game-logo span { font-size: clamp(66px, 12vw, 122px); color: var(--game-yellow); -webkit-text-stroke: 4px #b83a13; paint-order: stroke fill; transform: rotate(-2deg); }
      .game-logo strong { font-size: clamp(52px, 9vw, 90px); color: #ef4b2c; -webkit-text-stroke: 3px #651d12; paint-order: stroke fill; transform: rotate(2deg); }
      .game-menu-list { display: flex; flex-direction: column; align-items: stretch; gap: 7px; }
      .game-menu-button { position: relative; min-height: 48px; border: 0; background: transparent; color: #63230e; font: 400 clamp(24px, 3.5vw, 38px)/1 Roo, Impact, sans-serif; letter-spacing: .035em; text-shadow: 0 2px 0 rgba(255,235,151,.6); cursor: none; transition: transform .12s ease, color .12s ease, filter .12s ease; }
      .game-menu-button::before { content: ''; position: absolute; left: 2px; top: 50%; width: 0; height: 0; opacity: 0; border-top: 10px solid transparent; border-bottom: 10px solid transparent; border-left: 17px solid #218d3c; transform: translate(-9px, -50%); filter: drop-shadow(1px 1px 0 #103514); transition: .12s ease; }
      .game-menu-button.selected { color: #f05a20; transform: scale(1.07) rotate(-1deg); filter: drop-shadow(0 2px 0 #fff0a3); }
      .game-menu-button.selected::before { opacity: 1; transform: translate(0, -50%); }
      .game-menu-button:focus-visible { outline: 3px solid #fff0a3; outline-offset: 2px; border-radius: 8px; }
      .game-menu-button.danger { color: #9a281b; }
      .game-menu-button:disabled { color: rgba(70,36,22,.34); filter: grayscale(1); }
      .game-input-hint { margin: 20px 0 0; text-align: center; color: #6e3a20; font: 700 12px/1.4 ui-monospace, Menlo, monospace; letter-spacing: .06em; }
      .game-slot-card { width: min(700px, 92vw); padding: 30px clamp(22px, 5vw, 54px); }
      .game-panel-title { margin: 0; text-align: center; color: #f05a20; font: 400 clamp(40px, 7vw, 70px)/1 Roo, Impact, sans-serif; -webkit-text-stroke: 2px #6c2512; paint-order: stroke fill; }
      .game-panel-subtitle { margin: 8px 0 22px; text-align: center; color: #68341c; font: 700 14px/1.4 ui-monospace, Menlo, monospace; }
      .game-save-slots { display: grid; gap: 10px; }
      .game-save-slot { min-height: 90px; padding: 13px 24px; border: 3px solid #7f3c1b; border-radius: 9px 13px 8px 12px; background: rgba(255,226,147,.28); text-align: left; }
      .game-save-slot::before { left: -25px; }
      .game-save-slot.selected { transform: scale(1.025) rotate(-.3deg); background: rgba(255,244,183,.62); }
      .game-save-slot-inner { display: grid; grid-template-columns: 1fr auto; gap: 5px 18px; width: 100%; }
      .game-slot-number { font-size: clamp(24px, 4vw, 35px); }
      .game-slot-detail { align-self: end; text-align: right; font-size: clamp(16px, 2.6vw, 24px); color: #7a3218; }
      .game-slot-date { grid-column: 1 / -1; font: 700 11px/1.2 ui-monospace, Menlo, monospace; color: #754a2c; }
      .game-secondary-action { margin-top: 16px; }
      .game-pause-layout { width: min(1080px, 96vw); max-height: calc(100vh - 36px); display: grid; grid-template-columns: minmax(280px, 1.1fr) minmax(250px, .72fr); grid-template-rows: auto auto; gap: 20px; align-items: start; }
      .game-pause-preview { padding: 10px 10px 18px; transform: rotate(-.5deg); }
      .game-pause-thumbnail { display: block; width: 100%; aspect-ratio: 16/9; object-fit: cover; background: #090b12; border: 4px solid #54280f; box-sizing: border-box; }
      .game-preview-name { margin: 12px 4px 0; text-align: center; color: #f06420; font-size: clamp(27px, 4vw, 46px); line-height: 1; }
      .game-pause-actions { padding: 24px 42px 28px; align-self: stretch; display: flex; flex-direction: column; justify-content: center; transform: rotate(.45deg); }
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
      .game-options-card { width: min(590px, 91vw); padding: 32px 48px 40px; }
      .game-toggle { display: flex; justify-content: space-between; align-items: center; padding: 0 24px; }
      .game-toggle strong { color: #218d3c; }
      .game-toggle.toggle-off strong { color: #a52f1c; }
      .game-over-layout { position: absolute; inset: 0; display: grid; place-items: center; background: rgba(0,0,0,.18); overflow: hidden; }
      .game-over-layout::before { content: ''; position: absolute; inset: 0; background: radial-gradient(circle at 50% 44%, rgba(176,55,13,.18), transparent 37%), radial-gradient(ellipse at 50% 100%, #220805, transparent 48%); }
      .game-over-mask-fallback { width: min(760px, 84vw, calc(72vh * 1.15)); aspect-ratio: 1.15 / 1; background: center / min(300px, 43vw) no-repeat url('${import.meta.env.BASE_URL}crossbones.png'); filter: drop-shadow(0 0 35px rgba(255,91,19,.34)); transition: opacity .18s; }
      body.game-flow-mask-ready .game-over-mask-fallback { opacity: 0; }
      .game-over-copy { position: absolute; left: 50%; bottom: max(5vh, env(safe-area-inset-bottom)); transform: translateX(-50%); width: min(840px, 94vw); display: grid; grid-template-columns: 1fr auto; gap: 5px 35px; align-items: end; }
      .game-over-title { grid-column: 1 / -1; margin: 0; text-align: center; color: #ffb42f; font: 400 clamp(54px, 10vw, 112px)/.85 Roo, Impact, sans-serif; -webkit-text-stroke: 3px #5b160d; paint-order: stroke fill; filter: drop-shadow(0 6px 0 #250807); }
      .game-over-question { margin: 0; align-self: center; text-align: right; font-size: clamp(30px, 5vw, 58px); }
      .game-over-actions { min-width: 170px; }
      .game-over-actions .game-menu-button { color: #fff; text-shadow: 0 3px 0 #111; }
      .game-over-actions .game-menu-button.selected { color: #ff9b20; }
      .game-screen-results { place-items: center end; background: linear-gradient(90deg, transparent 0 38%, rgba(3,5,10,.24) 52%, rgba(3,5,10,.85) 100%); backdrop-filter: none; }
      .game-results-card { width: min(540px, 46vw); min-width: 390px; padding: 26px 34px 30px; margin-right: 4vw; transform: rotate(.25deg); }
      .game-results-title { margin: 7px 0 17px; text-align: center; color: #f05a20; font-size: clamp(32px, 4vw, 52px); line-height: 1; }
      .game-results-tally { display: grid; grid-template-columns: 1fr 1fr; gap: 13px; }
      .game-results-tally div { display: grid; padding: 10px 14px; background: rgba(92,43,18,.14); border: 2px solid rgba(91,41,17,.55); border-radius: 8px; }
      .game-results-tally span { color: #714326; font: 800 11px/1.2 ui-monospace, Menlo, monospace; }
      .game-results-tally strong { color: #713019; font-size: 29px; }
      .game-results-awards { display: grid; grid-template-columns: 1fr 1fr; gap: 8px; margin: 15px 0; }
      .game-award { display: flex; align-items: center; gap: 8px; opacity: .35; filter: grayscale(1); }
      .game-award.earned { opacity: 1; filter: none; }
      .game-award span { color: #a45bf0; font-size: 31px; text-shadow: 0 2px 0 #4b214f; }
      .game-award small { color: #67361e; font: 800 11px/1.2 ui-monospace, Menlo, monospace; }
      .game-results-actions { margin-top: 6px; }
      .game-cartoon-cursor { position: fixed; z-index: 90; top: 0; left: 0; width: 42px; height: 50px; pointer-events: none; opacity: 0; transform: translate3d(-100px,-100px,0); transition: opacity .12s; filter: drop-shadow(4px 5px 0 rgba(31,10,5,.65)); }
      .game-cartoon-cursor.visible { opacity: 1; }
      .game-cartoon-cursor svg { width: 100%; height: 100%; overflow: visible; }
      .game-cartoon-cursor path:first-child { fill: #ff8c22; stroke: #47190c; stroke-width: 5; stroke-linejoin: round; }
      .game-cartoon-cursor .game-cursor-shine { fill: #ffd846; stroke: none; }
      .game-transition-curtain { position: fixed; z-index: 100; inset: 0; background-color: #000; opacity: 0; pointer-events: none; transition: opacity .36s ease, background-color .16s ease; }
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
      body.game-debug-hidden .side-wrap,
      body.game-debug-hidden .hud-build,
      body.game-debug-hidden .hud-capbadge,
      body.game-debug-hidden [data-crt-guest-panel-host],
      body.game-debug-hidden [data-render-quality-panel-host],
      body.game-debug-hidden [data-skateboard-panel-host],
      body.game-debug-hidden [data-spin-panel-host],
      body.game-debug-hidden visual-treatment-panel,
      body.game-debug-hidden .ed-panel,
      body.game-debug-hidden .ed-popwrap,
      body.game-debug-hidden .ed-marquee,
      body.game-debug-hidden .ast-root,
      body.game-debug-hidden .clab,
      body.game-debug-hidden .pst { display: none !important; }
      @media (hover: hover) {
        .game-menu-button:hover:not(:disabled) { color: #f05a20; transform: scale(1.05) rotate(-.7deg); }
      }
      @media (pointer: coarse) {
        .game-shell { cursor: auto; }
        .game-menu-button { cursor: pointer; min-height: 56px; }
        .game-cartoon-cursor { display: none; }
      }
      @media (max-width: 760px), (max-height: 560px) {
        .game-shell-panel { overflow-y: auto; place-items: start center; }
        .game-launch-card { margin: auto; }
        .game-pause-layout { height: auto; grid-template-columns: 1fr; grid-template-rows: auto; gap: 14px; }
        .game-pause-preview { width: min(92vw, 520px); box-sizing: border-box; }
        .game-pause-actions { width: min(92vw, 520px); box-sizing: border-box; }
        .game-progress-card { grid-column: 1; width: min(92vw, 520px); box-sizing: border-box; }
        .game-progress-grid { grid-template-columns: 1fr 1fr; }
        .game-over-copy { grid-template-columns: 1fr; place-items: center; bottom: 3vh; }
        .game-over-question { text-align: center; }
        .game-over-actions { flex-direction: row; min-width: min(330px, 80vw); }
        .game-over-actions .game-menu-button { flex: 1; }
        .game-screen-results { place-items: end center; padding-bottom: 3vh; background: linear-gradient(180deg, transparent 0 30%, rgba(3,5,10,.88) 100%); }
        .game-results-card { width: min(88vw, 540px); min-width: 0; margin: 0; padding: 19px 24px 22px; }
        .game-results-awards { margin: 8px 0; }
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
        .game-menu-button, .game-menu-button::before, .game-transition-curtain, .game-shell-panel { transition-duration: .01ms !important; }
      }
    `;
    document.head.appendChild(style);
  }
}
