/**
 * Coleman Bentley "The Feed" column — Golf Digest weekly creator roundup.
 *
 * GET /news?theFeed=1 — NewsAPI query scoped to golfdigest.com, filtered to Feed columns.
 *
 * Integration (the-cut/backend/server.js):
 *   const { registerTheFeedNewsRoute } = require('./patches/the-feed-column');
 *   registerTheFeedNewsRoute(app, { fetchEverythingOnce, parsePaginationParams, publishedAtMs });
 *
 * Requires golfdigest.com in NEWSAPI_GOLF_DOMAINS (already present in server.js).
 */

const THE_FEED_GOLF_DIGEST_DOMAINS = 'golfdigest.com';
const THE_FEED_NEWSAPI_Q = '"The Feed"';

function isTheFeedColumnArticle(article) {
  if (!article) return false;
  const title = article.title != null ? String(article.title).trim() : '';
  const url = article.url != null ? String(article.url).toLowerCase() : '';
  const description =
    article.description != null ? String(article.description).toLowerCase() : '';
  const source =
    article.source && article.source.name != null
      ? String(article.source.name).toLowerCase()
      : '';

  if (/^the feed:/i.test(title)) return true;
  if (url.includes('golfdigest.com') && /the-feed/.test(url)) return true;
  if (source.includes('golf digest') && description.includes('coleman bentley')) return true;
  return false;
}

function sortByPublishedAt(articles, publishedAtMs) {
  return [...articles].sort((a, b) => publishedAtMs(b) - publishedAtMs(a));
}

function registerTheFeedNewsRoute(app, deps) {
  const {
    fetchEverythingOnce,
    parsePaginationParams,
    publishedAtMs,
    defaultFromIsoDate,
  } = deps;

  app.get('/news/the-feed', async (req, res) => {
    const apiKey = process.env.NEWS_API_KEY;
    if (!apiKey || !String(apiKey).trim()) {
      return res.status(500).json({
        error: 'Configuration error',
        message: 'NEWS_API_KEY is not set',
      });
    }

    const { limit: pageSize, page: newsPage } = parsePaginationParams(req.query, {
      defaultLimit: 10,
      maxLimit: 50,
    });

    try {
      const { upstream, data } = await fetchEverythingOnce(apiKey, {
        q: THE_FEED_NEWSAPI_Q,
        pageSize: Math.min(pageSize, 50),
        page: newsPage,
        sortBy: 'publishedAt',
        domains: THE_FEED_GOLF_DIGEST_DOMAINS,
        from: defaultFromIsoDate(),
        searchIn: 'title',
      });

      const raw = Array.isArray(data.articles) ? data.articles : [];
      const feedArticles = sortByPublishedAt(
        raw.filter(isTheFeedColumnArticle),
        publishedAtMs,
      );

      return res.json({
        status: upstream.ok ? 'ok' : 'error',
        totalResults: feedArticles.length,
        articles: feedArticles.slice(0, pageSize),
      });
    } catch (err) {
      return res.status(500).json({
        error: 'Server error',
        message: err instanceof Error ? err.message : String(err),
      });
    }
  });
}

module.exports = {
  THE_FEED_GOLF_DIGEST_DOMAINS,
  THE_FEED_NEWSAPI_Q,
  isTheFeedColumnArticle,
  registerTheFeedNewsRoute,
};
