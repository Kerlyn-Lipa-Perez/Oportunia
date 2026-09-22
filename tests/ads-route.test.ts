import assert from 'node:assert/strict';
import test from 'node:test';
import { GET } from '../src/app/ads.txt/route';

async function withEnvironment<T>(
  values: Record<string, string | undefined>,
  run: () => Promise<T>,
): Promise<T> {
  const previous = Object.fromEntries(
    Object.keys(values).map((key) => [key, process.env[key]]),
  );
  for (const [key, value] of Object.entries(values)) {
    if (value === undefined) delete process.env[key];
    else process.env[key] = value;
  }
  try {
    return await run();
  } finally {
    for (const [key, value] of Object.entries(previous)) {
      if (value === undefined) delete process.env[key];
      else process.env[key] = value;
    }
  }
}

test('ads.txt is absent until AdSense is explicitly and validly configured', async () => {
  await withEnvironment(
    {
      ADSENSE_ENABLED: 'false',
      ADSENSE_READINESS_CONFIRMED: 'false',
      ADSENSE_PUBLISHER_ID: undefined,
    },
    async () => assert.equal((await GET()).status, 404),
  );
});

test('ads.txt stays absent until readiness is separately confirmed', async () => {
  await withEnvironment(
    {
      ADSENSE_ENABLED: 'true',
      ADSENSE_READINESS_CONFIRMED: undefined,
      ADSENSE_PUBLISHER_ID: 'pub-1234567890123456',
    },
    async () => assert.equal((await GET()).status, 404),
  );
});

test('ads.txt emits only the official Google record for a ready valid publisher', async () => {
  await withEnvironment(
    {
      ADSENSE_ENABLED: 'true',
      ADSENSE_READINESS_CONFIRMED: 'true',
      ADSENSE_PUBLISHER_ID: 'pub-1234567890123456',
    },
    async () => {
      const response = await GET();
      assert.equal(response.status, 200);
      assert.equal(
        await response.text(),
        'google.com, pub-1234567890123456, DIRECT, f08c47fec0942fa0\n',
      );
    },
  );
});
