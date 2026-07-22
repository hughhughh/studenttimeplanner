import { Db, MongoClient } from "mongodb";

/**
 * Cached MongoDB connection. Env vars are read at call time (not module load)
 * so a dev-server restart after editing .env.local is enough — and a failed
 * connect clears the cache so the next request can retry.
 */

declare global {
  var _stpMongoClientPromise: Promise<MongoClient> | undefined;
}

let clientPromise: Promise<MongoClient> | undefined;

/** Database name from the URI path, e.g. ...mongodb.net/myDb?opts → myDb */
function dbNameFromUri(uri: string): string | undefined {
  const match = uri.match(/mongodb(?:\+srv)?:\/\/[^/]+\/([^/?]+)/);
  const name = match?.[1]?.trim();
  return name && name.length > 0 ? decodeURIComponent(name) : undefined;
}

export function getMongoConfig(): { uri: string | undefined; dbName: string } {
  const uri = process.env.MONGODB_URI?.trim();
  const dbName =
    process.env.MONGODB_DB?.trim() ||
    (uri ? dbNameFromUri(uri) : undefined) ||
    "studenttimeplanner";
  return { uri, dbName };
}

function clearCachedPromise(): void {
  if (process.env.NODE_ENV === "development") {
    global._stpMongoClientPromise = undefined;
  }
  clientPromise = undefined;
}

async function connectClient(uri: string): Promise<MongoClient> {
  const client = new MongoClient(uri);
  try {
    await client.connect();
    return client;
  } catch (err) {
    clearCachedPromise();
    throw err;
  }
}

function getClientPromise(): Promise<MongoClient> {
  const { uri } = getMongoConfig();
  if (!uri) {
    throw new Error("MONGODB_URI is not set. Add it to .env.local.");
  }

  if (process.env.NODE_ENV === "development") {
    if (!global._stpMongoClientPromise) {
      global._stpMongoClientPromise = connectClient(uri);
    }
    return global._stpMongoClientPromise;
  }

  if (!clientPromise) {
    clientPromise = connectClient(uri);
  }
  return clientPromise;
}

export async function getDb(): Promise<Db> {
  const { dbName } = getMongoConfig();
  const client = await getClientPromise();
  return client.db(dbName);
}
