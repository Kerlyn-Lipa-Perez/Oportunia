import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';

const privacy = readFileSync('src/app/privacidad/page.tsx', 'utf8');
const cookies = readFileSync('src/app/cookies/page.tsx', 'utf8');
const legalCopy = `${privacy}\n${cookies}`;

test('privacy disclosures describe first-party anonymous TikTok attribution data', () => {
  assert.match(legalCopy, /sessionStorage/i);
  assert.match(legalCopy, /sessionId/i);
  assert.match(legalCopy, /opaco/i);
  assert.match(legalCopy, /engagementMs/i);
  assert.match(legalCopy, /60[ .]?000/);
  assert.match(legalCopy, /TikTok/i);
  for (const eventName of ['landing_view', 'detail_view', 'official_click', 'engagement']) {
    assert.match(legalCopy, new RegExp(eventName));
  }
  for (const excludedDatum of ['IP', 'correo', 'user-agent', 'fingerprint']) {
    assert.match(legalCopy, new RegExp(excludedDatum, 'i'));
  }
});

test('Google disclosures keep GA4 and AdSense consent-gated and explain revocation limits', () => {
  assert.doesNotMatch(legalCopy, /no integra(?:mos)? GA4/i);
  assert.match(legalCopy, /Google.*pol[ií]tica|pol[ií]tica.*Google/is);
  assert.match(legalCopy, /GA4.*desactivad|desactivad.*GA4/is);
  assert.match(legalCopy, /AdSense.*desactivad|desactivad.*AdSense/is);
  assert.match(legalCopy, /configuraci[oó]n.*consentimiento|consentimiento.*configuraci[oó]n/is);
  assert.match(legalCopy, /retirar|revocar/i);
  assert.match(legalCopy, /futuros|posteriores/i);
  assert.match(legalCopy, /no (?:borra|elimina)|no es retroactiv/is);
});
