# Trajectory: `router` on `case07_review_ignored`

*Backend: openai / gpt-4o  ·  Tokens: 244 in / 31 out*

## System instructions
```
You route items in a repository maintainer's triage queue to the
correct specialist. Given a short preview of one item, classify it as exactly one
of: changelog_audit, review_resolution, dep_bump, flaky_test, issue_triage.

Guidance:
- changelog_audit: the item is about reconciling a CHANGELOG / release notes with commits.
- review_resolution: the item is about whether a PR addressed its review comments.
- dep_bump: a dependency-version-bump PR to assess for safety.
- flaky_test: a failing CI test to judge as real-vs-flaky.
- issue_triage: a new bug report to sort as actionable / needs-info / duplicate.

Output ONLY JSON: {"item_type": "<one of the above>", "why": "<short reason>"}
```

## Model turn 0  (stop: `end_turn`)
{"item_type": "review_resolution", "why": "The item concerns evaluating whether a PR has addressed review comments, which aligns with review_resolution."}
