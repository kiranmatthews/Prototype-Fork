# Modern and Classic play modes

Open **Warp Room pause → Options → Play mode** and activate the row to switch.
The choice applies immediately, is remembered on this browser, and uses the
same `solProtoEndlessDeaths` preference as the debug menu. It is global across
save slots; a fresh browser defaults to Classic.

- **Modern:** the existing endless-deaths rules. Deaths replace the lives
  readout and never cause Game Over. The existing score penalty and fruit-for-
  score economy are retained.
- **Classic:** the existing lives/fruit economy and Game Over rules, including
  the playable zero-reserve-life attempt.

Changing the choice in the Warp Room does not reset position, inventory or
campaign progress. A course's pause options keep the choice unavailable, and
the runtime callback also rejects changes outside the hub. Debug playtests
retain their existing mid-course toggle/reset behavior. Bonus stages keep
their separate free-attempt economy. Replay rules are temporary and do not
overwrite the saved preference.
