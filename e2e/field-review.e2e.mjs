import { randomUUID } from 'node:crypto';
import { test, expect } from '@playwright/test';
import { startFieldReviewServer } from './field-review-server.mjs';
let server;
test.beforeAll(async () => {
  test.setTimeout(120000);
  server = await startFieldReviewServer();
});
test.afterAll(async () => {
  await server?.close();
});
test.beforeEach(async ({
  page
}) => {
  await server.seed();
  await page.route('**/*', route => new URL(route.request().url()).origin === server.url ? route.continue() : route.abort());
  page.reviewErrors = [];
  page.on('pageerror', error => page.reviewErrors.push(error.message));
});
test.afterEach(async ({
  page
}) => expect(page.reviewErrors).toEqual([]));
const flag = (page, label) => page.getByRole('article', {
  name: label,
  exact: true
});
async function modalAboveNavigation(page) {
  const modal=page.locator('.responsive-modal[role="dialog"]');
  const heading=modal.getByRole('heading').first();
  await expect(heading).toBeVisible();
  await expect.poll(()=>heading.evaluate(element=>{
    const box=element.getBoundingClientRect();
    const top=document.elementFromPoint(box.left+Math.min(box.width/2,80),box.top+box.height/2);
    return !!top&&!!top.closest('.responsive-modal');
  })).toBe(true);
}
async function noOverflow(page) {
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1)).toBe(true);
  for (const body of await page.locator('.responsive-modal__body').all()) expect(await body.evaluate(e => e.scrollWidth <= e.clientWidth + 1)).toBe(true);
}
for (const width of [1280, 390]) test.describe('field review at ' + width + 'px', () => {
  test.use({
    viewport: {
      width,
      height: 900
    },
    isMobile: width < 768,
    hasTouch: width < 768
  });
  test('unassigned viewers see active field highlights in normal View', async ({ page }) => {
    const reviewer = { email: 'reviewer@wareongo.com' }, employee = { email: 'employee@wareongo.com' };
    const notes = { ratePerSqft: 'Confirm the quoted rent.', contactNumber: 'Check the owner contact.',
      availabilityReview: 'Confirm availability and its review date.', passengerLiftCount: 'Check the lift count.' };
    let review = await server.service.create({ requestId: randomUUID(), warehouseId: 4821,
      fields: Object.entries(notes).map(([key, comment]) => ({ key, comment })),
    }, reviewer);
    let rate = review.flags.find(item => item.fieldKey === 'ratePerSqft');
    review = await server.service.respond(review.id, rate.id, { requestId: randomUUID(), version: rate.version,
      baselineVersion: rate.currentVersion, resolution: 'CORRECTION', proposedValue: '24', explanation: 'Owner confirmed the rent.' }, employee);
    let summaryRequests = 0;
    page.on('request', req => { if (new URL(req.url()).pathname === '/api/field-reviews/summaries') summaryRequests++; });
    await page.goto(server.url + '/dashboard-reference?role=observer');
    await expect(page.getByText('Flagged for review · 4 fields', { exact: true })).toBeVisible();
    await expect(page.getByRole('link', { name: 'Flagged for review · 4 fields', exact: true })).toHaveCount(0);
    await page.getByRole('button', { name: /View$/ }).click();
    const modal = page.locator('.warehouse-details-modal');
    for (const label of ['Rate per sq ft', 'Contact Number', 'Availability', 'Availability last reviewed', 'Number of Passenger Lifts']) {
      await expect(modal.getByLabel(label + ' is flagged for review', { exact: true })).toBeVisible();
    }
    await expect(modal.locator('[data-review-field="ratePerSqft"]')).toContainText('22');
    await expect(modal.locator('[data-review-field="city"]')).not.toHaveClass(/fr-flag-field--active/);
    await expect(modal.getByRole('button', { name: 'Flag for review (beta)', exact: true })).toHaveCount(0);
    for (const [key, note] of Object.entries(notes)) {
      for (const field of await modal.locator('[data-review-field="' + key + '"]').all()) {
        await expect(field.getByRole('note')).toContainText(note);
      }
    }
    expect(summaryRequests).toBe(0);
    await expect(modal.getByText('Owner confirmed the rent.', { exact: true })).toHaveCount(0);
    await expect(modal.getByText('+919999999999', { exact: true })).toHaveCount(0);
    await noOverflow(page);
    await modal.getByLabel('Availability is flagged for review', { exact: true }).scrollIntoViewIfNeeded();
    await page.screenshot({ path: test.info().outputPath('observer-field-flags-' + width + '.png'), animations: 'disabled' });
    const session = await (await page.request.get(server.url + '/fixture/session/observer')).json();
    const detail = await page.request.get(server.url + '/api/field-reviews/' + review.id, {
      headers: { Authorization: 'Bearer ' + session.token },
    });
    expect(detail.status()).toBe(403);
    rate = review.flags.find(item => item.fieldKey === 'ratePerSqft');
    review = await server.service.decide(review.id, rate.id, { requestId: randomUUID(), version: rate.version,
      currentVersion: rate.currentVersion, choice: 'PROPOSED' }, reviewer);
    // Hold a later refresh so its loading animation is exercised deterministically.
    // Fail the independent list refresh: reopening must keep the newer modal
    // result instead of restoring the older bundle retained by the cards.
    const failList = route => route.fulfill({ status: 503, json: { error: 'Temporary list failure.' } });
    await page.route('**/api/warehouses?*', failList);
    let releaseRefresh;
    const refreshGate = new Promise(resolve => { releaseRefresh = resolve; });
    await page.route('**/api/field-reviews/summaries?*', async route => { await refreshGate; await route.continue(); });
    await page.evaluate(() => window.dispatchEvent(new Event('warehouse-field-review-updated')));
    await expect(modal.getByText('Refreshing review flags and notes…', { exact: true })).toBeVisible();
    await expect(modal.locator('.fr-review-loading .ant-spin-spinning')).toBeVisible();
    releaseRefresh();
    await expect(modal.getByText('3 flagged fields are highlighted below.', { exact: true })).toBeVisible();
    await expect(modal.getByRole('note', { name: 'Rate per sq ft review note', exact: true })).toHaveCount(0);
    await modal.getByRole('button', { name: 'Close', exact: true }).click();
    await expect(page.getByText('Error: Service temporarily unavailable - please try again later', { exact: true })).toBeVisible();
    await expect(page.getByText('Flagged for review · 4 fields', { exact: true })).toBeVisible();
    await page.getByRole('button', { name: /View$/ }).click();
    await expect(modal.getByText('3 flagged fields are highlighted below.', { exact: true })).toBeVisible();
    await expect(modal.getByLabel('Rate per sq ft is flagged for review', { exact: true })).toHaveCount(0);
    await expect(modal.getByRole('note', { name: 'Rate per sq ft review note', exact: true })).toHaveCount(0);
    await page.unroute('**/api/warehouses?*', failList);
    rate = review.flags.find(item => item.fieldKey === 'ratePerSqft');
    await server.service.reopen(review.id, rate.id, { requestId: randomUUID(), version: rate.version }, reviewer);
    await modal.getByRole('button', { name: 'Close', exact: true }).click();
    const reloaded = page.waitForResponse(response => new URL(response.url()).pathname === '/api/warehouses' && response.status() === 200);
    await page.evaluate(() => window.dispatchEvent(new Event('warehouse-field-review-updated')));
    await reloaded;
    await expect(page.getByText('Flagged for review · 4 fields', { exact: true })).toBeVisible();
    await page.getByRole('button', { name: /View$/ }).click();
    await expect(modal.getByLabel('Rate per sq ft is flagged for review', { exact: true })).toBeVisible();
  });
  test('can flag blank handover and status on successive warehouses without reloading', async ({ page }) => {
    const first = await server.db.warehouse.update({ where: { id: 4821 }, data: {
      handoverType: 'FIXED', handoverDate: null, handoverLeadValue: null, handoverLeadUnit: null, status: null
    } });
    await server.db.warehouse.create({ data: { ...first, id: 4822 } });
    // Use the production dashboard: it retains the selected warehouse when its
    // details close. The simpler fixture dashboard clears it and hid this bug.
    await page.route(url => url.origin === server.url && url.pathname === '/api/warehouses', async route => {
      const response = await route.fetch({ url: server.url + '/api/fixture/warehouses' });
      const rows = await response.json();
      await route.fulfill({ json: { data: rows, pagination: { page: 1, limit: 20, total: rows.length, totalPages: 1 } } });
    });
    await page.goto(server.url + '/dashboard-reference?role=admin');
    let createRequests = 0;
    page.on('request', request => {
      if (request.method() === 'POST' && new URL(request.url()).pathname === '/api/field-reviews') createRequests++;
    });
    for (const warehouseId of [4821, 4822]) {
      const card = page.locator('.simple-warehouse-card').filter({
        has: page.getByRole('button', { name: 'Copy warehouse ID ' + warehouseId, exact: true })
      });
      await card.getByRole('button', { name: /View$/ }).click();
      await page.getByRole('button', { name: 'Flag for review (beta)', exact: true }).click();
      for (const label of ['Handover', 'Status']) {
        await page.getByRole('checkbox', { name: 'Flag ' + label, exact: true }).check();
        await page.getByRole('textbox', { name: 'Review comment for ' + label, exact: true }).fill('Confirm the missing ' + label.toLowerCase() + '.');
      }
      await page.getByRole('button', { name: 'Review flags', exact: true }).click();
      const confirmation = page.getByRole('dialog', { name: 'Confirm flags for warehouse #' + warehouseId, exact: true });
      const submit = confirmation.getByRole('button', { name: 'Confirm & flag for review', exact: true });
      await expect(submit).toBeVisible();
      // Visibility alone passes even when the entire dialog is covered.
      await expect.poll(() => submit.evaluate(button => {
        const rect = button.getBoundingClientRect();
        return button.contains(document.elementFromPoint(rect.x + rect.width / 2, rect.y + rect.height / 2));
      })).toBe(true);
      await confirmation.getByLabel('Assign review to').focus();
      await expect(confirmation.getByLabel('Assign review to')).toBeFocused();
      await confirmation.getByRole('button', { name: 'Back to fields', exact: true }).click();
      await expect(confirmation).not.toBeVisible();
      await expect(page.getByRole('button', { name: 'Review flags', exact: true })).toBeFocused();
      await expect(page.getByRole('textbox', { name: 'Review comment for Handover', exact: true })).toHaveValue('Confirm the missing handover.');
      await page.getByRole('button', { name: 'Review flags', exact: true }).click();
      await submit.click();
      await expect(confirmation).not.toBeVisible();
      const flags = await server.db.warehouseFieldFlag.findMany({ where: { warehouseId }, select: { fieldKey: true, originalValue: true } });
      expect(flags.map(flag => flag.fieldKey).sort()).toEqual(['handover', 'status']);
      expect(flags.find(flag => flag.fieldKey === 'status').originalValue).toBeNull();
      expect(flags.find(flag => flag.fieldKey === 'handover').originalValue.handoverDate).toBeNull();
      await page.locator('.warehouse-details-modal').getByRole('button', { name: 'Close', exact: true }).click();
      await expect(page.locator('.warehouse-details-modal')).not.toBeVisible();
    }
    expect(createRequests).toBe(2);
  });
  test('nested verification failures stay visible and can be retried after reopening', async ({ page }) => {
    const admin = { email: 'admin@wareongo.com' }, employee = { email: 'employee@wareongo.com' };
    let review = await server.service.create({ requestId: randomUUID(), warehouseId: 4821,
      fields: [{ key: 'totalSpaceSqft', comment: 'Confirm usable area.' }, { key: 'contactNumber', comment: 'Confirm the contact.' }]
    }, admin);
    let areaFlag = review.flags.find(item => item.fieldKey === 'totalSpaceSqft');
    review = await server.service.respond(review.id, areaFlag.id, { requestId: randomUUID(), version: areaFlag.version,
      baselineVersion: areaFlag.currentVersion, resolution: 'CORRECTION', proposedValue: [48000], explanation: 'Owner confirmed.' }, employee);
    await server.db.warehouse.update({ where: { id: 4821 }, data: { totalSpaceSqft: [52000] } });
    await page.goto(server.url + '/field-reviews?role=admin&review=' + review.id);
    const area = flag(page, 'Offered Area (sq ft)');
    await area.getByRole('radio', { name: /Apply proposed/ }).check();
    await area.getByLabel('Why replace the current value? *').fill('Owner reconfirmed the correction.');
    await area.getByRole('button', { name: 'Review replacement', exact: true }).click();
    const confirmation = page.getByRole('dialog', { name: 'Confirm replacement of the current value', exact: true });
    await page.route('**/flags/*/decision', route => route.fulfill({ status: 503,
      json: { error: { message: 'Verification is temporarily unavailable. Please retry.' } } }), { times: 1 });
    await confirmation.getByRole('button', { name: 'Confirm replacement & close', exact: true }).click();
    await expect(confirmation.getByRole('alert')).toContainText('Verification is temporarily unavailable. Please retry.');
    expect((await server.db.warehouse.findUnique({ where: { id: 4821 } })).totalSpaceSqft).toEqual([52000]);
    await confirmation.getByRole('button', { name: 'Cancel', exact: true }).click();
    await expect(area.getByRole('button', { name: /Review replacement$/ })).toBeFocused();
    await expect(area.getByRole('button', { name: /Review replacement$/ })).not.toHaveClass(/ant-btn-loading/);
    await page.getByRole('tab', { name: 'All details', exact: true }).click();
    await page.getByRole('tab', { name: /Flagged fields/ }).click();
    await expect(area.getByLabel('Why replace the current value? *')).toHaveValue('Owner reconfirmed the correction.');
    await area.getByRole('button', { name: 'Review replacement', exact: true }).click();
    await confirmation.getByRole('button', { name: 'Confirm replacement & close', exact: true }).click();
    await expect(confirmation).not.toBeVisible();
    await expect(area.getByText('Verified & closed', { exact: true })).toBeVisible();
    expect((await server.db.warehouse.findUnique({ where: { id: 4821 } })).totalSpaceSqft).toEqual([48000]);
    await page.getByRole('button', { name: 'Back to queue', exact: true }).click();
    await page.getByText(/^Awaiting employee \(/).click();
    await page.getByRole('button', { name: 'Review flags', exact: true }).click();
    await area.getByRole('button', { name: 'Reopen flag', exact: true }).click();
    const reopening = page.getByRole('dialog', { name: 'Reopen this field?', exact: true });
    await page.route('**/flags/*/reopen', route => route.fulfill({ status: 503,
      json: { error: { message: 'Reopening is temporarily unavailable. Please retry.' } } }), { times: 1 });
    const reopenButton = reopening.getByRole('button', { name: /Reopen flag$/ });
    await reopenButton.click();
    await expect(reopening.getByRole('alert')).toContainText('Reopening is temporarily unavailable. Please retry.');
    await expect(reopenButton).not.toHaveClass(/ant-btn-loading/);
    await reopenButton.click();
    await expect(reopening).not.toBeVisible();
    await expect(area.getByText('Needs response', { exact: true })).toBeVisible();
  });
  test('protected-value prompts remain usable across cancel, tab switches and request failure', async ({ page }) => {
    const review = await server.service.create({ requestId: randomUUID(), warehouseId: 4821,
      fields: [{ key: 'contactNumber', comment: 'Confirm the contact.' }] }, { email: 'admin@wareongo.com' });
    await page.goto(server.url + '/field-reviews?role=admin&review=' + review.id);
    const contact = flag(page, 'Contact Number');
    const reveal = page.getByRole('dialog', { name: 'Reveal protected review values', exact: true });
    await contact.getByRole('button', { name: 'Reveal protected values', exact: true }).click();
    await reveal.getByLabel('Reason for access *').fill('Confirm the owner for this review.');
    await reveal.getByLabel('Reason for access *').press('Escape');
    await expect(reveal).not.toBeVisible();
    await expect(contact.getByRole('button', { name: 'Reveal protected values', exact: true })).toBeFocused();
    await page.getByRole('tab', { name: 'All details', exact: true }).click();
    await page.locator('.warehouse-details-modal').getByRole('button', { name: 'Show Number' }).click();
    const phone = page.getByRole('dialog', { name: 'Reveal contact number' });
    await phone.getByRole('textbox', { name: 'Reason for revealing' }).fill('Warehouse audit.');
    await phone.getByRole('textbox', { name: 'Reason for revealing' }).press('Escape');
    await expect(phone).not.toBeVisible();
    await expect(page.locator('.warehouse-details-modal').getByRole('button', { name: 'Show Number' })).toBeFocused();
    await page.getByRole('tab', { name: /Flagged fields/ }).click();
    await contact.getByRole('button', { name: 'Reveal protected values', exact: true }).click();
    await reveal.getByLabel('Reason for access *').fill('Confirm the owner for this review.');
    await page.route('**/flags/*/reveal', route => route.fulfill({ status: 503,
      json: { error: { message: 'Reveal unavailable. Please retry.' } } }), { times: 1 });
    await reveal.getByRole('button', { name: 'Reveal values', exact: true }).click();
    await expect(reveal).toContainText('Reveal unavailable. Please retry.');
    await expect(reveal.getByLabel('Reason for access *')).toHaveValue('Confirm the owner for this review.');
    await reveal.getByRole('button', { name: 'Reveal values', exact: true }).click();
    await expect(reveal).not.toBeVisible();
    await expect(contact).toContainText('+919999999999');
  });
  test('dashboard filters and pagination work across the assigned queue', async ({ page }) => {
    const template = await server.db.warehouse.findUnique({ where: { id: 4821 } });
    for (let index = 1; index <= 21; index++) {
      await server.db.warehouse.create({ data: { ...template, id: 4821 + index,
        city: index % 2 ? 'Ahmedabad' : 'Bhiwandi',
        state: index % 2 ? 'Gujarat' : 'Maharashtra',
        warehouseType: index % 2 ? 'RCC' : 'PEB', warehouseOwnerType: 'Individual',
        totalSpaceSqft: [20000 + index * 1000], ratePerSqft: String(18 + index % 8)
      } });
    }
    const reviews = [];
    for (let warehouseId = 4821; warehouseId <= 4842; warehouseId++) {
      reviews.push(await server.service.create({ requestId: randomUUID(), warehouseId, assigneeId: 2,
        fields: [{ key: 'ratePerSqft', comment: 'Confirm the current rate with the owner.' }]
      }, { email: 'admin@wareongo.com' }));
    }
    const completed = reviews[0];
    const response = await server.service.respond(completed.id, completed.flags[0].id, {
      requestId: randomUUID(), version: completed.flags[0].version,
      baselineVersion: completed.flags[0].currentVersion,
      resolution: 'NO_CHANGE', explanation: 'Owner confirmed the current rate.'
    }, { email: 'employee@wareongo.com' });
    await server.service.decide(completed.id, completed.flags[0].id, {
      requestId: randomUUID(), version: response.flags[0].version,
      currentVersion: response.flags[0].currentVersion, choice: 'PROPOSED'
    }, { email: 'admin@wareongo.com' });

    await page.goto(server.url + '/field-reviews?role=employee');
    const cards = page.locator('.simple-warehouse-card:not(.simple-warehouse-card--skeleton)');
    await expect(cards).toHaveCount(20);
    await expect(page.getByText(width < 768 ? 'Current (21)' : 'Currently flagged (21)', { exact: true })).toBeVisible();
    await page.getByRole('button', { name: 'Filters', exact: true }).click();
    await noOverflow(page);
    await page.screenshot({ path: test.info().outputPath('queue-filters-' + width + '.png'), animations: 'disabled' });
    await page.getByRole('button', { name: 'Filters', exact: true }).click();
    if (width < 768) await page.getByRole('button', { name: 'Next page', exact: true }).click();
    else await page.locator('.ant-pagination-next').click();
    await expect(cards).toHaveCount(1);
    await page.getByRole('button', { name: 'Filters', exact: true }).click();
    await page.getByLabel('City', { exact: true }).fill('Bhiwandi');
    await expect(cards).toHaveCount(10);
    await expect(page.getByText('10 of 10 results', { exact: true })).toBeVisible();
    await page.getByText(width < 768 ? 'Previous (1)' : 'Previously flagged (1)', { exact: true }).click();
    await expect(cards).toHaveCount(1);
    await expect(cards.first()).toContainText('#4821');
    await expect(page.getByLabel('City', { exact: true })).toHaveValue('Bhiwandi');
    await page.getByLabel('Applied filters').getByRole('button', { name: 'Clear All Filters', exact: true }).click();
    await expect(page.getByLabel('City', { exact: true })).toHaveValue('');
    await page.getByText(width < 768 ? 'Current (21)' : 'Currently flagged (21)', { exact: true }).click();
    await expect(cards).toHaveCount(20);
    await page.getByRole('textbox', { name: 'Search field reviews', exact: true }).fill('4822, 4823');
    await expect(cards).toHaveCount(2);
    await noOverflow(page);
  });
  for (const managerRole of ['admin', 'reviewer']) test(managerRole + ' can create in current view, respond, verify conflict and no-change, then reopen', async ({
    page
  }) => {
    await page.goto(server.url + '/dashboard?role=' + managerRole);
    await page.getByRole('button', {
      name: /View$/
    }).click();
    await modalAboveNavigation(page);
    await page.getByRole('button', {
      name: 'Flag for review (beta)',
      exact: true
    }).click();
    await page.getByRole('checkbox', {
      name: 'Flag Offered Area (sq ft)',
      exact: true
    }).check();
    await page.getByRole('textbox', {
      name: 'Review comment for Offered Area (sq ft)',
      exact: true
    }).fill('Confirm usable area against the latest layout.');
    await page.getByRole('checkbox', {
      name: 'Flag Number of Docks',
      exact: true
    }).check();
    await page.getByRole('textbox', {
      name: 'Review comment for Number of Docks',
      exact: true
    }).fill('Confirm all six docks are operational.');
    await noOverflow(page);
    await page.getByRole('button', {
      name: 'Review flags',
      exact: true
    }).click();
    await expect(page.getByLabel('Assign review to')).toHaveValue('2');
    await page.screenshot({
      path: test.info().outputPath(managerRole + '-confirm-' + width + '.png'),
      fullPage: false,
      animations: 'disabled'
    });
    await page.getByRole('button', {
      name: 'Confirm & flag for review',
      exact: true
    }).click();
    await expect(page.getByRole('button', {
      name: 'Flag for review (beta)',
      exact: true
    })).toBeVisible();
    await expect(page.getByRole('dialog', {
      name: 'Confirm flags for warehouse #4821',
      exact: true
    })).not.toBeVisible();
    await page.locator('.warehouse-details-modal').getByRole('button', {
      name: 'Close',
      exact: true
    }).click();
    await expect(page.getByRole('link', {
      name: 'Flagged for review · 2 fields',
      exact: true
    })).toBeVisible();
    const records = await server.db.warehouseFieldReview.findMany();
    expect(records).toHaveLength(1);
    const reviewId = records[0].id;
    expect(records[0].assigneeId).toBe(2);
    expect(records[0].createdBy).toBe(managerRole + '@wareongo.com');
    await page.goto(server.url + '/dashboard?role=employee');
    if (width < 768) {
      await page.getByRole('button', { name: 'Toggle navigation menu', exact: true }).click();
      await page.getByRole('menuitem', { name: /Flagged for review \(beta\)$/ }).click();
    } else {
      await page.getByRole('link', { name: /Flagged for review \(beta\)$/ }).click();
    }
    await page.getByRole('button', {
      name: 'Review fields',
      exact: true
    }).click();
    const area = flag(page, 'Offered Area (sq ft)'),
      docks = flag(page, 'Number of Docks');
    await expect(page.getByRole('button', {
      name: /^(Accept|Approve|Reject)/i
    })).toHaveCount(0);
    await area.getByLabel('Proposed Offered Area (sq ft)', {
      exact: true
    }).fill('48000');
    await area.getByLabel('Verification note *', {
      exact: true
    }).fill('Owner confirmed 48000 usable square feet.');
    await page.getByRole('tab', {
      name: 'All details',
      exact: true
    }).click();
    await expect(page.locator('.warehouse-details-modal')).toBeVisible();
    await modalAboveNavigation(page);
    await expect(page.getByText('Owner Details', {
      exact: true
    })).toBeVisible();
    await expect(page.getByText('50000', {
      exact: true
    })).toBeVisible();
    await page.screenshot({
      path: test.info().outputPath('normal-all-details-' + width + '.png'),
      fullPage: false,
      animations: 'disabled'
    });
    await page.getByRole('tab', {
      name: /Flagged fields/
    }).click();
    await expect(area.getByLabel('Proposed Offered Area (sq ft)', {
      exact: true
    })).toHaveValue('48000');
    await area.getByRole('button', {
      name: 'Submit for verification',
      exact: true
    }).click();
    await expect(area.getByText('Awaiting reviewer', {
      exact: true
    })).toBeVisible();
    expect((await server.db.warehouse.findUnique({
      where: {
        id: 4821
      }
    })).totalSpaceSqft).toEqual([50000]);
    await docks.getByRole('button', {
      name: 'No change needed',
      exact: true
    }).click();
    await docks.getByRole('button', {
      name: 'Submit for verification',
      exact: true
    }).click();
    await expect(docks.getByRole('alert')).toContainText('Explain what you checked');
    await docks.getByLabel('How did you verify this? *', {
      exact: true
    }).fill('Inspected all six operational docks.');
    await docks.getByRole('button', {
      name: 'Submit for verification',
      exact: true
    }).click();
    await expect(docks.getByText('Awaiting reviewer', {
      exact: true
    })).toBeVisible();
    await noOverflow(page);
    await page.locator('.fr-modal .responsive-modal__body').evaluate(e=>e.scrollTo({top:0,behavior:'instant'}));
    await page.screenshot({
      path: test.info().outputPath('employee-awaiting-' + width + '.png'),
      fullPage: false,
      animations: 'disabled'
    });
    await server.db.$transaction(async tx => {
      await tx.$queryRawUnsafe("SELECT set_config('wareongo.actor_email','editor@wareongo.com',true)");
      await tx.warehouse.update({
        where: {
          id: 4821
        },
        data: {
          totalSpaceSqft: [52000]
        }
      });
    });
    await page.goto(server.url + '/field-reviews?role=' + managerRole + '&review=' + reviewId);
    await expect(area.getByText('Baseline', {
      exact: true
    })).toBeVisible();
    await expect(area.getByRole('radio', {
      name: /Keep current/
    })).not.toBeChecked();
    await area.getByText('Edit history', {
      exact: true
    }).click();
    await expect(area.getByText(/editor@wareongo.com/)).toBeVisible();
    await noOverflow(page);
    await page.screenshot({
      path: test.info().outputPath(managerRole + '-conflict-' + width + '.png'),
      fullPage: false,
      animations: 'disabled'
    });
    await area.getByRole('radio', {
      name: /Apply proposed/
    }).check();
    await area.getByLabel('Why replace the current value? *', {
      exact: true
    }).fill('Confirmed the owner correction after reviewing the later edit.');
    await area.getByRole('button', {
      name: 'Review replacement',
      exact: true
    }).click();
    await page.getByRole('button', {
      name: 'Confirm replacement & close',
      exact: true
    }).click();
    await expect(area.getByText('Verified & closed', {
      exact: true
    })).toBeVisible();
    expect((await server.db.warehouse.findUnique({
      where: {
        id: 4821
      }
    })).totalSpaceSqft).toEqual([48000]);
    await docks.getByRole('button', {
      name: 'Verify & close',
      exact: true
    }).click();
    await expect(docks.getByText('Verified & closed', {
      exact: true
    })).toBeVisible();
    const complete = await server.db.warehouseFieldReview.findUnique({
      where: {
        id: reviewId
      }
    });
    expect(complete.closedAt).not.toBeNull();
    expect(await server.db.verifiedNumber.findUnique({ where: { id: 2 } })).toMatchObject({
      editOwnWarehouseEntries: false, editAllWarehouseEntries: false,
    });
    await page.goto(server.url + '/field-reviews?role=employee&review=' + reviewId);
    await expect(area.getByText('Verified & closed', { exact: true })).toBeVisible();
    await expect(docks.getByText('Verified & closed', { exact: true })).toBeVisible();
    await expect(page.getByRole('button', { name: 'Submit for verification', exact: true })).toHaveCount(0);
    await expect(area.getByLabel('Proposed Offered Area (sq ft)', { exact: true })).toHaveCount(0);
    await page.goto(server.url + '/field-reviews?role=' + managerRole + '&review=' + reviewId);
    await expect(area.getByText('Verified & closed', { exact: true })).toBeVisible();
    await page.getByRole('button', {
      name: 'Back to queue',
      exact: true
    }).click();
    await page.getByText('Previously flagged (1)', {
      exact: true
    }).click();
    await expect(page.getByRole('button', {
      name: 'View history',
      exact: true
    })).toBeVisible();
    await page.getByRole('button', {
      name: 'View history',
      exact: true
    }).click();
    await area.getByRole('button', {
      name: 'Reopen flag',
      exact: true
    }).click();
    await page.getByRole('dialog', {
      name: 'Reopen this field?'
    }).getByRole('button', {
      name: 'Reopen flag',
      exact: true
    }).click();
    await expect(area.getByText('Needs response', {
      exact: true
    })).toBeVisible();
    expect((await server.db.warehouse.findUnique({
      where: {
        id: 4821
      }
    })).totalSpaceSqft).toEqual([48000]);
    await page.goto(server.url + '/field-reviews?role=employee&review=' + reviewId);
    await expect(area.getByRole('button', { name: 'Submit for verification', exact: true })).toBeEnabled();
    await expect(docks.getByRole('button', { name: 'Submit for verification', exact: true })).toHaveCount(0);
  });
  test('uses the current form controls and stages only the proposed values', async ({ page }) => {
    const keys = ['handover', 'state', 'city', 'totalSpaceSqft', 'clearHeightFt', 'warehouseData.dimensions'];
    const review = await server.service.create({ requestId: randomUUID(), warehouseId: 4821,
      fields: keys.map(key => ({ key, comment: 'Confirm this value with the owner.' })),
    }, { email: 'admin@wareongo.com' });
    await page.goto(server.url + '/field-reviews?role=employee&review=' + review.id);
    await modalAboveNavigation(page);
    const state = flag(page, 'State'), city = flag(page, 'City');
    await state.getByRole('combobox', { name: 'Proposed State' }).fill('Karnataka');
    await state.getByRole('option', { name: 'Karnataka', exact: true }).click();
    await city.getByRole('combobox', { name: 'Proposed City' }).fill('Bangalore');
    await city.getByRole('option', { name: 'Bangalore', exact: true }).click();
    const handover = flag(page, 'Handover');
    await handover.getByLabel('Proposed handover mode').selectOption('Variable');
    await expect(handover.getByLabel('Proposed handover unit')).toHaveValue('');
    await handover.getByLabel('Proposed handover lead time').fill('3');
    await handover.getByLabel('Proposed handover unit').selectOption('Weeks');
    await noOverflow(page);
    await handover.scrollIntoViewIfNeeded();
    await page.screenshot({ path: test.info().outputPath('synced-handover-' + width + '.png'), animations: 'disabled' });
    const area = flag(page, 'Offered Area (sq ft)');
    await area.getByRole('button', { name: 'Add Space Value' }).click();
    await area.getByLabel('Proposed Offered Area (sq ft) · Space 2').fill('24000');
    const height = flag(page, 'Clear Height');
    await height.getByLabel('Clear Height value').fill('50x');
    await expect(height.getByRole('alert')).toHaveText('Use digits and at most one decimal point (e.g. 50.5).');
    await height.getByLabel('Clear Height value').fill('50.5');
    await height.getByLabel('Clear Height unit').selectOption('metres');
    const dimensions = flag(page, 'Dimensions');
    for (const [part, value] of [['length', '240'], ['width', '200'], ['height', '32']]) {
      await dimensions.getByLabel('Dimensions ' + part).fill(value);
    }
    await dimensions.getByLabel('Dimensions unit').selectOption('feet');
    await dimensions.scrollIntoViewIfNeeded();
    await noOverflow(page);
    await page.screenshot({ path: test.info().outputPath('synced-measurements-' + width + '.png'), animations: 'disabled' });
    await page.getByRole('tab', { name: 'All details', exact: true }).click();
    await expect(page.locator('.warehouse-details-modal')).toBeVisible();
    await expect(page.getByText('Bhiwandi', { exact: true })).toBeVisible();
    await page.getByRole('tab', { name: /Flagged fields/ }).click();
    await expect(height.getByLabel('Clear Height value')).toHaveValue('50.5');
    await expect(area.getByLabel('Proposed Offered Area (sq ft) · Space 2')).toHaveValue('24000');
    for (const item of [handover, state, city, area, height, dimensions]) {
      await item.getByLabel('Verification note *', { exact: true }).fill('Checked the updated details with the owner.');
      await item.getByRole('button', { name: 'Submit for verification', exact: true }).click();
      await expect(item.getByText('Awaiting reviewer', { exact: true })).toBeVisible();
    }
    const pending = await server.service.detail(review.id, { email: 'admin@wareongo.com' });
    const proposals = Object.fromEntries(pending.flags.map(item => [item.fieldKey, item.proposedValue]));
    expect(proposals).toMatchObject({ state: 'Karnataka', city: 'Bangalore', totalSpaceSqft: [50000, 24000],
      clearHeightFt: '50.5 metres', 'warehouseData.dimensions': '240 x 200 x 32 feet',
      handover: { handoverType: 'VARIABLE', handoverLeadValue: 3, handoverLeadUnit: 'WEEKS' },
    });
    expect(await server.db.warehouse.findUnique({ where: { id: 4821 } })).toMatchObject({ state: 'Maharashtra', city: 'Bhiwandi', totalSpaceSqft: [50000] });
  });
  test('reviews availability and its date together and invalidates a second edit during confirmation', async ({ page }) => {
    await page.goto(server.url + '/dashboard?role=admin');
    await page.getByRole('button', { name: /View$/ }).click();
    await page.getByRole('button', { name: 'Flag for review (beta)', exact: true }).click();
    await page.getByRole('checkbox', { name: 'Flag Availability & last reviewed', exact: true }).check();
    await expect(page.getByRole('checkbox', { name: 'Flag Availability last reviewed', exact: true })).toHaveCount(0);
    await page.getByLabel('Review comment for Availability & last reviewed').fill('Confirm availability and when the owner checked it.');
    await page.getByRole('button', { name: 'Review flags', exact: true }).click();
    const summary = page.getByRole('dialog', { name: 'Confirm flags for warehouse #4821' });
    await expect(summary).toContainText('Availability: Yes');
    await expect(summary).toContainText('Last reviewed: Not recorded');
    await summary.getByRole('button', { name: 'Confirm & flag for review' }).click();
    await expect(summary).not.toBeVisible();
    const created = await server.db.warehouseFieldReview.findFirst({ where: { warehouseId: 4821, closedAt: null }, include: { flags: true } });
    expect(created.flags).toHaveLength(1);
    expect(created.flags[0].fieldKey).toBe('availabilityReview');

    await page.goto(server.url + '/field-reviews?role=employee&review=' + created.id);
    const pair = flag(page, 'Availability & last reviewed');
    const date = pair.getByLabel('Proposed availability last reviewed', { exact: true });
    await expect(pair.getByLabel('Proposed availability', { exact: true })).toHaveValue('Yes');
    await date.fill('16/11/2026');
    await date.press('Enter');
    await date.press('Tab');
    await pair.getByLabel('Verification note *', { exact: true }).fill('The owner confirmed availability on 16 November.');
    await noOverflow(page);
    await page.locator('.fr-modal .responsive-modal__body').evaluate(el => el.scrollTo({ top: 0, behavior: 'instant' }));
    await page.screenshot({ path: test.info().outputPath('employee-availability-pair-' + width + '.png'), animations: 'disabled' });
    await page.getByRole('tab', { name: 'All details', exact: true }).click();
    const liveDate = page.locator('.warehouse-details-modal .fr-flag-field').filter({ has: page.getByText('Availability last reviewed', { exact: true }) });
    await expect(liveDate).toContainText('Not recorded');
    await page.getByRole('tab', { name: /Flagged fields/ }).click();
    await expect(date).toHaveValue('16/11/2026');
    await pair.getByRole('button', { name: 'Submit for verification', exact: true }).click();
    await expect(pair.getByText('Awaiting reviewer', { exact: true })).toBeVisible();
    expect((await server.db.warehouse.findUnique({ where: { id: 4821 } })).availabilityLastReviewedOn).toBeNull();

    const edit = data => server.db.$transaction(async tx => {
      await tx.$queryRawUnsafe("SELECT set_config('wareongo.actor_email','editor@wareongo.com',true),set_config('wareongo.edit_source','Warehouse edit',true)");
      return tx.warehouse.update({ where: { id: 4821 }, data });
    });
    await edit({ availability: 'No' });
    await page.goto(server.url + '/field-reviews?role=admin&review=' + created.id);
    await expect(pair.getByText('The value changed while verification was pending.', { exact: true })).toBeVisible();
    await expect(pair.getByRole('radio', { name: /Keep current.*Availability: No.*Last reviewed: Not recorded/s })).not.toBeChecked();
    await expect(pair.getByRole('radio', { name: /Restore baseline.*Availability: Yes.*Last reviewed: Not recorded/s })).not.toBeChecked();
    await pair.getByText('Edit history', { exact: true }).click();
    await expect(pair.locator('.fr-history-entry')).toContainText('editor@wareongo.com');
    await noOverflow(page);
    await page.locator('.fr-modal .responsive-modal__body').evaluate(el => el.scrollTo({ top: 0, behavior: 'instant' }));
    await page.screenshot({ path: test.info().outputPath('admin-availability-conflict-' + width + '.png'), animations: 'disabled' });
    await pair.getByRole('radio', { name: /Apply proposed.*Last reviewed: 16 Nov 2026/s }).check();
    await pair.getByLabel('Why replace the current value? *', { exact: true }).fill('Owner reconfirmed both values.');
    await pair.getByRole('button', { name: 'Review replacement', exact: true }).click();
    await edit({ availabilityLastReviewedOn: new Date('2026-11-15') });
    await page.getByRole('button', { name: 'Confirm replacement & close', exact: true }).click();
    await expect(page.getByText('The current value changed again. Review the refreshed comparison and confirm a new decision.', { exact: true })).toBeVisible();
    await expect(pair.getByRole('radio', { name: /Apply proposed/ })).not.toBeChecked();
    await expect(pair.getByRole('radio', { name: /Keep current.*Last reviewed: 15 Nov 2026/s })).not.toBeChecked();
    expect(await server.db.warehouse.findUnique({ where: { id: 4821 } })).toMatchObject({ availability: 'No', availabilityLastReviewedOn: new Date('2026-11-15') });
    await pair.getByRole('radio', { name: /Apply proposed/ }).check();
    await pair.getByLabel('Why replace the current value? *', { exact: true }).fill('Checked the later edit and reconfirmed the answer and date.');
    await pair.getByRole('button', { name: 'Review replacement', exact: true }).click();
    await page.getByRole('button', { name: 'Confirm replacement & close', exact: true }).click();
    await expect(pair.getByText('Verified & closed', { exact: true })).toBeVisible();
    expect(await server.db.warehouse.findUnique({ where: { id: 4821 } })).toMatchObject({ availability: 'Yes', availabilityLastReviewedOn: new Date('2026-11-16') });
    expect((await server.db.warehouseFieldReview.findUnique({ where: { id: created.id } })).closedAt).not.toBeNull();
  });
});
