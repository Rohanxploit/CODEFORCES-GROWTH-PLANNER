import mongoose from 'mongoose';
import type { HealthResponse } from '@cgp/shared';
import { logger } from '../utils/logger.js';

const RETRY_DELAY_MS = 5000;
const MAX_ATTEMPTS = 5;

/**
 * Connects to MongoDB, retrying a few times so a slow Atlas cold start or a
 * brief network blip does not crash the server on boot.
 */
export async function connectDatabase(uri: string): Promise<void> {
  mongoose.set('strictQuery', true);

  mongoose.connection.on('disconnected', () => logger.warn('MongoDB disconnected'));
  mongoose.connection.on('reconnected', () => logger.info('MongoDB reconnected'));

  for (let attempt = 1; attempt <= MAX_ATTEMPTS; attempt++) {
    try {
      await mongoose.connect(uri, { serverSelectionTimeoutMS: 10_000 });
      logger.info('MongoDB connected');
      return;
    } catch (error) {
      logger.error(`MongoDB connection attempt ${attempt}/${MAX_ATTEMPTS} failed`, error);
      if (attempt === MAX_ATTEMPTS) throw error;
      await new Promise((resolve) => setTimeout(resolve, RETRY_DELAY_MS));
    }
  }
}

export async function disconnectDatabase(): Promise<void> {
  await mongoose.disconnect();
}

export function databaseState(): HealthResponse['database'] {
  switch (mongoose.connection.readyState) {
    case mongoose.ConnectionStates.connected:
      return 'connected';
    case mongoose.ConnectionStates.connecting:
      return 'connecting';
    default:
      return 'disconnected';
  }
}
