/**
 * Watch Later — per-user saved videos (creator_videos or short_game_videos).
 *
 * Live copy lives in the-cut/backend/patches/watch-later.js and is registered from
 * the-cut/backend/server.js:
 *   const { registerWatchLaterRoutes } = require('./patches/watch-later');
 *   registerWatchLaterRoutes(app, supabase);
 *
 * Per-user data is not cached in-memory — results differ per authenticated user.
 */

const VIDEO_SOURCES = new Set(["creator_videos", "short_game_videos"]);

function firstString(...values) {
  for (const value of values) {
    if (typeof value === "string" && value.trim()) return value.trim();
  }
  return "";
}

async function requireUser(supabase, req, res) {
  const header = String(req.headers.authorization || "");
  const token = header.startsWith("Bearer ") ? header.slice(7).trim() : "";
  if (!token) {
    res.status(401).json({ error: "Unauthorized" });
    return null;
  }

  const { data, error } = await supabase.auth.getUser(token);
  if (error || !data?.user) {
    res.status(401).json({ error: "Unauthorized" });
    return null;
  }
  return data.user;
}

function youtubeThumb(videoId) {
  return `https://img.youtube.com/vi/${videoId}/hqdefault.jpg`;
}

function youtubeWatch(videoId) {
  return `https://www.youtube.com/watch?v=${videoId}`;
}

function mapCreatorVideoRow(row) {
  if (!row?.video_id) return null;
  const creator = Array.isArray(row.creators) ? row.creators[0] : row.creators;
  return {
    videoId: row.video_id,
    title: row.title || "",
    thumbnailUrl: youtubeThumb(row.video_id),
    watchUrl: youtubeWatch(row.video_id),
    creator: creator?.name
      ? {
          name: creator.name,
          avatarUrl: creator.avatar_url || undefined,
        }
      : undefined,
  };
}

function mapShortGameVideoRow(row) {
  const videoId = row?.youtube_video_id;
  if (!videoId) return null;
  return {
    videoId,
    title: row.title || "",
    thumbnailUrl: youtubeThumb(videoId),
    watchUrl: youtubeWatch(videoId),
    creator: row.channel_name ? { name: row.channel_name } : undefined,
  };
}

function stubVideo(videoId) {
  return {
    videoId,
    title: "Saved video",
    thumbnailUrl: youtubeThumb(videoId),
    watchUrl: youtubeWatch(videoId),
  };
}

async function loadCatalogByIds(supabase, videoIds) {
  const uniqueIds = [...new Set(videoIds.filter(Boolean))];
  const creatorById = new Map();
  const shortById = new Map();
  if (!uniqueIds.length) return { creatorById, shortById };

  const [creatorResult, shortResult] = await Promise.all([
    supabase
      .from("creator_videos")
      .select("video_id,title,creators(name,avatar_url)")
      .in("video_id", uniqueIds),
    supabase
      .from("short_game_videos")
      .select("youtube_video_id,title,channel_name")
      .in("youtube_video_id", uniqueIds),
  ]);

  if (creatorResult.error) {
    console.warn("[watch-later] creator_videos lookup failed:", creatorResult.error.message);
  }
  if (shortResult.error) {
    console.warn("[watch-later] short_game_videos lookup failed:", shortResult.error.message);
  }

  for (const row of Array.isArray(creatorResult.data) ? creatorResult.data : []) {
    const mapped = mapCreatorVideoRow(row);
    if (mapped) creatorById.set(mapped.videoId, mapped);
  }
  for (const row of Array.isArray(shortResult.data) ? shortResult.data : []) {
    const mapped = mapShortGameVideoRow(row);
    if (mapped && !shortById.has(mapped.videoId)) {
      shortById.set(mapped.videoId, mapped);
    }
  }

  return { creatorById, shortById };
}

function resolveCatalogVideo(videoId, videoSource, creatorById, shortById) {
  if (videoSource === "short_game_videos") {
    return shortById.get(videoId) || creatorById.get(videoId) || stubVideo(videoId);
  }
  return creatorById.get(videoId) || shortById.get(videoId) || stubVideo(videoId);
}

