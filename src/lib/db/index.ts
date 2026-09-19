import { neon } from '@neondatabase/serverless';
import { drizzle } from 'drizzle-orm/neon-http';
import * as schema from './schema';

function getDatabaseUrl(): string {
  const url = process.env.DATABASE_URL;
  if (!url) {
    throw new Error(
      'DATABASE_URL environment variable is required. ' +
      'Copy .env.example to .env.local and set DATABASE_URL to your Neon connection string.'
    );
  }
  if (url.startsWith('NEXT_PUBLIC_')) {
    throw new Error(
      'DATABASE_URL must not use the NEXT_PUBLIC_ prefix. ' +
      'The database connection string must stay on the server side only.'
    );
  }
  return url;
}

// Lazy singleton — connection and drizzle instance are created on first access,
// not at module import time. This lets tests import the module without
// requiring DATABASE_URL in the environment.
let _db: ReturnType<typeof drizzle<typeof schema>> | null = null;

function getDb() {
  if (!_db) {
    const sql = neon(getDatabaseUrl());
    _db = drizzle(sql, { schema });
  }
  return _db;
}

// Proxy that lazily initializes the real db on first property access
export const db: ReturnType<typeof drizzle<typeof schema>> = new Proxy({} as ReturnType<typeof drizzle<typeof schema>>, {
  get(_target, prop, receiver) {
    const instance = getDb();
    const value = Reflect.get(instance, prop, receiver);
    if (typeof value === 'function') {
      return value.bind(instance);
    }
    return value;
  },
});
