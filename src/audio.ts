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
  boulderCameraRush: 'boulder-camera/rolling-rush.wav',
  boulderCameraHit1: 'boulder-camera/camera-hit-1.wav',
  boulderCameraHit2: 'boulder-camera/camera-hit-2.wav',
  boulderCameraHit3: 'boulder-camera/camera-hit-3.wav',
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
  moaSquawk: 'moa-caw.wav', // CC0 crow recording fitted to the original two mouth beats
  moaPeck: 'moa-caw-peck.wav',
  enemyDown: 'unsure.wav',
  karenNotice: 'enemies/karen-notice.wav',
  karenScreech: 'enemies/karen-screech.wav',
  kookCock: 'enemies/kook-cock.wav',
  kookShot: 'enemies/kook-shot.wav',
  rooftopRain: 'weather/rooftop-rain.wav',
  enemyCrabStep: 'enemies/crab-step.wav',
  enemyCrabClack: 'enemies/crab-clack.wav',
  enemySpikerStep: 'enemies/spiker-step.wav',
  enemySpikerSnuffle: 'enemies/spiker-snuffle.wav',
  enemyTurtleStep: 'enemies/turtle-step.wav',
  enemyTurtleGrumble: 'enemies/turtle-grumble.wav',
  enemyBullStep: 'enemies/bull-step.wav',
  enemyBullSnort: 'enemies/bull-snort.wav',
  enemyBullCharge: 'enemies/bull-charge.wav',
  enemyBullBrake: 'enemies/bull-brake.wav',
  enemyFrogCroak: 'enemies/frog-croak.wav',
  enemyFrogHop: 'enemies/frog-hop.wav',
  enemyFrogLand: 'enemies/frog-land.wav',
  enemyDroneHover: 'enemies/drone-hover.wav',
  enemyDroneSwoop: 'enemies/drone-swoop.wav',
  enemySentryCharge: 'enemies/sentry-charge.wav',
  enemySentryFire: 'enemies/sentry-fire.wav',
  enemySentryCool: 'enemies/sentry-cool.wav',
  enemySpinnerOpen: 'enemies/spinner-open.wav',
  enemySpinnerClose: 'enemies/spinner-close.wav',
  enemyMetalStep: 'enemies/metal-step.wav',
  enemyGoblinMutter: 'enemies/goblin-mutter.wav',
  enemyOrganicDown: 'enemies/organic-down.wav',
  enemyMachineDown: 'enemies/machine-down.wav',
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
  private sfxVolume = 1;
  private musicVolume = 1;
  private buffers = new Map<string, AudioBuffer>();
  private loops = new Map<string, LoopChannel>();
  private lastPlay = new Map<string, number>();
  private emitterGain = 1;
  private emitterChannel = "";
  private loading = false;
  private loadController: AbortController | null = null;
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
    window.addEventListener('pagehide', () => {
      // A bounded queue must not start its remaining fetches in a detached
      // document when navigating to the lightweight offline saver.
      this.loadController?.abort();this.stopLoops();
      void this.ctx?.suspend().catch(()=>{});
    });
    window.addEventListener('pageshow', event => {
      if(event.persisted)this.preparation=this.preparation.then(()=>this.init());
    });
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
      // Device availability can reject asynchronously. Keep play alive; a
      // later gesture/frame can retry without throwing an unhandled rejection.
      if (this.ctx.state === 'suspended') void this.ctx.resume().catch(() => {});
    } catch {
      /* no audio — fine */
    }
  }

  /** Includes fetch and decode, without waiting for user-gesture playback. */
  prepare(): Promise<void> { return this.preparation; }

  /** Settle in-flight requests while the document is still active (WebKit). */
  async prepareToLeave(): Promise<void> {
    this.loadController?.abort();this.stopLoops();
    await this.preparation;
    // Safari can leave suspend() pending on an already gesture-blocked context.
    // Asset cancellation, not audio-session activation, gates navigation.
    void this.ctx?.suspend().catch(()=>{});
  }

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
        this.sfxBus.gain.value = this.sfxVolume;
        this.musicBus.gain.value = this.musicVolume;
        this.sfxBus.connect(this.master);
        this.musicBus.connect(this.master);
        this.master.connect(this.ctx.destination);
      }
      if (this.ctx.state === 'suspended') void this.ctx.resume().catch(() => {});
      if (this.loading) return;
      this.loading = true;
      const controller=this.loadController=new AbortController();
      const context=this.ctx;
      // The packed single-file build injects data URIs; the site fetches wavs.
      const embedded = (window as unknown as Record<string, unknown>).__SFX_DATA as
        | Record<string, string>
        | undefined;
      const pending = Object.entries(FILES).filter(([name])=>!this.buffers.has(name));
      await Promise.all(Array.from({length:2},async()=>{
        while(pending.length&&!controller.signal.aborted){
          const [name,file]=pending.shift()!;
          try {
            // Both src/audio.ts and the built assets/*.js live one directory
            // below the app root; nested review tools share the same bank.
            const moduleUrl = import.meta.url;
            const url = embedded?.[file] ?? new URL('../sfx/' + file, moduleUrl).href;
            const res = await fetch(url,{signal:controller.signal});
            const data = await res.arrayBuffer();
            if(controller.signal.aborted)break;
            const buffer=await context.decodeAudioData(data);
            if(!controller.signal.aborted)this.buffers.set(name,buffer);
          } catch {
            if(!controller.signal.aborted)console.warn('sfx: failed to load', file);
          }
        }
      }));
      this.loading=false;
    } catch {
      /* no audio — fine */
    }
  }

  /** Scope synchronous actor one-shots without changing user volume or loop channels. */
  withGain<T>(gain:number,work:()=>T,channel=''):T {
    const previous=this.emitterGain,previousChannel=this.emitterChannel;
    this.emitterGain=Number.isFinite(gain)?Math.max(0,Math.min(1,gain)):0;this.emitterChannel=channel;
    try{return work();}finally{this.emitterGain=previous;this.emitterChannel=previousChannel;}
  }

  play(name: string, vol = 1, rate = 1, pitchVariance = 0.04): void {
    try {
      const ctx = this.ctx;
      const buf = this.buffers.get(name);
      const music=this.isMusic(name),bus=music?this.musicBus:this.sfxBus;
      if(!music)vol*=this.emitterGain;
      if (!ctx || !bus || !buf || vol<=.001) return;
      // debounce: a blast breaking 6 crates shouldn't stack 6 full-gain hits
      const now = ctx.currentTime;
      const key=!music&&this.emitterChannel?`${this.emitterChannel}:${name}`:name;
      if (now - (this.lastPlay.get(key) ?? -1) < 0.04) return;
      this.lastPlay.set(key, now);
      const src = ctx.createBufferSource();
      src.buffer = buf;
      const jitter = Math.max(0, pitchVariance);
      src.playbackRate.value = rate * (1 - jitter + Math.random() * jitter * 2);
      const gain = ctx.createGain();
      gain.gain.value = vol;
      src.connect(gain);
      gain.connect(bus);
      src.onended = () => { src.disconnect(); gain.disconnect(); };
      src.start();
    } catch {
      /* ignore */
    }
  }

  /** A short descending water impact and spray through the existing SFX bus. */
  waterPlop():void {
    try{
      if(!this.ctx||!this.sfxBus||this.emitterGain<=.001)return;
      const scale=this.emitterGain;
      const ctx=this.ctx,now=ctx.currentTime,gain=ctx.createGain(),tone=ctx.createOscillator();
      tone.type='sine';tone.frequency.setValueAtTime(420,now);tone.frequency.exponentialRampToValueAtTime(72,now+.19);
      gain.gain.setValueAtTime(.001*scale,now);gain.gain.linearRampToValueAtTime(.55*scale,now+.012);gain.gain.exponentialRampToValueAtTime(.001*scale,now+.3);
      tone.connect(gain);gain.connect(this.sfxBus);tone.onended=()=>{tone.disconnect();gain.disconnect();};tone.start(now);tone.stop(now+.32);
      const buffer=ctx.createBuffer(1,Math.ceil(ctx.sampleRate*.24),ctx.sampleRate),data=buffer.getChannelData(0);
      for(let i=0;i<data.length;i++)data[i]=(Math.random()*2-1)*Math.pow(1-i/data.length,2);
      const spray=ctx.createBufferSource(),filter=ctx.createBiquadFilter(),wet=ctx.createGain();
      spray.buffer=buffer;filter.type='lowpass';filter.frequency.value=1700;wet.gain.value=.17*scale;
      spray.connect(filter);filter.connect(wet);wet.connect(this.sfxBus);
      spray.onended=()=>{spray.disconnect();filter.disconnect();wet.disconnect();};spray.start(now);
    }catch{/* Audio availability never owns the water contact. */}
  }

  /** A short, exact-pitch clock cue through the existing SFX mute/volume bus. */
  countdownBeep(): void {
    try {
      if (!this.ctx || !this.sfxBus) return;
      const now = this.ctx.currentTime, tone = this.ctx.createOscillator(), gain = this.ctx.createGain();
      tone.type = 'sine'; tone.frequency.setValueAtTime(880, now);
      gain.gain.setValueAtTime(0, now);
      gain.gain.linearRampToValueAtTime(0.22, now + 0.008);
      gain.gain.exponentialRampToValueAtTime(0.001, now + 0.14);
      tone.connect(gain); gain.connect(this.sfxBus);
      tone.onended = () => { tone.disconnect(); gain.disconnect(); };
      tone.start(now); tone.stop(now + 0.15);
    } catch { /* Audio availability never owns the run lifecycle. */ }
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
          existing.src.disconnect();existing.gain.disconnect();
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
        existing.src.disconnect();existing.gain.disconnect();
        this.loops.delete(id);
      }
      const src = ctx.createBufferSource();
      src.buffer = buf;
      src.loop = true;
      src.loopStart = 0;
      // Some browser full-buffer loop paths repeat the final 128-frame render
      // block after the first pass. An explicit end at duration still hits
      // that path. Wrap one decoded sample earlier (about 23us at 44.1kHz).
      // Use the decoded buffer rate, not the WAV's original sample rate.
      src.loopEnd = (buf.length > 1 ? buf.length - 1 : buf.length) / buf.sampleRate;
      src.playbackRate.value = rate;
      const gain = ctx.createGain();
      gain.gain.value = vol;
      src.connect(gain);
      gain.connect(bus);
      src.onended = () => { src.disconnect(); gain.disconnect(); };
      src.start();
      this.loops.set(id, { src, gain, name });
    } catch {
      /* ignore */
    }
  }

  setVolumes(options: { sfxVolume: number; musicVolume: number }): void {
    this.sfxVolume = options.sfxVolume;
    this.musicVolume = options.musicVolume;
    if (this.sfxBus) this.sfxBus.gain.value = this.sfxVolume;
    if (this.musicBus) this.musicBus.gain.value = this.musicVolume;
  }

  stopLoops(): void {
    for (const loop of this.loops.values()) {
      try {
        loop.src.stop();
        loop.src.disconnect();loop.gain.disconnect();
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
