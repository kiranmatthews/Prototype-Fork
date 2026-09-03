// DOM overlay: Crash-style game HUD (counters that pop, THPS trick plate),
// plus the debug/menu and tuning panels tucked into collapsible side tabs.

import * as THREE from "three";
import {
  GameHudSurface,
  type GameHudBoostState,
  type GameHudSpecialState,
  type GameHudSurfaceDiagnostics,
} from "./gameHudSurface";
import { COMBO_GEM_TINT, Level, levelList } from "./level";
import { RooLabel, ROO_HUD, ROO_TT } from "./rootext";
import { wumpaMesh } from "./wumpa";
import {
  COMBO_CASH_IN_EXTRA_HOLD_MS,
  SOURCE_HUD_TRACKING,
  advanceComboCashInDisplay,
  advanceLiveComboTicker,
  advanceSourceComboTicker,
  comboCashInIsHolding,
  createLiveComboTicker,
  sourceComboPurseTarget,
  sourceLiveComboText,
  type ComboHudPreview,
} from "./comboHud";
import {
  TUNING,
  TUNING_RANGES,
  TUNING_INFO,
  TUNING_SECTIONS,
  TUNING_VERSION,
  TuningKey,
} from "./tuning";
import { migrateLegacySavedCarveGrip } from "./carveGrip";
import {
  HudVisibilityState,
  type HudVisibility,
} from "./hudVisibility";

// Real artwork, not shapes drawn in code — so these go through BASE_URL, the
// same as the sky paintings, or they 404 on the project-path GitHub Pages build.
// Baked from the 1024px originals in art/ by tools/bake-hudicons.mjs.
const art = (f: string): string => `url("${import.meta.env.BASE_URL}${f}")`;
const LIFE_FACE_URL = art("roo.png");

// Scratch for the 3D icon pass, so a per-frame draw allocates nothing.
const ICON_SIZE = new THREE.Vector2();
const ICON_PREV = new THREE.Vector4();
/** iconSlots order: crate, wumpa, then the three relics. */
const RELIC_SLOT_0 = 2;

export interface Stats {
  speed: number;
  state: string;
  grounded: boolean;
  vVel: number;
  surface: string;
  controller: string;
  jump: string;
  bail: string;
  railDist: number;
  crates: string;
  fruit: number;
  masks: string;
  time: number;
}

export interface HudState {
  points: number;
  comboPoints: number;
  comboMult: number;
  comboHasTrick: boolean;
  tricks: string;
  comboActionRevision: number;
  comboPreview: ComboHudPreview | null;
  specialMeter: number;
  specialReady: boolean;
  fruit: number;
  fruitCollectionRevision: number;
  lives: number;
  deaths: number;
  endlessDeaths: boolean;
  cratesBroken: number;
  cratesTotal: number;
  hasCrystal: boolean;
  hasGem: boolean;
  hasComboGem: boolean;
  inventoryHeld: boolean;
  bonusMode: boolean;
}

declare const __BUILD_TAG__: string; // injected by vite.config define
declare const __BUILD_CHANNEL__: string; // identifies the experiment fork

export class UI {
  private gameHudLayer: HTMLElement;
  private gameHudSurface!: GameHudSurface;
  private statsEl: HTMLElement;
  private msgTitle: HTMLElement;
  private msgSub: HTMLElement;
  private msgWrap: HTMLElement;
  private flashEl: HTMLElement;
  private fadeEl: HTMLElement;
  private fadeTimer: number | null = null;
  private wumpaRowEl!: HTMLElement; // hidden during time trials
  private crateRowEl!: HTMLElement;
  private relicRowEl!: HTMLElement;
  private livesRowEl!: HTMLElement;
  private lifeFaceEl!: HTMLElement;
  private deathModeLabelEl!: HTMLElement;
  private runRowsHidden = false;
  private endlessDeaths = false;
  private ttClockEl!: HTMLElement; // the big trial clock, top center
  private ttFreezeEl!: HTMLElement;
  private ttResultsEl!: HTMLElement;
  private ttOn = false;
  private haloEl!: HTMLElement; // combo-run green viewport halo
  private comboGemIcon!: HTMLElement;
  private crateIcon!: HTMLElement;
  private wumpaIcon!: HTMLElement;
  // Every 3D HUD icon lives in ONE scene with ONE camera; each is drawn into
  // its own host element's rectangle, one slot visible at a time. See
  // buildIcons/drawIcons.
  private iconScene: THREE.Scene | null = null;
  private iconCam: THREE.OrthographicCamera | null = null;
  private iconSlots: {
    host: HTMLElement; // the DOM box this is drawn into
    pivot: THREE.Group; // holds the lean; scaled to fit the box
    spin: THREE.Group; // turns
    unit: number; // art height in world units, for the fit
    rate: number; // idle turn, rad/s
    on: boolean; // relics are off until earned; the counters are always on
  }[] = [];
  private boostRingWrap!: HTMLElement; // balance-boost ring: laps over itself as windows stack
  private boostRing!: HTMLElement;
  private boostFrame: GameHudBoostState | null = null;
  private specialWrap!: HTMLElement;
  private specialFill!: HTMLElement;
  private bonusTitleEl!: HTMLElement;
  private comboStack!: HTMLElement;
  private specialFrame: GameHudSpecialState | null = null;
  private specialWasReady = false;
  private balanceWrap: HTMLElement;
  private balanceNeedle: HTMLElement;
  private vBalanceWrap!: HTMLElement;
  private vBalanceNeedle!: HTMLElement;
  private deathEl!: HTMLElement;
  // game HUD elements
  private scoreEl!: HTMLElement;
  private cratesEl!: HTMLElement;
  private cratesCurrentEl!: HTMLElement;
  private cratesTotalEl!: HTMLElement;
  private wumpaEl!: HTMLElement;
  private livesEl!: HTMLElement;
  // Roo display text. The counters and the score wear the ORANGE treatment;
  // everything the time trial owns wears the GREEN->BLUE one, so a glance at
  // the top of the screen says which mode you are in before you read a digit.
  private rooScore!: RooLabel;
  private rooCratesCurrent!: RooLabel;
  private rooCratesTotal!: RooLabel;
  private rooWumpa!: RooLabel;
  private rooLives!: RooLabel;
  private rooTTTime!: RooLabel;
  private rooTTBest!: RooLabel;
  private rooTTFreeze!: RooLabel;
  private rooTTResTitle!: RooLabel;
  private rooMsgTitle!: RooLabel;
  private rooBonusTitle!: RooLabel;
  private scoreLabelEl!: HTMLElement;
  private scorePlateEl!: HTMLElement;
  private boostLabelEl!: HTMLElement;
  private deathTitleEl!: HTMLElement;
  private deathSubEl!: HTMLElement;
  private ttTimeEl!: HTMLElement;
  private ttResTitleEl!: HTMLElement;
  private ttResTimeEl!: HTMLElement;
  private ttResListEl!: HTMLElement;
  private ttResSubEl!: HTMLElement;
  private trickPlate!: HTMLElement;
  private trickLineEl!: HTMLElement;
  private trickTotalEl!: HTMLElement;
  private crystalIcon!: HTMLElement;
  private gemIcon!: HTMLElement;
  private prevHud = {
    points: -1,
    fruit: -1,
    lives: -1,
    crates: "",
    crystal: false,
    gem: false,
    comboGem: false,
  };
  private hudVisibility = new HudVisibilityState();
  private hudVisibilityFrame: HudVisibility = {
    showLife: true,
    showBonusTitle: false,
    showFruit: false,
    showBoxes: false,
    showEarnedRelics: false,
  };
  private bonusMode = false;
  // Score cash-in keeps the arcade chase; live timed combo awards use a
  // constant-rate buffer so quarter-second gameplay packets read continuously.
  private dispScore = 0;
  private dispCombo = 0;
  private liveComboTicker = createLiveComboTicker();
  private comboState: "none" | "active" | "cashin" | "bail" = "none";
  private comboBailEnd = 0; // performance.now() timestamp the bail drop finishes
  private comboCashInHoldEnd = 0;
  private comboCashInWasHolding = false;
  private lastComboActionRevision = -1;
  private lastComboPreviewSequence = -1;
  private msgTimer: number | undefined;
  private messageState: {
    title: string;
    sub: string;
    expiresAt: number | null;
  } | null = null;
  private levelRowEl!: HTMLElement; // the re-rendered list container
  private levelRows = new Map<string, HTMLButtonElement>(); // id -> PLAY button
  private currentLevelId = ""; // survives a re-render so .active can be restored
  private sliderEls = new Map<
    TuningKey,
    { input: HTMLInputElement; value: HTMLInputElement; sync?: () => void }
  >();
  // Bookmarked slider names (green) — persisted attention markers, no effect.
  private tunerMarks = new Set<string>(
    JSON.parse(localStorage.getItem("solProtoTunerMarks") ?? "[]") as string[],
  );
  // Build defaults, captured before any saved tuning is applied — so a new
  // build's numbers are always recoverable under the "defaults" button.
  private defaults = { ...TUNING };

  // wired up by main.ts
  onLevelSelect: (id: string) => void = () => {};
  onLifeCheat: () => void = () => {};
  onSaveReplay: (() => void) | null = null;
  onToggleVideo: (() => void) | null = null;
  onLoadReplay: ((text: string) => void) | null = null;
  onToggle2P: (() => void) | null = null;
  onToggleRunModes: (() => void) | null = null;
  onToggleEndlessDeaths: (() => void) | null = null;
  // level-list verbs (main.ts wires these)
  onLevelEdit: ((id: string) => void) | null = null;
  onLevelNew: (() => void) | null = null;
  onLevelImport: ((text: string, filename: string) => void) | null = null;
  // phone sync (main.ts wires these)
  onUnlockEditing: ((pass: string) => Promise<boolean>) | null = null;
  onSyncPush: (() => Promise<void>) | null = null;
  onTokenSet: ((token: string) => void) | null = null;
  provideEditState:
    | (() => {
        unlocked: boolean;
        hasToken: boolean;
        userCount: number;
      })
    | null = null;
  // fired when a side tab (MENU / TUNER) is clicked, BEFORE the panel
  // toggles — main.ts uses it to close the editor so the panel isn't a
  // hidden husk while the tools own the screen
  onSideTab: ((side: "left" | "right") => void) | null = null;
  // fired by the ungated RE-SYNC button: re-read the published levels and
  // throw away whatever this device had saved
  onForceResync: (() => Promise<void>) | null = null;
  private recBtn!: HTMLButtonElement;
  private presentationToolsHead!: HTMLElement;
  private presentationToolsRow!: HTMLElement;
  private rightSideWrap!: HTMLElement;
  private mpBtn!: HTMLButtonElement; // 2-player split toggle
  private runBtn!: HTMLButtonElement; // time trial + combo run toggle
  private endlessBtn!: HTMLButtonElement; // selectable standard-run death rule
  private syncPanel!: HTMLElement;
  private unlockRow!: HTMLElement;
  private tokenRow!: HTMLElement;
  private pushRow!: HTMLElement;
  private syncStatusEl!: HTMLElement;
  private editUnlocked = false;
  private replayBadge!: HTMLElement;
  private recBadge!: HTMLElement;

