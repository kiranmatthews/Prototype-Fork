import {
  CRT_GUEST_DEFAULT_FILE_NAME,
  CRT_GUEST_PARAMETER_GROUPS,
  CRT_GUEST_QUALITIES,
  CRT_GUEST_SOURCE_COMMIT,
  CRT_GUEST_VARIANTS,
  CrtGuestSettings,
  CrtGuestSettingsChange,
  CrtGuestVariant,
  crtGuestSettings,
  getCrtGuestRange,
  type CrtGuestParameterDefinition,
  type CrtGuestQuality,
} from "./settings";

export type CrtGuestPanelToggleBinder = (
  toggle: () => void,
) => void | (() => void);

export interface CrtGuestTuningPanelOptions {
  settings?: CrtGuestSettings;
  parent?: HTMLElement;
  document?: Document;
  initiallyOpen?: boolean;
  showLauncher?: boolean;
  launcherLabel?: string;
  bindToggle?: CrtGuestPanelToggleBinder;
  onOpenChange?: (open: boolean) => void;
}

interface ParameterControls {
  readonly parameter: CrtGuestParameterDefinition;
  readonly variant: CrtGuestVariant;
  readonly slider: HTMLInputElement;
  readonly numeric: HTMLInputElement;
}

const PANEL_CSS = [
  ":host {",
  "  all: initial; position: fixed; inset: 0; z-index: 90;",
  "  pointer-events: none; color: #e8fff5;",
  "  font: 12px/1.25 ui-monospace, SFMono-Regular, Menlo, Consolas, monospace;",
  "}",
  "*, *::before, *::after { box-sizing: border-box; border-radius: 0 !important; }",
  "button, input { font: inherit; }",
  ".launcher {",
  "  position: fixed; top: 28%; right: 0; z-index: 2; pointer-events: auto;",
  "  min-width: 42px; padding: 10px 7px; border: 1px solid #77ffd0; border-right: 0;",
  "  background: #09100e; color: #a8ffe0; cursor: pointer; font-weight: 900;",
  "  letter-spacing: 1px; box-shadow: -4px 4px 0 rgba(0, 0, 0, .55);",
  "}",
  ".launcher:hover, .launcher:focus-visible { background: #17382e; outline: 1px solid #fff; outline-offset: -3px; }",
  ":host([data-open]) .launcher { display: none; }",
  ".panel {",
  "  position: fixed; top: 12px; right: 12px; bottom: 12px; z-index: 3;",
  "  width: min(620px, calc(100vw - 24px)); display: none; flex-direction: column;",
  "  pointer-events: auto; overflow: hidden; border: 2px solid #8fffd7;",
  "  background: #080d0c; box-shadow: -10px 10px 0 rgba(0, 0, 0, .72);",
  "}",
  ":host([data-open]) .panel { display: flex; }",
  ".titlebar {",
  "  flex: 0 0 auto; display: flex; align-items: center; gap: 10px; padding: 10px 12px;",
  "  border-bottom: 2px solid #8fffd7; background: #10211c;",
  "}",
  ".title { flex: 1; font-size: 14px; font-weight: 900; letter-spacing: 1.2px; color: #b9ffe7; }",
  ".close { width: 31px; height: 27px; padding: 0; }",
  ".controls { flex: 0 0 auto; display: grid; gap: 8px; padding: 10px 12px; border-bottom: 1px solid #386b5a; }",
  ".meta { color: #74a997; font-size: 10px; overflow-wrap: anywhere; }",
  ".enable { display: flex; align-items: center; gap: 8px; font-weight: 800; }",
  ".enable input { width: 17px; height: 17px; margin: 0; accent-color: #76ffd0; }",
  ".line { display: flex; flex-wrap: wrap; gap: 6px; align-items: center; }",
  ".line-label { width: 62px; color: #79aa99; text-transform: uppercase; font-size: 10px; letter-spacing: .8px; }",
  "button {",
  "  min-height: 28px; padding: 5px 9px; border: 1px solid #477b69;",
  "  background: #111b18; color: #dfffee; cursor: pointer;",
  "}",
  "button:hover, button:focus-visible { border-color: #c5ffea; background: #1b332b; outline: none; }",
  "button[aria-pressed='true'] { border-color: #8fffd7; background: #285e4c; color: #fff; box-shadow: inset 0 -3px #8fffd7; }",
  ".status { min-height: 16px; padding: 1px 0; color: #a9d7c7; overflow-wrap: anywhere; }",
  ".status[data-error] { color: #ff9c9c; }",
  ".groups { flex: 1 1 auto; overflow: auto; padding: 8px 10px 16px; scrollbar-color: #5ba78d #09100e; }",
  "details { border: 1px solid #294d41; border-bottom: 0; background: #0b1210; }",
  "details:last-child { border-bottom: 1px solid #294d41; }",
  "summary {",
  "  display: flex; align-items: center; justify-content: space-between; gap: 8px;",
  "  padding: 9px 10px; cursor: pointer; color: #9dffdc; background: #101e1a;",
  "  font-weight: 900; letter-spacing: .5px; text-transform: uppercase; user-select: none;",
  "}",
  "summary:hover { background: #19362c; }",
  ".count { color: #648f80; font-size: 10px; }",
  ".parameter {",
  "  display: grid; grid-template-columns: minmax(190px, 1.4fr) minmax(110px, 1fr) 82px auto;",
  "  gap: 8px; align-items: center; min-height: 42px; padding: 6px 9px; border-top: 1px solid #1e342d;",
  "}",
  ".parameter:nth-child(odd) { background: #0d1714; }",
  ".parameter-label { min-width: 0; overflow-wrap: anywhere; color: #d8f7eb; }",
  ".parameter-id { display: block; margin-top: 2px; color: #547f70; font-size: 10px; }",
  ".range { width: 100%; min-width: 80px; margin: 0; accent-color: #7dffd2; }",
  ".numeric {",
  "  width: 82px; height: 28px; padding: 4px 5px; border: 1px solid #477b69;",
  "  background: #050807; color: #fff; text-align: right; outline: none;",
  "}",
  ".numeric:focus { border-color: #fff; box-shadow: inset 0 -2px #8fffd7; }",
  ".numeric:disabled, .range:disabled { opacity: .55; }",
  ".mini { min-width: 30px; padding: 3px 5px; font-size: 10px; }",
  ".locked { color: #79aa99; font-size: 9px; text-transform: uppercase; letter-spacing: .5px; }",
  ".hidden-file { display: none; }",
  "@media (max-width: 560px) {",
  "  .panel { top: 0; right: 0; bottom: 0; width: 100vw; }",
  "  .parameter { grid-template-columns: minmax(150px, 1fr) 84px 72px auto; gap: 5px; padding-inline: 6px; }",
  "  .numeric { width: 72px; }",
  "  .groups { padding-inline: 5px; }",
  "}",
].join("\n");

