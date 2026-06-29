import type { Article } from '../api';

export const THE_FEED_COLUMN_AUTHOR = 'Coleman Bentley';
export const THE_FEED_CARD_TAG = 'The Feed · Golf Digest';

export type TheFeedArticle = {
  title?: string;
  description?: string;
  url?: string;
  source?: { name?: string };
  publishedAt?: string;
};

/** Coleman Bentley's weekly "The Feed" column on Golf Digest. */
export function articleIsTheFeedColumn(article: TheFeedArticle): boolean {
  const title = (article.title ?? '').trim();
  const url = (article.url ?? '').toLowerCase();
  const description = (article.description ?? '').toLowerCase();
  const source = (article.source?.name ?? '').toLowerCase();

  if (/^the feed:/i.test(title)) {
    return true;
  }

  if (url.includes('golfdigest.com') && /the-feed/.test(url)) {
    return true;
  }

  if (source.includes('golf digest') && description.includes('coleman bentley')) {
    return true;
  }

  return false;
}

function publishedAtMs(article: TheFeedArticle): number {
  const ms = Date.parse(article.publishedAt ?? '');
  return Number.isFinite(ms) ? ms : 0;
}

export function pickLatestTheFeedArticle<T extends TheFeedArticle>(articles: T[]): T | null {
  const matches = articles.filter(articleIsTheFeedColumn);
  if (!matches.length) return null;
  return [...matches].sort((a, b) => publishedAtMs(b) - publishedAtMs(a))[0] ?? null;
}

export function filterTheFeedArticles<T extends TheFeedArticle>(articles: T[]): T[] {
  return articles.filter(articleIsTheFeedColumn);
}
