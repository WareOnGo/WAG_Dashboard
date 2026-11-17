// Manual form preview using the same isolated PostgreSQL setup as browser tests.
// The server only accepts the guarded local TEST_DATABASE_URL, binds to loopback,
// and uses fixture dashboard/reviewer identities. It never loads backend secrets.
import { startServer } from './server.mjs';

const preview = await startServer({
  port: 3001,
  existingSchema: process.env.PREVIEW_SCHEMA,
  corsOrigins: ['http://localhost:5173', 'http://localhost:5174', 'http://127.0.0.1:5173', 'http://127.0.0.1:5174'],
});
console.log('Local form API: http://localhost:3001');
console.log('Dashboard form: http://localhost:3001/');
console.log('Review queue: http://localhost:3001/?review');
console.log('Scout Employee ID: E2ESCOUT');
console.log('Local preview: uploads and external notifications are not configured.');

let stopping = false;
for (const signal of ['SIGINT', 'SIGTERM']) process.on(signal, async () => {
  if (stopping) return;
  stopping = true;
  await preview.close();
  process.exit(0);
});