  constructor() {
    this.injectStyle();

    // ---- LEFT side panel (level menu + debug), behind a collapsible tab ----
    const statsWrap = div("hud-stats");

    // LEVEL LIST. Re-rendered (not built once) because the list grows at
    // runtime: NEW, IMPORT, editing a built-in copy, and RESTORE FROM CLOUD
    // all change it. Each row is PLAY + ✎ EDIT — every level is editable, and
    // editing a built-in forks a copy rather than touching the original.
    const levelRow = div("hud-levelrow");
    statsWrap.appendChild(levelRow);
    this.levelRowEl = levelRow;

    // NEW / IMPORT sit under the list: the two ways a row gets added by hand.
    const actions = div("hud-levelactions");
    const mkAction = (
      label: string,
      title: string,
      fn: () => void,
    ): HTMLButtonElement => {
      const b = document.createElement("button");
      b.className = "hud-levelbtn hud-leveledit";
      b.textContent = label;
      b.title = title;
      b.addEventListener("click", () => {
        fn();
        b.blur();
      });
      actions.appendChild(b);
      return b;
    };
    mkAction("+ NEW LEVEL", "start a blank level and open the editor", () => {
      if (this.onLevelNew) this.onLevelNew();
    });
    const lvlPick = document.createElement("input");
    lvlPick.type = "file";
    lvlPick.accept = ".json,application/json";
    lvlPick.style.display = "none";
    lvlPick.addEventListener("change", () => {
      const f = lvlPick.files?.[0];
      if (f)
        void f.text().then((txt) => {
          if (this.onLevelImport) this.onLevelImport(txt, f.name);
        });
      lvlPick.value = ""; // same file twice in a row still fires
    });
    actions.appendChild(lvlPick);
    mkAction("⤓ IMPORT LEVEL", "add a downloaded level file to this menu", () =>
      lvlPick.click(),
    );
    statsWrap.appendChild(actions);
    this.renderLevels();

    // 2-PLAYER SPLIT SCREEN (playtest sandbox): needs two connected pads.
    const mpBtn = document.createElement("button");
    mpBtn.className = "hud-levelbtn hud-editbtn";
    mpBtn.textContent = "⚔ 2-PLAYER SPLIT: OFF";
    mpBtn.title = "local split-screen — requires 2 controllers";
    mpBtn.addEventListener("click", () => {
      if (this.onToggle2P) this.onToggle2P();
      mpBtn.blur();
    });
    statsWrap.appendChild(mpBtn);
    this.mpBtn = mpBtn;

    // RUN MODES (playtest): the trial stopwatch and the combo orb sit near
    // every spawn and start their mode the moment you walk into one, which is
    // exactly wrong when you are testing plain platforming. Off hides both and
    // cancels anything already running; the setting sticks across reloads.
    const runBtn = document.createElement("button");
    runBtn.className = "hud-levelbtn hud-editbtn";
    runBtn.title = "hide the trial stopwatch and the combo orb";
    runBtn.addEventListener("click", () => {
      if (this.onToggleRunModes) this.onToggleRunModes();
      runBtn.blur();
    });
    statsWrap.appendChild(runBtn);
    this.runBtn = runBtn;
    this.setRunModes(true);

    // STANDARD-RUN RULE: classic lives remains the default. Endless Deaths is
    // an explicit, persisted selection: Wumpa pays score immediately, deaths
    // halve score and increment the HUD counter, and game-over is disabled.
    const endlessBtn = document.createElement("button");
    endlessBtn.className = "hud-levelbtn hud-editbtn";
    endlessBtn.title = "switch standard play between classic lives and endless deaths";
    endlessBtn.addEventListener("click", () => {
      if (this.onToggleEndlessDeaths) this.onToggleEndlessDeaths();
      endlessBtn.blur();
    });
    statsWrap.appendChild(endlessBtn);
    this.endlessBtn = endlessBtn;
    this.setEndlessDeaths(false);

    // RESTORE FROM CLOUD (deliberately NOT behind the passcode — the phone is
    // the device that needs it and is never unlocked). Replaces this device's
    // whole level list with the published one: the setup tap for a new phone,
    // and the escape hatch for a device that has drifted. Two taps, because it
    // discards local levels and a fat-fingered scroll must not be enough.
    const RESYNC_LABEL = "⟲ RESTORE LEVELS FROM CLOUD";
    const resyncBtn = document.createElement("button");
    resyncBtn.className = "hud-levelbtn hud-editbtn";
    resyncBtn.textContent = RESYNC_LABEL;
    resyncBtn.title = "replace this device's levels with the published ones";
    let armed = 0; // pending confirm timer; 0 = not armed
    const disarm = (): void => {
      if (armed) clearTimeout(armed);
      armed = 0;
      resyncBtn.textContent = RESYNC_LABEL;
      resyncBtn.style.color = "";
    };
    resyncBtn.addEventListener("click", () => {
      resyncBtn.blur();
      if (!this.onForceResync) return;
      if (!armed) {
        resyncBtn.textContent = "⟲ TAP AGAIN — REPLACES YOUR LEVELS";
        resyncBtn.style.color = "#ffd23f";
        armed = window.setTimeout(disarm, 4000);
        return;
      }
      disarm();
      resyncBtn.disabled = true;
      resyncBtn.textContent = "⟲ RESTORING…";
      void this.onForceResync().finally(() => {
        resyncBtn.disabled = false;
        resyncBtn.textContent = RESYNC_LABEL;
      });
    });
    statsWrap.appendChild(resyncBtn);

    // UNLOCK / SYNC panel: a passcode row that expands into the phone-sync
    // controls (GitHub token + push button + status) once unlocked.
    const sync = div("hud-sync");
    const unlockRow = div("hud-syncrow");
    const passIn = document.createElement("input");
    passIn.type = "password";
    passIn.className = "hud-syncinput";
    passIn.placeholder = "passcode to unlock direct editing";
    const unlockBtn = document.createElement("button");
    unlockBtn.className = "hud-syncbtn";
    unlockBtn.textContent = "unlock";
    const tryUnlock = async (): Promise<void> => {
      if (!this.onUnlockEditing) return;
      const ok = await this.onUnlockEditing(passIn.value);
      passIn.value = "";
      if (!ok) this.setSyncStatus("wrong passcode", "err");
    };
    unlockBtn.addEventListener("click", () => void tryUnlock());
    passIn.addEventListener("keydown", (e) => {
      if (e.key === "Enter") void tryUnlock();
      e.stopPropagation(); // don't let level hotkeys eat the typing
    });
    unlockRow.appendChild(passIn);
    unlockRow.appendChild(unlockBtn);
    sync.appendChild(unlockRow);
    this.unlockRow = unlockRow;

    // token + push (shown only when unlocked)
    const tokenRow = div("hud-syncrow hud-synctoken");
    const tokIn = document.createElement("input");
    tokIn.type = "password";
    tokIn.className = "hud-syncinput";
    tokIn.placeholder = "GitHub token (Contents: write)";
    tokIn.addEventListener("keydown", (e) => e.stopPropagation());
    const tokBtn = document.createElement("button");
    tokBtn.className = "hud-syncbtn";
    tokBtn.textContent = "save";
    tokBtn.addEventListener("click", () => {
      if (this.onTokenSet) this.onTokenSet(tokIn.value);
      tokIn.value = "";
    });
    tokenRow.appendChild(tokIn);
    tokenRow.appendChild(tokBtn);
    sync.appendChild(tokenRow);
    this.tokenRow = tokenRow;

    const pushRow = div("hud-syncrow hud-syncpush");
    const pushBtn = document.createElement("button");
    pushBtn.className = "hud-syncbtn hud-syncpushbtn";
    pushBtn.textContent = "☁ SYNC MY LEVELS UP";
    pushBtn.addEventListener("click", () => {
      if (this.onSyncPush) void this.onSyncPush();
      pushBtn.blur();
    });
    pushRow.appendChild(pushBtn);
    sync.appendChild(pushRow);
    this.pushRow = pushRow;

    const status = div("hud-syncstatus");
    sync.appendChild(status);
    this.syncStatusEl = status;
    statsWrap.appendChild(sync);
    this.syncPanel = sync;

    const stats = div("hud-statlines");
    statsWrap.appendChild(stats);
    this.statsEl = stats;

    // ---- RIGHT side panel (tuning sliders) ----
    // Apply any saved tuning BEFORE building the sliders, so they show it.
    const saved = this.readSaved();
    if (saved) this.applyTuning(saved);

    const panel = div("hud-tuning");
    panel.innerHTML = '<div class="hud-title">TUNING</div>';
    // save = snapshot to this browser (survives new builds); reset = back to
    // that snapshot; defaults = forget the snapshot, use the build's numbers.
    const btnRow = div("hud-tunebtns");
    const mkBtn = (label: string, fn: () => void): void => {
      const b = document.createElement("button");
      b.className = "hud-levelbtn";
      b.textContent = label;
      b.addEventListener("click", () => {
        fn();
        b.blur();
      });
      btnRow.appendChild(b);
    };
    mkBtn("save", () => {
      // store the defaults alongside, so a future build can tell which keys
      // were DELIBERATE tweaks (only those survive across default changes)
      localStorage.setItem(
        "solProtoTuning",
        JSON.stringify({
          __v: TUNING_VERSION,
          tuning: TUNING,
          defaults: this.defaults,
        }),
      );
      this.showMessage("TUNING SAVED", "", 800);
    });
    mkBtn("reset", () => {
      this.applyTuning(this.readSaved() ?? this.defaults);
      this.showMessage("TUNING RESET", "", 800);
    });
    mkBtn("defaults", () => {
      localStorage.removeItem("solProtoTuning");
      this.applyTuning(this.defaults);
      this.showMessage("BUILD DEFAULTS", "", 800);
    });
    // Export the live values: paste the JSON into chat and they can be baked
    // in as the next build's defaults.
    mkBtn("copy", () => {
      const json = JSON.stringify(TUNING, null, 1);
      const done = (): void =>
        this.showMessage("TUNING COPIED", "paste it into the chat", 1600);
      if (navigator.clipboard && navigator.clipboard.writeText) {
        navigator.clipboard
          .writeText(json)
          .then(done, () => window.prompt("copy your tuning:", json));
      } else {
        window.prompt("copy your tuning:", json);
      }
    });
    panel.appendChild(btnRow);
    // ---- playtest capture: input replays + gameplay video ----
    // 'save replay' downloads the input take since the last level load as a
    // .json (F8). 'load replay' / dragging the file onto the game plays it
    // back. 'rec video' toggles a .webm recording of the canvas (F9).
    const capRow = div("hud-tunebtns");
    const mkCapBtn = (label: string, fn: () => void): HTMLButtonElement => {
      const b = document.createElement("button");
      b.className = "hud-levelbtn";
      b.textContent = label;
      b.addEventListener("click", () => {
        fn();
        b.blur();
      });
      capRow.appendChild(b);
      return b;
    };
    mkCapBtn("save replay", () => this.onSaveReplay && this.onSaveReplay());
    const filePick = document.createElement("input");
    filePick.type = "file";
    filePick.accept = ".json,application/json";
    filePick.style.display = "none";
    filePick.addEventListener("change", () => {
      const f = filePick.files && filePick.files[0];
      if (f)
        f.text().then((txt) => this.onLoadReplay && this.onLoadReplay(txt));
      filePick.value = "";
    });
    capRow.appendChild(filePick);
    mkCapBtn("load replay", () => filePick.click());
    this.recBtn = mkCapBtn(
      "rec video",
      () => this.onToggleVideo && this.onToggleVideo(),
    );
    panel.appendChild(capRow);
    this.presentationToolsHead = div("hud-secttitle");
    this.presentationToolsHead.textContent = "PRESENTATION TOOLS";
    this.presentationToolsHead.style.display = "none";
    panel.appendChild(this.presentationToolsHead);
    this.presentationToolsRow = div("hud-tunebtns hud-presentation-tools");
    this.presentationToolsRow.style.display = "none";
    panel.appendChild(this.presentationToolsRow);
    // Sliders grouped under labelled section headers (walking, skating, ...).
    const placed = new Set<TuningKey>();
    const addSection = (title: string, keys: TuningKey[]): void => {
      if (keys.length === 0) return;
      const head = div("hud-secttitle");
      head.textContent = title;
      panel.appendChild(head);
      for (const key of keys) {
        panel.appendChild(this.sliderRow(key));
        placed.add(key);
      }
    };
    for (const sect of TUNING_SECTIONS) {
      addSection(
        sect.title,
        sect.keys.filter((k) => TUNING_RANGES[k] !== undefined),
      );
    }
    // Anything new that hasn't been assigned a section yet still shows up.
    const leftovers = (Object.keys(TUNING_RANGES) as TuningKey[]).filter(
      (k) => !placed.has(k),
    );
    addSection("OTHER", leftovers);

    document.body.appendChild(this.sidePanel("left", "MENU", statsWrap));
    this.rightSideWrap = this.sidePanel("right", "TUNER", panel);
    document.body.appendChild(this.rightSideWrap);

    // Game-owned presentation has one explicit root so it can be mirrored
    // into the pre-CRT WebGL surface without also capturing MENU, TUNER, the
    // editor, touch controls or presentation/debug panels. Opacity is applied
    // to this parent only; descendants keep their live layout and animation
    // state for the native HUD renderer to read.
    this.gameHudLayer = div("game-hud-layer");
    document.body.appendChild(this.gameHudLayer);

    // ---- center messages / flash ----
    this.msgWrap = div("hud-msg");
    this.msgTitle = div("hud-msg-title");
    this.msgSub = div("hud-msg-sub");
    this.msgWrap.appendChild(this.msgTitle);
    this.msgWrap.appendChild(this.msgSub);
    this.msgWrap.style.display = "none";
    this.flashEl = div("hud-flash");
    this.fadeEl = div("hud-fade"); // death blackout curtain
    this.haloEl = div("hud-halo"); // combo-run green edge glow

    // Build stamp: baked at compile time. If a playtest doesn't show a
    // change, check this first — it answers "which build am I running?".
    const stamp = div("hud-build");
    stamp.textContent = `${__BUILD_CHANNEL__} · build ${__BUILD_TAG__}`;
    document.body.appendChild(stamp);

    // ---- game HUD: contextual Crash counters + THPS trick plate ----
    // top-left: fruit pickup pop-up and L2 inventory
    // The crate and the fruit are 3D, drawn into these boxes by drawIcons —
    // the divs are empty and exist only to be measured and laid out.
    const tl = div("hud-tl");
    const crateRow = div("hud-counter hud-crate-row");
    this.crateRowEl = crateRow;
    this.crateIcon = div("hud-icon hud-icon-crate");
    crateRow.appendChild(this.crateIcon);
    this.cratesEl = div("hud-num hud-box-count");
    this.cratesCurrentEl = div("hud-box-current");
    this.cratesTotalEl = div("hud-box-total");
    this.cratesEl.appendChild(this.cratesCurrentEl);
    this.cratesEl.appendChild(this.cratesTotalEl);
    crateRow.appendChild(this.cratesEl);
    crateRow.style.display = "none";
    const wumpaRow = div("hud-counter hud-fruit-row");
    this.wumpaIcon = div("hud-icon hud-icon-wumpa");
    wumpaRow.appendChild(this.wumpaIcon);
    this.wumpaEl = div("hud-num");
    wumpaRow.appendChild(this.wumpaEl);
    this.wumpaRowEl = wumpaRow;
    wumpaRow.style.display = "none";
    tl.appendChild(crateRow);
    tl.appendChild(wumpaRow);
    // Earned-only relic haul: crystal, gem, combo gem. Unearned hosts have no
    // layout or silhouette; an earned host becomes the measured viewport for
    // its real spinning 3D relic (see drawIcons).
    const relicRow = div("hud-counter hud-relics");
    this.relicRowEl = relicRow;
    this.crystalIcon = div("hud-icon hud-icon-crystal hud-relic-off");
    this.gemIcon = div("hud-icon hud-icon-gem hud-relic-off");
    this.comboGemIcon = div(
      "hud-icon hud-icon-gem hud-icon-combogem hud-relic-off",
    );
    relicRow.appendChild(this.crystalIcon);
    relicRow.appendChild(this.gemIcon);
    relicRow.appendChild(this.comboGemIcon);
    relicRow.style.display = "none";
    this.crystalIcon.style.display = "none";
    this.gemIcon.style.display = "none";
    this.comboGemIcon.style.display = "none";
    tl.appendChild(relicRow);

    this.bonusTitleEl = div("hud-bonus-title");
    this.bonusTitleEl.style.display = "none";

    // Bottom-right life portrait; the Special ring shares its exact anchor.
    // The top-right column is reserved for explicit run-mode clock/score UI.
    const tr = div("hud-tr");
    const livesRow = div("hud-counter hud-life-row");
    const lifeFaceWrap = div("hud-life-face-wrap");
    this.lifeFaceEl = div("hud-icon hud-icon-face");
    lifeFaceWrap.appendChild(this.lifeFaceEl);
    this.livesEl = div("hud-num hud-lives");
    livesRow.appendChild(this.livesEl);
    livesRow.appendChild(lifeFaceWrap);
    this.deathModeLabelEl = div("hud-deathcount-label");
    this.deathModeLabelEl.textContent = "DEATHS";
    this.deathModeLabelEl.style.display = "none";
    livesRow.insertBefore(this.deathModeLabelEl, this.livesEl);
    this.livesRowEl = livesRow;

    // TIME TRIAL: the big clock and its score share the explicit run-mode
    // column. Ordinary and Bonus play leave this column empty.
    this.ttClockEl = div("hud-ttclock");
    this.ttTimeEl = div("hud-tttime");
    this.ttClockEl.appendChild(this.ttTimeEl);
    this.ttFreezeEl = div("hud-ttfreeze");
    this.ttClockEl.appendChild(this.ttFreezeEl);
    this.ttClockEl.style.display = "none";
    tr.appendChild(this.ttClockEl);

    const scorePlate = div("hud-scoreplate");
    this.scorePlateEl = scorePlate;
    const scoreLabel = div("hud-scorelabel");
    this.scoreLabelEl = scoreLabel;
    this.scoreEl = div("hud-scorenum");
    scorePlate.appendChild(scoreLabel);
    scorePlate.appendChild(this.scoreEl);
    scorePlate.style.display = "none";
    tr.appendChild(scorePlate);

    // Results card: the headline time is a Roo label that lives across runs,
    // so only the rows around it are rewritten (the label owns its own SVG
    // and must not be blown away by an innerHTML pass).
    this.ttResultsEl = div("hud-ttresults");
    this.ttResTitleEl = div("hud-ttres-title");
    this.ttResTimeEl = div("hud-ttres-time");
    this.ttResListEl = div("hud-ttres-list");
    const ttResSub = div("hud-ttres-sub");
    ttResSub.textContent = "press R / Options to go again";
    this.ttResSubEl = ttResSub;
    this.ttResultsEl.appendChild(this.ttResTitleEl);
    this.ttResultsEl.appendChild(this.ttResTimeEl);
    this.ttResultsEl.appendChild(this.ttResListEl);
    this.ttResultsEl.appendChild(ttResSub);
    this.ttResultsEl.style.display = "none";

    // balance-boost ring: a green radial meter that laps over itself as
    // crate windows stack
    const boosts = div("hud-boosts");
    this.boostRing = div("hud-boostring");
    boosts.appendChild(this.boostRing);
    const boostLab = div("hud-boostlabel");
    this.boostLabelEl = boostLab;
    boosts.appendChild(boostLab);
    boosts.style.display = "none";
    this.boostRingWrap = boosts;
    // Debug cheat: clicking the face banks an extra life. The HUD layer is
    // pointer-transparent, so this row opts back in.
    livesRow.style.cursor = "pointer";
    livesRow.style.pointerEvents = "auto";
    livesRow.title = "click: +1 life";
    livesRow.addEventListener("click", () => {
      this.onLifeCheat();
    });

    // Textless radial SPECIAL meter. It is physically nested with the life
    // portrait so DOM and pre-CRT paths share one exact anchor.
    this.specialWrap = div("hud-special");
    this.specialWrap.setAttribute("role", "meter");
    this.specialWrap.setAttribute("aria-label", "Special meter");
    this.specialWrap.setAttribute("aria-valuemin", "0");
    this.specialWrap.setAttribute("aria-valuemax", "100");
    const specialTrack = div("hud-special-track");
    this.specialFill = div("hud-special-fill");
    specialTrack.appendChild(this.specialFill);
    this.specialWrap.appendChild(specialTrack);
    lifeFaceWrap.insertBefore(this.specialWrap, this.lifeFaceEl);

    // bottom-center: THPS trick plate
    this.trickPlate = div("hud-trickplate");
    this.trickLineEl = div("hud-trickline");
    this.trickTotalEl = div("hud-tricktotal");
    this.trickPlate.appendChild(this.trickLineEl);
    this.trickPlate.appendChild(this.trickTotalEl);
    this.trickPlate.style.display = "none";
    this.comboStack = div("hud-combostack");
    this.comboStack.appendChild(boosts);
    this.comboStack.appendChild(this.trickPlate);

    // black game-over screen: any button restarts
    this.deathEl = div("hud-death");
    const deathTitle = div("hud-death-title");
    this.deathTitleEl = deathTitle;
    const deathSub = div("hud-death-sub");
    deathSub.textContent = "press any button";
    this.deathSubEl = deathSub;
    this.deathEl.appendChild(deathTitle);
    this.deathEl.appendChild(deathSub);
    this.deathEl.style.display = "none";

    // THPS-style grind balance meter (visible only while grinding).
    this.balanceWrap = div("hud-balance");
    this.balanceNeedle = div("hud-balance-needle");
    const balanceCenter = div("hud-balance-center");
    this.balanceWrap.appendChild(balanceCenter);
    this.balanceWrap.appendChild(this.balanceNeedle);
    this.balanceWrap.style.display = "none";

    // VERTICAL balance meter for MANUALS: up/down on the stick fights the
    // needle (nose at the top, tail at the bottom); left/right stays steering.
    this.vBalanceWrap = div("hud-vbalance");
    this.vBalanceNeedle = div("hud-vbalance-needle");
    const vCenter = div("hud-vbalance-center");
    const noseTick = div("hud-vbalance-cap");
    noseTick.style.top = "2px";
    const tailTick = div("hud-vbalance-cap");
    tailTick.style.bottom = "2px";
    this.vBalanceWrap.appendChild(vCenter);
    this.vBalanceWrap.appendChild(noseTick);
    this.vBalanceWrap.appendChild(tailTick);
    this.vBalanceWrap.appendChild(this.vBalanceNeedle);
    this.vBalanceWrap.style.display = "none";

    // Playtest capture badges: ▶ REPLAY while a take plays back, ● REC while
    // the canvas is being recorded to video.
    this.replayBadge = div("hud-capbadge");
    this.replayBadge.textContent = "▶ REPLAY";
    this.replayBadge.style.display = "none";
    this.recBadge = div("hud-capbadge hud-recbadge");
    this.recBadge.textContent = "● REC";
    this.recBadge.style.display = "none";

    for (const el of [
      this.msgWrap,
      this.flashEl,
      this.fadeEl,
      this.haloEl,
      this.bonusTitleEl,
      tl,
      tr,
      livesRow,
      this.ttResultsEl,
      this.comboStack,
      this.balanceWrap,
      this.vBalanceWrap,
      this.deathEl,
    ]) {
      this.gameHudLayer.appendChild(el);
    }
    // Capture/playtest instrumentation is developer chrome, not game HUD. It
    // intentionally remains razor-sharp above the processed canvas.
    document.body.appendChild(this.replayBadge);
    document.body.appendChild(this.recBadge);

    // Roo display text, built once the boxes are in the document (the
    // renderer measures a real bounding box, so the hosts have to be live).
    // The counters read ORANGE; the trial clock and its result time read
    // GREEN->BLUE.
    this.rooCratesCurrent = new RooLabel(this.cratesCurrentEl, { palette: ROO_HUD, tracking: SOURCE_HUD_TRACKING.largeNumber });
    this.rooCratesTotal = new RooLabel(this.cratesTotalEl, { palette: ROO_HUD, tracking: SOURCE_HUD_TRACKING.largeNumber });
    this.rooWumpa = new RooLabel(this.wumpaEl, { palette: ROO_HUD, tracking: SOURCE_HUD_TRACKING.largeNumber });
    this.rooLives = new RooLabel(this.livesEl, { palette: ROO_HUD, tracking: SOURCE_HUD_TRACKING.largeNumber });
    this.rooScore = new RooLabel(this.scoreEl, { palette: ROO_HUD, tracking: SOURCE_HUD_TRACKING.largeNumber });
    this.rooTTTime = new RooLabel(this.ttTimeEl, {
      palette: ROO_TT,
      tracking: SOURCE_HUD_TRACKING.largeNumber,
    });
    this.rooTTBest = new RooLabel(this.ttResTimeEl, {
      palette: ROO_TT,
      tracking: SOURCE_HUD_TRACKING.largeNumber,
    });
    this.rooTTFreeze = new RooLabel(this.ttFreezeEl, { palette: ROO_TT });
    this.rooTTResTitle = new RooLabel(this.ttResTitleEl, { palette: ROO_TT });
    // Combo copy stays ordinary text. It can wrap naturally and the CRT pass
    // supplies enough character without a per-glyph SVG treatment.
    this.rooMsgTitle = new RooLabel(this.msgTitle, { palette: ROO_HUD });
    this.rooBonusTitle = new RooLabel(this.bonusTitleEl, { palette: ROO_HUD, extrusionSteps: 12 });
    // Fixed captions: set once, then they never change again.
    new RooLabel(this.scoreLabelEl, { palette: ROO_HUD }).set("SCORE");
    this.rooBonusTitle.set("BONUS");
    new RooLabel(this.boostLabelEl, { palette: ROO_HUD }).set("BALANCE");
    new RooLabel(this.deathTitleEl, { palette: ROO_HUD, extrusionSteps: 16 }).set(
      "GAME OVER",
    );

    this.gameHudSurface = new GameHudSurface({
      elements: {
        viewport: document.getElementById("app") ?? undefined,
        crateIcon: this.crateIcon,
        crateValue: this.cratesEl,
        crateCurrent: this.cratesCurrentEl,
        crateTotal: this.cratesTotalEl,
        fruitIcon: this.wumpaIcon,
        fruitValue: this.wumpaEl,
        crystalIcon: this.crystalIcon,
        gemIcon: this.gemIcon,
        comboGemIcon: this.comboGemIcon,
        lifeFace: this.lifeFaceEl,
        lifeValue: this.livesEl,
        deathModeLabel: this.deathModeLabelEl,
        scoreLabel: this.scoreLabelEl,
        scoreValue: this.scoreEl,
        timeTrialClock: this.ttClockEl,
        timeTrialValue: this.ttTimeEl,
        timeTrialFreeze: this.ttFreezeEl,
        special: this.specialWrap,
        specialTrack,
        specialFill: this.specialFill,
        bonusTitle: this.bonusTitleEl,
        results: this.ttResultsEl,
        resultsTitle: this.ttResTitleEl,
        resultsTime: this.ttResTimeEl,
        resultsList: this.ttResListEl,
        resultsSub: this.ttResSubEl,
        boost: this.boostRingWrap,
        boostRing: this.boostRing,
        boostLabel: this.boostLabelEl,
        trick: this.trickPlate,
        trickLine: this.trickLineEl,
        trickTotal: this.trickTotalEl,
        grindBalance: this.balanceWrap,
        grindNeedle: this.balanceNeedle,
        manualBalance: this.vBalanceWrap,
        manualNeedle: this.vBalanceNeedle,
        message: this.msgWrap,
        messageTitle: this.msgTitle,
        messageSub: this.msgSub,
        flash: this.flashEl,
        fade: this.fadeEl,
        halo: this.haloEl,
        death: this.deathEl,
        deathTitle: this.deathTitleEl,
        deathSub: this.deathSubEl,
      },
    });
  }

