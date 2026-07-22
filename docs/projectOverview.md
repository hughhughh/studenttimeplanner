#First instructions

Use typescript for front and backend
Mongodb database
Resend for any emails
NextJS
Make everything customer facing
Build moduarly
Build securely



# Student Time Planner — Project Overview

A single reference for what this project is, what we want it to achieve, the rules that govern it, and the edge cases we need to get right.

**Product name (temporary):** Student Time Planner  
**Assessment context:** Year 12 Software Engineering — student study planner / calendar

---

## What problem are we solving?

Students are busy. A major reason work does not get done is the friction of starting and not knowing what to do next. Student Time Planner should:

- Tell students **what to do** and **when**
- Remove as much manual planning as possible
- Adapt when schedules change — missed tasks, overtime, new priorities, timetable changes
- Stay clean and low-friction so students actually use it

The core idea: **automate scheduling** so students follow a guide rather than planning from scratch every week.

---

## What we want to achieve

### The planner experience

Students should open the app and see a **week view** of their time — school, study, sport, homework, everything in one place. They should be able to:

- **Talk to the planner** in plain language (“add an hour of English study tonight”, “move school 30 minutes later on Wednesday”, “skip school next Monday”)
- **Upload their school timetable as an image** and have every subject block added automatically — correct days, times, and subject names, repeating each week, marked as fixed/immovable
- **Mark tasks done** with a single tap
- **Reschedule overdue work** when life gets in the way
- **Tap any item** to see or edit details in a modal
- Trust that the calendar **updates intelligently** when they ask the AI to change things

Adding schoolwork and life commitments should feel **effortless**. The less typing and clicking, the more likely a student is to keep using it.

### School timetable from an image

A key goal is letting students **photograph or upload their printed school timetable** instead of entering every subject by hand.

We want the system to:

- Read the timetable image and identify **each subject block** (name, day, start time, end time)
- Create **recurring weekly entries** for the whole term or year
- Mark school blocks as **fixed/immovable** by default — the AI should not shuffle them around unless the student explicitly asks
- Handle real-world timetable formats: different layouts, colours, abbreviations, rotating weeks, lunch breaks, free periods
- Let the student **review before confirming** if anything looks wrong — the image might be blurry, cropped, or use unfamiliar abbreviations

This should feel like: *“I took a photo of my timetable and my whole week appeared.”*

### AI as the primary input method

Most calendar changes should happen through **natural language or images**, not manual form-filling. The AI should be able to:

- Create tasks and activities
- Move, reschedule, and delete items
- Handle **bulk changes** (“push all school entries 15 minutes earlier”)
- Understand **complex recurrence** (“every weekday except next Monday”, “daily until July 1”)
- Split work across **multiple time blocks** (“do this 2-hour essay in two 1-hour sessions”)
- Choose sensible times when the student is vague (“fit an hour of English in today”)
- Reschedule around **fixed blocks** like school and sport

Direct UI edits are a **backup**, not the main path: complete tasks, delete items, reschedule overdue work, and edit details in a modal.

### Smart scheduling behaviour

The planner should understand the difference between:

| | Tasks | Activities |
|---|-------|------------|
| Examples | Homework, revision, assignments | School, sport, lunch, fixed commitments |
| Can be completed? | Yes — checkbox, turns green | No |
| Movable by default? | Usually yes, unless stated | **No** — fixed unless the student says otherwise |

When a task is **past due and incomplete**, it should stand out (orange) with an easy way to reschedule.

When a student **misses or overruns** work, the AI should help reorganise the rest of the week around what is still fixed.

### Recurrence and exceptions

Students think in natural patterns, not database rules. We want to support:

- “School every weekday 8:30–3:00”
- “Football training every Thursday 5–6:30”
- “Revision daily at 7pm, except Saturday”
- “Skip school next Monday” / “no school for the next two weeks”
- “Weekly essay planning on Sunday until September”

The system must handle **exceptions cleanly** — skipping one week of a repeating item should not break the whole series or leave duplicates behind.

### Split sessions

A single piece of work (e.g. a 2-hour essay) should be schedulable across **non-contiguous blocks** (1 hour now, 1 hour later) without showing up as two separate items in the calendar. One item, multiple time slots.

### Accounts and privacy

Every student has their own calendar. No one should see or change another person's schedule. Sign-in should be simple — email code or Google — with no passwords to remember.

### Look and feel

- **Clean, modern, minimal** — easy to read at a glance
- **60% white, 30% black/near-black, 10% accent green (`#66AA3C`)**
- **Week view first** — Monday through Sunday, time running top to bottom within working hours (default 6am–10pm, user-configurable)
- **Today highlighted** with a live time indicator
- **Responsive** — usable on phone and laptop
- **Room for more views later** — week view is v1, but the layout should not lock us in

---

## Getting AI input right — edge cases

This is one of the **biggest challenges** in the project. Natural language and image input are flexible, but the database needs **precise, consistent data**. Every gap between what a student says and what gets stored is a bug waiting to happen.

We need to sort out all of these:

### Ambiguous or incomplete input

- Vague times: “around 7”, “this afternoon”, “tonight”
- Missing details: “add school” with no times given
- Invalid input: “school from x-y”, nonsense times, negative durations
- Conflicting instructions: “move school earlier” when there are multiple school blocks

**Goal:** interpret sensibly when possible; ask for clarification or reject cleanly when not.

### Timetable image edge cases

