import Module from 'node:module';

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

for (let i = 1; i <= 6; i++) {
  const r = await s.appendNextCycle();
  const types = [...new Set(r.blocks.map((b) => b.type))];
  console.log(`cycle ${i}:`, {
    blockCount: r.blocks.length,
    caughtUp: r.caughtUp,
    types,
    onlyCaughtUp: r.blocks.length === 1 && r.blocks[0].type === 'caught-up',
  });
  if (r.caughtUp && r.blocks.every((b) => b.type === 'caught-up')) break;
}
