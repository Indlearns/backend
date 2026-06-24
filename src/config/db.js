import mongoose from "mongoose";

const DEFAULT_DB_NAME = "indlearns";

/**
 * Ensure the URI targets a named database (not the MongoDB default "test").
 */
export const resolveMongoUri = () => {
  const uri = process.env.MONGODB_URI?.trim();
  if (!uri) {
    throw new Error("MONGODB_URI is not set in environment variables.");
  }

  const dbName = process.env.MONGODB_DB_NAME?.trim() || DEFAULT_DB_NAME;

  // Already has a database name in the path (e.g. .../indlearns?...)
  if (/mongodb(\+srv)?:\/\/[^/]+\/[^/?]+/.test(uri)) {
    return uri;
  }

  // Insert database name before query string: ...net/?appName → ...net/indlearns?appName
  if (uri.includes("?")) {
    return uri.replace("/?", `/${dbName}?`);
  }
  return uri.endsWith("/") ? `${uri}${dbName}` : `${uri}/${dbName}`;
};

/**
 * Connects the Express server to MongoDB Atlas.
 * Called once when the server starts.
 */
const connectDB = async () => {
  try {
    const uri = resolveMongoUri();
    const conn = await mongoose.connect(uri);
    console.log(`MongoDB Connected: ${conn.connection.host}`);
    console.log(`MongoDB Database: ${conn.connection.name}`);
    if (conn.connection.name === "test") {
      console.warn(
        'WARNING: Connected to database "test". Set MONGODB_URI with /indlearns or MONGODB_DB_NAME=indlearns.'
      );
    }
  } catch (error) {
    console.error(`MongoDB connection error: ${error.message}`);
    process.exit(1);
  }
};

export default connectDB;
