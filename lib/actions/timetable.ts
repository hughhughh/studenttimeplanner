"use server";

import { refresh } from "next/cache";
import { verifySession } from "@/lib/auth/dal";
import { createManyItems } from "@/lib/db/items";
import { itemCreateSchema, type ItemCreateInput } from "@/lib/validation/item";

/**
 * Confirm an AI-extracted timetable. Each proposed item is re-validated
 * against the item schema before any write, so a bad extraction can never
 * reach the database. Returns the count actually created.
 */
export async function confirmTimetable(
  rawItems: unknown[]
): Promise<{ ok: boolean; created: number; error?: string }> {
  const { userId } = await verifySession();

  const valid: ItemCreateInput[] = [];
  for (const raw of rawItems) {
    const parsed = itemCreateSchema.safeParse(raw);
    if (!parsed.success) {
      return {
        ok: false,
        created: 0,
        error: "One or more timetable entries were invalid and not saved.",
      };
    }
    valid.push(parsed.data);
  }

  await createManyItems(userId, valid);
  refresh();
  return { ok: true, created: valid.length };
}
