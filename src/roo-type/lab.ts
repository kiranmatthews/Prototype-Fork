import './lab.css';
import { RooAtlasPainter, loadRooAtlases, layoutRooAtlas } from './atlas';
import { ROO_ATLAS_METRICS } from './atlas-metrics';
import { getRooAppearance, setRooAppearance, ROO_APPEARANCE_DEFAULTS, ROO_APPEARANCE_EVENT, rooLightPosition, rooMotionEnabled, rooLightStatus, subscribeRooLight } from './settings';
import type { RooTreatment } from './geometry';

async function main(){
 const root=document.querySelector<HTMLDivElement>('#app')!;
 root.innerHTML=`<header><strong>ROO / FONT STUDIO</strong><span>Bevel light, close-up inspection and spacing</span><a href="./">Back to game</a></header>
 <main><div class="stage"><canvas aria-label="Roo font preview"></canvas><div class="stamp">Codex/sol fork · Same font in menus and HUD</div></div>
 <aside><h1>Roo appearance</h1><p>Spacing and shimmer save automatically and update the game, including other open tabs.</p>
 <label>View<select id="view"><option value="words">Words and alphabet</option><option value="glyph">Inspect one glyph</option><option value="angles">Compare light angles</option><option value="all">All glyphs, close up</option></select></label>
 <label>Text<input id="text" type="text" value="BONEMAN" maxlength="30"></label>
 <label id="glyph-field" hidden>Glyph<select id="glyph"></select></label>
 <div id="pager" hidden><button id="prev">Previous</button><span id="page-v"></span><button id="next">Next</button></div>
 <label>Color treatment<select id="palette"><option value="bonus">Green / cobalt</option><option value="counter" selected>Gold / vermilion</option></select></label>
 <label>Preview size <span id="size-v"></span><input id="size" type="range" min="32" max="640" value="165"></label>
 <label>Letter spacing <span id="tracking-v"></span><input id="tracking" type="range" min="-.16" max=".16" step=".001"><input aria-label="Exact letter spacing in cap units" id="tracking-number" type="number" min="-.16" max=".16" step=".001"></label>
 <button id="reset-spacing">Reset spacing</button>
 <label class="check"><input id="shimmer" type="checkbox">Animate edge highlights</label>
 <output id="light-status"></output>
 <label>Highlight movement <span id="strength-v"></span><input id="strength" type="range" min="0" max="1" step=".01"></label>
 <label>Preview light position <span id="light-v"></span><input id="light" type="range" min="-1" max="1" value="0" step=".01"></label>
 <label class="check"><input id="backdrop" type="checkbox">Light background</label>
 <label class="check"><input id="counts" type="checkbox">Run the counter</label>
 <button id="png" class="primary">Export transparent text PNG</button><button id="atlas">Download font + 3 light frames</button>
 <div id="report" aria-live="polite">Loading glyphs…</div></aside></main>`;
 const input=(id:string)=>document.getElementById(id) as HTMLInputElement;
 const query=new URLSearchParams(location.search),palette=query.get('palette');
 if(palette==='bonus'||palette==='counter')input('palette').value=palette;
 if(query.has('text'))input('text').value=query.get('text')!.slice(0,30);
 const stage=document.querySelector<HTMLDivElement>('.stage')!,canvas=stage.querySelector('canvas')!,ctx=canvas.getContext('2d')!;
 const painter=new RooAtlasPainter();await loadRooAtlases();if(!painter.ready)throw new Error('Font atlas failed to load');
 const characters=Object.keys(ROO_ATLAS_METRICS.bonus.glyphs).filter(c=>ROO_ATLAS_METRICS.bonus.glyphs[c].width);
 const glyphSelect=document.getElementById('glyph') as HTMLSelectElement;
 for(const char of characters)glyphSelect.add(new Option(char,char));glyphSelect.value='A';
 let width=0,height=0,page=0,wasAutomatic=false;
 function sync(){
   const settings=getRooAppearance();input('tracking').value=input('tracking-number').value=String(settings.tracking);
   input('shimmer').checked=settings.shimmer;input('strength').value=String(settings.lightStrength);input('light').disabled=rooMotionEnabled();
   input('tracking-v').textContent=`${(settings.tracking*100).toFixed(1)}%`;
   input('strength-v').textContent=`${Math.round(settings.lightStrength*100)}%`;
 }
 const light=()=>rooMotionEnabled()?rooLightPosition():+input('light').value;
 function paint(){
   const automatic=rooMotionEnabled(),status=rooLightStatus();
   if(wasAutomatic&&!automatic&&getRooAppearance().shimmer)input('light').value='0';
   const position=light();wasAutomatic=automatic;
   input('light').disabled=automatic;if(automatic)input('light').value=String(position);
   canvas.dataset.lightPosition=String(position);canvas.dataset.lightingReady=String(painter.lightingReady);
   const ratio=Math.min(3,Math.max(2,devicePixelRatio));width=stage.clientWidth;height=Math.max(640,stage.clientHeight);
   if(canvas.width!==Math.round(width*ratio)||canvas.height!==Math.round(height*ratio)){canvas.width=Math.round(width*ratio);canvas.height=Math.round(height*ratio);}
   ctx.setTransform(ratio,0,0,ratio,0,0);ctx.clearRect(0,0,width,height);
   const palette=input('palette').value as RooTreatment,size=+input('size').value,mode=input('view').value;
   const draw=(text:string,x:number,y:number,cap:number,maxWidth=width-50,lightPosition=position)=>painter.draw(ctx,text,x,y,{size:cap,palette,align:'center',maxWidth,lightPosition});
   const caption=(text:string,x:number,y:number)=>{ctx.fillStyle=input('backdrop').checked?'#4d5148':'#91a5b9';ctx.font='11px system-ui';ctx.textAlign='center';ctx.fillText(text,x,y);};
   if(mode==='angles'){
     const cell=width/3;for(const [i,p]of [-1,0,1].entries()){
       draw(glyphSelect.value,(i+.5)*cell,height/2,Math.min(size,height-150),cell-36,p);
       caption(['LEFT LIGHT','FRONT LIGHT','RIGHT LIGHT'][i],(i+.5)*cell,65);
     }
   }else if(mode==='glyph'){
     draw(glyphSelect.value,width/2,height/2,Math.min(size,height-110));caption(`${glyphSelect.value} · COMPLETE PAINTED BEVEL`,width/2,45);
   }else if(mode==='all'){
     const cols=width<650?2:3,perPage=cols*2,pages=Math.ceil(characters.length/perPage);page=Math.max(0,Math.min(page,pages-1));
     const cellW=width/cols,cellH=(height-80)/2;
     for(const [i,char]of characters.slice(page*perPage,(page+1)*perPage).entries()){
       const x=(i%cols+.5)*cellW,y=65+(Math.floor(i/cols)+.5)*cellH;
       draw(char,x,y,Math.min(size,cellH*.86),cellW-40);caption(char,x,y-cellH*.44);
     }
     input('page-v').textContent=`${page+1} / ${pages}`;
   }else{
     draw(input('text').value.toUpperCase()||'BONUS',width/2,height*.24,size);
     const count=input('counts').checked?String(Math.floor(performance.now()/700)%100):'0',numSize=Math.min(107,(width-60)/9.7);
     painter.draw(ctx,`${count}/23   99   100`,width/2,height*.49,{size:numSize,palette:'counter',align:'center',maxWidth:width-50,lightPosition:light()});
     const letterSize=Math.min(59,(width-60)/12.2);
     for(const [i,row]of ['ABCDEFGHIJKLM','NOPQRSTUVWXYZ'].entries())draw(row,width/2,height*(.72+i*.12),letterSize);
     caption('THREE BAKED HIGHLIGHT POSITIONS',width/2,height*.24-Math.min(size,height*.24)*.7-18);
     caption('COUNTERS · FIXED SIZE THROUGH VALUE CHANGES',width/2,height*.49-numSize*.7-18);
     caption('ALPHABET',width/2,height*.72-letterSize*.7-18);
   }
   input('size-v').textContent=`${size} px`;
   input('light-v').textContent=Math.abs(position)<.05?'Front':`${position<0?'Left':'Right'} ${Math.round(Math.abs(position)*100)}%`;
   input('light-status').textContent=mode==='angles'?'Three fixed light angles':!painter.lightingReady?'Loading light frames…':({playing:'Lighting is moving',paused:'Paused · drag the light to inspect', 'reduced-motion':'Reduced Motion is on · drag the light to inspect','zero-strength':'Movement is 0% · increase it or drag the light'})[status];
   input('light-status').dataset.playing=String(status==='playing'&&mode!=='angles');
 }
 sync();window.addEventListener(ROO_APPEARANCE_EVENT,()=>{sync();paint();});
 new ResizeObserver(paint).observe(stage);
 for(const id of ['text','palette','size','glyph','light'])input(id).addEventListener('input',paint);
 input('view').onchange=()=>{
   const mode=input('view').value;input('glyph-field').hidden=mode!=='glyph'&&mode!=='angles';input('pager').hidden=mode!=='all';
   input('size').value=mode==='words'?'165':mode==='glyph'?'512':'384';page=0;paint();
 };
 input('tracking').oninput=()=>setRooAppearance({tracking:+input('tracking').value});
 input('tracking-number').onchange=()=>{if(Number.isFinite(input('tracking-number').valueAsNumber))setRooAppearance({tracking:input('tracking-number').valueAsNumber});};
 input('reset-spacing').onclick=()=>setRooAppearance({tracking:ROO_APPEARANCE_DEFAULTS.tracking});
 input('shimmer').onchange=()=>setRooAppearance({shimmer:input('shimmer').checked});
 input('strength').oninput=()=>setRooAppearance({lightStrength:+input('strength').value});
 input('prev').onclick=()=>{page--;paint();};input('next').onclick=()=>{page++;paint();};
 input('backdrop').onchange=()=>{stage.classList.toggle('light',input('backdrop').checked);paint();};
 input('counts').onchange=paint;subscribeRooLight(paint);setInterval(()=>{if(input('counts').checked&&!getRooAppearance().shimmer)paint();},250);
 function download(name:string,blob:Blob|string){const a=document.createElement('a');a.download=name;a.href=typeof blob==='string'?blob:URL.createObjectURL(blob);a.click();if(typeof blob!=='string')setTimeout(()=>URL.revokeObjectURL(a.href),1000);}
 input('png').onclick=()=>{
   const palette=input('palette').value as RooTreatment,text=['glyph','angles'].includes(input('view').value)?glyphSelect.value:input('text').value.toUpperCase()||'BONUS',size=+input('size').value*2;
   const layout=layoutRooAtlas(ROO_ATLAS_METRICS[palette],text,getRooAppearance().tracking);if(!layout)return;
   const out=document.createElement('canvas');out.width=Math.ceil(layout.width*size+24);out.height=Math.ceil(size*1.285+24);
   painter.draw(out.getContext('2d')!,text,out.width/2,out.height/2,{size,palette,align:'center',lightPosition:light()});download('roo-text.png',out.toDataURL('image/png'));
 };
 input('atlas').onclick=async()=>{const version=ROO_ATLAS_METRICS.bonus.version,response=await fetch(`${import.meta.env.BASE_URL}fonts/roo-image-font-v${version}.zip`);if(!response.ok)throw new Error('Font download failed');download(`roo-image-font-v${version}.zip`,await response.blob());};
 input('report').textContent=`51 glyphs · 2 colorways · 3 light frames\nComplete artwork · smooth alpha\n${ROO_ATLAS_METRICS.bonus.capPixels} px source cap band\nSettings save for this browser`;
 paint();Object.assign(window,{rooTypeLab:{ready:true,paint,painter,metrics:()=>({glyphs:51,palettes:2,version:ROO_ATLAS_METRICS.bonus.version,lightFrames:3,width,height}),appearance:getRooAppearance}});
}
void main().catch(error=>{const report=document.getElementById('report');if(report)report.textContent=String(error);console.error(error);});
