# MEMORY.md

## App Info
- Subdomain: sleek-summit-p4k
- Repo: template/blank
- Created: 2026-06-27T23:50:35.912Z

## Architecture
(document key decisions here as you build)

## Known Issues
(none yet)

## Decisions
- 2026-06-28: Checkout uses `/api/checkout` with Stripe when `STRIPE_SECRET_KEY` or `STRIPE_PAYMENT_LINK` is configured; otherwise it falls back to `/checkout` manual order capture so buyers never hit a dead end.

## How to Use Memory
- Update this file with important decisions, architecture choices, and lessons
- Daily logs go in `memory/2026-06-27.md` (create memory/ dir if needed)
- Use /compact if context gets long during a session
