import { test, expect } from '@playwright/test';
import { startServer } from './server.mjs';
import { completePptForm } from '../src/test/pptFormFixture.js';
let server;
const field = (page, label) => page.getByLabel(new RegExp('^' + label.replace(/[.*+?^${}()|[\]\\]/g, '\\$&') + '(?:\\s*\\*)?$'));
const data = (page, key) => page.locator(`[data-field="${key}"]`);
const press = (page, target) => page.formTouch ? target.tap() : target.click();
const reviewButton = (page, owner) => page.locator('.simple-warehouse-card')
  .filter({ has: page.getByText(owner, { exact: true }) }).getByRole('button', { name: /(?:^| )Review$/ });
test.beforeAll(async () => { test.setTimeout(120_000); server = await startServer(); });
test.afterAll(async () => { await server?.close(); });
test.beforeEach(async ({ page, hasTouch }) => {
  page.formTouch = hasTouch;
  await server.settings.setAutoApprove(false);
  await page.route('**/*', route => new URL(route.request().url()).origin === server.url ? route.continue() : route.abort());
  page.formErrors = [];
  page.on('pageerror', error => page.formErrors.push(error.message));
  page.on('request', request => { if (request.url().includes('/resolve-location')) page.formErrors.push('Unexpected Maps verification request'); });
});
test.afterEach(async ({ page }) => { expect(page.formErrors).toEqual([]); });
async function create(page, address) {
  await page.goto(server.url);
  await data(page, 'listing_type').selectOption('Rent');
  await data(page, 'warehouseType').selectOption('PEB');
  await field(page, 'Address').fill(address);
  await field(page, 'State').fill('Delhi');
  await page.locator('li').filter({ hasText: /^Delhi$/ }).click();
  await field(page, 'Contact Person').fill(`${address} owner`);
  await data(page, 'contactNumber').fill('9876543210');
  await field(page, 'Compliances').fill('CLU and Fire NOC checked');
  await field(page, 'Rate per sq ft').fill('25');
  await data(page, 'landType').selectOption('Warehouse CLU');
  await data(page, 'googleLocation').fill('https://maps.app.goo.gl/ttMpsPTNwLcrdHas5');
}
async function noOverflow(page) {
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1)).toBe(true);
  const scroller = page.locator('.warehouse-form-fields');
  expect(await scroller.evaluate(el => el.scrollWidth <= el.clientWidth + 1)).toBe(true);
}
async function receipt(page) {
  return JSON.parse(await page.getByTestId('receipt').textContent());
}
async function searchSubmissions(page, text) {
  const response = page.waitForResponse(response => {
    const url = new URL(response.url());
    return url.pathname === '/api/staging' && url.searchParams.get('search') === text
      && response.request().method() === 'GET';
  });
  await field(page, 'Search submissions').fill(text);
  expect((await response).ok()).toBe(true);
  // Search ranks related matches too; select the intended record by its owner.
}

test('an older open dashboard cannot create an incomplete new warehouse', async ({ request }) => {
  const response = await request.post(`${server.url}/api/warehouses`, { data: {
    listing_type: 'Rent', warehouseType: 'PEB', address: 'Older dashboard client', city: 'New Delhi', state: 'Delhi',
    contactPerson: 'QA owner', contactNumber: '9876543210', totalSpaceSqft: [10000], compliances: 'CLU', ratePerSqft: '25',
    warehouseData: { landType: null }, googleLocation: null,
  } });
  expect(response.status()).toBe(400);
  expect((await response.json()).details.issues).toEqual(expect.arrayContaining([
    expect.objectContaining({ path: ['googleLocation'] }), expect.objectContaining({ path: ['clearHeightFt'] }),
  ]));
  expect(await server.prisma.stagedWarehouse.count({ where: { address: 'Older dashboard client' } })).toBe(0);
});

