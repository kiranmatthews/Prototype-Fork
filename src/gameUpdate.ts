/** Compare the loaded HTML's entry with a tiny, uncached release descriptor.
 * No worker installation, asset prefetch, save mutation or automatic reload. */
export async function newerGameAvailable(
  base: string,
  runningEntry: string,
  fetcher: typeof fetch = fetch,
  onReachable?: () => void,
): Promise<boolean> {
  if (!runningEntry) return false;
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 8000);
  try {
    const response = await fetcher(new URL('release.json', base), {
      cache: 'no-store', signal: controller.signal,
    });
    if (!response.ok) return false;
    const declared = Number(response.headers.get('content-length'));
    if (declared > 1024) { await response.body?.cancel(); return false; }
    if (!response.body) return false;
    const reader=response.body.getReader(),decoder=new TextDecoder();let text='',bytes=0;
    try {
      for (;;) {
        const chunk=await reader.read();if(chunk.done)break;
        bytes+=chunk.value.byteLength;
        if(bytes>1024){await reader.cancel();return false;}
        text+=decoder.decode(chunk.value,{stream:true});
      }
      text+=decoder.decode();
    } finally {reader.releaseLock();}
    const release = JSON.parse(text) as { entry?: unknown };
    if (typeof release.entry !== 'string' || !/^assets\/index-[\w-]+\.js$/.test(release.entry)) return false;
    const current = new URL(runningEntry, base), latest = new URL(release.entry, base);
    if(current.origin!==latest.origin)return false;
    onReachable?.();
    return current.pathname !== latest.pathname;
  } catch { return false; }
  finally { clearTimeout(timer); }
}
