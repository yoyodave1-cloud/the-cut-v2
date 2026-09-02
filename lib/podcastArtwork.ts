type LookupResult = {
  artworkUrl600?: string;
};

type LookupResponse = {
  results?: LookupResult[];
};

const artworkCache = new Map<string, string | null>();
const inflight = new Map<string, Promise<string | null>>();

async function lookupArtwork(applePodcastId: string): Promise<string | null> {
  const res = await fetch(
    `https://itunes.apple.com/lookup?id=${encodeURIComponent(applePodcastId)}&entity=podcast`,
  );
  if (!res.ok) return null;
  const payload = (await res.json()) as LookupResponse;
  const uri = payload.results?.[0]?.artworkUrl600;
  return typeof uri === 'string' && uri.trim() !== '' ? uri.trim() : null;
}

/** In-memory iTunes artwork lookup, keyed by Apple Podcasts collection id. */
export function fetchPodcastArtwork(applePodcastId: string): Promise<string | null> {
  const id = applePodcastId.trim();
  if (!id) return Promise.resolve(null);
  if (artworkCache.has(id)) return Promise.resolve(artworkCache.get(id) ?? null);

  const pending = inflight.get(id);
  if (pending) return pending;

  const request = lookupArtwork(id)
    .then((uri) => {
      artworkCache.set(id, uri);
      return uri;
    })
    .catch(() => {
      artworkCache.set(id, null);
      return null;
    })
    .finally(() => {
      inflight.delete(id);
    });

  inflight.set(id, request);
  return request;
}
