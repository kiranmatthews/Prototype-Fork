import { testTimeout } from './test-timing.mjs';

// Observe initial readiness with minimal CDP traffic before attaching the
// larger browser harness. All phases share one deadline and close cleanly.
export async function waitForNativeStartup(endpoint) {
  const socket = new WebSocket(endpoint);
  let next = 0, failure = null, rejectOpen;
  const pending = new Map();
  function fail(error) {
    if (failure) return;
    failure = error;
    rejectOpen?.(error);
    for (const waiter of pending.values()) waiter.reject(error);
    pending.clear();
    try { socket.close(); } catch {}
  }
  const timer = setTimeout(() => fail(new Error('Native startup exceeded its functional-test deadline')), testTimeout);
  socket.addEventListener('error', () => fail(new Error('Native startup connection failed')));
  socket.addEventListener('close', () => fail(new Error('Native startup connection closed')));
  socket.addEventListener('message', event => {
    const message = JSON.parse(event.data);
    const waiter = pending.get(message.id);
    if (!waiter) return;
    pending.delete(message.id);
    if (message.error) waiter.reject(new Error(JSON.stringify(message.error)));
    else waiter.resolve(message.result);
  });
  const send = (method,params={},sessionId) => {
    if (failure) return Promise.reject(failure);
    return new Promise((resolve,reject) => {
      const id=++next; pending.set(id,{resolve,reject});
      socket.send(JSON.stringify({id,method,params,sessionId}));
    });
  };
  try {
    await new Promise((resolve,reject) => {
      rejectOpen=reject;
      socket.addEventListener('open',resolve,{once:true});
    });
    rejectOpen=null;
    let target;
    while (!target) {
      const {targetInfos}=await send('Target.getTargets');
      target=targetInfos.find(t => t.type==='page' && t.url.startsWith('boneman://game/'));
      if (!target) await new Promise(resolve=>setTimeout(resolve,100));
    }
    const {sessionId}=await send('Target.attachToTarget',{targetId:target.targetId,flatten:true});
    for (;;) {
      const {result,exceptionDetails}=await send('Runtime.evaluate',{
        expression:"document.readyState === 'complete' && !!window.__game",
        returnByValue:true,
      },sessionId);
      if (exceptionDetails) throw new Error('Game initialization failed');
      if (result.value) break;
      await new Promise(resolve=>setTimeout(resolve,100));
    }
    await send('Target.detachFromTarget',{sessionId});
  } finally {clearTimeout(timer);socket.close();}
}
