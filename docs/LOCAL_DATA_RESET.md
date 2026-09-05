# Reset local game data

Press **M** to expose debug controls, open the left **MENU**, then choose
**RESET LOCAL GAME DATA…** under **DEBUG**. The standalone reset screen also
works at `reset-local-data.html` if a corrupt saved value prevents game startup.

Opening the screen does not reset anything. Tick the confirmation and press
**Reset local game data**, then **Return to game**. The reset screen unloads
the game first, preventing its autosaves and cached in-memory values from
recreating stale data. Other updated game tabs move to that same idle reset
screen when they receive the reset signal.

The action clears this fork's `solProto*` local/session settings, save slots,
progress, time-trial records, local custom levels and editor data, plus records
in `solProtoAnimation.animationDrafts`. Fork-prefixed Cache Storage entries and
service workers scoped to this application's URL are removed when present.
It does not erase the browser's entire HTTP cache, unrelated origin data,
published/cloud levels, local files, or `solProtoGHToken`.

A single durable backup per site is written to
`solProtoResetRecoveryV1.recovery` before anything is cleared. **Undo last
reset** restores those local/session entries and animation records. It never
copies the sync credential. A failed backup prevents deletion; a partial reset
failure retains the backup and reports the error instead of claiming success.

Older puff/swirl/water/field drafts used unprefixed keys that may be shared
with the original prototype on the same GitHub Pages origin. These are not
deleted. Studios now save under fork-prefixed keys, and a reset marker disables
legacy fallback so those old drafts cannot silently restore stale values.

Fresh game startup can create a few default bookkeeping entries and fetch the
published level pack again. That is expected; old saved overrides, campaign
slots and animation drafts must remain absent. The completion receipt is
available in the reset screen's status element and `solProtoLocalDataResetReceipt`
in session storage. Neither contains saved values or credentials.
