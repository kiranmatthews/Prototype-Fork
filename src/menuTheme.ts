import { trackPresentationImage } from './presentationLoading';
import { presentationCssViewport } from './presentationCssViewport';

/** Shared artwork for the semantic DOM and both cached pre-CRT painters. */
export const MENU_THEME = {
  top: '#103544', middle: '#082535', bottom: '#03121f',
  edge: '#ae8850', rivet: '#e2bd73', shadow: '#020812',
  backdropTop: '#041827f5', backdropBottom: '#010915fc',
};
const ART_ROOT = `${import.meta.env.BASE_URL}ui/menu/`;
export const MENU_THEME_CSS = `:root {
  --menu-panel-top:${MENU_THEME.top}; --menu-panel-middle:${MENU_THEME.middle};
  --menu-panel-bottom:${MENU_THEME.bottom}; --menu-edge:${MENU_THEME.edge};
  --menu-rivet:${MENU_THEME.rivet}; --menu-shadow:${MENU_THEME.shadow};
  --menu-backdrop-top:${MENU_THEME.backdropTop}; --menu-backdrop-bottom:${MENU_THEME.backdropBottom};
  --menu-panel-art:url("${ART_ROOT}painted-panel.webp");
  --menu-backdrop-art:url("${ART_ROOT}stone-backdrop.webp");
  --menu-frame:clamp(14px,min(3.6vw,6vh),56px);
}`;

const artwork: {panel?: HTMLImageElement; backdrop?: HTMLImageElement} = {};
let artworkReady: Promise<void> | undefined;
/** Decode inside the existing presentation gate. Failures use the vector fallback. */
export function loadMenuArtwork(): Promise<void> {
  if (typeof Image === 'undefined') return Promise.resolve();
  return artworkReady ??= Promise.all((['panel', 'backdrop'] as const).map(kind => new Promise<void>(resolve => {
    const image = new Image();
    const url = `${ART_ROOT}${kind === 'panel' ? 'painted-panel' : 'stone-backdrop'}.webp`;
    trackPresentationImage(image, url);
    image.onload = () => { void image.decode().catch(() => {}).then(() => { artwork[kind] = image; resolve(); }); };
    image.onerror = () => resolve();
    image.src = url;
  }))).then(() => {});
}

export interface MenuArtRect { x: number; y: number; width: number; height: number }

function frameSize(): number {
  const {width, height} = presentationCssViewport();
  return Math.max(14, Math.min(width * .036, height * .06, 56));
}

function chamfer(ctx: CanvasRenderingContext2D, r: MenuArtRect, cut = 8): void {
  const c = Math.min(cut, r.width / 4, r.height / 4), {x,y,width:w,height:h} = r;
  ctx.beginPath(); ctx.moveTo(x+c,y); ctx.lineTo(x+w-c,y); ctx.lineTo(x+w,y+c);
  ctx.lineTo(x+w,y+h-c); ctx.lineTo(x+w-c,y+h); ctx.lineTo(x+c,y+h);
  ctx.lineTo(x,y+h-c); ctx.lineTo(x,y+c); ctx.closePath();
}

/** Keep painted corner caps square on portrait cards and wide dialogs. */
function nineSlice(ctx: CanvasRenderingContext2D, image: HTMLImageElement, r: MenuArtRect, border: number, fill: boolean): void {
  const sx = image.naturalWidth * .12, sy = image.naturalHeight * .12;
  const b = Math.min(border, r.width / 3, r.height / 3);
  const xs = [0,sx,image.naturalWidth-sx,image.naturalWidth], ys = [0,sy,image.naturalHeight-sy,image.naturalHeight];
  const dx = [r.x,r.x+b,r.x+r.width-b,r.x+r.width], dy = [r.y,r.y+b,r.y+r.height-b,r.y+r.height];
  for (let y=0;y<3;y++) for (let x=0;x<3;x++) {
    if (!fill && x===1 && y===1) continue;
    ctx.drawImage(image,xs[x],ys[y],xs[x+1]-xs[x],ys[y+1]-ys[y],dx[x],dy[y],dx[x+1]-dx[x],dy[y+1]-dy[y]);
  }
}

export function paintMenuBackdrop(ctx: CanvasRenderingContext2D, width: number, height: number, opaque = false): void {
  const shade = ctx.createLinearGradient(0, 0, 0, height);
  shade.addColorStop(0, opaque ? '#041827' : MENU_THEME.backdropTop);
  shade.addColorStop(1, opaque ? '#010915' : MENU_THEME.backdropBottom);
  ctx.fillStyle = shade; ctx.fillRect(0, 0, width, height);
  // Preserve the peripheral framing in portrait as well as landscape.
  if (artwork.backdrop) ctx.drawImage(artwork.backdrop, 0, 0, width, height);
}