export class CrtGuestTuningPanel {
  readonly settings: CrtGuestSettings;
  readonly element: HTMLDivElement;

  private readonly document: Document;
  private readonly shadow: ShadowRoot;
  private readonly launcher: HTMLButtonElement;
  private readonly panel: HTMLElement;
  private readonly closeButton: HTMLButtonElement;
  private readonly enabledInput: HTMLInputElement;
  private readonly variantButtons = new Map<CrtGuestVariant, HTMLButtonElement>();
  private readonly qualityButtons = new Map<CrtGuestQuality, HTMLButtonElement>();
  private readonly status: HTMLElement;
  private readonly groups: HTMLElement;
  private readonly fileInput: HTMLInputElement;
  private readonly parameterControls = new Map<string, ParameterControls>();
  private readonly expandedGroups = new Set<string>(["afterglow", "scanlines"]);
  private readonly onOpenChange?: (open: boolean) => void;
  private readonly unsubscribeSettings: () => void;
  private readonly unbindToggle: (() => void) | null;
  private openState = false;
  private disposed = false;

  constructor(options: CrtGuestTuningPanelOptions = {}) {
    const parent = options.parent;
    const documentRef =
      options.document ?? parent?.ownerDocument ??
      (typeof document === "undefined" ? null : document);
    if (!documentRef) {
      throw new Error("CrtGuestTuningPanel requires a browser Document.");
    }

    this.document = documentRef;
    this.settings = options.settings ?? crtGuestSettings;
    this.onOpenChange = options.onOpenChange;
    this.element = documentRef.createElement("div");
    this.element.setAttribute("data-crt-guest-panel-host", "");
    this.shadow = this.element.attachShadow({ mode: "open" });
    // The game owns global keyboard input. Keep number entry, slider arrows,
    // Space and hotkeys inside this sharp developer overlay from steering or
    // firing gameplay actions behind it.
    for (const eventName of ["keydown", "keyup", "keypress"] as const) {
      this.shadow.addEventListener(eventName, (event) => event.stopPropagation());
    }

    const style = documentRef.createElement("style");
    style.textContent = PANEL_CSS;
    this.shadow.appendChild(style);

    this.launcher = this.button(options.launcherLabel ?? "CRT", "launcher");
    this.launcher.title = "Open CRT Guest presentation tuning";
    this.launcher.setAttribute("aria-label", "Open CRT Guest tuning panel");
    this.launcher.setAttribute("aria-expanded", "false");
    this.launcher.hidden = options.showLauncher === false;
    this.launcher.addEventListener("click", () => this.open());
    this.shadow.appendChild(this.launcher);

    this.panel = this.make("section", "panel");
    this.panel.setAttribute("role", "dialog");
    this.panel.setAttribute("aria-modal", "false");
    this.panel.setAttribute("aria-label", "CRT Guest tuning panel");

    const titlebar = this.make("header", "titlebar");
    titlebar.appendChild(this.make("div", "title", "CRT GUEST — PRESENTATION"));
    this.closeButton = this.button("×", "close");
    this.closeButton.title = "Close CRT tuning panel";
    this.closeButton.setAttribute("aria-label", "Close CRT tuning panel");
    this.closeButton.addEventListener("click", () => this.close());
    titlebar.appendChild(this.closeButton);
    this.panel.appendChild(titlebar);

    const controls = this.make("div", "controls");
    controls.appendChild(
      this.make(
        "div",
        "meta",
        "Presentation only · source " + CRT_GUEST_SOURCE_COMMIT,
      ),
    );

    const enabledLabel = this.make("label", "enable");
    this.enabledInput = documentRef.createElement("input");
    this.enabledInput.type = "checkbox";
    this.enabledInput.addEventListener("change", () => {
      this.settings.setEnabled(this.enabledInput.checked);
    });
    enabledLabel.append(this.enabledInput, " Enable CRT Guest");
    controls.appendChild(enabledLabel);

    const variantLine = this.make("div", "line");
    variantLine.appendChild(this.make("span", "line-label", "Variant"));
    for (const variant of CRT_GUEST_VARIANTS) {
      const button = this.button(variant === "hd" ? "HD" : "Advanced");
      button.addEventListener("click", () => this.settings.setVariant(variant));
      this.variantButtons.set(variant, button);
      variantLine.appendChild(button);
    }
    controls.appendChild(variantLine);

    const qualityLine = this.make("div", "line");
    qualityLine.appendChild(this.make("span", "line-label", "Quality"));
    for (const quality of CRT_GUEST_QUALITIES) {
      const label =
        quality === "exact"
          ? "Exact"
          : quality === "balanced"
            ? "Balanced"
            : "Apple TV";
      const button = this.button(label);
      button.addEventListener("click", () => this.settings.setQuality(quality));
      this.qualityButtons.set(quality, button);
      qualityLine.appendChild(button);
    }
    controls.appendChild(qualityLine);

    const actionLine = this.make("div", "line");
    actionLine.append(
      this.action("Reset mode", () => {
        this.settings.resetCurrentDefaults();
        this.setStatus("Reset current variant to manifest defaults.");
      }),
      this.action("Reset all", () => {
        this.settings.resetAllDefaults();
        this.setStatus("Reset all CRT settings to manifest defaults.");
      }),
      this.action("Copy", () => void this.copyPresetToClipboard()),
      this.action("Paste", () => void this.pastePresetFromClipboard()),
      this.action("Save", () => this.savePresetFile()),
      this.action("Load", () => this.fileInput.click()),
    );
    controls.appendChild(actionLine);

    this.status = this.make(
      "div",
      "status",
      this.settings.lastStorageError ?? "Ready · changes persist locally.",
    );
    if (this.settings.lastStorageError) this.status.dataset.error = "";
    controls.appendChild(this.status);
    this.panel.appendChild(controls);

    this.groups = this.make("div", "groups");
    this.panel.appendChild(this.groups);

    this.fileInput = documentRef.createElement("input");
    this.fileInput.className = "hidden-file";
    this.fileInput.type = "file";
    this.fileInput.accept = ".json,application/json";
    this.fileInput.addEventListener("change", () => {
      const file = this.fileInput.files?.[0];
      if (file) void this.loadPresetFile(file);
      this.fileInput.value = "";
    });
    this.panel.appendChild(this.fileInput);
    this.shadow.appendChild(this.panel);
    this.panel.setAttribute("aria-hidden", "true");

    (parent ?? documentRef.body).appendChild(this.element);
    this.unsubscribeSettings = this.settings.subscribe((change) => {
      this.handleSettingsChange(change);
    });
    const maybeUnbind = options.bindToggle?.(() => this.toggle());
    this.unbindToggle = typeof maybeUnbind === "function" ? maybeUnbind : null;

    this.syncTopControls();
    this.rebuildParameters();
    this.setOpen(options.initiallyOpen ?? false);
  }

