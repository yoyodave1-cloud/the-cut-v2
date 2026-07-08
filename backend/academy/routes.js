/**
 * Academy Express routes.
 *
 * Privacy/cost model: uploaded video is written to a temp file, analysed,
 * and deleted — it never reaches durable storage. The pose landmark data is
 * the permanent record; the user's device keeps the only copy of the video.
 *
 * Analyses run through a serial in-process queue: pose estimation is CPU
 * heavy, and one-at-a-time keeps memory flat and latency predictable on a
 * small always-on instance (scale horizontally for throughput).
 *
 * Endpoints:
 *   GET    /academy/shot-types          checkpoint library metadata
 *   POST   /academy/uploads             multipart video + userId/shotType/angleType
 *   GET    /academy/uploads/:id         upload status + analysis + recommendations
 *   GET    /academy/uploads             ?userId=&shotType=  history with summaries
 *   DELETE /academy/uploads/:id         ?userId=  delete one session (stats drop it)
 *   DELETE /academy/users/:userId       erase every Academy row for the user
 *   GET    /academy/dashboard           ?userId=  trends, focus faults, recent recs
 */

const fs = require('fs');
const os = require('os');
const path = require('path');
const multer = require('multer');

const { SHOT_TYPES, SHOT_TYPE_IDS, getShotType, progressMetricIds } = require('./checkpoints');
const { analyzeVideo } = require('./analyze');
const { matchRecommendations } = require('./recommendations');
const { generateCoaching } = require('./coaching');
const store = require('./store');

// Disk storage, not memory: a burst of parallel 60MB uploads must not sit in
// RAM. Files land in the OS temp dir and are always cleaned up in processUpload.
const upload = multer({
  storage: multer.diskStorage({
    destination: os.tmpdir(),
    filename: (_req, _file, cb) => cb(null, `academy-in-${Date.now()}-${Math.random().toString(36).slice(2, 8)}.mp4`),
  }),
  limits: { fileSize: 60 * 1024 * 1024 },
});

// ---------------------------------------------------------------------------
// Serial analysis queue
// ---------------------------------------------------------------------------

const MAX_QUEUE = 20;
let queueTail = Promise.resolve();
let queueDepth = 0;

function enqueueAnalysis(job) {
  if (queueDepth >= MAX_QUEUE) {
    return false;
  }
  queueDepth++;
  queueTail = queueTail
    .then(job)
    .catch((err) => console.warn('[academy] queued job crashed:', err.message))
    .finally(() => {
      queueDepth--;
    });
  return true;
}

/** Background processing of one upload. Never throws; always removes the temp file. */
async function processUpload(supabase, uploadRow, tmpPath) {
  const uploadId = uploadRow.id;
  try {
    const shotDef = getShotType(uploadRow.shot_type);
    const analysis = await analyzeVideo(tmpPath, uploadRow.shot_type, uploadRow.angle_type);

    let recommendations = [];
    try {
      recommendations = await matchRecommendations(supabase, shotDef, analysis.identified_faults);
    } catch (err) {
      console.warn('[academy] recommendation matching failed:', err.message);
    }

    const { coaching, videoReasons } = await generateCoaching(shotDef, analysis, recommendations);
    for (const rec of recommendations) {
      const better = videoReasons.get(rec.fault_tag);
      if (better) rec.reason = better;
    }

    const analysisId = await store.saveAnalysis(supabase, uploadId, analysis, coaching);
    await store.saveRecommendations(supabase, analysisId, uploadRow.shot_type, recommendations);
    await store.saveProgress(supabase, {
      userId: uploadRow.user_id,
      shotType: uploadRow.shot_type,
      uploadId,
      metrics: analysis.metrics,
      progressIds: progressMetricIds(uploadRow.shot_type),
    });
    await store.updateUpload(supabase, uploadId, {
      status: 'complete',
      duration_seconds: analysis.joint_angle_data.duration,
      fps: analysis.joint_angle_data.fps,
    });
    console.log(`[academy] analysis complete for upload ${uploadId} (${uploadRow.shot_type})`);
  } catch (err) {
    console.warn(`[academy] analysis failed for upload ${uploadId}:`, err.message);
    await store.updateUpload(supabase, uploadId, {
      status: 'failed',
      error_message: err.message,
    });
  } finally {
    // The raw video must not outlive processing — this is the privacy contract.
    fs.promises.rm(tmpPath, { force: true }).catch(() => {});
  }
}

/** Aggregate recent fault history into "working on" focus areas per shot type. */
function focusFaults(recentAnalyses, shotTypeId) {
  const counts = new Map();
  for (const row of recentAnalyses) {
    if (row.shot_type !== shotTypeId) continue;
    const analysis = row.academy_swing_analysis;
    const faults = analysis && analysis.identified_faults;
    if (!Array.isArray(faults)) continue;
    for (const f of faults) {
      const entry = counts.get(f.tag) || { tag: f.tag, name: f.name, count: 0, severity: 0 };
      entry.count += 1;
      entry.severity = Math.max(entry.severity, f.severity || 1);
      counts.set(f.tag, entry);
    }
  }
  return [...counts.values()]
    .sort((a, b) => b.severity - a.severity || b.count - a.count)
    .slice(0, 2);
}

