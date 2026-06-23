const API_BASE = 'https://the-cut-production-f9f7.up.railway.app';
const FEED_PAGE_SIZE = { news: 20, topVideos: 10, topShorts: 15, creatorVideos: 20 };
const SHORTS_CAROUSEL_SIZE = 10;

function normalizeVideoItem(raw) {
  const videoId = raw.videoId ?? raw.video_id ?? '';
  return { videoId, title: raw.title ?? '' };
}
function normalizeVideoList(raw) {
  const list = Array.isArray(raw) ? raw : raw?.videos ?? [];
  return list.map(normalizeVideoItem).filter((v) => v.videoId);
}

async function fetchNewsPage(page) {
  const res = await fetch(`${API_BASE}/news?page=${page}&pageSize=${FEED_PAGE_SIZE.news}`);
  const json = await res.json();
  const articles = Array.isArray(json) ? json : json.articles || [];
  return { articles, totalResults: json.totalResults, status: res.status };
}

async function main() {
  const news = await fetchNewsPage(1);
  const [videos, shorts, creator] = await Promise.all([
    fetch(`${API_BASE}/top-videos?limit=10&offset=0`).then((r) => r.json()),
    fetch(`${API_BASE}/top-shorts?limit=15&offset=0`).then((r) => r.json()),
    fetch(`${API_BASE}/creator-videos?limit=20&offset=0`).then((r) => r.json()),
  ]);

  const vList = normalizeVideoList(videos);
  const sList = normalizeVideoList(shorts);
  const cList = normalizeVideoList(creator);

  console.log('Initial fetch:', {
    newsStatus: news.status,
    newsArticles: news.articles.length,
    newsWithUrl: news.articles.filter((a) => a.url).length,
    topVideos: vList.length,
    topShorts: sList.length,
    creatorVideos: cList.length,
  });

  const newsQueue = news.articles.filter((a) => a.source?.name !== 'BBC News');
  const bbcQueue = news.articles.filter((a) => a.source?.name === 'BBC News');
  let blocks = 0;
  const takeNews = () => (newsQueue.length ? newsQueue.shift() : null);
  for (let i = 0; i < 2; i++) if (takeNews()) blocks++;
  if (bbcQueue.length || newsQueue.length) blocks++;
  if (newsQueue.length >= 4) blocks++;
  console.log('Partial cycle news blocks possible:', blocks, 'queues', newsQueue.length, bbcQueue.length);

  const minShorts = 11;
  console.log('minShorts check:', sList.length, '>=', minShorts, '?', sList.length >= minShorts);
  console.log('Shorts for carousel+fullBleed need:', SHORTS_CAROUSEL_SIZE + 1, 'have:', sList.length);

  // Simulate exhaustion: second fetch same offset
  const shorts2 = normalizeVideoList(await fetch(`${API_BASE}/top-shorts?limit=15&offset=15`).then((r) => r.json()));
  console.log('top-shorts offset=15 returns:', shorts2.length, 'unique vs first:', shorts2.filter((v) => !sList.some((x) => x.videoId === v.videoId)).length);
}

main().catch(console.error);
