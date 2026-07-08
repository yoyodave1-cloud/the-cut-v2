"use strict";

/**
 * Seed podcast creators for the Creators page featured carousel.
 *
 * Usage (from backend/):
 *   node scripts/seedPodcastCreators.js
 *
 * Requires: SUPABASE_URL, SUPABASE_SERVICE_KEY in .env
 */

const path = require("path");
require("dotenv").config({ path: path.join(__dirname, "..", ".env") });

const { supabase } = require("../supabase");

const PODCAST_CREATORS = [
  {
    name: "Rick Shiels Golf Show",
    channel_id: "UCZNEuuyLZQt5H9lUqImc0CQ",
    handle: "@RickShielsGolfShow",
  },
  {
    name: "Fore Play Podcast",
    channel_id: "UC-7RYbWkDhY2FjYEXBGXUMQ",
    handle: "@ForePlayPodcast",
  },
  {
    name: "No Laying Up",
    channel_id: "UCZn1UAWT9W0pLTWCdt8CTBg",
    handle: "@NoLayingUp",
  },
  {
    name: "No Laying Up Podcast",
    channel_id: "UC1lZT-3zObkaPerEyjxtA_w",
    handle: "@NoLayingUpPodcast",
  },
  {
    name: "GOLF's Subpar",
    channel_id: "UCt5ESUx6omMUsMoEKvMTzlA",
    handle: "@Golf_Subpar",
  },
  {
    name: "Rough Cut Golf Podcast",
    channel_id: "UCEWo2BUWvCgRXSD1Xg3QOtQ",
    handle: "@RoughCutGolfPodcast",
  },
  {
    name: "Fried Egg Golf",
    channel_id: "UCc5JXe0hSVA-VOh0x5qkXag",
    handle: "@FriedEggGolf",
  },
  {
    name: "Sky Sports Golf Podcast",
    channel_id: "UCa98aY7eenHS_YhehF-vuEQ",
    handle: "@SkySportsGolf",
  },
];

async function fixNoLayingUpChannelId() {
  const { data, error } = await supabase
    .from("creators")
    .update({ channel_id: "UCZn1UAWT9W0pLTWCdt8CTBg" })
    .eq("channel_id", "UC1w9eK1xX3gV7o1JzYgP0aA")
    .select("id, name");

  if (error) throw new Error(`No Laying Up channel_id fix failed: ${error.message}`);

  const rows = Array.isArray(data) ? data : [];
  if (rows.length) {
    console.log(`  fixed channel_id: ${rows[0].name} (${rows[0].id})`);
  }
}

async function findByChannelId(channelId) {
  const { data, error } = await supabase
    .from("creators")
    .select("id, name")
    .eq("channel_id", channelId)
    .maybeSingle();

  if (error) throw new Error(`Lookup failed for ${channelId}: ${error.message}`);
  return data;
}

async function upsertPodcastCreator(row) {
  const existing = await findByChannelId(row.channel_id);

  const payload = {
    name: row.name,
    channel_id: row.channel_id,
    handle: row.handle,
    type: "podcast",
    active: true,
  };

  if (existing) {
    const { error } = await supabase.from("creators").update(payload).eq("id", existing.id);
    if (error) throw new Error(`Update failed for ${row.name}: ${error.message}`);
    return { action: "updated", name: row.name, id: existing.id };
  }

  const { data, error } = await supabase
    .from("creators")
    .insert({ ...payload, tier: null })
    .select("id")
    .single();

  if (error) throw new Error(`Insert failed for ${row.name}: ${error.message}`);
  return { action: "inserted", name: row.name, id: data.id };
}

async function main() {
  console.log("[seedPodcastCreators] Fixing No Laying Up channel_id…");
  await fixNoLayingUpChannelId();

  console.log(`\n[seedPodcastCreators] Upserting ${PODCAST_CREATORS.length} podcast creators…\n`);

  const results = { inserted: 0, updated: 0, errors: 0 };

  for (const row of PODCAST_CREATORS) {
    try {
      const outcome = await upsertPodcastCreator(row);
      results[outcome.action === "inserted" ? "inserted" : "updated"] += 1;
      console.log(`  ${outcome.action}: ${outcome.name} (${outcome.id})`);
    } catch (err) {
      results.errors += 1;
      console.error(
        `  error: ${row.name}:`,
        err instanceof Error ? err.message : String(err),
      );
    }
  }

  console.log("\n[seedPodcastCreators] Done.", results);
}

main().catch((err) => {
  console.error("[seedPodcastCreators] Fatal:", err instanceof Error ? err.message : err);
  process.exit(1);
});