  /** Hide only the live DOM copy while its Canvas2D mirror is in WebGL. */
  setGameHudComposited(composited: boolean): void {
    this.gameHudLayer.classList.toggle("precrt-composited", composited);
    this.gameHudLayer.toggleAttribute("data-precrt-composited", composited);
  }

  /** Draw the complete gameplay HUD into the current pre-CRT colour target. */
  drawGameHud(
    renderer: THREE.WebGLRenderer,
    targetSize: { width: number; height: number },
    target: THREE.WebGLRenderTarget | null = renderer.getRenderTarget(),
  ): boolean {
    return this.gameHudSurface.render(
      renderer,
      targetSize,
      { boost: this.boostFrame, special: this.specialFrame },
      target,
    );
  }

  get gameHudDiagnostics(): GameHudSurfaceDiagnostics {
    return this.gameHudSurface.diagnostics;
  }

  setReplayBadge(on: boolean): void {
    this.replayBadge.style.display = on ? "block" : "none";
  }

  setRecBadge(on: boolean): void {
    this.recBadge.style.display = on ? "block" : "none";
    this.recBtn.textContent = on ? "stop + save" : "rec video";
  }

  setPresentationTools(
    tools: readonly { label: string; open: () => void }[],
  ): void {
    this.presentationToolsRow.replaceChildren();
    const visible = tools.length > 0;
    this.presentationToolsHead.style.display = visible ? "block" : "none";
    this.presentationToolsRow.style.display = visible ? "flex" : "none";
    for (const tool of tools) {
      const button = document.createElement("button");
      button.className = "hud-levelbtn";
      button.textContent = tool.label;
      button.addEventListener("click", () => {
        this.rightSideWrap.classList.add("collapsed");
        document.body.classList.remove("side-panel-right-open");
        localStorage.setItem("solProtoPanel_right", "closed");
        tool.open();
        button.blur();
      });
      this.presentationToolsRow.appendChild(button);
    }
  }

  // A fixed side wrapper with a vertical tab that slides the content off-screen.
  // Collapsed by default (game view); state persists per side.
  private sidePanel(
    side: "left" | "right",
    label: string,
    content: HTMLElement,
  ): HTMLElement {
    const wrap = div(`side-wrap ${side}`);
    const tab = document.createElement("button");
    tab.className = "side-tab";
    tab.textContent = label;
    const key = "solProtoPanel_" + side;
    if (localStorage.getItem(key) !== "open") wrap.classList.add("collapsed");
    document.body.classList.toggle(
      `side-panel-${side}-open`,
      !wrap.classList.contains("collapsed"),
    );
    tab.addEventListener("click", () => {
      if (this.onSideTab) this.onSideTab(side);
      wrap.classList.toggle("collapsed");
      document.body.classList.toggle(
        `side-panel-${side}-open`,
        !wrap.classList.contains("collapsed"),
      );
      localStorage.setItem(
        key,
        wrap.classList.contains("collapsed") ? "closed" : "open",
      );
      tab.blur();
    });
    if (side === "left") {
      wrap.appendChild(content);
      wrap.appendChild(tab);
    } else {
      wrap.appendChild(tab);
      wrap.appendChild(content);
    }
    return wrap;
  }

  showDeathScreen(visible: boolean): void {
    this.deathEl.style.display = visible ? "flex" : "none";
  }

  private startCombo(labels: string): void {
    this.comboState = "active";
    this.gameHudLayer.classList.add("hud-combo-present");
    this.trickPlate.style.display = "block";
    this.trickPlate.classList.remove("hud-trick-bail");
    this.trickLineEl.textContent = labels.toUpperCase();
  }

  private setComboTotal(value: string): void {
    this.trickTotalEl.textContent = value;
  }

  private snapLiveComboTicker(target: number): void {
    this.liveComboTicker = createLiveComboTicker(target);
    this.dispCombo = this.liveComboTicker.displayed;
  }

  private endCombo(): void {
    this.comboState = "none";
    this.gameHudLayer.classList.remove("hud-combo-present");
    this.trickPlate.style.display = "none";
    this.trickPlate.classList.remove("hud-trick-bail");
    this.dispCombo = 0;
    this.liveComboTicker = createLiveComboTicker();
    this.comboCashInHoldEnd = 0;
    this.comboCashInWasHolding = false;
  }

  // Combo landed clean: freeze the total on the plate and drain it to zero while
  // the score ticks up to match.
  comboBank(amount: number, labels: string): void {
    this.dispCombo = amount;
    this.liveComboTicker = createLiveComboTicker(amount);
    this.comboState = "cashin";
    this.gameHudLayer.classList.add("hud-combo-present");
    this.comboCashInHoldEnd = performance.now() + COMBO_CASH_IN_EXTRA_HOLD_MS;
    this.comboCashInWasHolding = false;
    this.trickPlate.style.display = "block";
    this.trickPlate.classList.remove("hud-trick-bail");
    this.trickLineEl.textContent = labels.toUpperCase();
    this.setComboTotal(String(Math.round(this.dispCombo)));
  }