  get isOpen(): boolean {
    return this.openState;
  }

  open(): void {
    this.setOpen(true);
  }

  close(): void {
    this.setOpen(false);
  }

  toggle(): void {
    this.setOpen(!this.openState);
  }

  setOpen(open: boolean): void {
    if (this.disposed || this.openState === open) return;
    this.openState = open;
    this.element.toggleAttribute("data-open", open);
    this.panel.setAttribute("aria-hidden", open ? "false" : "true");
    this.launcher.setAttribute("aria-expanded", open ? "true" : "false");
    this.onOpenChange?.(open);
    if (open) this.closeButton.focus({ preventScroll: true });
  }

  refresh(): void {
    this.syncTopControls();
    this.rebuildParameters();
  }

  applyJson(json: string): boolean {
    const result = this.settings.importJson(json);
    if (!result.ok) {
      this.setStatus(result.error, true);
      return false;
    }
    this.setStatus("Applied CRT preset JSON.");
    return true;
  }

  async copyPresetToClipboard(): Promise<boolean> {
    const text = this.settings.exportJson(true);
    const clipboard = this.document.defaultView?.navigator.clipboard;
    try {
      if (clipboard?.writeText) {
        await clipboard.writeText(text);
      } else {
        const textarea = this.document.createElement("textarea");
        textarea.value = text;
        textarea.style.position = "fixed";
        textarea.style.opacity = "0";
        this.document.body.appendChild(textarea);
        textarea.select();
        const copied = this.document.execCommand("copy");
        textarea.remove();
        if (!copied) throw new Error("Clipboard write is unavailable.");
      }
      this.setStatus("Copied CRT preset JSON.");
      return true;
    } catch (error) {
      this.setStatus("Could not copy preset: " + errorMessage(error), true);
      return false;
    }
  }

