# The Cut — Project Context for Claude Code

A golf fan app (news, scores, creator content) built for a UK-first launch, expanding to USA/Ireland/Australia at 6–12 months. Two repos: `the-cut` (v1, production, shared backend) and `the-cut-v2` (frontend rebuild, current active work).

## Current Phase

| Phase | Status |
|---|---|
| 1 — Research & Plan | Complete |
| 2 — Brand & Design | Complete |
| 3 — Prototype (Figma) | Skipped — interactive wireframe in Claude was sufficient |
| 4 — Build (Cursor + Claude) | **In progress — current phase** |
| 5 — Host & Deploy | Ahead |
| 6 — Launch & Grow | Ahead |

## ⚠️ Critical: Theme is Light v02, not Dark v01

v2.0 is built in **Light v02**: background `#F0F4F8` (Off White), card surfaces `#FFFFFF` (White), primary text `#0B1629` (Deep Navy).

Most older session notes describe **Dark v01** (`#0B1629` Deep Navy background, white text) because v1 and early prototyping were built dark. **Do not default to dark-theme colours** when working on v2.0 — always re-derive background/surface/text from the Light v02 values above. Accent colours below are theme-agnostic and unchanged in both themes.

**Accent tokens (both themes):** Live Blue `#4A90D9` · Bogey Red `#E84444` · Birdie Green `#1DBF73` · Eagle Amber `#F5A623` · Cool Grey `#8A9BB0` · Muted Grey `#566778` · Border Navy `#3B5068`

**Typography:** Playfair Display for headings/display, Inter for body/UI text (both via `expo-google-fonts`).

## Tech Stack

- **Frontend:** React Native / Expo (`the-cut-v2` repo)
- **Backend:** Node/Express on Railway (`the-cut` v1 repo — shared production backend for both v1 and v2 currently); auto-deploys from GitHub
- **Database:** Supabase (Postgres) — used for caching news, video metadata, creator content
- **AI:** Claude Haiku for content summaries (news cards, video summaries)
- **Dev tools:** Cursor for direct file edits/debugging; Claude (claude.ai) for planning, architecture, and cross-session reasoning
- **Dev environment:** Moved out of OneDrive (was causing npm install corruption) to `C:\One Golf\Dev Folder\the-cut-v2`

## Repo Split

- `the-cut` (v1): production app + shared backend (`server.js`). Backend changes here require commit + push + Railway redeploy.
- `the-cut-v2`: frontend rebuild, Light v02 theme. Frontend-only changes just need an Expo reload — no backend deploy.
- A v1 → v2 feature parity checklist is still needed before retiring v1 and switching production traffic to v2.0.

## Key Product Decisions

- **Monetisation:** Free at launch, no ads. Golf industry advertising unlocks ~5–10K users. Premium tier + banner ads at ~25K users. Live leaderboard/scores (paid data feed, ~£1,000/month) only unlocked once revenue covers the cost.
- **Images:** OG images linked from source URLs, never hosted (standard aggregator practice) — same principle for YouTube embeds (link/embed, don't host).
- **Score colours:** Broadcast convention (red = under par), matching DP World Tour/Masters coverage.

## Outstanding Items (carried across recent sessions)

- WebView in-app article reader (replace external-link tap) — not yet live-tested against a publisher that blocks embedding
- Golf data provider commercial terms (Sportradar/SportsDataIO/Sportbex) — deferred to Phase 6, only needed once live scores are justified
- Repo secret scan before going live (check for accidentally committed API keys, rotate any found)
- Security/backup checklist (`TheCut_Security_Backup_Checklist` in project docs) — not urgent, work through before launch
- Creator section: podcasts, short-game masterclass content — shipped in lean form, room to expand

## Working Notes

- No dedicated AI beyond Claude + Cursor has been identified as better-suited for this project's tasks so far (Cursor's Composer 2 model is worth trying for pure coding tasks but doesn't replace Claude for architecture/reasoning).
- PowerShell quirk: use `curl.exe` explicitly, not the `curl` alias (which maps to `Invoke-WebRequest` and misbehaves).
- Git identity for this machine: configured under `dave@yoyowebmarketing.com`.
