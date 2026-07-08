/**
 * Ensures GET /top-videos respects limit and offset query params.
 *
 * Previously the route accepted limit/offset but always returned a fixed page size.
 * This patch replaces the handler with explicit Supabase range slicing.
 *
 * Integration (the-cut/backend/server.js):
 *   const { registerTopVideosPaginationRoutes } = require('./patches/top-videos-pagination');
 *   registerTopVideosPaginationRoutes(app, supabase);
 */

const CREATOR_VIDEO_TYPES = ['competitive', 'instruction'];
const DEFAULT_LIMIT = 20;
const MAX_LIMIT = 50;

function parsePositiveInt(value, fallback) {
  const n = parseInt(String(value ?? ''), 10);
  if (!Number.isFinite(n) || n < 0) return fallback;
  return n;
}

function registerTopVideosPaginationRoutes(app, supabase) {
  app.get('/top-videos', async (req, res) => {
    try {
      const limit = Math.min(
        Math.max(parsePositiveInt(req.query.limit, DEFAULT_LIMIT), 1),
        MAX_LIMIT,
      );
      const offset = parsePositiveInt(req.query.offset, 0);

      const { data, error } = await supabase
        .from('creator_videos')
        .select(
          'id,video_id,title,summary,published_at,view_count,creators(name,handle,avatar_url)',
        )
        .eq('is_short', false)
        .in(
          'creator_id',
          (
            await supabase
              .from('creators')
              .select('id')
              .eq('active', true)
              .in('type', CREATOR_VIDEO_TYPES)
          ).data?.map((row) => row.id) ?? [],
        )
        .order('view_count', { ascending: false, nullsFirst: false })
        .range(offset, offset + limit - 1);

      if (error) {
        return res.status(500).json({
          error: 'Database error',
          message: error.message,
        });
      }

      return res.json(Array.isArray(data) ? data : []);
    } catch (err) {
      return res.status(500).json({
        error: 'Server error',
        message: err instanceof Error ? err.message : String(err),
      });
    }
  });
}

module.exports = {
  registerTopVideosPaginationRoutes,
  CREATOR_VIDEO_TYPES,
  DEFAULT_LIMIT,
  MAX_LIMIT,
};