function registerAcademyRoutes(app, supabase) {
  app.get('/academy/shot-types', (_req, res) => {
    res.json({
      shotTypes: SHOT_TYPE_IDS.map((id) => {
        const def = SHOT_TYPES[id];
        return {
          id: def.id,
          label: def.label,
          swingClass: def.swingClass,
          summary: def.summary,
          phases: def.phases,
          tempo: def.tempo,
          metrics: def.metrics,
          faults: def.faults.map(({ detect, ...rest }) => rest),
          recordingTips: def.recordingTips,
        };
      }),
    });
  });

  app.post('/academy/uploads', upload.single('video'), async (req, res) => {
    const tmpPath = req.file?.path;
    try {
      const { userId, shotType, angleType } = req.body || {};
      if (!tmpPath) {
        return res.status(400).json({ error: 'No video file received (field name: video).' });
      }
      if (!userId || !SHOT_TYPE_IDS.includes(shotType)) {
        fs.promises.rm(tmpPath, { force: true }).catch(() => {});
        return res.status(400).json({ error: 'userId and a valid shotType are required.' });
      }
      const angle = angleType === 'down_the_line' ? 'down_the_line' : 'face_on';

      const uploadRow = await store.createUpload(supabase, {
        userId,
        shotType,
        angleType: angle,
      });
      await store.updateUpload(supabase, uploadRow.id, { status: 'processing' });

      const accepted = enqueueAnalysis(() => processUpload(supabase, uploadRow, tmpPath));
      if (!accepted) {
        fs.promises.rm(tmpPath, { force: true }).catch(() => {});
        await store.updateUpload(supabase, uploadRow.id, {
          status: 'failed',
          error_message: 'Analysis queue is full — please try again in a minute.',
        });
        return res.status(503).json({ error: 'Analysis queue is full — please try again in a minute.' });
      }

      res.json({ uploadId: uploadRow.id, status: 'processing', queueDepth });
    } catch (err) {
      if (tmpPath) fs.promises.rm(tmpPath, { force: true }).catch(() => {});
      console.warn('[academy] upload failed:', err.message);
      res.status(500).json({ error: err.message });
    }
  });

  app.get('/academy/uploads/:id', async (req, res) => {
    try {
      const result = await store.getUploadWithAnalysis(supabase, req.params.id);
      if (!result) return res.status(404).json({ error: 'Upload not found.' });
      res.json(result);
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  });

  app.get('/academy/uploads', async (req, res) => {
    try {
      const { userId, shotType, limit } = req.query;
      if (!userId) return res.status(400).json({ error: 'userId is required.' });
      const uploads = await store.listUploads(
        supabase,
        String(userId),
        shotType ? String(shotType) : null,
        Math.min(Number(limit) || 30, 100),
      );
      res.json({ uploads });
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  });

  app.delete('/academy/uploads/:id', async (req, res) => {
    try {
      const userId = String(req.query.userId || '');
      if (!userId) return res.status(400).json({ error: 'userId is required.' });
      const deleted = await store.deleteUpload(supabase, req.params.id, userId);
      if (!deleted) return res.status(404).json({ error: 'Upload not found.' });
      res.json({ deleted: true });
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  });

  app.delete('/academy/users/:userId', async (req, res) => {
    try {
      const count = await store.deleteAllUserData(supabase, String(req.params.userId));
      res.json({ deleted: true, sessions: count });
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  });

  app.get('/academy/dashboard', async (req, res) => {
    try {
      const userId = String(req.query.userId || '');
      if (!userId) return res.status(400).json({ error: 'userId is required.' });

      const [progress, recent] = await Promise.all([
        store.getProgressSeries(supabase, userId),
        store.getRecentAnalyses(supabase, userId),
      ]);

      const trends = {};
      for (const row of progress) {
        const byMetric = (trends[row.shot_type] = trends[row.shot_type] || {});
        const series = (byMetric[row.metric_name] = byMetric[row.metric_name] || []);
        series.push({ value: Number(row.value), recordedAt: row.recorded_at, uploadId: row.upload_id });
      }

      const shotTypeSummaries = {};
      for (const id of SHOT_TYPE_IDS) {
        const rows = recent.filter((r) => r.shot_type === id);
        shotTypeSummaries[id] = {
          uploadCount: rows.length,
          lastUploadAt: rows[0]?.created_at ?? null,
          lastUploadId: rows[0]?.id ?? null,
          focusFaults: focusFaults(recent, id),
          trends: trends[id] || {},
        };
      }

      const { data: recRows } = await supabase
        .from('academy_swing_recommendations')
        .select(
          'fault_tag, reason, rank, shot_type, created_at, creator_videos(video_id, title), creators(name, avatar_url), academy_swing_analysis!inner(upload_id, academy_swing_uploads!inner(user_id))',
        )
        .eq('academy_swing_analysis.academy_swing_uploads.user_id', userId)
        .order('created_at', { ascending: false })
        .limit(6);

      const recentRecommendations = (recRows || []).map((r) => ({
        faultTag: r.fault_tag,
        reason: r.reason,
        shotType: r.shot_type,
        youtubeVideoId: r.creator_videos?.video_id ?? null,
        videoTitle: r.creator_videos?.title ?? null,
        creatorName: r.creators?.name ?? null,
        creatorAvatar: r.creators?.avatar_url ?? null,
      }));

      res.json({ shotTypes: shotTypeSummaries, recentRecommendations });
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  });
}

module.exports = { registerAcademyRoutes };
