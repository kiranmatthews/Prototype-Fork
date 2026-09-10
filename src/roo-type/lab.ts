import './lab.css';
import { RooAtlasPainter, loadRooAtlases, layoutRooAtlas } from './atlas';
import { ROO_ATLAS_METRICS } from './atlas-metrics';
import type { RooTreatment } from './geometry';

async function main(){
 const root=document.querySelector<HTMLDivElement>('#app')!;
 root.innerHTML=`<header><strong>ROO / REFERENCE FONT</strong><span>Model-processed glyphs · baked lighting</span><a href="./">Back to game</a></header>
 <main><div class="stage"><canvas aria-label="Roo font preview"></canvas><div class="stamp">Codex/sol fork · RooRegular.ttf · 51 image-model glyph passes</div></div>
 <aside><h1>Roo image font</h1><p>The bevel and light are baked into each glyph. Change the text, size and spacing, or export the complete font.</p>
 <label>Text<input id="text" type="text" value="BONUS" maxlength="30"></label>
 <label>Color treatment<select id="palette"><option value="bonus">Green / cobalt</option><option value="counter">Gold / vermilion</option></select></label>
 <label>Text size <span id="size-v"></span><input id="size" type="range" min="45" max="210" value="165"></label>
 <label>Extra letter spacing <span id="tracking-v"></span><input id="tracking" type="range" min="-0.03" max="0.16" step="0.001" value="0"></label>
 <label class="check"><input id="backdrop" type="checkbox">Light background</label>
 <label class="check"><input id="counts" type="checkbox">Run the counter</label>
 <button id="png" class="primary">Export transparent text PNG</button><button id="atlas">Download image font + metrics</button>
 <div id="report" aria-live="polite">Loading glyphs…</div></aside></main>`;
 const input=(id:string)=>document.getElementById(id) as HTMLInputElement;
 const stage=document.querySelector<HTMLDivElement>('.stage')!,canvas=stage.querySelector('canvas')!,ctx=canvas.getContext('2d')!;
 const painter=new RooAtlasPainter();await loadRooAtlases();if(!painter.ready)throw new Error('Font atlas failed to load');
 let width=0,height=0,frame=0;
 function paint(){
   const ratio=Math.min(3,Math.max(2,devicePixelRatio));width=stage.clientWidth;height=Math.max(640,stage.clientHeight);
   if(canvas.width!==Math.round(width*ratio)||canvas.height!==Math.round(height*ratio)){canvas.width=Math.round(width*ratio);canvas.height=Math.round(height*ratio);}
   ctx.setTransform(ratio,0,0,ratio,0,0);ctx.clearRect(0,0,width,height);
   const palette=input('palette').value as RooTreatment,size=+input('size').value,tracking=+input('tracking').value;
   const text=input('text').value.toUpperCase()||'BONUS';
   painter.draw(ctx,text,width/2,height*.24,{size,tracking:tracking*size,palette,align:'center',maxWidth:width-50});
   const count=input('counts').checked?String(Math.floor(frame/30)%100):'0';
   const numSize=Math.min(107,(width-60)/9.7);
   painter.draw(ctx,`${count}/23   99   100`,width/2,height*.49,{size:numSize,tracking:numSize*.1,palette:'counter',align:'center',maxWidth:width-50});
   const letterSize=Math.min(59,(width-60)/13.4);
   for(const [i,row]of ['ABCDEFGHIJKLM','NOPQRSTUVWXYZ'].entries())painter.draw(ctx,row,width/2,height*(.72+i*.12),{size:letterSize,tracking:letterSize*.25,palette,align:'center',maxWidth:width-50});
   ctx.fillStyle=input('backdrop').checked?'#4d5148':'#91a5b9';ctx.font='11px system-ui';ctx.textAlign='center';
   ctx.fillText('MODEL-BAKED ROO',width/2,height*.24-size*.7-18);
   ctx.fillText('COUNTERS · FIXED SIZE THROUGH VALUE CHANGES',width/2,height*.49-numSize*.7-18);
   ctx.fillText('ALPHABET',width/2,height*.72-letterSize*.7-18);
   document.getElementById('size-v')!.textContent=`${size} px`;
   document.getElementById('tracking-v')!.textContent=`${(tracking*size).toFixed(1)} px`;
   document.getElementById('report')!.textContent=`51 modeled glyphs · 2 colorways\nOriginal Roo contours and metrics\n384 px source cap band\nBONUS uses measured optical spacing\nRGBA · smooth edges · no heavy stroke`;
 }
 new ResizeObserver(paint).observe(stage);
 for(const id of ['text','palette','size','tracking'])input(id).addEventListener('input',paint);
 input('backdrop').onchange=()=>{stage.classList.toggle('light',input('backdrop').checked);paint();};
 input('counts').onchange=paint;
 function tick(){frame++;if(input('counts').checked)paint();requestAnimationFrame(tick);}requestAnimationFrame(tick);paint();
 function download(name:string,blob:Blob|string){const a=document.createElement('a');a.download=name;a.href=typeof blob==='string'?blob:URL.createObjectURL(blob);a.click();if(typeof blob!=='string')setTimeout(()=>URL.revokeObjectURL(a.href),1000);}
 document.getElementById('png')!.onclick=()=>{
   const palette=input('palette').value as RooTreatment,text=input('text').value.toUpperCase()||'BONUS',size=+input('size').value*2,tracking=+input('tracking').value;
   const layout=layoutRooAtlas(ROO_ATLAS_METRICS[palette],text,tracking);if(!layout)return;
   const out=document.createElement('canvas');out.width=Math.ceil(layout.width*size+24);out.height=Math.ceil(size*1.285+24);
   painter.draw(out.getContext('2d')!,text,out.width/2,out.height/2,{size,tracking:tracking*size,palette,align:'center'});
   download('roo-text.png',out.toDataURL('image/png'));
 };
 document.getElementById('atlas')!.onclick=async()=>{
   const response=await fetch(`${import.meta.env.BASE_URL}fonts/roo-image-font-v2.zip`);
   if(!response.ok)throw new Error('Font download failed');
   download('roo-image-font-v2.zip',await response.blob());
 };
 Object.assign(window,{rooTypeLab:{ready:true,paint,painter,metrics:()=>({glyphs:51,palettes:2,version:2,width,height})}});
}
void main().catch(error=>{const report=document.getElementById('report');if(report)report.textContent=String(error);console.error(error);});
