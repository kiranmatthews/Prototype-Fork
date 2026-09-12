/** Shared menu artwork for both Canvas compositors and the semantic DOM. */
export const MENU_THEME = {
  top: '#14313a', middle: '#0c2029', bottom: '#07141d',
  edge: '#87683d', rivet: '#bb965e', shadow: '#02070f',
  backdropTop: '#07141bf5', backdropBottom: '#02070ffc',
};
export const MENU_THEME_CSS = `:root {
  --menu-panel-top:${MENU_THEME.top}; --menu-panel-middle:${MENU_THEME.middle};
  --menu-panel-bottom:${MENU_THEME.bottom}; --menu-edge:${MENU_THEME.edge};
  --menu-rivet:${MENU_THEME.rivet}; --menu-shadow:${MENU_THEME.shadow};
  --menu-backdrop-top:${MENU_THEME.backdropTop}; --menu-backdrop-bottom:${MENU_THEME.backdropBottom};
}`;

export function paintMenuBackdrop(ctx: CanvasRenderingContext2D, width: number, height: number, opaque = false): void {
  const shade = ctx.createLinearGradient(0, 0, 0, height);
  shade.addColorStop(0, opaque ? '#07141b' : MENU_THEME.backdropTop);
  shade.addColorStop(1, opaque ? '#02070f' : MENU_THEME.backdropBottom);
  ctx.fillStyle = shade; ctx.fillRect(0, 0, width, height);
}

export function paintMenuPanel(ctx: CanvasRenderingContext2D, r: {x:number;y:number;width:number;height:number}): void {
  ctx.save();
  const radius = Math.min(13, r.height / 8);
  ctx.beginPath(); ctx.roundRect(r.x, r.y, r.width, r.height, radius);
  ctx.shadowColor = '#000a'; ctx.shadowBlur = 28; ctx.shadowOffsetY = 12;
  ctx.fillStyle = MENU_THEME.shadow; ctx.fill(); ctx.shadowColor = 'transparent';
  const wood = ctx.createLinearGradient(0, r.y, 0, r.y + r.height);
  wood.addColorStop(0, MENU_THEME.top); wood.addColorStop(.56, MENU_THEME.middle); wood.addColorStop(1, MENU_THEME.bottom);
  ctx.fillStyle = wood; ctx.fill(); ctx.strokeStyle = MENU_THEME.edge; ctx.lineWidth = 4; ctx.stroke();
  ctx.strokeStyle = '#a5c0b410'; ctx.lineWidth = 1;
  for (const fraction of [.14, .59]) {
    ctx.beginPath(); ctx.moveTo(r.x + r.width * fraction, r.y + 5);
    ctx.lineTo(r.x + r.width * (fraction + .015), r.y + r.height - 5); ctx.stroke();
  }
  for (const [x,y] of [[r.x+13,r.y+13],[r.x+r.width-13,r.y+r.height-13]]) {
    ctx.beginPath(); ctx.arc(x,y,4,0,Math.PI*2); ctx.fillStyle=MENU_THEME.rivet; ctx.fill();
    ctx.strokeStyle=MENU_THEME.shadow; ctx.lineWidth=2; ctx.stroke();
  }
  ctx.restore();
}
