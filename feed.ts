import { Article, VideoItem, normalizeVideoList } from './api';

export const API_BASE = 'https://the-cut-production-f9f7.up.railway.app';

export const FEED_PAGE_SIZE = {
  news: 20,
  topVideos: 10,
  topShorts: 10,
  creatorVideos: 20,
} as const;

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
  topVideos: { offset: number; exhausted: boolean };
  topShorts: { offset: number; exhausted: boolean };
  creatorVideos: { offset: number; exhausted: boolean };
};

async function fetchNewsPage(page: number): Promise<{ articles: Article[]; totalResults?: number }> {
  const res = await fetch(
    `${API_BASE}/news?page=${page}&pageSize=${FEED_PAGE_SIZE.news}`,
  );
  const json = await res.json();
  const articles: Article[] = Array.isArray(json) ? json : json.articles || [];
  return { articles, totalResults: json.totalResults };
}

async function fetchTopVideosPage(offset: number): Promise<VideoItem[]> {
  const res = await fetch(
    `${API_BASE}/top-videos?limit=${FEED_PAGE_SIZE.topVideos}&offset=${offset}`,
  );
  return normalizeVideoList(await res.json());
}

async function fetchTopShortsPage(offset: number): Promise<VideoItem[]> {
  const res = await fetch(
    `${API_BASE}/top-shorts?limit=${FEED_PAGE_SIZE.topShorts}&offset=${offset}`,
  );
  return normalizeVideoList(await res.json());
}

