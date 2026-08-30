# Triage Inbox — an evidence-first agent for a repository maintainer's queue

## The person and the bottleneck

Picture the maintainer of a busy repository on a Monday morning. The queue is a
pile of *different* judgments, not one: a stack of dependency-bump PRs, a red CI
run, three PRs that were pushed with "addressed your comments 👍", a handful of
new bug reports, and a release to cut. Each item needs a small, careful call —
*is this safe to act on, and what's my evidence?* — and each call is the kind of
thing a tired human rubber-stamps or lets rot in the queue.

Two of those calls are unglamorous, constant, and easy to get wrong:

- **"Does the CHANGELOG actually match what shipped?"** A breaking change buried
  under *Changed*, a feature that's in the notes but was never merged, a real fix
  that never made the notes. Diffing the notes against the commit range by hand
  is tedious, so it's skipped — and consumers trust notes that quietly lie.
- **"Did this PR really address its review?"** Re-reading a whole PR to confirm
  each of eight comments was genuinely handled (not just replied to) is slow, so
  reviewers skim, and cosmetic "done" changes slip through to merge.

The bottleneck isn't any single item — it's **triage overload**: too many
small evidence-gathering judgments, each individually skippable, collectively
where quality leaks. That's what this project attacks.

## What it is

A small agent system that takes one queue item and returns a triage verdict
where **every claim is tied to a repo artifact and independently verified**. It
implements two lanes deeply — CHANGELOG audit (**G**) and review-comment
resolution (**E**) — inside an orchestration skeleton designed so the other
lanes (dependency bumps, flaky tests, issue triage) drop in without touching the
router, verifier, or scorer. Those three lanes ship as honest stubs
([`src/specialists/stubs.py`](src/specialists/stubs.py)) that route correctly and
carry their design intent but do no fake work — so the extension seam is visible
in code, not just described. See it live:
`python run_one.py evalcases/stub_demo/dep_bump_demo.json`.

> **What existed before this hackathon:** nothing — this is a from-scratch
> project. The only pre-existing components are the Anthropic Python SDK and the
> Claude models. Everything in `src/` is new.

### Human-in-the-loop approval gate

Ground Rule #04 requires human approval before consequential actions. When you
run `run_one.py`, the agent presents its verdict (`AUTO_OK`, `NEEDS_HUMAN`, or
`ESCALATE`) and pauses for the maintainer to accept or override before the
action is finalized. Pass `--no-approve` for batch/CI mode:

```bash
python run_one.py evalcases/cases/case03_changelog_misclassified_breaking.json           # interactive approval
python run_one.py evalcases/cases/case03_changelog_misclassified_breaking.json --no-approve  # skip for CI
```

## How it works

```
 queue item ─▶ Router ─▶ Specialist (G or E) ─▶ Verifier ─▶ recommendation
               │           │  pulls artifacts     │  1. grounding (deterministic)
               │           │  via tools, emits     │  2. soundness  (independent LLM)
               │           │  Findings             │
               └─ classifies      every Finding ───┘  only VERIFIED findings
                  by shape        speaks one schema    reach the recommendation
```

Each design choice maps to a capability the brief names, and each is there to
fix a specific failure — not for component count:

| Choice | Capability | The failure it fixes |
|--------|-----------|----------------------|
| **On-demand tools** (`list_commits`, `get_commit`, `get_diff_for_path`, …) | better tools / context | Dumping the whole artifact in one prompt invites the model to skim; fetching a slice forces each claim to name the artifact it rests on. |
| **Router → specialists** | orchestration | One general prompt doing five jobs is mediocre at all of them; a focused specialist prompt per item type is sharp. |
| **Deterministic grounding** | verification | Kills hallucinated evidence for free — a fabricated commit sha or an invented quote fails before any second model call. |
| **Independent soundness pass** | verification | A separate model instance checks the verdict follows from the cited text, catching confident-but-wrong reasoning. |
| **One `Finding` schema for all lanes** | orchestration | Router, verifier, memory, and scorer are specialist-agnostic, so adding a lane is one branch + one module. |
| **JSON-file memory** | memory | Carries a repo's recurring quirks forward without re-derivation; kept a plain file so it's inspectable and can't leak ground truth. |

