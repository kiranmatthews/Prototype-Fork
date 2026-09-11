import {menuTextFocusEnabled,setMenuTextFocusEnabled,MENU_TEXT_FOCUS_EVENT} from './menuTextFocus';
import { getRooAppearance, setRooAppearance, ROO_APPEARANCE_EVENT } from './roo-type/settings';
import { SECONDARY_TEXT_RANGES, secondaryTextSettings, type SecondaryTextSettings } from "./secondaryTextSettings";

export function createSecondaryTextPanel(): void {
  if (document.querySelector(".secondary-text-tuner")) return;
  const root = document.createElement("details");
  root.className = "secondary-text-tuner";
  root.innerHTML = `<summary>TEXT TUNING</summary><div class="secondary-text-tuner-body"><header><b>Secondary text</b><button type="button" aria-label="Close text tuning">×</button></header><p>Live map preview · saved in this browser</p><div class="secondary-text-controls"></div><p>Weight adjusts the glyph face thickness; the supplied font is a fixed Bold face.</p><footer><button type="button" data-action="reset">Reset</button><button type="button" data-action="copy">Copy settings</button></footer><textarea aria-label="Text settings JSON" readonly hidden></textarea><p role="status"></p></div>`;
  const body = root.querySelector<HTMLElement>(".secondary-text-tuner-body")!;
  for (const event of ["keydown", "keyup", "pointerdown", "pointerup", "touchstart", "touchend", "wheel"])
    root.addEventListener(event, event => {
      // M remains the shared debug-chrome toggle outside text/number editing.
      if (event instanceof KeyboardEvent && event.code === "KeyM" &&
          (!(event.target instanceof HTMLInputElement) || ["checkbox", "range", "button"].includes(event.target.type)) && !(event.target instanceof HTMLTextAreaElement)) return;
      event.stopPropagation();
    });
  root.querySelector("header button")!.addEventListener("click", () => { root.open = false; });
  const roo = document.createElement('section');
  roo.className = 'roo-debug-controls';
  roo.innerHTML = `<b>Roo HUD & menu text</b><label><span>Menu focus colours (orange / white)</span><input type="checkbox" data-menu-text-focus></label><label><span>Text shimmer</span><input type="checkbox" data-roo-setting="shimmer"></label><label><span>Edge light strength</span><input type="range" min="0" max="1" step="0.01" data-roo-setting="lightStrength"></label><label><span>Letter spacing (em)</span><input type="number" min="-.16" max=".16" step=".005" data-roo-setting="tracking"></label><button type="button" data-roo-studio>Open text appearance studio</button><hr>`;
  body.querySelector('header')!.after(roo);
  const focus=roo.querySelector<HTMLInputElement>('[data-menu-text-focus]')!;focus.checked=menuTextFocusEnabled();
  focus.addEventListener('change',()=>setMenuTextFocusEnabled(focus.checked));
  window.addEventListener(MENU_TEXT_FOCUS_EVENT,()=>{focus.checked=menuTextFocusEnabled();});
  const syncRoo = () => {
    const value = getRooAppearance();
    for (const input of roo.querySelectorAll<HTMLInputElement>('[data-roo-setting]')) {
      if (input.dataset.rooSetting === 'shimmer') input.checked = value.shimmer;
      else input.value = String(value[input.dataset.rooSetting as 'tracking' | 'lightStrength']);
    }
  };
  roo.addEventListener('input', event => {
    const input = event.target as HTMLInputElement, key = input.dataset.rooSetting;
    if (key === 'shimmer') setRooAppearance({ shimmer: input.checked });
    else if ((key === 'tracking' || key === 'lightStrength') && Number.isFinite(input.valueAsNumber)) setRooAppearance({ [key]: input.valueAsNumber });
  });
  roo.querySelector('[data-roo-studio]')!.addEventListener('click', () => window.open(new URL(`${import.meta.env.BASE_URL}roo-type-lab.html`, location.href).href, 'roo-font-appearance'));
  window.addEventListener(ROO_APPEARANCE_EVENT, syncRoo); syncRoo();
  const controls = root.querySelector(".secondary-text-controls")!;
  const sync: (() => void)[] = [];
  const names: Record<keyof typeof SECONDARY_TEXT_RANGES, string> = {
    size: "Text size (1080p px)", weight: "Face weight (px)", stroke: "Black outline (px)",
    shadowX: "Block shadow X (px)", shadowY: "Block shadow Y (px)",
    gradientAngle: "Gradient angle (°)", gradientMid: "Gradient dark band (%)",
  };
  for (const key of Object.keys(SECONDARY_TEXT_RANGES) as (keyof typeof SECONDARY_TEXT_RANGES)[]) {
    const [min, max, step] = SECONDARY_TEXT_RANGES[key];
    const row = document.createElement("label");
    row.innerHTML = `<span>${names[key]}</span><input type="range" min="${min}" max="${max}" step="${step}" data-setting="${key}"><input type="number" min="${min}" max="${max}" step="${step}" aria-label="${names[key]} value">`;
    const [range, number] = [...row.querySelectorAll("input")];
    for (const input of [range, number]) input.addEventListener("input", () => {
      if (input.value !== "" && Number.isFinite(input.valueAsNumber)) secondaryTextSettings.update({ [key]: input.valueAsNumber });
    });
    sync.push(() => { range.value = number.value = String(secondaryTextSettings.value[key]); });
    controls.appendChild(row);
  }
  const colors = { top: "Top silver", upper: "Upper silver", middle: "Mid silver", dark: "Dark silver", lower: "Lower silver", bottom: "Bottom silver" };
  for (const key of Object.keys(colors) as (keyof typeof colors)[]) {
    const row = document.createElement("label");
    row.innerHTML = `<span>${colors[key]}</span><input type="color" data-setting="${key}" aria-label="${colors[key]}"><code></code>`;
    const input = row.querySelector("input")!, code = row.querySelector("code")!;
    input.addEventListener("input", () => secondaryTextSettings.update({ [key]: input.value } as Partial<SecondaryTextSettings>));
    sync.push(() => { input.value = secondaryTextSettings.value[key]; code.textContent = input.value; });
    controls.appendChild(row);
  }
  const status = root.querySelector<HTMLElement>('[role="status"]')!;
  root.querySelector('[data-action="reset"]')!.addEventListener("click", () => { secondaryTextSettings.reset(); status.textContent = "Default text restored."; });
  root.querySelector('[data-action="copy"]')!.addEventListener("click", async () => {
    const json = JSON.stringify(secondaryTextSettings.value, null, 2);
    const output = root.querySelector("textarea")!;
    output.value = json; output.hidden = false;
    try { await navigator.clipboard.writeText(json); status.textContent = "Settings copied."; }
    catch { output.focus(); output.select(); status.textContent = "Select and copy the settings below."; }
  });
  const update = () => sync.forEach(callback => callback());
  secondaryTextSettings.subscribe(update); update();
  const style = document.createElement("style");
  style.textContent = `
    .secondary-text-tuner { display:none; position:fixed; z-index:130; left:16px; top:16px; color:#e9eff3; font:13px/1.4 system-ui,sans-serif; }
    body:not(.game-shell-transitioning):not(.game-debug-hidden) .secondary-text-tuner { display:block; }
    .secondary-text-tuner summary { cursor:pointer; width:max-content; padding:7px 11px; border:1px solid #a6b6c4; border-radius:5px; background:#15212bea; font-size:11px; font-weight:800; }
    .secondary-text-tuner-body { width:310px; max-width:calc(100vw - 32px); max-height:calc(100dvh - 150px); overflow:auto; box-sizing:border-box; padding:12px; background:#15212bf5; border:1px solid #8194a2; border-radius:0 8px 8px; }
    .secondary-text-tuner header,.secondary-text-tuner footer { display:flex; align-items:center; justify-content:space-between; gap:8px; }
    .secondary-text-tuner p { color:#aebdc8; font-size:11px; margin:8px 0; }
    .secondary-text-tuner label { display:grid; grid-template-columns:1fr 62px; align-items:center; gap:4px 8px; margin:10px 0; }
    .secondary-text-tuner label span { grid-column:1/-1; font-size:12px; }
    .secondary-text-tuner input[type=range] { width:100%; accent-color:#b7d6ed; }
    .secondary-text-tuner input[type=number] { width:60px; box-sizing:border-box; }
    .secondary-text-tuner input,.secondary-text-tuner button,.secondary-text-tuner textarea { font:inherit; color:#ecf2f7; background:#273747; border:1px solid #6b8294; border-radius:4px; padding:4px; }
    .secondary-text-tuner button { cursor:pointer; padding:6px 10px; }
    .secondary-text-tuner input[type=color] { width:100%; height:28px; padding:0; }
    .secondary-text-tuner code { font-size:10px; }
    .secondary-text-tuner textarea { width:100%; height:160px; box-sizing:border-box; margin-top:8px; }
    @media(pointer:coarse) { .secondary-text-tuner { left:70px; top:12px; } .secondary-text-tuner-body { max-width:calc(100vw - 84px); } }
  `;
  document.head.appendChild(style); document.body.appendChild(root);
  // Keep the body reference owned by this details panel, not a fullscreen modal.
  body.setAttribute("aria-label", "Secondary text tuning");
}
