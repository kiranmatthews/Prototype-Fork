/** Immutable reward receipt; animation never writes to player/campaign state. */
export interface BonusReceipt {
  parent: { fruit:number; lives:number; boxes:number; totalBoxes:number; deaths:number; modern:boolean };
  bonus: { fruit:number; lives:number; boxes:number; totalBoxes:number };
}
export const BONUS_TRANSFER_SECONDS=2.8;
const clamp=(v:number)=>Math.max(0,Math.min(1,v));
export function bonusTransferFrame(receipt:BonusReceipt,elapsed:number,reduced=false) {
  const sent=clamp((elapsed-.2)/1.85);
  const arrived=clamp((elapsed-.2-(reduced?0:.42))/1.85);
  const remaining={fruit:0,lives:0,boxes:0};
  const paid={fruit:0,lives:0,boxes:0};
  for(const kind of ['fruit','boxes','lives'] as const){
    remaining[kind]=receipt.bonus[kind]-Math.floor(receipt.bonus[kind]*sent);
    paid[kind]=Math.floor(receipt.bonus[kind]*arrived);
  }
  const totalFruit=receipt.parent.fruit+paid.fruit;
  const lifeAwards=paid.lives+Math.floor(totalFruit/100);
  return {receipt,elapsed,remaining,paid,
    parent:{fruit:totalFruit%100,boxes:receipt.parent.boxes+paid.boxes,
      lives:receipt.parent.modern?Math.max(0,receipt.parent.deaths-lifeAwards):receipt.parent.lives+lifeAwards},
    alpha:clamp(elapsed/.2),complete:elapsed>=BONUS_TRANSFER_SECONDS,reduced};
}
export type BonusTransferFrame=ReturnType<typeof bonusTransferFrame>;

/** Bound the decoration independently of the reward amount, including 100+ fruit. */
export function bonusTransferFlights(frame:BonusTransferFrame) {
  if(frame.reduced)return [];
  const flights:{kind:'fruit'|'boxes'|'lives';progress:number;index:number}[]=[];
  for(const kind of ['fruit','boxes','lives'] as const){
    const count=Math.min(12,frame.receipt.bonus[kind]);
    for(let i=0;i<count;i++){
      const start=.2+(i+1)/count*1.85;
      const progress=(frame.elapsed-start)/.42;
      if(progress>=0&&progress<1)flights.push({kind,progress,index:i});
    }
  }
  return flights;
}
