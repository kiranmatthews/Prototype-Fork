# Modern and Classic play modes

Choose **Options** directly from the Island World Map and activate **Play mode**
to switch.
The choice applies immediately, is remembered on this browser, and uses the
same `solProtoEndlessDeaths` preference as the debug menu. It is global across
save slots; a fresh browser defaults to Classic.

- **Modern:** deaths replace the lives readout and never cause Game Over.
  Life pickups, life crates and every 100 fruit remove one death, stopping at
  zero. Fruit still earns face-value score and deaths still halve score.
  Unspent fruit survives a death.
- **Classic:** the existing lives/fruit economy and Game Over rules, including
  the playable zero-reserve-life attempt.

Changing the choice on the Island World Map does not reset position, inventory or
campaign progress. A course's pause options keep the choice unavailable, and
the runtime callback also rejects changes outside the hub. Debug playtests
retain their existing mid-course toggle/reset behavior. Bonus stages keep
their separate free-attempt economy. Replay rules are temporary and do not
overwrite the saved preference.

Completed bonus rewards are banked before returning to the parent level, then
presented directly in its HUD: fruit flies to the fruit counter with pickup
sounds, and life awards count up (or remove Modern deaths) with the life sound.
There is no completion title or subtitle. The parent death count is restored
before applying rewards; interrupted cosmetic flights cannot lose or duplicate
banked inventory.
