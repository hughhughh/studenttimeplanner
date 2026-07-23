# Calendar AI — Test Cases

Test prompts for the natural-language command bar (`POST /api/ai`) and the
timetable image import (`POST /api/timetable`). Each case lists the input, the
expected behaviour, and what to verify in the week view afterwards.

The golden rule under test: **the AI never writes invalid, duplicate, or
half-applied data.** Every batch of operations is validated in full before
anything is written; if any operation is bad, nothing is saved.

> Tip: with no `RESEND_API_KEY` set, sign in via "Continue as demo" and run
> `npm run seed` first so there is existing data to reference.

---

## 1. Clean, well-structured requests

| # | Prompt | Expected |
|---|--------|----------|
| 1.1 | "Add an hour of English study tonight at 7pm" | One task today 19:00–20:00, green, movable. |
| 1.2 | "I've got school Monday to Friday 8:30 till 3, make it orange" | One recurring activity, weekdays 1–5, 08:30–15:00, fixed, orange. |
| 1.3 | "Football training every Thursday 5 to 6:30pm" | Weekly activity on Thursday 17:00–18:30, fixed. |
| 1.4 | "Revision daily at 7pm except Saturday" | Daily recurring task 19:00, Saturdays excluded. |
| 1.5 | "Do my 2-hour history essay in two 1-hour sessions this week" | ONE task with two segments (split session), shown as one card across two blocks. |

## 2. Ambiguous / vague input (interpret sensibly or clarify)

| # | Prompt | Expected |
|---|--------|----------|
| 2.1 | "Put an hour of study in tonight around 7" | Picks ~19:00 today; mentions the chosen time in the summary. |
| 2.2 | "Fit an hour of English in today" | Finds a free hour today; prefers an upcoming study period if one exists; if none in working hours, clarifies. |
| 2.3 | "Add school" (no times) | Clarification asking for days/times — nothing created. |
| 2.4 | "this afternoon" / "tonight" at 11pm | Resolves to a sensible same-day or next-day slot; respects day boundary. |

## 3. Invalid input (reject cleanly, write nothing)

| # | Prompt | Expected |
|---|--------|----------|
| 3.1 | "School from x to y" | Clarification / error; no item created. |
| 3.2 | "Add study from 10pm to 9pm" | Rejected (end before start) by the item schema; nothing saved. |
| 3.3 | "Add a -30 minute task" | Rejected; nothing saved. |

## 4. Duplicates (re-asking for something that exists)

| # | Prompt | Expected |
|---|--------|----------|
| 4.1 | Run 1.2 twice | Second run creates nothing; summary notes it already existed. |
| 4.2 | "Add school weekdays 8:30–3" when school already exists | No duplicate series; signature match skips creation. |

## 5. Recurrence + exceptions

| # | Prompt | Expected |
|---|--------|----------|
| 5.1 | "Skip school next Monday" | Single exception added to the school series; the rest of the series is intact, no orphan items. |
| 5.2 | "No school for the next two weeks" | `skipRange` adds exceptions across the date span only. |
| 5.3 | "Weekly essay planning on Sunday until September" | Weekly recurrence with an `endDate`. |
| 5.4 | "Move school 30 minutes later on Wednesday" | Per-occurrence override on that Wednesday only; other days unchanged (scope = occurrence). |

## 6. Movable vs immovable (the AI must not move fixed items)

| # | Prompt | Expected |
|---|--------|----------|
| 6.1 | "Fit study in around school today" | Study is placed in free time; school (fixed) is NOT moved. |
| 6.4 | "Do maths homework today" (with study periods on calendar) | Task scheduled in next study period today, not after school. |
| 6.2 | "Push all weekday school entries 15 minutes earlier" | Explicit bulk move: school shifts −15 min only because `explicit` is set (user named it). |
| 6.3 | "Move things around to make room for an hour of maths" | Only movable items shift; fixed activities stay put. |

## 7. Modify & delete

| # | Prompt | Expected |
|---|--------|----------|
| 7.1 | "Delete gym on Tuesday" when there are 0 or 2 gyms | Clarification / error (ambiguous or missing reference); nothing deleted. |
| 7.2 | "Remove Friday's assembly" | One occurrence skipped, not the whole series. |
| 7.3 | "Remove all school entries for two weeks" | Range delete via exceptions; series remains. |
| 7.4 | "Rename revision to study and make it blue" | `updateItem` changes title + colour on the series. |

