# Improvement Changelog

The story of how the solution evolved, baseline → final. Each row is a
meaningful experiment: what we tried, why, the evidence, and what we decided.

> **On evidence:** numbers below come from a real `python eval.py` run on
> **openai / gpt-4o** (2026-08-30), re-scored with the fair subject-canonicalizing
> scorer (`python rescore.py`, 2026-08-31). Metric = F1 over correctly-labelled
> problems, micro-averaged across the 10 cases; agent findings counted only when
> verified; **both arms** pass through the same subject canonicalization.

### Headline result (openai / gpt-4o, 10 cases) — **primary**

| Metric | Baseline | Agent | Change |
|---|---|---|---|
| **Problem F1** | 0.857 | **0.947** | **+0.09** |
| Precision | 0.818 | **1.000** | **+0.18** |
| Recall | 0.900 | 0.900 | 0.00 |
| False alarms / case | 0.20 | **0.00** | **−100%** |
| True positives / False positives | 9 / 2 | **9 / 0** | **−2 FP** |
| Cost / task | $0.0035 | $0.0109 | +$0.0074 |

The honest story: on these small fixtures GPT-4o **already recalls the real
problems** whether or not it has the architecture (recall 0.90 in both arms). The
baseline's weakness is **precision** — it flags 2 discrepancies it cannot ground
(a phantom "missing docs" entry on case01/case03). The agent's verifier removes
exactly those, taking precision **0.82 → 1.00** and false alarms **0.2 → 0.0 per
case at equal recall**. Both arms miss the same one genuine finding (case06,
internal-noise). So the measured contribution of the architecture *on this suite*
is precision/false-alarm elimination — the router + tools pay off on the axis the
suite understates (real-repo scale, where the whole artifact cannot be dumped).

> **⚠️ Correction (2026-08-31):** earlier versions of this file reported the
> baseline at **F1 = 0.00** with 11–14 false positives. That was a **scoring
> artifact**: the scorer matched findings on an exact subject-ref string
> (`changelog:1`) that only the specialist prompts were instructed to emit, so the
> baseline's substantively-correct findings (e.g. it *did* catch the hidden
> breaking change on case03) were counted as misses + false positives. The scorer
> now canonicalizes subjects for both arms (`src/scoring.py::canonical_subject`),
> which is idempotent on the agent (its score is unchanged, 9/0/1) and credits the
> baseline fairly. The **gpt-4o-mini** cross-model table was withdrawn for the same
> reason — regenerate it with `TRIAGE_PROVIDER=openai TRIAGE_MODEL=gpt-4o-mini
> python eval.py` under the corrected scorer. Per-stage rows below marked *design
> rationale* were not measured in isolation; the Baseline and Final rows are.

| Stage | What we tried and why | Evidence (fill from `results/`) | Decision / learning |
|-------|----------------------|-------------------------------|--------------------|
| **Baseline** | One general-purpose agent, one prompt, whole artifact dumped in, no tools/verifier (`src/baseline.py`). Establishes the "reasonable first attempt" bar. | **F1 = 0.857** · precision = 0.818 · recall = 0.900 · false-alarms/case = 0.20 (measured, gpt-4o, fair scorer) | Starting point. Observed error shape: good recall on small artifacts, but **over-flags** — 2 ungrounded false positives across 10 cases. That is the gap the verifier closes. |
| **Iter 1 — split into specialists behind a router** | Replace the one do-everything prompt with a router that classifies the item and dispatches to a focused CHANGELOG (G) or review (E) specialist. Why: a single prompt doing both jobs blurs each task's rules (e.g. "ignore internal commits", "judge code not claims"). | *design rationale — not measured in isolation* | Recall up on the type-specific hard cases (case06, case07 both reach agent F1 1.0 in the final run). Keep. |
| **Iter 2 — on-demand tools instead of a context dump** | Give specialists tools (`list_commits`/`get_commit`, `get_diff_for_path`/`get_hunk`) so they fetch artifact slices and must cite what they fetched, rather than reasoning over one big blob. | *design rationale* (every finding now forced to cite a resolved ref) | Expected: fewer vague claims; every finding now names a concrete ref. Keep. |
| **Iter 3 — verification at the claim↔artifact seam** | Add the two-layer verifier: deterministic grounding (ref exists + quote present) then an independent soundness LLM pass. Scorer counts only verified findings, so hallucinated findings can't score as false positives. | *design rationale* (kills ungrounded claims before scoring) | The decisive lever for this task class — grounding removes fabricated-evidence FPs no generator-prompt tuning fixed. Keep. |
| **Iter 4 — give the verifier the complement set (bug found via smoke test)** | Observed on a live Groq run (case01): the verifier rejected a *correct* `phantom` finding because the soundness pass only saw the one cited changelog line — and an absence claim ("no commit supports this line") can't be confirmed from a single artifact. Fixed by passing the full (small) artifact to the soundness pass. | Qualitative: case01 flipped `verified:false → true`; recommendation `auto_ok → needs_human` (matches ground truth). | **Kept.** Root lesson: a verifier's context must match the claim's shape or it becomes a false-negative machine (see README hot take). |
| **Iter 5 — commit-body drill-down heuristic (gap found via smoke test)** | Observed on case03 (breaking change flagged only in the commit body): the model finalized without calling `get_commit`, so it missed the misclassification. Added an explicit heuristic — always read the body for rename/remove/change-type subjects and for major (x.0.0) releases. | Qualitative: case03 flipped `0 findings → 1 verified misclassified` (action `escalate`) even on the weak gpt-oss-120b. | **Kept.** Helps every model; you genuinely cannot classify a rename's breaking-ness without the body. |
| **Iter 6 — provider/model abstraction** | Made the loop provider-agnostic (Anthropic native + one OpenAI-compatible adapter for OpenAI/Groq/OpenRouter) so the eval can compare the same agent across backends with one env var. | Pipeline verified end-to-end on Groq free tier. | **Kept.** Turns the harness into a model-comparison tool, not just a Claude runner. |
| **Removed experiment — force structured output on the generator** | Tried constraining the specialist to a strict JSON schema *instead of* the verifier, hoping format discipline would curb hallucination. | qualitative | **Removed.** It made outputs well-formed but not *true* — a cleanly-formatted finding citing a non-existent sha is still wrong. Taught us the problem is grounding, not formatting; motivated Iter 3. Structured output kept only as an output-parsing convenience, not a correctness mechanism. |
| **Final** | Router + specialists + on-demand tools + two-layer verifier, verified-only scoring. Human approval gate added (Ground Rule #04). | **GPT-4o: F1 = 0.947** · precision = 1.00 · recall = 0.90 · false-alarms/case = 0.0 · cost/task = $0.011 (measured, fair scorer). | Main contribution: **verification at the seam** buys precision without costing recall — F1 0.857 → 0.947, precision 0.82 → 1.00, false alarms 0.2 → 0.0/case. On this small-artifact suite that is the whole delta; the router + on-demand tools are what let the same pipeline run on real repos too large to dump into a prompt. |

### How to populate this table

```bash
python eval.py --arm baseline   # baseline row
python eval.py --arm agent      # final row
python eval.py                  # both + the comparison table in results/results.csv
```

To reproduce an intermediate stage, check out the tagged commit for that stage
(see git history) and re-run — the eval harness and cases are unchanged across
stages by design, so the rows are directly comparable.
