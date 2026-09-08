import { inputPrompts } from '../inputPrompts';
import { setPromptText } from '../inputPromptUI';
import { actionButtonDown } from '../inputBindings';
import { JUDGES, type JungleCupEvent, type Standing } from './event';
import { CompetitionSurface } from './surface';

export type CompetitionAction = 'start' | 'standings' | 'retry' | 'exit';
export interface JudgePresentationHooks {
  portraitUrl?: (id: string) => string | undefined;
  onReveal?: (id: string, score: number) => void;
  dialogue?: (id: string, score: number) => string;
}
const esc = (s: string) => s.replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]!));
const mark = (n?: number) => n === undefined ? '—' : n.toFixed(1);
const ordinal = (n: number) => n === 1 ? '1ST' : n === 2 ? '2ND' : n === 3 ? '3RD' : `${n}TH`;
export const CUP_TROPHY_SVG = `<svg viewBox="0 0 120 128" role="img" aria-label="Jungle Cup trophy"><path d="M30 19H9v19c0 20 13 30 31 31M90 19h21v19c0 20-13 30-31 31" fill="none" stroke="#e5ae41" stroke-width="9"/><path d="M26 9h68l-5 43c-2 19-14 30-29 30S33 71 31 52Z" fill="#eab646" stroke="#634521" stroke-width="4"/><path d="M38 16h15l-2 45c-8-5-11-18-13-45" fill="#fff3a6"/><path d="M60 26l6 12 14 2-10 10 2 14-12-7-12 7 2-14-10-10 14-2Z" fill="#8c652e"/><path d="M52 79h16v24H52zM38 101h44v12H38z" fill="#d49b34"/><path d="M28 112h64v12H28z" fill="#3d6253" stroke="#d5ae62" stroke-width="3"/></svg>`;
function portrait(id: string, hooks: JudgePresentationHooks): string {
  const url = hooks.portraitUrl?.(id);
  if (url) return `<img src="${esc(url)}" alt=""/>`;
  const colors: Record<string,string> = {bone:'#b5b09a',rival:'#8f6ac2',moss:'#619d80',sol:'#d59b44',voss:'#a95142',roxy:'#d97b87',nova:'#65a6b8',mondo:'#748974',pip:'#b49461'};
  const hostile = id === 'voss', skull = id === 'bone';
  return `<svg viewBox="0 0 100 100" aria-hidden="true"><rect width="100" height="100" rx="18" fill="${colors[id]??'#728477'}"/><path d="M13 100q4-29 37-29t37 29" fill="#223d39"/><path d="M26 33q2-24 24-24t24 24v25q-4 23-24 23T26 58Z" fill="${skull?'#eee4c7':'#d6af84'}"/><path d="M25 36q-8-30 25-30 33 0 25 30l-14-14-19 10-10-10Z" fill="${skull?'#e8dfc3':'#323334'}"/><ellipse cx="38" cy="46" rx="${skull?9:4}" ry="${skull?10:5}" fill="#27332e"/><ellipse cx="63" cy="46" rx="${skull?9:4}" ry="${skull?10:5}" fill="#27332e"/><path d="${hostile?'M29 30l18 9M71 30L54 39':'M31 33h14M56 33h14'}" stroke="#2a332f" stroke-width="5"/><path d="${hostile?'M38 67q12-7 25 0':'M38 63q12 12 25 0'}" fill="none" stroke="#604a37" stroke-width="4"/>${skull?'<path d="M48 51l-4 10h12l-4-10M38 70h26M43 66v9M50 66v9M57 66v9" fill="none" stroke="#4d5144" stroke-width="3"/>':''}</svg>`;
}
export class CompetitionPresentation {
  readonly element = document.createElement('div');
  private key = '';
  private event: JungleCupEvent | null = null;
  private previous = {accept:false,up:false,down:false,left:false,right:false};
  private selected = 0;
  private seedInput = true;
  private revealed = 0;
  private revealRun = 0;
  private surface: CompetitionSurface;
  private phase = '';
  private pointer = { x: NaN, y: NaN };
  constructor(private action: (action: CompetitionAction) => void, readonly hooks: JudgePresentationHooks = {}) {
    this.element.className = 'competition-host'; this.element.hidden = true;
    const style = document.createElement('style'); style.textContent = CSS;
    document.head.append(style); document.body.append(this.element);
    this.surface = new CompetitionSurface(this.element);
    this.element.addEventListener('click', e => {
      const button = (e.target as Element).closest<HTMLButtonElement>('button[data-action]');
      if (button && !button.disabled && this.modalActive) {
        this.selected = this.buttons().indexOf(button); this.syncSelection(false);
        this.action(button.dataset.action as CompetitionAction);
      }
    });
    this.element.addEventListener('pointermove', e => {
      const moved = e.clientX !== this.pointer.x || e.clientY !== this.pointer.y;
      this.pointer = { x: e.clientX, y: e.clientY };
      if (!moved) return;
      const button = (e.target as Element).closest<HTMLButtonElement>('button:not(:disabled)');
      const index = button ? this.buttons().indexOf(button) : -1;
      if (index >= 0 && index !== this.selected) { this.selected=index; this.syncSelection(false); }
    });
    this.element.addEventListener('focusin', e => {
      const index=this.buttons().indexOf(e.target as HTMLButtonElement);
      if(index>=0 && index!==this.selected){this.selected=index;this.syncSelection(false);}
    });
    this.element.addEventListener('pointerdown', e => {
      const button=(e.target as Element).closest<HTMLButtonElement>('button:not(:disabled)');
      if(button){this.selected=this.buttons().indexOf(button);this.syncSelection(false);this.press(true);}
    });
    window.addEventListener('pointerup',()=>this.press(false));
    window.addEventListener('pointercancel',()=>this.press(false));
    window.addEventListener('blur',()=>{this.press(false);this.seedInput=true;});
    window.addEventListener('keyup',e=>{if(e.code==='Enter'||e.code==='Space')this.press(false);});
    window.addEventListener('keydown', e => {
      if (!this.modalActive || document.body.classList.contains('game-shell-modal') ||
          (e.target instanceof Element && e.target.closest('input,textarea,select,[contenteditable=true],.side-wrap,.secondary-text-tuner,[data-crt-guest-panel-host],[data-render-quality-panel-host],[data-skateboard-panel-host],.ed-panel'))) return;
      const buttons = this.buttons();
      if (['ArrowDown','ArrowRight','KeyS','KeyD'].includes(e.code)) {e.preventDefault();if(!e.repeat)this.select(1);}
      else if (['ArrowUp','ArrowLeft','KeyW','KeyA'].includes(e.code)) {e.preventDefault();if(!e.repeat)this.select(-1);}
      else if (e.code === 'Enter' || e.code === 'Space') {e.preventDefault();if(!e.repeat){this.press(true);buttons[this.selected]?.click();}}
      else if (e.code === 'Tab' && buttons.length) {e.preventDefault();if(!e.repeat)this.select(e.shiftKey?-1:1);}
    });
  }
  get modalActive(): boolean { return !!this.event && !this.element.hidden && this.event.phase !== 'running'; }
  get diagnostics() { return { selected: this.buttons()[this.selected]?.dataset.action ?? null, ...this.surface.diagnostics }; }
  paint(ctx: CanvasRenderingContext2D, size: {width:number;height:number}): void { this.surface.paint(ctx,size); }
  setComposited(value: boolean): void { if(!value)this.surface.deactivate(); }
  private buttons(): HTMLButtonElement[] { return [...this.element.querySelectorAll<HTMLButtonElement>('button:not(:disabled)')]; }
  private syncSelection(focus = true): void {
    const buttons=this.buttons();
    if(!buttons[this.selected])this.selected=0;
    for(const button of this.element.querySelectorAll<HTMLButtonElement>('button')) {
      const active=button===buttons[this.selected];
      button.classList.toggle('selected',active); button.tabIndex=active?0:-1;
    }
    if(focus)buttons[this.selected]?.focus({preventScroll:true});
    this.surface.invalidate();
  }
  private press(value: boolean): void {
    for(const button of this.buttons()) {
      const active=value&&button===this.buttons()[this.selected];
      if(button.classList.contains('pressed')!==active){button.classList.toggle('pressed',active);this.surface.invalidate();}
    }
  }
  private select(delta: number): void {
    const buttons=this.buttons();if(!buttons.length)return;
    this.press(false);this.selected=(this.selected+delta+buttons.length)%buttons.length;this.syncSelection();
    buttons[this.selected].scrollIntoView?.({block:'nearest',inline:'nearest'});
  }
  updateInput(pad: Gamepad | null = inputPrompts.gamepad): void {
    if (!this.event) return;
    const next={accept:actionButtonDown(pad,'confirm'),
      up:(pad?.axes[1]??0)<-.55||pad?.buttons[12]?.pressed===true,
      down:(pad?.axes[1]??0)>.55||pad?.buttons[13]?.pressed===true,
      left:(pad?.axes[0]??0)<-.55||pad?.buttons[14]?.pressed===true,
      right:(pad?.axes[0]??0)>.55||pad?.buttons[15]?.pressed===true};
    if(!this.seedInput&&this.modalActive&&!document.body.classList.contains('game-shell-modal')){
      if((next.up&&!this.previous.up)||(next.left&&!this.previous.left))this.select(-1);
      else if((next.down&&!this.previous.down)||(next.right&&!this.previous.right))this.select(1);
      if(next.accept&&!this.previous.accept){this.press(true);this.buttons()[this.selected]?.click();}
    }
    if(!next.accept&&this.previous.accept)this.press(false);
    this.previous=next;this.seedInput=false;
  }
  render(event: JungleCupEvent | null, suppressed = false): void {
    if (!event && !this.event && this.element.hidden) return;
    if (this.event !== event) { this.key=''; this.phase=''; this.revealed=0; this.revealRun=0; this.seedInput=true; }
    const wasHidden=this.element.hidden;
    this.event=event;this.element.hidden=!event||suppressed;
    if(wasHidden!==this.element.hidden){this.seedInput=true;this.surface.invalidate();}
    if(this.element.hidden)this.surface.deactivate();
    document.body.classList.toggle('competition-active',!!event);
    if(!event)return;
    const key=[event.phase,event.runs.length,Math.ceil(event.remaining),Math.ceil(event.countdown),event.revealedJudges,event.bails,event.cupAwarded,event.overtime].join(':');
    if(key===this.key)return;this.key=key;
    const phaseChanged=this.phase!==event.phase;this.phase=event.phase;
    if(phaseChanged)this.seedInput=true;
    this.element.classList.toggle('is-running',event.phase==='running');
    this.element.setAttribute('role',event.phase==='running'?'status':'dialog');
    this.element.setAttribute('aria-label','Jungle Cup skate competition');
    this.element.setAttribute('aria-modal',String(event.phase!=='running'));
    const header='<div class="comp-eyebrow">ISLAND 1 · SKATE COMPETITION</div><h1>JUNGLE CUP</h1>';
    const button=(label:string,action:CompetitionAction,disabled=false)=>`<button data-action="${action}"${disabled?' disabled':''}>${label}</button>`;
    let html='';
    const reveals: {id:string;score:number}[]=[];
    if(event.phase==='running') {
      const seconds=Math.ceil(event.remaining);
      html=`<div class="comp-run-hud${seconds<=10?' urgent':''}${event.overtime?' overtime':''}"><span>RUN ${event.runNumber}/3${event.overtime?'<small>FINAL COMBO</small>':''}</span><strong>${Math.floor(seconds/60)}:${String(seconds%60).padStart(2,'0')}</strong><span class="comp-bails">${event.bails} BAIL${event.bails===1?'':'S'}</span></div>`;
    } else if(event.phase==='countdown') {
      html=`<div class="comp-countdown"><span>RUN ${event.runNumber} / 3</span><strong>${Math.max(1,Math.ceil(event.countdown))}</strong><p>MAKE IT COUNT</p></div>`;
    } else if(event.phase==='intro') {
      html=`<section class="comp-card comp-intro">${header}<div class="comp-intro-body"><div class="comp-cup">${CUP_TROPHY_SVG}</div><div><h2>BEAT YOUR RIVAL. TAKE THE CUP.</h2><div class="comp-rules"><b>3 RUNS</b><b>60 SECONDS EACH</b><b>BEST 2 COUNT</b></div><p>Link grinds, airs and manuals through the temple park. Your board returns automatically after a bail. The clock holds at 0:00 until your final combo lands or breaks. Every bail costs judge points.</p><p>Only <strong>1st overall</strong> wins the Jungle Cup.</p></div></div><div class="comp-actions">${button('START RUN 1','start')}${button('RETURN TO MAP','exit')}</div></section>`;
    } else if(event.phase==='judges') {
      const run=event.runs[event.runs.length-1]!, all=event.revealedJudges===3;
      if(this.revealRun!==event.runs.length){this.revealRun=event.runs.length;this.revealed=0;}
      while(this.revealed<event.revealedJudges){const i=this.revealed++;reveals.push({id:JUDGES[i].id,score:run.judges[i]});}
      html=`<section class="comp-card">${header}<h2>RUN ${event.runs.length} · THE JUDGES</h2><div class="comp-judges">${JUDGES.map((j,i)=>{
        const shown=i<event.revealedJudges,score=run.judges[i];
        const line=this.hooks.dialogue?.(j.id,score)??(i===2?(score>=96?'Fine. That was… good.':'I expected cleaner.'):(score>=92?'That was a strong run.':'Keep those lines flowing.'));
        return `<article data-judge="${j.id}" data-reaction="${shown?(score>=96?'impressed':'critical'):'waiting'}" class="comp-judge${i===2?' hostile':''}${shown?' revealed':''}" style="--judge:${j.color}"><div class="comp-portrait">${portrait(j.portrait,this.hooks)}</div><h3>${j.name}</h3><small>${j.title}</small><strong>${shown?mark(score):'—'}</strong><p>${shown?esc(line):'Watching the replay…'}</p></article>`;
      }).join('')}</div><div class="comp-run-summary"><span>${run.gameplayScore.toLocaleString()} POINTS · ${run.bails} BAIL${run.bails===1?'':'S'}</span><strong>AVERAGE ${all?mark(run.score):'—'}</strong><span>${all?`CURRENT RANK ${ordinal(event.rank)}`:'JUDGING…'}</span></div><div class="comp-history">${event.runs.map((r,i)=>`<span>RUN ${i+1} <b>${i<event.runs.length-1||all?mark(r.score):'—'}</b></span>`).join('')}</div><div class="comp-actions">${button('VIEW STANDINGS','standings',!all)}</div></section>`;
    } else {
      const final=event.phase==='final',rows=event.standings,player=rows.find(r=>r.id==='player')!;
      html=`<section class="comp-card comp-standings">${header}<h2>${final?(event.won?'YOU BEAT YOUR RIVAL!':`${ordinal(event.rank)} OVERALL · THE RIVAL WINS`):`AFTER RUN ${event.runs.length}`}</h2>${final?`<div class="comp-podium">${rows.slice(0,3).map(r=>`<div><b>${ordinal(r.rank)}</b><span class="comp-avatar">${portrait(r.portrait,this.hooks)}</span><strong>${esc(r.name)}</strong><small>${mark(r.total)}</small></div>`).join('')}</div>`:''}${this.leaderboard(rows)}<p class="comp-note">${final?`Your best two: <strong>${mark(player.total)}</strong> · Discarded run ${(player.discarded??0)+1} (${mark(player.runs[player.discarded??0])}).`:'Provisional total uses completed runs. After Run 3, everyone drops their lowest score.'}</p>${final&&event.won?`<div class="comp-award"><span>${CUP_TROPHY_SVG}</span><div><h3>JUNGLE CUP ${event.cupAwarded?'EARNED':'WON'}</h3><p>Your one-off trophy is shown in Progress.</p></div></div>`:''}<div class="comp-actions">${final?(event.won?button('RETURN TO MAP','exit')+button('COMPETE AGAIN','retry'):button('RETRY COMPETITION','retry')+button('RETURN TO MAP','exit')):button(`START RUN ${event.runs.length+1}`,'start')+button('LEAVE COMPETITION','exit')}</div></section>`;
    }
    const focused=!phaseChanged?this.buttons()[this.selected]?.dataset.action:undefined;
    this.element.innerHTML=html;this.selected=0;
    if(event.phase==='intro') {
      const body=this.element.querySelector('.comp-intro-body>div:last-child');
      if(body) for(const text of [
        '{left} / {right} steer · {down} brake · {up} transfers over vert',
        'Hold {jump} to crouch and accelerate; release to ollie. {grind} grinds.',
      ]) {
        const row=document.createElement('p');row.className='comp-controls';
        setPromptText(row,text);body.appendChild(row);
      }
    }
    for (const reveal of reveals) this.hooks.onReveal?.(reveal.id,reveal.score);
    if(event.phase!=='running'&&event.phase!=='countdown') {
      const target=this.element.querySelector<HTMLButtonElement>(`button[data-action="${focused??''}"]:not(:disabled)`)??this.buttons()[0];
      this.selected=Math.max(0,this.buttons().indexOf(target!));
      this.syncSelection(!suppressed&&!document.body.classList.contains('game-shell-modal'));
    }
    this.surface.invalidate();
  }
  private leaderboard(rows: Standing[]): string {
    return `<div class="comp-table-wrap"><table><thead><tr><th>#</th><th>SKATER</th><th>RUN 1</th><th>RUN 2</th><th>RUN 3</th><th>TOTAL</th></tr></thead><tbody>${rows.map(r=>`<tr class="${r.id==='player'?'player-row':r.id==='rival'?'rival-row':''}"><td>${r.rank}</td><th><span class="comp-avatar">${portrait(r.portrait,this.hooks)}</span><span>${esc(r.name)}</span></th>${[0,1,2].map(i=>`<td${r.discarded===i?' class="discarded" title="Discarded run"':''}>${mark(r.runs[i])}</td>`).join('')}<td><b>${mark(r.total)}</b></td></tr>`).join('')}</tbody></table></div>`;
  }
}
const CSS=`
.competition-host{position:fixed;inset:0;z-index:65;display:flex;align-items:center;justify-content:center;background:linear-gradient(#10231cd9,#0b151be8);color:#f5ead1;font-family:'Staging Secondary',Arial,sans-serif;padding:22px;box-sizing:border-box}
.competition-host[hidden],body.game-shell-modal .competition-host,body.ed-active .competition-host{display:none!important}.competition-host *{box-sizing:border-box}.competition-host.is-running{background:none;pointer-events:none;align-items:flex-start;padding:16px}
.comp-card{width:min(940px,100%);max-height:94vh;overflow:auto;background:#19332ff7;border:3px solid #c9b783;box-shadow:12px 12px 0 #0715129c;padding:22px 30px}.comp-card h1{font:48px Roo,Impact,sans-serif;letter-spacing:1px;color:#ffce66;margin:0 0 8px;text-shadow:3px 4px #0c1d19}.comp-card h2{font:25px 'Staging Secondary',Impact,sans-serif;margin:9px 0 18px}.comp-eyebrow{font-size:12px;letter-spacing:3px;color:#aabeb0}.comp-intro-body{display:flex;align-items:center;gap:32px;margin:22px 0}.comp-intro-body p{font:17px/1.5 Arial,sans-serif;max-width:550px;color:#d9e0ce}.comp-cup{width:170px;flex-shrink:0}.comp-cup svg{width:100%}.comp-rules{display:flex;gap:10px;flex-wrap:wrap}.comp-rules b{background:#2c5044;padding:10px;color:#f0dca4;font-size:14px}.comp-actions{display:flex;justify-content:center;gap:12px;flex-wrap:wrap;margin-top:20px}.comp-actions button{font:19px 'Staging Secondary',Arial,sans-serif;padding:13px 22px;background:#23483f;color:#eadbb3;border:3px solid #8d9f79;cursor:pointer}.comp-actions button+button{background:#23483f;color:#eadbb3;border-color:#8d9f79}.comp-actions button.selected{background:#f8dda0;color:#b7350d;border-color:#f05a20;outline:3px solid #fff0a3;outline-offset:3px}.comp-actions button.pressed{background:#f05a20;color:#fff3cf;border-color:#fff0a3}.comp-actions button:focus-visible{outline:3px solid #fff0a3;outline-offset:3px}.comp-actions button:disabled{opacity:.4;cursor:default}
.comp-run-hud{display:flex;align-items:center;gap:24px;background:#122d27ee;border:2px solid #d5bd79;padding:9px 20px;box-shadow:4px 5px #0006}.comp-run-hud>strong{font-size:36px;color:#ffd278;min-width:80px;text-align:center}.comp-run-hud span{font-size:18px}.comp-run-hud small{display:block;font-size:11px;color:#b9c9ac}.comp-run-hud.urgent>strong{color:#ff8864}.comp-countdown{text-align:center}.comp-countdown span,.comp-countdown p{display:block;letter-spacing:4px;font-size:23px}.comp-countdown>strong{font:160px Roo,Impact,sans-serif;color:#ffd278}
.comp-judges{display:grid;grid-template-columns:repeat(3,1fr);gap:15px}.comp-judge{text-align:center;background:#10251f;border-top:6px solid var(--judge);padding:16px 12px}.comp-portrait{width:94px;height:94px;margin:auto}.comp-portrait svg,.comp-portrait img,.comp-avatar svg,.comp-avatar img{width:100%;height:100%;object-fit:cover}.comp-judge h3{font-size:24px;margin:8px 0 1px}.comp-judge small{color:#b7c0a9}.comp-judge>strong{display:block;font-size:56px;color:#ffd278;margin:8px 0}.comp-judge p{min-height:32px;font:14px/1.3 Arial,sans-serif;color:#c8d6c6;margin:5px 0}.comp-judge.hostile{background:#3b2925}.comp-judge.revealed>strong{animation:comp-pop .25s ease-out}.comp-run-summary{display:flex;justify-content:space-between;align-items:center;gap:15px;flex-wrap:wrap;margin-top:20px;font-size:16px}.comp-run-summary strong{font-size:30px;color:#ffce66}.comp-history{display:flex;gap:18px;justify-content:center;margin:16px 0}.comp-history span{background:#294a40;padding:8px 14px;color:#c7d2ba}.comp-history b{color:white;margin-left:12px}
.comp-table-wrap table{border-collapse:collapse;width:100%;font-variant-numeric:tabular-nums}.comp-table-wrap th,.comp-table-wrap td{padding:10px 8px;border-bottom:1px solid #426155;text-align:right}.comp-table-wrap thead th{font-size:12px;color:#b6c4aa;letter-spacing:1px}.comp-table-wrap th:first-child,.comp-table-wrap td:first-child{text-align:center;width:35px}.comp-table-wrap th:nth-child(2){text-align:left}.comp-table-wrap tbody th{display:flex;align-items:center;gap:10px;font-size:18px}.comp-avatar{display:inline-flex;width:37px;height:37px;flex-shrink:0}.comp-table-wrap td{font-size:22px}.comp-table-wrap .player-row{background:#416044;box-shadow:inset 4px 0 #ffd278}.comp-table-wrap .rival-row{background:#382f4b}.comp-table-wrap .discarded{text-decoration:line-through;color:#7b8d7f}.comp-note{font:14px/1.4 Arial,sans-serif;color:#c2cdb9}.comp-standings h1{font-size:38px}.comp-standings .comp-avatar{width:30px;height:30px}.comp-podium{display:flex;justify-content:center;gap:24px;margin:8px 0 12px}.comp-podium>div{display:flex;flex-direction:column;align-items:center;gap:3px;min-width:110px;padding:8px;background:#10261f}.comp-podium b{color:#ffd278}.comp-podium .comp-avatar{width:36px;height:36px}.comp-award{display:flex;align-items:center;justify-content:center;gap:18px;background:#2d4b36;margin-top:12px;padding:8px}.comp-award>span{width:64px}.comp-award h3{color:#ffce66;margin:0;font-size:23px}.comp-award p{font:14px Arial,sans-serif;margin:5px 0}
body.game-interface-composited .comp-judge.revealed>strong{animation:none}.comp-table-wrap{overflow-x:auto}
@keyframes comp-pop{from{transform:scale(1.2)}to{transform:scale(1)}}@media(max-width:620px){.competition-host{padding:9px}.comp-card{padding:16px 12px;max-height:96vh}.comp-card h1{font-size:34px}.comp-card h2{font-size:20px}.comp-intro-body{display:block;margin:12px 0}.comp-cup{width:88px;margin:auto}.comp-rules{gap:5px}.comp-rules b{font-size:11px;padding:8px}.comp-intro-body p{font-size:14px}.comp-judges{gap:6px}.comp-judge{padding:10px 4px}.comp-portrait{width:60px;height:60px}.comp-judge h3{font-size:19px}.comp-judge small{font-size:10px}.comp-judge>strong{font-size:37px}.comp-judge p{font-size:11px;min-height:40px}.comp-run-summary{font-size:12px;justify-content:center;gap:8px}.comp-run-summary strong{font-size:23px}.comp-history{gap:5px}.comp-history span{font-size:11px;padding:7px}.comp-history b{margin-left:4px}.comp-actions{gap:8px;margin-top:14px}.comp-actions button{font-size:15px;padding:11px}.comp-table-wrap th,.comp-table-wrap td{padding:8px 3px}.comp-table-wrap thead th{font-size:9px;letter-spacing:0}.comp-table-wrap tbody th{font-size:12px;gap:4px;min-width:82px}.comp-table-wrap td{font-size:15px}.comp-avatar{width:26px;height:26px}.comp-podium{gap:7px}.comp-podium>div{min-width:80px;font-size:12px}.comp-run-hud{gap:14px;padding:7px 12px}.comp-run-hud span{font-size:14px}.comp-run-hud>strong{font-size:29px;min-width:67px}.comp-award p{font-size:12px}.comp-note{font-size:11px}}
@media(max-width:620px){.competition-host.is-running{justify-content:flex-start;padding:12px 14px 0 28px}.comp-run-hud{display:grid;grid-template-columns:1fr auto;gap:2px 8px;width:min(255px,calc(100vw - 165px));padding:8px 10px}.comp-run-hud>span{font-size:12px;white-space:nowrap}.comp-run-hud small{font-size:9px}.comp-run-hud>strong{grid-column:2;grid-row:1 / span 2;min-width:0;font-size:28px}.comp-run-hud>.comp-bails{grid-column:1;font-size:10px}}
@media(max-height:650px){.comp-actions{position:sticky;bottom:0;background:#19332f;padding:10px 0 6px}}`;
