# Cleaning tiers

CleanQuest suggests a reset before detail work. The rule is per room, unless several rooms on one floor are marked as one open space. It is computed from tasks and completion history. It does not delete quests, rewrite a locked weekly reward, or block the rest of the home.

Constants live in `src/domain/tiers.ts`:

| Constant           | Value | Meaning                                                                                          |
| ------------------ | ----- | ------------------------------------------------------------------------------------------------ |
| `TIER_WINDOW_DAYS` | 7     | How far back a streak is counted, including today.                                               |
| `TIER_UNLOCK_DAYS` | 4     | Distinct days in that window on which the previous tier was done before the next tier may appear. |
| `TIER_FREQUENT_INTERVAL_DAYS` | 2 | A task is "frequent" when it repeats every this many days or sooner. Only frequent tasks create the 4-day bar. |

## Tiers

1. **Základ** — reset the room so it looks tidy at a glance: dishes, a clear sink, the kitchen counter, big clutter, bins, starting or hanging laundry, the toilet bowl, a quick floor clear. Dishes and loading the dishwasher are created only for a kitchen sink or a kitchen dishwasher. A sink in the living room or bathroom does not get them.
2. **Čisté** — regular cleaning of surfaces, floors and the bathroom.
3. **Detaily a organizácia** — plugs, strainers, tap details, sorting shelves and drawers, and nicer upkeep.

Every template has a `tier`. A stored task may omit it; the same title and template id decide the tier, and anything unrecognized stays tier 2. Database version 6 backfills `tier` and adds any missing tier-1 reset tasks for objects that already exist. Completions, rewards and locked weeks are left as they were.

## When a higher tier is suggested

For one room, on one day:

- Tier 1 is always allowed.
- Tier 2 is allowed when a **frequent** tier-1 task was completed on at least 4 distinct days in the last 7, **or** the room has no frequent tier-1 task.
- Tier 3 is allowed only when that tier-1 bar still holds **and** a frequent tier-2 task was completed on at least 4 of those 7 days (or the room has no frequent tier-2 task).
- Frequent means the task repeats every day or every other day (`unit: day` and interval at most 2). A weekly or rarer reset cannot happen four times in one week, so it does not create that bar. It still comes first on a day it is due.
- A day counts when that room has at least one completion of that tier which was not undone. The task must still exist; a deleted task cannot be classified. Today is included.
- Even after the streak is open, a higher tier stays out of **today** while a due tier-1 task for that room is still unfinished. **Základ máme** marks that room's basics fine for today only. It does not count as doing the work, does not fill the streak, and does not turn **Ťažký deň** off. Remaining basics in that room step aside. The next suggested step is another room's basic while Ťažký deň is on, or the next level for that room when it is off and the streak allows it.
- Skipping or postponing a basic does not hide other basics. It also does not release that room's details.
- **Ťažký deň** is one switch (záchranný režim). Áno shows only tier 1. It does not erase the streak or the saved plan. Nie brings the other tiers back under the same rules. The home indicator stays on Základ while the switch is áno.
- Within a day, every tier-1 task comes before tier 2 and tier 3. Equal tasks prefer the higher hygiene priority, then the lower floor (`floor.order`, so Prízemie is 0), then a shorter step.
- If the basics slip under 4 of 7, higher tiers simply stop being offered. The hint does not say the week failed.

The home screen says how many of the last 7 days counted, for example "Základ ti ide už 4 dni, pomaly pridáme ďalšie." A task added from the library or the full task form can still be completed by hand. The ladder only changes what the plan suggests.

A quick task is tier 1 and one-off unless **Nechať aj ako opakovanú úlohu** is checked. "Idem to spraviť teraz" pins it to the front of today and opens focus. "Už mám hotové" writes a normal manual completion for today, with the usual DA, and does not put it on the plan. Neither path adds a weekly reward obligation. The rewarded manual time limit still applies to "Už mám hotové".

New weeks are filled with this order. A week that was already locked is not rebuilt. Details that were saved in it stay there, but they are hidden while the room's gate is closed. A basic that was not in the week can be added to today, up to the visible time budget. A higher tier is added to today only after a basic was completed or **Základ máme** was chosen today, and only when the streak allows it.

The home card shows Základ → Čisté → Detaily for the task on screen. The current step is accented and marked `aria-current`. Earlier steps show a check. Later steps stay dashed. Ťažký deň keeps the current step on Základ. On a shared space the home hint uses the quietest room, so one tidy kitchen does not look like the whole floor is ready.

## Open-plan zones

A room can be marked **Spojený priestor (otvorená kuchyňa, obývačka…)**. Every enabled room on the same floor with that mark shares one gate. The overview names it `{floor name} – otvorený priestor`, for example `Prízemie – otvorený priestor`. The mark is an optional `room.openPlan` flag. There is no zone table. Rooms without the mark, rooms on another floor, and paused rooms keep today's own gate. One marked room is a zone of one and behaves as a single room. Copying a room clears the mark, so the copy does not join the space with an empty history.

For rooms in a zone:

- The 7-day count is the smallest count among member rooms that have a frequent task of that tier.
- Tier 2 unlocks only when every member with a frequent tier-1 task has 4 of the last 7 days. Tier 3 also needs every member with a frequent tier-2 task to meet that bar, and the tier-1 bar still holds. A room with no frequent task of that tier does not raise the bar.
- Today, a higher tier stays hidden while any due tier-1 task in any room of the zone is unfinished.
- **Základ máme** in any room of the zone marks the whole zone for today. It still does not fill the streak and does not turn **Ťažký deň** off.

**Prehľad úrovní** on Úlohy → Miestnosti shows the current level (Základ, Čisté, or Detaily), `Základ X/7 dní`, and each basic task as hotové, dnes čaká, or dnes netreba. Detaily appears only when a tier-3 task exists and both bars are met. The words carry the meaning. Nothing says the week failed.

Database version 7 adds no indexes and does not rewrite rows. `room.openPlan` is optional. Backup schema stays 2, so an older backup still imports and a new backup round-trips the mark.
