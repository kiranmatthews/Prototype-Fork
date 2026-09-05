import {
  CAMPAIGN_ISLANDS,
  CAMPAIGN_LEVELS,
  campaignLevelByKey,
  type CampaignStore,
} from "./campaign";
import type { WorldMapSection } from "./worldMapController";

export interface WorldMapUICallbacks {
  onNavigate: (screenX: number, screenY: number) => void;
  onEnter: () => void;
  onOpenSection: (section: WorldMapSection) => void;
}

function node<K extends keyof HTMLElementTagNameMap>(
  tag: K,
  className: string,
): HTMLElementTagNameMap[K] {
  const element = document.createElement(tag);
  element.className = className;
  return element;
}

function formatTime(value: number | undefined): string {
  if (value === undefined || !Number.isFinite(value)) return "—";
  const minutes = Math.floor(value / 60);
  const seconds = Math.floor(value % 60);
  const milliseconds = Math.floor((value - Math.floor(value)) * 1000);
  return `${minutes}:${String(seconds).padStart(2, "0")}.${String(milliseconds).padStart(3, "0")}`;
}

export class WorldMapUI {
  private readonly root = node("section", "world-map-ui");
  private readonly islandName = node("strong", "world-map-island-name");
  private readonly islandSubtitle = node("span", "world-map-island-subtitle");
  private readonly islandProgress = node("span", "world-map-island-progress");
  private readonly eyebrow = node("span", "world-map-level-eyebrow");
  private readonly levelName = node("h1", "world-map-level-name");
  private readonly status = node("span", "world-map-level-status");
  private readonly trial = node("div", "world-map-trial");
  private readonly collectibleRow = node("div", "world-map-collectibles");
  private readonly enterButton = node("button", "world-map-enter");
  private selectedKey = "jungle";
  private moving = false;

  constructor(
    private readonly campaign: CampaignStore,
    private readonly callbacks: WorldMapUICallbacks,
  ) {
    this.root.setAttribute("aria-label", "Island world map");
    this.root.hidden = true;

    const islandCard = node("div", "world-map-island-card");
    islandCard.append(this.islandSubtitle, this.islandName, this.islandProgress);

    const levelCard = node("div", "world-map-level-card");
    const titleRow = node("div", "world-map-level-title-row");
    const titleCopy = node("div", "world-map-level-copy");
    titleCopy.append(this.eyebrow, this.levelName, this.status);
    this.collectibleRow.setAttribute("aria-label", "Level collectibles");
    titleRow.append(titleCopy, this.collectibleRow);
    levelCard.append(titleRow, this.trial);

    const navigation = node("div", "world-map-navigation");
    const navigationHint = node("span", "world-map-navigation-hint");
    navigationHint.textContent = "ARROWS / STICK";
    const arrowGrid = node("div", "world-map-arrow-grid");
    arrowGrid.append(
      this.navButton("↑", "Move up on map", 0, 1, "up"),
      this.navButton("←", "Move left on map", -1, 0, "left"),
      this.navButton("↓", "Move down on map", 0, -1, "down"),
      this.navButton("→", "Move right on map", 1, 0, "right"),
    );
    this.enterButton.type = "button";
    this.enterButton.innerHTML = '<span aria-hidden="true">×</span><strong>ENTER LEVEL</strong>';
    this.enterButton.addEventListener("click", () => this.callbacks.onEnter());
    navigation.append(navigationHint, arrowGrid, this.enterButton);

    const actionBar = node("nav", "world-map-actions");
    actionBar.setAttribute("aria-label", "World map actions");
    actionBar.append(
      this.actionButton("△", "VIEW PROGRESS", "I", "progress"),
      this.actionButton("⚙", "OPTIONS", "P", "options"),
      this.actionButton("□", "SAVE / LOAD", "L", "save-load"),
      this.actionButton("○", "QUIT GAME", "Q", "quit"),
    );

    this.root.append(islandCard, levelCard, navigation, actionBar);
    document.body.appendChild(this.root);
    this.injectStyle();
    (window as unknown as Record<string, unknown>).__worldMapUI = this;
  }

  show(progressKey: string, moving = false): void {
    this.selectedKey = progressKey;
    this.moving = moving;
    this.root.hidden = false;
    document.body.classList.add("world-map-active");
    this.render();
  }

  hide(): void {
    this.root.hidden = true;
    document.body.classList.remove("world-map-active");
  }

