/** @type {import('expo/fingerprint').Config} */
const config = {
  // SDK 57's @expo/fingerprint (0.20.12) hashes the whole eas.json file as an
  // "easBuild" source. Submit credentials (appleId / ascAppId / appleTeamId)
  // do not affect the native runtime, but changing them still shifted the OTA
  // fingerprint so updates missed TestFlight build 4.
  //
  // SourceSkips.EasJson is not in this SDK 57 fingerprint package (it landed
  // later). .fingerprintignore would drop the entire file and also miss
  // build-relevant fields such as channel / buildConfiguration.
  // fileHookTransform is the supported way here: hash eas.json with submit
  // profiles emptied, leaving build/cli fields in the hash.
  fileHookTransform: (source, chunk, isEndOfFile, encoding) => {
    if (source.type === 'file' && source.filePath.replace(/\\/g, '/') === 'eas.json') {
      return transformEasJsonChunk(source, chunk, isEndOfFile, encoding);
    }
    return chunk;
  },
};

const easJsonBuffers = new WeakMap();

function transformEasJsonChunk(source, chunk, isEndOfFile, encoding) {
  let parts = easJsonBuffers.get(source);
  if (!parts) {
    parts = [];
    easJsonBuffers.set(source, parts);
  }
  if (chunk != null) {
    parts.push(typeof chunk === 'string' ? Buffer.from(chunk, encoding) : chunk);
  }
  if (!isEndOfFile) {
    return null;
  }

  const raw = Buffer.concat(parts).toString('utf8');
  easJsonBuffers.delete(source);

  const parsed = JSON.parse(raw);
  if (parsed.submit && typeof parsed.submit === 'object') {
    for (const profile of Object.keys(parsed.submit)) {
      parsed.submit[profile] = {};
    }
  }
  return `${JSON.stringify(parsed, null, 2)}\n`;
}

module.exports = config;
