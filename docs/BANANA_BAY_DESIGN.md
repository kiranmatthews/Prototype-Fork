# Banana Bay: research and level brief

27 October 2026. Scope: the existing Banana Bay campaign course (`beachfront`, progress key `beachside-run`) and Lifeguard Lockup bonus. This is an original arrangement of this prototype's existing assets and mechanics. Movement tuning is unchanged.

## Research actually consulted

The sources below were opened and read for this iteration. Developer statements and publisher documentation are distinguished from the design decisions inferred from them. No claim is made to have played or measured the commercial games during this work. The repository's earlier `PLATFORMER_PUZZLE_RESEARCH.md` was also consulted for its documented crate-dependency cases.

1. **Andy Gavin and Jason Rubin, Making Crash Bandicoot, part 4.** Their account describes building successful side-view factory gameplay before returning to a constrained jungle corridor. Rollers supplied timing decisions, patrolling creatures demanded attack or avoidance, and pits/logs required jumps. Later courses recombined established elements. Rubin emphasizes watching unfamiliar players rather than relying on the designer's own mastery. [Primary developer account](https://all-things-andy-gavin.com/2011/02/05/making-crash-bandicoot-part-4/)

   **Application:** give each coastal pier a readable job. A crab on open sand introduces its attack, then a crab near a gap combines combat and positioning. Keep the first broken deck above recoverable sand before asking for exposed water jumps. Automated traversal proves feasibility, but does not substitute for a novice usability session.

2. **Gavin and Rubin, part 5.** Crates filled empty travel between sparse enemy encounters. Their value came from interacting types: stacks, bounces, explosives and switches. Rubin's TNT/ordinary/TNT example describes a tempting reward whose small value still justified a carefully judged risk. [Primary developer account](https://all-things-andy-gavin.com/2011/02/06/making-crash-bandicoot-part-5/)

   **Application:** remove the arbitrary sparse beach scattering. Place paired consignments on loading decks, a wood cap above TNT with a clear retreat, a conspicuous life parcel above a conserved arrow, and safe cargo beside a hazardous Nitro pocket. Crates explain where to stand and what order to act in.

3. **Gavin and Rubin, part 6.** The original game deliberately used a guided camera for detailed action courses. Rubin discusses flaws in the first game's continue system and describes help for struggling players through protection and additional continues. [Primary developer account](https://all-things-andy-gavin.com/2011/02/07/making-crash-bandicoot-part-6/)

   **Application:** author a continuous ordered camera lane through all three acts. Put checkpoints at completed lessons and before the exposed finale, with masks at the first patrol, bonus rest cove and later transition. Use the existing checkpoint and protection systems; do not add a new difficulty engine.

4. **Taylor Kurosaki and Dan Tanguay, Stormy Ascent retrospective.** Kurosaki calls out his early difficulty-curve inexperience. Tanguay describes a much longer course with increasingly fast hazards, requiring both skill and endurance; the original was cut because there was insufficient time to make it easier. It reused Slippery Climb's assets for new challenges. [Primary developer interview](https://blog.playstation.com/2017/07/20/previously-unreleased-stormy-ascent-level-out-today-for-crash-bandicoot-n-sane-trilogy/)

   **Application:** length comes from a new salvage-lagoon act, not repeated empty boardwalks or faster movement physics. Preserve generous receiver decks and a checkpoint before each new finale mechanism. Reuse complete beach geometry and materials instead of introducing a separate visual theme.

