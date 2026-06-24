/**
 * One-time copy: MongoDB "test" → "indlearns"
 *
 * Run from backend folder (uses .env MONGODB_URI):
 *   node src/scripts/copyMongoDatabase.js
 *
 * Safe to re-run — overwrites target collections with source data.
 */
import dotenv from "dotenv";
import path from "path";
import { fileURLToPath } from "url";
import mongoose from "mongoose";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: path.join(__dirname, "../../.env") });

const SOURCE_DB = process.env.MONGODB_COPY_FROM?.trim() || "test";
const TARGET_DB = process.env.MONGODB_DB_NAME?.trim() || "indlearns";

const buildUriForDb = (uri, dbName) => {
  const qIndex = uri.indexOf("?");
  const base = qIndex >= 0 ? uri.slice(0, qIndex) : uri;
  const qs = qIndex >= 0 ? uri.slice(qIndex) : "";
  const withoutDb = base.replace(/\/[^/]+$/, "").replace(/\/$/, "");
  return `${withoutDb}/${dbName}${qs}`;
};

const run = async () => {
  const uri = buildUriForDb(process.env.MONGODB_URI?.trim() || "", SOURCE_DB);
  await mongoose.connect(uri);
  const client = mongoose.connection.getClient();
  const source = client.db(SOURCE_DB);
  const target = client.db(TARGET_DB);

  const collections = await source.listCollections().toArray();
  if (!collections.length) {
    console.log(`No collections found in "${SOURCE_DB}".`);
    process.exit(0);
  }

  console.log(`Copying ${collections.length} collection(s): ${SOURCE_DB} → ${TARGET_DB}`);

  for (const { name } of collections) {
    if (name.startsWith("system.")) continue;

    const docs = await source.collection(name).find({}).toArray();
    await target.collection(name).deleteMany({});
    if (docs.length) {
      await target.collection(name).insertMany(docs, { ordered: false });
    }
    console.log(`  ${name}: ${docs.length} document(s)`);
  }

  console.log(`Done. Update Render MONGODB_URI to use /${TARGET_DB} and redeploy.`);
  await mongoose.disconnect();
};

run().catch((err) => {
  console.error(err);
  process.exit(1);
});
