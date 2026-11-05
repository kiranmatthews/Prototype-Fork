# D board study — rolled back

On 5 November 2026 the user rejected the board mount work and requested the
version before the 3:58am update. The runtime and review tools are restored
exactly to `d70a6f6d743cfd1b7b28906a85fb3a09037655d0` (12:45am NZDT), the
parent of the first board-handling commit at 3:56am NZDT.

The carry, placement, pickup, kick-push, spin-masked swaps and later mount-load
experiments are removed. Earlier D jump/roll, run, idle, ledge and live-tuning
work remains. No new animation behavior is introduced by this rollback.

Historical experiment commits and the append-only iteration log remain for
recovery. Their technical test passes did not establish acceptable visual
quality or reliable triggering for the user. Do not reintroduce those rejected
changes without a new request.

Everything remains local. Do not integrate, push or publish this exploration.