  // Combo lost on a bail: keep the exact copy already on screen, turn it red,
  // and drop it away. The callback snapshot is only a same-step fallback for
  // a trick that scored and failed before the HUD received its first frame.
  comboBail(labels: string, pendingPoints: number, multiplier: number): void {
    const hasDisplayedCopy =
      this.comboState === "active" &&
      Boolean(this.trickLineEl.textContent) &&
      Boolean(this.trickTotalEl.textContent);
    if (!hasDisplayedCopy) {
      this.trickLineEl.textContent = labels.toUpperCase();
      this.snapLiveComboTicker(sourceComboPurseTarget(pendingPoints));
      this.setComboTotal(sourceLiveComboText(this.dispCombo, multiplier));
    }
    this.comboState = "bail";
    this.gameHudLayer.classList.add("hud-combo-present");
    this.comboBailEnd = performance.now() + 700;
    this.comboCashInHoldEnd = 0;
    this.trickPlate.style.display = "block";
    this.trickPlate.classList.add("hud-trick-bail");
  }

  // ---- HUD icons, as real spinning 3D ------------------------------------
  //
  // The crate counter, the fruit counter and the three relics are all drawn
  // with the GAME's renderer in a second pass over each icon's own DOM
  // rectangle, not into canvases of their own. A second WebGL context is a
  // real risk on iOS Safari, which is stingy with them and would leave the
  // icons silently missing on the device this is actually played on.
  //
  // ONE scene, ONE camera, N rectangles. Every slot sits at the origin and
  // only one is made visible at a time, so a slot's screen position comes
  // entirely from the viewport it is rendered into — which is just its host
  // element's box, whatever the layout does to it. (The relics previously
  // shared a single viewport over their row and were positioned inside it in
  // row-local pixels; that only worked because they happened to be siblings.)
  private buildIcons(): void {
    if (this.iconScene) return;
    const scene = new THREE.Scene();
    this.iconScene = scene;
    // Unit frustum: the camera spans 1.0 world unit vertically and the host's
    // aspect horizontally, so fitting art to a box is one scale factor.
    this.iconCam = new THREE.OrthographicCamera(-0.5, 0.5, 0.5, -0.5, -500, 500);
    // The relics are matcap-lit — their highlights are painted into the
    // material and sampled by surface normal — and ignore these entirely. The
    // crate and the fruit are Lambert, like everything in the world, so they
    // need lighting or they would render as silhouettes.
    //
    // Lit HOTTER than the world, deliberately. These icons have no drop
    // shadow to sit on any more — a CSS filter can't reach into the canvas —
    // so what separates them from a bright jungle behind them is their own
    // brightness. A key over one shoulder for the form, a dimmer fill over
    // the other so the away side never goes to a flat silhouette.
    scene.add(new THREE.AmbientLight(0xffffff, 2));
    const key = new THREE.DirectionalLight(0xffffff, 2.1);
    key.position.set(0.5, 0.9, 1);
    scene.add(key);
    const fill = new THREE.DirectionalLight(0xffffff, 0.7);
    fill.position.set(-0.8, -0.2, 0.5);
    scene.add(fill);

    // lean: tip toward the camera so a box reads as a box and a facet catches
    // the light, rather than turning as a flat silhouette.
    // rate: the idle turn. The counters are ambient decoration and stay slow;
    // a relic is a trophy and may show off.
    const art: {
      host: HTMLElement;
      make: () => THREE.Group;
      lean: number;
      rate: number;
      fill: number;
      relic: boolean;
    }[] = [
      // the crate shows its top face: you look DOWN on crates in this game
      { host: this.crateIcon, make: () => Level.crateMesh(1), lean: -0.42, rate: 0.6, fill: 0.66, relic: false },
      { host: this.wumpaIcon, make: () => wumpaMesh(1), lean: -0.12, rate: 0.9, fill: 0.86, relic: false },
      { host: this.crystalIcon, make: () => Level.crystalMesh(1), lean: -0.2, rate: 1.5, fill: 0.82, relic: true },
      { host: this.gemIcon, make: () => Level.gemMesh(1), lean: -0.2, rate: 1.5, fill: 0.82, relic: true },
      { host: this.comboGemIcon, make: () => Level.gemMesh(1, COMBO_GEM_TINT), lean: -0.2, rate: 1.5, fill: 0.82, relic: true },
    ];
    for (const { host, make, lean, rate, fill, relic } of art) {
      const model = make();
      // Strip the world halo. It's a camera-facing additive sprite sized for a
      // pickup standing in a level; at HUD scale, over bright scenery, it reads
      // as a pale RECTANGLE around the relic rather than a glow.
      for (const o of model.children.slice())
        if ((o as THREE.Sprite).isSprite) model.remove(o);
      // Centre the art on its own MESH bounds, so it turns about its middle
      // rather than orbiting whatever the model's origin happened to be.
      const box = new THREE.Box3();
      model.traverse((o) => {
        const m = o as THREE.Mesh;
        if (m.isMesh && m.geometry) box.expandByObject(m);
      });
      const c = box.getCenter(new THREE.Vector3());
      const size = box.getSize(new THREE.Vector3());
      model.position.sub(c);
      const spin = new THREE.Group();
      spin.add(model);
      const pivot = new THREE.Group();
      pivot.rotation.x = lean;
      pivot.add(spin);
      scene.add(pivot);
      // The art has to fit its box THROUGH A WHOLE TURN: a crate presents its
      // diagonal at 45 degrees, and the lean projects it taller than it
      // stands. `fill` is that headroom — tightest for the box, loosest for
      // the round fruit, which sweeps almost nothing.
      // relics stay dark until earned; the two counters are always live
      this.iconSlots.push({ host, pivot, spin, unit: (size.y || 1) / fill, rate, on: !relic });
    }
  }

  /**
   * Spin and draw the 3D HUD icons. Called from the frame loop after the world
   * is drawn, with the renderer the game already owns.
   */
  drawIcons(
    renderer: THREE.WebGLRenderer,
    dt: number,
    targetSize?: { width: number; height: number },
  ): void {
    this.buildIcons();
    const scene = this.iconScene;
    const cam = this.iconCam;
    if (!scene || !cam) return;

    const canvas = renderer.domElement;
    const cw = canvas.clientWidth;
    const ch = canvas.clientHeight;
    if (!cw || !ch) return;

    // setViewport/setScissor take the renderer's OWN size units and multiply by
    // pixelRatio internally — they are not drawing-buffer pixels. Passing
    // buffer pixels looks right at ratio 1 and is off by the ratio anywhere
    // else, which on a phone put this pass off-screen entirely AND left a
    // double-size viewport behind that zoomed the next frame's world.
    // So: CSS px -> renderer units, and restore whatever was set before.
    const size = targetSize
      ? ICON_SIZE.set(targetSize.width, targetSize.height)
      : renderer.getSize(ICON_SIZE);
    const kx = size.x / cw;
    const ky = size.y / ch;

    let drew = false;
    for (const slot of this.iconSlots) {
      if (!slot.on) continue;
      slot.spin.rotation.y += dt * slot.rate;
      const r = slot.host.getBoundingClientRect();
      // A hidden HUD (menus, the editor, a closed panel) measures zero, and a
      // scrolled-off icon would scissor to nothing: skip rather than draw.
      if (r.width < 4 || r.height < 4) continue;
      if (r.right <= 0 || r.bottom <= 0 || r.left >= cw || r.top >= ch) continue;

      if (!drew) {
        renderer.getViewport(ICON_PREV);
        renderer.autoClear = false;
        renderer.setScissorTest(true);
        drew = true;
      }
      // Only this slot is in shot; the shared scene holds all of them.
      // `visible` rather than layers: layers are per-object and do NOT
      // propagate to children, so a hidden pivot would still draw its art.
      for (const other of this.iconSlots) other.pivot.visible = other === slot;
      // The frustum is 1 unit tall and `aspect` wide, so the art fits the box
      // in BOTH axes for any icon shape (the crystal's slot is far from
      // square) with one scale factor.
      const aspect = r.width / r.height;
      cam.left = -aspect / 2;
      cam.right = aspect / 2;
      cam.updateProjectionMatrix();
      slot.pivot.scale.setScalar(Math.min(1, aspect) / slot.unit);

      // GL's origin is bottom-left, hence measuring down from the canvas bottom
      const vx = r.left * kx;
      const vy = (ch - r.bottom) * ky;
      const vw = r.width * kx;
      const vh = r.height * ky;
      renderer.setViewport(vx, vy, vw, vh);
      renderer.setScissor(vx, vy, vw, vh);
      renderer.clearDepth(); // sit on top of the world, not inside it
      renderer.render(scene, cam);
    }

    if (drew) {
      for (const slot of this.iconSlots) slot.pivot.visible = false;
      renderer.setScissorTest(false);
      renderer.setViewport(ICON_PREV);
      renderer.autoClear = true;
    }
  }

  /**
   * Where the fruit counter's icon is, in 0..1 screen fractions — the target
   * collected wumpa fly to.
   *
   * Read from the live box rather than guessed, because the counter moves: it
   * is sized in vh, it hides entirely during a run mode, and the HUD scale has
   * changed twice. Null when there's nothing on screen to aim at, and the
   * flight falls back to the corner it lives in.
   */
  fruitIconAt(): { x: number; y: number } | null {
    const el = this.wumpaIcon;
    if (!el || !el.isConnected) return null;
    const cs = getComputedStyle(el);
    if (cs.display === "none" || cs.visibility === "hidden") return null;
    const r = el.getBoundingClientRect();
    if (r.width < 2 || r.height < 2) return null;
    const w = window.innerWidth || 1;
    const h = window.innerHeight || 1;
    return { x: (r.left + r.width / 2) / w, y: (r.top + r.height / 2) / h };
  }

  /** Earned: hide the flat ghost (keeping its box) and light the 3D relic.
   *  The relic slots follow the two counter slots, hence the offset. */
  private setRelic(i: number, ghost: HTMLElement, earned: boolean): void {
    this.buildIcons();
    const slot = this.iconSlots[RELIC_SLOT_0 + i];
    if (slot) slot.on = earned;
    ghost.classList.toggle("hud-relic-off", !earned);
    // No ghost inventory. Unearned relics take no visual/layout slot; an
    // earned host remains laid out but hides its CSS silhouette beneath the
    // real 3D icon pass.
    ghost.style.display = earned ? "" : "none";
    ghost.style.visibility = earned && slot ? "hidden" : "visible";
  }

  setHUD(s: HudState, deltaSeconds = 1 / 60): void {
    const hudNow = performance.now();
    if (s.bonusMode !== this.bonusMode) {
      this.bonusMode = s.bonusMode;
      this.hudVisibility.reset(s.fruitCollectionRevision);
    }
    const previousVisibility = this.hudVisibilityFrame;
    let nextVisibility = this.hudVisibility.update({
      mode: s.bonusMode ? "bonus" : "standard",
      fruitCollectionRevision: s.fruitCollectionRevision,
      inventoryHeld: !this.runRowsHidden && s.inventoryHeld,
      hasEarnedRelic: s.hasCrystal || s.hasGem || s.hasComboGem,
      nowMs: hudNow,
    });
    if (this.runRowsHidden && !s.bonusMode) {
      this.hudVisibility.clearTransient();
      nextVisibility = {
        ...nextVisibility,
        showFruit: false,
        showBoxes: false,
        showEarnedRelics: false,
      };
    }
    const fruitOpened = nextVisibility.showFruit && !previousVisibility.showFruit;
    const boxesOpened = nextVisibility.showBoxes && !previousVisibility.showBoxes;
    const relicsOpened =
      nextVisibility.showEarnedRelics && !previousVisibility.showEarnedRelics;
    this.hudVisibilityFrame = nextVisibility;
    if (s.endlessDeaths !== this.endlessDeaths)
      this.setEndlessDeaths(s.endlessDeaths);
    const cashInHolding =
      this.comboState === "cashin" &&
      comboCashInIsHolding(hudNow, this.comboCashInHoldEnd);
    const cashInReleased = this.comboCashInWasHolding && !cashInHolding;
    this.comboCashInWasHolding = cashInHolding;
    // SCORE ticker: the shown number chases the real score fast.
    if (this.prevHud.points < 0) this.dispScore = s.points; // snap on first frame
    const cashInFrame =
      this.comboState === "cashin"
        ? advanceComboCashInDisplay(
            this.dispCombo,
            this.dispScore,
            s.points,
            cashInHolding,
          )
        : null;
    if (
      (s.points > this.prevHud.points && this.prevHud.points >= 0 && !cashInHolding) ||
      cashInReleased
    )
      pop(this.scoreEl);
    this.dispScore = cashInFrame
      ? cashInFrame.score
      : advanceSourceComboTicker(this.dispScore, s.points);
    this.rooScore.set(String(Math.round(this.dispScore)));
    this.prevHud.points = s.points;
    const crateKey = `${s.cratesBroken}/${s.cratesTotal}`;
    if (crateKey !== this.prevHud.crates) {
      this.rooCratesCurrent.set(String(s.cratesBroken));
      this.rooCratesTotal.set(`/${s.cratesTotal}`);
      pop(this.cratesEl);
      this.prevHud.crates = crateKey;
    }
    if (s.fruit !== this.prevHud.fruit) {
      this.rooWumpa.set(s.endlessDeaths ? "" : String(s.fruit));
      pop(this.wumpaEl);
      this.prevHud.fruit = s.fruit;
    }
    if (s.hasCrystal !== this.prevHud.crystal) {
      this.setRelic(0, this.crystalIcon, s.hasCrystal);
      if (s.hasCrystal) pop(this.crystalIcon);
      this.prevHud.crystal = s.hasCrystal;
    }
    if (s.hasComboGem !== this.prevHud.comboGem) {
      this.setRelic(2, this.comboGemIcon, s.hasComboGem);
      if (s.hasComboGem) pop(this.comboGemIcon);
      this.prevHud.comboGem = s.hasComboGem;
    }
    if (s.hasGem !== this.prevHud.gem) {
      this.setRelic(1, this.gemIcon, s.hasGem);
      if (s.hasGem) pop(this.gemIcon);
      this.prevHud.gem = s.hasGem;
    }
    const lifeReadout = s.endlessDeaths ? s.deaths : s.lives;
    if (lifeReadout !== this.prevHud.lives) {
      this.rooLives.set(String(lifeReadout));
      pop(this.livesEl);
      this.prevHud.lives = lifeReadout;
    }
    this.syncHudVisibility();
    if (fruitOpened) pop(this.wumpaRowEl);
    if (boxesOpened) pop(this.crateRowEl);
    if (relicsOpened) pop(this.relicRowEl);
    const specialValue = Math.max(0, Math.min(100, s.specialMeter));
    const specialFraction = specialValue / 100;
    this.specialWrap.dataset.value = specialValue.toFixed(4);
    this.specialWrap.setAttribute("aria-valuenow", specialValue.toFixed(0));
    this.specialWrap.style.setProperty("--special-turn", `${specialFraction}turn`);
    this.specialWrap.classList.toggle("hud-special-ready", s.specialReady);
    this.specialFrame = {
      visible: this.livesRowEl.style.display !== "none",
      value: specialValue,
      ready: s.specialReady,
    };
    if (s.specialReady && !this.specialWasReady) {
      pop(this.specialWrap);
    }
    this.specialWasReady = s.specialReady;
    // The live source plate shows the UNMULTIPLIED purse and a separate ×N.
    // A started deck trick projects its future fixed award without mutating
    // gameplay. Fixed awards snap; quarter-second hold accrual alone tickers.
    const preview = s.comboPreview;
    const show = preview !== null || (s.comboHasTrick && s.comboMult > 0);
    const labels = preview?.labels ?? s.tricks;
    const multiplier = preview?.multiplier ?? s.comboMult;
    const target = sourceComboPurseTarget(preview?.points ?? s.comboPoints);
    const fixedChanged =
      s.comboActionRevision !== this.lastComboActionRevision ||
      (preview?.sequence ?? -1) !== this.lastComboPreviewSequence;
    if (this.comboState === "cashin") {
      if (show) {
        this.startCombo(labels); // a fresh combo interrupts the cash-in
        this.comboCashInHoldEnd = 0;
        this.snapLiveComboTicker(target);
        this.setComboTotal(sourceLiveComboText(this.dispCombo, multiplier));
      } else if (!cashInHolding) {
        this.dispCombo = cashInFrame?.combo ?? this.dispCombo;
        this.setComboTotal(String(Math.round(this.dispCombo)));
        if (this.dispCombo <= 0) this.endCombo();
      }
    } else if (this.comboState === "bail") {
      if (show) {
        this.startCombo(labels);
        this.snapLiveComboTicker(target);
        this.setComboTotal(sourceLiveComboText(this.dispCombo, multiplier));
      }
      else if (hudNow >= this.comboBailEnd) this.endCombo();
    } else if (show) {
      const entering = this.comboState !== "active";
      this.startCombo(labels);
      if (entering || fixedChanged) {
        this.snapLiveComboTicker(target);
      } else {
        this.liveComboTicker = advanceLiveComboTicker(
          this.liveComboTicker,
          target,
          deltaSeconds,
        );
        this.dispCombo = this.liveComboTicker.displayed;
      }
      this.setComboTotal(sourceLiveComboText(this.dispCombo, multiplier));
    } else if (this.comboState === "active") {
      this.endCombo(); // combo fizzled with no bank/bail signal
    }
    this.lastComboActionRevision = s.comboActionRevision;
    this.lastComboPreviewSequence = preview?.sequence ?? -1;
  }

