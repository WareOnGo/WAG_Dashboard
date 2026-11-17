import { createRequire } from 'node:module';
import { randomBytes } from 'node:crypto';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { resolve, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { build } from 'vite';
import react from '@vitejs/plugin-react';

const frontendRoot = fileURLToPath(new URL('../', import.meta.url));
const backendRoot = resolve(process.env.E2E_BACKEND_ROOT || join(frontendRoot, '../Backend_Repository'));
const backend = createRequire(join(backendRoot, 'package.json'));

export async function startServer({ port = 0, corsOrigins = [], existingSchema } = {}) {
  // Refuse production URLs before loading anything that can create a DB client.
  const baseUrl = backend('./tests/helpers/testDatabaseUrl')(process.env.TEST_DATABASE_URL);
  if (existingSchema && !/^behavior_qa_[a-f0-9]{16}$/.test(existingSchema)) throw new Error('Invalid local preview schema');
  const schema = existingSchema || `behavior_qa_${randomBytes(8).toString('hex')}`;
  const url = new URL(baseUrl);
  url.searchParams.set('schema', schema);
  Object.assign(process.env, {
    NODE_ENV: 'production', DATABASE_URL: url.toString(), DIRECT_URL: url.toString(),
    GUPSHUP_ENABLED: 'false', OPENAI_API_KEY: '', MAPBOX_ACCESS_TOKEN: '',
  });
  // Tests never load the backend's .env or contact notification services.
  backend('dotenv').config = () => ({ parsed: {} });
  const { PrismaClient } = backend('@prisma/client');
  const admin = new PrismaClient({ datasources: { db: { url: baseUrl } } });
  const prisma = new PrismaClient({ datasources: { db: { url: url.toString() } } });
  const database = backend('./src/utils/database');
  database.prisma = prisma;
  const { createSchema } = backend('./tests/helpers/availabilityReviewDatabase');
  const express = backend('express');
  const WarehouseModel = backend('./src/models/warehouseModel');
  const WarehouseService = backend('./src/services/warehouseService');
  const WarehouseController = backend('./src/controllers/warehouseController');
  const StagedWarehouseModel = backend('./src/models/stagedWarehouseModel');
  const StagingService = backend('./src/services/stagingService');
  const StagingController = backend('./src/controllers/stagingController');
  const SettingsService = backend('./src/services/settingsService');
  const AppSettingModel = backend('./src/models/appSettingModel');
  const Validation = backend('./src/middleware/validation');
  const ErrorHandler = backend('./src/middleware/errorHandler');
  const { verifyScoutToken, clearScoutCache } = backend('./src/middleware/scoutMiddleware');
  const createAuditMiddleware = backend('./src/middleware/auditMiddleware');
  const { resolveFormLocation, validateNewWarehouseForm, validateDashboardForm } = backend('./src/middleware/warehouseFormValidation');
  const { CAPS } = backend('./src/utils/access');
  const capabilities = Object.fromEntries(Object.values(CAPS).map(capability => [capability, true]));
  const settings = new SettingsService(new AppSettingModel(prisma));
  const warehouseService = new WarehouseService(new WarehouseModel(prisma));
  const stagingService = new StagingService(new StagedWarehouseModel(prisma), warehouseService, settings);
  const warehouses = new WarehouseController(warehouseService, {}, stagingService);
  const staging = new StagingController(stagingService, settings);
  const buildDir = await mkdtemp(join(tmpdir(), 'dashboard-form-build-'));
  const pendingAudits = new Set();
  let server;
  let schemaCreated = false;
  const close = async () => {
    if (server) {
      server.closeAllConnections();
      await new Promise(resolve => server.close(resolve));
    }
    await Promise.all(pendingAudits);
    clearScoutCache();
    await prisma.$disconnect();
    if (schemaCreated) await admin.$executeRawUnsafe(`DROP SCHEMA "${schema}" CASCADE`);
    await admin.$disconnect();
    await rm(buildDir, { recursive: true, force: true });
  };
  try {
    if (existingSchema) {
      const found = await admin.$queryRawUnsafe('SELECT 1 FROM pg_namespace WHERE nspname = $1', schema);
      if (!found.length) throw new Error('The local preview schema no longer exists');
    } else {
      await admin.$executeRawUnsafe(`CREATE SCHEMA "${schema}"`);
      schemaCreated = true;
      await createSchema(prisma);
      for (const table of ['Warehouse', 'StagedWarehouse']) {
        // These three columns are @db.Date in the production Prisma schema.
        await prisma.$executeRawUnsafe(`ALTER TABLE "${table}"
          ADD COLUMN "availabilityLastReviewedOn" date,
          ALTER COLUMN "handoverDate" TYPE date,
          ALTER COLUMN "lockInDate" TYPE date`);
      }
      await prisma.$executeRawUnsafe(`CREATE TABLE "VerifiedNumber" (
        id serial PRIMARY KEY, phone_number text UNIQUE NOT NULL, name text NOT NULL,
        is_active boolean NOT NULL DEFAULT true, created_at timestamp DEFAULT now(),
        twenty_user_id text UNIQUE, email text UNIQUE, "empID" text UNIQUE,
        role text DEFAULT 'EMPLOYEE', "adminAccess" boolean DEFAULT false,
        "analystAccess" boolean DEFAULT false, "callDashboardAccess" boolean DEFAULT false,
        "dashboardAccess" boolean DEFAULT false, "reviewerAccess" boolean DEFAULT false)`);
      await backend('./scripts/migrateWarehousePermissions').migrate(prisma, true);
      await prisma.$executeRawUnsafe(`CREATE TABLE app_setting (
        application text, key text, value jsonb NOT NULL, "updatedBy" text,
        "updatedAt" timestamp NOT NULL DEFAULT now(), PRIMARY KEY(application, key))`);
      await prisma.verifiedNumber.create({ data: {
        phone_number: '9999999999', name: 'E2E scout', email: 'scout@example.test', empID: 'E2ESCOUT',
      } });
      await settings.setAutoApprove(false, 'e2e@example.test');
    }

    const app = express();
    if (corsOrigins.length) app.use(backend('cors')({ origin: corsOrigins }));
    app.use(express.json());
    app.use(createAuditMiddleware({ log: entry => {
      const task = prisma.auditLog.create({ data: {
        ...entry, entityId: entry.entityId == null ? null : String(entry.entityId),
        metadata: entry.metadata ?? undefined,
      } });
      pendingAudits.add(task);
      task.finally(() => pendingAudits.delete(task));
      return task;
    } }));
    // Real Scout authentication, validator, controller, service, and database.
    app.post('/api/warehouses/scout/resolve-location', verifyScoutToken, resolveFormLocation);
    app.post('/api/warehouses/scout', verifyScoutToken, validateNewWarehouseForm, Validation.validateWarehouseCreate, warehouses.createScoutWarehouse);
    // The reviewer is a fixture identity; Google sign-in and role assignment are outside this suite.
    app.use('/api/staging', (req, _res, next) => {
      req.user = { email: 'reviewer@example.test', name: 'E2E reviewer', isAdmin: true, capabilities };
      next();
    });
    app.get('/api/staging/settings/auto-approve', staging.getAutoApprove);
    app.post('/api/staging/resolve-location', resolveFormLocation);
    app.get('/api/staging', staging.listSubmissions);
    app.get('/api/staging/:id', staging.getSubmission);
    const StagingValidator = backend('./src/validators/stagingValidator');
    app.patch('/api/staging/:id', Validation.validateBody(StagingValidator.editSchema), staging.updateSubmission);
    app.post('/api/staging/:id/reject', Validation.validateBody(StagingValidator.rejectSchema), staging.rejectSubmission);
    app.post('/api/staging/:id/approve', staging.approveSubmission);
    app.use('/api/warehouses', (req, _res, next) => {
      req.user = { email: 'dashboard@example.test', name: 'E2E dashboard', isAdmin: true, capabilities }; next();
    });
    app.post('/api/warehouses/resolve-location', resolveFormLocation);
    app.post('/api/warehouses', validateDashboardForm, Validation.validateWarehouseCreate, warehouses.createWarehouse);
    app.put('/api/warehouses/:id', Validation.validateWarehouseUpdate, warehouses.updateWarehouse);
    app.get('/api/warehouses/:id/contact-number', Validation.validateContactReveal, warehouses.getContactNumber);
    // Visit notes are outside these form contract tests; list starts empty.
    app.get('/api/warehouses/:id/visit-notes', (_req, res) => res.json([]));
    app.get('/api/warehouses/:id', warehouses.getWarehouseById);
    app.use('/api', ErrorHandler.handle);
    // Build the actual application. No Vite dev server or intercepted API responses.
    await build({ root: frontendRoot, configFile: false, envDir: buildDir,
      plugins: [react()], logLevel: 'warn',
      define: { 'import.meta.env.VITE_API_BASE_URL': JSON.stringify('/api'), 'process.env.NODE_ENV': JSON.stringify('production') },
      build: { outDir: buildDir, emptyOutDir: false, rollupOptions: { input: join(frontendRoot, 'e2e/index.html') } },
    });
    app.use(express.static(buildDir));
    app.get('/', (_req, res) => res.sendFile(join(buildDir, 'e2e/index.html')));
    server = await new Promise((resolve, reject) => {
      const listener = app.listen(port, '127.0.0.1', () => resolve(listener));
      listener.on('error', reject);
    });
    return { url: `http://127.0.0.1:${server.address().port}`, prisma, settings, close };
  } catch (error) {
    await close();
    throw error;
  }
}
