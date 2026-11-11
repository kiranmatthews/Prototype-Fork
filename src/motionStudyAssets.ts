type StudyAsset = 'jak-motion' | 'jak-audio' | 'jak-eco' | 'skate-motion';

/** Local source overrides and the published playtests use the same samples. */
export function motionStudyAsset(kind: StudyAsset, file = ''): string {
  if (import.meta.env.DEV) {
    if (kind === 'skate-motion' && import.meta.env.VITE_SKATE_REFERENCE_LOCAL)
      return `/__skate_reference/${file}`;
    if (kind !== 'skate-motion' && import.meta.env.VITE_JAK_REFERENCE_AUDIO)
      return `/__jak-reference-${kind.slice(4)}/${file}`;
  }
  const folder = kind === 'skate-motion' ? 'skate' : kind === 'jak-motion' ? 'jak'
    : `jak/${kind.slice(4)}`;
  const packed = (kind === 'jak-motion' || kind === 'skate-motion') && /\.(json|glb)$/.test(file);
  return `${import.meta.env.BASE_URL}motion-study/${folder}/${file}${packed ? '.gz' : ''}`;
}

export async function loadMotionStudyBuffer(kind: StudyAsset, file: string): Promise<ArrayBuffer> {
  const url = motionStudyAsset(kind, file);
  const response = await fetch(url);
  if (!response.ok || !response.body) throw new Error(`Motion study asset unavailable (${response.status}): ${url}`);
  const bytes=await response.arrayBuffer(),header=new Uint8Array(bytes,0,Math.min(2,bytes.byteLength));
  // Vite serves .gz with Content-Encoding: gzip, so fetch has already decoded
  // it. Pages may serve the same file as raw gzip. Inspect the payload rather
  // than decoding a second time merely because the URL ends in .gz.
  return header[0]===0x1f&&header[1]===0x8b
    ? new Response(new Blob([bytes]).stream().pipeThrough(new DecompressionStream('gzip'))).arrayBuffer()
    : bytes;
}

export async function loadMotionStudyJson<T>(kind: 'jak-motion' | 'skate-motion'): Promise<T> {
  return JSON.parse(new TextDecoder().decode(await loadMotionStudyBuffer(kind, 'motion.json'))) as T;
}
