import Module from 'node:module';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const originalLoad = Module._load;
Module._load = function (request, parent, isMain) {
  if (request === 'react-native') {
    return { Linking: { openURL: () => {} } };
  }
  return originalLoad.apply(this, arguments);
};

const { FeedSession } = await import('../feed.ts');

const s = new FeedSession();
await s.ensureInitialLoad();

console.log('After ensureInitialLoad:', {
  newsQueue: s['newsQueue']?.length ?? 'private',
});

// Access via appendNextCycle behavior
const r = await s.appendNextCycle();
console.log('appendNextCycle result:', {
  blockCount: r.blocks.length,
  caughtUp: r.caughtUp,
  types: r.blocks.map((b) => b.type),
  ids: r.blocks.slice(0, 5).map((b) => b.id),
});

console.log('pagination exhausted flags:', {
  news: s.pagination.news.exhausted,
  topVideos: s.pagination.topVideos.exhausted,
  topShorts: s.pagination.topShorts.exhausted,
  creatorVideos: s.pagination.creatorVideos.exhausted,
});
