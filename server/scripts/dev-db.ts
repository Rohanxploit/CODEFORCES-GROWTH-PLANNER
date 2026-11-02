// Runs a local MongoDB for development, using the official mongod binary that
// mongodb-memory-server downloads. Data persists in server/.mongo-data.
import { mkdirSync } from 'node:fs';
import { resolve } from 'node:path';
import { MongoMemoryServer } from 'mongodb-memory-server';

const dbPath = resolve(import.meta.dirname, '../.mongo-data');
mkdirSync(dbPath, { recursive: true });

const server = await MongoMemoryServer.create({
  instance: { port: 27017, ip: '127.0.0.1', dbPath, storageEngine: 'wiredTiger' },
});

console.log(`Local MongoDB running at ${server.getUri()} (data: ${dbPath})`);

const stop = async () => {
  await server.stop({ doCleanup: false });
  process.exit(0);
};
process.on('SIGINT', () => void stop());
process.on('SIGTERM', () => void stop());
