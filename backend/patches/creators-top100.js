/**
 * Creators top-100 route + daily subscriber refresh for The Cut backend.
 *
 * Leaderboard includes only creator channels (type competitive | instruction).
 * Tour and media/broadcaster channels (type tour | media) are excluded.
 */

const CREATOR_LEADERBOARD_TYPES = ['competitive', 'instruction'];

function mapTopCreatorRow(row) {
  if (!row || !row.id || !row.name) return null;
  return {
    id: row.id,
    name: row.name,
    handle: row.handle || '',
    avatarUrl: row.avatar_url || '',
    subscriberCount:
      typeof row.subscriber_count === 'number' ? row.subscriber_count : null,
    channelId: row.channel_id || '',
    type: row.type || '',
  };
}

function mapTop1LatestVideoRow(row, fallbackCreator) {
  if (!row?.video_id) return null;
  const creatorRel = row.creators;
  const creator = Array.isArray(creatorRel) ? creatorRel[0] : creatorRel;
  const videoId = String(row.video_id).trim();
  return {
    videoId,
    title: row.title || '',
    summary: row.summary || '',
    publishedAt: row.published_at || null,
    thumbnailUrl: `https://img.youtube.com/vi/${videoId}/hqdefault.jpg`,
    creator: {
      name: creator?.name || fallbackCreator?.name || 'Creator',
      avatarUrl: creator?.avatar_url || fallbackCreator?.avatarUrl || '',
    },
  };
}

async function fetchTop1LatestVideo(supabase, topCreator) {
  if (!topCreator?.id) return null;

  const { data, error } = await supabase
    .from('creator_videos')
    .select('video_id,title,summary,published_at,creators(name,avatar_url)')
    .eq('creator_id', topCreator.id)
    .eq('is_short', false)
    .order('published_at', { ascending: false, nullsFirst: false })
    .limit(1);

  if (error) {
    console.warn('[creators/top100] top1 latest video lookup failed:', error.message);
    return null;
  }

  const row = Array.isArray(data) ? data[0] : null;
  return mapTop1LatestVideoRow(row, topCreator);
}

function registerCreatorsTop100Routes(app, supabase) {
  app.get('/creators/top100', async (req, res) => {
    try {
      const { data, error } = await supabase
        .from('creators')
        .select('id,name,handle,avatar_url,subscriber_count,channel_id,type')
        .eq('active', true)
        .in('type', CREATOR_LEADERBOARD_TYPES)
        .order('subscriber_count', { ascending: false, nullsFirst: false });

      if (error) {
        return res.status(500).json({
          error: 'Database error',
          message: error.message,
        });
      }

      const creators = (Array.isArray(data) ? data : [])
        .map(mapTopCreatorRow)
        .filter(Boolean);

      const top50 = creators.slice(0, 50);
      const honorableMentions = creators.slice(50);
      const top1LatestVideo = await fetchTop1LatestVideo(supabase, top50[0] || null);

      return res.json({ top50, honorableMentions, top1LatestVideo });
    } catch (err) {
      return res.status(500).json({
        error: 'Server error',
        message: err instanceof Error ? err.message : String(err),
      });
    }
  });
}

async function refreshCreatorSubscriberCounts(supabase) {
  const youtubeApiKey = process.env.YOUTUBE_API_KEY;
  if (!youtubeApiKey || !String(youtubeApiKey).trim()) {
    console.warn(
      '[subscriber-refresh] YOUTUBE_API_KEY missing; skipping subscriber refresh',
    );
    return;
  }

  console.log('[subscriber-refresh] Starting YouTube subscriber count refresh...');

  try {
    const { data: creators, error } = await supabase
      .from('creators')
      .select('id,channel_id')
      .eq('active', true);

    if (error) throw error;
    const rows = Array.isArray(creators) ? creators : [];

    for (let i = 0; i < rows.length; i += 50) {
      const batch = rows.slice(i, i + 50);
      const channelIds = batch
        .map((c) => (c.channel_id != null ? String(c.channel_id).trim() : ''))
        .filter(Boolean)
        .join(',');

      if (!channelIds) continue;

      const url = `https://www.googleapis.com/youtube/v3/channels?part=statistics&id=${channelIds}&key=${String(youtubeApiKey).trim()}`;
      const upstream = await fetch(url);
      const payload = await upstream.json();

      if (!upstream.ok) {
        console.error(
          '[subscriber-refresh] YouTube API error:',
          payload?.error?.message || upstream.status,
        );
        continue;
      }

      for (const item of payload.items || []) {
        const channelId = item.id;
        const match = batch.find((c) => c.channel_id === channelId);
        if (!match) continue;

        const subscriberCount = parseInt(
          item.statistics?.subscriberCount || '0',
          10,
        );

        const { error: updateError } = await supabase
          .from('creators')
          .update({ subscriber_count: subscriberCount })
          .eq('id', match.id);

        if (updateError) {
          console.error(
            `[subscriber-refresh] Failed for ${channelId}:`,
            updateError.message,
          );
        }
      }

      console.log(`[subscriber-refresh] Processed batch ${i / 50 + 1}`);
    }

    console.log('[subscriber-refresh] Complete.');
  } catch (err) {
    console.error(
      '[subscriber-refresh] Error:',
      err instanceof Error ? err.message : String(err),
    );
  }
}

function scheduleCreatorSubscriberRefresh(cron, supabase) {
  cron.schedule('0 3 * * *', () => {
    console.log('[cron] Running daily creator subscriber refresh...');
    void refreshCreatorSubscriberCounts(supabase);
  });
}

module.exports = {
  registerCreatorsTop100Routes,
  refreshCreatorSubscriberCounts,
  scheduleCreatorSubscriberRefresh,
  CREATOR_LEADERBOARD_TYPES,
};
