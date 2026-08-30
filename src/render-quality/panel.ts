import {
  RENDER_BASE_HEIGHTS,
  RENDER_OUTPUT_MULTIPLIERS,
  RenderQualitySettings,
  RenderQualitySizes,
  renderQualitySettings,
  type RenderBaseHeight,
  type RenderOutputMultiplier,
} from "./settings";

export interface RenderQualityPanelOptions {
  settings?: RenderQualitySettings;
  parent?: HTMLElement;
  initiallyOpen?: boolean;
}

const CSS = `
  :host { all: initial; position: fixed; inset: 0; z-index: 92; pointer-events: none;
    color: #e9f5ff; font: 12px/1.35 ui-monospace, SFMono-Regular, Menlo, Consolas, monospace; }
  *, *::before, *::after { box-sizing: border-box; border-radius: 0 !important; }
  button, input { font: inherit; }
  .launcher { position: fixed; top: 40%; right: 0; pointer-events: auto; padding: 10px 6px;
    border: 1px solid #79cfff; border-right: 0; background: #07101a; color: #bce8ff;
    font-weight: 900; letter-spacing: .8px; cursor: pointer; box-shadow: -4px 4px 0 #0008; }
  :host([data-open]) .launcher { display: none; }
  .panel { display: none; position: fixed; top: 12px; right: 12px; width: min(420px, calc(100vw - 24px));
    max-height: calc(100vh - 24px); overflow: auto; pointer-events: auto; border: 2px solid #79cfff;
    background: #07101a; box-shadow: -10px 10px 0 #000b; }
  :host([data-open]) .panel { display: block; }
  .title { display: flex; align-items: center; padding: 10px 12px; border-bottom: 2px solid #79cfff;
    background: #0c2234; font-weight: 900; letter-spacing: 1px; }
  .title span { flex: 1; } .close { width: 30px; padding: 3px; }
  .body { padding: 11px 12px 14px; } .row { margin: 0 0 12px; }
  .label { margin-bottom: 5px; color: #83b8d2; text-transform: uppercase; font-size: 10px; letter-spacing: .8px; }
  .toggle { display: flex; gap: 8px; align-items: center; font-weight: 800; }
  .toggle input { width: 17px; height: 17px; accent-color: #79cfff; }
  .buttons { display: flex; flex-wrap: wrap; gap: 6px; }
  button { min-height: 28px; padding: 5px 9px; border: 1px solid #466f86; background: #0b1822;
    color: #e9f5ff; cursor: pointer; }
  button:hover, button:focus-visible { border-color: white; outline: none; }
  button[aria-pressed='true'] { background: #175276; border-color: #9adeff; box-shadow: inset 0 -3px #9adeff; }
  .metrics { margin: 12px 0; padding: 9px; border: 1px solid #28485a; background: #050b10;
    color: #b8d9e8; white-space: pre-wrap; }
  .hint { color: #6f9bb1; font-size: 10px; }
`;

export class RenderQualityPanel {
  readonly settings: RenderQualitySettings;
  readonly element: HTMLDivElement;
  private readonly shadow: ShadowRoot;
  private readonly enabled: HTMLInputElement;
  private readonly fixed60: HTMLInputElement;
  private readonly baseButtons = new Map<RenderBaseHeight, HTMLButtonElement>();
  private readonly outputButtons = new Map<RenderOutputMultiplier, HTMLButtonElement>();
  private readonly metrics: HTMLElement;
  private readonly unsubscribe: () => void;
  private openState = false;