  async pastePresetFromClipboard(): Promise<boolean> {
    try {
      const clipboard = this.document.defaultView?.navigator.clipboard;
      const text = clipboard?.readText
        ? await clipboard.readText()
        : this.document.defaultView?.prompt("Paste CRT preset JSON:") ?? "";
      if (!text) {
        this.setStatus("No CRT preset JSON was pasted.", true);
        return false;
      }
      return this.applyJson(text);
    } catch (error) {
      this.setStatus("Could not paste preset: " + errorMessage(error), true);
      return false;
    }
  }

  savePresetFile(): boolean {
    const view = this.document.defaultView;
    if (!view) {
      this.setStatus("File downloads are unavailable.", true);
      return false;
    }
    try {
      const blob = new Blob([this.settings.exportJson(true)], {
        type: "application/json",
      });
      const url = view.URL.createObjectURL(blob);
      const anchor = this.document.createElement("a");
      anchor.href = url;
      anchor.download = CRT_GUEST_DEFAULT_FILE_NAME;
      anchor.style.display = "none";
      this.document.body.appendChild(anchor);
      anchor.click();
      anchor.remove();
      view.setTimeout(() => view.URL.revokeObjectURL(url), 0);
      this.settings.saveToStorage();
      this.setStatus("Saved " + CRT_GUEST_DEFAULT_FILE_NAME + ".");
      return true;
    } catch (error) {
      this.setStatus("Could not save preset: " + errorMessage(error), true);
      return false;
    }
  }

  async loadPresetFile(file: File): Promise<boolean> {
    try {
      const text = await file.text();
      const applied = this.applyJson(text);
      if (applied) this.setStatus("Loaded " + file.name + ".");
      return applied;
    } catch (error) {
      this.setStatus("Could not load preset: " + errorMessage(error), true);
      return false;
    }
  }

