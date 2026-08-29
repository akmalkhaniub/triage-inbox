# Eval cases

Ten self-contained cases (no git, no network). Each JSON file holds the repo
artifacts the agent may inspect plus a hidden `ground_truth` used only by the
scorer. Data is synthetic (ground rule #7).

| Case | Type | What it tests | Hard? |
|------|------|---------------|:----:|
| case01 | changelog | one phantom line | |
| case02 | changelog | a feat commit missing from the changelog | |
| case03 | changelog | breaking change misfiled, impact hidden in commit **body** | ★ |
| case04 | changelog | clean release — must flag nothing (precision) | |
| case05 | changelog | phantom + missing together | |
| case06 | changelog | 5 internal commits that must NOT be flagged + 1 real miss | ★ |
| case07 | review | "done" reply but only a cosmetic diff → ignored | ★ |
| case08 | review | all comments addressed — must flag nothing (precision) | |
| case09 | review | rename done but requested test missing → partial | |
| case10 | review | addressed + ignored + partial in one PR | |

**Ground-truth format**
- changelog: a list of `{type, ref}` discrepancies, where `type` ∈
  `phantom|missing|misclassified` and `ref` is `changelog:<line>` or `commit:<sha>`.
- review: a map `{comment_id: verdict}`, verdict ∈ `addressed|partial|ignored`.

The scorer (`src/scoring.py`) treats both as "flag the problems": for review,
problems are the `ignored`/`partial` comments. Primary metric = F1 over
correctly-labelled problems.

**Adding a case:** drop a new `caseNN_*.json` here in the same shape; `eval.py`
picks it up automatically (sorted by filename).
