# 📥 Triage Inbox — Evidence-First Multi-Agent Maintainer Copilot

[![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg)](LICENSE)
[![Benchmark F1](https://img.shields.io/badge/Benchmark_F1-0.95_(GPT--4o)-success.svg)](#benchmark-evidence--measured-improvement)
[![False Alarms](https://img.shields.io/badge/False_Alarms-0.0_per_task-brightgreen.svg)](#benchmark-evidence--measured-improvement)
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

### Why Flat Single-Prompt LLMs Fail at Repository Triage
When people first try solving this with LLMs, they dump the entire commit history or PR diff into a single prompt (**the Naive Baseline**). The model produces **fluent, confident hallucinations**:
- Fabricates non-existent commit SHAs and hallucinated code quotes.
- Guesses whether a change was breaking based on vague subject lines instead of drilling into commit bodies.
- Across our 10 benchmark cases, the naive baseline scored **F1 = 0.00** with **11 false alarms**.

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

### Headline Evaluation Results (OpenAI GPT-4o — 10 Cases)

| Metric | Naive Baseline | Triage Inbox (Agent) | Measured Delta |
|---|---|---|---|
| **Primary: Problem F1** | **0.000** | **0.947** | **+0.947 (+95%)** |
| **Precision** | 0.000 | **1.000 (100%)** | **+1.000** |
| **Recall** | 0.000 | **0.900 (90%)** | **+0.900** |
| **False Alarms / Task** | 1.10 | **0.00** | **−100% (Zero false alarms)** |
| **Cases Solved Perfectly (F1 = 1.0)** | 0 / 10 | **9 / 10** | **+9 cases** |
| **Cost per Task (USD)** | $0.0035 | $0.0109 | +$0.0074 |

### Cross-Model Comparison (OpenAI gpt-4o-mini — 10 Cases)

| Metric | Naive Baseline | Triage Inbox (Agent) | Measured Delta |
|---|---|---|---|
| **Problem F1** | 0.000 | **0.526** | **+0.526** |
| **Precision** | 0.000 | **0.556** | **+0.556** |
| **False Alarms / Task** | 1.40 | **0.40** | **−71%** |

> **Key Takeaway:** The naive baseline scored **0.00** across both models due to confident hallucinations. Triage Inbox achieved **0.95 F1 with zero false alarms** on GPT-4o, proving that **verification at the seam** is what turns a fluent generator into a reliable system.

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
python eval.py
```
Outputs are written to `results/results.json`, `results/results.csv`, and all 89 trajectory traces under `trajectories/<case>/`.

---

## 🔄 Switching Models & Providers

Triage Inbox is provider-agnostic. Switch backends with one environment variable:

```bash
# OpenAI GPT-4o (Primary headline)
TRIAGE_PROVIDER=openai TRIAGE_MODEL=gpt-4o python eval.py

# Anthropic Claude 3.7 Sonnet
TRIAGE_PROVIDER=anthropic TRIAGE_MODEL=claude-3-7-sonnet-20250219 python eval.py

# Groq Free Tier (Ultra-fast Llama 3.3 70B)
TRIAGE_PROVIDER=groq TRIAGE_MODEL=llama-3.3-70b-versatile python eval.py

# OpenRouter
TRIAGE_PROVIDER=openrouter TRIAGE_MODEL=anthropic/claude-3.7-sonnet python eval.py
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
