/**
 * Academy — swing upload, 2D pose analysis, coaching, and recommendations.
 *
 * Academy now runs as its OWN Railway service (backend/academy/server.js),
 * isolated from the shared backend — see backend/README.md, "Academy".
 *
 * This wrapper remains only for the optional in-process integration path
 * (mounting the routes inside the-cut/backend/server.js):
 *   const { registerAcademyRoutes } = require('./patches/academy');
 *   registerAcademyRoutes(app, supabase);
 */

module.exports = require('../academy/routes');