for (const width of [320, 390, 1280]) {
  test.describe(`dashboard at ${width}px`, () => {
    test.use({ viewport: { width, height: 850 }, isMobile: width < 768, hasTouch: width < 768 });
    test('rejection stays above successive submission forms and supports cancel and retry', async ({ page }) => {
      const submissions = [];
      for (const index of [1, 2]) submissions.push(await server.prisma.stagedWarehouse.create({ data: {
        address: `Repeated rejection ${width} ${index}`, city: 'New Delhi', state: 'Delhi', warehouseType: 'PEB', listing_type: 'Rent',
        contactPerson: `Rejection owner ${width} ${index}`, contactNumber: '9876543210', totalSpaceSqft: [1000],
        uploadedBy: 'original@example.test', submittedBy: 'original@example.test', source: 'PARTNER_API', reviewStatus: 'PENDING'
      } }));
      await page.goto(`${server.url}/?review`);
      for (const submission of submissions) {
        await reviewButton(page, submission.contactPerson).click();
        await data(page, 'dimensions').fill('10'); // Reject an incomplete submission without saving its draft.
        const rejectButton = page.locator('.warehouse-form-modal').getByRole('button', { name: /(?:^| )Reject$/ });
        await rejectButton.click();
        const dialog = page.getByRole('dialog', { name: 'Reject this submission?', exact: true });
        const reason = dialog.getByRole('textbox', { name: 'Reason for rejection', exact: true });
        await expect.poll(() => reason.evaluate(element => {
          const rect = element.getBoundingClientRect();
          return element.contains(document.elementFromPoint(rect.x + rect.width / 2, rect.y + rect.height / 2));
        })).toBe(true);
        await reason.fill('The site details are incomplete.');
        await reason.press('Escape');
        await expect(dialog).not.toBeVisible();
        await expect(rejectButton).toBeFocused();
        await rejectButton.click();
        await reason.fill('The site details are incomplete.');
        await page.route('**/api/staging/*/reject', route => route.fulfill({ status: 503,
          json: { error: 'Rejection unavailable. Please retry.' } }), { times: 1 });
        await dialog.getByRole('button', { name: 'Reject', exact: true }).click();
        await expect(dialog.getByRole('alert').filter({ hasText: 'Service temporarily unavailable' })).toBeVisible();
        await expect(reason).toHaveValue('The site details are incomplete.');
        await dialog.getByRole('button', { name: 'Reject', exact: true }).click();
        await expect(dialog).not.toBeVisible();
        await expect(page.locator('.warehouse-form-modal')).not.toBeVisible();
        expect((await server.prisma.stagedWarehouse.findUnique({ where: { id: submission.id } })).reviewStatus).toBe('REJECTED');
      }
    });
    test('create, review, approve and reopen all structured fields through the real API', async ({ page }) => {
      const address = `Dashboard unit QA ${width}`;
      await create(page, address);
      await expect(field(page, 'Uploaded By')).toHaveValue('dashboard@example.test');
      await expect(field(page, 'Uploaded By')).toHaveAttribute('readonly', '');
      await field(page, 'Contact Number country code').selectOption('DK');
      await data(page, 'contactNumber').fill('32123456');
      await field(page, 'Alternate Phone Number country code').selectOption('GB');
      await data(page, 'alt_phone_number').fill('02079460018');
      const heightInput = data(page, 'clearHeightFt');
      await heightInput.pressSequentially('50x');
      await expect(heightInput).toBeFocused();
      await expect(heightInput).toHaveAttribute('aria-invalid', 'true');
      await expect(page.getByRole('alert')).toHaveText('Use digits and at most one decimal point (e.g. 50.5).');
      await page.screenshot({ path: test.info().outputPath(`measurement-warning-${width}.png`) });
      await heightInput.press('Backspace');
      await expect(heightInput).toHaveValue('50');
      await expect(heightInput).toHaveAttribute('aria-invalid', 'false');
      await expect(page.getByRole('alert')).toHaveCount(0);
      for (const [key, label, unit] of [
        ['distance_from_highway', 'Distance from Highway', 'metres'], ['approachRoadWidth', 'Approach Road Width', 'feet'],
        ['land_parcel_size', 'Land Parcel Size', 'hectares'], ['builtup_area', 'Built-up Area', 'sq ft'],
        ['carpet_area', 'Carpet Area', 'sq ft'], ['clearHeightFt', 'Clear Height', 'metres'],
        ['centreHeight', 'Centre Height', 'feet'], ['plinthHeightFt', 'Plinth Height', 'feet'],
        ['dockApronLengthFt', 'Dock Apron Length', 'metres'], ['gateSizeFt', 'Compound Gate Width', 'feet'], ['powerKva', 'Power', 'HP'],
      ]) {
        await data(page, key).fill(['plinthHeightFt', 'carpet_area'].includes(key) ? '0' : '50.5');
        if (['builtup_area', 'carpet_area'].includes(key)) {
          await expect(data(page, key).locator('..').locator('..').locator('.measurement-suffix')).toHaveText('sq ft');
        } else await field(page, `${label} unit`).selectOption(unit);
        expect((await data(page, key).boundingBox()).height).toBeGreaterThanOrEqual(width < 768 ? 44 : 36);
      }
      const powerOption = field(page, 'As per requirement');
      await powerOption.check();
      await expect(data(page, 'powerKva')).toBeDisabled();
      await expect(field(page, 'Power unit')).toBeDisabled();
      await powerOption.uncheck();
      await expect(data(page, 'powerKva')).toHaveValue('50.5');
      await expect(field(page, 'Power unit')).toHaveValue('HP');
      await powerOption.check();
      await powerOption.scrollIntoViewIfNeeded();
      expect((await powerOption.locator('..').boundingBox()).height).toBeGreaterThanOrEqual(44);
      await page.screenshot({ path: test.info().outputPath(`power-requirement-${width}.png`) });
      for (const [label, value] of [['Dimensions length', '100'], ['Dimensions width', '60'], ['Dimensions height', '30'],
        ['Dock Dimension width', '8'], ['Dock Dimension height', '10'], ['Floor Strength value', '5'], ['Lighting value', '0'],
        ['Male washrooms', '2'], ['Female washrooms', '0']]) await field(page, label).fill(value);
      await field(page, 'Canopy Type').selectOption('Shutter');
      await field(page, 'Dock Platform Type').selectOption('Angled/Cross');
      await field(page, 'Flooring Type').selectOption('VDF');
      await page.getByLabel('Ventilation Type options').click();
      await field(page, 'Ridge').check(); await field(page, 'Turbo').check();
      await field(page, 'Ventilation Air Changes/Day').fill('4');
      await field(page, 'Setback Area').fill('5m on all sides');
      await data(page, 'numberOfDocks').fill('0');
      await data(page, 'fireNocAvailable').selectOption('No');
      await data(page, 'fireSafetyMeasures').fill('None');
      await page.getByLabel('Handover mode').selectOption('Variable');
      await page.getByLabel('Handover lead time').fill('2');
      await page.getByLabel('Handover unit').selectOption('Weeks');
      await noOverflow(page);
      await data(page, 'dimensions').scrollIntoViewIfNeeded();
      await page.screenshot({ path: test.info().outputPath(`dashboard-measurements-${width}.png`) });
      await press(page, page.getByRole('button', { name: 'Create Warehouse', exact: true }));
      await expect(page.getByTestId('receipt')).toBeVisible();
      const created = await receipt(page);
      expect(created.autoApproved).toBe(false);
      const stagedId = created.submissionId;
      const staged = await server.prisma.stagedWarehouse.findUnique({ where: { id: stagedId } });
      const expected = {
        uploadedBy: 'dashboard@example.test', contactNumber: '+4532123456', alt_phone_number: '+442079460018',
        distance_from_highway: '50.5 metres', approachRoadWidth: '50.5 feet', land_parcel_size: '50.5 hectares',
        builtup_area: '50.5 sq ft', carpet_area: '0 sq ft', clearHeightFt: '50.5 metres', centreHeight: '50.5 feet',
        plinthHeightFt: '0 feet', dockApronLengthFt: '50.5 metres', gateSizeFt: '50.5 feet', powerKva: 'As per requirement',
        dimensions: '100 x 60 x 30 feet', dockDimension: '8 x 10 feet', floorStrengthPerSqm: '5 tonnes/sq m', lightingDetails: '0 lux',
        washroom_count: 'Male: 2; Female: 0', canopyType: 'Shutter', dockPlatformType: 'Angled/Cross', flooringType: 'VDF',
        ventilationType: 'Ridge, Turbo', ventilationAirChangesPerDay: '4', setbackArea: '5m on all sides', latitude: null, longitude: null,
      };
      expect(staged).toMatchObject(expected);
      await page.goto(`${server.url}/?review`);
      await searchSubmissions(page, address);
      await reviewButton(page, `${address} owner`).click();
      await expect(field(page, 'Address')).toHaveValue(address);
      await expect(data(page, 'clearHeightFt')).toHaveValue('50.5');
      await expect(data(page, 'plinthHeightFt')).toHaveValue('0');
      await expect(data(page, 'carpet_area')).toHaveValue('0');
      await expect(field(page, 'Clear Height unit')).toHaveValue('metres');
      await expect(field(page, 'Uploaded By')).toHaveValue('dashboard@example.test');
      await expect(powerOption).toBeChecked();
      await powerOption.uncheck();
      await data(page, 'powerKva').fill('75');
      await field(page, 'Power unit').selectOption('HP');
      await data(page, 'clearHeightFt').fill('51');
      await data(page, 'googleLocation').fill('https://maps.app.goo.gl/changed-preview-link');
      await noOverflow(page);
      await page.getByRole('button', { name: /(?:^| )Accept$/ }).click();
      await page.getByRole('button', { name: 'Approve', exact: true }).click();
      await expect.poll(async () => (await server.prisma.stagedWarehouse.findUnique({ where: { id: stagedId } })).reviewStatus).toBe('APPROVED');
      const published = await server.prisma.stagedWarehouse.findUnique({ where: { id: stagedId } });
      const stored = await server.prisma.warehouse.findUnique({ where: { id: published.warehouseId }, include: { WarehouseData: true } });
      expect({ ...stored, ...stored.WarehouseData }).toMatchObject({ ...expected, powerKva: '75 HP', clearHeightFt: '51 metres', latitude: null });
      await page.goto(`${server.url}/?id=${stored.id}`);
      await expect(data(page, 'clearHeightFt')).toHaveValue('51');
      await expect(data(page, 'plinthHeightFt')).toHaveValue('0');
      await expect(data(page, 'carpet_area')).toHaveValue('0');
      await expect(field(page, 'Clear Height unit')).toHaveValue('metres');
      await expect(field(page, 'Female washrooms')).toHaveValue('0');
      await expect(field(page, 'Power unit')).toHaveValue('HP');
      await expect(powerOption).not.toBeChecked();
      await expect(data(page, 'powerKva')).toHaveValue('75');
      await powerOption.check();
      await field(page, 'Address').fill(`${address} edited`);
      await page.getByRole('button', { name: 'Update Warehouse', exact: true }).click();
      await expect(page.getByTestId('receipt')).toBeVisible();
      const edited = await server.prisma.warehouse.findUnique({ where: { id: stored.id }, include: { WarehouseData: true } });
      expect({ ...edited, ...edited.WarehouseData }).toMatchObject({ ...expected, clearHeightFt: '51 metres', latitude: null, address: `${address} edited` });
      await page.goto(`${server.url}/?id=${stored.id}`);
      await expect(powerOption).toBeChecked();
      await expect(data(page, 'powerKva')).toBeDisabled();
    });
  });
}

