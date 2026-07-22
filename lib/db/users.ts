import { ObjectId } from "mongodb";
import { getDb } from "@/lib/db/mongo";

/**
 * User accounts and short-lived login codes. Passwordless: a user is just an
 * email; sign-in is proven by a one-time code delivered out of band.
 */

interface UserDoc {
  _id?: ObjectId;
  email: string;
  createdAt: string;
}

interface LoginCodeDoc {
  _id?: ObjectId;
  email: string;
  codeHash: string;
  expiresAt: Date;
  attempts: number;
}

function normalizeEmail(email: string): string {
  return email.trim().toLowerCase();
}

export async function findOrCreateUser(email: string): Promise<string> {
  const db = await getDb();
  const col = db.collection<UserDoc>("users");
  const normalized = normalizeEmail(email);
  const existing = await col.findOne({ email: normalized });
  if (existing?._id) return existing._id.toHexString();
  const result = await col.insertOne({
    email: normalized,
    createdAt: new Date().toISOString(),
  });
  return result.insertedId.toHexString();
}

export async function getUserById(
  id: string
): Promise<{ id: string; email: string } | null> {
  if (!ObjectId.isValid(id)) return null;
  const db = await getDb();
  const col = db.collection<UserDoc>("users");
  const doc = await col.findOne({ _id: new ObjectId(id) });
  return doc?._id ? { id: doc._id.toHexString(), email: doc.email } : null;
}

export async function saveLoginCode(
  email: string,
  codeHash: string,
  expiresAt: Date
): Promise<void> {
  const db = await getDb();
  const col = db.collection<LoginCodeDoc>("loginCodes");
  await col.updateOne(
    { email: normalizeEmail(email) },
    { $set: { codeHash, expiresAt, attempts: 0 } },
    { upsert: true }
  );
}

export async function getLoginCode(
  email: string
): Promise<LoginCodeDoc | null> {
  const db = await getDb();
  const col = db.collection<LoginCodeDoc>("loginCodes");
  return col.findOne({ email: normalizeEmail(email) });
}

export async function incrementCodeAttempts(email: string): Promise<void> {
  const db = await getDb();
  const col = db.collection<LoginCodeDoc>("loginCodes");
  await col.updateOne(
    { email: normalizeEmail(email) },
    { $inc: { attempts: 1 } }
  );
}

export async function deleteLoginCode(email: string): Promise<void> {
  const db = await getDb();
  const col = db.collection<LoginCodeDoc>("loginCodes");
  await col.deleteOne({ email: normalizeEmail(email) });
}
