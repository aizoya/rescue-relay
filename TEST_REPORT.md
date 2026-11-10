# Rescue Relay verification

Date: November 10, 2026 UTC (November 9 Pacific).

## Passed

20 automated tests, no failures. Tests ran against local code using synthetic fixtures, mocked OpenRouter responses and a local HTTP server in the same test process.

- Known unique driver IDs, bounded note and explicit mode.
- All eight driver-cancellation combinations account for every pickup.
- Malformed proposals and invalid types fail closed.
- Unknown, duplicate, missing and double-classified pickups are rejected.
- Unavailable drivers cannot receive assignments.
- Unaffected pickups retain their original driver and cannot be dropped.
- Full onboard crate load is checked against capacity.
- Entire service duration fits the pickup window, including boundary cases.
- Hub departure, between-stop travel and return availability are checked.
- Live calls require an approval flag, private key and correct model setting.
- Mock requests pin Ember and structured response format.
- Missing or invalid costs remain unknown; no estimated cost is labeled actual.
- Provider HTTP errors, network errors, timeouts and malformed JSON fail visibly.
- No key or raw provider error is leaked in error messages.
- HTTP local-host/origin/content-type/input restrictions and static assets.
- Invalid model proposals are returned as rejected, not accepted plans.
- Concurrent live calls are blocked.
- `npm run check` syntax checks passed.

## Fixture results

Leo unavailable: 16 synthetic crates covered, including 6 affected crates reassigned; 0 pickups uncovered.

Maya and Leo unavailable: Sam's 6 crates remain covered; 3 pickups (10 crates) remain uncovered and need a human. No success is fabricated for them.

These figures are deterministic fixture results, not measured model performance or real rescued food.

## Not run / blocked

The cloud browser could not reach the local app server (connection refused), so browser interaction, visual layout, mobile behavior, repeated UI clicks and accessibility testing are not verified. Stale-result clearing is implemented but not browser-tested.

No actual Ember/OpenRouter request was made, and no model usage or real cost was measured. No public repository, deployed app, recorded video or final submission was created.