function registerWatchLaterRoutes(app, supabase) {
  app.post("/watch-later", async (req, res) => {
    try {
      const user = await requireUser(supabase, req, res);
      if (!user) return;

      const videoId = firstString(req.body?.videoId, req.body?.video_id);
      const videoSource = firstString(
        req.body?.videoSource,
        req.body?.video_source,
        "creator_videos",
      );

      if (!videoId) {
        return res.status(400).json({ error: "videoId is required" });
      }
      if (!VIDEO_SOURCES.has(videoSource)) {
        return res.status(400).json({
          error: "videoSource must be creator_videos or short_game_videos",
        });
      }

      const { data, error } = await supabase
        .from("watch_later")
        .insert({
          user_id: user.id,
          video_id: videoId,
          video_source: videoSource,
        })
        .select("id")
        .single();

      if (error) {
        if (error.code === "23505") {
          const { data: existing } = await supabase
            .from("watch_later")
            .select("id")
            .eq("user_id", user.id)
            .eq("video_id", videoId)
            .maybeSingle();
          return res.json({ ok: true, id: existing?.id ?? null, alreadySaved: true });
        }
        console.warn("[watch-later] insert failed:", error.message);
        return res.status(500).json({ error: "Database error", message: error.message });
      }

      return res.json({ ok: true, id: data?.id ?? null });
    } catch (err) {
      console.warn(
        "[watch-later] POST failed:",
        err instanceof Error ? err.message : String(err),
      );
      return res.status(500).json({ error: "Server error" });
    }
  });

  app.get("/watch-later", async (req, res) => {
    try {
      const user = await requireUser(supabase, req, res);
      if (!user) return;

      const { data: saves, error } = await supabase
        .from("watch_later")
        .select("id, video_id, video_source, saved_at")
        .eq("user_id", user.id)
        .order("saved_at", { ascending: false });

      if (error) {
        console.warn("[watch-later] list failed:", error.message);
        return res.status(500).json({ error: "Database error", message: error.message });
      }

      const rows = Array.isArray(saves) ? saves : [];
      const { creatorById, shortById } = await loadCatalogByIds(
        supabase,
        rows.map((row) => row.video_id),
      );

      const videos = rows.map((row) => {
        const catalog = resolveCatalogVideo(
          row.video_id,
          row.video_source,
          creatorById,
          shortById,
        );
        return {
          id: row.id,
          videoId: row.video_id,
          videoSource: row.video_source,
          savedAt: row.saved_at,
          title: catalog.title,
          thumbnailUrl: catalog.thumbnailUrl,
          watchUrl: catalog.watchUrl,
          creator: catalog.creator,
        };
      });

      return res.json({ videos });
    } catch (err) {
      console.warn(
        "[watch-later] GET failed:",
        err instanceof Error ? err.message : String(err),
      );
      return res.status(500).json({ error: "Server error" });
    }
  });

  app.delete("/watch-later/:id", async (req, res) => {
    try {
      const user = await requireUser(supabase, req, res);
      if (!user) return;

      const id = Number.parseInt(String(req.params.id), 10);
      if (!Number.isInteger(id) || id < 1) {
        return res.status(400).json({ error: "Invalid id" });
      }

      const { data, error } = await supabase
        .from("watch_later")
        .delete()
        .eq("id", id)
        .eq("user_id", user.id)
        .select("id");

      if (error) {
        console.warn("[watch-later] delete failed:", error.message);
        return res.status(500).json({ error: "Database error", message: error.message });
      }

      if (!Array.isArray(data) || data.length === 0) {
        return res.status(404).json({ error: "Not found" });
      }

      return res.json({ ok: true, id });
    } catch (err) {
      console.warn(
        "[watch-later] DELETE failed:",
        err instanceof Error ? err.message : String(err),
      );
      return res.status(500).json({ error: "Server error" });
    }
  });
}

module.exports = {
  registerWatchLaterRoutes,
};
