/**
 * Supabase persistence for Academy — uploads, analysis, recommendations,
 * progress. All access goes through the backend service-role client; the
 * academy_* tables have RLS enabled with no anon policies on purpose.
 *
 * Privacy note: raw swing video is NEVER stored server-side. The upload is
 * processed from a temp file and deleted; the durable record is the pose
 * landmark data (joint_angle_data). The only copy of the video lives on the
 * user's device.
 */

async function createUpload(supabase, { userId, shotType, angleType }) {
  const { data, error } = await supabase
    .from('academy_swing_uploads')
    .insert({ user_id: userId, shot_type: shotType, angle_type: angleType, status: 'uploaded' })
    .select()
    .single();
  if (error) throw new Error(`Upload insert failed: ${error.message}`);
  return data;
}

async function updateUpload(supabase, uploadId, patch) {
  const { error } = await supabase
    .from('academy_swing_uploads')
    .update(patch)
    .eq('id', uploadId);
  if (error) console.warn('[academy] upload update failed:', error.message);
}

async function saveAnalysis(supabase, uploadId, analysis, coaching) {
  const { data, error } = await supabase
    .from('academy_swing_analysis')
    .upsert(
      {
        upload_id: uploadId,
        shot_type: analysis.shot_type,
        joint_angle_data: analysis.joint_angle_data,
        tempo_ratio: analysis.tempo_ratio,
        identified_faults: analysis.identified_faults,
        checkpoint_results: analysis.checkpoint_results,
        metrics: analysis.metrics,
        coaching,
        processed_at: new Date().toISOString(),
      },
      { onConflict: 'upload_id' },
    )
    .select('id')
    .single();
  if (error) throw new Error(`Analysis insert failed: ${error.message}`);
  return data.id;
}

async function saveRecommendations(supabase, analysisId, shotType, recommendations) {
  if (!recommendations.length) return;
  const rows = recommendations.map((r) => ({
    analysis_id: analysisId,
    shot_type: shotType,
    fault_tag: r.fault_tag,
    matched_video_id: r.matched_video_id,
    creator_id: r.creator_id,
    reason: r.reason,
    rank: r.rank,
  }));
  const { error } = await supabase.from('academy_swing_recommendations').insert(rows);
  if (error) console.warn('[academy] recommendations insert failed:', error.message);
}

async function saveProgress(supabase, { userId, shotType, uploadId, metrics, progressIds }) {
  const rows = progressIds
    .filter((id) => metrics[id] != null)
    .map((id) => ({
      user_id: userId,
      shot_type: shotType,
      metric_name: id,
      value: metrics[id],
      upload_id: uploadId,
    }));
  if (!rows.length) return;
  const { error } = await supabase.from('academy_user_progress').insert(rows);
  if (error) console.warn('[academy] progress insert failed:', error.message);
}

async function getUploadWithAnalysis(supabase, uploadId) {
  const { data: upload, error } = await supabase
    .from('academy_swing_uploads')
    .select('*')
    .eq('id', uploadId)
    .single();
  if (error || !upload) return null;

  const { data: analysis } = await supabase
    .from('academy_swing_analysis')
    .select('*')
    .eq('upload_id', uploadId)
    .maybeSingle();

  let recommendations = [];
  if (analysis) {
    const { data: recs } = await supabase
      .from('academy_swing_recommendations')
      .select('*, creator_videos(video_id, title), creators(name, avatar_url)')
      .eq('analysis_id', analysis.id)
      .order('rank');
    recommendations = (recs || []).map((r) => ({
      fault_tag: r.fault_tag,
      reason: r.reason,
      rank: r.rank,
      youtube_video_id: r.creator_videos?.video_id ?? null,
      video_title: r.creator_videos?.title ?? null,
      creator_name: r.creators?.name ?? null,
      creator_avatar: r.creators?.avatar_url ?? null,
    }));
  }

  return { upload, analysis, recommendations };
}

/** History list with a lightweight per-session analysis summary. */
async function listUploads(supabase, userId, shotType, limit = 30) {
  let query = supabase
    .from('academy_swing_uploads')
    .select(
      'id, shot_type, angle_type, status, error_message, created_at, academy_swing_analysis(tempo_ratio, identified_faults)',
    )
    .eq('user_id', userId)
    .order('created_at', { ascending: false })
    .limit(limit);
  if (shotType) query = query.eq('shot_type', shotType);
  const { data, error } = await query;
  if (error) throw new Error(`Uploads list failed: ${error.message}`);

  return (data || []).map((row) => {
    const analysis = Array.isArray(row.academy_swing_analysis)
      ? row.academy_swing_analysis[0]
      : row.academy_swing_analysis;
    const faults = Array.isArray(analysis?.identified_faults) ? analysis.identified_faults : [];
    return {
      id: row.id,
      shot_type: row.shot_type,
      angle_type: row.angle_type,
      status: row.status,
      error_message: row.error_message ?? null,
      created_at: row.created_at,
      summary: analysis
        ? {
            tempo_ratio: analysis.tempo_ratio,
            fault_count: faults.length,
            top_fault: faults[0]?.name ?? null,
          }
        : null,
    };
  });
}

/**
 * Delete one session. Ownership-checked; FK cascades take the analysis,
 * recommendations, AND progress rows with it, so the deleted session drops
 * out of every trend/average immediately.
 */
async function deleteUpload(supabase, uploadId, userId) {
  const { data, error } = await supabase
    .from('academy_swing_uploads')
    .delete()
    .eq('id', uploadId)
    .eq('user_id', userId)
    .select('id');
  if (error) throw new Error(`Delete failed: ${error.message}`);
  return (data || []).length > 0;
}

/** GDPR erase-all: every Academy row for a user. Cascades cover children. */
async function deleteAllUserData(supabase, userId) {
  const { data, error } = await supabase
    .from('academy_swing_uploads')
    .delete()
    .eq('user_id', userId)
    .select('id');
  if (error) throw new Error(`Erase failed: ${error.message}`);
  // Progress rows with a null upload_id (none in practice) — sweep anyway.
  await supabase.from('academy_user_progress').delete().eq('user_id', userId);
  return (data || []).length;
}

async function getProgressSeries(supabase, userId, limitPerSeries = 120) {
  const { data, error } = await supabase
    .from('academy_user_progress')
    .select('shot_type, metric_name, value, recorded_at, upload_id')
    .eq('user_id', userId)
    .order('recorded_at', { ascending: true })
    .limit(limitPerSeries * 5);
  if (error) throw new Error(`Progress query failed: ${error.message}`);
  return data || [];
}

async function getRecentAnalyses(supabase, userId, limit = 15) {
  const { data, error } = await supabase
    .from('academy_swing_uploads')
    .select('id, shot_type, angle_type, status, created_at, academy_swing_analysis(id, tempo_ratio, identified_faults, metrics, processed_at, coaching)')
    .eq('user_id', userId)
    .eq('status', 'complete')
    .order('created_at', { ascending: false })
    .limit(limit);
  if (error) throw new Error(`Recent analyses query failed: ${error.message}`);
  return data || [];
}

module.exports = {
  createUpload,
  updateUpload,
  saveAnalysis,
  saveRecommendations,
  saveProgress,
  getUploadWithAnalysis,
  listUploads,
  deleteUpload,
  deleteAllUserData,
  getProgressSeries,
  getRecentAnalyses,
};