test('new required fields, invalid numbers and partial dimensions block saving', async ({ page }) => {
  await page.goto(server.url);
  await page.getByRole('button', { name: 'Create Warehouse', exact: true }).click();
  await expect(page.getByText('Google Location URL is required', { exact: true })).toBeVisible();
  await expect(page.getByText('Land Type is required', { exact: true })).toBeAttached();
  const before = await server.prisma.stagedWarehouse.count();
  await create(page, 'Invalid form QA');
  await data(page, 'googleLocation').fill('https://www.google.com/maps/@12,77,16z');
  await data(page, 'dimensions').fill('100'); await field(page, 'Male washrooms').fill('-1');
  await data(page, 'contactNumber').fill('12');
  await page.getByRole('button', { name: 'Create Warehouse', exact: true }).click();
  await expect(data(page, 'dimensions')).toHaveAttribute('aria-invalid', 'true');
  await expect(data(page, 'contactNumber')).toHaveAttribute('aria-invalid', 'true');
  expect(await server.prisma.stagedWarehouse.count()).toBe(before);
});

test('a saved warehouse rejects cleared specifications and accepts valid replacements', async ({ page, request }) => {
  await server.settings.setAutoApprove(true);
  const response = await request.post(`${server.url}/api/warehouses`, { data: completePptForm() });
  expect(response.status()).toBe(201);
  const { warehouseId } = await response.json();
  await page.goto(`${server.url}/?id=${warehouseId}`);
  await data(page, 'clearHeightFt').fill('');
  await data(page, 'fireNocAvailable').selectOption('');
  await page.getByRole('button', { name: 'Update Warehouse', exact: true }).click();
  await expect(data(page, 'clearHeightFt')).toHaveAttribute('aria-invalid', 'true');
  await expect(data(page, 'fireNocAvailable')).toHaveAttribute('aria-invalid', 'true');
  expect(await server.prisma.warehouse.findUnique({ where: { id: warehouseId }, include: { WarehouseData: true } }))
    .toMatchObject({ clearHeightFt: '30 feet', WarehouseData: { fireNocAvailable: false } });
  await data(page, 'clearHeightFt').fill('35');
  await data(page, 'fireNocAvailable').selectOption('Yes');
  await page.getByRole('button', { name: 'Update Warehouse', exact: true }).click();
  await expect(page.getByTestId('receipt')).toBeVisible();
  expect(await server.prisma.warehouse.findUnique({ where: { id: warehouseId }, include: { WarehouseData: true } }))
    .toMatchObject({ clearHeightFt: '35 feet', WarehouseData: { fireNocAvailable: true } });
});

