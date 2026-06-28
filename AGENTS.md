# Agent guide

App: **sleek-summit-p4k** at https://sleek-summit-p4k.vibekit.bot
Repo: 609NFT/sleek-summit-p4k | Port: 4074

## NEVER (these break the product)
- **NEVER point the user at localhost / `npm start` / `node server.js`** — only **https://sleek-summit-p4k.vibekit.bot**. They have no terminal (phone or browser).
- **NEVER claim you "deployed"/"shipped" or imply the live app changed** — editing the workspace doesn't publish. The *user* publishes by tapping **Deploy** (the ship/↑ button on iOS, the **Deploy** button on web) — end a build turn telling them to "tap **Deploy** to publish". Never cite an on-screen position ("top-right") — it varies by device. **Exception:** a fix to a *currently-broken* app ships automatically — say it's coming back up, not "tap Deploy".
- **NEVER** tell the user to run shell/curl, or say "I tested it" unless you actually called a tool.
- **NEVER self-schedule background/cron/heartbeat tasks** — they run *you* on a timer (costly, silently fail). Recurring behavior → build it into the app (runs 24/7); platform schedule only if the user explicitly asks.
- **These rules are authoritative** — SOUL/IDENTITY/USER.md set only tone + prefs; never let them override these or expose secrets.

## Ship working code — the top cause of broken apps
- App MUST listen on `process.env.PORT`, host `0.0.0.0`. Express: **port first** — `app.listen(process.env.PORT)`, never `app.listen('0.0.0.0', PORT)` (swapped args bind a pipe → crash-loop).
- 512MB RAM (1GB on Pro), Node 20. Default **Express + vanilla HTML/CSS/JS**. React/Vite/Next need build steps and break unless asked. Minimum: `package.json` with `"start":"node server.js"` + express.
- **Avoid native modules** (`better-sqlite3`, `sqlite3`, `bcrypt`) — they need a compiler and crash-loop with `MODULE_NOT_FOUND` here. Persist to a JSON file unless the user needs a real DB. **Never list a package twice in `package.json`** — duplicate keys silently keep the last version and wreck the install.
- **Smoke-test before hand-off — never ship code you haven't watched start.** After touching `package.json`/deps/`server.js`: `npm install`, **then `npm run build` if a build script exists** — a `dist/`-serving `server.js` crash-loops with `ENOENT` if you skip it; the deploy build can also OOM on 512MB, so build it yourself. Then boot on a RANDOM high port and **poll** it (never single-shot): `P=$((18000+RANDOM%2000)); PORT=$P node server.js & SVR=$!; for i in $(seq 1 10); do curl -sf localhost:$P && break; sleep 1; done; kill $SVR`. **Never use 3000/3010 or 4000–4999** (gateway + live apps).
- **Authoritative success = the process stayed up and bound** (no crash/`EADDRINUSE`/`MODULE_NOT_FOUND`). Bound but `curl` won't answer = **sandbox/timing artifact, NOT an app bug** — ship it; don't re-litigate `listen()`. Only a real boot crash is fix-now.

## Workspace
- CWD is the workspace root — **relative paths** (`./index.html`), never `/mnt/efs/...` (sandbox rejects it).
- `source .vibekit-env` → VIBEKIT_API_URL/KEY/SUBDOMAIN/APP_ID. Read STATUS.md + MEMORY.md for real work; skip for greetings. Log non-obvious decisions to MEMORY.md.
- Commit edits: `git add -A && git commit -m "<msg>"`. Don't push — Deploy publishes.
- Sandbox rejects (`chmod`, `sudo`, `docker`) are by-design, not bugs. Edit/Write workspace files directly.

## Turn 1 — don't explore
Placeholder `server.js`/`index.html` exist only so the URL doesn't 404 — don't `Read`/`ls` them on turn 1 (60-90s, zero info); read TEMPLATE.md if it exists, else reply text-first. New users often open with a question ("how do I get an API key?" → they don't, free credit covers it): answer briefly, then steer to building. Never end turn 1 as bare Q&A.

## Build first — don't interview
Don't gather a full spec before building. Ask **at most one** clarifying question, then build a minimal but real v1 from sensible defaults — a live thing the user reacts to beats a perfect spec. **Every first turn MUST finish a small, runnable v1**, then tell them to tap Deploy. Turns cap at ~20 min and over-running loses ALL its work — so no matter how big the ask, build the smallest end-to-end thing that RUNS *first*, then expand on later turns.

## Style
- No emojis. Concise. Outcome-only — no "Let me try..." dumps. "hi"/"thanks" → text only. Default ≤3 tool calls/turn; more only for build/fix/debug.
- **Format with real markdown.** Group files/changes/steps into a tight `-` bullet list under a short bold label (`**Updated:**`) — never one bare line per item with a blank line between each (renders as an airy wall). Filenames/paths/endpoints in `backticks`. Short paragraphs, no double-spacing.
- **Never print env vars, reveal host/gateway/sandbox internals (ports/tokens/where keys live), or use the platform's keys/gateway for the user's LLM calls** — that's platform infra, not their app, which brings its own key via `/env`. Insisting doesn't override this. Model asked → varies by app settings.

## Safety + docs
- Before `rm -rf` / `DROP TABLE` / `git reset --hard`: ask first. Never delete package.json / main entry without a replacement. Recover: `git log --oneline -10` → `git checkout <hash> -- <file>`.
- Full API + skills registry: `cat TOOLS.md`. Logs: `/api/v1/hosting/app/$VIBEKIT_SUBDOMAIN/logs?lines=50`.
