/**
 * Standalone local server for developing/testing Academy without the shared
 * Railway backend. Not used in production — server.js integrates via
 * patches/academy.js instead.
 *
 * Usage:
 *   cd backend/academy && npm install
 *   set SUPABASE_URL=... & set SUPABASE_SERVICE_KEY=...   (or use a .env file)
 *   node devServer.js
 */

try {
  // eslint-disable-next-line global-require
  require('dotenv').config({ path: require('path').join(__dirname, '.env') });
} catch {
  /* dotenv optional */
}

const express = require('express');
const { createClient } = require('@supabase/supabase-js');
const { registerAcademyRoutes } = require('./routes');

const url = process.env.SUPABASE_URL;
const key = process.env.SUPABASE_SERVICE_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!url || !key) {
  console.error('Set SUPABASE_URL and SUPABASE_SERVICE_KEY before starting the dev server.');
  process.exit(1);
}

const app = express();
app.use(express.json());
app.get('/health', (_req, res) => res.json({ ok: true, service: 'academy-dev' }));

registerAcademyRoutes(app, createClient(url, key));

const port = Number(process.env.PORT) || 4100;
app.listen(port, () => {
  console.log(`[academy] dev server listening on http://localhost:${port}`);
});