test('legacy review can save unrelated edits and reject an incomplete draft', async ({ page }) => {
  const legacy = await server.prisma.stagedWarehouse.create({ data: {
    address: 'Legacy form QA', city: 'New Delhi', state: 'Delhi', warehouseType: 'PEB', listing_type: 'Rent',
    contactPerson: 'Legacy owner', contactNumber: '9876543210', totalSpaceSqft: [1000], ratePerSqft: '25', compliances: 'Legacy',
    uploadedBy: 'original@example.test', submittedBy: 'original@example.test', source: 'PARTNER_API', reviewStatus: 'PENDING',
    clearHeightFt: '20–25 feet', washroom_count: '5 total', builtup_area: '10000', carpet_area: '120 sqm', land_parcel_size: '400 m²', landType: null, googleLocation: null,
    nearest_transport: 'Old stop', setbackArea: '5m on all sides', ventilationType: 'Old description',
  } });
  await page.goto(`${server.url}/?review`);
  await searchSubmissions(page, 'Legacy form QA');
  await reviewButton(page, 'Legacy owner').click();
  await expect(page.getByText('20–25 feet', { exact: true })).toBeVisible();
  await expect(field(page, 'Uploaded By')).toHaveValue('original@example.test');
  await field(page, 'Address').fill('Legacy form QA edited');
  await page.getByRole('button', { name: 'Update Warehouse', exact: true }).click();
  await expect.poll(async () => (await server.prisma.stagedWarehouse.findUnique({ where: { id: legacy.id } })).address).toBe('Legacy form QA edited');
  await reviewButton(page, 'Legacy owner').click();
  await data(page, 'dimensions').fill('10');
  await page.getByRole('button', { name: /(?:^| )Accept$/ }).click();
  await expect(data(page, 'dimensions')).toHaveAttribute('aria-invalid', 'true');
  await expect(page.getByRole('button', { name: 'Approve', exact: true })).toHaveCount(0);
  await page.getByRole('button', { name: /(?:^| )Reject$/ }).click();
  await expect(page.getByText(/Rejection will discard unsaved edits/)).toBeVisible();
  await field(page, 'Reason for rejection').fill('Incomplete site details');
  await page.getByRole('dialog').filter({ hasText: 'Reject this submission?' }).getByRole('button', { name: /(?:^| )Reject$/ }).click();
  await expect.poll(async () => (await server.prisma.stagedWarehouse.findUnique({ where: { id: legacy.id } })).reviewStatus).toBe('REJECTED');
  expect(await server.prisma.stagedWarehouse.findUnique({ where: { id: legacy.id } })).toMatchObject({
    uploadedBy: 'original@example.test', dimensions: null, landType: null, googleLocation: null,
    clearHeightFt: '20–25 feet', washroom_count: '5 total', builtup_area: '10000', carpet_area: '120 sqm', land_parcel_size: '400 m²', nearest_transport: 'Old stop', setbackArea: '5m on all sides',
  });
});

