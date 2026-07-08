/**
 * One-off: delete every object in the legacy academy-videos bucket, then the
 * bucket itself. Raw swing video is no longer stored server-side (round 2:
 * local-first video). Safe to re-run; no-ops once the bucket is gone.
 *
 * Usage: node scripts/purgeVideoBucket.js   (reads ../.env)
 */

require('dotenv').config({ path: require('path').join(__dirname, '..', '.env') });
const { createClient } = require('@supabase/supabase-js');

const url = process.env.SUPABASE_URL;
const key = process.env.SUPABASE_SERVICE_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!url || !key) {
  console.error('SUPABASE_URL / SUPABASE_SERVICE_KEY not set.');
  process.exit(1);
}

const BUCKET = 'academy-videos';

(async () => {
  const supabase = createClient(url, key);
  const { data: buckets } = await supabase.storage.listBuckets();
  if (!buckets?.some((b) => b.id === BUCKET)) {
    console.log(`Bucket ${BUCKET} does not exist — nothing to purge.`);
    return;
  }

  let removed = 0;
  // Objects live under <userId>/ prefixes; walk one level deep.
  const { data: topLevel } = await supabase.storage.from(BUCKET).list('', { limit: 1000 });
  for (const entry of topLevel || []) {
    const prefix = entry.name;
    const { data: files } = await supabase.storage.from(BUCKET).list(prefix, { limit: 1000 });
    const paths = (files || []).map((f) => `${prefix}/${f.name}`);
    if (entry.id) paths.push(prefix); // top-level file, not a folder
    if (paths.length) {
      const { error } = await supabase.storage.from(BUCKET).remove(paths);
      if (error) console.warn('remove failed:', error.message);
      else removed += paths.length;
    }
  }

  const { error: delErr } = await supabase.storage.deleteBucket(BUCKET);
  if (delErr) console.warn('deleteBucket failed:', delErr.message);
  console.log(`Purged ${removed} object(s); bucket ${BUCKET} ${delErr ? 'NOT deleted' : 'deleted'}.`);
})();
