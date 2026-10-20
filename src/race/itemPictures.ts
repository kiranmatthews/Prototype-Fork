import {RACE_ITEMS,type RaceItem} from './types';

export const raceItemPicture=(item:RaceItem):string=>`${import.meta.env.BASE_URL}race-items/${item}.webp`;
const pictures=new Map<RaceItem,{image:HTMLImageElement;ready:Promise<void>}>();
/** Prepare the existing image painter's inputs before revealing a race. */
export async function prepareRaceItemPictures():Promise<void> {
  if(typeof Image==='undefined')return;
  await Promise.all((Object.keys(RACE_ITEMS) as RaceItem[]).map(item=>{
    let picture=pictures.get(item);
    if(!picture){
      const image=new Image();
      const ready=new Promise<void>((resolve,reject)=>{
        image.onload=()=>resolve();image.onerror=()=>{pictures.delete(item);reject(new Error(`Race item picture unavailable: ${item}`));};
        image.src=raceItemPicture(item);
      });
      picture={image,ready};pictures.set(item,picture);
    }
    return picture.ready;
  }));
}