## 8. Completion

| # | Prompt | Expected |
|---|--------|----------|
| 8.1 | "Mark today's revision done" | Recurring task completion stored as a per-day override; turns green. |
| 8.2 | "Complete the football training" | Rejected — activities can't be completed. |
| 8.3 | "Mark the English essay as not done" | Toggles completion off. |

## 9. Bulk & natural language

| # | Prompt | Expected |
|---|--------|----------|
| 9.1 | "Push all weekday school entries 15 minutes earlier" | Correct items only; non-school untouched. |
| 9.2 | "I've got school Mon–Fri 8:30–3, make it orange" | Five days, one colour, one immovable series. |

## 10. Timetable image (review before commit)

| # | Image | Expected |
|---|-------|----------|
| 10.1 | Clear printed timetable | Subjects extracted as fixed weekly activities; review modal lists each; nothing saved until "Add to calendar". |
| 10.2 | Blurry / cropped photo | Readable blocks extracted; warnings flag uncertainty; user can deselect bad rows. |
| 10.3 | Week A / Week B rotating (Day 1–10 or labelled) | Both weeks extracted from the one photo as fortnightly entries (interval=2); study periods included with schedulingRole. |
| 10.4 | Timetable with study lines / study periods | Study blocks extracted as fixed activities marked study_period, not ignored as free time. |
| 10.5 | Not a timetable / unreadable | Empty subjects + a clear warning; nothing invented. |

## 11. Data integrity (must never half-apply)

| # | Scenario | Expected |
|---|----------|----------|
| 11.1 | A batch where one op is valid and one is invalid | Whole batch rejected; the valid op is NOT written. |
| 11.2 | Operation references a non-existent item id | Error; no writes. |
| 11.3 | Malformed model output (bad JSON / wrong fields) | Caught; user sees a "couldn't understand" clarification; no writes. |

## 12. Known failed / tricky prompts (regression log)

Prompts that previously failed in real use. Re-test after fixes; keep adding new failures here.

| # | Prompt | What went wrong | Expected after fix |
|---|--------|-----------------|--------------------|
| 12.1 | "make … on the 1st of august be like 4 hours" (named existing item) | Model returned `updateItem` with duration fields; apply only accepted title/colour/notes → **"Nothing to update on that item."** | `updateItem` with `minutes: 240` (or timeEnd) resizes that date’s block to 4 hours from its start; summary confirms. |
| 12.2 | "move maths revision an hour forward" | Model sent `moveItem`/`updateItem` with only a new `timeStart`; end stayed put → block got longer/shorter instead of shifting. | Whole block shifts by 60 minutes (same duration). Prefer `moveItem` with `minutes: 60`, or both `timeStart` + `timeEnd`. Apply preserves duration on `moveItem` if only one endpoint is sent. |
| 12.3 | "move assemblies to start at 12pm always" (was 11:55) | Model sent a non-`HH:mm` time (e.g. `12pm`) and/or a bad end; updates skipped Zod → invalid times stored → Luxon `Invalid DateTime` → `NaN` CSS `top`. | `updateItem` + `scope=series` + `timeStart` only (keep end). Times normalized to `HH:mm`; bad times rejected; grid skips invalid ISO. |
| 12.4 | "add assembly every friday from 11:55am to 12:50pm" | Model omitted `timeEnd` / sent nulls / thinking lag; later returned **ok with no ops** so nothing was written (or duplicate skipped quietly). | Message-time override; null coercion; thinking off; **NL fallback create** when model returns empty ops; clearer duplicate summary; session AI log under command bar (click to copy). |
| 12.5 | "move assembly to start at 12 every week" | Model ops missing `type` → Zod reject → misleading “rephrase”. | `repairAiResponse` infers `updateItem` from shape. |
| 12.6 | "make all the instances of software be purple" | Model sent **hallucinated/stale itemIds**; first missing id aborted whole batch → "That item no longer exists" even though Software Engineering is on the calendar. | Bulk colour resolved by **title match** on live items; missing ids soft-skipped. |