  dispose(): void {
    if (this.disposed) return;
    this.disposed = true;
    this.unsubscribeSettings();
    this.unbindToggle?.();
    this.element.remove();
    this.parameterControls.clear();
    this.variantButtons.clear();
    this.qualityButtons.clear();
  }

  private handleSettingsChange(change: CrtGuestSettingsChange): void {
    this.syncTopControls();
    if (
      change.kind === "variant" ||
      change.kind === "reset-current" ||
      change.kind === "reset-all" ||
      change.kind === "preset"
    ) {
      this.rebuildParameters();
      return;
    }
    if (change.kind === "parameter" && change.parameterId) {
      const controls = this.parameterControls.get(change.parameterId);
      if (controls && controls.variant === change.variant) {
        this.syncParameter(controls);
      }
    }
  }

  private syncTopControls(): void {
    this.enabledInput.checked = this.settings.enabled;
    for (const [variant, button] of this.variantButtons) {
      button.setAttribute(
        "aria-pressed",
        variant === this.settings.variant ? "true" : "false",
      );
    }
    for (const [quality, button] of this.qualityButtons) {
      button.setAttribute(
        "aria-pressed",
        quality === this.settings.quality ? "true" : "false",
      );
    }
  }

  private rebuildParameters(): void {
    for (const details of this.groups.querySelectorAll("details")) {
      const groupId = details.getAttribute("data-group");
      if (groupId) {
        if (details.open) this.expandedGroups.add(groupId);
        else this.expandedGroups.delete(groupId);
      }
    }
    this.groups.replaceChildren();
    this.parameterControls.clear();
    const variant = this.settings.variant;

    for (const group of CRT_GUEST_PARAMETER_GROUPS) {
      const supported = group.parameters.filter(
        (parameter) => getCrtGuestRange(parameter, variant) !== null,
      );
      if (supported.length === 0) continue;

      const details = this.document.createElement("details");
      details.dataset.group = group.id;
      details.open = this.expandedGroups.has(group.id);
      details.addEventListener("toggle", () => {
        if (details.open) this.expandedGroups.add(group.id);
        else this.expandedGroups.delete(group.id);
      });
      const summary = this.document.createElement("summary");
      summary.append(
        this.make("span", "", nicify(group.id)),
        this.make("span", "count", String(supported.length)),
      );
      details.appendChild(summary);
      for (const parameter of supported) {
        details.appendChild(this.makeParameter(parameter, variant));
      }
      this.groups.appendChild(details);
    }
  }

  private makeParameter(
    parameter: CrtGuestParameterDefinition,
    variant: CrtGuestVariant,
  ): HTMLElement {
    const range = getCrtGuestRange(parameter, variant);
    if (!range) throw new Error("Unsupported CRT parameter row: " + parameter.id);

    const row = this.make("div", "parameter");
    const label = this.make(
      "label",
      "parameter-label",
      parameter.id === "barspeed"
        ? "Hum Bar Speed (disable with Intensity)"
        : parameter.id === "barintensity"
          ? "Hum Bar Intensity (0 = Off)"
          : parameter.label,
    );
    label.appendChild(this.make("span", "parameter-id", parameter.id));

    const slider = this.document.createElement("input");
    slider.className = "range";
    slider.type = "range";
    slider.min = String(range.min);
    slider.max = String(range.max);
    slider.step = String(range.step);
    slider.setAttribute("aria-label", parameter.label);

    const numeric = this.document.createElement("input");
    numeric.className = "numeric";
    numeric.type = "number";
    numeric.inputMode = "decimal";
    numeric.min = String(range.min);
    numeric.max = String(range.max);
    numeric.step = String(range.step);
    numeric.setAttribute("aria-label", parameter.label + " numeric value");
    label.htmlFor = "crt-value-" + variant + "-" + parameter.index;
    numeric.id = label.htmlFor;

    const actionCell = this.make("div", "line");
    if (parameter.id === "LS") {
      slider.disabled = true;
      numeric.disabled = true;
      actionCell.appendChild(this.make("span", "locked", "locked"));
    } else if (parameter.id === "barintensity") {
      const off = this.button("Off", "mini");
      off.addEventListener("click", () => {
        this.settings.setValue(parameter.id, 0, variant);
        this.setStatus("Hum bar off (barintensity = 0).");
      });
      actionCell.appendChild(off);
    } else if (range.min <= 0 && range.max >= 0) {
      const zero = this.button("0", "mini");
      zero.addEventListener("click", () => {
        this.settings.setValue(parameter.id, 0, variant);
        this.setStatus("Set " + parameter.id + " = 0.");
      });
      actionCell.appendChild(zero);
    }

    const controls: ParameterControls = {
      parameter,
      variant,
      slider,
      numeric,
    };
    slider.addEventListener("input", () => {
      const value = Number(slider.value);
      if (Number.isFinite(value)) {
        this.settings.setValue(parameter.id, value, variant);
        this.syncParameter(controls);
      }
    });
    numeric.addEventListener("change", () => this.commitNumeric(controls));
    numeric.addEventListener("keydown", (event) => {
      if (event.key === "Enter") {
        event.preventDefault();
        this.commitNumeric(controls);
        numeric.blur();
      }
    });

    row.append(label, slider, numeric, actionCell);
    this.parameterControls.set(parameter.id, controls);
    this.syncParameter(controls);
    return row;
  }

