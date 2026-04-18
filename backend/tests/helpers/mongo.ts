import { MongoMemoryServer } from 'mongodb-memory-server';
import mongoose from 'mongoose';

let mongod: MongoMemoryServer | null = null;

export async function startInMemoryMongo() {
  mongod = await MongoMemoryServer.create();
  await mongoose.connect(mongod.getUri(), { autoIndex: true });
}

export async function stopInMemoryMongo() {
  await mongoose.disconnect();
  if (mongod) await mongod.stop();
  mongod = null;
}

export async function clearDb() {
  const collections = mongoose.connection.collections;
  for (const key of Object.keys(collections)) {
    await collections[key].deleteMany({});
  }
}
