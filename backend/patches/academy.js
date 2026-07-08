/**
 * Academy — swing upload, 2D pose analysis, coaching, and recommendations.
 *
 * Integration (the-cut/backend/server.js):
 *   const { registerAcademyRoutes } = require('./patches/academy');
 *   registerAcademyRoutes(app, supabase);
 *
 * Requires the backend/academy/ folder alongside patches/, plus the npm deps
 * listed in backend/academy/package.json (see backend/README.md, "Academy").
 */

module.exports = require('../academy/routes');
