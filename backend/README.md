# Backend patches for The Cut v2

Patches in this folder integrate with the shared Railway API (`the-cut/backend/server.js`).

## Hot Right Now (live in server.js)

`GET /hot-right-now`

Ranks long-form `creator_videos` by view velocity over the last 14 days.

**Creator-only:** rows whose `creators.type` is `tour` or `media` are excluded **before** the top-N slice. Home section 3 and the Creators page `HotRightNowCard` share this endpoint (and the Remotion section-post render calls it with no extra filter), so one backend change covers all three.

Optional `?types=competitive,instruction,podcast` still narrows the independent pool. `tour` / `media` in that param are ignored.

Typical independent pool (production check, 2026-09-08): 50 ranked independent videos available at `?types=competitive,instruction,podcast&limit=50` (34 competitive / 13 instruction / 3 podcast). Unfiltered top 50 was 24 competitive / 13 tour / 9 instruction / 3 media / 1 podcast — excluding tour/media does not underfill a top-10.

`filterIndependentCreators.js` (Social Media Daily Creator Carousel) applies the same type lists as a **post-fetch** filter. It is not used here: applying it after ranking would drop tour/media rows from an already-sliced top-10 and could underfill. The backend exclude runs before slice, matching that util's allowed/excluded types (`competitive | instruction | podcast | personality` vs `tour | media`).

## Featured Tour / Featured Creator (live in server.js)

`GET /featured-sections`

Returns the active homepage slices from Supabase `featured_sections`:

```json
{ "tour": { "subtitle": "...", "cardType": "large_news", "card": {} } | null, "creator": { ... } | null }
```

Each key is `null` when no `is_active` row exists (or on DB error). In-memory cache TTL is 3 minutes. Registered via `patches/featured-sections.js`.

```js
const { registerFeaturedSectionsRoutes } = require('./patches/featured-sections');
registerFeaturedSectionsRoutes(app, supabase);
```

## Creators top-100

`patches/creators-top100.js` — `GET /creators/top100`

Returns active creators with `type` of `competitive` or `instruction`, ordered by `subscriber_count` descending, split into `top50` and `honorableMentions`. Also includes `top1LatestVideo` for the #1 ranked creator. Tour (`type = tour`) and broadcaster/media (`type = media`) channels are excluded.

```js
const {
  registerCreatorsTop100Routes,
  scheduleCreatorSubscriberRefresh,
} = require('./patches/creators-top100');

registerCreatorsTop100Routes(app, supabase);
scheduleCreatorSubscriberRefresh(cron, supabase);
```

## Top shorts creator-type filter (live in server.js)

`GET /top-shorts?types=tour,media&limit=&offset=`

Optional `types` query param — comma-separated `creators.type` values (e.g. `tour`, `media`, `competitive`). When present, results are limited to active creators in those types (same ranked/date-window logic as the default route). When omitted, returns the existing mixed pool (all creator types).

Home feed slots 7–8 call `?types=tour,media`.

## Top videos pagination

`patches/top-videos-pagination.js` — `GET /top-videos?limit=&offset=`

Ensures `limit` and `offset` are applied via Supabase `.range()`. Returns creator long-form videos only (types `competitive` | `instruction`), ordered by `view_count` descending.

```js
const { registerTopVideosPaginationRoutes } = require('./patches/top-videos-pagination');
registerTopVideosPaginationRoutes(app, supabase);
```

## News creator filter

`patches/news-creator-filter.js` — `GET /news?creatorKeyword=creator`

When `creatorKeyword` is set, filters aggregated articles to those mentioning any active creator channel name.

```js
const { registerNewsCreatorFilter } = require('./patches/news-creator-filter');
app.get('/news', registerNewsCreatorFilter(supabase, getNewsPayload));
```

## The Feed column (Golf Digest)

`patches/the-feed-column.js` — Coleman Bentley's weekly creator column.

- `golfdigest.com` is already in `NEWSAPI_GOLF_DOMAINS` in `server.js`.
- `GET /news?theFeed=1` — NewsAPI query scoped to Golf Digest, filtered to `The Feed:` headlines / `the-feed` URL slugs.
- Client pins the latest edition in Creator page compact card slot 3 via `fetchLatestTheFeedArticle()`.

## Featured podcast carousel

`patches/featured-podcast-carousel.js` — `GET /creator-videos?featured=podcast`

Returns one most-recent upload per active `type=podcast` creator (no Shorts duration filter), ordered with a deterministic twice-daily shuffle. Creators page featured carousel uses this endpoint.

`GET /creator-videos?featured=podcast&pick=3daily` — same latest-per-creator query, then a day-of-year seeded shuffle (different seed from the carousel) taking the first 3. Home Section 5 featured cards use this. Each item includes `applePodcastId` for iTunes artwork lookup.

## Creator Content Masterclass

`patches/short-game-videos.js` — `GET /short-game-videos`

Returns curated hand-picked lessons nested by main topic and sub-topic. Response shape:

```json
{
  "mainTopics": [
    {
      "mainTopic": "Putting",
      "subTopics": [
        {
          "topic": "Lag Putts",
          "videos": [
            {
              "youtubeVideoId": "...",
              "title": "...",
              "channelName": "...",
              "displayOrder": 1
            }
          ]
        }
      ]
    }
  ]
}
```

Seven main topics (fixed order): Putting, Chipping, Bunker, Pitching, Approach Irons, Hybrids & Woods, Drivers — each with four sub-topic carousels. Cached in-memory for 1 hour. Serves a Putting-only curated fallback when Supabase is empty or unreachable.

## Creator page news filter

`lib/creatorNewsFilter.js` — used by `GET /news/creator-page`

- **Compact cards (3) and Trending in Creator Golf:** same strict pool — top 50 + ranks 51–63 leaderboard creators (`competitive|instruction` only); title/description must explicitly mention a creator name, handle, or normalized variant (parenthetical stripped, trailing “Golf” dropped, `@` stripped). No RSS bypass, no fallback to the broader pool. Return however many matched (0–3 compact, 0–4 trending). Response includes `compactMeta` / `trendingMeta: { requested, returned, match: "leaderboard-top63-name" }`; server logs underfill warnings.
- **News match exclusions:** Bryson DeChambeau is omitted from leaderboard keyword matching (still on Top 50) to avoid PGA Tour coverage noise.

Setup:

```bash
# Run SQL in Supabase once:
# backend/supabase/migrations/short_game_videos.sql

node scripts/seedShortGameVideos.js
```

```js
const { registerShortGameVideosRoutes } = require('./patches/short-game-videos');
registerShortGameVideosRoutes(app, supabase);
```

Seed podcast creators:

```bash
node scripts/seedPodcastCreators.js
```

```js
const {
  isFeaturedPodcastRequest,
  handleFeaturedPodcastVideos,
} = require('./patches/featured-podcast-carousel');

app.get('/creator-videos', async (req, res) => {
  if (isFeaturedPodcastRequest(req)) {
    return handleFeaturedPodcastVideos(req, res, supabase, mapCreatorVideoRows);
  }
  // ... existing handler
});
```


- `YOUTUBE_API_KEY` — shared with `fetchYouTubeFeeds()` / `refreshVideoViewCounts()`
- Supabase `creators` table: `subscriber_count`, `channel_id`, `type`, `active`