  constructor(options: RenderQualityPanelOptions = {}) {
    this.settings = options.settings ?? renderQualitySettings;
    const parent = options.parent ?? document.body;
    this.element = document.createElement("div");
    this.element.setAttribute("data-render-quality-panel-host", "");
    this.shadow = this.element.attachShadow({ mode: "open" });
    for (const name of ["keydown", "keyup", "keypress"] as const)
      this.shadow.addEventListener(name, (event) => event.stopPropagation());
    const style = document.createElement("style");
    style.textContent = CSS;
    this.shadow.appendChild(style);

    const launcher = this.button("RENDER", "launcher");
    launcher.setAttribute("aria-label", "Open render optimization panel");
    launcher.hidden = document.body.classList.contains("tc-on");
    launcher.addEventListener("click", () => this.setOpen(true));
    this.shadow.appendChild(launcher);

    const panel = document.createElement("section");
    panel.className = "panel";
    panel.setAttribute("role", "dialog");
    panel.setAttribute("aria-label", "Render optimization panel");
    const title = document.createElement("header");
    title.className = "title";
    title.innerHTML = "<span>RENDER OPTIMIZATION</span>";
    const close = this.button("×", "close");
    close.setAttribute("aria-label", "Close render optimization panel");
    close.addEventListener("click", () => this.setOpen(false));
    title.appendChild(close);
    panel.appendChild(title);
    const body = document.createElement("div");
    body.className = "body";

    this.enabled = this.checkboxRow(
      body,
      "Fixed pre-CRT resolution",
      "World, water, SMAA and coast effects render at the input size.",
      (checked) => this.settings.setEnabled(checked),
    );

    const base = this.row(body, "Pre-CRT input height");
    const baseButtons = document.createElement("div");
    baseButtons.className = "buttons";
    for (const value of RENDER_BASE_HEIGHTS) {
      const button = this.button(`${value}p`);
      button.addEventListener("click", () => this.settings.setBaseHeight(value));
      this.baseButtons.set(value, button);
      baseButtons.appendChild(button);
    }
    base.appendChild(baseButtons);

    const output = this.row(body, "CRT output scale");
    const outputButtons = document.createElement("div");
    outputButtons.className = "buttons";
    for (const value of RENDER_OUTPUT_MULTIPLIERS) {
      const button = this.button(`${value}×`);
      button.addEventListener("click", () =>
        this.settings.setOutputMultiplier(value),
      );
      this.outputButtons.set(value, button);
      outputButtons.appendChild(button);
    }
    output.appendChild(outputButtons);

    this.fixed60 = this.checkboxRow(
      body,
      "Fixed 60 FPS presentation",
      "Simulation stays deterministic at its existing fixed 60 Hz.",
      (checked) => this.settings.setFixed60(checked),
    );

    this.metrics = document.createElement("pre");
    this.metrics.className = "metrics";
    this.metrics.textContent = "Waiting for renderer dimensions…";
    body.appendChild(this.metrics);
    const reset = this.button("Restore 720p · 2× · 60 FPS");
    reset.addEventListener("click", () => this.settings.reset());
    body.appendChild(reset);
    const hint = document.createElement("p");
    hint.className = "hint";
    hint.textContent = document.body.classList.contains("tc-on")
      ? "Touch presentation always uses native viewport rendering so phone HUD and controls retain their responsive coordinate space."
      : "Native mode bypasses the fixed input size for direct A/B comparison.";
    body.appendChild(hint);
    panel.appendChild(body);
    this.shadow.appendChild(panel);
    parent.appendChild(this.element);

    this.unsubscribe = this.settings.subscribe(() => this.refresh(), true);
    this.setOpen(options.initiallyOpen ?? false);
  }

  setMetrics(sizes: RenderQualitySizes, optimized: boolean): void {
    this.metrics.textContent = optimized
      ? `viewport  ${sizes.viewportWidth}×${sizes.viewportHeight}\n` +
        `world     ${sizes.inputWidth}×${sizes.inputHeight}\n` +
        `water FX  ${sizes.inputWidth}×${sizes.inputHeight}\n` +
        `CRT out   ${sizes.outputWidth}×${sizes.outputHeight}`
      : `viewport  ${sizes.viewportWidth}×${sizes.viewportHeight}\n` +
        "pipeline  native renderer resolution";
  }

  setOpen(open: boolean): void {
    this.openState = open;
    this.element.toggleAttribute("data-open", open);
  }

  toggle(): void {
    this.setOpen(!this.openState);
  }

  dispose(): void {
    this.unsubscribe();
    this.element.remove();
  }

  private refresh(): void {
    this.enabled.checked = this.settings.enabled;
    this.fixed60.checked = this.settings.fixed60;
    for (const [value, button] of this.baseButtons)
      button.setAttribute("aria-pressed", String(value === this.settings.baseHeight));
    for (const [value, button] of this.outputButtons)
      button.setAttribute(
        "aria-pressed",
        String(value === this.settings.outputMultiplier),
      );
  }

  private checkboxRow(
    parent: HTMLElement,
    title: string,
    hint: string,
    change: (checked: boolean) => void,
  ): HTMLInputElement {
    const row = this.row(parent, title);
    const label = document.createElement("label");
    label.className = "toggle";
    const input = document.createElement("input");
    input.type = "checkbox";
    input.setAttribute("aria-label", title);
    input.addEventListener("change", () => change(input.checked));
    label.append(input, document.createTextNode("Enabled"));
    row.appendChild(label);
    const note = document.createElement("div");
    note.className = "hint";
    note.textContent = hint;
    row.appendChild(note);
    return input;
  }

  private row(parent: HTMLElement, title: string): HTMLDivElement {
    const row = document.createElement("div");
    row.className = "row";
    const label = document.createElement("div");
    label.className = "label";
    label.textContent = title;
    row.appendChild(label);
    parent.appendChild(row);
    return row;
  }

  private button(text: string, className = ""): HTMLButtonElement {
    const button = document.createElement("button");
    button.type = "button";
    button.className = className;
    button.textContent = text;
    return button;
  }
}

export function createRenderQualityPanel(
  options: RenderQualityPanelOptions = {},
): RenderQualityPanel {
  return new RenderQualityPanel(options);
}
