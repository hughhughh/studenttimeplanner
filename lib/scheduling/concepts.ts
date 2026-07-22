/**
 * Scheduling concepts the AI should understand when placing tasks.
 * Included in system prompts so behaviour stays consistent across routes.
 */

export const STUDY_PERIOD_CONCEPT = `STUDY PERIODS
- A "study period" (also called study line, study block, or private study) is a fixed school activity where the student is free to do their own work.
- Study periods appear on the calendar as fixed activities with schedulingRole=study_period.
- They are NOT empty free time — they are labelled blocks the student can use for homework, revision, or catching up.
- When scheduling a task for today (or "tonight" when it is still during the school day), PREFER the next upcoming study period today over after-school or evening slots.
- Example: "do maths homework today" → place it in the student's next study period today if one exists and fits the duration; only use after-school/evening if no study period is available or the work is too long.
- Do not move or delete study periods when fitting tasks in — schedule tasks into the free time within those blocks conceptually (the task sits alongside, not replacing, the study period activity).`;

export const WEEK_CYCLE_CONCEPT = `WEEK A / WEEK B TIMETABLES
- Some schools run a two-week cycle: Week A (days 1–5 = Mon–Fri) and Week B (days 6–10 = Mon–Fri).
- Classes on Day 1 and Day 6 are both Monday but on alternating weeks.
- Recurring items from a rotating timetable use interval=2 (fortnightly) with a startDate anchored to the correct cycle week.
- When the student refers to "Week A" or "Week B", respect which week is which in the current fortnight.`;
