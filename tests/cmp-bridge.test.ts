import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';
import {
  ADSENSE_CONSENT_EVENT,
  parseConsentEvent,
  type ConsentPurposes,
} from '../src/lib/site/adsense';

// The bridge module and the new consent-detail exports do not exist yet.
// Loading them dynamically keeps every RED failure granular (one failing test
// per missing behavior) instead of failing the whole file at link time.
async function loadCmpBridge() {
  return import('../src/lib/site/cmp-bridge');
}

async function loadConsentBuilders() {
  const adsense = await import('../src/lib/site/adsense');
  return {
    buildConsentDetail: adsense.buildConsentDetail,
    parseConsentPurposes: adsense.parseConsentPurposes,
  };
}

const ALL_GRANTED = {
  analytics_storage: 'granted',
  ad_storage: 'granted',
  ad_user_data: 'granted',
  ad_personalization: 'granted',
};

const ALL_DENIED = {
  analytics_storage: 'denied',
  ad_storage: 'denied',
  ad_user_data: 'denied',
  ad_personalization: 'denied',
};

test('CMP accept resolves to an all-granted consent detail', async () => {
  const { translateCmpPayload } = await loadCmpBridge();
  assert.deepEqual(translateCmpPayload({ decision: 'accept' }), {
    status: 'granted',
    purposes: { ...ALL_GRANTED },
  });
});

test('CMP reject and revoke resolve to an all-denied consent detail', async () => {
  const { translateCmpPayload } = await loadCmpBridge();
  assert.deepEqual(translateCmpPayload({ decision: 'reject' }), {
    status: 'denied',
    purposes: { ...ALL_DENIED },
  });
  assert.deepEqual(translateCmpPayload({ decision: 'revoke' }), {
    status: 'denied',
    purposes: { ...ALL_DENIED },
  });
  // The extraction layer may forward an `action` marker instead of `decision`.
  assert.deepEqual(translateCmpPayload({ action: 'accept' }), {
    status: 'granted',
    purposes: { ...ALL_GRANTED },
  });
  assert.deepEqual(translateCmpPayload({ action: 'revoke' }), {
    status: 'denied',
    purposes: { ...ALL_DENIED },
  });
});

test('granular purpose payloads are translated as-is with status from ad_storage', async () => {
  const { translateCmpPayload } = await loadCmpBridge();
  const mixed = {
    analytics_storage: 'granted',
    ad_storage: 'denied',
    ad_user_data: 'denied',
    ad_personalization: 'granted',
  };
  assert.deepEqual(translateCmpPayload(mixed), {
    status: 'denied',
    purposes: { ...mixed },
  });

  const advertisingOnly = {
    analytics_storage: 'denied',
    ad_storage: 'granted',
    ad_user_data: 'granted',
    ad_personalization: 'granted',
  };
  assert.deepEqual(translateCmpPayload(advertisingOnly), {
    status: 'granted',
    purposes: { ...advertisingOnly },
  });
});

test('malformed or unresolved CMP payloads translate to null', async () => {
  const { translateCmpPayload } = await loadCmpBridge();
  assert.equal(translateCmpPayload(null), null);
  assert.equal(translateCmpPayload(undefined), null);
  assert.equal(translateCmpPayload('accept'), null);
  assert.equal(translateCmpPayload(['accept']), null);
  assert.equal(translateCmpPayload({}), null);
  assert.equal(translateCmpPayload({ decision: 'pending' }), null);
  assert.equal(translateCmpPayload({ action: 'clicked' }), null);
  // An explicit but unknown decision never falls through to the purposes.
  assert.equal(translateCmpPayload({ decision: 'pending', ...ALL_GRANTED }), null);
  // Partial or invalid purpose sets stay unresolved instead of guessing.
  assert.equal(translateCmpPayload({ analytics_storage: 'granted' }), null);
  assert.equal(translateCmpPayload({ ...ALL_GRANTED, ad_user_data: 'unknown' }), null);
});

test('consent detail builders keep status aligned with ad_storage and purposes whitelisted', async () => {
  const { buildConsentDetail, parseConsentPurposes } = await loadConsentBuilders();
  const mixed: ConsentPurposes = {
    analytics_storage: 'granted',
    ad_storage: 'denied',
    ad_user_data: 'granted',
    ad_personalization: 'denied',
  };
  assert.deepEqual(buildConsentDetail({ ...mixed }), {
    status: 'denied',
    purposes: { ...mixed },
  });
  assert.deepEqual(buildConsentDetail({ ...mixed, ad_storage: 'granted' }), {
    status: 'granted',
    purposes: { ...mixed, ad_storage: 'granted' },
  });

  assert.deepEqual(parseConsentPurposes({ ...mixed }), { ...mixed });
  // Extra keys are dropped: only the four Consent Mode v2 purposes pass through.
  assert.deepEqual(parseConsentPurposes({ ...ALL_GRANTED, unexpected: 'x' }), {
    ...ALL_GRANTED,
  });
  assert.equal(parseConsentPurposes({ analytics_storage: 'granted' }), undefined);
  assert.equal(parseConsentPurposes({ ...ALL_GRANTED, ad_user_data: 'unknown' }), undefined);
  assert.equal(parseConsentPurposes(null), undefined);
});

