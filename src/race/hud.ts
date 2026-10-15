import { createInputGlyph } from '../inputPromptUI';
import type * as THREE from 'three';
import type { Input } from '../input';
import { CompetitionSurface } from '../competition/surface';
import { competitionPortrait, escapeCompetitionText as esc } from '../competition/presentation';
import { menuHint, rewardSlot, MenuRewardsPresentation } from '../menuPresentation';
import { installRooMenuText } from '../roo-type/menu';
import { updateMenuPngFocus } from '../menuPngFocus';
import { MENU_THEME } from '../menuTheme';
import { RACE_ITEMS, type RaceHudState, type RaceMode } from './types';

const time = (seconds:number) => {const n=Math.round(seconds*100);return `${Math.floor(n/6000)}:${String(Math.floor(n/100)%60).padStart(2,'0')}.${String(n%100).padStart(2,'0')}`;};
const SVG='http://www.w3.org/2000/svg';

/** Race state bound to the existing competition layouts and renderer. */
export class RaceHud {
  state:RaceHudState|undefined;
  onStart:(mode:RaceMode)=>void=()=>{};
  onLeave:()=>void=()=>{};
  onItem:()=>void=()=>{};
  readonly element=document.createElement('div');
  private readonly surface:CompetitionSurface;
  private readonly rewards=new MenuRewardsPresentation();
  private selected=0;private axisHeld=false;private blocked=false;private key='';
  private line:RaceHudState['line']|null=null;
  private mapPath='';private mapBounds={x:0,z:0,w:1,h:1,top:0};
  constructor(){
    this.element.className='competition-host race-interface';this.element.hidden=true;
    this.element.setAttribute('aria-label','Skate race');document.body.append(this.element);
    this.surface=new CompetitionSurface(this.element);
    installRooMenuText(this.element,()=>this.surface.invalidate());
    this.element.addEventListener('click',event=>{
      const button=(event.target as Element).closest<HTMLButtonElement>('button[data-race-action]');
      if(!button||button.disabled||this.blocked)return;
      const action=button.dataset.raceAction;
      if(action==='item')this.onItem();else if(action==='exit')this.onLeave();else this.onStart(action==='trial'?'time-trial':'race');
    });
    this.element.addEventListener('focusin',event=>{
      const index=this.buttons().indexOf(event.target as HTMLButtonElement);if(index>=0){this.selected=index;this.select(false);}
    });
    this.element.addEventListener('pointermove',event=>{
      const button=(event.target as Element).closest<HTMLButtonElement>('button[data-race-action]');
      const index=button?this.buttons().indexOf(button):-1;if(index>=0&&index!==this.selected){this.selected=index;this.select(false);}
    });
  }
  setBlocked(blocked:boolean):void {this.blocked=blocked;this.element.hidden=!this.state?.visible||blocked;}
  setComposited(value:boolean):void {this.element.toggleAttribute('data-precrt-composited',value);if(!value)this.surface.deactivate();}
  get diagnostics(){return {selected:this.buttons()[this.selected]?.dataset.raceAction??null,...this.surface.diagnostics};}
  draw(renderer:THREE.WebGLRenderer,size:{width:number;height:number},target:THREE.WebGLRenderTarget|null):void {
    this.surface.draw(renderer,size,target);this.rewards.draw(renderer,size,target,this.element);
  }
  private buttons():HTMLButtonElement[]{return [...this.element.querySelectorAll<HTMLButtonElement>('.comp-actions button:not(:disabled)')];}
  private select(focus:boolean):void {
    const buttons=this.buttons();if(!buttons.length)return;this.selected=Math.min(this.selected,buttons.length-1);
    buttons.forEach((b,i)=>{b.classList.toggle('selected',i===this.selected);b.tabIndex=i===this.selected?0:-1;});
    if(focus)buttons[this.selected].focus({preventScroll:true});
    updateMenuPngFocus(this.element,performance.now(),true);this.surface.invalidate();
  }
  input(input:Input):void {
    const s=this.state,axis=Math.abs(input.moveX)>.5||Math.abs(input.moveY)>.5;
    if(!s||this.blocked||s.phase!=='grid'&&s.phase!=='finished'){this.axisHeld=axis;return;}
    const buttons=this.buttons();
    if(buttons.length&&axis&&!this.axisHeld){const d=input.moveX!==0?Math.sign(input.moveX):-Math.sign(input.moveY);this.selected=(this.selected+d+buttons.length)%buttons.length;this.select(true);}
    this.axisHeld=axis;
    if(input.jumpPressed||input.confirmPressed){buttons[this.selected]?.click();input.jumpPressed=input.confirmPressed=false;}
  }
  update(s:RaceHudState|undefined):void {
    const previous=this.state;this.state=s;this.element.hidden=!s?.visible||this.blocked;
    if(!s)return;
    if(this.line&&this.line!==s.line)this.key='';
    const key=[s.title,s.phase,s.mode,s.phase==='countdown'?Math.ceil(s.countdown):'',s.phase==='finished'?s.racers.map(r=>`${r.id}:${r.finish}`).join(','):''].join('|');
    if(key!==this.key){
      const focus=this.element.contains(document.activeElement);this.key=key;
      if(previous?.phase!==s.phase)this.selected=s.mode==='time-trial'?1:0;
      this.render(s);this.select(focus||previous?.phase!==s.phase);
    }
    if(s.phase==='running'){
      this.setText('[data-race-rank]',s.mode==='race'?`${s.rank} / 8`:'TIME TRIAL');
      this.setText('[data-race-clock]',time(s.elapsed));
      this.setText('[data-race-boxes]',`${s.boxes} / ${s.totalBoxes} BOXES`);
      this.setText('[data-race-status]',s.recovering>0?'BACK ON BOARD':s.shield>0?`SHIELD ${Math.ceil(s.shield)}`:'');
      const item=this.element.querySelector<HTMLButtonElement>('[data-race-action="item"]')!;
      const key=s.item??'empty';
      if(item.dataset.item!==key){
        item.dataset.item=key;item.disabled=!s.item;
        const hint=document.createElement('span');hint.className='game-control-hint';hint.append(createInputGlyph('inventory'));
        item.replaceChildren(rewardSlot(s.item??'medal',!!s.item),hint);
        item.setAttribute('aria-label',s.item?`Use ${RACE_ITEMS[s.item].name}`:'No item held');
        item.title=s.item?RACE_ITEMS[s.item].description:'';
      }
    }
    this.updateMap(s);this.surface.invalidate();
  }
  private setText(selector:string,value:string):void {const e=this.element.querySelector<HTMLElement>(selector);if(e&&e.textContent!==value)e.textContent=value;}
  private render(s:RaceHudState):void {
    this.element.classList.toggle('is-running',s.phase==='running');
    const action=(label:string,id:string)=>`<button class="game-menu-button" data-race-action="${id}">${label}</button>`;
    if(s.phase==='running'){
      this.element.innerHTML='<div class="comp-run-hud"><strong data-race-rank></strong><strong data-race-clock></strong><span><small data-race-boxes></small><small data-race-status></small></span></div>'+
        '<div class="comp-run-hud" style="left:auto;right:5vw;top:max(64px,12vh)"><button class="game-menu-button game-results-medal" data-race-action="item" style="pointer-events:auto;width:clamp(96px,14vw,152px);height:clamp(72px,12vh,112px);display:flex;align-items:center"></button></div>'+
        '<div class="comp-run-hud" style="left:auto;right:5vw;top:max(138px,30vh);width:clamp(90px,18vw,180px);height:46vh;display:block"><svg data-race-map viewBox="0 0 180 360" style="width:100%;height:100%" role="img" aria-label="All racers on the course"></svg></div>';
    }else if(s.phase==='countdown'){
      this.element.innerHTML=`<div class="comp-countdown"><span>${s.mode==='race'?'8 RACERS':'TIME TRIAL'}</span><strong>${Math.max(1,Math.ceil(s.countdown))}</strong><p>GET READY</p></div>`;
    }else if(s.phase==='grid'){
      this.element.innerHTML=`<section class="timber-card comp-card comp-intro"><div class="comp-eyebrow">SKATE RACE</div><h1>${esc(s.title)}</h1><div class="comp-content"><div class="comp-intro-body"><div class="comp-cup"><svg data-race-map viewBox="0 0 180 360" role="img" aria-label="Complete race course"></svg></div><div><h2>FIRST TO THE FINISH</h2><p>Use items, spins and stomps to take the lead.</p><div class="comp-rules"><b>8 RACERS</b><b>RACE ITEMS</b><b>1 FINISH</b></div><p>Win the crystal. Clear blank crates, TNT and Nitro for the gem. Item boxes don’t count.</p></div></div></div><div class="comp-actions">${action('RACE','race')}${action('TIME TRIAL','trial')}</div></section>`;
    }else{
      const trial=s.mode==='time-trial';
      const heading=trial?'TIME TRIAL':s.won?'FIRST PLACE!':`${s.rank} / 8 FINISH`;
      const rows=trial?(['gold','silver','bronze'] as const).map(t=>`<tr><th>${t.toUpperCase()}</th><td>${time(s.medalTimes[t])}</td></tr>`).join(''):
        s.racers.map((r,i)=>`<tr class="${r.id===0?'player-row':''}"><td>${i+1}</td><th><span class="comp-avatar">${competitionPortrait(r.id===0?'bone':r.name.toLowerCase(),{})}</span><span>${esc(r.name)}</span></th><td>${r.finish===null?`${Math.floor(r.progress*100)}%`:time(r.finish)}</td></tr>`).join('');
      this.element.innerHTML=`<section class="timber-card comp-card comp-standings comp-final"><div class="comp-eyebrow">${esc(s.title)}</div><h1>${heading}</h1><div class="comp-content">${trial?`<h2>${time(s.elapsed)}</h2>`:''}<div class="comp-podium" data-race-awards></div><div class="comp-table-wrap"><table><thead><tr>${trial?'<th>MEDAL</th><th>TARGET</th>':'<th>#</th><th>RACER</th><th>TIME</th>'}</tr></thead><tbody>${rows}</tbody></table></div>${trial?'<p class="comp-note">TIME TRIAL COMPLETE</p>':''}</div><div class="comp-actions">${action('RACE AGAIN','race')}${action('TIME TRIAL','trial')}${action('CONTINUE','exit')}</div></section>`;
      const awards=this.element.querySelector('[data-race-awards]')!;
      const slots=trial?[['MEDAL',rewardSlot('medal',!!s.medal,s.medal)] as const]:
        [['CRYSTAL',rewardSlot('crystal',s.won)] as const,['BOX GEM',rewardSlot('gem',s.totalBoxes>0&&s.boxes===s.totalBoxes)] as const];
      for(const [label,slot] of slots){const row=document.createElement('div');row.className='comp-cup game-results-medal';const caption=document.createElement('strong');caption.textContent=label;if(label==='BOX GEM'){const count=document.createElement('small');count.textContent=`${s.boxes} / ${s.totalBoxes}`;caption.append(document.createElement('br'),count);}row.append(slot,caption);awards.append(row);}
    }
    if(s.phase!=='countdown'){
      const footer=document.createElement('footer');footer.className='game-menu-hints comp-hints';
      if(s.phase==='running')footer.append(menuHint('JUMP',['jump']),menuHint('BRAKE',['grab']),menuHint('SPIN',['spin']));
      else footer.append(menuHint('SELECT',['confirm']));
      footer.append(menuHint('MENU',['pause']));this.element.append(footer);
    }
    this.surface.invalidate();
  }
  /** Only the course plot is new; existing SVG support paints it on both paths. */
  private updateMap(s:RaceHudState):void {
    const svg=this.element.querySelector<SVGSVGElement>('[data-race-map]');if(!svg)return;
    if(this.line!==s.line){
      this.line=s.line;const xs=s.line.map(p=>p[0]),zs=s.line.map(p=>-p[2]+(s.line[0][1]-p[1])*.2);
      this.mapBounds={x:Math.min(...xs),z:Math.min(...zs),w:Math.max(...xs)-Math.min(...xs)||1,h:Math.max(...zs)-Math.min(...zs)||1,top:s.line[0][1]};
      this.mapPath=s.line.map((p,i)=>{const q=this.mapPoint(p[0],p[1],p[2]);return `${i?'L':'M'}${q[0].toFixed(2)},${q[1].toFixed(2)}`;}).join(' ');
    }
    if(!svg.children.length){const path=document.createElementNS(SVG,'path');path.setAttribute('d',this.mapPath);path.setAttribute('fill','none');path.setAttribute('stroke',MENU_THEME.rivet);path.setAttribute('stroke-width','3');svg.append(path);}
    for(const r of s.racers){
      let marker=svg.querySelector<SVGEllipseElement>(`[data-racer="${r.id}"]`);
      if(!marker){marker=document.createElementNS(SVG,'ellipse');marker.dataset.racer=String(r.id);marker.setAttribute('rx',r.id===0?'7':'5');marker.setAttribute('ry',r.id===0?'7':'5');marker.setAttribute('fill',r.color);marker.setAttribute('stroke',MENU_THEME.bottom);marker.setAttribute('stroke-width','2');svg.append(marker);}
      const p=this.mapPoint(r.x,r.y,r.z);marker.setAttribute('cx',p[0].toFixed(2));marker.setAttribute('cy',p[1].toFixed(2));
    }
  }
  private mapPoint(x:number,y:number,z:number):[number,number]{const b=this.mapBounds;return [10+(x-b.x)/b.w*160,10+(-z+(b.top-y)*.2-b.z)/b.h*340];}
}
