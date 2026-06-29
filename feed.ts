import { Article, TOUR_LATEST_HEADER_LIMIT, VideoItem, normalizeVideoList } from './api';

export const API_BASE = 'https://the-cut-production-f9f7.up.railway.app';

export const FEED_PAGE_SIZE = {
  news: 20,
  topShorts: 15,
  tourHighlights: 15,
  interviews: 20,
} as const;

/** tour-latest-videos consumed per feed cycle: slot 6 + slot 13 + slot 15. */
export const TOUR_LATEST_PER_CYCLE = 1 + FEED_PAGE_SIZE.tourHighlights + 1;

export const SHORTS_CAROUSEL_SIZE = 10;

export type FeedBlock =
  | { id: string; type: 'news-compact'; article: Article; tag?: string }
  | { id: string; type: 'news-featured'; article: Article; tag?: string }
  | { id: string; type: 'news-trending'; articles: Article[] }
  | { id: string; type: 'featured-video'; video: VideoItem; tag: string }
  | { id: string; type: 'shorts-carousel'; shorts: VideoItem[]; tag: string; title: string }
  | { id: string; type: 'full-bleed-short'; short: VideoItem; tag: string }
  | {
      id: string;
      type: 'video-carousel';
      videos: VideoItem[];
      tag: string;
      title: string;
      subtitle: string;
    }
  | { id: string; type: 'caught-up' };

type PaginationCursor = {
  news: { page: number; exhausted: boolean; totalResults?: number };
  topShorts: { offset: number; exhausted: boolean };
  tourLatest: { offset: number; exhausted: boolean };
  interviews: { offset: number; exhausted: boolean };
};

async function fetchNewsPage(page: number): Promise<{ articles: Article[]; totalResults?: number }> {
  const res = await fetch(
    `${API_BASE}/news?page=${page}&pageSize=${FEED_PAGE_SIZE.news}`,
  );
  const json = await res.json();
  const articles: Article[] = Array.isArray(json) ? json : json.articles || [];
  return { articles, totalResults: json.totalResults };
}

async function fetchTopShortsPage(offset: number): Promise<VideoItem[]> {
  const res = await fetch(
    `${API_BASE}/top-shorts?types=tour,media&limit=${FEED_PAGE_SIZE.topShorts}&offset=${offset}`,
  );
  return normalizeVideoList(await res.json());
}

async function fetchInterviewVideosPage(offset: number): Promise<VideoItem[]> {
  const res = await fetch(
    `${API_BASE}/interview-videos?limit=${FEED_PAGE_SIZE.interviews}&offset=${offset}`,
  );
  if (!res.ok) throw new Error(`interview-videos failed (${res.status})`);
  return normalizeVideoList(await res.json());
}

async function fetchTourLatestPage(offset: number, limit: number): Promise<VideoItem[]> {
  const res = await fetch(
    `${API_BASE}/tour-latest-videos?limit=${limit}&offset=${offset}`,
  );
  if (!res.ok) throw new Error(`tour-latest-videos failed (${res.status})`);
  return normalizeVideoList(await res.json());
}

function partitionNews(articles: Article[]) {
  const bbc: Article[] = [];
  const other: Article[] = [];
  for (const a of articles) {
    if (a.source?.name === 'BBC News') bbc.push(a);
    else other.push(a);
  }
  return { bbc, other };
}

function dedupeArticles(items: Article[], seen: Set<string>, queued: Set<string>) {
  return items.filter((a) => a.url && !seen.has(a.url) && !queued.has(a.url));
}

function dedupeVideos(items: VideoItem[], seen: Set<string>, queued: Set<string>) {
  return items.filter((v) => v.videoId && !seen.has(v.videoId) && !queued.has(v.videoId));
}

export class FeedSession {
  private shownArticles = new Set<string>();
  private shownVideos = new Set<string>();

  private newsQueue: Article[] = [];
  private bbcQueue: Article[] = [];
  private topShortsQueue: VideoItem[] = [];
  private tourLatestQueue: VideoItem[] = [];
  private interviewsQueue: VideoItem[] = [];

  readonly pagination: PaginationCursor = {
    news: { page: 0, exhausted: false },
    topShorts: { offset: 0, exhausted: false },
    tourLatest: { offset: TOUR_LATEST_HEADER_LIMIT, exhausted: false },
    interviews: { offset: 0, exhausted: false },
  };

  private cycleIndex = 0;
  private caughtUpAppended = false;

