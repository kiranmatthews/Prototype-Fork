// This small entry is attached to the generated public atlas page at build
// time. The unchanged source page and original ZIP remain available locally.
const link=document.querySelector<HTMLAnchorElement>('a[href="level-atlas.zip"]');
if(link){
 const label=link.textContent,status=document.createElement('span');let busy=false;
 status.setAttribute('role','status');status.style.fontSize='12px';status.style.marginLeft='12px';link.after(status);
 link.addEventListener('click',async event=>{
  event.preventDefault();if(busy)return;
  busy=true;link.setAttribute('aria-disabled','true');link.textContent='Preparing pack…';status.textContent='';
  try{
   const {buildLevelAtlasArchive}=await import('./archive');
   const blob=await buildLevelAtlasArchive(new URL('./',location.href),fetch,(completed,total)=>{
    link.textContent=`Preparing pack… ${Math.round(completed/Math.max(total,1)*100)}%`;
   });
   const url=URL.createObjectURL(blob),download=document.createElement('a');download.href=url;download.download='level-atlas.zip';
   try{download.click();}finally{setTimeout(()=>URL.revokeObjectURL(url),1000);}
   status.textContent='Download ready.';
  }catch{status.textContent='Could not prepare the pack. Please try again.';}
  finally{busy=false;link.removeAttribute('aria-disabled');link.textContent=label;}
 });
}
