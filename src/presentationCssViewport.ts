/** UI ink must use the displayed canvas, which can extend below iOS's layout
 * viewport in a home-screen app. DOM hit targets keep their CSS coordinates. */
export function presentationCssViewport(fallback?: {left:number;top:number;width:number;height:number}) {
  const host=typeof document==='undefined'?null:document.querySelector('#app canvas')??document.querySelector('#app');
  const rect=host?.getBoundingClientRect();
  return {
    left:rect?.left??fallback?.left??0,
    top:rect?.top??fallback?.top??0,
    width:Math.max(1,rect?.width||fallback?.width||(typeof window!=='undefined'?window.innerWidth:1)),
    height:Math.max(1,rect?.height||fallback?.height||(typeof window!=='undefined'?window.innerHeight:1)),
  };
}