5. **Activision, Crash 4 Bonus Areas.** Bonus areas are short puzzle-like sequences with their own crate/fruit collection. Failure returns the player to the entrance without consuming a Retro life. [Publisher documentation](https://support.activision.com/crash-bandicoot-4/articles/crash-bandicoot-4-its-about-time-bonus-areas)

   **Application:** retain Lifeguard Lockup's existing ordered puzzle and bonus lifecycle. Upgrade its environment without removing finite supports, local switch groups, return paths, TNT timing, or the real gaps that give the crates meaning.

6. **PlayStation's hands-on account of Crash 4.** It documents the continued importance of running, spinning and bouncing, readable landing shadows, side-view bonus puzzles, and checkpoint-based Modern play. [Publisher hands-on account](https://blog.playstation.com/2020/08/14/exploring-the-familiar-yet-evolved-platforming-of-crash-bandicoot-4-its-about-time/)

   **Application:** show takeoff, landing and high targets together. Keep the bonus's stable side camera and single play plane. Place enemy patrols beyond the initial landing zone so the player can see and respond to them.

7. **Airborn Studios, Crash 4 production breakdown.** The environment team describes receiving gameplay greyboxes from Toys for Bob and developing asset composition and finished environments around them. [Primary environment-production account](https://airborn-studios.com/projects/crash-bandicoot-4/)

   **Application:** the wharf floor must still match its gameplay footprint after dressing. Sandstone roots, garden shelves and distant stacks supply depth behind the play plane; they are decorative and do not create accidental routes through a puzzle gap. Existing high-resolution models are used at every distance.

8. **Kevin Kaw, Crash 4 portfolio.** A level designer describes combining classic mechanics with new twists, designing both 2D and 3D courses, and iterating with environment artists and engineering. [Primary level-designer portfolio](https://www.kevinkaw.com/games/crash4)

   **Application:** test combinations in this runtime rather than assuming Crash's jump distances transfer. Alternate broad combat courts, precision crossings and reward pauses, using established prototype primitives.

## Course composition

The starting course had 36 crates, no enemies, eight checkpoints and an approximately 1.13 km forward extent. Its beach boardwalks had been made continuous, leaving much of the 740 m coast without a platforming decision.

| Act | New purpose | Challenge and reward |
| --- | --- | --- |
| Coastal arrival | Learn combat and deliberate crate collection | Protection, lone crab, paired loading consignments, turtle |
| Split cargo pier | Learn measured takeoff and landing | Short gap above safe sand, landing reward, preserve an arrow to claim the visible high parcel |
| Fuse store and terraces | Separate tools and hazards | TNT/wood cargo with a clear opposite refuge; turtle beyond a generous receiver |
| Tide gates and bonus cove | Combine combat with a gap, then rest | Patrol before takeoff, clear landing, checkpoint and explicit bonus entrance |
| Palm balcony and broken jetty | Choose a safe line | Hazardous cargo on the seaward side, desirable cargo on the landward side; narrower crossing |
| Loose board lesson | Learn the warning before exposure | Timed deck over recoverable sand, receiver reward, checkpoint |
| Original lagoon | Apply the lessons on real water | Preserve its two ramp jumps and two rope crossings; add patrols and sorted cargo on broad islands |
| Salvage finale | Extend the course with three distinct tests | Rising/falling stepping piers, an aligning ferry, then a collapsing breakwater; checkpoints before each |
| Lifeguard finish | Pay off the cargo thread | Green Nitro-clear switch, final stacked supplies, crystal and finish gate |

Enemy patrols are bounded to their receiving surfaces. No enemy is placed directly at a blind landing. The first coastal gaps have sand underneath; deep-water hazards remain below visible water. Ordinary surface edges retain their default grinding policy. Sand shelf exceptions preserve the original shore convention.

## Bonus art and material contract

- The parent and bonus import the same sun, ambient/fill lighting, fog, painted sky and ocean look.
- Both use the existing `sunnycliff`, `sunnyhibiscus`, `baytrunk`, `baycrown`, `bayvine` and `jungleleaf` assets. No new runtime media or model files are needed.
- Permanent bonus floors become the parent's fitted `sunny-oak` woodpath decks with timber supports and rope rails. Switch-controlled surfaces retain their original groups and activation rules.
- Rear garden islands and more distant sandstone stacks provide depth without blocking the side camera's view of high crates. Scenery never replaces a required bridge collider.
- Review includes both normal presentation and MAX/native rendering, with console and failed-asset checks. No distance-based geometry replacement is introduced.

Validation results and exact replay coverage are recorded separately in `docs/banana-bay/VALIDATION.md`; the release handoff lists immutable commits and any limits of that evidence.
