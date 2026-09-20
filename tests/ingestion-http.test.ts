import assert from 'node:assert/strict';
import test from 'node:test';
import { hasValidCronSecret } from '../src/lib/ingestion/http';

test('cron secret validation rejects missing, unequal, and differently sized tokens', () => {
  assert.equal(hasValidCronSecret(null, 'correct-secret'), false);
  assert.equal(hasValidCronSecret('wrong-secret', 'correct-secret'), false);
  assert.equal(hasValidCronSecret('correct', 'correct-secret'), false);
  assert.equal(hasValidCronSecret('correct-secret', ''), false);
});

test('cron secret validation accepts the configured bearer token', () => {
  assert.equal(hasValidCronSecret('correct-secret', 'correct-secret'), true);
});