  setSelection(progressKey: string, moving: boolean): void {
    this.selectedKey = progressKey;
    this.moving = moving;
    if (!this.root.hidden) this.render();
  }

  private render(): void {
    const definition = campaignLevelByKey(this.selectedKey) ?? CAMPAIGN_LEVELS[0];
    const island = CAMPAIGN_ISLANDS.find(
      (candidate) => candidate.id === definition.islandId,
    ) ?? CAMPAIGN_ISLANDS[0];
    const progress = this.campaign.levelProgress(definition.levelId);
    const unlocked = this.campaign.levelUnlocked(definition.progressKey);
    const islandCleared = island.levelKeys.filter((key) => {
      const level = campaignLevelByKey(key);
      return level ? this.campaign.levelProgress(level.levelId)?.cleared : false;
    }).length;

    this.root.dataset.selectedKey = definition.progressKey;
    this.root.classList.toggle("is-moving", this.moving);
    this.root.classList.toggle("is-locked", !unlocked);
    this.root.classList.toggle("is-boss", definition.boss === true);
    this.islandName.textContent = island.name.toUpperCase();
    this.islandSubtitle.textContent = island.subtitle;
    this.islandProgress.textContent = `${islandCleared} / ${island.levelKeys.length} CLEARED`;
    this.eyebrow.textContent = this.moving
      ? "FOLLOWING THE CURRENT"
      : definition.boss
        ? `ISLAND GUARDIAN · ${island.name.toUpperCase()}`
        : `LEVEL ${CAMPAIGN_LEVELS.indexOf(definition) + 1} · ${island.name.toUpperCase()}`;
    this.levelName.textContent = definition.name.toUpperCase();
    this.status.textContent = this.moving
      ? "TRAVELLING…"
      : !unlocked
        ? "LOCKED"
        : progress?.cleared
          ? "COMPLETE · PLAY AGAIN"
          : "READY";
    this.enterButton.disabled = !unlocked || this.moving;
    this.enterButton.querySelector("strong")!.textContent = this.moving
      ? "TRAVELLING"
      : progress?.cleared
        ? "PLAY AGAIN"
        : definition.boss
          ? "FACE BOSS"
          : "ENTER LEVEL";

    const rewards = [
      ["◆", "CRYSTAL", progress?.crystal === true],
      ["◇", "BOX GEM", progress?.boxGem === true],
      ["⬙", "COMBO GEM", progress?.comboGem === true],
      ["◉", "TIME RELIC", progress?.timeRelic === true],
    ] as const;
    this.collectibleRow.replaceChildren();
    for (const [glyph, label, earned] of rewards) {
      const reward = node("span", `world-map-collectible${earned ? " earned" : ""}`);
      reward.setAttribute("aria-label", `${label}: ${earned ? "collected" : "missing"}`);
      reward.innerHTML = `<b aria-hidden="true">${glyph}</b><small>${label}</small>`;
      this.collectibleRow.appendChild(reward);
    }

    if (progress?.cleared) {
      this.trial.hidden = false;
      this.trial.innerHTML = `<span>⏱ TIME TRIAL UNLOCKED</span><strong>BEST ${formatTime(progress.bestTime)}</strong><small>TARGET ${formatTime(definition.relicTime)}</small>`;
    } else {
      this.trial.hidden = true;
      this.trial.replaceChildren();
    }
  }

  private navButton(
    glyph: string,
    label: string,
    screenX: number,
    screenY: number,
    direction: string,
  ): HTMLButtonElement {
    const button = node("button", `world-map-arrow world-map-arrow-${direction}`);
    button.type = "button";
    button.textContent = glyph;
    button.setAttribute("aria-label", label);
    button.addEventListener("click", () => this.callbacks.onNavigate(screenX, screenY));
    return button;
  }

  private actionButton(
    glyph: string,
    label: string,
    key: string,
    section: WorldMapSection,
  ): HTMLButtonElement {
    const button = node("button", "world-map-action");
    button.type = "button";
    button.innerHTML = `<span aria-hidden="true">${glyph}</span><strong>${label}</strong><kbd>${key}</kbd>`;
    button.addEventListener("click", () => this.callbacks.onOpenSection(section));
    return button;
  }