for (const pending of [false, true]) for (const changed of [false, true]) {
  test(`two open forms preserve newer power answers and report intentional conflicts (staged=${pending}, edited=${changed})`, async ({ page, request }) => {
    await server.settings.setAutoApprove(!pending);
    const fixture = completePptForm();
    fixture.address = `Concurrent power ${pending} ${changed}`;
    fixture.contactPerson = `Concurrent owner ${pending} ${changed}`;
    fixture.warehouseData.powerKva = '100 kVA';
    const created = await request.post(`${server.url}/api/warehouses`, { data: fixture });
    expect(created.status()).toBe(201);
    const { warehouseId, submissionId } = await created.json();
    const endpoint = pending ? `/api/staging/${submissionId}` : `/api/warehouses/${warehouseId}`;
    const readPower = async () => pending
      ? (await server.prisma.stagedWarehouse.findUniqueOrThrow({ where: { id: submissionId } })).powerKva
      : (await server.prisma.warehouseData.findUniqueOrThrow({ where: { warehouseId } })).powerKva;
    const openEditor = async editor => {
      await editor.goto(pending ? `${server.url}/?review` : `${server.url}/?id=${warehouseId}`);
      if (pending) {
        await searchSubmissions(editor, fixture.address);
        await reviewButton(editor, fixture.contactPerson).click();
      }
      await expect(data(editor, 'powerKva')).toHaveValue('100');
    };
    const save = async editor => {
      const response = editor.waitForResponse(response => new URL(response.url()).pathname === endpoint
        && ['PUT', 'PATCH'].includes(response.request().method()));
      await editor.getByRole('button', { name: 'Update Warehouse', exact: true }).click();
      return response;
    };
    const other = await page.context().newPage();
    other.on('pageerror', error => page.formErrors.push(error.message));
    await other.route('**/*', route => new URL(route.request().url()).origin === server.url ? route.continue() : route.abort());
    try {
      await openEditor(page); await openEditor(other);
      await data(other, 'powerKva').fill('200');
      expect((await save(other)).ok()).toBe(true);
      await field(page, 'Address').fill(`${fixture.address} edited`);
      if (changed) await data(page, 'powerKva').fill('300');
      const response = await save(page);
      if (changed) {
        expect(response.status()).toBe(409);
        expect(await response.json()).toMatchObject({ code: 'FORM_FIELDS_CHANGED' });
        await expect(page.getByText(/Warehouse details changed while this form was open/)).toBeVisible();
        await expect(data(page, 'powerKva')).toHaveValue('300');
      } else expect(response.ok()).toBe(true);
      expect(await readPower()).toBe('200 kVA');
    } finally { await other.close(); }
  });
}

