import assert from 'node:assert/strict';
import test from 'node:test';
import { GET, POST } from '../src/app/api/internal/ingestion/cron/route';

test('the ingestion cron route rejects requests without the configured bearer secret', async () => {
  const previous = process.env.CRON_SECRET;
  process.env.CRON_SECRET = 'cron-test-secret';
  try {
    const missing = await GET(new Request('https://oportunia.test/api/internal/ingestion/cron'));
    const invalid = await POST(new Request('https://oportunia.test/api/internal/ingestion/cron', {
      method: 'POST', headers: { authorization: 'Bearer another-secret' },
    }));
    assert.equal(missing.status, 401);
    assert.equal(invalid.status, 401);
  } finally {
    if (previous === undefined) delete process.env.CRON_SECRET;
    else process.env.CRON_SECRET = previous;
  }
});
