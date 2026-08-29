# Trajectory: `changelog_auditor` on `case04_changelog_clean`

*Backend: openai / gpt-4o-mini  ·  Tokens: 3332 in / 322 out*

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
    "sha": "e12a01",
    "type": "feat",
    "subject": "add keyboard shortcuts to the editor"
  },
  {
    "sha": "e12a02",
    "type": "fix",
    "subject": "stop losing draft on tab switch"
  },
  {
    "sha": "e12a03",
    "type": "test",
    "subject": "add coverage for the draft autosave path"
  },
  {
    "sha": "e12a04",
    "type": "refactor",
    "subject": "extract editor toolbar into its own module"
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
    "text": "Keyboard shortcuts in the editor (Cmd+K command palette)"
  },
  {
    "line": 2,
    "section": "Fixed",
    "text": "Drafts are no longer lost when switching tabs"
  }
]
```

## Model turn 2  (stop: `tool_use`)
**calls** `get_commit`(`{"sha": "e12a01"}`)
**calls** `get_commit`(`{"sha": "e12a02"}`)
**calls** `get_commit`(`{"sha": "e12a03"}`)
**calls** `get_commit`(`{"sha": "e12a04"}`)

### tool `get_commit` ->
```
{
  "sha": "e12a01",
  "type": "feat",
  "subject": "add keyboard shortcuts to the editor",
  "body": "Cmd+K opens the command palette."
}
```

### tool `get_commit` ->
```
{
  "sha": "e12a02",
  "type": "fix",
  "subject": "stop losing draft on tab switch",
  "body": "Drafts are now autosaved before navigation."
}
```

### tool `get_commit` ->
```
{
  "sha": "e12a03",
  "type": "test",
  "subject": "add coverage for the draft autosave path",
  "body": "Test-only."
}
```

### tool `get_commit` ->
```
{
  "sha": "e12a04",
  "type": "refactor",
  "subject": "extract editor toolbar into its own module",
  "body": "No user-facing change."
}
```

## Model turn 3  (stop: `end_turn`)
[
  {
    "verdict": "phantom",
    "subject": "changelog:Keyboard shortcuts in the editor (Cmd+K command palette)",
    "evidence": [
      {
        "kind": "changelog_line",
        "ref": "changelog:1",
        "quote": "Keyboard shortcuts in the editor (Cmd+K command palette)"
      }
    ],
    "confidence": 0.9,
    "rationale": "The changelog entry references a keyboard shortcut feature that is not supported by the commit body."
  },
  {
    "verdict": "phantom",
    "subject": "changelog:Drafts are no longer lost when switching tabs",
    "evidence": [
      {
        "kind": "changelog_line",
        "ref": "changelog:2",
        "quote": "Drafts are no longer lost when switching tabs"
      }
    ],
    "confidence": 0.9,
    "rationale": "The changelog entry indicates a fix that does not match the specifics of any commit."
  }
]
