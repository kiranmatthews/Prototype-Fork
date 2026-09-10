import { INPUT_BINDINGS, type InputAction } from './inputBindings';

export const CONTROLLER_FAMILIES = ['xbox', 'ps4', 'ps5', 'steamdeck', 'switch'] as const;
export type ControllerFamily = typeof CONTROLLER_FAMILIES[number];
export type PromptFamily = ControllerFamily | 'keyboard' | 'touch';
export const PROMPT_FAMILY_NAMES: Record<PromptFamily, string> = {
  keyboard: 'Keyboard / mouse', touch: 'Touch', xbox: 'Xbox', ps4: 'PlayStation 4',
  ps5: 'PlayStation 5', steamdeck: 'Steam Deck', switch: 'Nintendo Switch',
};
export interface PromptGlyph { family: PromptFamily; url: string; label: string; fallback?: boolean }
export type PromptGlyphProvider = (action: InputAction, family: PromptFamily) => PromptGlyph | null;
const ROOT = `${import.meta.env.BASE_URL}input-prompts/`;
export const PROMPT_STYLE_KEY = 'solProtoControllerPrompts.v1';

/** Standard-mapped generic devices deliberately fall back to Xbox positions. */
export function detectControllerFamily(id: string): ControllerFamily {
  if (/steam\s*deck|neptune/i.test(id)) return 'steamdeck';
  if (/dualsense|playstation\s*5|\bps5\b|054c.*(?:0ce6|0df2)/i.test(id)) return 'ps5';
  if (/dualshock|playstation|\bps4\b|054c|sony/i.test(id)) return 'ps4';
  if (/nintendo|switch|joy.?con|057e/i.test(id)) return 'switch';
  return 'xbox';
}

