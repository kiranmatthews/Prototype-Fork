import './input-prompts.css';
import { INPUT_BINDINGS, type InputAction } from './inputBindings';
import { inputPrompts, type PromptGlyph } from './inputPrompts';
import { trackPresentationImage } from './presentationLoading';

const images = new Map<string, HTMLImageElement>();
function isAction(key: string): key is InputAction { return Object.prototype.hasOwnProperty.call(INPUT_BINDINGS,key); }
if(typeof document!=='undefined' && document.body)document.body.dataset.promptFamily=inputPrompts.family;
function notify(): void { if(typeof window!=='undefined') window.dispatchEvent?.(new Event('input-prompts-changed')); }
function imageFor(glyph: PromptGlyph): HTMLImageElement {
  let image=images.get(glyph.url);
  if(!image){
    image=new Image(); images.set(glyph.url,image);
    image.addEventListener('load',notify); image.addEventListener('error',notify);
    trackPresentationImage(image,glyph.url); image.src=glyph.url;
  }
  return image;
}
function updateGlyph(host: HTMLElement): void {
  const glyph=inputPrompts.resolve(host.dataset.inputAction as InputAction);
  host.dataset.promptFamily=inputPrompts.family;
  host.classList.toggle('input-glyph-touch-text',!glyph&&!!host.dataset.touchLabel);
  if(!glyph){
    host.hidden=!host.dataset.touchLabel;host.replaceChildren();
    if(host.dataset.touchLabel){const text=document.createElement('span');text.dataset.promptWord='';text.textContent=host.dataset.touchLabel;host.appendChild(text);host.setAttribute('aria-label',text.textContent);}
    return;
  }
  host.hidden=false;host.setAttribute('aria-label',glyph.label);
  const image=imageFor(glyph), visible=document.createElement('img');
  visible.alt='';visible.setAttribute('aria-hidden','true');visible.draggable=false;visible.src=glyph.url;
  const fallback=document.createElement('span');fallback.className='input-glyph-fallback';fallback.textContent=glyph.label;fallback.hidden=true;
  visible.addEventListener('error',()=>{visible.hidden=true;fallback.hidden=false;});
  visible.addEventListener('load',()=>{visible.hidden=false;fallback.hidden=true;});
  if(image.complete && !image.naturalWidth){visible.hidden=true;fallback.hidden=false;}
  host.replaceChildren(visible,fallback);
}
export function createInputGlyph(action: InputAction, touchLabel?: string): HTMLElement {
  const host=document.createElement('span');host.className='input-glyph';host.dataset.inputAction=action;if(touchLabel)host.dataset.touchLabel=touchLabel;host.setAttribute('role','img');updateGlyph(host);return host;
}
export function setPromptText(host: HTMLElement, template: string): void {
  const parts=template.split(/(\{[a-zA-Z]+\})/g);
  const hasPrompt=parts.some(part=>part.startsWith('{')&&isAction(part.slice(1,-1)));
  host.classList.toggle('input-prompt-row',hasPrompt);
  if(!hasPrompt){delete host.dataset.promptTemplate;host.removeAttribute('aria-label');host.textContent=template;return;}
  host.dataset.promptTemplate=template;host.replaceChildren();
  for(const part of parts){
    const key=part.slice(1,-1);
    if(part.startsWith('{')&&isAction(key)) host.appendChild(createInputGlyph(key,key.toUpperCase()));
    else for(const word of part.trim().split(/\s+/).filter(Boolean)) {const span=document.createElement('span');span.dataset.promptWord='';span.textContent=word+' ';host.appendChild(span);}
  }
  host.setAttribute('aria-label',spokenPrompt(template));
}
function spokenPrompt(template: string): string {
  return template.replace(/\{([a-zA-Z]+)\}/g,(original,key)=>isAction(key)?inputPrompts.resolve(key)?.label??key:original);
}
inputPrompts.subscribe(()=>{
  if(typeof document==='undefined')return;
  document.body.dataset.promptFamily=inputPrompts.family;
  for(const glyph of document.querySelectorAll<HTMLElement>('[data-input-action]'))updateGlyph(glyph);
  for(const row of document.querySelectorAll<HTMLElement>('[data-prompt-template]'))row.setAttribute('aria-label',spokenPrompt(row.dataset.promptTemplate!));
  notify();
});