  // Saved tuning snapshot from this browser, if any — merged so that ONLY
  // keys the user deliberately moved off their build's defaults carry over;
  // everything they never touched follows the CURRENT build's numbers. (A
  // legacy flat snapshot can't tell tweaks from stale defaults — it once
  // kept a retired mechanic alive for days — so it is dropped outright.)
  private readSaved(): Partial<Record<TuningKey, number>> | null {
    try {
      const raw = JSON.parse(localStorage.getItem("solProtoTuning") ?? "null") as {
        __v?: number;
        tuning?: Record<string, number>;
        defaults?: Record<string, number>;
      } | null;
      if (!raw) return null;
      if (raw.__v === undefined || !raw.tuning || !raw.defaults) {
        localStorage.removeItem("solProtoTuning"); // pre-versioning save: retire it
        return null;
      }
      const merged: Partial<Record<TuningKey, number>> = { ...this.defaults };
      for (const key of Object.keys(TUNING_RANGES) as TuningKey[]) {
        const v = raw.tuning[key];
        if (typeof v === "number" && isFinite(v) && v !== raw.defaults[key])
          merged[key] = v;
      }
      // v14 and earlier saved a cruise-rate + ratio. Preserve only a
      // DELIBERATE old edit, translating it to the two direct v15 endpoints;
      // an untouched legacy pair follows the new build defaults as usual.
      const migrated = migrateLegacySavedCarveGrip(
        raw.tuning,
        raw.defaults,
        merged.cruiseSpeed ?? TUNING.cruiseSpeed,
        merged.maxSpeed ?? TUNING.maxSpeed,
      );
      if (migrated) {
        merged.carveGripLow = migrated.low;
        merged.carveGripHigh = migrated.high;
      }
      return merged;
    } catch {
      return null;
    }
  }

  private applyTuning(vals: Partial<Record<TuningKey, number>>): void {
    for (const key of Object.keys(TUNING_RANGES) as TuningKey[]) {
      const v = vals[key];
      if (typeof v !== "number" || !isFinite(v)) continue;
      TUNING[key] = v;
      const el = this.sliderEls.get(key);
      if (el) {
        el.input.value = String(v);
        el.value.value = String(v);
        el.sync?.(); // checkboxes mirror the number
      }
    }
  }

  set2P(on: boolean): void {
    this.mpBtn.textContent = on
      ? "⚔ 2-PLAYER SPLIT: ON"
      : "⚔ 2-PLAYER SPLIT: OFF";
    this.mpBtn.style.color = on ? "#58e08a" : "";
  }

  setRunModes(on: boolean): void {
    this.runBtn.textContent = on
      ? "⏱ TIME TRIAL + COMBO: ON"
      : "⏱ TIME TRIAL + COMBO: OFF";
    this.runBtn.style.color = on ? "" : "#e0705a";
  }

  setEndlessDeaths(on: boolean): void {
    this.endlessDeaths = on;
    this.endlessBtn.textContent = on
      ? "∞ STANDARD RULE: ENDLESS DEATHS"
      : "× STANDARD RULE: CLASSIC LIVES";
    this.endlessBtn.style.color = on ? "#ffd45a" : "";
    if (this.deathModeLabelEl) this.deathModeLabelEl.style.display = on ? "block" : "none";
    if (this.livesRowEl) {
      this.livesRowEl.classList.toggle("hud-deathcount", on);
      this.livesRowEl.title = on ? "total deaths this run" : "click: +1 life";
      this.livesRowEl.style.cursor = on ? "default" : "pointer";
    }
    this.prevHud.lives = -1; // the same numeral may now mean a different rule
    this.prevHud.fruit = -1; // endless pickups use an icon-only transient
    this.syncRunRows();
  }

  setLevel(
    id: string,
    hudMode: "standard" | "bonus" = "standard",
    fruitCollectionRevision = 0,
  ): void {
    this.currentLevelId = id;
    this.bonusMode = hudMode === "bonus";
    this.hudVisibility.reset(fruitCollectionRevision);
    this.hudVisibilityFrame = this.hudVisibility.update({
      mode: this.bonusMode ? "bonus" : "standard",
      fruitCollectionRevision,
      inventoryHeld: false,
      hasEarnedRelic: false,
      nowMs: performance.now(),
    });
    this.syncHudVisibility();
    this.levelRows.forEach((b, key) =>
      b.classList.toggle("active", key === id),
    );
    this.refreshEditControls();
  }

  resetHudTransients(fruitCollectionRevision = 0): void {
    this.hudVisibility.reset(fruitCollectionRevision);
    this.hudVisibilityFrame = this.hudVisibility.update({
      mode: this.bonusMode ? "bonus" : "standard",
      fruitCollectionRevision,
      inventoryHeld: false,
      hasEarnedRelic: false,
      nowMs: performance.now(),
    });
    this.syncHudVisibility();
  }

  /** Rebuild the level list from the registry. Call whenever it changes. */
  refreshLevels(activeId?: string): void {
    if (activeId !== undefined) this.currentLevelId = activeId;
    this.renderLevels();
    this.refreshEditControls();
  }

  private renderLevels(): void {
    this.levelRowEl.replaceChildren();
    this.levelRows.clear();
    levelList().forEach((entry, i) => {
      const item = div("hud-levelitem");
      const play = document.createElement("button");
      play.className = "hud-levelbtn hud-levelplay";
      play.textContent = i < 9 ? `${i + 1}· ${entry.name}` : entry.name;
      play.title = entry.name;
      play.classList.toggle("active", entry.id === this.currentLevelId);
      play.addEventListener("click", () => {
        this.onLevelSelect(entry.id);
        play.blur(); // give the keyboard back to the game
      });
      const edit = document.createElement("button");
      edit.className = "hud-levelbtn hud-leveledit hud-leveleditbtn";
      edit.textContent = "✎";
      edit.title = `edit ${entry.name}`;
      edit.addEventListener("click", () => {
        if (this.onLevelEdit) this.onLevelEdit(entry.id);
        edit.blur();
      });
      item.appendChild(play);
      item.appendChild(edit);
      this.levelRowEl.appendChild(item);
      this.levelRows.set(entry.id, play);
    });
  }

  // ---- direct-edit + phone sync controls ----
  setEditUnlocked(on: boolean): void {
    this.editUnlocked = on;
    this.refreshEditControls();
  }

  setSyncStatus(msg: string, kind: "ok" | "err" | "busy" = "busy"): void {
    if (!this.syncStatusEl) return;
    this.syncStatusEl.textContent = msg;
    this.syncStatusEl.className = `hud-syncstatus hud-sync-${kind}`;
  }

  // Reflect the unlock/token state into the sync panel. Editing itself is
  // never gated — every row has a ✎ — the passcode only guards PUBLISHING,
  // whose real credential is the GitHub token behind it.
  refreshEditControls(): void {
    if (!this.syncPanel) return;
    const st = this.provideEditState ? this.provideEditState() : null;
    const unlocked = st ? st.unlocked : this.editUnlocked;
    this.editUnlocked = unlocked;
    this.tokenRow.style.display = unlocked ? "" : "none";
    this.pushRow.style.display = unlocked ? "" : "none";
    this.unlockRow.style.display = unlocked ? "none" : "";
    if (unlocked && st) {
      const n = st.userCount;
      this.pushRow.querySelector("button")!.textContent =
        `☁ SYNC MY ${n} LEVEL${n === 1 ? "" : "S"} UP`;
      if (!st.hasToken && !this.syncStatusEl.textContent)
        this.setSyncStatus("paste a GitHub token to enable sync", "busy");
    }
  }

  // THPS balance meters. Grinds show the HORIZONTAL bar (left/right needle);
  // manuals show the VERTICAL one (needle sinks toward the tail as you tip
  // back, rises toward the nose tipping forward — push the stick up/down
  // AGAINST it). bal in [-1, 1]; pegging either end is the bail. crit = the
  // last-chance beat: the needle flashes.
  updateBalance(
    meter: { mode: "grind" | "manual"; bal: number; crit: boolean } | null,
  ): void {
    const grind = meter !== null && meter.mode === "grind";
    const manual = meter !== null && meter.mode === "manual";
    this.balanceWrap.style.display = grind ? "block" : "none";
    this.vBalanceWrap.style.display = manual ? "block" : "none";
    if (!meter) return;
    const hot = meter.crit || Math.abs(meter.bal) > 0.7;
    const color = meter.crit
      ? Math.sin(performance.now() * 0.045) > 0
        ? "#ff2d1e"
        : "#ffd23f"
      : hot
        ? "#e2483d"
        : "#8fd4a8";
    if (grind) {
      this.balanceNeedle.style.left = 50 + meter.bal * 46 + "%";
      this.balanceNeedle.style.background = color;
    } else {
      // balance + = tipping BACK onto the tail -> needle drops to the bottom
      this.vBalanceNeedle.style.top = 50 + meter.bal * 44 + "%";
      this.vBalanceNeedle.style.background = color;
    }
  }

  setStats(s: Stats): void {
    const railDist = isFinite(s.railDist) ? s.railDist.toFixed(2) + "m" : "-";
    this.statsEl.innerHTML =
      `<div class="hud-title">DEBUG</div>` +
      row("speed", s.speed.toFixed(1)) +
      row("state", s.state) +
      row("grounded", String(s.grounded)) +
      row("vVel", s.vVel.toFixed(1)) +
      row("surface", s.surface) +
      row("controller", s.controller) +
      row("jump", s.jump) +
      row("bail", s.bail) +
      row("rail dist", railDist) +
      row("crates", s.crates) +
      row("wumpa", String(s.fruit)) +
      row("mask", s.masks) +
      row("time", s.time.toFixed(2) + "s");
  }

  // durationMs = 0 keeps the message up until the next showMessage/hide.
  showMessage(title: string, sub: string, durationMs: number): void {
    // Open the plate BEFORE handing over the title: the label measures a real
    // glyph box, and a box inside a display:none plate measures nothing.
    this.msgSub.textContent = sub;
    this.msgWrap.style.display = "block";
    this.rooMsgTitle.set(title);
    if (this.msgTimer !== undefined) window.clearTimeout(this.msgTimer);
    this.msgTimer = undefined;
    this.messageState = {
      title,
      sub,
      expiresAt: durationMs > 0 ? performance.now() + durationMs : null,
    };
    if (durationMs > 0) {
      this.msgTimer = window.setTimeout(() => this.hideMessage(), durationMs);
    }
  }

  hideMessage(): void {
    this.msgWrap.style.display = "none";
    this.messageState = null;
    if (this.msgTimer !== undefined) window.clearTimeout(this.msgTimer);
    this.msgTimer = undefined;
  }

  captureMessage(): { title: string; sub: string; remainingMs: number } | null {
    if (!this.messageState) return null;
    return {
      title: this.messageState.title,
      sub: this.messageState.sub,
      remainingMs:
        this.messageState.expiresAt === null
          ? 0
          : Math.max(1, this.messageState.expiresAt - performance.now()),
    };
  }

  restoreMessage(
    state: { title: string; sub: string; remainingMs: number } | null,
  ): void {
    if (!state) this.hideMessage();
    else this.showMessage(state.title, state.sub, state.remainingMs);
  }

  flash(): void {
    this.flashEl.style.transition = "none";
    this.flashEl.style.opacity = "0.55";
    requestAnimationFrame(() => {
      this.flashEl.style.transition = "opacity 0.45s";
      this.flashEl.style.opacity = "0";
    });
  }

  // ---- time trial ----------------------------------------------------------

  // Trial dress on/off: the big clock appears, fruit + lives counters hide.
  setTimeTrial(on: boolean): void {
    this.ttOn = on;
    this.ttClockEl.style.display = on ? "block" : "none";
    this.setRunRows(on);
    if (!on) this.ttResultsEl.style.display = "none";
  }

  // Run-mode HUD: the fruit + lives counters sit out (shared by time trials
  // and combo runs).
  setRunRows(on: boolean): void {
    if (on !== this.runRowsHidden) this.hudVisibility.clearTransient();
    this.runRowsHidden = on;
    if (on && !this.bonusMode) {
      this.hudVisibilityFrame = {
        ...this.hudVisibilityFrame,
        showFruit: false,
        showBoxes: false,
        showEarnedRelics: false,
      };
    }
    this.syncRunRows();
  }

  private syncRunRows(): void {
    this.syncHudVisibility();
  }

