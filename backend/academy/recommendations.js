/**
 * Fault -> creator-video matching against The Cut's existing library.
 *
 * Deterministic keyword scoring over creator_videos (title + summary),
 * filtered to active creators and long-form videos, biased toward
 * instruction-type channels. No LLM required — the optional LLM step in
 * coaching.js only writes nicer "why this helps" one-liners on top.
 */

const SHOT_TYPE_TERMS = {
  driving: ['driver', 'driving', 'tee shot', 'tee-shot', 'long drive', 'off the tee', 'distance'],
  iron: ['iron', 'irons', 'ball striking', 'ball-striking', 'approach', 'compress', 'strike'],
  bunker: ['bunker', 'sand', 'splash', 'greenside'],
  chipping: ['chip', 'chipping', 'short game', 'around the green', 'pitch', 'wedge'],
  putting: ['putt', 'putting', 'green', 'stroke', 'putter'],
};

const STOP_WORDS = new Set([
  'the', 'a', 'an', 'to', 'of', 'in', 'on', 'and', 'or', 'for', 'your', 'you',
  'golf', 'swing', 'shot', 'shots', 'drill', 'fix', 'how', 'stop', 'dont',
]);

function tokenize(text) {
  return String(text || '')
    .toLowerCase()
    .split(/[^a-z0-9]+/)
    .filter((t) => t.length > 2 && !STOP_WORDS.has(t));
}

function scoreVideo(video, faultTokens, shotTerms) {
  const title = (video.title || '').toLowerCase();
  const summary = (video.summary || video.description || '').toLowerCase();
  let score = 0;

  for (const token of faultTokens) {
    if (title.includes(token)) score += 3;
    else if (summary.includes(token)) score += 1;
  }
  let shotHit = false;
  for (const term of shotTerms) {
    if (title.includes(term)) {
      score += 4;
      shotHit = true;
      break;
    }
    if (summary.includes(term)) {
      score += 2;
      shotHit = true;
      break;
    }
  }
  // A video that never mentions the discipline is a weak recommendation.
  if (!shotHit) score = Math.floor(score / 2);
  if (video.creator_type === 'instruction') score += 3;
  return score;
}

/** Fetch the candidate pool for a shot type once (reused across faults). */
async function fetchCandidatePool(supabase, shotTypeId) {
  const { data, error } = await supabase
    .from('creator_videos')
    .select('id, video_id, title, summary, description, creator_id, view_count, creators!inner(id, name, type, active, avatar_url)')
    .eq('creators.active', true)
    .eq('is_short', false)
    .in('creators.type', ['instruction', 'competitive'])
    .order('view_count', { ascending: false })
    .limit(800);
  if (error) throw new Error(`creator_videos query failed: ${error.message}`);
  return (data || []).map((row) => ({
    id: row.id,
    video_id: row.video_id,
    title: row.title,
    summary: row.summary,
    description: row.description,
    creator_id: row.creator_id,
    creator_name: row.creators?.name,
    creator_type: row.creators?.type,
    creator_avatar: row.creators?.avatar_url,
    view_count: row.view_count,
  }));
}

/**
 * Match each identified fault to the best creator video for that shot type.
 * @returns [{fault_tag, fault_name, matched_video_id, youtube_video_id, video_title,
 *            creator_id, creator_name, creator_avatar, reason, rank}]
 */
async function matchRecommendations(supabase, shotDef, faults) {
  if (!faults || !faults.length) return [];
  const pool = await fetchCandidatePool(supabase, shotDef.id);
  const shotTerms = SHOT_TYPE_TERMS[shotDef.id] || [];
  const faultDefs = Object.fromEntries(shotDef.faults.map((f) => [f.tag, f]));
  const used = new Set();
  const out = [];

  for (const fault of faults.slice(0, 5)) {
    const def = faultDefs[fault.tag];
    if (!def) continue;
    const faultTokens = [...new Set(def.searchKeywords.flatMap(tokenize))];

    let best = null;
    let bestScore = 0;
    for (const video of pool) {
      if (used.has(video.id)) continue;
      const score = scoreVideo(video, faultTokens, shotTerms);
      if (score > bestScore) {
        best = video;
        bestScore = score;
      }
    }
    // Require a minimum relevance — a bad recommendation is worse than none.
    if (!best || bestScore < 5) continue;

    used.add(best.id);
    out.push({
      fault_tag: fault.tag,
      fault_name: fault.name,
      matched_video_id: best.id,
      youtube_video_id: best.video_id,
      video_title: best.title,
      creator_id: best.creator_id,
      creator_name: best.creator_name,
      creator_avatar: best.creator_avatar,
      reason: `${best.creator_name} covers exactly this — a focused lesson to fix ${fault.name.toLowerCase()} in your ${shotDef.label.toLowerCase()}.`,
      rank: out.length,
    });
  }

  return out;
}

module.exports = { matchRecommendations };