test('translated details still satisfy the pinned consent event contract', async () => {
  const { translateCmpPayload } = await loadCmpBridge();
  const accepted = translateCmpPayload({ decision: 'accept' });
  const revoked = translateCmpPayload({ decision: 'revoke' });
  assert.ok(accepted);
  assert.ok(revoked);
  assert.equal(ADSENSE_CONSENT_EVENT, 'oportunia:ads-consent');
  assert.equal(parseConsentEvent({ detail: accepted }), 'granted');
  assert.equal(parseConsentEvent({ detail: revoked }), 'denied');
});

test('attachCmpListener forwards only translated details and detaches cleanly', async () => {
  const { attachCmpListener } = await loadCmpBridge();
  let emit: ((payload: unknown) => void) | undefined;
  let subscriptions = 0;
  let unsubscribed = false;
  const source = (listener: (payload: unknown) => void) => {
    subscriptions += 1;
    emit = listener;
    return () => {
      unsubscribed = true;
    };
  };

  const received: unknown[] = [];
  const detach = attachCmpListener(source, (detail) => {
    received.push(detail);
  });

  assert.equal(subscriptions, 1);
  assert.equal(typeof detach, 'function');
  assert.equal(typeof emit, 'function');

  emit?.({ decision: 'accept' });
  assert.equal(received.length, 1);
  assert.deepEqual(received[0], {
    status: 'granted',
    purposes: { ...ALL_GRANTED },
  });

  emit?.(null);
  emit?.({ decision: 'pending' });
  emit?.({ analytics_storage: 'granted' });
  assert.equal(received.length, 1, 'malformed payloads must never reach the sink');

  emit?.({ action: 'reject' });
  assert.equal(received.length, 2);
  assert.deepEqual(received[1], {
    status: 'denied',
    purposes: { ...ALL_DENIED },
  });

  detach();
  assert.equal(unsubscribed, true, 'detach must delegate to the source unsubscribe');
});

test('attachCmpListener stays safe when the source throws or has no unsubscribe', async () => {
  const { attachCmpListener } = await loadCmpBridge();
  let sinkCalls = 0;

  const throwing = attachCmpListener(() => {
    throw new Error('cmp source unavailable');
  }, () => {
    sinkCalls += 1;
  });
  assert.equal(typeof throwing, 'function');
  assert.doesNotThrow(() => throwing());
  assert.equal(sinkCalls, 0);

  const voidSource = attachCmpListener(() => undefined, () => {
    sinkCalls += 1;
  });
  assert.equal(typeof voidSource, 'function');
  assert.doesNotThrow(() => voidSource());
  assert.equal(sinkCalls, 0);
});

test('layout mounts the CMP bridge client next to the consent consumers', () => {
  const layout = readFileSync('src/app/layout.tsx', 'utf8');
  assert.match(
    layout,
    /import\s*\{\s*CmpBridge\s*\}\s*from\s*["']@\/lib\/site\/cmp-bridge-client["']/,
  );
  assert.match(layout, /<CmpBridge\s*\/>/);
});

test('CMP bridge client subscribes through the seam and dispatches the pinned event', () => {
  const client = readFileSync('src/lib/site/cmp-bridge-client.tsx', 'utf8');
  assert.match(client, /^"use client"/);
  assert.match(client, /attachCmpListener/);
  assert.match(client, /ADSENSE_CONSENT_EVENT/);
  assert.match(client, /new CustomEvent\(/);
  assert.match(client, /NEXT_PUBLIC_CMP_SCRIPT_SRC/);
  assert.match(client, /https:\/\//, 'the CMP script must load from an https origin only');
});

test('CMP script environment entry stays empty until the certified snippet arrives', () => {
  const environment = readFileSync('.env.example', 'utf8');
  assert.match(environment, /^NEXT_PUBLIC_CMP_SCRIPT_SRC=$/m);
  assert.doesNotMatch(environment, /^NEXT_PUBLIC_CMP_SCRIPT_SRC=https?:\/\//m);
});
