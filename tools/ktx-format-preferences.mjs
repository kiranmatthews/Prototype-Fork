const loaderRequest='three/examples/jsm/loaders/KTX2Loader.js';
const sharedSort=/const (ETC1S_OPTIONS|UASTC_OPTIONS) = FORMAT_OPTIONS\.sort\(/g;
const independentSort=/const (ETC1S_OPTIONS|UASTC_OPTIONS) = \[\.\.\.FORMAT_OPTIONS\]\.sort\(/g;

/** Three r166 sorts the same array twice, overwriting ETC1S's preference for
 * its native ETC format. Copy each list before sorting. Patch only the bundled
 * module; the shared node_modules checkout and source artwork stay untouched.
 * Remove this compatibility fix when upgrading to a corrected upstream loader. */
export function separateKtxFormatPreferences(source){
 const names=[...source.matchAll(sharedSort)].map(match=>match[1]).sort();
 if(names.length===0){
  const corrected=[...source.matchAll(independentSort)].map(match=>match[1]).sort();
  if(corrected.join(',')==='ETC1S_OPTIONS,UASTC_OPTIONS')return source;
 }
 if(names.join(',')!=='ETC1S_OPTIONS,UASTC_OPTIONS')throw Error('KTX2Loader format selection changed; review the texture-format compatibility fix');
 return source.replace(sharedSort,'const $1 = [...FORMAT_OPTIONS].sort(');
}

export function ktxFormatPreferences(){
 return{
  name:'independent-ktx-format-preferences',enforce:'pre',
  // Development must use the same corrected module as production. Otherwise
  // Vite's dependency cache bypasses this transform.
  config:()=>({optimizeDeps:{exclude:[loaderRequest]}}),
  transform(source,id){
   if(!id.split('?')[0].replaceAll('\\','/').endsWith('/'+loaderRequest))return null;
   return{code:separateKtxFormatPreferences(source),map:null};
  },
 };
}
