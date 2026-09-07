# Touch release safety

D-pad and face-button ownership previously ended only on zone-local pointerup
or pointercancel. A release delivered elsewhere, lost capture, or an interrupted
page could therefore leave both gameplay intent and the highlighted button held.
Camera look already handled some of these interruptions; movement/buttons did not.

All controls now observe window capture-phase pointerup, pointercancel and
lostpointercapture. Cleanup is per pointer, preserving other held fingers. Blur,
pagehide, hidden visibility, orientation changes, map/editor/modal transitions
discard held and pending touch intent. Old pointer moves cannot resurrect it.
Native touchend/touchcancel with zero remaining contacts provides an independent
fallback; Touch identifiers are never assumed to equal PointerEvent IDs. A new
primary touch releases stale ownership from the preceding touch sequence.

Normal lifts preserve short button taps and intentional swipe pulses between
frames. Cancellation discards pending intent for the affected control. No hold
timeout or movement retuning was introduced: long direction/grind holds remain valid.

The three supplied legacy replays contain simulation axes/button masks, not DOM
pointer IDs, finger contacts, capture state or app lifecycle events. They cannot
establish which browser release event was missed. We did not reinterpret the
recorded holds as physical-finger evidence or alter replay playback.

Relevant primary references: [Pointer Events lifecycle and capture](https://www.w3.org/TR/pointerevents3/)
and [WebKit's historical iOS capture/outside-element release report](https://bugs.webkit.org/show_bug.cgi?id=220196).
The historical report is motivation for defensive routing, not a claim that the
same WebKit defect caused these particular recordings.

Validation: test-touch-release.mjs exercises capture failure, per-finger release,
cancel/lost capture, native zero-contact fallback, quick taps, lifecycle and mode
changes. Chrome mobile-browser checks use actual two-contact input plus injected
interruption sequences in portrait/landscape/full/lite. No physical iOS device or
installed WebKit automation runtime was available; actual iPhone interruption
testing remains useful (Safari app switch, Notification Centre, rotation, resume).
