import type { WebGLRenderer } from 'three';
import { KTX2Loader } from 'three/examples/jsm/loaders/KTX2Loader.js';

/** One decoder across scenery families, with no persistent idle WASM heaps. */
export function retireIdleDecoderWorkers(loader: KTX2Loader, delay = 5000): void {
  const pool = loader.workerPool;
  const post = pool.postMessage.bind(pool);
  let pending = 0, timer: ReturnType<typeof setTimeout> | undefined;
  pool.postMessage = (message, transfer) => {
    clearTimeout(timer);pending++;
    return post(message, transfer).finally(() => {
      if (--pending === 0) timer = setTimeout(() => {
        // WorkerPool.dispose retains its creator, so later loads can restart.
        // Do not dispose KTX2Loader itself: that revokes the creator's URL.
        if (pending === 0) pool.dispose();
      }, delay);
    });
  };
}
/** All pending images share one bounded decoder initialization. A dropped
 * WASM download must not poison every later texture for the whole session. */
export function retrySceneryDecoderInitialization(loader:KTX2Loader):void {
  const decoder=loader as KTX2Loader & {init:()=>Promise<void>};
  const initialize=decoder.init.bind(decoder);let ready:Promise<void>|null=null;
  decoder.init=()=>{
    if(!ready){
      const job=(async()=>{
        for(let attempt=0;attempt<3;attempt++){
          try{await initialize();return;}catch(error){
            // Initialization failed before any image worker could start.
            // Balance the loader's lifetime counter before retrying it.
            loader.dispose();loader.transcoderPending=null;
            if(attempt===2)throw error;
            await new Promise(resolve=>setTimeout(resolve,attempt===0?300:900));
          }
        }
      })();
      ready=job;job.catch(()=>{if(ready===job)ready=null;});
    }
    return ready;
  };
}
const loaders = new WeakMap<WebGLRenderer, KTX2Loader>();
export function sceneryDecoderDiagnostics(renderer:WebGLRenderer) {
  const loader=loaders.get(renderer);
  return {workers:loader?.workerPool.workers.length??0,limit:loader?.workerPool.pool??0};
}
export function sceneryTextureLoader(renderer: WebGLRenderer): KTX2Loader {
  let loader = loaders.get(renderer);
  if (!loader) {
    loader = new KTX2Loader().setTranscoderPath(import.meta.env.BASE_URL+'jungle-kit/basis/').setWorkerLimit(1).detectSupport(renderer);
    retrySceneryDecoderInitialization(loader);
    retireIdleDecoderWorkers(loader);
    loaders.set(renderer, loader);
  }
  return loader;
}
