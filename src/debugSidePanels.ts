export interface DebugSidePanel {
  id: string;
  label: string;
  element: HTMLElement;
  width: number;
  setOpen?: (open: boolean) => void;
  openAttribute?: 'data-open' | 'open';
}

type Entry = DebugSidePanel & { tab: HTMLButtonElement; pane: HTMLElement };

/** One drawer per screen edge. Existing tools retain their controls and state. */
export class DebugSidePanelGroup {
  readonly element = document.createElement('div');
  private readonly tabs = document.createElement('nav');
  private readonly content = document.createElement('div');
  private readonly entries = new Map<string, Entry>();
  private selected: string;
  private expanded: boolean;
  private keyboardFocus = false;

  constructor(private readonly side: 'left' | 'right', initial: string, private readonly beforeOpen: () => void) {
    installStyle();
    this.selected = localStorage.getItem(`solProtoPanelTab_${side}`) ?? initial;
    this.expanded = localStorage.getItem(`solProtoPanel_${side}`) === 'open';
    this.element.className = `side-wrap ${side}`;
    this.tabs.className = 'side-tabs';
    this.tabs.setAttribute('aria-label', `${side === 'left' ? 'Left' : 'Right'} debug panels`);
    this.content.className = 'side-content';
    this.element.append(...(side === 'left' ? [this.content, this.tabs] : [this.tabs, this.content]));
    this.tabs.addEventListener('keydown', event => {
      const buttons = [...this.entries.values()].map(entry => entry.tab), index = buttons.indexOf(event.target as HTMLButtonElement);
      if (index < 0) return;
      const next = event.key === 'ArrowDown' ? (index + 1) % buttons.length : event.key === 'ArrowUp' ? (index + buttons.length - 1) % buttons.length
        : event.key === 'Home' ? 0 : event.key === 'End' ? buttons.length - 1 : -1;
      if (next < 0) return;
      event.preventDefault(); event.stopPropagation(); buttons[next].focus();
    });
    this.element.addEventListener('keydown', event => {
      this.keyboardFocus = true;
      if (event.code === 'Escape' && this.expanded) {
        event.preventDefault(); event.stopPropagation(); this.close(true);
      }
    }, { capture: true });
    this.element.addEventListener('pointerdown', () => { this.keyboardFocus = false; }, { capture: true });
    this.element.addEventListener('keydown', event => {
      if (!['KeyM', 'F10'].includes(event.code)) event.stopPropagation();
    });
    this.render();
  }

  add(panel: DebugSidePanel): void {
    if (this.entries.has(panel.id)) return;
    const tab = document.createElement('button'), pane = document.createElement('section');
    tab.type = 'button'; tab.className = 'side-tab'; tab.textContent = panel.label;
    tab.dataset.debugTab = panel.id; tab.id = `debug-tab-${panel.id}`;
    pane.className = 'side-pane'; pane.id = `debug-panel-${panel.id}`;
    pane.setAttribute('aria-labelledby', tab.id);
    tab.setAttribute('aria-controls', pane.id);
    pane.append(panel.element); this.tabs.append(tab); this.content.append(pane);
    this.entries.set(panel.id, { ...panel, tab, pane });
    tab.addEventListener('click', event => {
      if (this.selected === panel.id && this.expanded) this.close(); else this.open(panel.id);
      if (event.detail > 0) tab.blur();
    });
    if (panel.element.shadowRoot) this.dockShadow(panel.element);
    if (panel.setOpen) {
      const attribute = panel.openAttribute ?? 'data-open';
      new MutationObserver(() => {
        const open = panel.element.hasAttribute(attribute);
        if (open && (!this.expanded || this.selected !== panel.id)) this.open(panel.id);
        else if (!open && this.expanded && this.selected === panel.id) this.close(true);
      }).observe(panel.element, { attributes: true, attributeFilter: [attribute] });
    }
    this.render();
  }

  open(id: string): void {
    if (!this.entries.has(id) || (this.expanded && this.selected === id)) return;
    this.beforeOpen();
    this.selected = id; this.expanded = true;
    this.render(); this.save();
    this.entries.get(id)!.tab.scrollIntoView({ block: 'nearest', inline: 'nearest' });
  }