function svgGlyph(label: string, keyboard = false): string {
  const safe = label.replace(/[&<>"']/g, '');
  const shape = keyboard
    ? '<rect x="15" y="17" width="98" height="98" rx="12" fill="#121212"/><rect x="15" y="13" width="98" height="94" rx="12" fill="#292929" stroke="#3a3a3a" stroke-width="4"/>'
    : '<circle cx="64" cy="64" r="48" fill="#242424"/><circle cx="64" cy="63" r="44" fill="#292929"/>';
  return `data:image/svg+xml,${encodeURIComponent(`<svg xmlns="http://www.w3.org/2000/svg" width="128" height="128" viewBox="0 0 128 128">${shape}<text x="64" y="65" dominant-baseline="middle" text-anchor="middle" fill="#fff" font-family="Arial,sans-serif" font-weight="700" font-size="${safe.length > 4 ? 20 : 31}">${safe}</text></svg>`)}`;
}
const keyboardNames: Record<string,string> = { Space:'Space', Enter:'Enter', Escape:'Esc', ArrowUp:'Up', ArrowDown:'Down', ArrowLeft:'Left', ArrowRight:'Right', Tab:'Tab', Backspace:'BackSpace', Delete:'Del', ShiftLeft:'Shift', ShiftRight:'Shift', ControlLeft:'Crtl', AltLeft:'Alt', MouseLeft:'Mouse_Left', MouseRight:'Mouse_Right', MouseMiddle:'Mouse_Middle' };
const keyboardLabels: Record<string,string> = { MouseLeft:'Left mouse button', MouseRight:'Right mouse button', MouseMiddle:'Middle mouse button', ArrowUp:'Up arrow', ArrowDown:'Down arrow', ArrowLeft:'Left arrow', ArrowRight:'Right arrow', ControlLeft:'Ctrl', ControlRight:'Ctrl', MetaLeft:'Cmd', MetaRight:'Cmd' };
export function keyboardGlyph(code: string): PromptGlyph {
  const name = keyboardNames[code] ?? (/^Key[A-Z]$/.test(code) ? code.slice(3) : /^Digit[0-9]$/.test(code) ? code.slice(5) : /^F(?:[1-9]|1[0-2])$/.test(code) ? code : null);
  // The source pack has no reliably named 4 key. Never point at a missing file.
  const known = name !== null && name !== '4';
  return { family:'keyboard', label:keyboardLabels[code] ?? (code.startsWith('Key')?code.slice(3):keyboardNames[code]??code),
    url:known ? `${ROOT}keyboard/T_${name}_Key_Dark.png` : svgGlyph(keyboardLabels[code]??code.replace(/^Digit/,''),true), fallback:!known };
}
const PS_FACE = ['Cross','Circle','Square','Triangle'];
const X_FACE = ['A','B','X','Y'];
// W3C standard mapping is physical south/east/west/north, not letter names.
const S_FACE = ['B','A','Y','X'];
export function controllerGlyph(family: ControllerFamily, index: number): PromptGlyph {
  let file: string | undefined, label: string | undefined;
  if (index >= 0 && index < 4) {
    const face = family === 'switch' ? S_FACE[index] : family === 'ps4' || family === 'ps5' ? PS_FACE[index] : X_FACE[index];
    label = face;
    file = family === 'ps4' ? `ps4/T_P4_${face}_Color_Stylized.png`
      : family === 'ps5' ? `ps5/T_P5_${face}.png`
      : family === 'switch' ? `switch/T_S_${face}.png`
      : `xbox/T_X_${face}_${family === 'steamdeck' ? 'White' : 'Color'}.png`;
  } else {
    const direction = ['Up','Down','Left','Right'][index-12];
    if (index >= 12 && index <= 15) {
      label = `D-pad ${direction}`;
      file = family === 'ps4' ? `ps4/T_P4_Dpad_${direction==='Up'?'UP':direction}_Stylized.png`
        : family === 'ps5' ? `ps5/T_P5_Dpad_${direction==='Up'?'UP':direction}.png`
        : family === 'switch' ? `switch/T_S_Dpad_${direction}.png` : `xbox/T_X_Dpad_${direction}.png`;
    } else if (family === 'ps4' || family === 'ps5') {
      label = ({4:'L1',5:'R1',6:'L2',7:'R2',8:family==='ps4'?'Share':'Create',9:'Options',10:'L3',11:'R3',17:'Touchpad'} as Record<number,string>)[index];
      const key = index===17?'Touch_Pad':index===8?'Share':label;
      if (key) file = family==='ps4' ? `ps4/T_P4_${key}_Stylized.png` : `ps5/T_P5_${key}.png`;
    } else if (family === 'switch') {
      label = ({4:'L',5:'R',6:'ZL',7:'ZR',8:'Minus',9:'Plus',10:'Left stick',11:'Right stick'} as Record<number,string>)[index];
      const key = ({4:'LB',5:'RB',6:'LT',7:'RT',8:'Minus',9:'Plus',10:'L',11:'R'} as Record<number,string>)[index];
      if (key) file = `switch/T_S_${key}.png`;
    } else {
      label = ({4:'LB',5:'RB',6:'LT',7:'RT',8:'View',9:'Menu',10:'Left stick',11:'Right stick'} as Record<number,string>)[index];
      if (family==='steamdeck' && index>=4 && index<=7) {
        label = ({4:'L1',5:'R1',6:'L2',7:'R2'} as Record<number,string>)[index];
        file = `steamdeck/${label}.svg`;
      } else if (index===9) file = 'shared/menu.svg';
      else {
        const key = ({4:'LB',5:'RB',6:'LT',7:'RT',8:'Share',10:'Left_Stick_Click',11:'Right_Stick_Click'} as Record<number,string>)[index];
        if (key) file = `xbox/T_X_${key}.png`;
      }
    }
  }
  return { family, label:label??`Button ${index+1}`, url:file?ROOT+file:svgGlyph(String(index+1)), fallback:!file };
}

export class InputPromptSystem {
  private pad: Gamepad | null = null;
  private touch = false;
  private hostFamily: ControllerFamily | null = null;
  private override: ControllerFamily | null = null;
  private provider: PromptGlyphProvider | null = null;
  private listeners = new Set<() => void>();
  private revisionValue = 0;
  constructor() {
    try { const saved=localStorage.getItem(PROMPT_STYLE_KEY); if(CONTROLLER_FAMILIES.includes(saved as ControllerFamily)) this.override=saved as ControllerFamily; } catch { /* optional storage */ }
  }
  get family(): PromptFamily { return this.hostFamily ?? (this.pad ? this.override ?? detectControllerFamily(this.pad.id) : this.touch ? 'touch' : 'keyboard'); }
  get gamepad(): Gamepad | null { return this.pad; }
  get controllerOverride(): ControllerFamily | null { return this.override; }
  get revision(): number { return this.revisionValue; }
  update(pad: Gamepad | null, touch: boolean): void {
    const before = `${this.family}:${this.pad?.id}:${this.pad?.mapping}`;
    this.pad = pad?.connected ? pad : null; this.touch = touch;
    if (before !== `${this.family}:${this.pad?.id}:${this.pad?.mapping}`) this.changed();
  }
  setControllerOverride(value: ControllerFamily | null): void {
    if (value !== null && !CONTROLLER_FAMILIES.includes(value)) throw new Error('Unknown controller prompt family');
    this.override=value;
    try { if(value)localStorage.setItem(PROMPT_STYLE_KEY,value);else localStorage.removeItem(PROMPT_STYLE_KEY); } catch { /* live choice still works */ }
    this.changed();
  }
  /** Console/Steam Input adapters can identify their real device even if the browser cannot. */
  setHostFamily(value: ControllerFamily | null): void {
    if(value!==null&&!CONTROLLER_FAMILIES.includes(value))throw new Error('Unknown host prompt family');
    this.hostFamily=value; this.changed();
  }
  setGlyphProvider(provider: PromptGlyphProvider | null): void { this.provider=provider; this.changed(); }
  resolve(action: InputAction): PromptGlyph | null {
    if (this.family==='touch') return null;
    const supplied=this.provider?.(action,this.family); if(supplied)return supplied;
    const binding=INPUT_BINDINGS[action];
    if(this.family==='keyboard')return keyboardGlyph(binding.key);
    if(this.pad?.mapping!== 'standard' && this.pad && !this.hostFamily && !this.override)
      return {family:this.family,label:`Button ${binding.button+1}`,url:svgGlyph(String(binding.button+1)),fallback:true};
    const index = action === 'mapLevelSelect' && this.family !== 'ps4' && this.family !== 'ps5' ? 8 : binding.button;
    return controllerGlyph(this.family,index);
  }
  subscribe(listener: () => void): () => void { this.listeners.add(listener);return ()=>this.listeners.delete(listener); }
  private changed(): void { this.revisionValue++;this.listeners.forEach(listener=>listener()); }
}
export const inputPrompts = new InputPromptSystem();
