/**
 * Coaching narration + recommendation reasons — the ONLY module that talks to
 * an LLM. It receives structured swing data (metrics, faults, checkpoints),
 * never raw video or landmarks.
 *
 * Model-agnostic by design: set ACADEMY_COACH_MODEL to switch. Prototyped on
 * claude-fable-5; at production volume point this at a lower-cost model
 * (claude-haiku-4-5-20251001 or claude-sonnet-4-6) — the task is narration
 * over structured data, not novel reasoning.
 *
 * Without an ANTHROPIC_API_KEY the module degrades gracefully to the
 * deterministic coaching copy baked into the checkpoint library, so the
 * feature works end-to-end with no LLM at all.
 */

const ANTHROPIC_URL = 'https://api.anthropic.com/v1/messages';
const DEFAULT_MODEL = process.env.ACADEMY_COACH_MODEL || 'claude-fable-5';

function fallbackCoaching(shotDef, analysis) {
  const faults = analysis.identified_faults || [];
  const summary = faults.length
    ? `Your ${shotDef.label.toLowerCase()} analysis found ${faults.length} thing${faults.length === 1 ? '' : 's'} to work on. Start with ${faults[0].name.toLowerCase()} — it has the biggest effect on your ${shotDef.swingClass === 'stroke' ? 'stroke' : 'swing'} right now.`
    : `Solid work — your ${shotDef.label.toLowerCase()} checked out against every benchmark we measure. Keep grooving it and upload again in a week to confirm the pattern holds.`;
  return {
    summary,
    tips: faults.map((f) => ({ fault_tag: f.tag, tip: f.tip, drill: f.drill })),
    model: 'fallback',
    generated_at: new Date().toISOString(),
  };
}

function buildPrompt(shotDef, analysis, recommendations) {
  const payload = {
    shot_type: shotDef.label,
    tempo_ratio: analysis.tempo_ratio,
    tempo_benchmark: shotDef.tempo,
    metrics: analysis.metrics,
    identified_faults: (analysis.identified_faults || []).map((f) => ({
      tag: f.tag,
      name: f.name,
      severity: f.severity,
      measured: `${f.metricLabel}: ${f.value}${f.unit}`,
      description: f.description,
    })),
    checkpoint_results: analysis.checkpoint_results,
    recommended_videos: (recommendations || []).map((r) => ({
      fault_tag: r.fault_tag,
      video_title: r.video_title,
      creator_name: r.creator_name,
    })),
  };
  return `You are the swing-analysis coach inside The Cut, a golf app. Below is structured 2D pose-analysis data for a user's ${shotDef.label.toLowerCase()}. Write coaching copy in a supportive, plain-English voice (UK golf audience, no jargon without explaining it, no emoji).

Return ONLY valid JSON matching exactly:
{
  "summary": "3-4 sentence overview of this swing: what's working, the priority to fix, and why it matters",
  "tips": [{"fault_tag": "...", "tip": "2-3 sentence specific coaching cue for this fault using the measured numbers", "drill": "one practice drill in 1-2 sentences"}],
  "video_reasons": [{"fault_tag": "...", "reason": "one sentence: why the matched video helps this specific fault"}]
}

Include one tips entry per identified fault (same fault_tag). Include one video_reasons entry per recommended video. If there are no faults, tips and video_reasons are empty arrays and the summary celebrates what the data shows.

DATA:
${JSON.stringify(payload, null, 2)}`;
}

/**
 * @returns {{ coaching: {summary, tips, model, generated_at}, videoReasons: Map<fault_tag, reason> }}
 */
async function generateCoaching(shotDef, analysis, recommendations) {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  const videoReasons = new Map();
  if (!apiKey) {
    return { coaching: fallbackCoaching(shotDef, analysis), videoReasons };
  }

  try {
    const res = await fetch(ANTHROPIC_URL, {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        'x-api-key': apiKey,
        'anthropic-version': '2023-06-01',
      },
      body: JSON.stringify({
        model: DEFAULT_MODEL,
        max_tokens: 1500,
        messages: [{ role: 'user', content: buildPrompt(shotDef, analysis, recommendations) }],
      }),
    });
    if (!res.ok) throw new Error(`Anthropic API ${res.status}`);
    const json = await res.json();
    const text = (json.content || []).map((b) => b.text || '').join('');
    const match = text.match(/\{[\s\S]*\}/);
    if (!match) throw new Error('No JSON in model response');
    const parsed = JSON.parse(match[0]);

    for (const vr of parsed.video_reasons || []) {
      if (vr.fault_tag && vr.reason) videoReasons.set(vr.fault_tag, vr.reason);
    }
    return {
      coaching: {
        summary: parsed.summary || fallbackCoaching(shotDef, analysis).summary,
        tips: Array.isArray(parsed.tips) ? parsed.tips : [],
        model: DEFAULT_MODEL,
        generated_at: new Date().toISOString(),
      },
      videoReasons,
    };
  } catch (err) {
    console.warn('[academy] coaching LLM failed, using fallback:', err.message);
    return { coaching: fallbackCoaching(shotDef, analysis), videoReasons };
  }
}

module.exports = { generateCoaching };
