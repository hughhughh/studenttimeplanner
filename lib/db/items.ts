import { Collection, Document, ObjectId, WithId } from "mongodb";
import { getDb } from "@/lib/db/mongo";
import type { Item } from "@/lib/types";
import type { ItemCreateInput } from "@/lib/validation/item";

/**
 * Data-access layer for calendar items. Every function is scoped by `userId`
 * so one student can never read or mutate another's calendar.
 */

const COLLECTION = "items";

type ItemDoc = Omit<Item, "id"> & { _id?: ObjectId };

async function items(): Promise<Collection<ItemDoc>> {
  const db = await getDb();
  return db.collection<ItemDoc>(COLLECTION);
}

function toItem(doc: WithId<ItemDoc> | (ItemDoc & { _id: ObjectId })): Item {
  const { _id, ...rest } = doc;
  return { id: _id.toHexString(), ...(rest as Omit<Item, "id">) };
}

export async function listItems(userId: string): Promise<Item[]> {
  const col = await items();
  const docs = await col.find({ userId }).toArray();
  return docs.map(toItem);
}

export async function getItem(
  userId: string,
  id: string
): Promise<Item | null> {
  if (!ObjectId.isValid(id)) return null;
  const col = await items();
  const doc = await col.findOne({ _id: new ObjectId(id), userId });
  return doc ? toItem(doc) : null;
}

export async function createItem(
  userId: string,
  input: ItemCreateInput
): Promise<Item> {
  const col = await items();
  const nowIso = new Date().toISOString();
  const doc: ItemDoc = {
    userId,
    type: input.type,
    title: input.title,
    color: input.color,
    movable: input.movable,
    notes: input.notes,
    tz: input.tz,
    segments: input.segments,
    recurrence: input.recurrence,
    exceptions: input.exceptions,
    overrides: input.overrides,
    completed: input.completed ?? (input.type === "task" ? false : undefined),
    completedAt: input.completedAt ?? null,
    createdAt: nowIso,
    updatedAt: nowIso,
  };
  const result = await col.insertOne(doc);
  return toItem({ ...doc, _id: result.insertedId });
}

export async function updateItem(
  userId: string,
  id: string,
  patch: Partial<Omit<Item, "id" | "userId" | "createdAt">>
): Promise<Item | null> {
  if (!ObjectId.isValid(id)) return null;
  const col = await items();
  const updated = await col.findOneAndUpdate(
    { _id: new ObjectId(id), userId },
    { $set: { ...patch, updatedAt: new Date().toISOString() } },
    { returnDocument: "after" }
  );
  return updated ? toItem(updated) : null;
}

export async function deleteItem(
  userId: string,
  id: string
): Promise<boolean> {
  if (!ObjectId.isValid(id)) return false;
  const col = await items();
  const result = await col.deleteOne({ _id: new ObjectId(id), userId });
  return result.deletedCount === 1;
}

/** Used by the AI apply pipeline to write a validated batch in one pass. */
export async function createManyItems(
  userId: string,
  inputs: ItemCreateInput[]
): Promise<Item[]> {
  const created: Item[] = [];
  for (const input of inputs) {
    created.push(await createItem(userId, input));
  }
  return created;
}

export async function deleteAllForUser(userId: string): Promise<number> {
  const col = await items();
  const result = await col.deleteMany({ userId });
  return result.deletedCount ?? 0;
}

export type { ItemDoc, Document };
