import { describe, expect, it } from "vitest";
import {
  durationMinutesFromMessage,
  findNextFreeSlot,
  intervalsOverlapSlot,
  messageSpecifiesClockTime,
  summarizeFreeSlots,
  type TimeInterval,
} from "@/lib/scheduling/freeSlots";

const busyFri: TimeInterval[] = [
  { date: "2026-07-24", startMin: 16 * 60, endMin: 18 * 60, title: "Maths revision" },
  {
    date: "2026-07-24",
    startMin: 18 * 60 + 45,
    endMin: 19 * 60 + 45,
    title: "English revision",
  },
];

describe("messageSpecifiesClockTime", () => {
  it("treats duration-only prompts as soft times", () => {
    expect(
      messageSpecifiesClockTime("add maths practise tomorrow for an hour")
    ).toBe(false);
    expect(messageSpecifiesClockTime("fit an hour of english today")).toBe(
      false
    );
  });

  it("detects explicit clock times", () => {
    expect(messageSpecifiesClockTime("add maths at 7pm tomorrow")).toBe(true);
    expect(
      messageSpecifiesClockTime("study from 19:00 to 20:00 tomorrow")
    ).toBe(true);
    expect(messageSpecifiesClockTime("around 7 tonight")).toBe(true);
  });
});

describe("durationMinutesFromMessage", () => {
  it("parses common duration phrases", () => {
    expect(durationMinutesFromMessage("for an hour")).toBe(60);
    expect(durationMinutesFromMessage("for 90 minutes")).toBe(90);
    expect(durationMinutesFromMessage("for half an hour")).toBe(30);
  });
});

describe("findNextFreeSlot", () => {
  it("avoids English revision when 19:00 is busy", () => {
    const slot = findNextFreeSlot({
      dates: ["2026-07-24"],
      busy: busyFri,
      durationMin: 60,
      dayStartMin: 8 * 60,
      dayEndMin: 22 * 60,
      preferAfterMin: 15 * 60,
    });
    // First after-school hour: 15:00–16:00 (before Maths revision).
    expect(slot).toEqual({
      date: "2026-07-24",
      timeStart: "15:00",
      timeEnd: "16:00",
    });
  });

  it("picks the next evening gap when afternoon is full", () => {
    const slot = findNextFreeSlot({
      dates: ["2026-07-24"],
      busy: [
        { date: "2026-07-24", startMin: 15 * 60, endMin: 18 * 60 },
        ...busyFri.filter((b) => b.startMin >= 18 * 60),
      ],
      durationMin: 60,
      dayStartMin: 8 * 60,
      dayEndMin: 22 * 60,
      preferAfterMin: 15 * 60,
    });
    expect(slot).toEqual({
      date: "2026-07-24",
      timeStart: "19:45",
      timeEnd: "20:45",
    });
  });

  it("prefers a study period window when it fits", () => {
    const slot = findNextFreeSlot({
      dates: ["2026-07-24"],
      busy: busyFri,
      preferred: [
        {
          date: "2026-07-24",
          startMin: 14 * 60 + 25,
          endMin: 15 * 60 + 15,
          title: "Study",
        },
      ],
      durationMin: 50,
      dayStartMin: 8 * 60,
      dayEndMin: 22 * 60,
    });
    expect(slot).toEqual({
      date: "2026-07-24",
      timeStart: "14:25",
      timeEnd: "15:15",
    });
  });

  it("detects overlap with English revision at 19:00", () => {
    expect(
      intervalsOverlapSlot(busyFri, "2026-07-24", "19:00", "20:00")
    ).toBe(true);
    expect(
      intervalsOverlapSlot(busyFri, "2026-07-24", "19:45", "20:45")
    ).toBe(false);
  });
});

describe("summarizeFreeSlots", () => {
  it("lists gaps for the AI prompt", () => {
    const text = summarizeFreeSlots(["2026-07-24"], busyFri, {
      dayStartMin: 16 * 60,
      dayEndMin: 22 * 60,
    });
    expect(text).toContain("2026-07-24");
    expect(text).toContain("18:00-18:45");
    expect(text).toContain("19:45-22:00");
  });
});
