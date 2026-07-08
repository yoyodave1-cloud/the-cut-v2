"use strict";

/**
 * Seed curated short-game masterclass lessons into short_game_videos.
 *
 * Usage (from backend/):
 *   node scripts/seedShortGameVideos.js
 *
 * Run supabase/migrations/short_game_videos.sql in Supabase first if the table
 * does not exist yet.
 *
 * Requires: SUPABASE_URL, SUPABASE_SERVICE_KEY in .env
 */

const path = require("path");
require("dotenv").config({ path: path.join(__dirname, "..", ".env") });

const { supabase } = require("../supabase");

const CURATED_VIDEOS = [
  {
    topic: "putting",
    youtube_video_id: "qp6k5d8FJOA",
    title: "I get a Lesson from the World's Best Putting Coach (Brad Faxon)",
    channel_name: "Rick Shiels Golf Show",
    display_order: 1,
  },
  {
    topic: "putting",
    youtube_video_id: "-O_fF94DDFU",
    title: "Butch Harmon School of Golf: The Keys to Great Putting",
    channel_name: "Butch Harmon",
    display_order: 2,
  },
  {
    topic: "putting",
    youtube_video_id: "nltss_br28s",
    title: "Easiest Putting Technique Ever",
    channel_name: "TruGolf Academy",
    display_order: 3,
  },
  {
    topic: "putting",
    youtube_video_id: "_jdL1hCE1To",
    title: "The Last Putting Lesson You Will Ever Need",
    channel_name: "Danny Maude",
    display_order: 4,
  },
  {
    topic: "chipping",
    youtube_video_id: "bSBd3R3Ce8g",
    title: "30 Years of My Best Chipping Advice in 5 Minutes",
    channel_name: "Todd Kolb / VLS Golf",
    display_order: 1,
  },
  {
    topic: "chipping",
    youtube_video_id: "l-QcvNn91wo",
    title: "This Chipping Video Will Change Your Life",
    channel_name: "Me and My Golf",
    display_order: 2,
  },
  {
    topic: "chipping",
    youtube_video_id: "AK4_3bwjFrI",
    title: "The ONE Chipping Drill Every Golfer Should Master",
    channel_name: "Padraig Harrington",
    display_order: 3,
  },
  {
    topic: "chipping",
    youtube_video_id: "BNNBc8Igsck",
    title: "The Secret Chipping Technique",
    channel_name: "Rick Shiels",
    display_order: 4,
  },
  {
    topic: "chipping",
    youtube_video_id: "OHj0HCfgn5M",
    title: "3 Easy Golf Chipping Tips Any Golfer Can Use",
    channel_name: "Golf instruction",
    display_order: 5,
  },
  {
    topic: "bunker",
    youtube_video_id: "tGZoNn3whFY",
    title: "The Most Effective Bunker Lesson on YouTube",
    channel_name: "Adam Porzak",
    display_order: 1,
  },
  {
    topic: "bunker",
    youtube_video_id: "gFCLH5QZ3Mg",
    title: "The Only Simple Bunker Lesson You Will Need",
    channel_name: "Top Speed Golf",
    display_order: 2,
  },
  {
    topic: "bunker",
    youtube_video_id: "Y3IORaEXhHQ",
    title: "The Only Greenside Bunker Lesson You'll Need",
    channel_name: "Golf instruction",
    display_order: 3,
  },
  {
    topic: "bunker",
    youtube_video_id: "bzLl6tr04do",
    title: "Go From Amateur to Pro Level Bunker Shots in 5 Minutes",
    channel_name: "Golf instruction",
    display_order: 4,
  },
  {
    topic: "pitching",
    youtube_video_id: "LeYtuvbKhAc",
    title: "The Easiest Pitching Technique You've Ever Seen",
    channel_name: "Danny Maude",
    display_order: 1,
  },
  {
    topic: "pitching",
    youtube_video_id: "ACC1FRrKvHU",
    title: "The ONLY Way to Strike Your Pitch Shots Every Time",
    channel_name: "Danny Maude",
    display_order: 2,
  },
  {
    topic: "pitching",
    youtube_video_id: "4VhcIjif_4E",
    title: "5 Simple Pitching Tips to Pitch Like a Tour Pro",
    channel_name: "Golf instruction",
    display_order: 3,
  },
  {
    topic: "pitching",
    youtube_video_id: "Z4jFeHrBwGc",
    title: "The Fastest Way to Improve Your Pitching from 30-80 Yards",
    channel_name: "Danny Maude",
    display_order: 4,
  },
  {
    topic: "pitching",
    youtube_video_id: "pkv5TS32G78",
    title: "The Setup and Swing You Need to Hit Perfect Pitch Shots",
    channel_name: "Golf instruction",
    display_order: 5,
  },
];

async function upsertVideo(row) {
  const { data: existing, error: lookupError } = await supabase
    .from("short_game_videos")
    .select("id")
    .eq("topic", row.topic)
    .eq("youtube_video_id", row.youtube_video_id)
    .maybeSingle();

  if (lookupError) throw lookupError;

  const payload = { ...row, active: true };

  if (existing?.id) {
    const { error } = await supabase
      .from("short_game_videos")
      .update(payload)
      .eq("id", existing.id);
    if (error) throw error;
    return "updated";
  }

  const { error } = await supabase.from("short_game_videos").insert(payload);
  if (error) throw error;
  return "inserted";
}

async function main() {
  console.log(`[seedShortGameVideos] Upserting ${CURATED_VIDEOS.length} lessons…\n`);

  const results = { inserted: 0, updated: 0, errors: 0 };

  for (const row of CURATED_VIDEOS) {
    try {
      const action = await upsertVideo(row);
      results[action] += 1;
      console.log(`  ${action}: [${row.topic}] ${row.title}`);
    } catch (err) {
      results.errors += 1;
      console.error(
        `  error: [${row.topic}] ${row.youtube_video_id}:`,
        err instanceof Error ? err.message : String(err),
      );
    }
  }

  console.log("\n[seedShortGameVideos] Done.", results);
}

main().catch((err) => {
  console.error("[seedShortGameVideos] Fatal:", err instanceof Error ? err.message : err);
  process.exit(1);
});
