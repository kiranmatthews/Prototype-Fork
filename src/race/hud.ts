import { createInputGlyph, setPromptText } from '../inputPromptUI';
import type * as THREE from 'three';
import type { Input } from '../input';
import { CompetitionSurface } from '../competition/surface';
import { competitionPortrait, escapeCompetitionText as esc } from '../competition/presentation';
import { rewardSlot, MenuRewardsPresentation } from '../menuPresentation';
import { installRooMenuText } from '../roo-type/menu';
import { updateMenuPngFocus } from '../menuPngFocus';
import type { ResultsViewport } from '../resultsPresentation';
import { MENU_THEME } from '../menuTheme';
import { RACE_ITEMS, RALLY_ITEM_NAMES, RALLY_ITEM_DESCRIPTIONS, type RaceHudState, type RaceMode } from './types';

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
  sceneViewport(width:number,height:number):ResultsViewport {
    const panel=this.element.querySelector('.race-results-card')?.getBoundingClientRect();
    if(!panel||this.element.hidden)return {x:0,y:0,width,height};
    return width>height?{x:width*.025,y:height*.06,width:Math.max(1,panel.left-width*.05),height:height*.88}:
      {x:width*.04,y:height*.035,width:width*.92,height:Math.max(1,panel.top-height*.06)};
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
    const key=[s.title,s.phase,s.mode,s.timeTrialUnlocked,s.phase==='countdown'?Math.ceil(s.countdown):'',s.phase==='finished'?s.racers.map(r=>`${r.id}:${r.finish}`).join(','):''].join('|');
    if(key!==this.key){
      const focus=this.element.contains(document.activeElement);this.key=key;
      if(previous?.phase!==s.phase)this.selected=s.mode==='time-trial'?1:0;
      this.render(s);this.select(focus||previous?.phase!==s.phase);
    }
    if(s.phase==='running'){
      const go=this.element.querySelector<HTMLElement>('[data-race-go]');if(go){go.hidden=s.runTime>=.8;go.style.display=s.runTime<.8?'block':'none';}
      this.setText('[data-race-rank]',s.mode==='race'?`${s.rank} / 8`:'TIME TRIAL');
      this.setText('[data-race-clock]',time(s.elapsed));
      this.setText('[data-race-boxes]',`${s.boxes} / ${s.totalBoxes} BOXES`);
      this.setText('[data-race-status]',s.freeze>0?`FROZEN ${Math.ceil(s.freeze)}s`:s.recovering>0?(s.cart?.onFoot?'BACK ON YOUR FEET':s.vehicle?'BACK IN THE CART':'BACK ON BOARD'):s.star>0?`STAR ${Math.ceil(s.star)}`:s.shield>0?`SHIELD ${Math.ceil(s.shield)}`:'');
      if(s.cart){
        const c=s.cart;
        const bearing=c.bearing===null?0:Math.atan2(Math.sin(c.bearing),Math.cos(c.bearing));
        const direction=Math.abs(bearing)<.65?'AHEAD':Math.abs(bearing)>2.5?'BEHIND':bearing>0?'LEFT':'RIGHT';
        const action=this.element.querySelector<HTMLElement>('[data-cart-action]');
        const label=`{grind} ${c.target}${c.onFoot&&c.distance!==null&&c.distance>5?` · ${c.distance}m ${direction}`:''}${!c.actionReady?' · WAIT':''}`;
        if(action&&action.dataset.label!==label){action.dataset.label=label;setPromptText(action,label);}
        this.setText('[data-cart-notice]',c.notice);
      }
      const item=this.element.querySelector<HTMLButtonElement>('[data-race-action="item"]')!;
      const key=s.item??'empty';
      if(item.dataset.item!==key){
        item.dataset.item=key;item.disabled=!s.item;item.hidden=!s.item;item.style.display=s.item?'flex':'none';
        item.replaceChildren();
        if(s.item){
          const hint=document.createElement('span');hint.className='game-control-hint';hint.append(createInputGlyph('inventory'));
          item.append(rewardSlot(s.item,true),hint);
        }
        item.setAttribute('aria-label',s.item?`Use ${s.cart?RALLY_ITEM_NAMES[s.item]??RACE_ITEMS[s.item].name:RACE_ITEMS[s.item].name}`:'No item held');
        item.title=s.item?(s.cart?RALLY_ITEM_DESCRIPTIONS[s.item]??RACE_ITEMS[s.item].description:RACE_ITEMS[s.item].description):'';
      }
    }
    if(s.phase==='finished'){
      for(const racer of s.racers)this.setText(`[data-race-result="${racer.id}"]`,racer.finish===null?`${Math.floor(racer.progress*100)}%`:time(racer.finish));
      const remaining=s.racers.filter(r=>r.finish===null).length;
      this.setText('[data-race-arrivals]',s.mode==='time-trial'?'TIME TRIAL COMPLETE':remaining?`${s.racers.length-remaining} / ${s.racers.length} FINISHED`:'ALL RACERS FINISHED');
    }
    this.updateThreats(s);this.updateMap(s);this.surface.invalidate();
  }
  private updateThreats(s:RaceHudState):void {
    const row=this.element.querySelector<HTMLElement>('[data-race-threats]');if(!row)return;
    const threats=s.threats??[],key=threats.map(t=>`${t.item}:${!!t.attached}`).join('|');row.hidden=!threats.length;
    if(row.dataset.threats!==key){
      row.dataset.threats=key;row.replaceChildren();
      for(const threat of threats){
        const alert=document.createElement('div');alert.className='game-results-medal';alert.dataset.threat=threat.item;
        alert.style.cssText='display:flex;flex-direction:column;align-items:center;width:90px;position:relative';
        const label=document.createElement('small');label.textContent=threat.attached?'BUMP TO PASS':threat.item==='shock-shell'?'LIGHTNING':'INCOMING';
        const picture=rewardSlot(threat.item,true);picture.style.cssText='width:64px;height:64px;flex:0 0 64px';
        const clock=document.createElement('small');clock.dataset.threatTime='';
        const ring=document.createElementNS(SVG,'svg');ring.setAttribute('viewBox','0 0 80 80');ring.style.cssText='position:absolute;left:5px;top:20px;width:80px;height:80px';
        ring.setAttribute('aria-hidden','true');ring.innerHTML='<path data-threat-arc fill="none" stroke-width="4"/><path data-threat-arrow/>';
        alert.append(label,picture,clock,ring);row.append(alert);
      }
    }
    threats.forEach((threat,i)=>{
      const alert=row.children[i] as HTMLElement,color=RACE_ITEMS[threat.item].color;
      alert.setAttribute('aria-label',`${RACE_ITEMS[threat.item].name} incoming${threat.urgent?', imminent':''}`);
      alert.querySelector('[data-threat-time]')!.textContent=`${Math.max(.1,threat.seconds).toFixed(1)}s`;
      const amount=Math.min(.999,Math.max(.025,threat.seconds/4)),angle=amount*Math.PI*2;
      const arc=alert.querySelector('[data-threat-arc]')!;arc.setAttribute('stroke',color);
      arc.setAttribute('d',`M40 5 A35 35 0 ${amount>.5?1:0} 1 ${40+Math.sin(angle)*35} ${40-Math.cos(angle)*35}`);
      const arrow=alert.querySelector('[data-threat-arrow]')!;
      if(threat.item==='shock-shell'){arrow.setAttribute('d','M43 27 L32 42 L40 42 L36 54 L50 37 L42 37 Z');}
      else{
        const x=Math.sin(threat.bearing),y=-Math.cos(threat.bearing),cx=40+x*31,cy=40+y*31;
        arrow.setAttribute('d',`M${cx+x*7} ${cy+y*7} L${cx-x*4-y*5} ${cy-y*4+x*5} L${cx-x*4+y*5} ${cy-y*4-x*5} Z`);
      }
      arrow.setAttribute('fill',color);
    });
  }
  private setText(selector:string,value:string):void {const e=this.element.querySelector<HTMLElement>(selector);if(e&&e.textContent!==value)e.textContent=value;}
  private render(s:RaceHudState):void {
    this.element.classList.toggle('race-finished',s.phase==='finished');
    this.element.classList.toggle('is-running',s.phase==='running'||s.phase==='countdown');
    const action=(label:string,id:string)=>`<button class="game-menu-button" data-race-action="${id}">${label}</button>`;
    const trialAction=s.timeTrialUnlocked?action('TIME TRIAL','trial'):'';
    if(s.phase==='running'){
      this.element.innerHTML='<div class="comp-countdown" data-race-go style="position:absolute;left:50%;top:12vh;transform:translateX(-50%)"><strong>GO!</strong></div><div class="comp-run-hud"><strong data-race-rank></strong><strong data-race-clock></strong><span>'+(s.gemReward==='win'?'':'<small data-race-boxes></small>')+'<small data-race-status></small></span></div>'+
        '<div class="comp-run-hud" style="left:auto;right:5vw;top:max(64px,12vh)"><button class="game-menu-button game-results-medal" data-race-action="item" style="pointer-events:auto;width:clamp(96px,14vw,152px);height:clamp(72px,12vh,112px);display:flex;align-items:center"></button></div>'+
        '<div class="comp-run-hud" data-race-threats style="top:max(86px,19vh);left:5vw;display:flex;gap:12px" role="status" aria-label="Incoming weapons"></div>'+
        '<div class="comp-run-hud" style="left:auto;right:5vw;top:max(138px,30vh);width:clamp(90px,18vw,180px);height:46vh;display:block"><svg data-race-map viewBox="0 0 180 360" style="width:100%;height:100%" role="img" aria-label="All racers on the course"></svg></div>';
      if(s.vehicle)this.element.insertAdjacentHTML('beforeend','<div class="comp-run-hud" data-cart-hud style="top:auto;bottom:12vh;left:5vw;max-width:66vw;display:flex;flex-direction:column;align-items:flex-start;text-align:left;gap:5px;font-size:clamp(12px,2vw,20px)"><small data-cart-action></small><small data-cart-notice role="status"></small></div>');
    }else if(s.phase==='countdown'){
      this.element.innerHTML=`<div class="comp-countdown" style="position:absolute;left:50%;top:12vh;transform:translateX(-50%)"><strong>${Math.max(1,Math.ceil(s.countdown))}</strong></div>`;
    }else if(s.phase==='grid'){
      this.element.innerHTML=`<section class="timber-card comp-card comp-intro"><div class="comp-eyebrow">${s.vehicle?'GOLF CART RACE':'SKATE RACE'}</div><h1>${esc(s.title)}</h1><div class="comp-content"><div class="comp-intro-body"><div class="comp-cup"><svg data-race-map viewBox="0 0 180 360" role="img" aria-label="Complete race course"></svg></div><div><h2>FIRST TO THE FINISH</h2><div class="comp-rules"><b>8 RACERS</b><b>RACE ITEMS</b><b>1 FINISH</b></div><p>${s.gemReward==='win'?'Win the race to earn the gem. Finish to unlock time trials.':s.crystalReward===false?'Race to unlock time trials. Clear the blank crates for the gem.':'Win the crystal. Clear blank crates for the gem. Item pickups don’t count.'}</p>${s.vehicle?'<p data-cart-controls></p>':''}</div></div></div><div class="comp-actions">${action('RACE','race')}${trialAction}</div></section>`;
    }else{
      const trial=s.mode==='time-trial';
      const heading=trial?'TIME TRIAL':s.won?'FIRST PLACE!':`${s.rank} / 8 FINISH`;
      const rows=trial?(['gold','silver','bronze'] as const).map(t=>`<tr><th>${t.toUpperCase()}</th><td>${time(s.medalTimes[t])}</td></tr>`).join(''):
        s.racers.map((r,i)=>`<tr class="${r.id===0?'player-row':''}"><td>${i+1}</td><th><span class="comp-avatar">${competitionPortrait(r.id===0?'bone':r.name.toLowerCase(),{})}</span><span>${esc(r.name)}</span></th><td data-race-result="${r.id}">${r.finish===null?`${Math.floor(r.progress*100)}%`:time(r.finish)}</td></tr>`).join('');
      this.element.innerHTML=`<section class="timber-card comp-card comp-standings comp-final race-results-card"><div class="comp-eyebrow">${esc(s.title)}</div><h1>${heading}</h1><div class="comp-content">${trial?`<h2>${time(s.elapsed)}</h2>`:''}<div class="comp-podium" data-race-awards></div><div class="comp-table-wrap"><table><thead><tr>${trial?'<th>MEDAL</th><th>TARGET</th>':'<th>#</th><th>RACER</th><th>TIME</th>'}</tr></thead><tbody>${rows}</tbody></table></div><p class="comp-note" data-race-arrivals role="status"></p></div><div class="comp-actions">${action('RACE AGAIN','race')}${trialAction}${action('CONTINUE','exit')}</div></section>`;
      const awards=this.element.querySelector('[data-race-awards]')!;
      const slots=trial?[['MEDAL',rewardSlot('medal',!!s.medal,s.medal)] as const]:
        [...(s.crystalReward===false?[]:[['CRYSTAL',rewardSlot('crystal',s.won)] as const]),[s.gemReward==='win'?'GEM':'BOX GEM',rewardSlot('gem',s.gemReward==='win'?s.won:s.totalBoxes>0&&s.boxes===s.totalBoxes)] as const];
      for(const [label,slot] of slots){const row=document.createElement('div');row.className='comp-cup game-results-medal';const caption=document.createElement('strong');caption.textContent=label;if(label==='BOX GEM'){const count=document.createElement('small');count.textContent=`${s.boxes} / ${s.totalBoxes}`;caption.append(document.createElement('br'),count);}row.append(slot,caption);awards.append(row);}
    }
    const controls=this.element.querySelector<HTMLElement>('[data-cart-controls]');
    if(controls){setPromptText(controls,'Hold {jump} Accelerate · {up}{down}{left}{right} Steer · {grab} Brake · {transfer} Drift · {spin} Flame thrusters · {grind} Steal / bail · {inventory} Weapon');const note=document.createElement('p');note.textContent='Dents stick. Engines burn. Keep running and steal a ride. Green loaners wait before the big jumps.';controls.after(note);}
    this.element.setAttribute('aria-label',s.vehicle?'Golf cart race':'Skate race');
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