  /** Reserve header carousel IDs so feed refills never repeat them. */
  markVideosShown(videos: readonly VideoItem[]): void {
    for (const v of videos) {
      if (v.videoId) this.shownVideos.add(v.videoId);
    }
  }

  private queuedArticleUrls(): Set<string> {
    return new Set([
      ...this.newsQueue.map((a) => a.url),
      ...this.bbcQueue.map((a) => a.url),
    ]);
  }

  private queuedVideoIds(): Set<string> {
    return new Set([
      ...this.topShortsQueue.map((v) => v.videoId),
      ...this.tourLatestQueue.map((v) => v.videoId),
      ...this.interviewsQueue.map((v) => v.videoId),
    ]);
  }

  async ensureInitialLoad(): Promise<void> {
    await Promise.all([
      this.refillNews(),
      this.refillTopShorts(),
      this.refillTourLatest(),
      this.refillInterviews(),
    ]);
  }

  isAllExhausted(): boolean {
    const p = this.pagination;
    return (
      p.news.exhausted &&
      p.topShorts.exhausted &&
      p.tourLatest.exhausted &&
      p.interviews.exhausted &&
      this.newsQueue.length === 0 &&
      this.bbcQueue.length === 0 &&
      this.topShortsQueue.length === 0 &&
      this.tourLatestQueue.length === 0 &&
      this.interviewsQueue.length === 0
    );
  }

  private async refillNews(): Promise<void> {
    if (this.pagination.news.exhausted) return;
    const nextPage = this.pagination.news.page + 1;
    const { articles, totalResults } = await fetchNewsPage(nextPage);
    if (totalResults != null) this.pagination.news.totalResults = totalResults;

    const queued = this.queuedArticleUrls();
    const fresh = dedupeArticles(articles, this.shownArticles, queued);
    if (fresh.length === 0) {
      this.pagination.news.exhausted = true;
      return;
    }

    const { bbc, other } = partitionNews(fresh);
    this.bbcQueue.push(...bbc);
    this.newsQueue.push(...other);
    this.pagination.news.page = nextPage;

    const fetchedCount = articles.length;
    const knownTotal = this.pagination.news.totalResults;
    if (fetchedCount === 0 || (knownTotal != null && nextPage * FEED_PAGE_SIZE.news >= knownTotal)) {
      this.pagination.news.exhausted = true;
    }
  }

  private async refillTopShorts(): Promise<void> {
    if (this.pagination.topShorts.exhausted) return;
    const offset = this.pagination.topShorts.offset;
    const items = await fetchTopShortsPage(offset);
    const queued = this.queuedVideoIds();
    const fresh = dedupeVideos(items, this.shownVideos, queued);
    if (fresh.length === 0) {
      this.pagination.topShorts.exhausted = true;
      return;
    }
    this.topShortsQueue.push(...fresh);
    this.pagination.topShorts.offset += items.length;
    if (items.length < FEED_PAGE_SIZE.topShorts) {
      this.pagination.topShorts.exhausted = true;
    }
  }

  private async refillTourLatest(): Promise<void> {
    if (this.pagination.tourLatest.exhausted) return;
    const offset = this.pagination.tourLatest.offset;
    const items = await fetchTourLatestPage(offset, FEED_PAGE_SIZE.tourHighlights);
    const queued = this.queuedVideoIds();
    const fresh = dedupeVideos(items, this.shownVideos, queued);
    if (fresh.length === 0) {
      this.pagination.tourLatest.exhausted = true;
      return;
    }
    this.tourLatestQueue.push(...fresh);
    this.pagination.tourLatest.offset += items.length;
    if (items.length < FEED_PAGE_SIZE.tourHighlights) {
      this.pagination.tourLatest.exhausted = true;
    }
  }

  private async refillInterviews(): Promise<void> {
    if (this.pagination.interviews.exhausted) return;
    const offset = this.pagination.interviews.offset;
    const items = await fetchInterviewVideosPage(offset);
    const queued = this.queuedVideoIds();
    const fresh = dedupeVideos(items, this.shownVideos, queued);
    if (fresh.length === 0) {
      this.pagination.interviews.exhausted = true;
      return;
    }
    this.interviewsQueue.push(...fresh);
    this.pagination.interviews.offset += items.length;
    if (items.length < FEED_PAGE_SIZE.interviews) {
      this.pagination.interviews.exhausted = true;
    }
  }