type PromptPaintInput = string | number;
interface PromptPaintRect { x: number; y: number; width: number; height: number; }
interface PromptGlyphPaint {
  rect: PromptPaintRect;
  opacity: number;
  image: HTMLImageElement;
  ready: boolean;
  label: string;
}
interface PromptWordPaint {
  rect: PromptPaintRect;
  opacity: number;
  font: string;
  color: string;
  text: string;
}
/** The exact paint inputs, sampled once so comparisons and Canvas use one frame. */
export interface InputPromptPaintFrame {
  readonly inputs: readonly PromptPaintInput[];
  readonly glyphs: readonly PromptGlyphPaint[];
  readonly words: readonly PromptWordPaint[];
}
export function sampleInputPrompts(scope: ParentNode = document, exclude?: string): InputPromptPaintFrame {
  const inputs: PromptPaintInput[] = [], glyphs: PromptGlyphPaint[] = [], words: PromptWordPaint[] = [];
  const opacities = new Map<HTMLElement, number>();
  const opacityOf = (element: HTMLElement): number => {
    const cached = opacities.get(element);
    if (cached !== undefined) return cached;
    const style = getComputedStyle(element);
    let opacity = 0;
    if (style.display !== 'none' && style.visibility !== 'hidden' && !element.hidden) {
      const composed = element.matches('.game-hud-layer.precrt-composited') || element.matches('.game-shell.precrt-composited .game-shell-panel') || element.matches('.competition-host[data-precrt-composited]');
      opacity = (composed ? 1 : Number(style.opacity)) * (element.parentElement ? opacityOf(element.parentElement) : 1);
    }
    opacities.set(element, opacity);
    return opacity;
  };
  for (const host of scope.querySelectorAll<HTMLElement>('.input-glyph')) {
    if (exclude && host.closest(exclude)) continue;
    const opacity = opacityOf(host); if (opacity < .001) continue;
    const rect = host.getBoundingClientRect(); if (rect.width < 1 || rect.height < 1) continue;
    const glyph = inputPrompts.resolve(host.dataset.inputAction as InputAction); if (!glyph) continue;
    const image = imageFor(glyph), ready = image.complete && image.naturalWidth > 0;
    glyphs.push({ rect, opacity, image, ready, label: glyph.label });
    inputs.push('glyph', rect.x, rect.y, rect.width, rect.height, opacity, glyph.url, glyph.label, Number(ready));
  }
  for (const word of scope.querySelectorAll<HTMLElement>('[data-prompt-word]')) {
    if (exclude && word.closest(exclude)) continue;
    const opacity = opacityOf(word); if (opacity < .001) continue;
    const rect = word.getBoundingClientRect(), style = getComputedStyle(word);
    const font = `${style.fontWeight} ${style.fontSize} ${style.fontFamily}`, color = style.color, text = (word.textContent ?? '').trimEnd();
    words.push({ rect, opacity, font, color, text });
    inputs.push('word', rect.x, rect.y, rect.width, rect.height, opacity, font, color, text);
  }
  return { inputs, glyphs, words };
}
/** CSS-pixel coordinates in the shared pre-CRT interface renderer. */
export function paintInputPrompts(ctx: CanvasRenderingContext2D, scope: ParentNode = document, exclude?: string, sampled?: InputPromptPaintFrame): void {
  const frame = sampled ?? sampleInputPrompts(scope, exclude);
  for (const { rect, opacity, image, ready, label } of frame.glyphs) {
    ctx.save(); ctx.globalAlpha *= opacity;
    if (ready) ctx.drawImage(image, rect.x, rect.y, rect.width, rect.height);
    else { ctx.fillStyle = '#292929'; ctx.beginPath(); ctx.roundRect(rect.x + 2, rect.y + 2, rect.width - 4, rect.height - 4, rect.height / 4); ctx.fill(); ctx.fillStyle = '#fff'; ctx.font = `700 ${Math.max(8, rect.height * .28)}px sans-serif`; ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.fillText(label, rect.x + rect.width / 2, rect.y + rect.height / 2, rect.width - 6); }
    ctx.restore();
  }
  for (const { rect, opacity, font, color, text } of frame.words) {
    ctx.save(); ctx.globalAlpha *= opacity; ctx.font = font; ctx.fillStyle = color; ctx.textBaseline = 'middle'; ctx.textAlign = 'left'; ctx.fillText(text, rect.x, rect.y + rect.height / 2, rect.width); ctx.restore();
  }
}
