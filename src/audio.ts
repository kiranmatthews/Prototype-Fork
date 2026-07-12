// Tiny Web Audio SFX engine. Buffers load after the first user input (the
// browser gesture requirement), one-shots get slight random pitch, and two
// managed loop channels cover skating and grinding. All fire-and-forget:
// audio must never break the sim, so everything is wrapped in try/catch.

const FILES: Record<string, string> = {
  ollie: 'ollie.wav',
  railLand: 'rail-land.wav',
  grindLoop: 'grinding-loop.wav',
  skateLoop: 'skating-loop.wav',
  skateHalt: 'skate-halt.wav',
  skateTransition: 'skate-transition.wav',
  crunch: 'crunch.wav',
  footstep1: 'foot-step.wav',
  footstep2: 'foot-step-2.wav',
  footstep3: 'foot-step-3.wav',
  spin1: 'spin-1.wav',
  spin2: 'spin-3.wav',
  spin3: 'spin-4.wav',
  woosh: 'woosh.wav',
  woosh2: 'woosh-2.wav',
  woosh3: 'woosh-3.wav',
  crateBreak1: 'crate-break-1.wav',
  crateBreak2: 'crate-break-2.wav',
  crateBounce: 'crate-bounce.wav',
  bouncyBounce: 'bouncy-box-bounce.wav',
  wumpa1: 'wumpa-get.wav',
  wumpa2: 'wumpa-get-2.wav',
  wumpa3: 'fruit-get.wav',
  maskGet: 'mask-get.wav',
  crystalGet: 'crystal-collect.mp3', // Crash crystal pickup jingle
  maskLoss: 'mask-loss.wav',
  lifeGet: 'life-get.wav',
  takeDamage: 'take-damage.wav',
  death: 'death.wav',
  tntCount: 'tnt-count.wav',
  tntCount2: 'tnt-count-2.wav',
  tntBoom: 'explosion.mp3', // the real nitro/TNT detonation
  enemyDown: 'unsure.wav',
  fruitSpun: 'spin-away.wav', // spun a wumpa away instead of collecting it
  uberMusic: 'uber-music.mp3', // triple-mask invincibility theme
};

interface LoopChannel {
  src: AudioBufferSourceNode;
  gain: GainNode;
  name: string;
}

class SfxEngine {
  volume = 0.5; // master

  private ctx: AudioContext | null = null;
  private master: GainNode | null = null;
  private buffers = new Map<string, AudioBuffer>();
  private loops = new Map<string, LoopChannel>();
  private lastPlay = new Map<string, number>();
  private loading = false;

  constructor() {
    // Warm up at PAGE LOAD: create the (suspended) context and start decoding
    // every buffer right away, so sound is ready the instant something resumes
    // the context — instead of only starting the async load on the first gesture
    // (which left the opening seconds silent). unlock() then just resumes.
    void this.init();
    const unlock = (): void => this.unlock();
    // keydown/pointer/touch are real user gestures; gamepadconnected + the
    // per-frame poll (see main.ts) cover controller-only players, who fire none
    // of the DOM gesture events.
    window.addEventListener('keydown', unlock);
    window.addEventListener('pointerdown', unlock);
    window.addEventListener('touchstart', unlock, { passive: true });
    window.addEventListener('gamepadconnected', unlock);
  }

  // Resume the context on any interaction (cheap no-op once it's running). Safe
  // to call every frame from the input loop — the browser only actually resumes
  // it inside a user gesture, but the extra attempts are harmless.
  unlock(): void {
    try {
      if (!this.ctx) {
        void this.init();
        return;
      }
      if (this.ctx.state === 'suspended') void this.ctx.resume();
    } catch {
      /* no audio — fine */
    }
  }

  private async init(): Promise<void> {
    try {
      if (!this.ctx) {
        this.ctx = new AudioContext();
        this.master = this.ctx.createGain();
        this.master.gain.value = this.volume;
        this.master.connect(this.ctx.destination);
      }
      if (this.ctx.state === 'suspended') void this.ctx.resume();
      if (this.loading) return;
      this.loading = true;
      // The packed single-file build injects data URIs; the site fetches wavs.
      const embedded = (window as unknown as Record<string, unknown>).__SFX_DATA as
        | Record<string, string>
        | undefined;
      await Promise.all(
        Object.entries(FILES).map(async ([name, file]) => {
          try {
            const url = embedded?.[file] ?? 'sfx/' + file;
            const res = await fetch(url);
            const data = await res.arrayBuffer();
            this.buffers.set(name, await this.ctx!.decodeAudioData(data));
          } catch {
            console.warn('sfx: failed to load', file);
          }
        }),
      );
    } catch {
      /* no audio — fine */
    }
  }

  play(name: string, vol = 1, rate = 1): void {
    try {
      const ctx = this.ctx;
      const buf = this.buffers.get(name);
      if (!ctx || !this.master || !buf) return;
      // debounce: a blast breaking 6 crates shouldn't stack 6 full-gain hits
      const now = ctx.currentTime;
      if (now - (this.lastPlay.get(name) ?? -1) < 0.04) return;
      this.lastPlay.set(name, now);
      const src = ctx.createBufferSource();
      src.buffer = buf;
      src.playbackRate.value = rate * (0.96 + Math.random() * 0.08);
      const gain = ctx.createGain();
      gain.gain.value = vol;
      src.connect(gain);
      gain.connect(this.master);
      src.start();
    } catch {
      /* ignore */
    }
  }

  // Managed loop channel: call every frame with the desired state.
  setLoop(id: string, name: string, active: boolean, vol: number, rate = 1): void {
    try {
      const ctx = this.ctx;
      const existing = this.loops.get(id);
      if (!active || !ctx || !this.master) {
        if (existing) {
          existing.src.stop();
          this.loops.delete(id);
        }
        return;
      }
      const buf = this.buffers.get(name);
      if (!buf) return;
      if (existing && existing.name === name) {
        existing.gain.gain.value = vol;
        existing.src.playbackRate.value = rate;
        return;
      }
      if (existing) {
        existing.src.stop();
        this.loops.delete(id);
      }
      const src = ctx.createBufferSource();
      src.buffer = buf;
      src.loop = true;
      src.playbackRate.value = rate;
      const gain = ctx.createGain();
      gain.gain.value = vol;
      src.connect(gain);
      gain.connect(this.master);
      src.start();
      this.loops.set(id, { src, gain, name });
    } catch {
      /* ignore */
    }
  }
}

export const sfx = new SfxEngine();
