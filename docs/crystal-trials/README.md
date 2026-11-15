# Numbered crystal challenges

25 increasingly demanding crystal retrievals form one straight corridor. Each source module can also be played independently. The challenge starts are 256 metres apart. A continuous flat floor catches ordinary falls; explicit death pits retain the consequences of missed pit crossings.

The design reference is [THPS research](../warehouse-flow/research-principles.md), alongside the measured movement rules in the [Gameplay Design Bible](../GAMEPLAY_DESIGN_BIBLE.md). The separate secret-tape reference has not been located.

| Number | Components |
|---|---|
| 1 | Bounce crate → airborne crystal. |
| 2 | Trampoline → high platform. |
| 3 | Long rail over a death pit → raised platform. |
| 4 | Moving platform → fixed island → lift → high platform. |
| 5 | Halfpipe pumps → high crystal. |
| 6 | Climbing rope → high framed platform. |
| 7 | Three timed steps → raised platform. |
| 8 | Switch → two raised steps → bounce crate → high platform. |
| 9 | Turtle shell → held bounce → double jump → high platform. |
| 10 | Spin-open bridge → timed crossing → small raised platform. |
| 11 | Three offset rails over a pit → raised platform. |
| 12 | Trampoline → airborne bounce crate → high platform. |
| 13 | Climbing rope → raised rest → second climbing rope → high platform. |
| 14 | Three timed steps → fixed rest → three timed steps → high platform. |
| 15 | TNT → enclosed switch → revealed steps and bounce crate → high platform. |
| 16 | Trampoline → bounce crate between Nitro → narrow high landing. |
| 17 | Three offset rails → retracting enemy → bounce crate → high platform. |
| 18 | Climbing rope → moving rest → second rope → high platform. |
| 19 | Six crumbling steps with a rest → bounce crate → high platform. |
| 20 | TNT switch → revealed steps and spring → second switch → upper spring. |
| 21 | Rail transfers → kickflip gate → retracting enemy → bounce crate. |
| 22 | Two climbing ropes → timed steps → bounce crate → high platform. |
| 23 | TNT → two revealed spring routes → climbing rope → high platform. |
| 24 | Rail transfers and trick gate → enemy → spring → rope → timed steps. |
| 25 | TNT and two switches → rope → six timed steps → Nitro-framed spring. |

**25/25 challenges validated locally.** Every challenge passes native and browser input routes and a full-resolution visual review. One uninterrupted run collects all 25 crystals, walks every connecting gap and recovery route, and finishes through the real exit. Publication and public-host download verification are pending. [Progress and evidence](progress.json).

The course has one exit after the last challenge, opened by all 25 crystals. Soft recovery keeps collected crystals; a fresh run clears them. These are practice rewards and do not alter campaign progress.

Rejected physical layouts remain in a separate playable archive with an open exit. The superseded eight-station grid is preserved as rejected layout 0. See the [rejects index](rejects/README.md).

The dedicated `challenge-playtest.html` entry provides touch controls, a numbered picker, individual playtests, the whole course, and the rejects. It excludes level-pack synchronization and the full-game offline installer. The final local production build transferred **36.4 MB** with caching disabled, including the whole 25-challenge course, all 25 rejected attempts, and the original eight-challenge grid. The initial picker transferred only **19 KB** before Play. Touch movement, pause, retry, and portrait/landscape layouts passed. See [phone transfer evidence](phone/smoke.json); public-host verification follows deployment. The ordinary development entry transferred 174.6 MB in the comparison test, including 67.0 MB of unrelated level data.

[The continuous 25-challenge run](course/native.json) records 185,005 physics steps through the corridor, including deliberate failure/recovery checks. `course-six/` and `course-ten/` preserve earlier assemblies.

Focused verification uses `node tools/test-crystal-trials.mjs NUMBER` for individual input routes, `node tools/test-crystal-trials-course.mjs 25` for the continuous course, and `CRYSTAL_TRIAL=NUMBER CRYSTAL_RENDER=full python tools/crystal-trials-browser.py` for full-render review. With a production server running, `CRYSTAL_PHONE_URL=URL python tools/test-challenge-phone.py` measures cold network transfer and touch/menu behavior. The phone controller routes are in `tools/crystal-trials-phone.py`.

Full-resolution visual fixtures are reviewed after a matching-source lite browser route passes. `CRYSTAL_FULL_ROUTE=1` additionally repeats the controller route in the full renderer; those longer passes are retained where already completed. Staged review views are labelled separately from actual traversal evidence.