  private async topUpPools(): Promise<void> {
    const minNews = 18;
    const minShorts = 11;
    const minTourLatest = TOUR_LATEST_PER_CYCLE;
    const minInterviews = 8;

    const tasks: Promise<void>[] = [];
    if (this.newsQueue.length + this.bbcQueue.length < minNews && !this.pagination.news.exhausted) {
      tasks.push(this.refillNews());
    }
    if (this.topShortsQueue.length < minShorts && !this.pagination.topShorts.exhausted) {
      tasks.push(this.refillTopShorts());
    }
    if (this.tourLatestQueue.length < minTourLatest && !this.pagination.tourLatest.exhausted) {
      tasks.push(this.refillTourLatest());
    }
    if (this.interviewsQueue.length < minInterviews && !this.pagination.interviews.exhausted) {
      tasks.push(this.refillInterviews());
    }
    await Promise.all(tasks);
  }

  private takeNews(): Article | null {
    if (this.newsQueue.length === 0) return null;
    const article = this.newsQueue.shift()!;
    this.shownArticles.add(article.url);
    return article;
  }

  private takeBbcNews(): Article | null {
    if (this.bbcQueue.length === 0) return null;
    const article = this.bbcQueue.shift()!;
    this.shownArticles.add(article.url);
    return article;
  }

  private takeNewsBatch(count: number): Article[] {
    const batch: Article[] = [];
    for (let i = 0; i < count; i++) {
      const a = this.takeNews();
      if (!a) break;
      batch.push(a);
    }
    return batch;
  }

  private takeNewsCompact(tag = 'News'): FeedBlock | null {
    const article = this.takeNews();
    if (!article) return null;
    return {
      id: `c${this.cycleIndex}-news-compact-${article.url}`,
      type: 'news-compact',
      article,
      tag,
    };
  }

  private takeNewsFeatured(tag = 'News'): FeedBlock | null {
    const article = this.takeNews();
    if (!article) return null;
    return {
      id: `c${this.cycleIndex}-news-featured-${article.url}`,
      type: 'news-featured',
      article,
      tag,
    };
  }

  private takeTourLatestFeatured(tag: string): FeedBlock | null {
    if (this.tourLatestQueue.length === 0) return null;
    const video = this.tourLatestQueue.shift()!;
    this.shownVideos.add(video.videoId);
    return {
      id: `c${this.cycleIndex}-featured-video-${video.videoId}-${tag}`,
      type: 'featured-video',
      video,
      tag,
    };
  }

  private takeShortsCarousel(tag: string, title: string): FeedBlock | null {
    const shorts: VideoItem[] = [];
    while (shorts.length < SHORTS_CAROUSEL_SIZE && this.topShortsQueue.length > 0) {
      const s = this.topShortsQueue.shift()!;
      this.shownVideos.add(s.videoId);
      shorts.push(s);
    }
    if (shorts.length === 0) return null;
    return {
      id: `c${this.cycleIndex}-shorts-${shorts.map((s) => s.videoId).join('-')}`,
      type: 'shorts-carousel',
      shorts,
      tag,
      title,
    };
  }

  private takeFullBleedShortBlock(tag: string): FeedBlock | null {
    if (this.topShortsQueue.length === 0) return null;
    const short = this.topShortsQueue.shift()!;
    this.shownVideos.add(short.videoId);
    return {
      id: `c${this.cycleIndex}-full-bleed-${short.videoId}`,
      type: 'full-bleed-short',
      short,
      tag,
    };
  }

  private takeTourHighlightsCarousel(): FeedBlock | null {
    const videos: VideoItem[] = [];
    while (videos.length < FEED_PAGE_SIZE.tourHighlights && this.tourLatestQueue.length > 0) {
      const v = this.tourLatestQueue.shift()!;
      this.shownVideos.add(v.videoId);
      videos.push(v);
    }
    if (videos.length === 0) return null;
    return {
      id: `c${this.cycleIndex}-tour-highlights-${videos[0].videoId}`,
      type: 'video-carousel',
      videos,
      tag: 'Tour',
      title: 'Tour highlights',
      subtitle: 'Best of the last 7 days',
    };
  }

  private takeTourMediaInterviewsCarousel(): FeedBlock | null {
    if (this.interviewsQueue.length === 0) return null;

    const batch = this.interviewsQueue.splice(
      0,
      Math.min(FEED_PAGE_SIZE.interviews, this.interviewsQueue.length),
    );
    batch.forEach((v) => this.shownVideos.add(v.videoId));
    if (batch.length === 0) return null;

    return {
      id: `c${this.cycleIndex}-tour-interviews-${batch[0].videoId}`,
      type: 'video-carousel',
      videos: batch,
      tag: 'Tour / media',
      title: 'Interviews',
      subtitle: 'Press conferences and player interviews',
    };
  }

