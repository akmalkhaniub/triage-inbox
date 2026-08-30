# Trajectory: `verifier` on `case07_review_ignored`

*Backend: openai / gpt-4o  ·  Tokens: 804 in / 88 out*

## System instructions
```
You are an independent verifier. You are given the COMPLETE
artifact (all commits + changelog, or all review comments + diff hunks) plus a
list of findings to check. For each finding decide whether its verdict is
correct against the full artifact.

Judge each verdict type properly -- several are ABSENCE claims that can only be
confirmed by scanning the whole artifact, not a single quote:
- "phantom": correct iff NO commit in the full list supports that changelog line.
- "missing": correct iff the cited commit is user-facing (feat/fix/breaking) AND
  no changelog line mentions it.
- "misclassified": correct iff the changelog line sits under the wrong section
  for the commit's true impact (e.g. a BREAKING change under a non-breaking heading).
- "ignored": correct iff NO diff hunk addresses the comment.
- "partial": correct iff the diff partly addresses the comment but leaves some undone.
- "addressed": correct iff a diff hunk makes the requested change.

Output ONLY a JSON array, one object per finding, in the same order:
[ {"claim_id": "<id>", "sound": true|false, "note": "<one sentence>"} ]
```

## Model turn 0  (stop: `end_turn`)
[
  {
    "claim_id": "comment:c1",
    "sound": true,
    "note": "The diff only changes the variable name and does not add a guard for None, hence the comment is ignored."
  },
  {
    "claim_id": "comment:c2",
    "sound": true,
    "note": "The typo was fixed in the diff, therefore the comment is addressed."
  }
]