test('a legacy warehouse without a details row can fill answers, while partial washroom clearing stays blocked', async ({ page, request }) => {
  await server.settings.setAutoApprove(true);
  const created = await request.post(`${server.url}/api/warehouses`, { data: { ...completePptForm(), washroom_count: 'Male: 3; Female: 2' } });
  expect(created.status()).toBe(201);
  const { warehouseId } = await created.json();
  await server.prisma.warehouseData.deleteMany({ where: { warehouseId } });
  await page.goto(`${server.url}/?id=${warehouseId}`);
  await data(page, 'powerKva').fill('100');
  await data(page, 'fireNocAvailable').selectOption('No');
  await data(page, 'washroom_count').fill('');
  await page.getByRole('button', { name: 'Update Warehouse', exact: true }).click();
  await expect(page.getByText('Male washroom count cannot be cleared.', { exact: true }).first()).toBeVisible();
  expect(await server.prisma.warehouseData.count({ where: { warehouseId } })).toBe(0);
  await data(page, 'washroom_count').fill('0');
  await page.getByRole('button', { name: 'Update Warehouse', exact: true }).click();
  await expect(page.getByTestId('receipt')).toBeVisible();
  expect(await server.prisma.warehouse.findUniqueOrThrow({ where: { id: warehouseId }, include: { WarehouseData: true } }))
    .toMatchObject({ washroom_count: 'Male: 0; Female: 2', WarehouseData: { powerKva: '100 kVA', fireNocAvailable: false } });
});