async function fetchCreatorVideosPage(offset: number): Promise<VideoItem[]> {
  const res = await fetch(
    `${API_BASE}/creator-videos?limit=${FEED_PAGE_SIZE.creatorVideos}&offset=${offset}`,
  );
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
  private topVideosQueue: VideoItem[] = [];
  private topShortsQueue: VideoItem[] = [];
  private creatorVideosQueue: VideoItem[] = [];

  readonly pagination: PaginationCursor = {
    news: { page: 0, exhausted: false },
    topVideos: { offset: 0, exhausted: false },
    topShorts: { offset: 0, exhausted: false },
    creatorVideos: { offset: 0, exhausted: false },
  };

  private cycleIndex = 0;
  private caughtUpAppended = false;

  private queuedArticleUrls(): Set<string> {
    return new Set([
      ...this.newsQueue.map((a) => a.url),
      ...this.bbcQueue.map((a) => a.url),
    ]);
  }

  private queuedVideoIds(): Set<string> {
    return new Set([
      ...this.topVideosQueue.map((v) => v.videoId),
      ...this.topShortsQueue.map((v) => v.videoId),
      ...this.creatorVideosQueue.map((v) => v.videoId),
    ]);
  }

  async ensureInitialLoad(): Promise<void> {
    await Promise.all([
      this.refillNews(),
      this.refillTopVideos(),
      this.refillTopShorts(),
      this.refillCreatorVideos(),
    ]);
  }

  isAllExhausted(): boolean {
    const p = this.pagination;
    return (
      p.news.exhausted &&
      p.topVideos.exhausted &&
      p.topShorts.exhausted &&
      p.creatorVideos.exhausted &&
      this.newsQueue.length === 0 &&
      this.bbcQueue.length === 0 &&
      this.topVideosQueue.length === 0 &&
      this.topShortsQueue.length === 0 &&
      this.creatorVideosQueue.length === 0
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

  private async refillTopVideos(): Promise<void> {
    if (this.pagination.topVideos.exhausted) return;
    const offset = this.pagination.topVideos.offset;
    const items = await fetchTopVideosPage(offset);
    const queued = this.queuedVideoIds();
    const fresh = dedupeVideos(items, this.shownVideos, queued);
    if (fresh.length === 0) {
      this.pagination.topVideos.exhausted = true;
      return;
    }
    this.topVideosQueue.push(...fresh);
    this.pagination.topVideos.offset += items.length;
    if (items.length < FEED_PAGE_SIZE.topVideos) {
      this.pagination.topVideos.exhausted = true;
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

  private async refillCreatorVideos(): Promise<void> {
    if (this.pagination.creatorVideos.exhausted) return;
    const offset = this.pagination.creatorVideos.offset;
    const items = await fetchCreatorVideosPage(offset);
    const queued = this.queuedVideoIds();
    const fresh = dedupeVideos(items, this.shownVideos, queued);
    if (fresh.length === 0) {
      this.pagination.creatorVideos.exhausted = true;
      return;
    }
    this.creatorVideosQueue.push(...fresh);
    this.pagination.creatorVideos.offset += items.length;
    if (items.length < FEED_PAGE_SIZE.creatorVideos) {
      this.pagination.creatorVideos.exhausted = true;
    }
  }

  private async topUpPools(): Promise<void> {
    const minNews = 18;
    const minVideos = 2;
    const minShorts = 4;
    const minCreator = 8;

    const tasks: Promise<void>[] = [];
    if (this.newsQueue.length + this.bbcQueue.length < minNews && !this.pagination.news.exhausted) {
      tasks.push(this.refillNews());
    }
    if (this.topVideosQueue.length < minVideos && !this.pagination.topVideos.exhausted) {
      tasks.push(this.refillTopVideos());
    }
    if (this.topShortsQueue.length < minShorts && !this.pagination.topShorts.exhausted) {
      tasks.push(this.refillTopShorts());
    }
    if (this.creatorVideosQueue.length < minCreator && !this.pagination.creatorVideos.exhausted) {
      tasks.push(this.refillCreatorVideos());
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

  private takeFeaturedVideo(tag: string): FeedBlock | null {
    if (this.topVideosQueue.length === 0) return null;
    const video = this.topVideosQueue.shift()!;
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
    while (shorts.length < 4 && this.topShortsQueue.length > 0) {
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

  private takeFullBleedShort(short: VideoItem, tag: string): FeedBlock {
    return {
      id: `c${this.cycleIndex}-full-bleed-${short.videoId}`,
      type: 'full-bleed-short',
      short,
      tag,
    };
  }

  private takeCreatorCarousels(): FeedBlock[] {
    const blocks: FeedBlock[] = [];
    if (this.creatorVideosQueue.length === 0) return blocks;

    const batch = this.creatorVideosQueue.splice(
      0,
      Math.min(FEED_PAGE_SIZE.creatorVideos, this.creatorVideosQueue.length),
    );
    batch.forEach((v) => this.shownVideos.add(v.videoId));

    const nonShort = batch.filter((v) => !v.title?.toLowerCase().includes('short'));
    const half = Math.ceil(nonShort.length / 2) || Math.ceil(batch.length / 2);
    const highlights = (nonShort.length ? nonShort : batch).slice(0, half);
    const interviews = (nonShort.length ? nonShort : batch).slice(half);

    if (highlights.length) {
      blocks.push({
        id: `c${this.cycleIndex}-creator-highlights-${highlights[0].videoId}`,
        type: 'video-carousel',
        videos: highlights,
        tag: 'Creator',
        title: 'Creator highlights',
        subtitle: 'Best of the last 7 days',
      });
    }
    if (interviews.length) {
      blocks.push({
        id: `c${this.cycleIndex}-creator-interviews-${interviews[0].videoId}`,
        type: 'video-carousel',
        videos: interviews,
        tag: 'Creator',
        title: 'Interviews',
        subtitle: 'Straight from the players',
      });
    }
    return blocks;
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
    const tourFeatured = this.takeFeaturedVideo('Tour / media');
    if (tourFeatured) blocks.push(tourFeatured);

    const shortsBlock = this.takeShortsCarousel('Tour / media', 'Shorts');
    if (shortsBlock && shortsBlock.type === 'shorts-carousel') {
      blocks.push(shortsBlock);
      blocks.push(this.takeFullBleedShort(shortsBlock.shorts[0], 'Tour / media · full-bleed'));
    }

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

    // Slots 13–14: creator carousels
    blocks.push(...this.takeCreatorCarousels());

    // Slot 15: creator featured video
    const creatorFeatured = this.takeFeaturedVideo('Creator');
    if (creatorFeatured) blocks.push(creatorFeatured);

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
