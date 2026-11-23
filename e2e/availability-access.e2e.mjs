import { test, expect } from '@playwright/test';
import { startFieldReviewServer } from './field-review-server.mjs';

let server;
test.beforeAll(async () => { server = await startFieldReviewServer(); }, 120_000);
test.afterAll(async () => { await server?.close(); });
test.beforeEach(async ({ page }) => {
  await server.seed();
  await page.route('**/*', route => new URL(route.request().url()).origin === server.url ? route.continue() : route.abort());
});

for (const width of [1280, 390]) test.describe(`Availability access at ${width}px`, () => {
  test.use({ viewport: { width, height: 900 }, isMobile: width < 768, hasTouch: width < 768 });
  test('edit-own saves the shared section on another warehouse without opening other edits', async ({ page }) => {
    const errors = [], contactRequests = [], payloads = [];
    page.on('pageerror', error => errors.push(error.message));
    page.on('request', req => {
      if (req.url().includes('/contact-number')) contactRequests.push(req.url());
      if (req.method() === 'PUT' && req.url().endsWith('/api/warehouses/4821')) payloads.push(req.postDataJSON());
    });
    const before = await server.db.warehouse.findUnique({ where: { id: 4821 }, include: { WarehouseData: true } });
    expect(before.status).toBeNull();
    expect(before.handoverDate).toBeNull();
    await page.goto(server.url + '/dashboard-reference?role=reviewer');
    const edit = page.getByRole('button', { name: /Edit availability$/ });
    await expect(edit).toBeVisible();
    await expect(page.getByRole('button', { name: /Toggle visibility/ })).toHaveCount(0);
    await edit.click();
    const form = page.locator('.warehouse-form-modal');
    await expect(form.getByRole('heading', { name: 'Edit Availability — #4821' })).toBeVisible();
    for (const label of ['Address', 'Contact Number', 'Listing Type', 'State', 'Visibility']) {
      await expect(form.getByLabel(new RegExp(`^${label}`))).toBeDisabled();
    }
    await expect(form.getByRole('button', { name: 'Add Files' })).toBeDisabled();
    for (const control of await form.locator('.warehouse-form-protected-fields input, .warehouse-form-protected-fields select, .warehouse-form-protected-fields textarea, .warehouse-form-protected-fields button').all()) {
      await expect(control).toBeDisabled();
    }
    await expect(form.getByLabel(/^Address/)).toHaveValue(before.address);
    await expect(form.getByRole('button', { name: /Add visit note/i })).toHaveCount(0);
    await form.getByLabel('Availability', { exact: true }).selectOption('No');
    await form.getByLabel('Status', { exact: true }).selectOption('Under construction');
    const save = async (expectedStatus = 200) => {
      await form.getByRole('button', { name: 'Update availability' }).click();
      const confirm = page.getByRole('button', { name: 'Yes, Update', exact: true });
      await expect.poll(() => confirm.evaluate(el => {
        const box = el.getBoundingClientRect();
        return el.contains(document.elementFromPoint(box.x + box.width / 2, box.y + box.height / 2));
      })).toBe(true);
      const saved = page.waitForResponse(res => res.request().method() === 'PUT' && res.url().endsWith('/api/warehouses/4821'));
      await confirm.click();
      expect((await saved).status()).toBe(expectedStatus);
      if (expectedStatus === 200) await expect(form).toHaveCount(0);
      else {
        await expect(form).toBeVisible();
        await expect(confirm).toHaveCount(0);
      }
    };
    await save();
    let stored = await server.db.warehouse.findUnique({ where: { id: 4821 }, include: { WarehouseData: true } });
    expect(stored).toMatchObject({ availability: 'No', status: 'Under construction', handoverDate: null,
      uploadedBy: before.uploadedBy, contactNumber: before.contactNumber, visibility: before.visibility,
      lastEditedBy: 'reviewer@wareongo.com', WarehouseData: before.WarehouseData });

    // Reopen after the first save, exercising both the restricted form and the
    // confirmation portal lifecycle that previously stalled repeat reviews.
    await edit.click();
    await expect(form.getByLabel('Status', { exact: true })).toHaveValue('Under construction');
    await server.db.warehouse.update({ where: { id: 4821 }, data: { status: 'Ready to move' } });
    await form.getByLabel('Handover mode').selectOption('Variable');
    await form.getByLabel('Handover lead time').fill('2');
    await form.getByRole('button', { name: 'Update availability' }).click();
    await expect(form.getByLabel('Handover unit')).toHaveAttribute('aria-invalid', 'true');
    expect(payloads).toHaveLength(1);
    await form.getByLabel('Handover unit').selectOption('Months');
    const lockIn = form.getByLabel('Lock-in Date');
    await lockIn.fill('10/01/2027');
    await lockIn.press('Enter');
    // Frame the active section between greyed-out fields for the image preview.
    await form.getByText('Availability', { exact: true }).first().evaluate(el => {
      el.scrollIntoView({ block: 'start' });
      const scroller = [...document.querySelectorAll('.warehouse-form-fields, .responsive-modal__body')]
        .find(node => ['auto', 'scroll'].includes(getComputedStyle(node).overflowY)
          && node.scrollHeight > node.clientHeight + 1 && node.contains(el));
      if (scroller) scroller.scrollTop -= 24;
    });
    await form.getByText('Availability', { exact: true }).first().click();
    expect(await form.locator('.responsive-modal__body').evaluate(el => el.scrollWidth <= el.clientWidth + 1)).toBe(true);
    await page.screenshot({ path: test.info().outputPath(`availability-access-${width}.png`), animations: 'disabled' });
    await save();
    stored = await server.db.warehouse.findUnique({ where: { id: 4821 } });
    expect(stored).toMatchObject({ handoverType: 'VARIABLE', handoverLeadValue: 2, handoverLeadUnit: 'MONTHS',
      status: 'Ready to move', lockInDate: new Date('2027-01-10T00:00:00Z'), contactNumber: before.contactNumber, uploadedBy: before.uploadedBy });

    await edit.click();
    await expect(form.getByLabel('Status', { exact: true })).toHaveValue('Ready to move');
    await server.db.warehouse.update({ where: { id: 4821 }, data: { status: 'Under construction' } });
    await form.getByLabel('Status', { exact: true }).selectOption('Build to suit');
    await save(409);
    await expect(page.getByText(/Warehouse details changed while this form was open/).first()).toBeVisible();
    await expect(form.getByLabel('Status', { exact: true })).toHaveValue('Build to suit');
    expect(payloads).toHaveLength(3); // Conflicts are not retried.
    expect((await server.db.warehouse.findUnique({ where: { id: 4821 } })).status).toBe('Under construction');
    await form.getByRole('button', { name: 'Cancel', exact: true }).click();
    await expect(form).toHaveCount(0);

    // Viewing the same record keeps the ordinary details presentation.
    await page.getByRole('button', { name: /View$/ }).click();
    const details = page.locator('.responsive-modal').filter({ has: page.getByText('Owner Details', { exact: true }) });
    await expect(details.getByText('Availability', { exact: true }).first()).toBeVisible();
    await expect(details.locator('.warehouse-form-protected-fields')).toHaveCount(0);
    for (const payload of payloads) {
      expect(Object.keys(payload).every(key => ['availability', 'availabilityLastReviewedOn', 'expectedAvailability',
        'expectedFormValues', 'status', 'lockInDate', 'handoverType', 'handoverDate', 'handoverLeadValue', 'handoverLeadUnit'].includes(key))).toBe(true);
    }
    expect(contactRequests).toEqual([]);
    expect(errors).toEqual([]);
  });
});