  private syncHudVisibility(): void {
    if (!this.gameHudLayer) return;
    const bonus = this.bonusMode;
    const contextual = !this.runRowsHidden || bonus;
    this.gameHudLayer.classList.toggle("hud-bonus", bonus);
    this.bonusTitleEl.style.display =
      contextual && this.hudVisibilityFrame.showBonusTitle ? "block" : "none";
    this.wumpaRowEl.style.display =
      contextual && this.hudVisibilityFrame.showFruit ? "flex" : "none";
    this.crateRowEl.style.display =
      contextual && this.hudVisibilityFrame.showBoxes ? "flex" : "none";
    this.relicRowEl.style.display =
      contextual && this.hudVisibilityFrame.showEarnedRelics ? "flex" : "none";
    this.livesRowEl.style.display =
      contextual && this.hudVisibilityFrame.showLife ? "flex" : "none";
    // Score remains available to the explicit time-trial/combo modes, but is
    // no longer persistent furniture in ordinary or bonus play.
    this.scorePlateEl.style.display = this.runRowsHidden && !bonus ? "block" : "none";
  }

  // Balance-boost ring: each full turn is one crate window; stacked windows
  // lap over themselves, the completed laps banked as a deeper green
  // underneath the live arc. Flashes when the last second is running out.
  updateBalanceBoost(t: number, per: number): void {
    const on = t > 0;
    this.boostFrame = on
      ? { remaining: t, period: per, critical: t < 1, label: "BALANCE" }
      : null;
    this.boostRingWrap.style.display = on ? "flex" : "none";
    if (!on) return;
    const laps = Math.floor(t / per);
    const frac = (t / per) % 1;
    const shades = ["#1c6e3c", "#2fae5c", "#46e882", "#a4ffc8"];
    const track = "rgba(10, 30, 18, 0.75)";
    const under =
      laps === 0 ? track : shades[Math.min(laps - 1, shades.length - 1)];
    const over = shades[Math.min(laps, shades.length - 1)];
    this.boostRing.style.background =
      frac <= 0
        ? under
        : `conic-gradient(${over} 0turn ${frac}turn, ${under} ${frac}turn 1turn)`;
    this.boostRingWrap.classList.toggle("hud-boost-low", t < 1);
  }

  // Combo-run viewport halo: 'on' = green glow breathing at the edges,
  // 'dissipate' = the despair beat (slow fade to nothing), 'off' = gone now.
  comboHalo(state: "on" | "dissipate" | "off"): void {
    this.haloEl.classList.toggle("on", state === "on");
    this.haloEl.classList.toggle("dissipate", state === "dissipate");
  }

  private static fmtTime(t: number): string {
    const m = Math.floor(t / 60);
    const s = t - m * 60;
    return `${m}:${s < 10 ? "0" : ""}${s.toFixed(2)}`;
  }

  // Called every frame while a trial runs — centisecond digits, and the whole
  // clock goes ice-blue while a time crate's freeze is counting down.
  updateTTClock(t: number, freeze: number): void {
    if (!this.ttOn) return;
    this.rooTTTime.set(UI.fmtTime(t));
    const frozen = freeze > 0;
    this.ttClockEl.classList.toggle("hud-tt-frozen", frozen);
    this.rooTTFreeze.set(frozen ? `FROZEN ${freeze.toFixed(1)}S` : "");
  }

  // Ranked times at the gate: this run slots into the level's best list.
  showTTResults(time: number, list: number[], rank: number): void {
    const rows = list
      .slice(0, 5)
      .map((v, i) => {
        const isNew = i === rank;
        return `<div class="hud-ttrow${isNew ? " hud-ttrow-new" : ""}"><span>${i + 1}.</span><span>${UI.fmtTime(v)}</span></div>`;
      })
      .join("");
    this.rooTTResTitle.set(rank === 0 ? "NEW RECORD!" : "RUN COMPLETE");
    this.ttResListEl.innerHTML = rows;
    // Show the card BEFORE handing the headline time to its Roo label: the
    // renderer measures a real bounding box, and a box inside a display:none
    // panel measures nothing.
    this.ttResultsEl.style.display = "block";
    this.rooTTBest.set(UI.fmtTime(time));
  }

  hideTTResults(): void {
    this.ttResultsEl.style.display = "none";
  }

  // Death curtain: fade to black on the way out; on respawn hold the black a
  // beat (the world teleports behind it), then reveal the checkpoint.
  deathFade(out: boolean): void {
    if (this.fadeTimer !== null) {
      clearTimeout(this.fadeTimer);
      this.fadeTimer = null;
    }
    if (out) {
      this.fadeEl.style.transition = "opacity 0.4s ease";
      this.fadeEl.style.opacity = "1";
    } else {
      this.fadeTimer = window.setTimeout(() => {
        this.fadeTimer = null;
        this.fadeEl.style.transition = "opacity 0.55s ease";
        this.fadeEl.style.opacity = "0";
      }, 280);
    }
  }

  private sliderRow(key: TuningKey): HTMLElement {
    const range = TUNING_RANGES[key];
    const wrap = div("hud-slider");
    wrap.title = TUNING_INFO[key]; // hover for what this number does in play
    const label = document.createElement("label");
    label.textContent = key;
    // Click the name to bookmark it (green) — pure attention bookkeeping for
    // tuning sessions, remembered like the values are, zero gameplay effect.
    if (this.tunerMarks.has(key)) label.classList.add("hud-marked");
    label.style.cursor = "pointer";
    label.addEventListener("click", () => {
      if (this.tunerMarks.has(key)) this.tunerMarks.delete(key);
      else this.tunerMarks.add(key);
      label.classList.toggle("hud-marked");
      localStorage.setItem(
        "solProtoTunerMarks",
        JSON.stringify([...this.tunerMarks]),
      );
    });
    // 0/1 toggles render as a CHECKBOX, not a two-notch slider. The unused
    // input/value pair keeps the shared applyTuning refresh path happy;
    // sync() mirrors save/reset/defaults into the box.
    if (range.min === 0 && range.max === 1 && range.step === 1) {
      const box = document.createElement("input");
      box.type = "checkbox";
      box.className = "hud-tunercheck";
      box.checked = TUNING[key] > 0.5;
      box.addEventListener("change", () => {
        TUNING[key] = box.checked ? 1 : 0;
      });
      wrap.appendChild(label);
      wrap.appendChild(box);
      this.sliderEls.set(key, {
        input: document.createElement("input"),
        value: document.createElement("input"),
        sync: () => (box.checked = TUNING[key] > 0.5),
      });
      return wrap;
    }
    // Editable number box: click and type an exact value (or use the arrows).
    // It accepts anything and clamps to the slider's range on commit.
    const value = document.createElement("input");
    value.type = "number";
    value.className = "hud-tunernum";
    value.min = String(range.min);
    value.max = String(range.max);
    value.step = "any"; // typing isn't bound to the drag step
    value.value = String(TUNING[key]);
    const input = document.createElement("input");
    input.type = "range";
    input.min = String(range.min);
    input.max = String(range.max);
    input.step = String(range.step);
    input.value = String(TUNING[key]);
    input.addEventListener("input", () => {
      TUNING[key] = Number(input.value);
      value.value = input.value;
    });
    // Typing commits live; clamp to range only on blur/Enter so an in-progress
    // number (e.g. "1" before "12") isn't yanked to the min mid-keystroke.
    value.addEventListener("input", () => {
      const v = Number(value.value);
      if (Number.isFinite(v)) {
        TUNING[key] = v;
        input.value = String(v);
      }
    });
    const commit = (): void => {
      let v = Number(value.value);
      if (!Number.isFinite(v)) v = TUNING[key];
      v = Math.min(range.max, Math.max(range.min, v));
      TUNING[key] = v;
      input.value = String(v);
      value.value = String(v);
    };
    value.addEventListener("change", commit);
    // Keep field keystrokes (digits, WASD, arrows) out of the game's global key
    // handlers, and slider drags from stealing focus.
    for (const ev of ["keydown", "keyup", "keypress"])
      value.addEventListener(ev, (e) => e.stopPropagation());
    value.addEventListener("blur", commit);
    input.addEventListener("change", () => input.blur());
    wrap.appendChild(label);
    wrap.appendChild(input);
    wrap.appendChild(value);
    this.sliderEls.set(key, { input, value });
    return wrap;
  }

