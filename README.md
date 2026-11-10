# Rescue Relay

**Local hackathon prototype. Not deployed. No live Muse Ember call has been completed.**

A food-rescue dispatcher selects a cancelled driver. Muse Ember can propose a revised pickup plan through OpenRouter; deterministic code checks capacity, service windows, travel, availability, missing/duplicate IDs, and preservation of unaffected assignments. Nothing is dispatched and no external messages are sent.

All drivers, locations, routes, quantities and timing are clearly labeled synthetic. This project makes no claim about real rescued food, operational partnerships, live traffic, food safety, or optimal route planning.

## Fastest preview on Mac

1. Unzip this package.
2. Open `offline-demo.html` in your browser. It needs no installation, server, credentials or internet connection.
3. Click **Run offline drill**. With Leo unavailable, the fixture covers 16 crates, including 6 reassigned from Leo.
4. Click **Stress test: two out**, then **Run offline drill**. Three pickups remain uncovered and clearly require a human.

The offline preview is not a live model demonstration and does not satisfy the event's live Ember requirement.

## Full server version on Mac

Requires Node.js 22 or newer, already installed. No third-party packages are needed.

1. Open Terminal in the unzipped `rescue-relay-prototype` folder. On Mac, type `cd `, drag the folder into Terminal, then press Return.
2. Check `node --version`.
3. Run `npm test` and `npm run check`.
4. Run `npm start`.
5. Open http://127.0.0.1:4173 . Keep Terminal open. Stop the server with Control-C.

If Node is absent, use the offline HTML immediately. Installation is a separate owner decision; the package does not install software.

## Live Ember setup: owner action required

The app defaults to **live calls disabled**. Do not put any key in chat, browser JavaScript, screenshots, recordings or source control. Do not enable live requests until the owner approves the exact spend/credit budget and key use.

After approval, the owner can copy `.env.example` to `.env`, privately configure their existing OpenRouter key there, set `LIVE_CALLS_APPROVED=true`, and retain `OPENROUTER_MODEL=meta/muse-ember`. Run `node --env-file=.env server.mjs` instead of `npm start`.

Each click in live mode makes one OpenRouter request, with no automatic retries. The server pins `meta/muse-ember`, limits response tokens to 1,400, times out after 35 seconds, and refuses concurrent requests. These limits are not a hard dollar cap: configure an appropriate provider-side key spending limit before enabling. Never treat an API timeout as proof there was no charge.

Only synthetic fixture data and the optional dispatcher note go to OpenRouter. Keep that note free of private operational or personal details.

The receipt records requested/returned model, request ID, latency, input/output tokens, and `usage.cost` when OpenRouter actually reports it. Missing cost stays unknown, never zero or an invented estimate. Export run evidence using the button after a run. Live results must still be independently reviewed; valid JSON alone does not mean a valid plan.

## What is verified

- 20 automated tests passed in the supplied environment. See `TEST_REPORT.md` and `evidence/test-results.txt`.
- Syntax checks passed for server, validator, provider adapter and browser JavaScript.
- Normal and impossible cancellation fixtures are checked, including all eight driver-availability combinations.
- Provider tests use mocks, not an actual model. No real credentials were used.

## What is not verified

- Actual Ember API compatibility, account model access, event credits, or measured model cost.
- Browser visual/interaction QA, mobile layout, VoiceOver, or screen recording. The available cloud browser could not reach this environment's local server.
- Public GitHub publication, video upload or final submission. No publication/deployment is included.

## Files

- `server.mjs`: local-only HTTP server and replan endpoint.
- `src/engine.mjs`: fixture, bounded offline planner and deterministic validator.
- `src/provider.mjs`: OpenRouter Muse Ember adapter and cost receipt.
- `public/`: same one-screen UI used by the server.
- `offline-demo.html`: generated self-contained offline version of that UI.
- `test/`: automated tests with synthetic fixtures and mocked model responses.
- `DEMO_SCRIPT.md`: one-minute demo outline; only claim a live result after observing it.

## Submission readiness

Official event requirements verified separately: public GitHub repository, one-minute demo-video link, team details, project description and OpenRouter user ID by 8:00 PM Pacific, November 9, 2026. Muse Ember must be called through OpenRouter. Every member must register individually. Publishing the repository, uploading the video, spending credits and final submission require the owner's approval/actions. This ZIP alone is not a completed submission.

Sources: https://openrouter.ai/meta/muse-ember ; https://app.notion.com/p/openrouter/Build-Day-OpenRouter-x-Meta-4102fd57c4dc808da9c8eaa351d460ad ; https://cerebralvalley.ai/e/openrouter-meta-sf-build-day
