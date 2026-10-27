import type { RaceItem } from './types';

/** Fresh entropy per race; the chosen value is captured alongside replay inputs. */
export function freshRaceSeed():number {
  const value=new Uint32Array(1);do{globalThis.crypto.getRandomValues(value);}while(!value[0]);return value[0];
}

/** Our eight-rider tuning, not a claimed copy of either commercial game's odds.
 * Separate rider streams keep AI reaction draws from deciding the human's loot. */
export class RaceItemDeck {
  private seed=1;
  private recent:RaceItem[]=[];
  reset(seed:number):void {this.seed=seed||1;this.recent=[];}
  draw(rank:number,gap:number,heavy:boolean,ultra=false,rally=false):RaceItem {
    const weights:Partial<Record<RaceItem,number>>=rank<=2?
      {tnt:12,nitro:10,banana:18,'green-shell':14,shield:21,mushroom:17,horn:13,boomerang:10,'water-bomb':7}:
      rank<=5?{tnt:10,nitro:8,banana:7,'green-shell':9,'red-shell':21,shield:17,mushroom:24,horn:7,boomerang:8,'water-bomb':7}:
      {tnt:5,nitro:4,'green-shell':4,'red-shell':20,shield:16,mushroom:40,horn:8,boomerang:7,'water-bomb':5};
    if(rank>2&&gap>70)weights.mushroom!+=15;
    if(rank>=5&&gap>45&&heavy){weights['blue-shell']=7;if(rank>=6&&gap>90)weights['shock-shell']=4;}
    if(ultra){weights.star=.06;if(heavy&&rank>=5&&gap>70)weights['tidal-wave']=.04;}
    if(rally){
      // Distance matters more than a last-place label: a close pack gets local
      // racing tools. A genuine gap adds bounded chances of pace and pursuit.
      const t=Math.max(0,Math.min(1,(gap-24)/116)),chase=rank>1?t*t*(3-2*t):0;
      for(const key of Object.keys(weights))delete weights[key as RaceItem];
      Object.assign(weights,rank===1?
        {tnt:18,nitro:16,banana:12,'green-shell':20,'water-bomb':20,horn:20,boomerang:12,mushroom:12,shield:14}:
        {tnt:12-5*chase,nitro:10-4*chase,banana:10-5*chase,'green-shell':16,'red-shell':16+8*chase,
          'water-bomb':14,horn:14,boomerang:10,mushroom:18+18*chase,shield:18+2*chase});
      if(ultra)weights.star=rank===1?.5:1+2*chase;
      if(heavy&&rank>=2&&gap>45)weights['blue-shell']=12*chase;
      if(heavy&&rank>=5&&gap>110){weights['shock-shell']=2*chase;if(ultra)weights['tidal-wave']=chase;}
    }
    // The last two draws cannot repeat, including across rank changes.
    const choices=(Object.entries(weights) as [RaceItem,number][]).filter(([item])=>!this.recent.includes(item));
    let x=this.seed|0;x^=x<<13;x^=x>>>17;x^=x<<5;this.seed=x;
    let roll=(x>>>0)/4294967296*choices.reduce((sum,[,w])=>sum+w,0);
    let item=choices[choices.length-1][0];for(const [kind,w] of choices){roll-=w;if(roll<0){item=kind;break;}}
    this.recent.push(item);if(this.recent.length>2)this.recent.shift();return item;
  }
}
