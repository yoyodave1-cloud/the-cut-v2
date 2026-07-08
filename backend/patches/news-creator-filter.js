/**
 * Adds creatorKeyword filtering to GET /news.
 *
 * When creatorKeyword is present, articles are filtered to those whose title or
 * description mentions any active creator channel name (competitive | instruction).
 *
 * Integration — wrap the existing news handler:
 *   const { filterArticlesByCreatorKeyword } = require('./patches/news-creator-filter');
 *
 *   app.get('/news', async (req, res) => {
 *     const payload = await getNewsPayload(req); // existing aggregator
 *     const keyword = req.query.creatorKeyword;
 *     if (keyword) {
 *       const names = await loadActiveCreatorNames(supabase);
 *       payload.articles = filterArticlesByCreatorKeyword(payload.articles, names);
 *       payload.totalResults = payload.articles.length;
 *     }
 *     res.json(payload);
 *   });
 */

const CREATOR_NEWS_TYPES = ['competitive', 'instruction'];

function articleText(article) {
  return `${article?.title ?? ''} ${article?.description ?? ''}`.toLowerCase();
}

function filterArticlesByCreatorKeyword(articles, creatorNames) {
  const names = (Array.isArray(creatorNames) ? creatorNames : [])
    .map((name) => String(name).trim().toLowerCase())
    .filter(Boolean);
  if (!names.length) return [];

  return (Array.isArray(articles) ? articles : []).filter((article) => {
    const text = articleText(article);
    return names.some((name) => text.includes(name));
  });
}

async function loadActiveCreatorNames(supabase) {
  const { data, error } = await supabase
    .from('creators')
    .select('name')
    .eq('active', true)
    .in('type', CREATOR_NEWS_TYPES);

  if (error) {
    console.warn('[news/creatorKeyword] creator lookup failed:', error.message);
    return [];
  }

  return (Array.isArray(data) ? data : [])
    .map((row) => row?.name)
    .filter(Boolean);
}

function registerNewsCreatorFilter(supabase, getNewsPayload) {
  return async function newsHandler(req, res) {
    try {
      const payload = await getNewsPayload(req);
      const keyword = req.query.creatorKeyword;
      if (keyword) {
        const names = await loadActiveCreatorNames(supabase);
        payload.articles = filterArticlesByCreatorKeyword(payload.articles, names);
        payload.totalResults = payload.articles.length;
      }
      return res.json(payload);
    } catch (err) {
      return res.status(500).json({
        error: 'Server error',
        message: err instanceof Error ? err.message : String(err),
      });
    }
  };
}

module.exports = {
  CREATOR_NEWS_TYPES,
  articleText,
  filterArticlesByCreatorKeyword,
  loadActiveCreatorNames,
  registerNewsCreatorFilter,
};
