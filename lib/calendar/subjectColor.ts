import { ITEM_COLORS } from "@/lib/config";

/**
 * Stable subject → colour mapping for timetable import and "same colours"
 * prompts. Same normalised title always gets the same hex.
 */

const SUBJECT_PALETTE = [
  ITEM_COLORS.blue,
  ITEM_COLORS.green,
  ITEM_COLORS.orange,
  ITEM_COLORS.purple,
  ITEM_COLORS.teal,
  ITEM_COLORS.pink,
  ITEM_COLORS.yellow,
  ITEM_COLORS.red,
];

/** Common Australian subject names → preferred palette colour name. */
const KNOWN_SUBJECT_COLORS: [RegExp, keyof typeof ITEM_COLORS][] = [
  [/\bmaths?\b|\bmathematics\b/, "blue"],
  [/\benglish\b/, "yellow"],
  [/\beconomics?\b|\becon\b/, "green"],
  [/\bsoftware\b|\bcomputing\b|\bdigital\b|\binformatics\b/, "purple"],
  [/\bphysics\b/, "teal"],
  [/\bchemistry\b|\bchem\b/, "orange"],
  [/\bbiology\b|\bbio\b/, "pink"],
  [/\bhistory\b/, "red"],
  [/\bgeography\b|\bgeo\b/, "slate"],
  [/\bstudy\b/, "slate"],
  [/\bassembly\b/, "slate"],
  [/\bpe\b|\bpdhpe\b|\bsport\b/, "orange"],
];

/** Strip period codes like "12 " so "12 Maths" and "Maths" share a colour. */
export function normalizeSubjectKey(title: string): string {
  return title
    .toLowerCase()
    .replace(/^\d{1,2}\s+/, "")
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

function hashKey(key: string): number {
  let hash = 0;
  for (let i = 0; i < key.length; i++) {
    hash = (hash * 31 + key.charCodeAt(i)) >>> 0;
  }
  return hash;
}

export function colorForSubjectTitle(title: string): string {
  const key = normalizeSubjectKey(title);
  if (!key) return ITEM_COLORS.green;

  for (const [pattern, named] of KNOWN_SUBJECT_COLORS) {
    if (pattern.test(key)) return ITEM_COLORS[named];
  }

  return SUBJECT_PALETTE[hashKey(key) % SUBJECT_PALETTE.length]!;
}
