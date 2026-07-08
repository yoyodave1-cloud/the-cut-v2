# Backend patches for The Cut v2

Patches in this folder integrate with the shared Railway API (`the-cut/backend/server.js`).

## Academy (swing analysis)

`patches/academy.js` + the `academy/` module folder — upload a swing video, run 2D pose
estimation (MoveNet via TensorFlow.js; no LLM), evaluate per-shot-type checkpoints/faults,
generate coaching narration (Claude, structured data only, deterministic fallback without a
key), and match faults to creator videos.

Routes:

- `GET /academy/shot-types` — checkpoint library metadata (phases, metrics, faults, recording tips)
- `POST /academy/uploads` — multipart `video` + `userId`, `shotType` (`driving|iron|bunker|chipping|putting`), `angleType` (`face_on|down_the_line`). Stores the video in the `academy-videos` Supabase bucket, returns `{uploadId, status: "processing"}`, analyses asynchronously.
- `GET /academy/uploads/:id` — status + full analysis + recommendations when complete
- `GET /academy/uploads?userId=&shotType=` — upload history (Compare view source)
- `GET /academy/dashboard?userId=` — per-shot-type trends, focus faults, recent recommendations

Integration:

```js
const { registerAcademyRoutes } = require('./patches/academy');
registerAcademyRoutes(app, supabase);
```

Deployment steps:

1. Copy `backend/academy/` and `backend/patches/academy.js` into `the-cut/backend/`.
2. Add the dependencies from `backend/academy/package.json` to `the-cut/backend/package.json`
   (`@tensorflow/tfjs`, `@tensorflow/tfjs-backend-wasm`, `@tensorflow-models/pose-detection`,
   `ffmpeg-static`, `jpeg-js`, `multer`; `@tensorflow/tfjs-node` optional — used automatically
   when it installs cleanly, otherwise the pure-JS wasm backend is used).
3. Run the SQL in `backend/supabase/migrations/academy.sql` (already applied to the live
   project on 2026-07-08).
4. Env: `ANTHROPIC_API_KEY` (optional — coaching falls back to the built-in copy without it),
   `ACADEMY_COACH_MODEL` (default `claude-fable-5`; switch to `claude-haiku-4-5-20251001` for
   production volume), `ACADEMY_POSE_MODEL` (`movenet` default | `blazepose`).

Local dev without Railway: `cd backend/academy && npm install && node devServer.js`
(needs `SUPABASE_URL` + `SUPABASE_SERVICE_KEY`; listens on :4100). Smoke test with
`node smokeTest.js` (synthetic, no video needed) or
`node smokeTest.js swing.mp4 driving face_on` for the full pipeline.

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