  private injectStyle(): void {
    const style = document.createElement("style");
    style.textContent = `
      .hud-stats, .hud-tuning {
        color: #cfe3d8;
        font: 12px/1.5 ui-monospace, Menlo, Consolas, monospace;
        background: linear-gradient(180deg, rgba(26, 30, 44, 0.92), rgba(10, 12, 18, 0.92));
        border: 1px solid #3a4152;
        padding: 8px 10px; border-radius: 8px;
        box-shadow: inset 0 1px 0 rgba(255, 255, 255, 0.08), 0 6px 18px rgba(0, 0, 0, 0.45);
      }
      /* the level list is unbounded now — the panel has to be able to scroll */
      .hud-stats { min-width: 230px; max-width: 330px; max-height: calc(100vh - 40px); overflow-y: auto; }
      .hud-tuning { width: 250px; max-height: calc(100vh - 60px); overflow-y: auto; }
      .hud-title { color: #8fd4a8; letter-spacing: 2px; margin-bottom: 4px; }
      /* one row per level: PLAY takes the width, ✎ is a fixed square */
      .hud-levelrow { display: flex; flex-direction: column; gap: 3px; margin-bottom: 6px; }
      .hud-levelitem { display: flex; gap: 3px; }
      .hud-levelitem .hud-levelplay {
        flex: 1 1 auto; min-width: 0; text-align: left; padding-left: 5px;
        overflow: hidden; text-overflow: ellipsis;
      }
      .hud-levelitem .hud-leveleditbtn { flex: 0 0 24px; padding: 3px 0; font-size: 12px; line-height: 1; }
      /* standalone menu buttons (2-player, restore) are their own full rows */
      .hud-stats > .hud-levelbtn { display: block; width: 100%; margin-bottom: 4px; }
      .hud-levelactions { display: flex; gap: 4px; margin-bottom: 6px; }
      .hud-levelactions .hud-levelbtn { flex: 1 1 0; }
      .hud-tunebtns { display: flex; gap: 4px; margin-bottom: 6px; }
      .hud-presentation-tools { flex-wrap: wrap; }
      .hud-presentation-tools .hud-levelbtn { flex: 1 1 calc(33% - 4px); }
      .hud-capbadge {
        position: fixed; top: 10px; left: 50%; transform: translateX(-50%);
        font: bold 12px ui-monospace, Menlo, Consolas, monospace;
        color: #ffd75e; background: rgba(20, 24, 34, 0.75);
        padding: 4px 10px; border-radius: 10px; letter-spacing: 1px;
        pointer-events: none; z-index: 40;
      }
      .hud-recbadge { color: #ff5e5e; top: 34px; }
      .hud-levelbtn {
        flex: 1; font: 10px ui-monospace, Menlo, Consolas, monospace;
        background: #1c2230; color: #9fb0c8; border: 1px solid #3a4152;
        border-radius: 6px; padding: 3px 2px; cursor: pointer; white-space: nowrap;
      }
      .hud-levelbtn.active { background: #2b4436; color: #b6f0cc; border-color: #8fd4a8; }
      /* editing is green, everywhere: per-row ✎, NEW, IMPORT, SYNC UP */
      .hud-leveledit { background: #223a2b; color: #9ff0c0; border-color: #4f8f68; }
      /* direct-edit unlock + phone sync */
      .hud-sync {
        margin-top: 8px; padding: 8px; border: 1px solid #33405a; border-radius: 8px;
        background: rgba(14, 20, 32, 0.6); display: flex; flex-direction: column; gap: 6px;
      }
      .hud-syncrow { display: flex; gap: 6px; }
      .hud-syncinput {
        flex: 1; min-width: 0; font: 10px ui-monospace, Menlo, Consolas, monospace;
        background: #10151f; color: #d6e2f0; border: 1px solid #3a4152; border-radius: 6px;
        padding: 4px 6px;
      }
      .hud-syncinput::placeholder { color: #5f6f86; }
      .hud-syncbtn {
        font: 10px ui-monospace, Menlo, Consolas, monospace; cursor: pointer; white-space: nowrap;
        background: #1c2230; color: #9fb0c8; border: 1px solid #3a4152; border-radius: 6px; padding: 4px 8px;
      }
      .hud-syncpushbtn { width: 100%; background: #223a2b; color: #9ff0c0; border-color: #4f8f68; }
      .hud-syncstatus { font-size: 10px; min-height: 12px; color: #9fb0c8; }
      .hud-sync-ok { color: #6fe0a0; }
      .hud-sync-err { color: #ff9a7a; }
      .hud-sync-busy { color: #e8c86a; }
      .hud-row { display: flex; justify-content: space-between; gap: 12px; }
      .hud-row b { color: #eef4ff; font-weight: normal; }
      .hud-secttitle { margin: 10px 0 2px; padding-bottom: 2px; border-bottom: 1px solid rgba(143, 212, 168, 0.35); color: #8fd4a8; font-size: 11px; letter-spacing: 2px; }
      .hud-slider { display: grid; grid-template-columns: 104px 1fr 52px; gap: 6px; align-items: center; }
      .hud-slider label { color: #9fb0c8; }
      .hud-slider label.hud-marked { color: #58e08a; }
      .hud-slider input[type=range] { width: 100%; accent-color: #8fd4a8; }
      .hud-tunernum { width: 100%; text-align: right; color: #eef4ff; background: #1c2230; border: 1px solid #3a4152; border-radius: 4px; padding: 1px 2px; font: 12px/1.5 ui-monospace, Menlo, Consolas, monospace; box-sizing: border-box; }
      .hud-tunernum:focus { outline: none; border-color: #8fd4a8; background: #243044; }

      /* --- collapsible side panels --- */
      .side-wrap {
        position: fixed; top: 10px; z-index: 15; display: flex;
        align-items: flex-start; transition: transform 0.25s ease;
      }
      .side-wrap.left { left: 0; }
      .side-wrap.right { right: 0; }
      .side-wrap.left.collapsed { transform: translateX(calc(-100% + 24px)); }
      .side-wrap.right.collapsed { transform: translateX(calc(100% - 24px)); }
      .side-tab {
        width: 24px; padding: 10px 2px; cursor: pointer;
        writing-mode: vertical-rl; text-orientation: upright;
        font: bold 10px ui-monospace, Menlo, Consolas, monospace;
        letter-spacing: 2px; color: #cfe3d8;
        background: linear-gradient(180deg, rgba(26, 30, 44, 0.92), rgba(10, 12, 18, 0.92));
        border: 1px solid #3a4152;
        box-shadow: inset 0 1px 0 rgba(255, 255, 255, 0.08);
      }
      .side-wrap.left .side-tab { border-radius: 0 8px 8px 0; border-left: none; }
      .side-wrap.right .side-tab { border-radius: 8px 0 0 8px; border-right: none; }

      /* --- Crash-style game HUD --- */
      .game-hud-layer { display: block; }
      .game-hud-layer.precrt-composited { opacity: 0; }
      .hud-tl {
        position: fixed; top: 22px; left: 34px; z-index: 10;
        display: flex; flex-direction: column; align-items: flex-start;
        pointer-events: none;
      }
      .hud-build {
        position: fixed; bottom: 6px; left: 8px; z-index: 10; pointer-events: none;
        font: 10px ui-monospace, Menlo, Consolas, monospace; color: rgba(220, 228, 240, 0.5);
        text-shadow: 0 1px 2px rgba(0,0,0,0.6);
      }
      .hud-tr { position: fixed; top: 16px; right: 40px; z-index: 10; pointer-events: none; }
      .hud-counter { display: flex; align-items: center; gap: 12px; margin-bottom: 8px; }
      .hud-life-row {
        position: fixed; right: 30px; bottom: 20px; z-index: 10;
        margin: 0; gap: 8px; pointer-events: none;
      }
      .hud-life-face-wrap {
        position: relative; flex: 0 0 auto;
        width: clamp(68px, 10.7vh, 111px);
        height: clamp(68px, 10.7vh, 111px);
        transform: translateY(-14%);
      }
      .hud-life-face-wrap .hud-icon-face { width: 100%; height: 100%; }
      .hud-bonus-title {
        position: fixed; top: 18px; left: 50%; z-index: 10;
        transform: translateX(-50%);
        font: 900 clamp(52px, 9vh, 86px) Impact, 'Arial Black', sans-serif;
        line-height: 0; pointer-events: none;
        filter: drop-shadow(0 5px 2px rgba(70, 18, 0, 0.78));
      }
      .game-hud-layer.hud-bonus .hud-tl {
        position: static;
      }
      .game-hud-layer.hud-bonus .hud-fruit-row {
        position: fixed; left: 30px; bottom: 20px;
      }
      .game-hud-layer.hud-bonus .hud-crate-row {
        position: fixed; left: 38%; bottom: 20px;
      }
      .game-hud-layer.hud-bonus .hud-counter { margin-bottom: 0; }
      .hud-deathcount-label {
        align-self: flex-end;
        margin: 0 0 clamp(8px, 1.2vh, 13px) -7px;
        font: bold clamp(10px, 1.45vh, 14px) Impact, 'Arial Black', sans-serif;
        letter-spacing: 1.5px;
        color: #ff765f;
        text-shadow: 0 2px 2px #000, 0 0 6px rgba(255, 70, 45, 0.55);
      }
      .hud-deathcount .hud-icon-face { filter: grayscale(0.35) saturate(1.3) drop-shadow(0 4px 6px rgba(0, 0, 0, 0.6)); }
      /* Sized as CAP HEIGHT — see the .roo-line note below. The icon leads the
         digits slightly, the way the crate and the fruit do in Crash. */
      .hud-num {
        font: 900 clamp(55px, 8.7vh, 90px) Impact, 'Arial Black', sans-serif;
        color: #ffb43a; letter-spacing: 2px;
      }
      .hud-box-count { display: flex; align-items: flex-end; gap: 5px; }
      .hud-box-current { font-size: inherit; }
      .hud-box-total {
        font-size: clamp(30px, 4.8vh, 50px);
        margin-bottom: clamp(8px, 1.4vh, 14px);
      }
      .hud-icon {
        width: clamp(68px, 10.7vh, 111px); height: clamp(68px, 10.7vh, 111px);
        image-rendering: pixelated; flex-shrink: 0;
      }
      /* These two are EMPTY BOXES on purpose. They were a flat PNG each; the
         crate and the fruit are now the real 3D models, turning slowly, drawn
         straight into these rectangles by drawIcons(). A background image
         here would sit on top of the canvas and hide them — the HUD is DOM
         over WebGL, so an icon that is 3D has to be nothing in the DOM. */
      /* The relic haul is a footnote under the counters, not a third counter:
         each stone reads at roughly two-thirds the crate icon so the row
         doesn't out-weigh what it's summarising. */
      .hud-relics { gap: 14px; }
      .hud-icon-crystal {
        width: clamp(35px, 6.1vh, 53px); height: clamp(48px, 8.4vh, 74px);
        background: linear-gradient(160deg, #ffd4f8 8%, #ff9af0 22%, #c03fe0 55%, #7a1898 90%);
        clip-path: polygon(50% 0%, 100% 38%, 50% 100%, 0% 38%);
        filter: drop-shadow(0 3px 5px rgba(0, 0, 0, 0.6)) drop-shadow(0 0 7px rgba(255, 120, 240, 0.6));
      }
      .hud-icon-gem {
        width: clamp(43px, 7.7vh, 67px); height: clamp(32px, 5.6vh, 50px);
        background: linear-gradient(160deg, #eaffff 8%, #bfffff 22%, #35cfe4 55%, #147a90 90%);
        clip-path: polygon(25% 0%, 75% 0%, 100% 35%, 50% 100%, 0% 35%);
        filter: drop-shadow(0 3px 5px rgba(0, 0, 0, 0.6)) drop-shadow(0 0 7px rgba(80, 220, 255, 0.6));
        align-self: center;
      }
      /* the combo gem: same cut, run through green glass */
      .hud-icon-combogem {
        background: linear-gradient(160deg, #eaffe8 8%, #b8ffd2 22%, #35e47a 55%, #148f4a 90%);
        filter: drop-shadow(0 3px 5px rgba(0, 0, 0, 0.6)) drop-shadow(0 0 7px rgba(80, 255, 150, 0.6));
      }
      .hud-relic-off { opacity: 0.22; filter: grayscale(1) drop-shadow(0 3px 5px rgba(0, 0, 0, 0.6)); }
      .hud-icon-face {
        background-image: ${LIFE_FACE_URL};
        background-size: contain;
        background-repeat: no-repeat;
        background-position: center;
        /* the art carries its own black outline, so the shadow only has to
           lift it off whatever the world is doing behind it */
        filter: drop-shadow(0 4px 6px rgba(0, 0, 0, 0.6));
        /* .hud-icon pixelates by default for the blocky CSS icons; this one is
           a painting and wants the smooth downscale */
        image-rendering: auto;
        /* OPTICAL, not geometric, centring — two separate things were pushing
           the same way. The ears and the ponytail run from the top of the art
           down to 43/181 and read as spikes off the head rather than part of
           the blob, so the face the eye actually centres on has its centroid
           well below the box's middle. And the digit beside it is a Roo SVG
           whose glyph hangs HIGH in its own box, because the padded viewBox
           leaves room under it for the drop shadow. Together that left the
           head sitting ~12px low against an 86px digit. -14% is the eyeballed
           pick off a render sheet: it is more than the face centroid alone
           asks for (~8%), which lines the head's BOUNDING BOX up with the
           digit rather than its centre of mass. Nothing else animates this
           element's transform — hudpop only ever runs on the digits — so this
           is safe to own outright. */
        transform: none;
      }
      .hud-pop { animation: hudpop 0.22s ease-out; }
      /* IDLE BOB. Every persistent readout floats gently, so the corners
         feel alive rather than pasted on. It rides on the ROW, never on the
         digits or the icons themselves: the pop animation already owns the
         children's transform (and the face icon owns its own optical offset),
         and two animations on one property just fight. A row is also the only
         thing that moves the flat digits and the 3D icon TOGETHER — the crate,
         fruit and relic art is drawn straight into these boxes by drawIcons(),
         which re-measures every frame, so the models follow the DOM for free.
         The same is true of the flying-fruit target, which reads the wumpa
         icon's live rect and so lands on it wherever the bob has it.

         Slow and small on purpose: a ~3px sway over 5.5s.

         ONE PERIOD FOR EVERYTHING, with a small cascading NEGATIVE delay down
         each stack. Negative so the rows start already spread across the cycle
         instead of swinging up together on the first frame, and SMALL because
         the counter rows are only 8px apart: give them separate periods and
         they eventually drift into antiphase and close most of that gap, which
         reads as the HUD collapsing on itself.

         The delay is 0.25s of a 5.5s cycle — a twentieth. An eighth was the
         first guess, on the reasoning that two sinusoids that far apart differ
         by only ~1.2px; measured, it moved neighbours 2.55px, because an
         ease-in-out keyframe pair is much squarer than a sine and runs a lot
         faster through the middle of each swing. At a twentieth the neighbours
         move ~1.4px relative to each other, so an 8px gap stays an 8px gap and
         the stack still reads as one thing breathing with a wave down it
         rather than as a rigid slab. Transform only, so nothing reflows. */
      @keyframes hudbob {
        0%, 100% { transform: translateY(calc(var(--bob) * -1)); }
        50% { transform: translateY(var(--bob)); }
      }
      .hud-counter, .hud-scoreplate, .hud-ttclock {
        --bob: clamp(1.5px, 0.3vh, 3px);
        animation: hudbob 5.5s ease-in-out infinite;
        will-change: transform;
      }
      .hud-tl .hud-counter:nth-child(2) { animation-delay: -0.25s; }
      .hud-tl .hud-counter:nth-child(3) { animation-delay: -0.5s; }
      .hud-tr .hud-counter { animation-delay: -0.15s; }
      .hud-scoreplate { animation-delay: -0.4s; }
      .hud-ttclock { animation-delay: -0.15s; }
      .hud-counter.hud-pop { animation: hudpop 0.22s ease-out; }
      /* A player who has asked the OS for less motion gets none of it. */
      @media (prefers-reduced-motion: reduce) {
        .hud-counter, .hud-counter.hud-pop, .hud-scoreplate, .hud-ttclock,
        .hud-pop, .hud-special-ready { animation: none; }
      }
      @keyframes hudpop {
        0% { transform: scale(1.45); }
        100% { transform: scale(1); }
      }

      /* Explicit run-mode score: bare gold digits in the top-right column.
         Ordinary/Bonus play hides the plate entirely. */
      .hud-scoreplate { text-align: right; }
      .hud-scorelabel {
        font: bold clamp(10px, 1.7vh, 14px) Impact, 'Arial Black', sans-serif;
        letter-spacing: 4px;
        color: #ffd24a;
      }
      .hud-scorenum {
        font: 900 clamp(20px, 3.6vh, 32px) Impact, 'Arial Black', sans-serif;
        letter-spacing: 2px;
        color: #ffe9b0;
      }

      .hud-special {
        --special-turn: 0turn;
        position: absolute; inset: -7px; z-index: 0;
        border-radius: 50%; pointer-events: none;
        filter: drop-shadow(0 3px 4px rgba(0, 0, 0, 0.78));
      }
      .hud-special-track,
      .hud-special-fill {
        position: absolute; inset: 0; border-radius: 50%;
        -webkit-mask: radial-gradient(farthest-side, transparent calc(100% - 8px), #000 calc(100% - 7px));
        mask: radial-gradient(farthest-side, transparent calc(100% - 8px), #000 calc(100% - 7px));
      }
      .hud-special-track { background: rgba(38, 20, 10, 0.78); }
      .hud-special-fill {
        background: conic-gradient(
          from -90deg,
          #ff6d18 0turn,
          #ffc928 var(--special-turn),
          transparent var(--special-turn) 1turn
        );
        transition: background 0.08s linear;
      }
      .hud-special-ready {
        filter:
          drop-shadow(0 3px 4px rgba(0, 0, 0, 0.78))
          drop-shadow(0 0 10px rgba(255, 180, 31, 0.9));
        animation: specialpulse 0.42s ease-in-out infinite alternate;
      }
      .hud-special-ready .hud-special-fill {
        background: conic-gradient(
          from -90deg,
          #ff7a18 0turn,
          #fffbd0 var(--special-turn),
          transparent var(--special-turn) 1turn
        );
      }
      @keyframes specialpulse { from { opacity: 0.86; } to { opacity: 1; } }
      @media (prefers-reduced-motion: reduce) {
        .hud-special-ready { animation: none; }
      }

      /* TIME TRIAL: big top-right clock — bare gold digits like the score,
         ice blue while a time crate's freeze holds it still */
      /* No inset of its own: it is a row of the .hud-tr run-mode column. */
      /* same bottom margin the counter rows carry, so the score sits the same
         distance under the clock as it does under the lives */
      .hud-ttclock { text-align: right; margin-bottom: 8px; }
      .hud-tttime {
        font: 900 clamp(40px, 7.5vh, 66px) Impact, 'Arial Black', sans-serif;
        letter-spacing: 4px; color: #f2f7ff;
      }
      .hud-tt-frozen .hud-tttime { color: #6ee6ff; }
      .hud-ttfreeze {
        font: bold clamp(13px, 2vh, 18px) Impact, 'Arial Black', sans-serif;
        letter-spacing: 3px; color: #6ee6ff; margin-top: -4px;
      }
      /* ranked times card at the gate */
      .hud-ttresults {
        position: fixed; z-index: 15; top: 50%; left: 50%; transform: translate(-50%, -50%);
        min-width: 280px; text-align: center; pointer-events: none;
        color: #cfe3d8;
        background: linear-gradient(180deg, rgba(26, 30, 44, 0.94), rgba(10, 12, 18, 0.94));
        border: 1px solid #3a4152; border-radius: 12px; padding: 18px 28px 14px;
        box-shadow: inset 0 1px 0 rgba(255, 255, 255, 0.08), 0 10px 30px rgba(0, 0, 0, 0.55);
        font: 14px/1.6 ui-monospace, Menlo, Consolas, monospace;
      }
      .hud-ttres-title {
        font: bold 26px Impact, 'Arial Black', sans-serif;
        letter-spacing: 4px; color: #ffd24a; margin-bottom: 2px;
        text-shadow: 0 2px 5px rgba(0,0,0,0.7);
      }
      .hud-ttres-time {
        font: 900 44px Impact, 'Arial Black', sans-serif;
        letter-spacing: 3px; color: #ffe9b0; margin-bottom: 10px;
        text-shadow: 2px 0 0 #3a1c05, -2px 0 0 #3a1c05, 0 2px 0 #3a1c05, 0 -2px 0 #3a1c05;
      }
      .hud-ttrow {
        display: flex; justify-content: space-between; gap: 24px;
        padding: 1px 6px; border-radius: 4px; color: #9fb0c8;
      }
      .hud-ttrow-new { background: #2b4436; color: #b6f0cc; }
      .hud-ttres-sub { margin-top: 10px; color: #9fb0c8; font-size: 12px; letter-spacing: 1px; }

      /* Bottom-centre HUD items share one stack. The boost ring therefore
         rises above however many combo lines are live instead of occupying a
         fixed coordinate through the middle of them. With no combo, padding
         restores the ring's established 13%-from-bottom resting position. */
      .hud-combostack {
        position: fixed; z-index: 10; bottom: 4%; left: 50%;
        transform: translateX(-50%); width: min(94vw, 1100px);
        padding-bottom: 9vh; box-sizing: border-box;
        display: flex; flex-direction: column; align-items: center; gap: 8px;
        pointer-events: none;
      }
      .game-hud-layer.hud-combo-present .hud-combostack { padding-bottom: 0; }

      /* THPS trick readout — bare text, no plate, reads on any background.
         The entrance animation restarts on the existing display none->block
         toggle, so a fresh combo slams in without any new JS. */
      .hud-trickplate {
        position: relative; width: 100%; pointer-events: none;
        text-align: center; display: none;
        animation: trickin 0.18s ease-out;
      }
      @keyframes trickin {
        0% { transform: translateY(10px); opacity: 0.3; }
        100% { transform: translateY(0); opacity: 1; }
      }
      .hud-trickline {
        font: 400 clamp(23px, 3.7vh, 36px) 'Roo', Impact, 'Arial Black', sans-serif;
        line-height: 1.08; letter-spacing: 1px; color: #ffe08a;
        white-space: normal; overflow-wrap: normal;
        text-shadow: 2px 2px 0 #351806, 0 0 7px rgba(255, 176, 48, 0.34);
      }
      .hud-tricktotal {
        font: 400 clamp(38px, 6.2vh, 60px) 'Roo', Impact, 'Arial Black', sans-serif;
        letter-spacing: 4px; color: #ffb43a; margin-top: 4px;
        line-height: 1.05;
        text-shadow: 2px 2px 0 #351806, 0 0 8px rgba(255, 126, 20, 0.38);
        animation: combopulse 0.5s ease-in-out infinite alternate;
      }
      @keyframes combopulse {
        from { transform: scale(1); }
        to { transform: scale(1.05); }
      }
      /* Lost combo: preserve its copy, turn it red, and let it fall away. */
      .hud-trick-bail .hud-trickline,
      .hud-trick-bail .hud-tricktotal {
        color: #ff3b30 !important;
        text-shadow: 2px 2px 0 #3b0806, 0 0 10px #ff3b30;
        animation: none;
      }
      .hud-trick-bail { animation: trickbail 0.7s cubic-bezier(.36,.01,.74,.43) forwards; }
      @keyframes trickbail {
        0%   { transform: translateY(0); opacity: 1; }
        24%  { transform: translateY(3px); opacity: 1; }
        100% { transform: translateY(92px); opacity: 0; }
      }

      .hud-msg {
        position: fixed; z-index: 11; top: 34%; left: 50%; transform: translate(-50%, -50%);
        text-align: center; color: #fff; pointer-events: none;
      }
      .hud-msg-title {
        font: bold 52px ui-monospace, Menlo, Consolas, monospace; letter-spacing: 4px;
      }
      /* The sub-line is still real text, and small — it keeps the shadow the
         wrapper used to hand down, now that the title above it is drawn glyphs
         that carry their own outline and want none. */
      .hud-msg-sub {
        font: 16px ui-monospace, Menlo, Consolas, monospace; margin-top: 8px;
        color: #cfe3d8; text-shadow: 0 2px 6px rgba(0, 0, 0, 0.8);
      }
      .hud-flash {
        position: fixed; z-index: 12; inset: 0; background: #a3202a;
        opacity: 0; pointer-events: none;
      }
      /* death blackout: above the HUD, below the GAME OVER text */
      .hud-fade {
        position: fixed; z-index: 19; inset: 0; background: #000;
        opacity: 0; pointer-events: none;
      }
      /* combo-run halo: green glow breathing at the viewport edges.
         (inset box-shadow does the heavy lifting — it hugs all four edges at
         any aspect ratio; the farthest-corner gradient warms the corners) */
      .hud-halo {
        position: fixed; z-index: 8; inset: 0; pointer-events: none; opacity: 0;
        background: radial-gradient(ellipse farthest-corner at 50% 50%,
          transparent 60%, rgba(70, 232, 130, 0.14) 82%, rgba(70, 232, 130, 0.5) 100%);
        box-shadow: inset 0 0 clamp(70px, 11vw, 180px) rgba(70, 232, 130, 0.6);
        transition: opacity 0.45s ease;
      }
      .hud-halo.on { opacity: 1; animation: halopulse 1.5s ease-in-out infinite alternate; }
      .hud-halo.dissipate { opacity: 0; transition: opacity 1.15s ease; animation: none; }
      @keyframes halopulse {
        from { filter: brightness(0.85); }
        to { filter: brightness(1.3); }
      }
      .hud-death {
        position: fixed; z-index: 20; inset: 0; background: #000;
        display: none; flex-direction: column; align-items: center;
        justify-content: center; color: #fff;
        font: bold 54px ui-monospace, Menlo, Consolas, monospace;
        pointer-events: none; /* fullscreen INFO: it must never eat clicks */
      }
      .hud-death .hud-death-title { letter-spacing: 6px; }
      .hud-death .hud-death-sub {
        font-size: 16px; font-weight: normal; color: #9fb0c8; margin-top: 14px;
        letter-spacing: 2px;
      }
      /* balance-boost ring: green radial meter above the trick readout,
         lapping over itself when crate windows stack */
      .hud-boosts {
        position: relative; pointer-events: none;
        display: flex; flex-direction: column; gap: 5px; align-items: center;
      }
      .hud-boostring {
        width: 58px; height: 58px; border-radius: 50%;
        -webkit-mask: radial-gradient(closest-side, transparent 60%, #000 61%);
        mask: radial-gradient(closest-side, transparent 60%, #000 61%);
        filter: drop-shadow(0 0 6px rgba(70, 232, 130, 0.45));
      }
      .hud-boostlabel {
        font: bold 12px Impact, 'Arial Black', sans-serif; letter-spacing: 2px;
        color: #46e882;
      }
      .hud-boost-low { animation: boostblink 0.3s steps(2, start) infinite; }

      /* ---- Roo display face ----------------------------------------------
         Persistent readouts are SVG Roo labels (src/rootext.ts), so the
         rules that shape TEXT no longer bite: a text-shadow can't reach an
         <svg>, and colour/letter-spacing have nothing to act on. The size
         still comes from each rule's own font-size, which keeps every
         clamp() above driving the layout. What's left is a zero line-height
         — with no text in the box the font's own leading is dead space that
         would push the counter rows apart. The face carries its own keyline,
         so it needs no shadow to separate it from the level behind. */
      .hud-num, .hud-scorenum, .hud-scorelabel, .hud-tttime, .hud-ttfreeze,
      .hud-msg-title, .hud-death-title, .hud-boostlabel {
        line-height: 0;
      }
      /* The Roo message plate is centred with left:50% and no width, so its
         shrink-to-fit space would otherwise be only half the viewport. */
      .hud-msg { width: 94vw; max-width: 94vw; }
      .hud-death-title { max-width: 94vw; }
      /* Every Roo size in one place, and every one of them a CAP HEIGHT in
         px (the .roo-line note below explains why font-size and cap height
         are now the same number). The rules further up still carry the
         family and colour those readouts were born with; the size is settled
         here so a readout can't be sized twice with two different answers.

         The hierarchy: crate/fruit/lives counters lead, the trial clock
         matches them, and the score and small captions sit under that.

         THESE ARE HAND-PICKED, and the first pass at them was too timid.
         Making font-size mean cap height fixed a real bug — every readout was
         drawing 1.67x the type it asked for — but I then re-picked the numbers
         against nothing except the fact that they now fit, and a HUD that
         merely fits is not the same as a HUD you can read at a glance while
         you are busy playing. These came back up off a screenshot: counters
         56 -> 90, trial clock 54 -> 90, trick total 40 -> 60, trick name
         28 -> 36. */
      .hud-scorelabel { font-size: clamp(15px, 2.4vh, 22px); letter-spacing: 3px; }
      .hud-scorenum { font-size: clamp(24px, 4vh, 36px); }
      .hud-ttfreeze { font-size: clamp(15px, 2.3vh, 22px); margin-top: 1px; }
      .hud-boostlabel { font-size: 20px; }
      .hud-tttime { font-size: clamp(50px, 8.7vh, 90px); }
      /* The lives digit reads against a PAINTING, not a blocky icon, and at
         the shared .hud-num cap height it sat visibly short of the face
         beside it. Same clamp as .hud-icon, so the digit is exactly as tall
         as the portrait. */
      .hud-lives { font-size: clamp(68px, 10.7vh, 111px); }
      .hud-ttres-title { font-size: 42px; }
      .hud-ttres-time { font-size: 66px; }
      .hud-msg-title { font-size: 84px; }
      .hud-death-title { font-size: 104px; }
      /* ---- Roo display text -------------------------------------------
         The counters, the score and the trial clock are SVG Roo labels now
         (src/rootext.ts). roo-web's own rule sizes a label by its host's
         WIDTH, which is right for a centred title but wrong for a readout
         that has to keep one cap height while the digit count changes. So
         these hosts drive HEIGHT instead and let the width follow the
         glyphs, exactly like a line of text.

         THE BOX IS EXACTLY ONE VIEWBOX TALL, so font-size means cap height.
         The renderer pads its viewBox to 1.285 band heights (0.06 above, and
         0.06 + the drop shadow's 0.075 offset + 3 blur radii below — see the
         padding block in roo-text.js), and the svg is drawn at the box
         height, so a box of 1.285em renders a glyph of exactly 1em.

         That equivalence is the whole point. These hosts previously carried
         hand-picked 1.8-2.35em heights inherited from the era when the
         viewBox also held a keyline, a hard offset copy and an eleven-step
         extrusion — about 1.79 band heights of padding. Stripping those
         layers for the reference treatment cut the padding to 1.285 without
         the boxes changing, so every readout silently grew by ~40%: .hud-num
         asked for 78px type and drew 130px glyphs. One ratio, stated once,
         means each clamp() below can be read as the pixel cap height it
         actually produces. */
      .roo-line {
        line-height: 0; display: flex; align-items: center;
        height: 1.285em;
      }
      .roo-line > .roo-text-svg { width: auto; height: 100%; }
      /* Centred plates centre their glyphs; the corner readouts hang right. */
      .hud-msg-title.roo-line, .hud-death-title.roo-line,
      .hud-ttres-title.roo-line, .hud-boostlabel.roo-line {
        justify-content: center;
      }
      .hud-ttres-time.roo-line { margin-bottom: 10px; }
      /* The box is only as wide as the glyphs, so each readout says which end
         of its row it hangs from — the corner counters keep their old
         right-aligned column, the results time centres in its card.
         The SCORE caption belongs to that column too: its host is as wide as
         the lives row above it, and left alone a flex box starts its child at
         the LEFT, which stranded the word mid-air over a right-aligned
         number. text-align can't reach it — the glyphs are an <svg> child,
         not text. */
      .hud-scorenum.roo-line, .hud-scorelabel.roo-line,
      .hud-tttime.roo-line, .hud-ttfreeze.roo-line {
        justify-content: flex-end;
      }
      .hud-ttres-time.roo-line { justify-content: center; }
      /* The frozen clock's drawn face has its own colours, so the state reads
         as a glow instead of attempting to recolour the SVG glyph face. */
      .hud-tt-frozen .hud-tttime { filter: drop-shadow(0 0 9px #6ee6ff); }
      @keyframes boostblink { to { opacity: 0.35; } }

      .hud-balance {
        position: fixed; z-index: 10; left: 50%; bottom: 24%;
        transform: translateX(-50%); width: 240px; height: 14px;
        background: linear-gradient(180deg, rgba(8, 10, 15, 0.9), rgba(26, 30, 44, 0.9));
        border: 1px solid #3a4152; border-radius: 7px;
        box-shadow: inset 0 2px 3px rgba(0, 0, 0, 0.6), 0 1px 0 rgba(255, 255, 255, 0.12);
      }
      .game-hud-layer.hud-combo-present .hud-balance,
      .game-hud-layer.hud-combo-present .hud-vbalance {
        bottom: clamp(230px, 36vh, 330px);
      }
      .hud-balance-center {
        position: absolute; left: 50%; top: 2px; bottom: 2px; width: 2px;
        margin-left: -1px; background: #5a6478;
      }
      .hud-balance-needle {
        position: absolute; top: -4px; width: 8px; height: 20px;
        margin-left: -4px; border-radius: 4px; background: #8fd4a8;
        box-shadow: 0 2px 5px rgba(0, 0, 0, 0.5);
      }
      .hud-vbalance {
        position: fixed; z-index: 10; left: calc(50% + 96px); bottom: 22%;
        width: 14px; height: 132px;
        background: linear-gradient(90deg, rgba(8, 10, 15, 0.9), rgba(26, 30, 44, 0.9));
        border: 1px solid #3a4152; border-radius: 7px;
        box-shadow: inset 2px 0 3px rgba(0, 0, 0, 0.6), 0 1px 0 rgba(255, 255, 255, 0.12);
      }
      .hud-vbalance-center {
        position: absolute; top: 50%; left: 2px; right: 2px; height: 2px;
        margin-top: -1px; background: #5a6478;
      }
      .hud-vbalance-cap {
        position: absolute; left: 4px; right: 4px; height: 2px;
        background: #454e62; border-radius: 1px;
      }
      .hud-vbalance-needle {
        position: absolute; left: -4px; height: 8px; width: 22px;
        margin-top: -4px; border-radius: 4px; background: #8fd4a8;
        box-shadow: 0 2px 5px rgba(0, 0, 0, 0.5);
      }
      /* ---- mouse-only states ---------------------------------------------
         iOS fakes a hover on tap and then LEAVES IT ON until something else is
         touched, so a tapped row or button stayed lit as though it were still
         selected. Gated behind a real pointer, which phones do not report. */
      @media (hover: hover) {
        .hud-levelbtn:hover { background: #243044; color: #cfe3d8; }
        .hud-leveledit:hover { background: #2b4c38; color: #c8ffe0; }
        .hud-syncbtn:hover { background: #243044; color: #cfe3d8; }
        .hud-syncpushbtn:hover { background: #2b4c38; }
      }
    `;
    document.head.appendChild(style);
  }
}

// Restartable pop animation for counters that just changed.
function pop(el: HTMLElement): void {
  el.classList.remove("hud-pop");
  void el.offsetWidth; // reflow restarts the animation
  el.classList.add("hud-pop");
  el.addEventListener(
    "animationend",
    () => el.classList.remove("hud-pop"),
    { once: true },
  );
}

function div(cls: string): HTMLElement {
  const el = document.createElement("div");
  el.className = cls;
  return el;
}

function row(label: string, value: string): string {
  return `<div class="hud-row"><span>${label}</span><b>${esc(value)}</b></div>`;
}

// Values like the gamepad name are arbitrary strings going into innerHTML.
function esc(s: string): string {
  return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}
