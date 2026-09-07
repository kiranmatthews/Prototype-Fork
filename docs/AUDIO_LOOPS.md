# Grind-loop boundary regression

The supplied `replay-TestCourse-2026-09-06T23-34-27.json` reproduces long grinds
around frames 3508–3689 and from frame 4117 onward. The managed grind source
stays at playback rate 1 with detune 0; this is not a speed-driven pitch change
or a second loop taking over.

The original `grinding-loop.wav` is 15,764 mono PCM samples at 12 kHz, about
1.314 seconds. Browser decoding resamples it to the context's sample rate.
In the tested Chrome build, an `AudioBufferSourceNode` looping to the exact
buffer end plays the clip once, then repeats a 128-sample render block. This
was reproduced in an isolated OfflineAudioContext without gameplay, at 12,
44.1 and 48 kHz. Setting `loopEnd = buffer.duration` has the same failure.

The shared managed-loop setup now uses:

```js
source.loopStart = 0;
source.loopEnd = (buffer.length > 1 ? buffer.length - 1 : buffer.length)
  / buffer.sampleRate;
```

That wraps one **decoded** sample earlier—about 23 microseconds at 44.1 kHz—
avoiding the full-buffer endpoint. It does not change the sample file, pitch,
volume, playback-rate policy, one-shot sounds or gameplay. The same protection
covers skating, wallride, boulder and music loop channels; one-sample buffers
remain valid rather than receiving an empty loop range.

`tools/test-audio-loops.mjs` exercises the actual engine with mock Web Audio
nodes: sample-rate/length boundaries, repeated updates without restart, pitch
and gain preservation, channel shutdown and unchanged one-shots. Real-browser
offline waveform tests compare multiple corrected loop periods and check that
the output no longer has an exactly repeating 128-sample tail.

Verification with the actual full-render replay reached the grind at frame
3508 and observed it past its second wrap. At 44.1 kHz the engine supplied
`loopEnd = 1.3136281179138323`; five normal-rate periods matched with zero
sample error. Rates 0.3 and 1.15 also avoided the repeated render block. The
complete 93-command production build passed.
