# Quaternius boardless idle

`player.idle` uses the Source pack's `Idle_Loop`, with all 22 body-joint
rotation tracks and pelvis motion on the visual root. It uses the same
canonical retargeting as Walk and Run. All keys and playback speed are editable
in Animation Studio. The earlier procedural breathing drivers are retired.

The source idle contains two bobs in 2.5 seconds; Jog contains two in
0.9333333 seconds. At the approved Run speed of 1.6×, Idle defaults to
4.285714× so their full-cycle and beat durations agree. Migration derives the
speed from the saved Run when available. Subsequent user edits to Idle speed
are preserved.

The runtime chooses a compatible incoming phase and crossfades the whole
body over 0.26 seconds on stopping and 0.18 seconds on starting. The outgoing
loop continues during a normal fade, including its last Walk/Run mixture.
An interrupted fade starts from the last displayed mixed pose. Idle's
Character Lab upper-arm adjustment follows the same fade in both directions.
Board-mounted poses keep their existing gameplay route.

Catalog revision 26 upgrades saved Idle and backs up the old clip as
`player.idle.pre-quaternius`. The Run/Walk clips are not replaced. Deleted
Idle slots remain deleted. Only sampled keys ship; the source GLB does not.
