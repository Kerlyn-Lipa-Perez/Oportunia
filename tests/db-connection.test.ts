import test from 'node:test';
import assert from 'node:assert/strict';

test('getDatabaseUrl throws when DATABASE_URL is missing', () => {
  const original = process.env.DATABASE_URL;
  delete process.env.DATABASE_URL;
  try {
    delete require.cache[require.resolve('../src/lib/db/index')];
    const { db } = require('../src/lib/db/index');
    // Accessing any property on db triggers lazy initialization
    assert.throws(
      () => { void db._.fullSchema; },
      (err: Error) => err.message.includes('DATABASE_URL'),
      'Should throw descriptive error about DATABASE_URL'
    );
  } finally {
    if (original !== undefined) process.env.DATABASE_URL = original;
  }
});

test('getDatabaseUrl throws when NEXT_PUBLIC_ prefix is used', () => {
  const original = process.env.DATABASE_URL;
  const nextPublic = process.env.NEXT_PUBLIC_DATABASE_URL;
  delete process.env.DATABASE_URL;
  process.env.NEXT_PUBLIC_DATABASE_URL = 'postgresql://fake';
  try {
    delete require.cache[require.resolve('../src/lib/db/index')];
    const { db } = require('../src/lib/db/index');
    assert.throws(
      () => { void db._.fullSchema; },
      (err: Error) => err.message.includes('DATABASE_URL'),
      'Should reject NEXT_PUBLIC_ variant'
    );
  } finally {
    if (original !== undefined) process.env.DATABASE_URL = original;
    if (nextPublic !== undefined) process.env.NEXT_PUBLIC_DATABASE_URL = nextPublic;
    else delete process.env.NEXT_PUBLIC_DATABASE_URL;
  }
});

test('getDatabaseUrl accepts valid DATABASE_URL', () => {
  const original = process.env.DATABASE_URL;
  process.env.DATABASE_URL = 'postgres://user:pass@ep-test.us-east-2.aws.neon.tech/dbname?sslmode=require';
  try {
    delete require.cache[require.resolve('../src/lib/db/index')];
    const mod = require('../src/lib/db/index');
    // Module should load without throwing
    assert.ok(mod.db, 'db should be exported');
  } finally {
    if (original !== undefined) process.env.DATABASE_URL = original;
    else delete process.env.DATABASE_URL;
  }
});