  private commitNumeric(controls: ParameterControls): void {
    const text = controls.numeric.value.trim();
    const requested = Number(text);
    if (!text || !Number.isFinite(requested)) {
      this.setStatus("'" + text + "' is not a valid number.", true);
      this.syncParameter(controls);
      return;
    }
    this.settings.setValue(
      controls.parameter.id,
      requested,
      controls.variant,
    );
    const applied = this.settings.getValue(
      controls.parameter.id,
      controls.variant,
    );
    this.syncParameter(controls);
    const formatted = formatValue(applied, Number(controls.numeric.step));
    if (Math.abs(applied - requested) > 0.000001) {
      if (controls.parameter.id === "barspeed") {
        this.setStatus(
          "Hum Bar Speed is limited to 5–200; set Hum Bar Intensity to 0 to disable it.",
        );
      } else {
        this.setStatus(
          "Clamped/quantized " + controls.parameter.id + " to " + formatted + ".",
        );
      }
    } else {
      this.setStatus("Set " + controls.parameter.id + " = " + formatted + ".");
    }
  }

  private syncParameter(controls: ParameterControls): void {
    const range = getCrtGuestRange(controls.parameter, controls.variant);
    if (!range) return;
    const value = this.settings.getValue(
      controls.parameter.id,
      controls.variant,
    );
    const formatted = formatValue(value, range.step);
    controls.slider.value = formatted;
    if (this.shadow.activeElement !== controls.numeric) {
      controls.numeric.value = formatted;
    }
  }

  private setStatus(message: string, error = false): void {
    this.status.textContent = message;
    this.status.toggleAttribute("data-error", error);
  }

  private action(label: string, run: () => void): HTMLButtonElement {
    const button = this.button(label);
    button.addEventListener("click", run);
    return button;
  }

  private button(label: string, className = ""): HTMLButtonElement {
    const button = this.document.createElement("button");
    button.type = "button";
    button.className = className;
    button.textContent = label;
    return button;
  }

  private make<K extends keyof HTMLElementTagNameMap>(
    tag: K,
    className = "",
    text = "",
  ): HTMLElementTagNameMap[K] {
    const element = this.document.createElement(tag);
    element.className = className;
    element.textContent = text;
    return element;
  }
}

function formatValue(value: number, step: number): string {
  const digits = decimalPlaces(step);
  if (digits === 0) return value.toFixed(0);
  return value.toFixed(digits).replace(/0+$/, "").replace(/\.$/, "");
}

function decimalPlaces(value: number): number {
  const text = String(value).toLowerCase();
  const exponentIndex = text.indexOf("e-");
  if (exponentIndex >= 0) {
    return Math.min(8, Number(text.slice(exponentIndex + 2)) || 0);
  }
  const decimalIndex = text.indexOf(".");
  return decimalIndex < 0 ? 0 : Math.min(8, text.length - decimalIndex - 1);
}

function nicify(value: string): string {
  if (!value) return "";
  return value
    .replace(/([a-z0-9])([A-Z])/g, "$1 $2")
    .replace(/^./, (character) => character.toUpperCase());
}

function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

export function createCrtGuestTuningPanel(
  options: CrtGuestTuningPanelOptions = {},
): CrtGuestTuningPanel {
  return new CrtGuestTuningPanel(options);
}
