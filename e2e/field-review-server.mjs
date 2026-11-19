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
export async function startFieldReviewServer() {
  const base = backend('./tests/helpers/testDatabaseUrl')(process.env.TEST_DATABASE_URL);
  const schema = 'behavior_qa_' + randomBytes(8).toString('hex'),
    url = new URL(base);
  url.searchParams.set('schema', schema);
  Object.assign(process.env, {
    NODE_ENV: 'production',
    DATABASE_URL: url.toString(),
    DIRECT_URL: url.toString(),
    JWT_SECRET: 'field-review-disposable-browser-secret',
    ALLOWED_DOMAIN: 'wareongo.com',
    ADMIN_EMAILS: '',
    GUPSHUP_ENABLED: 'false'
  });
  backend('dotenv').config = () => ({
    parsed: {}
  });
  const {
    PrismaClient
  } = backend('@prisma/client');
  const root = new PrismaClient({
      datasources: {
        db: {
          url: base
        }
      }
    }),
    db = new PrismaClient({
      datasources: {
        db: {
          url: url.toString()
        }
      }
    });
  backend('./src/utils/database').prisma = db;
  const express = backend('express'),
    jwt = backend('jsonwebtoken');
  const {
    createSchema
  } = backend('./tests/helpers/fieldReviewDatabase');
  const {
    migrate
  } = backend('./scripts/migrateFieldReview');
  const {
    FieldReviewService
  } = backend('./src/fieldReview/service');
  const {
    createRouter
  } = backend('./src/routes/fieldReviews');
  const {
    authMiddleware
  } = backend('./src/middleware/authMiddleware');
  const {
    invalidateCapabilities
  } = backend('./src/utils/access');
  const uploadedFiles = new Map();
  const service = new FieldReviewService(db, null, { generatePresignedUrl: async ({ contentType }) => {
    const extension = contentType.startsWith('image/') ? 'jpg' : contentType.startsWith('video/') ? 'mp4' : 'pdf';
    const file = randomBytes(8).toString('hex') + '.' + extension;
    const origin = 'http://127.0.0.1:' + server.address().port;
    return { uploadUrl: origin + '/fixture/upload/' + file, imageUrl: origin + '/fixture/media/' + file, fileName: file,
      instructions: { headers: { 'Content-Type': contentType, 'If-None-Match': '*' } } };
  }, getFileInfo: async fileName => {
    const file = uploadedFiles.get(fileName);
    if (!file) throw Object.assign(new Error('Fixture file not found'), { statusCode: 404 });
    return { size: file.data.length, contentType: file.type };
  } });
  const WarehouseController = backend('./src/controllers/warehouseController');
  const WarehouseService = backend('./src/services/warehouseService');
  const WarehouseModel = backend('./src/models/warehouseModel');
  const warehouseController = new WarehouseController(new WarehouseService(new WarehouseModel(db)), null, null, {
    getForWarehouses: async ids => ({ warehouses: Object.fromEntries(ids.map(id => [id, { labels: {} }])) }),
  }, service);
  const buildDir = await mkdtemp(join(tmpdir(), 'field-review-build-'));
  let server,
    created = false;
  const close = async () => {
    if (server) {
      server.closeAllConnections();
      await new Promise(r => server.close(r));
    }
    await db.$disconnect();
    if (created) await root.$executeRawUnsafe('DROP SCHEMA "' + schema + '" CASCADE');
    await root.$disconnect();
    await rm(buildDir, {
      recursive: true,
      force: true
    });
  };
  try {
    await root.$executeRawUnsafe('CREATE SCHEMA "' + schema + '"');
    created = true;
    await createSchema(db);
    await migrate(db, true);
    await db.verifiedNumber.createMany({
      data: [{
        id: 1,
        name: 'Meera Shah',
        email: 'admin@wareongo.com',
        phone_number: 'fixture-admin',
        is_active: true,
        adminAccess: true
      }, {
        id: 2,
        name: 'Arjun Rao',
        email: 'employee@wareongo.com',
        phone_number: 'fixture-employee',
        is_active: true,
        dashboardAccess: true,
        viewOwnWarehouseEntries: true,
        editOwnWarehouseEntries: false,
        editAllWarehouseEntries: false
      }, {
        id: 3,
        name: 'Reviewer One',
        email: 'reviewer@wareongo.com',
        phone_number: 'fixture-reviewer',
        is_active: true,
        reviewerAccess: true,
        dashboardAccess: true,
        viewOwnWarehouseEntries: true,
        viewAllWarehouseEntries: true,
        editOwnWarehouseEntries: true
      }, {
        id: 4,
        name: 'Observer One',
        email: 'observer@wareongo.com',
        phone_number: 'fixture-observer',
        is_active: true,
        dashboardAccess: true,
        viewOwnWarehouseEntries: true,
        viewAllWarehouseEntries: true,
        editOwnWarehouseEntries: false,
        editAllWarehouseEntries: false
      }]
    });
    const seed = async () => {
      await db.$executeRawUnsafe('TRUNCATE "WarehouseFieldReviewEvent","WarehouseFieldFlag","WarehouseFieldReview","WarehouseFieldVersion","WarehouseFieldEdit","WarehouseData","Warehouse","warehouse_proximity",audit_logs CASCADE');
      invalidateCapabilities();
      return db.warehouse.create({
        data: {
          id: 4821,
          warehouseType: 'PEB',
          address: 'Mankoli, Bhiwandi',
          city: 'Bhiwandi',
          state: 'Maharashtra',
          zone: 'West',
          contactPerson: 'Fixture owner',
          contactNumber: '+919999999999',
          uploadedBy: 'employee@wareongo.com',
          totalSpaceSqft: [50000],
          ratePerSqft: '22',
          numberOfDocks: '6',
          compliances: 'Fire NOC and CLU',
          availability: 'Yes',
          visibility: true,
          WarehouseData: {
            create: {
              latitude: 19.3,
              longitude: 73.1,
              landType: 'Warehouse CLU',
              powerKva: '100'
            }
          }
        }
      });
    };
    await seed();
    const app = express();
    app.use(express.json());
    app.put('/fixture/upload/:file', express.raw({ type: () => true, limit: '50mb' }), (req, res) => {
      if (req.headers['if-none-match'] !== '*') return res.sendStatus(403);
      if (uploadedFiles.has(req.params.file)) return res.sendStatus(412);
      uploadedFiles.set(req.params.file, { data: req.body, type: req.headers['content-type'] });
      res.sendStatus(200);
    });
    app.get('/fixture/media/:file', (req, res) => {
      const file = uploadedFiles.get(req.params.file);
      if (file) return res.type(file.type).send(file.data);
      if (req.params.file.endsWith('.pdf')) return res.type('application/pdf').send('%PDF-1.4\n%%EOF');
      res.type('image/png').send(Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+jR9sAAAAASUVORK5CYII=', 'base64'));
    });
    app.get('/fixture/session/:role', (req, res) => {
      const isAdmin = req.params.role === 'admin',
        isReviewer = isAdmin || req.params.role === 'reviewer',
        isObserver = req.params.role === 'observer',
        email = isAdmin ? 'admin@wareongo.com' : isReviewer ? 'reviewer@wareongo.com' : isObserver ? 'observer@wareongo.com' : 'employee@wareongo.com';
      res.json({
        user: {
          email,
          isAdmin,
          isReviewer,
          name: isAdmin ? 'Meera Shah' : isReviewer ? 'Reviewer One' : isObserver ? 'Observer One' : 'Arjun Rao',
          capabilities: {
            DASHBOARD: true,
            WAREHOUSE_VIEW_OWN: true,
            WAREHOUSE_EDIT_OWN: isReviewer,
            WAREHOUSE_EDIT_ALL: isAdmin,
            WAREHOUSE_VIEW_ALL: isReviewer || isObserver,
            REVIEW: isReviewer
          }
        },
        token: jwt.sign({
          id: isAdmin ? 'fixture-admin' : isReviewer ? 'fixture-reviewer' : isObserver ? 'fixture-observer' : 'fixture-employee',
          email,
          name: email,
          domain: 'wareongo.com'
        }, process.env.JWT_SECRET, {
          expiresIn: '1h',
          audience: 'warehouse-frontend',
          issuer: 'warehouse-api'
        })
      });
    });
    app.use('/api/field-reviews', createRouter(service));
    app.use('/api/warehouses', (req, _res, next) => { req.audit = () => {}; next(); });
    const warehouseView = [authMiddleware.authenticateJWT, authMiddleware.requireAccess('WAREHOUSE_VIEW_OWN')];
    app.get('/api/warehouses', ...warehouseView, warehouseController.getAllWarehouses);
    app.get('/api/warehouses/filter-options', ...warehouseView, warehouseController.getFilterOptions);
    app.get('/api/warehouses/:id', ...warehouseView,
      backend('./src/middleware/warehouseAccess').requireWarehouseEntry('view'), warehouseController.getWarehouseById);
    app.get('/api/fixture/warehouses', authMiddleware.authenticateJWT, async (_req, res, next) => {
      try {
        const rows = await db.warehouse.findMany({
          include: {
            WarehouseData: true,
            WarehouseProximity: true
          }
        });
        res.json(rows.map(({
          contactNumber,
          alt_phone_number,
          ...row
        }) => ({
          ...row,
          imageLabels: {}
        })));
      } catch (e) {
        next(e);
      }
    });
    app.get('/api/warehouses/:id/visit-notes', (_req, res) => res.json([]));
    app.get('/api/warehouses/:id/image-labels', (_req, res) => res.json({}));
    app.use('/api', (_req, res) => res.status(404).json({
      error: 'Fixture endpoint not configured.'
    }));
    app.use((err, _req, res, _next) => {
      console.error(err);
      res.status(500).json({
        error: {
          message: err.message
        }
      });
    });
    await build({
      root: frontendRoot,
      configFile: false,
      envDir: buildDir,
      plugins: [react()],
      logLevel: 'warn',
      define: {
        'import.meta.env.VITE_API_BASE_URL': JSON.stringify('/api'),
        'process.env.NODE_ENV': JSON.stringify('production')
      },
      build: {
        outDir: buildDir,
        emptyOutDir: false,
        rollupOptions: {
          input: join(frontendRoot, 'e2e/field-review.html')
        }
      }
    });
    app.use(express.static(buildDir));
    app.get('/{*path}', (_req, res) => res.sendFile(join(buildDir, 'e2e/field-review.html')));
    server = await new Promise(r => {
      const listener = app.listen(0, '127.0.0.1', () => r(listener));
    });
    return {
      url: 'http://127.0.0.1:' + server.address().port,
      db,
      service,
      seed,
      close
    };
  } catch (e) {
    await close();
    throw e;
  }
}
