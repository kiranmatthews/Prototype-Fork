# Touch release safety

D-pad and face-button ownership previously ended only on zone-local pointerup
or pointercancel. A release delivered elsewhere, lost capture, or an interrupted
page could therefore leave both gameplay intent and the highlighted button held.
Camera look already handled some of these interruptions; movement/buttons did not.

All controls now observe window capture-phase pointermove, pointerup,
pointercancel and lostpointercapture. Cleanup is per pointer, preserving other held fingers. Blur,
pagehide/pageshow, hidden visibility, orientation/viewport changes, graphics recovery and map/editor/modal/loading/tool transitions
discard held and pending touch intent. Old pointer moves cannot resurrect it.
Native touchend/touchcancel provides an independent partial-release fallback
through unique start-position association, with zero contacts as the fallback
when matching is ambiguous. Touch identifiers are never assumed to equal PointerEvent IDs. A new
primary touch releases stale ownership from the preceding touch sequence.

Normal lifts preserve short button taps, jump releases and intentional trigger
pulses between frames. Edges retain unique sequence owners, so cancellation and
reused Pointer IDs cannot erase another completed tap. Unread pulses survive a
frame stall until their first poll. Cancellation discards pending intent for the affected control. No hold
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
cancel/lost capture, native partial/zero-contact fallback, quick taps, ID reuse,
frame stalls, merged Input and lifecycle/mode/graphics changes. Chrome game checks
use actual three-contact input in portrait/landscape/full/lite. Native WebKit
checks use the production Input in a local-only harness. Physical iPhone and
Android interruption checks remain unverified (app switch, notifications, OS edge
gestures and resume). See [TOUCH_CONTROLS.md](TOUCH_CONTROLS.md) for scope and tools.
