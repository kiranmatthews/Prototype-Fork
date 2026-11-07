/** Special exploration gems are separate from clear gems and combo prizes. */
export const COLOURED_GEMS = {
  yellow: {label:'Yellow', tint:0xfff212},
  red: {label:'Red', tint:0xf24952},
  blue: {label:'Blue', tint:0x4b9bff},
  green: {label:'Green', tint:0x56db75},
  purple: {label:'Purple', tint:0xb66cff},
} as const;
export type ColouredGemColour=keyof typeof COLOURED_GEMS;
export function isColouredGemColour(value:unknown):value is ColouredGemColour {
  return typeof value==='string'&&Object.prototype.hasOwnProperty.call(COLOURED_GEMS,value);
}
export const COLOURED_GEM_STORAGE_KEY='solProtoColouredGemsV1';
type GemStorage=Pick<Storage,'getItem'|'setItem'>;
const browserStorage=():GemStorage|null=>{try{return typeof localStorage==='undefined'?null:localStorage;}catch{return null;}};

// Exploration discoveries bank on contact, including standalone demo courses
// which do not have a campaign slot. A failed browser write keeps the discovery
// for this session; it never blocks play or awards another kind of collectible.
export class ColouredGemCollection {
  private found=new Set<string>();
  constructor(private storage:GemStorage|null=browserStorage()){this.read();}
  private key(level:string,colour:ColouredGemColour){return `${level}:${colour}`;}
  private read(){
    try{
      const data=JSON.parse(this.storage?.getItem(COLOURED_GEM_STORAGE_KEY)??'null');
      if(data?.v!==1||!Array.isArray(data.discoveries)||data.discoveries.length>2048)return;
      for(const row of data.discoveries){
        if(Array.isArray(row)&&row.length===2&&typeof row[0]==='string'&&/^[A-Za-z0-9_-]{1,256}$/.test(row[0])&&isColouredGemColour(row[1]))
          this.found.add(this.key(row[0],row[1]));
      }
    }catch{/* private storage or a malformed old record: retain session progress */}
  }
  has(level:string,colour:ColouredGemColour){return this.found.has(this.key(level,colour));}
  collect(level:string,colour:ColouredGemColour):boolean {
    this.read();const key=this.key(level,colour);
    if(this.found.has(key))return false;
    this.found.add(key);
    try{this.storage?.setItem(COLOURED_GEM_STORAGE_KEY,JSON.stringify({v:1,discoveries:[...this.found].map(value=>value.split(':'))}));}catch{/* session progress remains valid */}
    return true;
  }
}
export const colouredGemCollection=new ColouredGemCollection();