  close(focusTab = false): void {
    this.expanded = false; this.render(); this.save();
    if (focusTab && this.keyboardFocus) this.entries.get(this.selected)?.tab.focus({ preventScroll: true });
    else if (!this.keyboardFocus && this.element.contains(document.activeElement)) {
      let focused = document.activeElement as HTMLElement | null;
      while (focused?.shadowRoot?.activeElement instanceof HTMLElement) focused = focused.shadowRoot.activeElement;
      focused?.blur();
    }
  }

  private save(): void {
    localStorage.setItem(`solProtoPanel_${this.side}`, this.expanded ? 'open' : 'closed');
    localStorage.setItem(`solProtoPanelTab_${this.side}`, this.selected);
  }

  private render(): void {
    const selected = this.entries.get(this.selected), open = this.expanded && !!selected;
    this.element.classList.toggle('collapsed', !open);
    this.element.dataset.activePanel = this.selected;
    this.element.style.setProperty('--side-panel-width', `${selected?.width ?? 272}px`);
    document.body.classList.toggle(`side-panel-${this.side}-open`, open);
    for (const entry of this.entries.values()) {
      const active = open && entry.id === this.selected;
      entry.tab.setAttribute('aria-expanded', String(active));
      entry.pane.hidden = entry.id !== this.selected;
      entry.pane.inert = !active;
      entry.pane.setAttribute('aria-hidden', String(!active));
      const attribute = entry.openAttribute ?? 'data-open';
      if (entry.setOpen && entry.element.hasAttribute(attribute) !== active) entry.setOpen(active);
    }
  }

  private dockShadow(host: HTMLElement): void {
    host.setAttribute('data-debug-docked', '');
    const style = document.createElement('style'); style.textContent = DOCKED_PANEL_CSS;
    host.shadowRoot!.append(style);
    // The standalone tools stop keyboard propagation inside their shadow roots.
    // Let the shared hide shortcut and CRT shortcut work from docked controls.
    host.shadowRoot!.addEventListener('keydown', event => {
      const key = event as KeyboardEvent, target = key.composedPath()[0];
      const editing = target instanceof HTMLTextAreaElement || target instanceof HTMLSelectElement
        || (target instanceof HTMLInputElement && !['range', 'checkbox', 'button'].includes(target.type));
      if (key.code === 'Escape') {
        key.preventDefault(); key.stopPropagation(); this.close(true);
      } else if (!editing && ['KeyM', 'F10'].includes(key.code)) {
        key.stopPropagation();
        host.dispatchEvent(new KeyboardEvent('keydown', { key: key.key, code: key.code, repeat: key.repeat, bubbles: true }));
      }
    }, { capture: true });
  }
}

const DOCKED_PANEL_CSS = `
  :host([data-debug-docked]) { position:relative; inset:auto; display:block; width:100%; height:100%; z-index:auto; }
  :host([data-debug-docked]) .launcher { display:none !important; }
  :host([data-debug-docked]) .panel { position:relative; inset:auto; width:100%; max-width:100%; height:100%; max-height:100%;
    border:1px solid #3a4152; box-shadow:none; }
  :host([data-debug-docked]) .sections, :host([data-debug-docked]) .groups { min-height:0; overscroll-behavior:contain; }
  @media(max-width:700px) {
    :host([data-debug-docked]) .control { grid-template-columns:minmax(0,1fr) 70px; }
    :host([data-debug-docked]) .control > :first-child { grid-column:1/-1; }
    :host([data-debug-docked]) .parameter { grid-template-columns:minmax(0,1fr) 70px auto; }
    :host([data-debug-docked]) .parameter-label { grid-column:1/-1; }
    :host([data-debug-docked]) .fixed-value { grid-column:1/3; }
    :host([data-debug-docked]) input[type=number] { width:70px; }
    :host([data-debug-docked]) .panel { overflow:auto; }
    :host([data-debug-docked]) .sections, :host([data-debug-docked]) .groups { flex:0 0 auto; overflow:visible; }
    :host([data-debug-docked]) .colors { grid-template-columns:1fr; }
    :host([data-debug-docked]) .selector { flex-wrap:wrap; }
  }
`;