  private takeBbcOrNews(): Article | null {
    return this.takeBbcNews() ?? this.takeNews();
  }

  /** Locked 21-slot sequence — skips slots when a content type is exhausted. */
  private buildCycleBlocks(): FeedBlock[] {
    const blocks: FeedBlock[] = [];
    const cycle = this.cycleIndex;

    const pushCompact = (tag?: string) => {
      const b = this.takeNewsCompact(tag);
      if (b) blocks.push(b);
    };
    const pushFeatured = (tag?: string) => {
      const b = this.takeNewsFeatured(tag);
      if (b) blocks.push(b);
    };

    // Slots 1–2: compact news
    pushCompact();
    pushCompact();

    // Slot 3: BBC pinned
    const bbc3 = this.takeBbcOrNews();
    if (bbc3) {
      blocks.push({
        id: `c${cycle}-news-compact-bbc3-${bbc3.url}`,
        type: 'news-compact',
        article: bbc3,
        tag: 'News · BBC pinned, #3',
      });
    }

    // Slot 4: trending list (4 articles)
    const trending = this.takeNewsBatch(4);
    if (trending.length) {
      blocks.push({
        id: `c${cycle}-trending-${trending[0].url}`,
        type: 'news-trending',
        articles: trending,
      });
    }

    // Slot 5
    pushCompact();

    // Slots 6–8: tour / media video block
    const tourFeatured = this.takeTourLatestFeatured('Tour / media');
    if (tourFeatured) blocks.push(tourFeatured);

    const shortsBlock = this.takeShortsCarousel('Tour / media', 'Shorts');
    if (shortsBlock) blocks.push(shortsBlock);

    const fullBleedBlock = this.takeFullBleedShortBlock('Tour / media · full-bleed');
    if (fullBleedBlock) blocks.push(fullBleedBlock);

    // Slot 9: BBC again
    const bbc8 = this.takeBbcOrNews();
    if (bbc8) {
      blocks.push({
        id: `c${cycle}-news-compact-bbc8-${bbc8.url}`,
        type: 'news-compact',
        article: bbc8,
        tag: 'News · BBC, different article',
      });
    }

    // Slot 10: featured news
    pushFeatured();

    // Slots 11–12
    pushCompact();
    pushCompact();

    // Slots 13–14: tour highlights + interviews
    const tourHighlights = this.takeTourHighlightsCarousel();
    if (tourHighlights) blocks.push(tourHighlights);

    const tourInterviews = this.takeTourMediaInterviewsCarousel();
    if (tourInterviews) blocks.push(tourInterviews);

    // Slot 15: tour / media featured video
    const tourFeatured2 = this.takeTourLatestFeatured('Tour / media');
    if (tourFeatured2) blocks.push(tourFeatured2);

    // Slots 16–17
    pushCompact();
    pushCompact();

    // Slots 18–19: featured news x2
    pushFeatured();
    pushFeatured();

    // Slots 20–22 (documented as 19–21): compact x3
    pushCompact();
    pushCompact();
    pushCompact();

    return blocks;
  }

  async appendNextCycle(): Promise<{ blocks: FeedBlock[]; caughtUp: boolean }> {
    if (this.caughtUpAppended) {
      return { blocks: [], caughtUp: true };
    }

    await this.topUpPools();
    let blocks = this.buildCycleBlocks();

    if (blocks.length === 0 && !this.isAllExhausted()) {
      await this.topUpPools();
      blocks = this.buildCycleBlocks();
    }

    this.cycleIndex += 1;

    if (blocks.length === 0) {
      if (this.isAllExhausted() && !this.caughtUpAppended) {
        this.caughtUpAppended = true;
        return {
          blocks: [{ id: 'caught-up', type: 'caught-up' }],
          caughtUp: true,
        };
      }
      // Pools can't assemble another cycle without repeating — stop gracefully.
      if (!this.caughtUpAppended) {
        this.caughtUpAppended = true;
        return {
          blocks: [{ id: 'caught-up', type: 'caught-up' }],
          caughtUp: true,
        };
      }
      return { blocks: [], caughtUp: true };
    }

    return { blocks, caughtUp: false };
  }
}
