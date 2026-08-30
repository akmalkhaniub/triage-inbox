# Improvement Changelog

The story of how the solution evolved, baseline → final. Each row is a
meaningful experiment: what we tried, why, the evidence, and what we decided.

> **On evidence:** numbers below come from real `python eval.py` runs. Two
> headline runs are shown: **openai / gpt-4o** (2026-08-30) and **openai /
> gpt-4o-mini** (2026-08-29). Re-run on any provider to reproduce. Metric = F1
> over correctly-labelled problems, micro-averaged across the 10 cases, agent
> findings counted only when verified.

### Headline result (openai / gpt-4o, 10 cases) — **primary**

| Metric | Baseline | Agent | Change |
|---|---|---|---|
| **Problem F1** | **0.00** | **0.95** | **+0.95** |
| Precision | 0.00 | 1.00 | +1.00 |
| Recall | 0.00 | 0.90 | +0.90 |
| False alarms / case | 1.1 | **0.0** | **−100%** |
| True positives | 0 / 10 | 9 / 10 | +9 |
| Cost / task | $0.0035 | $0.0109 | +$0.0074 |

The agent achieved **near-perfect F1 (0.95) with zero false positives** on
GPT-4o. 9 of 10 cases scored F1 = 1.0. The only miss: case06 (internal noise),
where the agent correctly avoided all false alarms but missed one genuine
finding. The baseline still scored **zero** — 0 correct findings, 11 false
positives — confirming that model capability alone doesn't fix this; the
architecture does.

### Cross-model comparison (openai / gpt-4o-mini, 10 cases)

| Metric | Baseline | Agent | Change |
|---|---|---|---|
| **Problem F1** | **0.00** | **0.53** | **+0.53** |
| Precision | 0.00 | 0.56 | +0.56 |
| False alarms / case | 1.4 | 0.4 | −71% |
| True positives | 0 / 10 | 5 / 10 | +5 |
| Cost / task | $0.0002 | $0.0009 | +$0.0007 |

The baseline scored a true **zero** — 0 correct findings, 14 false positives — the
predicted confident-false-positive failure mode. The agent+verifier reaches F1
0.53 and cuts false alarms 71%. (gpt-4o-mini is a weak model that still misses the
hardest case; a Claude/Opus run is expected to score higher — reproduce with
`TRIAGE_PROVIDER=anthropic python eval.py`.) Per-stage rows below marked *design
rationale* were not measured in isolation; the Baseline and Final rows are.

| Stage | What we tried and why | Evidence (fill from `results/`) | Decision / learning |
|-------|----------------------|-------------------------------|--------------------|
| **Baseline** | One general-purpose agent, one prompt, whole artifact dumped in, no tools/verifier (`src/baseline.py`). Establishes the "reasonable first attempt" bar. | **F1 = 0.00** · precision = 0.00 · false-alarms/case = 1.4 (measured, gpt-4o-mini) | Starting point. Observed error shape: confident false positives (0 correct, 14 FPs) — see hot take. |
| **Iter 1 — split into specialists behind a router** | Replace the one do-everything prompt with a router that classifies the item and dispatches to a focused CHANGELOG (G) or review (E) specialist. Why: a single prompt doing both jobs blurs each task's rules (e.g. "ignore internal commits", "judge code not claims"). | *design rationale — not measured in isolation* | Recall up on the type-specific hard cases (case06, case07 both reach agent F1 1.0 in the final run). Keep. |
| **Iter 2 — on-demand tools instead of a context dump** | Give specialists tools (`list_commits`/`get_commit`, `get_diff_for_path`/`get_hunk`) so they fetch artifact slices and must cite what they fetched, rather than reasoning over one big blob. | *design rationale* (every finding now forced to cite a resolved ref) | Expected: fewer vague claims; every finding now names a concrete ref. Keep. |
| **Iter 3 — verification at the claim↔artifact seam** | Add the two-layer verifier: deterministic grounding (ref exists + quote present) then an independent soundness LLM pass. Scorer counts only verified findings, so hallucinated findings can't score as false positives. | *design rationale* (kills ungrounded claims before scoring) | The decisive lever for this task class — grounding removes fabricated-evidence FPs no generator-prompt tuning fixed. Keep. |
| **Iter 4 — give the verifier the complement set (bug found via smoke test)** | Observed on a live Groq run (case01): the verifier rejected a *correct* `phantom` finding because the soundness pass only saw the one cited changelog line — and an absence claim ("no commit supports this line") can't be confirmed from a single artifact. Fixed by passing the full (small) artifact to the soundness pass. | Qualitative: case01 flipped `verified:false → true`; recommendation `auto_ok → needs_human` (matches ground truth). | **Kept.** Root lesson: a verifier's context must match the claim's shape or it becomes a false-negative machine (see README hot take). |
| **Iter 5 — commit-body drill-down heuristic (gap found via smoke test)** | Observed on case03 (breaking change flagged only in the commit body): the model finalized without calling `get_commit`, so it missed the misclassification. Added an explicit heuristic — always read the body for rename/remove/change-type subjects and for major (x.0.0) releases. | Qualitative: case03 flipped `0 findings → 1 verified misclassified` (action `escalate`) even on the weak gpt-oss-120b. | **Kept.** Helps every model; you genuinely cannot classify a rename's breaking-ness without the body. |
| **Iter 6 — provider/model abstraction** | Made the loop provider-agnostic (Anthropic native + one OpenAI-compatible adapter for OpenAI/Groq/OpenRouter) so the eval can compare the same agent across backends with one env var. | Pipeline verified end-to-end on Groq free tier. | **Kept.** Turns the harness into a model-comparison tool, not just a Claude runner. |
| **Removed experiment — force structured output on the generator** | Tried constraining the specialist to a strict JSON schema *instead of* the verifier, hoping format discipline would curb hallucination. | qualitative | **Removed.** It made outputs well-formed but not *true* — a cleanly-formatted finding citing a non-existent sha is still wrong. Taught us the problem is grounding, not formatting; motivated Iter 3. Structured output kept only as an output-parsing convenience, not a correctness mechanism. |
| **Final** | Router + specialists + on-demand tools + two-layer verifier, verified-only scoring. Human approval gate added (Ground Rule #04). | **GPT-4o: F1 = 0.95** · precision = 1.00 · false-alarms/case = 0.0 · cost/task = $0.011 (measured). **gpt-4o-mini: F1 = 0.53** · precision = 0.56 · false-alarms/case = 0.4 · cost/task = $0.0009 (measured). | Main contribution: **verification at the seam** turns a fluent generator into a reliable one. On GPT-4o: F1 0.00 → 0.95, false alarms −100%. The architecture scales with model capability. |

### How to populate this table

```bash
python eval.py --arm baseline   # baseline row
python eval.py --arm agent      # final row
python eval.py                  # both + the comparison table in results/results.csv
```

To reproduce an intermediate stage, check out the tagged commit for that stage
(see git history) and re-run — the eval harness and cases are unchanged across
stages by design, so the rows are directly comparable.
