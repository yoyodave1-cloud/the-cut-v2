/**
 * Academy service — standalone always-on HTTP server (Railway).
 *
 * Deployed separately from The Cut's shared backend on purpose: pose
 * estimation pulls in TensorFlow + ffmpeg, and isolating it means a bad
 * deploy or a heavy analysis burst can never take the main app's API down.
 *
 * Env:
 *   SUPABASE_URL, SUPABASE_SERVICE_KEY   required
 *   PORT                                  provided by Railway (default 4100)
 *   ANTHROPIC_API_KEY                     optional — coaching falls back to
 *                                         built-in copy without it
 *   ACADEMY_COACH_MODEL                   default claude-fable-5; set
 *                                         claude-haiku-4-5-20251001 in prod
 *   ACADEMY_POSE_MODEL                    movenet (default) | blazepose
 *
 * Local dev: cd backend/academy && npm install && node server.js (reads .env)
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
  console.error('Set SUPABASE_URL and SUPABASE_SERVICE_KEY before starting the Academy service.');
  process.exit(1);
}

const app = express();
app.use(express.json());
app.get('/health', (_req, res) => res.json({ ok: true, service: 'academy' }));

registerAcademyRoutes(app, createClient(url, key));

const port = Number(process.env.PORT) || 4100;
app.listen(port, () => {
  console.log(`[academy] service listening on :${port}`);
  // Warm the pose detector (model download + backend init) so the first
  // user upload doesn't pay the cold-start cost.
  // eslint-disable-next-line global-require
  require('./poseEstimation')
    .warmUp()
    .then(() => console.log('[academy] pose detector warm'))
    .catch((err) => console.warn('[academy] detector warm-up failed (will retry on first upload):', err.message));
});
