import { test, expect } from '@playwright/test';
import { startFieldReviewServer } from './field-review-server.mjs';
let server;
test.beforeAll(async () => { test.setTimeout(120000); server = await startFieldReviewServer(); });
test.afterAll(async () => { await server?.close(); });
test.beforeEach(async ({ page }) => {
  await server.seed();
  await page.route('**/*', route => new URL(route.request().url()).origin === server.url ? route.continue() : route.abort());
});
const article = page => page.getByRole('article', { name: 'Media section', exact: true });
const checkWidth = async page => {
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1)).toBe(true);
  for (const body of await page.locator('.responsive-modal__body').all()) expect(await body.evaluate(el => el.scrollWidth <= el.clientWidth + 1)).toBe(true);
};
for (const width of [1280, 390]) test(`whole-section media review with an intervening deletion at ${width}px`, async ({ page }) => {
  await page.setViewportSize({ width, height: 900 });
  const errors = [];
  page.on('pageerror', error => errors.push(error.message));
  const original = server.url + '/fixture/media/front.jpg', document = server.url + '/fixture/media/layout.pdf';
  const media = { images: [original], videos: [], docs: [document] };
  await server.db.warehouse.update({ where: { id: 4821 }, data: { media, photos: original + ',' + document } });
  await page.goto(server.url + '/dashboard-reference?role=admin');
  await page.getByRole('button', { name: /View$/ }).click();
  await page.getByRole('button', { name: 'Flag for review (beta)', exact: true }).click();
  await page.getByRole('checkbox', { name: 'Flag Media section', exact: true }).check();
  await expect(page.getByRole('checkbox', { name: /^Flag (Image|Video|Document)/ })).toHaveCount(0);
  await page.getByRole('textbox', { name: 'Review comment for Media section', exact: true }).fill('Add a current frontage photo and remove the outdated photo.');
  await checkWidth(page);
  await page.screenshot({ path: test.info().outputPath(`media-section-flagging-${width}.png`), animations: 'disabled' });
  await page.getByRole('button', { name: 'Review flags', exact: true }).click();
  const summary = page.getByRole('dialog', { name: 'Confirm flags for warehouse #4821', exact: true });
  await expect(summary.getByRole('link', { name: 'layout.pdf', exact: true })).toHaveCount(1);
  await summary.getByRole('button', { name: 'Confirm & flag for review', exact: true }).click();
  await expect(summary).not.toBeVisible();
  const r = await server.db.warehouseFieldReview.findFirst({ where: { warehouseId: 4821, closedAt: null }, include: { flags: true } });
  expect(r.flags.map(flag => flag.fieldKey)).toEqual(['media']);

  await page.goto(server.url + '/field-reviews?role=employee&review=' + r.id);
  const section = article(page);
  await section.getByRole('button', { name: 'Remove file 1', exact: true }).first().click();
  await section.locator('input[type=file]').setInputFiles({ name: 'replacement.jpg', mimeType: 'image/jpeg',
    buffer: Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+jR9sAAAAASUVORK5CYII=', 'base64') });
  await expect(section.getByRole('button', { name: 'Submit for verification', exact: true })).toBeEnabled();
  await expect(section.getByRole('button', { name: 'Remove file 1', exact: true })).toHaveCount(2);
  await section.getByLabel('Verification note *').fill('Uploaded the current frontage confirmed by the owner; the layout is still current.');
  await page.getByRole('tab', { name: 'All details', exact: true }).click();
  const details = page.locator('.warehouse-details-modal');
  await expect(details.getByText('Images (1)', { exact: true })).toBeVisible();
  expect((await server.db.warehouse.findUnique({ where: { id: 4821 } })).media).toEqual(media);
  await page.getByRole('tab', { name: /Flagged fields/ }).click();
  await section.getByRole('button', { name: 'Submit for verification', exact: true }).click();
  await expect(section.getByText('Awaiting reviewer', { exact: true })).toBeVisible();
  const submitted = await server.db.warehouseFieldFlag.findUnique({ where: { id: r.flags[0].id } });
  expect(submitted.proposedValue.images).toHaveLength(1);
  expect(submitted.proposedValue.images[0]).not.toBe(original);
  expect(submitted.proposedValue.docs).toEqual([document]);
  expect((await server.db.warehouse.findUnique({ where: { id: 4821 } })).media).toEqual(media);
  await checkWidth(page);
  await page.locator('.fr-modal .responsive-modal__body').evaluate(el => el.scrollTo({ top: 0, behavior: 'instant' }));
  await page.screenshot({ path: test.info().outputPath(`media-section-employee-${width}.png`), animations: 'disabled' });

  // The ordinary warehouse write is allowed while the review is awaiting approval.
  const current = { ...media, images: [] };
  await server.db.$transaction(async tx => {
    await tx.$queryRawUnsafe("SELECT set_config('wareongo.actor_email','editor@wareongo.com',true),set_config('wareongo.edit_source','Warehouse edit',true)");
    await tx.warehouse.update({ where: { id: 4821 }, data: { media: current, photos: document } });
  });
  await page.goto(server.url + '/field-reviews?role=admin&review=' + r.id);
  const comparison = article(page);
  await expect(comparison.getByText('The value changed while verification was pending.', { exact: true })).toBeVisible();
  for (const name of ['Keep current', 'Apply proposed', 'Restore baseline']) {
    await expect(comparison.getByRole('radio', { name: new RegExp(name) })).not.toBeChecked();
  }
  await comparison.getByText('Edit history', { exact: true }).click();
  await expect(comparison.locator('.fr-history-entry').filter({ hasText: 'editor@wareongo.com' })).toBeVisible();
  await checkWidth(page);
  await comparison.getByText('Edit history', { exact: true }).click();
  await page.locator('.fr-modal .responsive-modal__body').evaluate(el => el.scrollTo({ top: 0, behavior: 'instant' }));
  await page.screenshot({ path: test.info().outputPath(`media-section-comparison-${width}.png`), animations: 'disabled' });
  await comparison.getByRole('radio', { name: /Apply proposed/ }).check();
  await comparison.getByLabel('Why replace the current value? *').fill('The old photo was removed correctly. Apply the verified new frontage and retain the layout.');
  await comparison.getByRole('button', { name: 'Review replacement', exact: true }).click();
  const confirmation = page.getByRole('dialog', { name: 'Confirm replacement of the current value', exact: true });
  await confirmation.getByRole('button', { name: 'Confirm replacement & close', exact: true }).click();
  await expect(comparison.getByText('Verified & closed', { exact: true })).toBeVisible();
  expect((await server.db.warehouseFieldReview.findUnique({ where: { id: r.id } })).closedAt).not.toBeNull();
  expect((await server.db.warehouse.findUnique({ where: { id: 4821 } })).media).toEqual(submitted.proposedValue);
  expect(errors).toEqual([]);
});
