import mongoose from "mongoose";

const MONGODB_URI =
  process.env.MONGODB_URL ||
  process.env.MONGODB_URI ||
  "mongodb://localhost:27017/wikirace";

// Cache the connection across hot reloads in development
const globalMongo = globalThis as typeof globalThis & {
  __mongoConn?: typeof mongoose;
  __mongoPromise?: Promise<typeof mongoose>;
};

export async function connectDB(): Promise<typeof mongoose> {
  if (globalMongo.__mongoConn) {
    return globalMongo.__mongoConn;
  }

  if (!globalMongo.__mongoPromise) {
    globalMongo.__mongoPromise = mongoose.connect(MONGODB_URI, {
      bufferCommands: false,
      dbName: "wikirace",
    });
  }

  try {
    globalMongo.__mongoConn = await globalMongo.__mongoPromise;
  } catch (err) {
    globalMongo.__mongoPromise = undefined;
    throw err;
  }

  return globalMongo.__mongoConn;
}