function installStyle(): void {
  if (document.getElementById('debug-side-panel-style')) return;
  const style = document.createElement('style'); style.id = 'debug-side-panel-style';
  style.textContent = `
    .side-wrap { --side-tab-width:24px; --side-panel-height:calc(100dvh - max(10px, env(safe-area-inset-top)) - max(10px, env(safe-area-inset-bottom)));
      position:fixed; top:max(10px, env(safe-area-inset-top)); z-index:15; display:flex; align-items:flex-start; pointer-events:none;
      transition:transform .2s ease; }
    .side-wrap.left { left:0; } .side-wrap.right { right:0; }
    .side-wrap.left.collapsed { transform:translateX(calc(-100% + var(--side-tab-width))); }
    .side-wrap.right.collapsed { transform:translateX(calc(100% - var(--side-tab-width))); }
    .side-tabs { display:flex; flex-direction:column; gap:4px; flex:0 0 var(--side-tab-width); width:var(--side-tab-width);
      max-height:var(--side-panel-height); overflow:auto; scrollbar-width:none; overscroll-behavior:contain; pointer-events:auto; }
    .side-tabs::-webkit-scrollbar { display:none; }
    .side-tab { box-sizing:border-box; flex:none; width:var(--side-tab-width); padding:10px 2px; cursor:pointer;
      writing-mode:vertical-rl; text-orientation:upright; font:bold 10px ui-monospace,Menlo,Consolas,monospace;
      letter-spacing:2px; color:#cfe3d8; background:linear-gradient(180deg,#1a1e2cf5,#0a0c12f5);
      border:1px solid #3a4152; box-shadow:inset 0 1px 0 #ffffff14; }
    .side-tab[aria-expanded=true] { color:#b6f0cc; background:#2b4436; border-color:#8fd4a8; }
    .side-tab:hover, .side-tab:focus-visible { color:#fff; border-color:#8fd4a8; outline:1px solid #8fd4a8; outline-offset:-3px; }
    .side-wrap.left .side-tab { border-radius:0 8px 8px 0; border-left:0; }
    .side-wrap.right .side-tab { border-radius:8px 0 0 8px; border-right:0; }
    .side-content { width:var(--side-panel-width); max-width:calc(100vw - 2 * var(--side-tab-width) - 16px); height:var(--side-panel-height); }
    .side-pane { height:100%; max-height:100%; pointer-events:auto; }
    .side-pane[hidden] { display:none !important; }
    .side-wrap.collapsed .side-content { visibility:hidden; pointer-events:none; }
    .side-wrap .side-pane > .hud-tuning, .side-wrap .side-pane > .hud-stats { box-sizing:border-box; width:100%; min-width:0; max-width:none; max-height:100%; height:100%; overscroll-behavior:contain; }
    .side-pane .hud-tunebtns { flex-wrap:wrap; }
    .side-pane .hud-levelbtn { box-sizing:border-box; }
    .side-pane .hud-slider label { min-width:0; overflow-wrap:anywhere; }
    .side-pane .hud-slider input[type=range] { min-width:0; }
    .side-pane .secondary-text-tuner { position:static; inset:auto; width:100%; height:100%; z-index:auto; }
    .side-pane .secondary-text-tuner > summary { display:none; }
    .side-pane .secondary-text-tuner-body { width:100%; max-width:none; height:100%; max-height:100%; border-radius:0; overscroll-behavior:contain; }
    body.tc-on .side-wrap { --side-tab-width:48px; }
    body.tc-on .side-tab { width:var(--side-tab-width); min-height:48px; padding:10px 4px; font-size:11px; }
    @media(max-height:600px) {
      .side-wrap { --side-tab-width:62px; }
      .side-tab { writing-mode:horizontal-tb; text-orientation:mixed; min-height:36px; padding:7px 3px; font-size:10px; letter-spacing:.5px; }
      body.tc-on .side-wrap { --side-tab-width:62px; }
      body.tc-on .side-tab { min-height:48px; padding:8px 3px; font-size:10px; }
    }
    @media(prefers-reduced-motion:reduce) { .side-wrap { transition:none; } }
  `;
  document.head.append(style);
}