export function paintMenuPanel(ctx: CanvasRenderingContext2D, r: MenuArtRect): void {
  ctx.save();
  chamfer(ctx,r);
  ctx.shadowColor = '#0009'; ctx.shadowBlur = 24; ctx.shadowOffsetY = 10;
  ctx.fillStyle = MENU_THEME.shadow; ctx.fill(); ctx.shadowColor = 'transparent'; ctx.shadowOffsetY = 0;
  if (artwork.panel) nineSlice(ctx,artwork.panel,r,frameSize(),true);
  else {
    const surface = ctx.createLinearGradient(0,r.y,0,r.y+r.height);
    surface.addColorStop(0,MENU_THEME.top); surface.addColorStop(1,MENU_THEME.bottom);
    ctx.fillStyle = surface; ctx.fill(); ctx.strokeStyle = MENU_THEME.edge; ctx.lineWidth = 2; ctx.stroke();
  }
  ctx.restore();
}

/** Insets stay quieter than panels; focus remains PNG ink only. */
export function paintMenuInset(ctx: CanvasRenderingContext2D, r: MenuArtRect): void {
  ctx.save(); chamfer(ctx,r,5); ctx.clip();
  const fill=ctx.createLinearGradient(0,r.y,0,r.y+r.height);
  fill.addColorStop(0,'#163746'); fill.addColorStop(1,'#091d2c');
  ctx.fillStyle=fill; ctx.fillRect(r.x,r.y,r.width,r.height);
  if (artwork.panel) {
    ctx.globalAlpha *= .35;
    const image=artwork.panel;
    ctx.drawImage(image,image.naturalWidth*.15,image.naturalHeight*.3,image.naturalWidth*.7,image.naturalHeight*.2,r.x,r.y,r.width,r.height);
  }
  ctx.restore(); ctx.save(); chamfer(ctx,r,5);
  ctx.strokeStyle='#356173'; ctx.lineWidth=1; ctx.stroke();
  ctx.strokeStyle='#ad8c55'; ctx.lineWidth=1.5;
  ctx.beginPath();ctx.moveTo(r.x+1,r.y+9);ctx.lineTo(r.x+1,r.y+5);ctx.lineTo(r.x+5,r.y+1);ctx.lineTo(r.x+12,r.y+1);ctx.stroke();
  ctx.restore();
}

export function paintMenuPictureFrame(ctx: CanvasRenderingContext2D, r: MenuArtRect): void {
  ctx.save();
  if (artwork.panel) nineSlice(ctx,artwork.panel,r,Math.min(10,frameSize()*.23),false);
  else { ctx.strokeStyle=MENU_THEME.edge;ctx.lineWidth=3;ctx.strokeRect(r.x+1.5,r.y+1.5,r.width-3,r.height-3); }
  ctx.restore();
}

export function paintMenuRule(ctx: CanvasRenderingContext2D, r: MenuArtRect): void {
  const y=r.y+r.height+3, x=r.x+r.width*.1, w=r.width*.8;
  const line=ctx.createLinearGradient(x,0,x+w,0);
  line.addColorStop(0,'#47819700');line.addColorStop(.25,'#47819780');line.addColorStop(.5,'#9ac6ccaa');line.addColorStop(.75,'#47819780');line.addColorStop(1,'#47819700');
  ctx.save();ctx.strokeStyle=line;ctx.lineWidth=1;ctx.beginPath();ctx.moveTo(x,y);ctx.lineTo(x+w,y);ctx.stroke();ctx.restore();
}

export function paintMenuCollectionGrid(ctx: CanvasRenderingContext2D, r: MenuArtRect): void {
  ctx.save();ctx.strokeStyle='#5b9aab26';ctx.lineWidth=1;
  chamfer(ctx,r,10);ctx.stroke();
  ctx.beginPath();ctx.moveTo(r.x+r.width/2,r.y+10);ctx.lineTo(r.x+r.width/2,r.y+r.height-10);
  ctx.moveTo(r.x+10,r.y+r.height/2);ctx.lineTo(r.x+r.width-10,r.y+r.height/2);ctx.stroke();ctx.restore();
}

export function paintMenuRewardWell(ctx: CanvasRenderingContext2D, r: MenuArtRect, earned: boolean): void {
  ctx.save();
  const x=r.x+r.width/2,y=r.y+r.height/2,radius=Math.min(r.width,r.height)*.52;
  const glow=ctx.createRadialGradient(x,y,0,x,y,radius);
  glow.addColorStop(0,earned?'#27b9cf30':'#16425324');glow.addColorStop(.55,earned?'#12829816':'#06132118');glow.addColorStop(1,'#06132100');
  ctx.fillStyle=glow;ctx.fillRect(r.x,r.y,r.width,r.height);ctx.restore();
}
