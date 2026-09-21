/** Small, local-only breadcrumbs survive a browser/OS process restart. */
declare const __BUILD_TAG__:string;
export const STABILITY_REPORT_KEY='solProtoStabilityV1';
interface Store {getItem(key:string):string|null;setItem(key:string,value:string):void;}
interface Entry {at:string;stage:string;detail:Record<string,unknown>;}
interface Session {build:string;started:string;environment:Record<string,unknown>;events:Entry[];}
export class StabilityReport {
  private sessions:Session[]=[];
  private session:Session;
  private writable=true;
  constructor(private storage:Store|undefined,build:string,environment:Record<string,unknown>,private now=()=>new Date().toISOString()) {
    try{
      const raw=storage?.getItem(STABILITY_REPORT_KEY)??'null';
      const saved=raw.length<=100000?JSON.parse(raw):null;
      if(saved?.v===1&&Array.isArray(saved.sessions))this.sessions=saved.sessions.filter((s:Session)=>s&&Array.isArray(s.events)).slice(-2);
    }catch{/* Corrupt/unavailable diagnostics never affect the game. */}
    this.session={build,started:this.now(),environment,events:[]};this.sessions.push(this.session);
    this.record('boot');
  }
  record(stage:string,detail:Record<string,unknown>={}):void {
    this.session.events.push({at:this.now(),stage,detail});
    if(this.session.events.length>48)this.session.events.shift();
    if(!this.writable)return;
    try{this.storage?.setItem(STABILITY_REPORT_KEY,JSON.stringify({v:1,sessions:this.sessions}));}
    catch{this.writable=false;}
  }
}
let storage:Store|undefined;
try{if(typeof localStorage!=='undefined')storage=localStorage;}catch{/* private browsing */}
export const stabilityReport=new StabilityReport(storage,typeof __BUILD_TAG__==='undefined'?'development':__BUILD_TAG__,
  typeof navigator==='undefined'?{}:{userAgent:navigator.userAgent,touchPoints:navigator.maxTouchPoints});
if(typeof window!=='undefined'){
  window.addEventListener('error',event=>stabilityReport.record('javascript-error',{message:String(event.message).slice(0,500)}));
  window.addEventListener('unhandledrejection',event=>stabilityReport.record('promise-error',{message:String(event.reason).slice(0,500)}));
  window.addEventListener('pagehide',event=>stabilityReport.record('page-exit',{persisted:event.persisted}));
  document.addEventListener('visibilitychange',()=>stabilityReport.record(document.hidden?'page-hidden':'page-visible'));
}
