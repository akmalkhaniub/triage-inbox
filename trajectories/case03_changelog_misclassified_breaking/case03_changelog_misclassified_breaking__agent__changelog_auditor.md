# Trajectory: `changelog_auditor` on `case03_changelog_misclassified_breaking`

*Backend: openai / gpt-4o  ·  Tokens: 3125 in / 199 out*

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
    "sha": "c30a01",
    "type": "feat",
    "subject": "rename --timeout flag to --timeout-ms",
    "author": "unknown"
  },
  {
    "sha": "c30a02",
    "type": "feat",
    "subject": "add --json output mode",
    "author": "unknown"
  },
  {
    "sha": "c30a03",
    "type": "docs",
    "subject": "expand the quickstart guide",
    "author": "unknown"
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
    "section": "Changed",
    "text": "Renamed the --timeout flag to --timeout-ms"
  },
  {
    "line": 2,
    "section": "Added",
    "text": "New --json output mode for all commands"
  }
]
```

## Model turn 2  (stop: `tool_use`)
**calls** `get_commit`(`{"sha": "c30a01"}`)

### tool `get_commit` ->
```
{
  "sha": "c30a01",
  "type": "feat",
  "subject": "rename --timeout flag to --timeout-ms",
  "body": "BREAKING CHANGE: the --timeout flag is removed. Scripts must use --timeout-ms, which now takes milliseconds instead of seconds."
}
```

## Model turn 3  (stop: `end_turn`)
```json
[
  {
    "verdict": "misclassified",
    "subject": "changelog:1",
    "evidence": [
      {
        "kind": "changelog_line",
        "ref": "changelog:1",
        "quote": "Renamed the --timeout flag to --timeout-ms"
      },
      {
        "kind": "commit",
        "ref": "commit:c30a01",
        "quote": "BREAKING CHANGE: the --timeout flag is removed. Scripts must use --timeout-ms, which now takes milliseconds instead of seconds."
      }
    ],
    "confidence": 1.0,
    "rationale": "The changelog entry about renaming the --timeout flag is a breaking change and should be in the 'Breaking' section."
  }
]
```
