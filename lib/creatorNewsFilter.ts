import { CREATORS } from '../constants/creators';

export type CreatorNewsArticle = {
  title?: string;
  description?: string;
  url?: string;
};

/** Personality creators only — exclude tour bodies and media/broadcasters. */
export const CREATOR_NEWS_TYPES = ['competitive', 'instruction', 'podcast'] as const;

/**
 * Podcast show aliases for keyword matching in general sources only (NewsAPI, etc.).
 * Creator-run RSS feeds use CREATOR_RSS_SOURCE_NAMES allow-list instead.
 */
export const PODCAST_NEWS_ALIASES = [
  'the fried egg',
  'fried egg golf',
  'fried egg podcast',
  'the chipping forecast',
  'chipping forecast',
  'fore play podcast',
] as const;

/** Creator-page RSS sources — every item is creator content (mirrors backend). */
export const CREATOR_RSS_SOURCE_NAMES = new Set([
  'Rough Cut Golf Podcast',
  'Rick Shiels Golf Show',
  'Basement Golf',
  'The Daily Drive',
]);

export function isCreatorRssSource(article: CreatorNewsArticle & { source?: { name?: string } }): boolean {
  const name = article.source?.name;
  return name != null && CREATOR_RSS_SOURCE_NAMES.has(name);
}

function addKeyword(keywords: Set<string>, value: string | undefined) {
  const s = (value ?? '').trim().toLowerCase();
  if (s.length >= 3) keywords.add(s);
}

function normalizeHandle(handle: string): string {
  return handle.replace(/^@+/, '').trim().toLowerCase();
}

function buildCreatorNewsKeywords(): string[] {
  const keywords = new Set<string>();

  for (const creator of CREATORS) {
    addKeyword(keywords, creator.name.toLowerCase());
    addKeyword(keywords, normalizeHandle(creator.handle));
    addKeyword(keywords, creator.id.replace(/-/g, ' '));

    const withoutGolf = creator.name.replace(/\s+golf$/i, '').trim();
    if (withoutGolf.length >= 4 && withoutGolf.toLowerCase() !== creator.name.toLowerCase()) {
      addKeyword(keywords, withoutGolf.toLowerCase());
    }

    const withoutParens = creator.name.replace(/\s*\([^)]*\)\s*/g, ' ').trim();
    if (withoutParens.toLowerCase() !== creator.name.toLowerCase()) {
      addKeyword(keywords, withoutParens.toLowerCase());
    }
  }

  for (const alias of PODCAST_NEWS_ALIASES) {
    addKeyword(keywords, alias);
  }

  return [...keywords]
    .filter((keyword) => keyword.length >= 3)
    .sort((a, b) => b.length - a.length);
}

const CREATOR_NEWS_KEYWORDS = buildCreatorNewsKeywords();

function articleText(article: CreatorNewsArticle): string {
  return `${article.title ?? ''} ${article.description ?? ''}`.toLowerCase();
}

/** Headlines that mention a tracked creator channel by name or known alias (general sources). */
export function articleMatchesCreatorNews(article: CreatorNewsArticle): boolean {
  const text = articleText(article);
  return CREATOR_NEWS_KEYWORDS.some((keyword) => text.includes(keyword));
}

/** Creator-page pool: trusted creator RSS passes through; general sources need keyword match. */
export function articleIncludedInCreatorPool(
  article: CreatorNewsArticle & { source?: { name?: string } },
): boolean {
  if (isCreatorRssSource(article)) return true;
  return articleMatchesCreatorNews(article);
}

export function filterCreatorTaggedNews<T extends CreatorNewsArticle>(articles: T[]): T[] {
  return articles.filter(articleIncludedInCreatorPool);
}

export function normalizeNewsTitleKey(title: string | undefined): string {
  return (title ?? '').trim().toLowerCase();
}
