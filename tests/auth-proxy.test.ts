import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';

test('the public auth proxy does not expose Neon Admin plugin endpoints to the browser', () => {
  const source = readFileSync('src/app/api/auth/[...path]/route.ts', 'utf8');
  assert.match(source, /path\[0\]\s*===\s*['"]admin['"]/);
  assert.match(source, /status:\s*404/);
});
