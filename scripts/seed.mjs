// Seed Student Time Planner with a realistic sample week for the demo user.
// Run with: npm run seed
// Self-contained (reads .env.local, uses the mongodb driver directly) so it
// needs no TypeScript tooling.

import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import { MongoClient } from "mongodb";
import { DateTime } from "luxon";

const __dirname = dirname(fileURLToPath(import.meta.url));

function loadEnv() {
  try {
    const raw = readFileSync(join(__dirname, "..", ".env.local"), "utf8");
    for (const line of raw.split("\n")) {
      const trimmed = line.trim();
      if (!trimmed || trimmed.startsWith("#")) continue;
      const eq = trimmed.indexOf("=");
      if (eq === -1) continue;
      const key = trimmed.slice(0, eq).trim();
      let value = trimmed.slice(eq + 1).trim();
      if (
        (value.startsWith('"') && value.endsWith('"')) ||
        (value.startsWith("'") && value.endsWith("'"))
      ) {
        value = value.slice(1, -1);
      }
      if (!(key in process.env)) process.env[key] = value;
    }
  } catch {
    // .env.local optional; fall back to process env.
  }
}

loadEnv();

const uri = process.env.MONGODB_URI || "mongodb://127.0.0.1:27017";
const dbName = process.env.MONGODB_DB || "studenttimeplanner";
const tz = process.env.APP_TIMEZONE || "Australia/Sydney";
const USER_ID = "demo-user"; // matches DEMO_USER_ID; "Continue as demo" sees this data

const GREEN = "#66AA3C";
const BLUE = "#3B82F6";
const PURPLE = "#8B5CF6";
const TEAL = "#14B8A6";

const nowDt = DateTime.now().setZone(tz);
const monday = nowDt.startOf("week");
const ISO = "yyyy-MM-dd";

const dateOf = (offsetDays) => monday.plus({ days: offsetDays }).toFormat(ISO);
const at = (date, time) =>
  DateTime.fromFormat(`${date} ${time}`, `${ISO} HH:mm`, { zone: tz }).toISO();

const today = nowDt.toFormat(ISO);
const yesterday = nowDt.minus({ days: 1 }).toFormat(ISO);
const nowIso = new Date().toISOString();

function single(type, title, color, movable, segments, extra = {}) {
  return {
    userId: USER_ID,
    type,
    title,
    color,
    movable,
    tz,
    segments,
    completed: type === "task" ? false : undefined,
    completedAt: null,
    createdAt: nowIso,
    updatedAt: nowIso,
    ...extra,
  };
}

function recurring(type, title, color, movable, recurrence, extra = {}) {
  return {
    userId: USER_ID,
    type,
    title,
    color,
    movable,
    tz,
    recurrence,
    exceptions: extra.exceptions ?? [],
    overrides: extra.overrides ?? {},
    createdAt: nowIso,
    updatedAt: nowIso,
  };
}

const seriesStart = monday.minus({ weeks: 4 }).toFormat(ISO);

const docs = [
  // School: weekday activity, immovable.
  recurring("activity", "School", BLUE, false, {
    freq: "weekly",
    byWeekday: [1, 2, 3, 4, 5],
    timeStart: "08:30",
    timeEnd: "15:00",
    startDate: seriesStart,
  }),
  // Football training Thursdays.
  recurring("activity", "Football training", TEAL, false, {
    freq: "weekly",
    byWeekday: [4],
    timeStart: "17:00",
    timeEnd: "18:30",
    startDate: seriesStart,
  }),
  // Daily revision task at 7pm, except Saturday (exception on this week's Sat).
  recurring("task", "Revision", GREEN, true, {
    freq: "weekly",
    byWeekday: [1, 2, 3, 4, 5, 7],
    timeStart: "19:00",
    timeEnd: "19:45",
    startDate: seriesStart,
  }),
  // An English study block tonight.
  single("task", "English study", GREEN, true, [
    { start: at(today, "20:00"), end: at(today, "21:00") },
  ]),
  // An overdue, incomplete task from yesterday afternoon.
  single("task", "Maths worksheet", GREEN, true, [
    { start: at(yesterday, "16:00"), end: at(yesterday, "17:00") },
  ]),
  // A completed task earlier this week (Tuesday).
  single("task", "Read chapter 4", GREEN, true, [
    { start: at(dateOf(1), "10:00"), end: at(dateOf(1), "11:00") },
  ], { completed: true, completedAt: nowIso }),
  // A split-session essay: two non-contiguous blocks, one card.
  single("task", "History essay", PURPLE, true, [
    { start: at(dateOf(2), "16:00"), end: at(dateOf(2), "17:00") },
    { start: at(dateOf(4), "10:00"), end: at(dateOf(4), "11:00") },
  ]),
];

async function main() {
  const client = new MongoClient(uri);
  await client.connect();
  const col = client.db(dbName).collection("items");
  const removed = await col.deleteMany({ userId: USER_ID });
  const result = await col.insertMany(docs);
  console.log(
    `Seed complete: removed ${removed.deletedCount}, inserted ${result.insertedCount} items for ${USER_ID} (tz ${tz}).`
  );
  await client.close();
}

main().catch((err) => {
  console.error("Seed failed:", err);
  process.exit(1);
});
