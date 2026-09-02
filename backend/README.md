# Backend patches for The Cut v2

Patches in this folder integrate with the shared Railway API (`the-cut/backend/server.js`).

## Academy (swing analysis)

The `academy/` folder is a **standalone Railway service** (project `the-cut-academy`,
service `academy`, entrypoint `academy/server.js`), deployed separately from the shared
backend so pose analysis can never affect the main app's API.

Production URL: `https://academy-production-752f.up.railway.app` (the app's
`lib/academy/api.ts` points here). Deploy updates with
`cd backend/academy && railway up --service academy --detach`.

Pipeline: upload a swing video → 2D pose estimation (MoveNet via TensorFlow.js; no LLM)
→ per-shot-type checkpoint/fault evaluation → coaching narration (Claude over structured
data only; deterministic fallback without a key) → creator-video recommendations.

**Privacy/cost model (round 2):** raw video is processed from a temp file and deleted —
it is *never* stored server-side (no storage bucket, no video columns). The user's device
keeps the only copy (`lib/academy/localVideo.ts`); the durable record is the pose landmark
data. Analyses run through a serial in-process queue to keep memory flat on a small
always-on instance.

Routes:

- `GET /health`
- `GET /academy/shot-types` — checkpoint library metadata (phases, metrics, faults, recording tips)
- `POST /academy/uploads` — multipart `video` + `userId`, `shotType` (`driving|iron|bunker|chipping|putting`), `angleType` (`face_on|down_the_line`). Returns `{uploadId, status: "processing"}`; analysis is queued, video deleted after processing.
- `GET /academy/uploads/:id` — status + full analysis + recommendations when complete
- `GET /academy/uploads?userId=&shotType=` — session history with per-session summaries
- `DELETE /academy/uploads/:id?userId=` — delete one session; progress rows cascade so trends drop it immediately
- `DELETE /academy/users/:userId` — GDPR erase-all for a user
- `GET /academy/dashboard?userId=` — per-shot-type trends, focus faults, recent recommendations

Env (set on the Railway service): `SUPABASE_URL`, `SUPABASE_SERVICE_KEY`,
`ANTHROPIC_API_KEY` (optional — coaching falls back to built-in copy),
`ACADEMY_COACH_MODEL` (prod runs `claude-haiku-4-5-20251001`; prototype default is
`claude-fable-5`), `ACADEMY_POSE_MODEL` (`movenet` default | `blazepose`).

Migrations: `backend/supabase/migrations/academy.sql` + `academy_round2_local_video.sql`
(both applied to the live project, 2026-07-08).

Local dev: `cd backend/academy && npm install && node server.js` (reads `.env`; listens
on :4100 — point `ACADEMY_API_BASE` at your LAN IP). Tests: `node smokeTest.js` runs 45
ground-truth keyframe/tempo cases — 5 shot types × tempo/trim/aftermath variants including
tee-pickup, walk-off, camera-grab, and motion-blur wrist dropout (no video needed);
`node smokeTest.js swing.mp4 driving face_on` runs the full pipeline on a real clip.

Phase detection is anchored on a swing-likeness search (ankle stillness, shoulder-height
stability, hands-return-to-address, hand-height V), so footage before/after the swing —
waggles, picking up the tee, walking off, grabbing the camera — can never claim a
checkpoint. Long clips are re-sampled densely (two-pass) around the detected swing.

`patches/academy.js` remains only for optionally mounting the same routes inside the
shared `server.js` — not the deployed path.

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

