import { expect, test } from '@playwright/test';

test('published TikTok campaign reaches its detail and official source on mobile', async ({
  context,
  page,
}) => {
  await page.goto('/tiktok');

  const campaigns = page.locator('article.tiktok-card');
  const campaignCount = await campaigns.count();
  expect(
    campaignCount,
    'No published TikTok campaign fixture is available. Apply migration 0002 and publish an eligible campaign in the external test environment.',
  ).toBeGreaterThan(0);

  const campaign = campaigns.first();
  const code = (await campaign.locator('.tiktok-video-code code').innerText()).trim();
  expect(code, 'The published campaign fixture must expose its campaign code.').not.toBe('');

  const detailLink = campaign.getByRole('link', { name: /Revisar ficha completa/i });
  const href = await detailLink.getAttribute('href');
  expect(href, 'The published campaign fixture must link to an opportunity detail.').toBeTruthy();

  const detailUrl = new URL(href!, page.url());
  expect(detailUrl.pathname).toMatch(/^\/convocatorias\/[^/]+$/);
  expect([...detailUrl.searchParams.entries()]).toEqual([
    ['utm_source', 'tiktok'],
    ['utm_medium', 'organic_social'],
    ['utm_campaign', 'convocatorias'],
    ['utm_content', code],
  ]);

  await detailLink.click();
  await expect(page).toHaveURL(detailUrl.href);

  const officialLink = page
    .getByRole('link', {
      name: /(?:Ir a la fuente oficial|Consultar fuente oficial|Visitar entidad oficial)/i,
    })
    .first();
  await expect(officialLink).toBeVisible();

  const officialHref = await officialLink.getAttribute('href');
  expect(officialHref, 'The opportunity fixture must expose an official source URL.').toBeTruthy();
  const officialUrl = new URL(officialHref!);
  expect(officialUrl.protocol).toMatch(/^https?:$/);

  const [officialPage, officialRequest] = await Promise.all([
    page.waitForEvent('popup'),
    context.waitForEvent(
      'request',
      (request) => request.isNavigationRequest() && request.url() === officialUrl.href,
    ),
    officialLink.click(),
  ]);
  expect(officialRequest.url()).toBe(officialUrl.href);
  await officialPage.close();
});
