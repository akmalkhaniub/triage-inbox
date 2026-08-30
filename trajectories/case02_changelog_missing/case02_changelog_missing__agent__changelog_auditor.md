# Trajectory: `changelog_auditor` on `case02_changelog_missing`

*Backend: openai / gpt-4o  ·  Tokens: 2149 in / 252 out*

## System instructions
```
You are a release-notes auditor for a software repository.

Your job: compare the CHANGELOG **as written** against the **actual commits** in
the release, and report only the DISCREPANCIES. Do not list lines that are fine.

Discrepancy types:
- "phantom": a CHANGELOG line claims a change that no commit supports.
- "missing": a commit made a user-facing change (feat / fix / breaking) that no
  CHANGELOG line mentions. Ignore purely internal commits (chore, docs, test,
  refactor with no user impact) -- those are not expected in the changelog.
- "misclassified": a CHANGELOG line exists but sits under the wrong section for
  the commit's true impact. The most important case: a BREAKING change listed
  under an ordinary "Added"/"Fixed"/"Changed" heading instead of "Breaking".

Method:
1. Call list_commits, then read_changelog.
2. You CANNOT judge breaking-ness from a subject alone. Call get_commit to read
   the body for EVERY commit that is even possibly breaking -- specifically any
   whose subject mentions rename / remove / drop / delete / replace / change /
   migrate, and (because major releases concentrate breaking changes) every
   commit when the release version is a major bump (x.0.0). The BREAKING CHANGE
   marker usually appears only in the body.
3. Decide the discrepancies. Tie EACH to evidence: the commit sha and/or the
   changelog line, and quote the exact text you relied on.

Output ONLY a JSON array (no prose) of objects:
[
  {
    "verdict": "phantom" | "missing" | "misclassified",
    "subject": "changelog:<line>"  (for phantom/misclassified)  or  "commit:<sha>" (for missing),
    "evidence": [ {"kind": "changelog_line"|"commit", "ref": "changelog:<line>"|"commit:<sha>", "quote": "<exact text>"} ],
    "confidence": 0.0-1.0,
    "rationale": "<one sentence>"
  }
]
If there are no discrepancies, output [].
```

## Model turn 0  (stop: `tool_use`)
**calls** `list_commits`(`{}`)

### tool `list_commits` ->
```
[
  {
    "sha": "b10001",
    "type": "feat",
    "subject": "add pagination to /v2/orders"
  },
  {
    "sha": "b10002",
    "type": "feat",
    "subject": "add rate-limit headers to all responses"
  },
  {
    "sha": "b10003",
    "type": "fix",
    "subject": "reject negative quantity in order create"
  }
]
```

## Model turn 1  (stop: `tool_use`)
**calls** `read_changelog`(`{}`)

### tool `read_changelog` ->
```
[
  {
    "line": 1,
    "section": "Added",
    "text": "Pagination on the /v2/orders endpoint"
  },
  {
    "line": 2,
    "section": "Fixed",
    "text": "Order creation now rejects negative quantities"
  }
]
```

## Model turn 2  (stop: `end_turn`)
[
  {
    "verdict": "phantom",
    "subject": "changelog:2",
    "evidence": [
      {
        "kind": "commit",
        "ref": "commit:b10003",
        "quote": "reject negative quantity in order create"
      },
      {
        "kind": "changelog_line",
        "ref": "changelog:2",
        "quote": "Order creation now rejects negative quantities"
      }
    ],
    "confidence": 1.0,
    "rationale": "A fix for negative order quantity is claimed in the CHANGELOG under 'Fixed', but it is not a phantom as there is a supporting commit."
  },
  {
    "verdict": "missing",
    "subject": "commit:b10002",
    "evidence": [
      {
        "kind": "commit",
        "ref": "commit:b10002",
        "quote": "add rate-limit headers to all responses"
      }
    ],
    "confidence": 1.0,
    "rationale": "The feature addition of rate-limit headers was not mentioned in the CHANGELOG."
  }
]
