# Motu Beach Invitational · 14 November 2026

Reviewed the sixth playable campaign course. Its existing crate and enemy selection is appropriate: **zero crates, zero patrol enemies, zero checkpoints, and no bonus room**. No level data or runtime code changed.

This is a judged skating competition with three timed runs and a best-two result. It has no exit gate, crystal, time-trial pickup, combo orb or all-box goal. The source and existing regressions deliberately exclude adventure-course furniture. The bible's crate audit also explicitly skips it as a “skate competition (judged trick runs, no platforming route).” That exclusion is recorded in [the audit](audit.json); it is not a claim that the audit measured an empty platforming course.

Applying the bible's named-job and fast-line rules means preserving the clear approach, landing and connecting lanes. Scattered crates would add incidental trip/smash checks to a scoring arena. Patrol enemies would interrupt combinations without serving a taught combat route. Cluster-size and checkpoint crate quotas are therefore inapplicable here. The existing bowls, banks, stairs, manuals and rails provide the decisions; no new reward or combat layer is added.

The focused native checks cover exact competition timing and judging, campaign cup progression, supported spawn and dense floor coverage, containment, actual rail scoring, bail/death accounting, editor round trips, four pocket airs, connected skating paths and 38 rail catches. Browser checks cover starting the real event, a keyboard charge/ollie/landing, a counted bail with automatic board recovery and unchanged lives, and full-render park views with clean consoles.

The production build and global level checks from the immediately preceding Beach Street commit remain valid because this review changes only documentation. They are recorded alongside the fresh focused checks in [validation](validation.json). No full competition playthrough is claimed for the browser; full win/loss and progression checks run in the native suite.

Views: [competition introduction](full-intro.jpg), [start and circulation](full-start.jpg), [rhythm lane](full-rhythm.jpg), [pocket bowl](full-pocket.jpg), [lite skating](lite-skating.jpg).
