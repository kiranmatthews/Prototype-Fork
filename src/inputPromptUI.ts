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

function opacityOf(element: HTMLElement): number {
  let opacity=1;
  for(let current: HTMLElement|null=element;current;current=current.parentElement){
    const style=getComputedStyle(current);
    if(style.display==='none'||style.visibility==='hidden'||current.hidden)return 0;
    const composed=current.matches('.game-hud-layer.precrt-composited')||current.matches('.game-shell.precrt-composited .game-shell-panel');
    if(!composed)opacity*=Number(style.opacity);
  }
  return opacity;
}
/** CSS-pixel coordinates in the shared pre-CRT interface renderer. */
export function paintInputPrompts(ctx: CanvasRenderingContext2D): void {
  for(const host of document.querySelectorAll<HTMLElement>('.input-glyph')){
    const opacity=opacityOf(host);if(opacity<.001)continue;
    const rect=host.getBoundingClientRect();if(rect.width<1||rect.height<1)continue;
    const glyph=inputPrompts.resolve(host.dataset.inputAction as InputAction);if(!glyph)continue;
    const image=imageFor(glyph);ctx.save();ctx.globalAlpha*=opacity;
    if(image.complete&&image.naturalWidth)ctx.drawImage(image,rect.x,rect.y,rect.width,rect.height);
    else {ctx.fillStyle='#292929';ctx.beginPath();ctx.roundRect(rect.x+2,rect.y+2,rect.width-4,rect.height-4,rect.height/4);ctx.fill();ctx.fillStyle='#fff';ctx.font=`700 ${Math.max(8,rect.height*.28)}px sans-serif`;ctx.textAlign='center';ctx.textBaseline='middle';ctx.fillText(glyph.label,rect.x+rect.width/2,rect.y+rect.height/2,rect.width-6);}
    ctx.restore();
  }
  for(const word of document.querySelectorAll<HTMLElement>('[data-prompt-word]')){
    const opacity=opacityOf(word);if(opacity<.001)continue;
    const rect=word.getBoundingClientRect(),style=getComputedStyle(word);
    ctx.save();ctx.globalAlpha*=opacity;ctx.font=`${style.fontWeight} ${style.fontSize} ${style.fontFamily}`;ctx.fillStyle=style.color;ctx.textBaseline='middle';ctx.textAlign='left';ctx.fillText((word.textContent??'').trimEnd(),rect.x,rect.y+rect.height/2,rect.width);ctx.restore();
  }
}