- Blurry, rotated, or partially cropped photos
- Handwritten or low-contrast timetables
- Subject abbreviations the AI does not recognise (e.g. “Eng”, “Mth”, “PDHPE”)
- Different period lengths on different days
- Week A / Week B rotating timetables (Day 1–10 cycle: Mon–Fri Week A, then Mon–Fri Week B)
- Study periods / study lines — fixed blocks where the student can do their own work; AI should prefer these for same-day homework
- Free periods, lunch breaks, and assembly blocks mixed in with lessons
- Timetables that span two pages or use non-standard layouts
- Wrong or hallucinated subjects if the image is unreadable

**Goal:** extract what is clearly readable; flag uncertainty; never silently invent a full timetable from a bad image.

### Time and date edge cases

- Times outside working hours (5am gym, 10pm study)
- Items scheduled in the **past** when the student says “today” or “tonight” after that time has passed
- Timezone confusion — everything should respect **Australia/Sydney** unless the user sets otherwise
- Day boundary issues: “tonight” at 11pm vs “tomorrow morning”
- Daylight saving transitions

### Recurrence edge cases

- “Every weekday” vs “every day” vs “weekly on Tuesday” — all different patterns
- Skipping one occurrence without deleting the whole series
- “No school for two weeks” — cancel a range, not just one day
- End dates: “until September 30” vs open-ended repetition
- Creating duplicates when the user re-asks for something that already exists (“add school weekdays 8:30–3” twice)

### Movable vs immovable edge cases

- School and fixed commitments must **not** be moved when the AI reschedules study around them
- Student says “movable” for something that should be fixed, or vice versa
- Bulk moves that accidentally shift immovable blocks
- AI tries to “fit something in” by overlapping a fixed school period

### Modify and delete edge cases

- “Delete gym on Tuesday” when there are multiple gym entries or none
- “Remove Friday's assembly” — delete one occurrence, not the whole series
- “Remove all school entries for two weeks” — range delete on a recurring series
- Moving an item to a time that **conflicts** with something else
- Updating colour or title on a series vs a single occurrence

### Duration and split-session edge cases

- Stated duration does not match stated time range (“1 hour” but 8:30–10:00)
- Splitting one task into segments that do not add up to the total duration
- Overlapping segments within the same item

### Completion edge cases

- Marking an activity as complete (should not be allowed — only tasks)
- “Mark all completed tasks as incomplete”
- Completing something that is already in the past vs still upcoming

### Bulk and natural-language edge cases

- “Push all weekday school entries 15 minutes earlier” — must find the right items, not everything
- “I've got school Monday to Friday, 8:30 till 3, make it orange” — create five days, one colour, immovable
- “Can you put an hour of study in for me tonight around 7?” — find a free slot near 7pm
- “I need to catch up on English, fit an hour in today” — find any free hour left today

### Data integrity edge cases

- AI proposes something that would create **duplicate** entries
- AI references an occurrence or series **id that does not exist**
- Partial failure — some ops succeed, others fail; calendar must not end up in a broken state
- Malformed AI output (bad JSON, wrong field names, missing required fields)

**Goal:** validate everything before it hits the database. Reject bad data rather than store it. The calendar should never be left half-updated or inconsistent.

---

## Product rules (non-negotiable behaviour)

These are the rules the product must always respect:

1. **Activities default to immovable.** School, sport, and fixed commitments stay put unless the student explicitly says they can move.
2. **Only tasks can be completed.** Activities have no checkbox.
3. **One card per scheduled item**, even if it spans multiple time blocks.
4. **Repeating items show a repeat icon.** Exceptions (skipped days) should not leave orphan duplicates.
5. **Overdue incomplete tasks are orange** with a reschedule option.
6. **Completed tasks turn green** and lose the delete button.
7. **The AI must not move immovable items** when making room for something else.
8. **Each user's data is private** — no cross-account access.
9. **No secrets in the repo** — API keys and credentials stay in environment config only.

---

## Things to look out for

### When testing AI input

Use varied phrasing, not just perfect commands. Test cases live in `docs/calendarQueryTestCases.md`. Always test:

- Perfectly structured requests and messy natural language side by side
- Re-adding something that already exists
- Bulk operations that touch immovable items
- Recurrence with exceptions
- Timetable images of varying quality (when built)

### When reviewing the calendar

- Do immovable blocks stay fixed after AI rescheduling?
- Are duplicates created when the user repeats a request?
- Does skipping one week of school leave the rest intact?
- Do split sessions show as one item, not two?
- Are overdue tasks visually obvious?

# Rough UI layout
Vertical rectangular cards that hold each days tasks and activities, staring from Monday on the left, having the five weekday cards, a slightly larger gap and then the two weekend cards. Each card contains it's tasks for the day, and is structured with the start of the day at the top, and is spaced depending on time. Time is consistent for the week, but only shows working hours, which can be decided by the user. For example, if working hours start at 6am, the first task which takes one hour may show at 6, and has the height of one hour, then there may be a 2 hour gap before the next task. Above each cards is the first three letters of the day of week and then the day of the month. The day of the week it is, is highlighted, previous days are slightly greyed out. On todays date, there is a red bar, which has the time in a circle that sits in the middle, the bar shows sits at the height of the time in the day it is, for example, if it is 12pm, it sits at the 12pm height. Tasks are displayed as cards in the day cards. On the left, there is a circle, which can be ticked, and the task will turn green. On the right of the circle, task information shows. For non-task items, called, "activities", there is no circle to press. On the right there is an X to delete task, the X does not show up for completed tasks. Below the 7 day cards, there is a centre aligned bar, with placeholder text "add tasks, edit calendar…" this is where the user tells the system to input information. If a task is in the past, but not completed, it should show as orange, and a button to reschedule. On repeating tasks or activities, there should be a repeating icon. When clicking on a task/activity card, it should bring up a modal with more information, and the ability to edit. 

This page should be the root, landing page can be /landing or /home