import {
  CAMPAIGN_ISLANDS,
  CAMPAIGN_LEVELS,
  campaignLevelByKey,
  type CampaignStore,
} from "./campaign";
import type {
  WorldMapDirections,
  WorldMapSection,
} from "./worldMapController";

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
  private readonly eyebrow = node("span", "world-map-level-eyebrow");
  private readonly levelName = node("h1", "world-map-level-name");
  private readonly status = node("span", "world-map-level-status");
  private readonly trial = node("div", "world-map-trial");
  private readonly collectibleRow = node("div", "world-map-collectibles");
  private readonly unlockNotice = node("div", "world-map-unlock-notice");
  private selectedKey = "jungle";
  private moving = false;
  private unlockNoticeTimer: number | null = null;

  constructor(
    private readonly campaign: CampaignStore,
    private readonly callbacks: WorldMapUICallbacks,
  ) {
    this.root.setAttribute("aria-label", "Island world map");
    this.root.hidden = true;

    const levelCard = node("div", "world-map-level-card");
    const titleRow = node("div", "world-map-level-title-row");
    const titleCopy = node("div", "world-map-level-copy");
    titleCopy.append(this.eyebrow, this.levelName, this.status);
    this.collectibleRow.setAttribute("aria-label", "Level collectibles");
    titleRow.append(titleCopy, this.collectibleRow);
    levelCard.append(titleRow, this.trial);

    const actionBar = node("nav", "world-map-actions");
    actionBar.setAttribute("aria-label", "World map actions");
    actionBar.append(
      this.actionButton("△", "VIEW PROGRESS", "I", "progress"),
      this.actionButton("⚙", "OPTIONS", "P", "options"),
      this.actionButton("□", "SAVE / LOAD", "L", "save-load"),
      this.actionButton("○", "QUIT GAME", "Q", "quit"),
    );

    this.unlockNotice.setAttribute("role", "status");
    this.unlockNotice.setAttribute("aria-live", "polite");
    this.unlockNotice.hidden = true;
    this.root.append(levelCard, actionBar, this.unlockNotice);
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
    this.unlockNotice.classList.remove("show");
    this.unlockNotice.hidden = true;
    this.unlockNotice.textContent = "";
    if (this.unlockNoticeTimer !== null) window.clearTimeout(this.unlockNoticeTimer);
    this.unlockNoticeTimer = null;
    document.body.classList.remove("world-map-active");
  }

  announceUnlock(progressKeys: readonly string[]): void {
    const names = progressKeys
      .map((key) => campaignLevelByKey(key)?.name)
      .filter((name): name is string => !!name);
    if (!names.length) return;
    if (this.unlockNoticeTimer !== null) window.clearTimeout(this.unlockNoticeTimer);
    this.unlockNotice.hidden = false;
    this.unlockNotice.textContent = `NEW PATH OPEN · ${names.join(" / ").toUpperCase()}`;
    this.unlockNotice.classList.remove("show");
    void this.unlockNotice.offsetWidth;
    this.unlockNotice.classList.add("show");
    this.unlockNoticeTimer = window.setTimeout(() => {
      this.unlockNotice.classList.remove("show");
      this.unlockNoticeTimer = window.setTimeout(() => {
        this.unlockNotice.hidden = true;
        this.unlockNotice.textContent = "";
        this.unlockNoticeTimer = null;
      }, 240);
    }, 3600);
  }

  setSelection(
    progressKey: string,
    moving: boolean,
    _directions?: WorldMapDirections,
  ): void {
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
    this.root.dataset.selectedKey = definition.progressKey;
    this.root.classList.toggle("is-moving", this.moving);
    this.root.classList.toggle("is-locked", !unlocked);
    this.root.classList.toggle("is-boss", definition.boss === true);
    this.eyebrow.textContent = this.moving
      ? "FOLLOWING THE CURRENT"
      : definition.boss
        ? `ISLAND FINALE · ${island.name.toUpperCase()}`
        : `LEVEL ${CAMPAIGN_LEVELS.indexOf(definition) + 1} · ${island.name.toUpperCase()}`;
    this.levelName.textContent = definition.name.toUpperCase();
    this.status.textContent = this.moving
      ? "TRAVELLING…"
      : !unlocked
        ? "LOCKED"
        : progress?.cleared
          ? "COMPLETE · PLAY AGAIN"
          : "READY";
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
      .world-map-ui[hidden], body.game-shell-modal .world-map-ui, body.game-shell-transitioning .world-map-ui { display: none !important; }
      .world-map-level-card {
        background: linear-gradient(145deg, rgba(69,78,54,.94), rgba(24,55,57,.93));
        border: 2px solid rgba(250,220,151,.74); box-shadow: 0 10px 24px rgba(6,28,38,.3), inset 0 1px rgba(255,255,255,.22);
        backdrop-filter: blur(9px); -webkit-backdrop-filter: blur(9px);
      }
      .world-map-level-eyebrow { color: #9be0c1; font: 800 11px/1.1 ui-monospace, monospace; letter-spacing: .14em; }
      .world-map-level-card {
        position: absolute; top: max(20px, env(safe-area-inset-top)); right: max(26px, env(safe-area-inset-right));
        width: min(600px, 47vw); min-height: 96px; padding: 11px 18px 10px; box-sizing: border-box;
        border-radius: 26px 8px 26px 8px;
      }
      .world-map-level-title-row { display: flex; align-items: center; justify-content: space-between; gap: 18px; }
      .world-map-level-copy { min-width: 0; display: grid; }
      .world-map-level-name { margin: 2px 0 0; font-size: clamp(27px, 2.6vw, 40px); line-height: .96; color: #fff0b6; text-shadow: 0 3px #173c3f; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
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
      .world-map-action { border: 0; color: #fff8db; font-family: inherit; cursor: pointer; touch-action: manipulation; }
      .world-map-action:hover, .world-map-action:focus-visible { outline: 3px solid #ffd45d; outline-offset: 2px; }
      .world-map-actions { position: absolute; left: 50%; bottom: max(18px, env(safe-area-inset-bottom)); transform: translateX(-50%); pointer-events: auto; display: flex; gap: clamp(9px, 1.6vw, 24px); padding: 9px 17px; border-radius: 26px; background: rgba(10,40,48,.76); border: 1px solid rgba(229,247,220,.4); backdrop-filter: blur(9px); -webkit-backdrop-filter: blur(9px); }
      .world-map-action { display: flex; align-items: center; gap: 7px; padding: 4px 5px; background: transparent; }
      .world-map-action span { color: #ffd45d; font: 900 17px/1 system-ui; } .world-map-action strong { font-size: clamp(13px, 1.25vw, 19px); white-space: nowrap; }
      .world-map-action kbd { color: #9be0c1; border: 1px solid rgba(155,224,193,.5); border-radius: 4px; padding: 2px 4px; font: 800 9px/1 ui-monospace, monospace; }
      .world-map-unlock-notice { position: absolute; left: 50%; top: 21%; transform: translate(-50%, -18px) scale(.92); opacity: 0; padding: 10px 22px; border: 2px solid #fff0a3; border-radius: 22px; background: linear-gradient(135deg, rgba(237,131,41,.96), rgba(198,72,30,.96)); color: #fff8d5; box-shadow: 0 8px 25px rgba(36,19,7,.36); font-size: clamp(20px, 2.2vw, 31px); letter-spacing: .035em; text-align: center; transition: opacity .22s, transform .32s cubic-bezier(.2,1.4,.4,1); }
      .world-map-unlock-notice.show { opacity: 1; transform: translate(-50%, 0) scale(1); }
      @media (max-width: 980px) {
        .world-map-level-card { width: 54vw; }
        .world-map-action kbd { display: none; }
        .world-map-actions { gap: 5px; }
      }
      @media (pointer: coarse) {
        .world-map-level-card { top: max(8px, env(safe-area-inset-top)); right: auto; left: 50%; transform: translateX(-50%); width: min(58vw, 520px); min-height: 0; padding: 9px 14px; }
        .world-map-level-name { font-size: clamp(24px, 7vh, 34px); }
        .world-map-collectibles { grid-template-columns: repeat(4, 31px); }
        .world-map-collectible small { display: none; }
        .world-map-trial { margin-top: 5px; padding-top: 4px; }
        .world-map-actions { top: max(8px, env(safe-area-inset-top)); right: max(8px, env(safe-area-inset-right)); bottom: auto; left: auto; transform: none; display: grid; grid-template-columns: repeat(2, 72px); gap: 5px; padding: 6px; border-radius: 14px; }
        .world-map-action { min-width: 72px; min-height: 40px; justify-content: center; padding: 0; flex-direction: column; gap: 2px; }
        .world-map-action strong { display: block; font: 800 8px/1 ui-monospace, monospace; letter-spacing: -.03em; }
        .world-map-action span { font-size: 15px; }
      }
      @media (max-height: 520px) and (pointer: fine) {
        .world-map-level-card { top: max(8px, env(safe-area-inset-top)); right: auto; left: 50%; transform: translateX(-50%); width: min(58vw, 520px); min-height: 0; padding: 9px 14px; }
        .world-map-level-name { font-size: clamp(24px, 7vh, 34px); }
        .world-map-collectibles { grid-template-columns: repeat(4, 31px); }
        .world-map-collectible small { display: none; }
        .world-map-trial { margin-top: 5px; padding-top: 4px; }
        .world-map-actions { top: max(8px, env(safe-area-inset-top)); right: max(8px, env(safe-area-inset-right)); bottom: auto; left: auto; transform: none; display: grid; grid-template-columns: repeat(2, 72px); gap: 5px; padding: 6px; border-radius: 14px; }
        .world-map-action { min-width: 72px; min-height: 40px; justify-content: center; padding: 0; flex-direction: column; gap: 2px; }
        .world-map-action strong { display: block; font: 800 8px/1 ui-monospace, monospace; letter-spacing: -.03em; }
        .world-map-action span { font-size: 15px; }
      }
      @media (orientation: portrait) {
        .world-map-level-card { top: 11vh; right: auto; left: 50%; transform: translateX(-50%); width: 88vw; }
        .world-map-level-title-row { display: grid; gap: 7px; }
        .world-map-level-name { font-size: 32px; }
        .world-map-collectibles { width: 100%; grid-template-columns: repeat(4, 1fr); }
        .world-map-actions { left: 50%; right: auto; top: auto; bottom: calc(var(--tc-size, 168px) + max(10px, env(safe-area-inset-bottom)) + 14px); transform: translateX(-50%); display: grid; grid-template-columns: repeat(4, 48px); }
        .world-map-action { min-width: 48px; }
        .world-map-action strong { position: absolute; width: 1px; height: 1px; overflow: hidden; clip: rect(0 0 0 0); }
        .world-map-unlock-notice { top: calc(11vh + 185px); width: max-content; max-width: 82vw; }
      }
    `;
    document.head.appendChild(style);
  }
}
