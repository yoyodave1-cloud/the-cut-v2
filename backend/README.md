# Creators top-100 backend patch

v2 calls `GET /creators/top100` on the shared Railway API.

## Route

`GET /creators/top100` — returns active creators with `type` of `competitive` or `instruction`, ordered by `subscriber_count` descending, split into `top50` (first 50) and `honorableMentions` (remainder). Also includes `top1LatestVideo`: the most recent long-form video for the #1 ranked creator. Tour (`type = tour`) and broadcaster/media (`type = media`) channels are excluded.

## Daily cron

`refreshCreatorSubscriberCounts()` — YouTube `channels.list` in batches of 50, updates all active creators in Supabase. Scheduled at **03:00 UTC** (after the 02:00 view-count refresh). No change to `fetchYouTubeFeeds()` (every 8h).

## Integration (`the-cut/backend/server.js`)

```js
const {
  registerCreatorsTop100Routes,
  scheduleCreatorSubscriberRefresh,
  refreshCreatorSubscriberCounts,
} = require('./patches/creators-top100');

registerCreatorsTop100Routes(app, supabase);
scheduleCreatorSubscriberRefresh(cron, supabase);
void refreshCreatorSubscriberCounts(supabase); // optional on startup
```

## Env

- `YOUTUBE_API_KEY` — shared with `fetchYouTubeFeeds()` / `refreshVideoViewCounts()`
- Supabase `creators` table: `subscriber_count`, `channel_id`, `type`, `active`