  private injectStyle(): void {
    const style = document.createElement("style");
    style.textContent = `
      .world-map-ui {
        position: fixed; inset: 0; z-index: 72; pointer-events: none;
        color: #fff8db; font-family: Roo, Impact, system-ui, sans-serif;
        filter: drop-shadow(0 4px 7px rgba(9,24,31,.35));
      }
      .world-map-ui[hidden], body.game-shell-modal .world-map-ui { display: none !important; }
      .world-map-island-card, .world-map-level-card {
        background: linear-gradient(145deg, rgba(35,94,82,.92), rgba(18,57,66,.9));
        border: 2px solid rgba(239,244,198,.68); box-shadow: 0 10px 24px rgba(6,28,38,.3), inset 0 1px rgba(255,255,255,.22);
        backdrop-filter: blur(9px); -webkit-backdrop-filter: blur(9px);
      }
      .world-map-island-card {
        position: absolute; top: max(22px, env(safe-area-inset-top)); left: max(26px, env(safe-area-inset-left));
        min-width: 210px; padding: 12px 20px 14px; border-radius: 8px 22px 8px 22px;
        display: grid; gap: 1px; transform: rotate(-1deg);
      }
      .world-map-island-subtitle, .world-map-level-eyebrow { color: #9be0c1; font: 800 11px/1.1 ui-monospace, monospace; letter-spacing: .14em; }
      .world-map-island-name { font-size: clamp(22px, 2.4vw, 34px); line-height: 1; letter-spacing: .025em; }
      .world-map-island-progress { color: #ffd568; font: 800 11px/1.2 ui-monospace, monospace; margin-top: 5px; }
      .world-map-level-card {
        position: absolute; top: max(20px, env(safe-area-inset-top)); left: 50%; transform: translateX(-50%);
        width: min(570px, 43vw); min-height: 114px; padding: 14px 22px 12px; box-sizing: border-box;
        border-radius: 26px 8px 26px 8px;
      }
      .world-map-level-title-row { display: flex; align-items: center; justify-content: space-between; gap: 18px; }
      .world-map-level-copy { min-width: 0; display: grid; }
      .world-map-level-name { margin: 2px 0 0; font-size: clamp(28px, 3.2vw, 48px); line-height: .96; color: #fff0b6; text-shadow: 0 3px #173c3f; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
      .world-map-level-status { color: #ffd568; font: 900 11px/1.2 ui-monospace, monospace; letter-spacing: .08em; margin-top: 5px; }
      .world-map-ui.is-locked .world-map-level-status { color: #b7c3c4; }
      .world-map-ui.is-boss .world-map-level-name { color: #ffd456; }
      .world-map-collectibles { display: grid; grid-template-columns: repeat(4, 40px); gap: 5px; flex: 0 0 auto; }
      .world-map-collectible { display: grid; place-items: center; color: rgba(153,177,176,.46); }
      .world-map-collectible b { font: 900 25px/1 system-ui, sans-serif; }
      .world-map-collectible small { margin-top: 2px; color: inherit; font: 700 7px/1 ui-monospace, monospace; white-space: nowrap; }
      .world-map-collectible.earned { color: #f8e3ff; text-shadow: 0 0 10px #d75fff; }
      .world-map-collectible:nth-child(3).earned { color: #86f29a; text-shadow: 0 0 10px #43ce66; }
      .world-map-collectible:nth-child(4).earned { color: #7fd3ff; text-shadow: 0 0 10px #389be7; }
      .world-map-trial { display: flex; gap: 13px; align-items: center; margin-top: 9px; padding-top: 7px; border-top: 1px solid rgba(229,248,214,.24); font: 800 10px/1.1 ui-monospace, monospace; }
      .world-map-trial span { color: #a7efc9; } .world-map-trial strong { color: #fff; } .world-map-trial small { color: #ffd568; }
      .world-map-navigation { position: absolute; left: max(25px, env(safe-area-inset-left)); bottom: max(88px, calc(env(safe-area-inset-bottom) + 72px)); display: flex; align-items: center; gap: 12px; }
      .world-map-navigation-hint { color: #e9f5e1; font: 900 10px/1 ui-monospace, monospace; writing-mode: vertical-rl; transform: rotate(180deg); letter-spacing: .12em; }
      .world-map-arrow-grid { pointer-events: auto; display: grid; grid-template-columns: repeat(3, 34px); grid-template-rows: repeat(2, 34px); gap: 3px; }
      .world-map-arrow, .world-map-enter, .world-map-action { border: 0; color: #fff8db; font-family: inherit; cursor: pointer; touch-action: manipulation; }
      .world-map-arrow { border-radius: 9px; background: rgba(16,58,64,.82); box-shadow: inset 0 0 0 2px rgba(226,246,210,.48); font: 900 20px/1 system-ui; }
      .world-map-arrow:hover, .world-map-arrow:focus-visible, .world-map-action:hover, .world-map-action:focus-visible, .world-map-enter:hover, .world-map-enter:focus-visible { outline: 3px solid #ffd45d; outline-offset: 2px; }
      .world-map-arrow-up { grid-column: 2; grid-row: 1; } .world-map-arrow-left { grid-column: 1; grid-row: 2; } .world-map-arrow-down { grid-column: 2; grid-row: 2; } .world-map-arrow-right { grid-column: 3; grid-row: 2; }
      .world-map-enter { pointer-events: auto; display: flex; align-items: center; gap: 9px; min-height: 48px; padding: 8px 17px; border-radius: 24px; background: linear-gradient(#f3a83f, #d76b27); box-shadow: inset 0 2px rgba(255,255,255,.38), 0 7px 16px rgba(31,39,27,.28); }
      .world-map-enter span { display: grid; place-items: center; width: 27px; height: 27px; border: 2px solid #fff; border-radius: 50%; font: 900 22px/1 system-ui; }
      .world-map-enter strong { font-size: 21px; white-space: nowrap; }
      .world-map-enter:disabled { filter: grayscale(.8); opacity: .45; cursor: default; }
      .world-map-actions { position: absolute; left: 50%; bottom: max(18px, env(safe-area-inset-bottom)); transform: translateX(-50%); pointer-events: auto; display: flex; gap: clamp(9px, 1.6vw, 24px); padding: 9px 17px; border-radius: 26px; background: rgba(10,40,48,.76); border: 1px solid rgba(229,247,220,.4); backdrop-filter: blur(9px); -webkit-backdrop-filter: blur(9px); }
      .world-map-action { display: flex; align-items: center; gap: 7px; padding: 4px 5px; background: transparent; }
      .world-map-action span { color: #ffd45d; font: 900 17px/1 system-ui; } .world-map-action strong { font-size: clamp(13px, 1.25vw, 19px); white-space: nowrap; }
      .world-map-action kbd { color: #9be0c1; border: 1px solid rgba(155,224,193,.5); border-radius: 4px; padding: 2px 4px; font: 800 9px/1 ui-monospace, monospace; }
      .world-map-ui.is-moving .world-map-arrow-grid, .world-map-ui.is-moving .world-map-enter { opacity: .38; pointer-events: none; }
      @media (max-width: 980px) {
        .world-map-island-card { min-width: 0; max-width: 25vw; }
        .world-map-level-card { width: 54vw; }
        .world-map-action kbd { display: none; }
        .world-map-actions { gap: 5px; }
      }
      @media (pointer: coarse), (max-height: 520px) {
        .world-map-island-card { display: none; }
        .world-map-island-name { font-size: 21px; }
        .world-map-level-card { top: max(8px, env(safe-area-inset-top)); width: min(58vw, 520px); min-height: 0; padding: 9px 14px; }
        .world-map-level-name { font-size: clamp(24px, 7vh, 34px); }
        .world-map-collectibles { grid-template-columns: repeat(4, 31px); }
        .world-map-collectible small { display: none; }
        .world-map-trial { margin-top: 5px; padding-top: 4px; }
        .world-map-navigation { display: none; }
        .world-map-actions { top: max(8px, env(safe-area-inset-top)); right: max(8px, env(safe-area-inset-right)); bottom: auto; left: auto; transform: none; display: grid; grid-template-columns: repeat(2, 72px); gap: 5px; padding: 6px; border-radius: 14px; }
        .world-map-action { min-width: 72px; min-height: 40px; justify-content: center; padding: 0; flex-direction: column; gap: 2px; }
        .world-map-action strong { display: block; font: 800 8px/1 ui-monospace, monospace; letter-spacing: -.03em; }
        .world-map-action span { font-size: 15px; }
      }
      @media (orientation: portrait) {
        .world-map-island-card { max-width: 36vw; }
        .world-map-level-card { top: 13vh; width: 88vw; }
        .world-map-level-name { font-size: 34px; }
        .world-map-actions { left: 50%; right: auto; top: auto; bottom: max(20px, env(safe-area-inset-bottom)); transform: translateX(-50%); display: grid; grid-template-columns: repeat(4, 48px); }
        .world-map-action { min-width: 48px; }
        .world-map-action strong { position: absolute; width: 1px; height: 1px; overflow: hidden; clip: rect(0 0 0 0); }
      }
    `;
    document.head.appendChild(style);
  }
}
