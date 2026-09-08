# Jungle Cup competition layout

The park keeps the approved skating model, 120 × 172 m foundation and continuous 4.4 m vert perimeter. The interior is organized into connected sessions with different shapes, heights and ways to link tricks.

## References studied

The illustrated [THPS2 guide](https://smetisteher.cz/manualy/proskater2_manual.pdf), pages 35 and 54–55, describes and illustrates Marseille and Skate Street. Marseille combines bowls and their continuous coping with quarter-pipe channels and a street area. Skate Street puts its halfpipe and bowl within transfer distance and connects them to a wave wall, gully, low channel and central street risers. Both descriptions emphasize changing between airs, manuals and grinds along a route. The [original THPS2 manual](https://www.gamesdatabase.org/Media/SYSTEM/Nintendo_N64/manual/Formated/Tony_Hawk-s_Pro_Skater_2_-_2001_-_Activision.pdf) also illustrates the reusable park vocabulary: pools, risers, stairs, rails, kickers and roll-ins.

This is an original jungle park using those layout principles. No game geometry, artwork or level data was imported.

## Sessions and connections

| Area | Height | Role |
| --- | --- | --- |
| Perimeter bowl | 4.4 m | Continuous true-vert session and long coping circuit |
| Jade pocket bowl | 2.08 m rim | Smaller banked bowl with a 0.9 m divider for transfers and two pockets |
| Temple four-step plaza | 1 m | Stair handrail, a flat manual deck, wide side banks and a banked return |
| Sun terrace | 0.5 m | Low manual pad with a curved ledge near the start |
| Sun wheel | 1.4 m | Round hip and crescent rail between the temple box and east lane |
| East rhythm lane | 0.7 / 1.15 / 0.9 m | Rounded rollers and two curved rail connections |
| Existing street islands | 0.6–2.4 m | Temple funbox, manual island and north transfer island |
| Banked channels | Below 0.5 m | Sun terrace to round hip, and temple box to pocket bowl |

The perimeter circulation lane stays open. The new bowl has a continuous outside bank rather than exposed vertical backs. It uses broader 65-degree transitions so entering from its deck is a smooth roll-in; the existing perimeter remains the dedicated 90-degree vert area. The stairs can also be approached via side banks, and the round hip and rollers meet the floor on every side.

The original five street rails remain in place. Added bowl coping, spine coping, stair handrail, terrace ledge, crescent and rhythm rails bring the park to 13 grind lines. Floor inlays and different concrete colors distinguish the sessions without placing solid props in the landing areas.

## Sky and toolkit

The previous 290 m draw distance clipped the 370 m painted sky dome. The level now explicitly selects the sky backdrop, uses a 520 m draw distance, and has a lighter distant haze.

The new authoring field is `vertramp.outerBank`, the horizontal run of a bank from the outside deck to the base. It belongs to the existing swept mesh, so the bowl and its outside approach share their vertices. Import validation, scaling and the editor inspector preserve it. An absent value retains the existing geometry. Generated coping rails now retain their identity, so riding across a flush lip does not trigger a street-rail trip. Freestanding bars keep their collision, and restarting clears the previous landing grace.

## Validation

The layout regression checks actual collision heights, foundation coverage, clear connecting lanes, nondegenerate authored meshes, outside-bank import/export, four pocket airs, outside-to-bowl travel, round-hip traversal and catches on every new rail in both directions. The existing perimeter tests start in the perimeter approach lane, outside the new pocket bowl, and retain their flight, contact and camera expectations. The original five straight rail fixtures remain isolated from the new curved rail tests.

The first automated pass completed while the Mac was locked. Full browser review then exposed a flush-coping trip beyond the short entry test; the regression now traverses the whole bowl from a fresh run and checks that ordinary street bars still trip. The complete bowl-to-perimeter line passes without a bail.

Final lite/full browser review confirmed the overall layout, restored painted sky, complete pocket-to-perimeter route, stair handrail and landing, rhythm jump/grind/landing, round-hip jump and camera visibility, without console errors. The full production build and automated suites passed after the coping correction.
