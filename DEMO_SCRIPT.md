# One-minute demo outline

Use only after the relevant live behavior is observed. Do not present the offline drill as an Ember run.

0–10 seconds: “Food rescue changes at the last minute. Rescue Relay lets a small model propose a new plan, while code checks what can actually fit.”

10–25 seconds: “This is a clearly labeled synthetic dispatch drill. Leo cancels. Muse Ember, called through OpenRouter, proposes a new plan.” Run live, show the result. If the checker rejects it, explain that honestly rather than claiming a successful recovery.

25–40 seconds: “Our checker verifies capacity, pickup windows, travel and driver availability, and preserves unaffected assignments. Here is the measured request cost and the exact returned model.” Show actual receipt only; if cost is absent, say it is not reported.

40–52 seconds: “Now two drivers cancel. The system must tell us what still needs a human instead of inventing a rescue.” Show a real second run if completed, or explicitly label a recorded real run.

52–60 seconds: “AI proposes. Code checks. People decide. Nothing dispatches automatically.”

Fallback: if no real Ember run succeeds, label this a prototype/offline drill and state that live integration is incomplete. Do not claim event eligibility or measured savings.
