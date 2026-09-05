// Tiny Web Audio SFX engine. Buffers load after the first user input (the
// browser gesture requirement), one-shots get slight random pitch, and two
// managed loop channels cover skating and grinding. All fire-and-forget:
// audio must never break the sim, so everything is wrapped in try/catch.

const FILES: Record<string, string> = {
  ollie: 'ollie.wav',
  railLand: 'rail-land.wav',
  grindLoop: 'grinding-loop.wav',
  skateLoop: 'skating-loop.wav',
  wallrideLoop: 'skating-loop-5.wav',
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
  ledgeGrab: 'ledge-grab.wav',
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
  specialTrick: 'special-trick.mp3', // supplied SPECIAL-trick sting
};

interface LoopChannel {
  src: AudioBufferSourceNode;
  gain: GainNode;
  name: string;
}

// iOS AUDIO SESSION: this game is a polite guest. The old build played a
// silent <audio> element once to flip the session to "playback" so the game
// stayed audible with the mute switch on — but "playback" also STOPS whatever
// the phone was already playing (a podcast, a YouTube video) the moment the
// first sound fires. That trade is backwards for a pick-up-and-play game:
// we now ask for the "ambient" session instead (Audio Session API, iOS 17+),
// which MIXES game audio over the user's own listening and never interrupts
// it. The flip side — and it is inherent, iOS offers no mix-without-switch
// category — is that the ambient session obeys the ringer/mute switch, so a
// muted iPhone plays a silent game. That is how native mobile games behave.
// Desktop browsers have no audio session and ignore all of this.
function requestAmbientSession(): void {
  try {
    const sess = (navigator as unknown as { audioSession?: { type: string } }).audioSession;
    if (sess && sess.type !== 'ambient') sess.type = 'ambient';
  } catch {
    /* older Safari / other browsers: no session control, nothing to do */
  }
}

class SfxEngine {
  volume = 0.5; // master

  private ctx: AudioContext | null = null;
  private master: GainNode | null = null;
  private sfxBus: GainNode | null = null;
  private musicBus: GainNode | null = null;
  private sfxMuted = false;
  private musicMuted = false;
  private buffers = new Map<string, AudioBuffer>();
  private loops = new Map<string, LoopChannel>();
  private lastPlay = new Map<string, number>();
  private loading = false;
  private preparation: Promise<void>;

  constructor() {
    // Warm up at PAGE LOAD: create the (suspended) context and start decoding
    // every buffer right away, so sound is ready the instant something resumes
    // the context — instead of only starting the async load on the first gesture
    // (which left the opening seconds silent). unlock() then just resumes.
    this.preparation = this.init();
    const unlock = (): void => this.unlock();
    // keydown/pointer/touch are real user gestures; gamepadconnected + the
    // per-frame poll (see main.ts) cover controller-only players, who fire none
    // of the DOM gesture events. touchend is the one OLD iOS Safari counts.
    window.addEventListener('keydown', unlock);
    window.addEventListener('pointerdown', unlock);
    window.addEventListener('touchstart', unlock, { passive: true });
    window.addEventListener('touchend', unlock, { passive: true });
    window.addEventListener('gamepadconnected', unlock);
  }

  // Resume the context on any interaction (cheap no-op once it's running). Safe
  // to call every frame from the input loop — the browser only actually resumes
  // it inside a user gesture, but the extra attempts are harmless.
  unlock(): void {
    try {
      // Mix with the user's own audio, never interrupt it — re-asserted at
      // every resume because iOS re-activates the session then (cheap no-op
      // once set; see requestAmbientSession above for the mute-switch trade).
      requestAmbientSession();
      if (!this.ctx) {
        this.preparation = this.init();
        return;
      }
      if (this.ctx.state === 'suspended') void this.ctx.resume();
    } catch {
      /* no audio — fine */
    }
  }

  /** Includes fetch and decode, without waiting for user-gesture playback. */
  prepare(): Promise<void> { return this.preparation; }

  private async init(): Promise<void> {
    try {
      if (!this.ctx) {
        // declare the polite session BEFORE the context exists, so its very
        // first activation is already "mix with others"
        requestAmbientSession();
        this.ctx = new AudioContext();
        this.master = this.ctx.createGain();
        this.master.gain.value = this.volume;
        this.sfxBus = this.ctx.createGain();
        this.musicBus = this.ctx.createGain();
        this.sfxBus.gain.value = this.sfxMuted ? 0 : 1;
        this.musicBus.gain.value = this.musicMuted ? 0 : 1;
        this.sfxBus.connect(this.master);
        this.musicBus.connect(this.master);
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

  play(name: string, vol = 1, rate = 1, pitchVariance = 0.04): void {
    try {
      const ctx = this.ctx;
      const buf = this.buffers.get(name);
      const bus = this.isMusic(name) ? this.musicBus : this.sfxBus;
      if (!ctx || !bus || !buf) return;
      // debounce: a blast breaking 6 crates shouldn't stack 6 full-gain hits
      const now = ctx.currentTime;
      if (now - (this.lastPlay.get(name) ?? -1) < 0.04) return;
      this.lastPlay.set(name, now);
      const src = ctx.createBufferSource();
      src.buffer = buf;
      const jitter = Math.max(0, pitchVariance);
      src.playbackRate.value = rate * (1 - jitter + Math.random() * jitter * 2);
      const gain = ctx.createGain();
      gain.gain.value = vol;
      src.connect(gain);
      gain.connect(bus);
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
      const bus = this.isMusic(name) ? this.musicBus : this.sfxBus;
      if (!active || !ctx || !bus) {
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
      gain.connect(bus);
      src.start();
      this.loops.set(id, { src, gain, name });
    } catch {
      /* ignore */
    }
  }

  setMuted(options: { sfxMuted: boolean; musicMuted: boolean }): void {
    this.sfxMuted = options.sfxMuted;
    this.musicMuted = options.musicMuted;
    if (this.sfxBus) this.sfxBus.gain.value = this.sfxMuted ? 0 : 1;
    if (this.musicBus) this.musicBus.gain.value = this.musicMuted ? 0 : 1;
  }

  stopLoops(): void {
    for (const loop of this.loops.values()) {
      try {
        loop.src.stop();
      } catch {
        // It may already have stopped between frames.
      }
    }
    this.loops.clear();
  }

  private isMusic(name: string): boolean {
    return name === 'uberMusic';
  }
}

export const sfx = new SfxEngine();