The single most important idea: **the verifier is load-bearing in the score.**
The scorer counts a finding as "flagged" only if the verifier passed it
(`src/scoring.py`), so a hallucinated finding can never become a false positive.
That's how a design choice shows up as a number instead of a claim.

## The baseline

`src/baseline.py` is the fair comparison: one general-purpose agent, one prompt,
the whole artifact dumped in, **no router, no tools, no verifier** — exactly how
a reasonable person first tries this with a single Claude call. It gets the same
task, the same 10 cases, and the same output contract, so the only differences
are the design choices under test.

## Measuring it

Ten self-contained cases (`evalcases/cases/`, all synthetic — ground rule #7),
including hard ones: a breaking change whose impact is only in the commit body, a
release with five internal commits that must *not* be flagged, a "done" reply
backed by a cosmetic diff. Both task types reduce to one question a maintainer
cares about — *did we flag the real problems, with the right label, without
crying wolf?* — so the **primary metric is F1 over correctly-labelled problems**,
with precision (false alarms) and cost per task alongside.

```bash
python eval.py            # runs baseline + agent over all 10 cases, writes results/
```

Results land in `results/results.json` and `results/results.csv` and are printed
as the brief's Metric / Baseline / Agent / Change table. **These are produced by
your own funded run — this repo ships no fabricated numbers.** See
[`CHANGELOG.md`](CHANGELOG.md) for the experiment-by-experiment story and the
results table to fill in, and [`REPRODUCE.md`](REPRODUCE.md) for a clean-room
runbook.

## Testing on real open-source GitHub repositories

In addition to offline benchmark fixtures, you can point Triage Inbox directly
at any public GitHub repository to audit real pending releases or PRs in the wild:

```bash
# 1. Audit a real release CHANGELOG vs Commits (e.g. pallets/flask):
python run_github.py changelog pallets/flask --base 3.0.0 --head 3.1.0

# 2. Audit a real GitHub Pull Request for unaddressed review comments:
python run_github.py pr tiangolo/fastapi 11500

# 3. Export real GitHub cases to offline evaluation fixtures:
python run_github.py pr tiangolo/fastapi 11500 --save evalcases/cases/case11_fastapi_real.json
```


## Switching models & providers

The agent is provider-agnostic: one env var swaps the backend, so the eval can
compare the *same* agent across models and providers — Anthropic natively, and
OpenAI / Groq / OpenRouter through one OpenAI-compatible adapter
([`src/llm.py`](src/llm.py)).

```bash
python eval.py                                   # default: anthropic / claude-opus-5
TRIAGE_PROVIDER=anthropic TRIAGE_MODEL=claude-sonnet-5 python eval.py
TRIAGE_PROVIDER=groq python eval.py              # free-tier gpt-oss-120b
TRIAGE_PROVIDER=openai TRIAGE_MODEL=gpt-4o-mini python eval.py
```

Verified live on Groq's free `gpt-oss-120b`: the full router → specialist →
verifier pipeline runs end to end, and after two fixes found this way (see
[`CHANGELOG.md`](CHANGELOG.md)) even that small model gets the hard
breaking-change case right. Only the Anthropic backend uses `output_config`
effort; the compat adapter ignores it.

## Main failure mode & hot take

**Failure mode (baseline):** with the whole artifact in one prompt, the flat
agent's errors are overwhelmingly *confident false positives* — it "finds"
plausible discrepancies that cite commits or hunks that don't say what it claims.
More context did not make it more careful; it made it more fluent at being wrong.

**Hot take:** for judgment-over-artifacts tasks, **the reliability win is not a
smarter prompt — it's making the agent unable to assert what it can't point at.**
Cheap deterministic grounding (does the cited sha exist? is the quote actually in
it?) removes a whole class of failure that no amount of prompt-tuning on the
generator reliably fixes. Verify at the seam where claims meet artifacts, and let
the generator be bold.

**Corollary, learned the hard way** (see CHANGELOG Iter 4): a verifier is only as
good as the evidence it's handed. Our first verifier rejected *correct* findings
because it judged absence claims ("no commit supports this line") from a single
cited quote — and you can't prove an absence from one artifact. Absence verdicts
need the *complement* set. The lesson: match the verifier's context to the shape
of the claim, or verification quietly becomes a false-negative machine.
