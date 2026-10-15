import type { RaceItem } from './types';

/** Our eight-rider tuning, not a claimed copy of either commercial game's odds.
 * Separate rider streams keep AI reaction draws from deciding the human's loot. */
export class RaceItemDeck {
  private seed=1;
  private recent:RaceItem[]=[];
  reset(seed:number):void {this.seed=seed||1;this.recent=[];}
  draw(rank:number,gap:number,heavy:boolean):RaceItem {
    const weights:Partial<Record<RaceItem,number>>=rank<=2?
      {banana:24,'green-shell':18,shield:24,mushroom:18,horn:16}:
      rank<=5?{banana:10,'green-shell':12,'red-shell':26,shield:20,mushroom:24,horn:8}:
      {'green-shell':5,'red-shell':22,shield:18,mushroom:40,horn:10};
    if(rank>2&&gap>70)weights.mushroom!+=15;
    if(rank>=5&&gap>45&&heavy){weights['blue-shell']=7;if(rank>=6&&gap>90)weights['shock-shell']=4;}
    // The last two draws cannot repeat, including across rank changes.
    const choices=(Object.entries(weights) as [RaceItem,number][]).filter(([item])=>!this.recent.includes(item));
    let x=this.seed|0;x^=x<<13;x^=x>>>17;x^=x<<5;this.seed=x;
    let roll=(x>>>0)/4294967296*choices.reduce((sum,[,w])=>sum+w,0);
    let item=choices[choices.length-1][0];for(const [kind,w] of choices){roll-=w;if(roll<0){item=kind;break;}}
    this.recent.push(item);if(this.recent.length>2)this.recent.shift();return item;
  }
}
