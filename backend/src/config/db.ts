import mongoose from 'mongoose';
import { env } from './env';

let connected = false;

export async function connectDb(uri: string = env.MONGODB_URI) {
  if (connected) return mongoose.connection;
  await mongoose.connect(uri, { autoIndex: true });
  connected = true;
  return mongoose.connection;
}

export async function disconnectDb() {
  if (!connected) return;
  await mongoose.disconnect();
  connected = false;
}
