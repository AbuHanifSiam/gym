import mongoose from 'mongoose';

// Cached on globalThis so warm serverless invocations reuse one connection.
const cache = globalThis as typeof globalThis & { _mongoose?: Promise<typeof mongoose> };

export function connectDb(): Promise<typeof mongoose> {
  if (!cache._mongoose) {
    const uri = process.env.MONGODB_URI;
    if (!uri) throw new Error('MONGODB_URI is not set');
    cache._mongoose = mongoose
      .connect(uri, { bufferCommands: false, maxPoolSize: 5, serverSelectionTimeoutMS: 8000 })
      .catch((err) => {
        cache._mongoose = undefined;
        throw err;
      });
  }
  return cache._mongoose;
}
