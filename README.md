# 📥 Triage Inbox — Evidence-First Multi-Agent Maintainer Copilot

[![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg)](LICENSE)
[![Precision](https://img.shields.io/badge/Precision-1.00_vs_0.69_baseline_(GPT--4o)-brightgreen.svg)](#benchmark-evidence--measured-improvement)
[![False Alarms](https://img.shields.io/badge/False_Alarms-0.0_vs_0.4_per_task-brightgreen.svg)](#benchmark-evidence--measured-improvement)
[![Benchmark F1](https://img.shields.io/badge/Agent_F1-0.82_(recall_varies_by_run)-yellow.svg)](#benchmark-evidence--measured-improvement)
[![Providers](https://img.shields.io/badge/Providers-OpenAI_|_Anthropic_|_Groq_|_OpenRouter-purple.svg)](#switching-models--providers)
[![Ground Rule #04](https://img.shields.io/badge/Human_Approval-Ground_Rule_#04_Compliant-orange.svg)](#human-in-the-loop-approval-gate)

> **Triage Inbox** is an evidence-first multi-agent system that audits software release notes and pull request reviews. Every claim is strictly grounded in physical Git artifacts and independently verified before reaching the human maintainer.

---

## 🎯 The Problem & Why It Matters

### The Monday Morning Maintainer Bottleneck
Picture an open-source maintainer or release manager on a Monday morning. The inbox contains dozens of pending items requiring small, evidence-heavy judgments:

1. **"Does the CHANGELOG actually match what shipped?"**
   - *The Danger:* A breaking change is quietly buried under *Changed*, a promised feature was reverted before tag creation, or a critical security fix was omitted. Manually diffing 50+ commit messages against raw notes is tedious, so maintainers skim — and downstream production systems break upon upgrading.
2. **"Did this PR really address its review comments?"**
   - *The Danger:* A reviewer asks for critical error handling. The author replies *"Addressed 👍"*, but their code diff only reformatted whitespace. Tired reviewers assume it was fixed and merge bug-ridden code.

### Where Flat Single-Prompt LLMs Fall Short at Repository Triage
When people first try solving this with LLMs, they dump the entire commit history or PR diff into a single prompt (**the Naive Baseline**). On our small fixtures a capable model (GPT-4o) actually recalls most real problems this way — but it **over-flags**: it asserts discrepancies it cannot ground, invents "missing docs" entries, and guesses breaking-ness from subject lines. Measured fairly, the baseline reaches **F1 = 0.86 with precision 0.82 and 0.2 false alarms per task** — good recall, but it cries wolf. The agent's job is to keep that recall while **eliminating the false alarms** (precision → 1.00), and to keep working when the artifact is a real 500-commit repo you *cannot* dump into one prompt.

> **On the old "F1 = 0.00" claim:** an earlier version of this README reported the baseline at F1 = 0.00. That number was a *scoring artifact*, not a real capability gap — the scorer matched findings on an exact subject-ref string (`changelog:1`) that only the specialist prompts were taught, so the baseline's substantively-correct findings failed to match. The scorer now canonicalizes subjects for **both** arms ([`src/scoring.py`](src/scoring.py)); re-score any saved run offline with `python rescore.py`. The honest, canonicalized numbers are used throughout below.

---

## 🧠 How Triage Inbox Solves It

```
               ┌─────────────────┐
               │   Queue Item    │ (Release CHANGELOG or PR Review)
               └────────┬────────┘
                        │
                        ▼
               ┌─────────────────┐
               │  Router Agent   │ (Classifies schema & selects specialist)
               └────────┬────────┘
                        │
                        ▼
               ┌─────────────────┐
               │Specialist Agent │ (Specialist G: Changelog / Specialist E: PR)
               └────────┬────────┘
                        │  ▲  calls on-demand tools:
                        │  │  - list_commits / get_commit
                        │  │  - get_diff_for_path / get_hunk
                        ▼  │
             ┌─────────────────────┐
             │ Discovered Findings │ (Atomic claims with cited references)
             └──────────┬──────────┘
                        │
                        ▼
             ┌─────────────────────┐
             │ Two-Layer Verifier  │
             ├─────────────────────┤
             │ Layer 1: Grounding  │ ➔ Deterministic check: does SHA & quote exist in repo?
             │ Layer 2: Soundness  │ ➔ Independent LLM audits logical reasoning & absence claims
             └──────────┬──────────┘
                        │ (Only VERIFIED findings pass)
                        ▼
             ┌─────────────────────┐
             │ Human Approval Gate │ (Ground Rule #04: Maintainer confirms/overrides)
             └──────────┬──────────┘
                        │
                        ▼
             ┌─────────────────────┐
             │ Actionable Verdict  │ [AUTO_OK] | [NEEDS_HUMAN] | [ESCALATE]
             └─────────────────────┘
```

### Purposeful Architectural Choices
| Architectural Choice | Capability | Failure Mode Neutralized |
|---|---|---|
| **On-Demand Git Tools** (`list_commits`, `get_commit`, `get_diff`) | Better Context & Tools | Dumping raw diffs invites skimming. On-demand tools force the model to drill into commit bodies where breaking changes hide and cite exact lines. |
| **Router ➔ Specialists** | Orchestration | One general prompt doing 5 tasks blurs rules (e.g. "ignore internal chore commits"). Dedicated specialists stay sharp. |
| **Layer 1: Deterministic Grounding** | Verification | Kills hallucinated citations for free: any fabricated SHA or invented quote is immediately rejected without LLM cost. |
| **Layer 2: Soundness Auditor** | Verification | A separate model checks whether the claimed discrepancy logically follows from the evidence, supplied with the complement set for absence claims. |
| **Human Approval Gate** | Safety & Sandboxing | Complies with **Ground Rule #04**: maintainers can accept, override, or escalate before verdicts are finalized. |

---

## 🏆 Benchmark Evidence & Measured Improvement

Evaluated across **10 synthetic and hard edge cases** (`evalcases/cases/`), including hidden breaking changes in commit bodies, noisy internal CI releases, cosmetic "done" replies, and partial review fixes.

### Headline Evaluation Results (OpenAI GPT-4o — 10 Cases, fairly scored)

Numbers from a live `python eval.py` run on **2026-08-31** (fresh API calls, both arms, fair scorer):

| Metric | Naive Baseline | Triage Inbox (Agent) | Measured Delta |
|---|---|---|---|
| **Primary: Problem F1** | 0.783 | **0.824** | **+0.04** |
| **Precision** | 0.692 | **1.000** | **+0.31** |
| **Recall** | **0.900** | 0.700 | −0.20 |
| **False Alarms / Task** | 0.40 | **0.00** | **−100% (Zero false alarms)** |
| **True positives / False positives** | 9 / 4 | 7 / **0** | **−4 false positives** |
| **Cost per Task (USD)** | $0.0036 | $0.0112 | +$0.0076 |

*(Reproduce: `python eval.py` re-runs the models (costs ~$0.14 on gpt-4o); `python rescore.py` re-scores the saved trajectories offline for free and reproduces this table exactly.)*

> **Key Takeaway (honest, and it survives a re-run):** the verifier's contribution is **precision**, and it is rock-solid across runs — **precision 0.69 → 1.00, false alarms 0.4 → 0.0 per task, zero false positives.** Every alert the agent raises carries verifiable evidence. The trade-off is real too: LLM outputs vary run-to-run, and on this run the agent **under-recalled** (0.70 vs the baseline's 0.90) — it stayed silent on three genuine problems rather than surface an unproven one. So the F1 edge is modest (+0.04) and recall is the dimension to watch; the *reliability* win (never crying wolf) is the durable one. An earlier run on the same suite scored the agent higher (F1 0.95, recall 0.90) — see the variance note below; the precision/false-alarm result held in both.

> **Run-to-run variance:** these are not deterministic — a second `python eval.py` will move the digits (an earlier 2026-08-30 run gave agent F1 0.95 / recall 0.90, baseline F1 0.86). The **direction is stable** (agent = perfect precision + zero false alarms; recall varies and can dip below baseline). For a tighter estimate, run the eval 3× and average. The **scale** advantage the 10-case suite understates — a real release with hundreds of commits cannot be dumped into one prompt at all — is shown in the [Live GitHub audits](#-live-real-time-open-source-github-audits).

> **Cross-model note (gpt-4o-mini):** the earlier mini table was computed under the old (unfair) scorer and has been withdrawn pending a re-run under the corrected scorer — run `TRIAGE_PROVIDER=openai TRIAGE_MODEL=gpt-4o-mini python eval.py` to regenerate it. On a weaker model the verifier's precision benefit is expected to be *larger*, since weaker generators over-flag more.

---

## 🐙 Live Real-Time Open-Source GitHub Audits

You can audit any public GitHub repository in real time using the interactive Web Dashboard or CLI:

```bash
# 1. Search and audit a real release CHANGELOG vs Git commits (e.g. pallets/flask):
python run_github.py changelog pallets/flask --base 3.0.0 --head 3.1.0

# 2. Audit a real GitHub Pull Request for unaddressed reviewer comments:
python run_github.py pr tiangolo/fastapi 11500

# 3. Export real GitHub cases to offline evaluation fixtures:
python run_github.py pr tiangolo/fastapi 11500 --save evalcases/cases/case11_fastapi_real.json
```

---

## 💻 Web Dashboard & Visual Agent Graph

The web dashboard is running at **[http://localhost:5173/](http://localhost:5173/)** with 5 purposeful views:

1. **🎬 Video & Pitch (`#/video`):** Interactive presentation suite with 5 structured teleprompter steps and 4 concrete failure-mode use cases.
2. **📥 Maintainer Queue (`#/queue`):** 10 benchmark cases with visual win pills, ground truth cards, and slide-out trajectory proof drawers.
3. **🐙 Live GitHub Scanner (`#/github`):** Real-time search bar for open-source GitHub repos with live tag/PR auto-fetching, side-by-side execution, and raw artifact inspectors.
4. **🧠 Architecture & Graph (`#/architecture`):** Interactive Multi-Agent Node Graph, Design Choices, 4 Questions, and 6-Iteration Changelog.
5. **🚀 Reproduce & CI (`#/reproduce`):** Clean-room execution guide and automated continuous triage.

---

## 🚀 Quickstart & Clean-Room Reproduction

### 1. Prerequisites & Setup
```bash
git clone https://github.com/akmalkhaniub/triage-inbox.git
cd triage-inbox
python -m venv .venv
source .venv/bin/activate    # On Windows: .venv\Scripts\activate
pip install -r requirements.txt

cp .env.example .env         # Set OPENAI_API_KEY, ANTHROPIC_API_KEY, or GROQ_API_KEY
```

### 2. Zero-Cost Offline Sanity Check
```bash
python -c "from src.fixtures import load_all; print(len(load_all('evalcases/cases')), 'cases ready')"
```

### 3. Run a Single Case (Interactive with Human Approval Gate)
```bash
python run_one.py evalcases/cases/case03_changelog_misclassified_breaking.json
```

### 4. Run the Full Benchmark Evaluation (Reproduce Headline Results)
```bash
# The headline numbers are on gpt-4o. (The default model is the cheaper
# gpt-4o-mini, so pass gpt-4o explicitly to reproduce the headline table.)
TRIAGE_MODEL=gpt-4o python eval.py
```
Outputs are written to `results/results.json`, `results/results.csv`, and all trajectory traces under `trajectories/<case>/`. Approx. runtime ~2–3 min, cost ~$0.11 for the agent arm + ~$0.03 baseline on gpt-4o.

### 5. Re-score an Existing Run Offline (Zero API Cost)
```bash
python rescore.py    # rebuilds the F1 table from saved trajectories/, writes results/results_rescored.json
```
`rescore.py` reconstructs each arm's findings from the saved traces and re-scores them with the current (fair) scorer — useful for verifying the headline table, or seeing the effect of a scorer change, without spending a cent. It re-derives the agent's `verified` flags exactly as the pipeline does (deterministic grounding **and** the recorded soundness verdicts), and reproduces the original agent score exactly (9/0/1), which is what validates the baseline numbers beside it.

---

## 🔄 Switching Models & Providers

Triage Inbox is provider-agnostic. Switch backends with one environment variable:

```bash
# OpenAI GPT-4o (primary headline; the default provider is openai)
TRIAGE_PROVIDER=openai TRIAGE_MODEL=gpt-4o python eval.py

# Anthropic Claude (native Messages API)
TRIAGE_PROVIDER=anthropic TRIAGE_MODEL=claude-opus-5 python eval.py

# Groq Free Tier (ultra-fast)
TRIAGE_PROVIDER=groq TRIAGE_MODEL=llama-3.3-70b-versatile python eval.py

# OpenRouter (can route to Claude, Gemini, Llama, …)
TRIAGE_PROVIDER=openrouter TRIAGE_MODEL=anthropic/claude-sonnet-4.5 python eval.py
```

---

## 🛡️ Human-in-the-Loop Approval Gate (Ground Rule #04)

Whenever `run_one.py` executes, it presents the agent's recommended verdict and pauses for human confirmation:

```text
━━━ HUMAN APPROVAL CHECKPOINT ━━━
  Agent recommends: [ESCALATE]
  Options:
    [y]  Accept agent recommendation (escalate)
    [h]  Override → NEEDS_HUMAN (flag for manual review)
    [e]  Override → ESCALATE (urgent attention)
    [a]  Override → AUTO_OK (approve and clear)
    [s]  Skip approval (non-interactive mode)
```
Pass `--no-approve` in CI/CD pipelines to run non-interactively.

---

## 💡 Hot Take & Retrospective Insights

1. **Hot Take:** For judgment-over-artifacts tasks, **the reliability win is not a smarter prompt — it is making the agent unable to assert what it cannot point at.** Deterministic grounding removes fabricated citations for free before any expensive model call. Verify at the seam where claims meet artifacts, and let the generator be bold.
2. **Removed Experiment:** We attempted to force strict JSON schema constraints on the generator to reduce hallucinations. It produced beautifully formatted outputs that were still factually wrong. Grounding, not formatting discipline, was the true correctness mechanism.
3. **Corollary (Learned via smoke test):** A verifier is only as good as the evidence it is handed. An absence claim (*"no commit supports this line"*) cannot be verified from a single cited quote — it requires the complement set. Match the verifier's context to the claim shape, or verification quietly becomes a false-negative machine.
