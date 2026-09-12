import { updateMenuPngFocus } from '../menuPngFocus';
import CSS from './menu.css?inline';
import { menuHint } from "../menuPresentation";
import { inputPrompts } from '../inputPrompts';
import { setPromptText } from '../inputPromptUI';
import { actionButtonDown } from '../inputBindings';
import { JUDGES, type JungleCupEvent, type Standing } from './event';
import { CompetitionSurface } from './surface';
import { TRICK_GUIDE_INTRO, TRICK_GUIDE_PAGE_COUNT, trickGuidePages } from '../skateTrickGuide';
import { installRooMenuText } from '../roo-type/menu';

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
  private previous = {accept:false,back:false,up:false,down:false,left:false,right:false};
  private selected = 0;
  private seedInput = true;
  private revealed = 0;
  private revealRun = 0;
  private surface: CompetitionSurface;
  private phase = '';
  private guideOpen = false;
  private guidePage = 0;
  private pointer = { x: NaN, y: NaN };
  constructor(private action: (action: CompetitionAction) => void, readonly hooks: JudgePresentationHooks = {}) {
    this.element.className = 'competition-host'; this.element.hidden = true;
    const style = document.createElement('style'); style.textContent = CSS;
    document.head.append(style); document.body.append(this.element);
    this.surface = new CompetitionSurface(this.element);
    installRooMenuText(this.element,()=>this.surface.invalidate());
    this.element.addEventListener('click', e => {
      const button = (e.target as Element).closest<HTMLButtonElement>('button[data-action]');
      if (button && !button.disabled && this.modalActive) {
        this.selected = this.buttons().indexOf(button); this.syncSelection(false);
        if(button.dataset.action==='guide'){this.showGuide(true);return;}
        if(button.dataset.action==='guide-prev' || button.dataset.action==='guide-next'){this.changeGuidePage(button.dataset.action==='guide-next'?1:-1);return;}
        if(button.dataset.action==='guide-back'){this.showGuide(false);return;}
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
      if(this.guideOpen && ['ArrowLeft','ArrowRight'].includes(e.code)){e.preventDefault();if(!e.repeat)this.changeGuidePage(e.code==='ArrowRight'?1:-1);return;}
      if(e.code==='Escape'&&this.guideOpen){e.preventDefault();e.stopImmediatePropagation();if(!e.repeat)this.showGuide(false);return;}
      if (['ArrowDown','ArrowRight','KeyS','KeyD'].includes(e.code)) {e.preventDefault();if(!e.repeat)this.select(1);}
      else if (['ArrowUp','ArrowLeft','KeyW','KeyA'].includes(e.code)) {e.preventDefault();if(!e.repeat)this.select(-1);}
      else if (e.code === 'Enter' || e.code === 'Space') {e.preventDefault();if(!e.repeat){this.press(true);buttons[this.selected]?.click();}}
      else if (e.code === 'Tab' && buttons.length) {e.preventDefault();if(!e.repeat)this.select(e.shiftKey?-1:1);}
    });
  }
  get modalActive(): boolean { return !!this.event && !this.element.hidden && !this.event.simulating; }
  private showGuide(open:boolean):void {
    this.guideOpen=open;this.key='';this.seedInput=true;this.render(this.event);
    if(!open){this.selected=Math.max(0,this.buttons().findIndex(button=>button.dataset.action==='guide'));this.syncSelection();}
  }
  private changeGuidePage(delta:number):void {this.guidePage=(this.guidePage+delta+TRICK_GUIDE_PAGE_COUNT)%TRICK_GUIDE_PAGE_COUNT;this.key='';this.render(this.event);}
  get diagnostics() { return { selected: this.buttons()[this.selected]?.dataset.action ?? null, ...this.surface.diagnostics }; }
  paint(ctx: CanvasRenderingContext2D, size: {width:number;height:number}): void { this.surface.paint(ctx,size); }
  setComposited(value: boolean): void { if(!value)this.surface.deactivate(); }
  private buttons(): HTMLButtonElement[] { return [...this.element.querySelectorAll<HTMLButtonElement>('button:not(:disabled):not([data-touch-close])')]; }
  private syncSelection(focus = true): void {
    const buttons=this.buttons();
    if(!buttons[this.selected])this.selected=0;
    for(const button of this.element.querySelectorAll<HTMLButtonElement>('button')) {
      const active=button===buttons[this.selected];
      button.classList.toggle('selected',active); button.tabIndex=active?0:-1;
    }
    if(focus)buttons[this.selected]?.focus({preventScroll:true});
    updateMenuPngFocus(this.element,performance.now(),true);
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
    if(!this.element.hidden && updateMenuPngFocus(this.element,performance.now()))this.surface.invalidate();
    const next={accept:actionButtonDown(pad,'confirm'),back:actionButtonDown(pad,'back'),
      up:(pad?.axes[1]??0)<-.55||pad?.buttons[12]?.pressed===true,
      down:(pad?.axes[1]??0)>.55||pad?.buttons[13]?.pressed===true,
      left:(pad?.axes[0]??0)<-.55||pad?.buttons[14]?.pressed===true,
      right:(pad?.axes[0]??0)>.55||pad?.buttons[15]?.pressed===true};
    if(!this.seedInput&&this.modalActive&&!document.body.classList.contains('game-shell-modal')){
      if(this.guideOpen && ((next.left&&!this.previous.left)||(next.right&&!this.previous.right)))this.changeGuidePage(next.right?1:-1);
      else if((next.up&&!this.previous.up)||(next.left&&!this.previous.left))this.select(-1);
      else if((next.down&&!this.previous.down)||(next.right&&!this.previous.right))this.select(1);
      if(next.accept&&!this.previous.accept){this.press(true);this.buttons()[this.selected]?.click();}
      else if(next.back&&!this.previous.back&&this.guideOpen)this.showGuide(false);
    }
    if(!next.accept&&this.previous.accept)this.press(false);
    this.previous=next;this.seedInput=false;
  }
  render(event: JungleCupEvent | null, suppressed = false): void {
    if (!event && !this.event && this.element.hidden) return;
    if (this.event !== event) { this.key=''; this.phase=''; this.guideOpen=false; this.revealed=0; this.revealRun=0; this.seedInput=true; }
    const wasHidden=this.element.hidden;
    this.event=event;this.element.hidden=!event||suppressed;
    if(wasHidden!==this.element.hidden){this.seedInput=true;this.surface.invalidate();}
    if(this.element.hidden)this.surface.deactivate();
    document.body.classList.toggle('competition-active',!!event);
    if(!event)return;
    if(event.simulating||event.phase==='countdown')this.guideOpen=false;
    const view=this.guideOpen?'guide':event.phase;
    const key=[view,event.runs.length,Math.ceil(event.remaining),Math.ceil(event.countdown),event.revealedJudges,event.bails,event.cupAwarded,event.overtime,event.finalComboActive].join(':');
    if(key===this.key)return;this.key=key;
    const phaseChanged=this.phase!==view;this.phase=view;
    if(phaseChanged)this.seedInput=true;
    this.element.classList.toggle('is-running',event.simulating);
    this.element.setAttribute('role',event.simulating?'status':'dialog');
    this.element.setAttribute('aria-label','Jungle Cup skate competition');
    this.element.setAttribute('aria-modal',String(!event.simulating));
    const header='<div class="comp-eyebrow">ISLAND 1 · SKATE COMPETITION</div><h1>JUNGLE CUP</h1>';
    const button=(label:string,action:CompetitionAction|'guide'|'guide-back',disabled=false)=>`<button data-action="${action}"${disabled?' disabled':''}>${label}</button>`;
    let html='';
    const reveals: {id:string;score:number}[]=[];
    if(this.guideOpen){
      html=`<section class="timber-card comp-card comp-guide"><h1>TRICK GUIDE</h1><p>${TRICK_GUIDE_INTRO}</p><div class="comp-guide-grid">${trickGuidePages().join('')}</div><div class="comp-actions">${button('BACK','guide-back')}</div></section>`;
    } else if(event.simulating) {
      const seconds=Math.ceil(event.remaining);
      html=`<div class="comp-run-hud${seconds<=10?' urgent':''}${event.overtime?' overtime':''}"><span>RUN ${event.runNumber}/3${event.overtime&&event.finalComboActive?'<small>FINAL COMBO</small>':''}</span><strong>${Math.floor(seconds/60)}:${String(seconds%60).padStart(2,'0')}</strong></div>`;
    } else if(event.phase==='countdown') {
      html=`<div class="comp-countdown"><span>RUN ${event.runNumber} / 3</span><strong>${Math.max(1,Math.ceil(event.countdown))}</strong><p>MAKE IT COUNT</p></div>`;
    } else if(event.phase==='intro') {
      html=`<section class="timber-card comp-card comp-intro">${header}<div class="comp-intro-body"><div class="comp-cup">${CUP_TROPHY_SVG}</div><div><h2>BEAT YOUR RIVAL. TAKE THE CUP.</h2><div class="comp-rules"><b>3 RUNS</b><b>60 SECONDS EACH</b><b>BEST 2 COUNT</b></div><p>Link grinds, airs and manuals. Every bail costs judge points; your board returns automatically. Finish your last combo when the clock hits zero.</p><p>Only <strong>1st overall</strong> wins the Jungle Cup.</p></div></div><div class="comp-actions">${button('START RUN 1','start')}${button('TRICK GUIDE','guide')}${button('ISLAND MAP','exit')}</div></section>`;
    } else if(event.phase==='judges') {
      const run=event.runs[event.runs.length-1]!, all=event.revealedJudges===3;
      if(this.revealRun!==event.runs.length){this.revealRun=event.runs.length;this.revealed=0;}
      while(this.revealed<event.revealedJudges){const i=this.revealed++;reveals.push({id:JUDGES[i].id,score:run.judges[i]});}
      html=`<section class="timber-card comp-card comp-judging">${header}<h2>RUN ${event.runs.length} · THE JUDGES</h2><div class="comp-judges">${JUDGES.map((j,i)=>{
        const shown=i<event.revealedJudges,score=run.judges[i];
        const line=this.hooks.dialogue?.(j.id,score)??(i===0 && run.inactivityPenalty>=6?'Long pauses cost you. Keep those lines flowing.':i===2?(score>=96?'Fine. That was… good.':'I expected cleaner.'):(score>=92?'That was a strong run.':'Keep those lines flowing.'));
        return `<article data-judge="${j.id}" data-reaction="${shown?(score>=96?'impressed':'critical'):'waiting'}" class="comp-judge${i===2?' hostile':''}${shown?' revealed':''}" style="--judge:${j.color}"><div class="comp-portrait">${portrait(j.portrait,this.hooks)}</div><h3>${j.name}</h3><small>${j.title}</small><strong>${shown?mark(score):'—'}</strong><p>${shown?esc(line):'Watching the replay…'}</p></article>`;
      }).join('')}</div><div class="comp-run-summary"><span>${run.gameplayScore.toLocaleString()} POINTS · ${run.bails} BAIL${run.bails===1?'':'S'}</span><strong>AVERAGE ${all?mark(run.score):'—'}</strong><span>${all?`CURRENT RANK ${ordinal(event.rank)}`:'JUDGING…'}</span></div><div class="comp-history">${event.runs.map((r,i)=>`<span>RUN ${i+1} <b>${i<event.runs.length-1||all?mark(r.score):'—'}</b></span>`).join('')}</div><div class="comp-actions">${button('VIEW STANDINGS','standings',!all)}</div></section>`;
    } else {
      const final=event.phase==='final',rows=event.standings,player=rows.find(r=>r.id==='player')!;
      html=`<section class="timber-card comp-card comp-standings${final?' comp-final':''}">${header}<h2>${final?(event.won?'YOU BEAT YOUR RIVAL!':`${ordinal(event.rank)} OVERALL · THE RIVAL WINS`):`AFTER RUN ${event.runs.length}`}</h2>${final?`<div class="comp-podium">${rows.slice(0,3).map(r=>`<div><b>${ordinal(r.rank)}</b><span class="comp-avatar">${portrait(r.portrait,this.hooks)}</span><strong>${esc(r.name)}</strong><small>${mark(r.total)}</small></div>`).join('')}</div>`:''}${this.leaderboard(rows)}<p class="comp-note">${final?`Your best two: <strong>${mark(player.total)}</strong> · Discarded run ${(player.discarded??0)+1} (${mark(player.runs[player.discarded??0])}).`:'Provisional total uses completed runs. After Run 3, everyone drops their lowest score.'}</p>${final&&event.won?`<div class="comp-award"><span>${CUP_TROPHY_SVG}</span><div><h3>JUNGLE CUP ${event.cupAwarded?'EARNED':'WON'}</h3><p>Your one-off trophy is shown in Progress.</p></div></div>`:''}<div class="comp-actions">${final?(event.won?button('ISLAND MAP','exit')+button('COMPETE AGAIN','retry'):button('RETRY CUP','retry')+button('ISLAND MAP','exit')):button(`START RUN ${event.runs.length+1}`,'start')+button('ISLAND MAP','exit')}</div></section>`;
    }
    const focused=!phaseChanged?this.buttons()[this.selected]?.dataset.action:undefined;
    this.element.innerHTML=html;this.selected=0;
    const card=this.element.querySelector<HTMLElement>('.comp-card');
    if(card){
      const content=document.createElement('div');content.className='comp-content';
      for(const child of [...card.children])if(!child.matches('.comp-eyebrow,h1,.comp-actions'))content.append(child);
      const actions=card.querySelector('.comp-actions');card.insertBefore(content,actions);
      if(this.guideOpen){
        const articles=[...content.querySelectorAll<HTMLElement>('.comp-guide-grid article')];
        articles.forEach((article,index)=>article.hidden=index!==this.guidePage);
        const pager=document.createElement('div');pager.className='comp-guide-pager';
        pager.innerHTML=`<button data-action="guide-prev" aria-label="Previous trick page">◀</button><span>${this.guidePage+1} / ${TRICK_GUIDE_PAGE_COUNT}</span><button data-action="guide-next" aria-label="Next trick page">▶</button>`;
        content.prepend(pager);
      }
      const hints=document.createElement('footer');hints.className='game-menu-hints comp-hints';
      hints.append(menuHint('SELECT',['confirm']));
      if(this.guideOpen){
        const back=actions?.querySelector<HTMLButtonElement>('[data-action="guide-back"]');
        if(back){menuHint('BACK',['back'],back);hints.append(back);}
        if(actions && !actions.children.length)actions.remove();
        const close=document.createElement('button');close.className='game-menu-button comp-guide-close';
        close.dataset.action='guide-back';close.dataset.touchClose='';close.textContent='×';close.setAttribute('aria-label','Back');
        this.element.append(close);
      }
      this.element.append(hints);
    }
    for(const control of this.element.querySelectorAll<HTMLButtonElement>('button'))control.classList.add('game-menu-button');
    if(this.guideOpen)for(const heading of this.element.querySelectorAll<HTMLElement>('[data-guide-prompt]'))setPromptText(heading,heading.dataset.guidePrompt!);
    for (const reveal of reveals) this.hooks.onReveal?.(reveal.id,reveal.score);
    if(!event.simulating&&event.phase!=='countdown') {
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
