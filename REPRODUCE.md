# Reproduction guide

For someone starting from a clean environment.

## 1. Prerequisites

- **Python 3.10+** (developed on 3.14). No third-party packages are required for
  the OpenAI-compatible providers; the `anthropic` SDK (in `requirements.txt`) is
  needed only for the default Anthropic backend.
- **An API key for the provider you run** — Anthropic by default; or OpenAI /
  Groq / OpenRouter (see § Switching provider / model). Put it in `.env`.
- Network access to that provider's API. No git, no database.

## 2. Setup

```bash
cd triage-inbox
python -m venv .venv
# Windows:  .venv\Scripts\activate
# macOS/Linux:  source .venv/bin/activate
pip install -r requirements.txt

cp .env.example .env        # then edit .env and set ANTHROPIC_API_KEY
```

Load the key into your shell (or use any dotenv loader):

```bash
# macOS/Linux
export $(grep -v '^#' .env | xargs)
# Windows PowerShell
Get-Content .env | Where-Object { $_ -notmatch '^#' -and $_ } | ForEach-Object { $p=$_.Split('=',2); [Environment]::SetEnvironmentVariable($p[0],$p[1]) }
```

## 3. Offline sanity check (no API, no cost)

Confirms the cases parse and the scorer + grounding logic work before you spend
anything:

```bash
python - <<'PY'
from src.fixtures import load_all
cases = load_all("evalcases/cases")
print(len(cases), "cases loaded:", [c.item_id for c in cases])
PY
```

## 4. Run one case (cheap — a good first live check)

```bash
python run_one.py evalcases/cases/case03_changelog_misclassified_breaking.json
```

Prints the triage result, the ground truth, and the paths of the trajectories
written under `trajectories/case03.../`. After the report, the agent pauses at a
**human approval checkpoint** (Ground Rule #04) where you can accept or override
the verdict. Pass `--no-approve` to skip in automated or CI runs. Try
`--arm baseline` to see the flat agent on the same case.

To see routing extend to a designed-but-unbuilt lane (one cheap model call — the
router — then an honest stub), run:

```bash
python run_one.py evalcases/stub_demo/dep_bump_demo.json
```

## 5. Run the full evaluation (the headline result)

```bash
python eval.py            # baseline + agent over all 10 cases
```

Writes:
- `results/results.json` — per-case + aggregate metrics, tokens, cost.
- `results/results.csv` — the Metric / Baseline / Agent / Change table.
- `trajectories/<case>/*.md` and `*.json` — every agent and baseline trajectory.

Console prints the comparison table at the end.

### Useful flags

```bash
python eval.py --limit 2          # smoke test on the first 2 cases
python eval.py --arm agent        # only the agent arm
TRIAGE_MODEL=claude-sonnet-5 python eval.py   # cheaper run (env override)
```

### Switching provider / model

Set `TRIAGE_PROVIDER` (and optionally `TRIAGE_MODEL`) to compare backends on the
same cases. You only need the API key for the provider you run.

```bash
TRIAGE_PROVIDER=anthropic  python eval.py                      # Claude (default)
TRIAGE_PROVIDER=groq       python run_one.py evalcases/cases/case01_changelog_phantom.json
TRIAGE_PROVIDER=openai TRIAGE_MODEL=gpt-4o-mini python eval.py
TRIAGE_PROVIDER=openrouter TRIAGE_MODEL=anthropic/claude-sonnet-4.5 python eval.py
```

- `anthropic` supports the effort knob (`TRIAGE_EFFORT`); the OpenAI-compatible
  providers ignore it.
- **Groq free tier** has an ~8k tokens/minute cap. `run_one.py` on a single case
  fits; the full both-arms `eval.py` will hit throttling — the adapter retries
  with backoff, so it still completes, just slowly. For a fast full run use a
  paid provider or Groq's Dev tier.

## 6. What to expect

- **Runtime:** roughly 1–3 minutes per case per arm at default effort (the agent
  arm makes several model calls: router + specialist loop + verifier; the
  baseline makes one). ~10–40 minutes for the full both-arms run, dominated by
  model latency.
- **Cost:** printed per case and totaled in `results/results.json`
  (`cost_per_task_usd`). On `claude-sonnet-5` the full run is a few US cents to a
  couple of dollars depending on effort; `claude-opus-5` is higher. Set
  `TRIAGE_MODEL=claude-sonnet-5` and `TRIAGE_EFFORT=medium` for the cheapest
  faithful run.
- **Determinism:** model outputs vary run to run. The *cases and scorer* are
  fully deterministic; expect the aggregate F1 gap between baseline and agent to
  be stable in direction even though exact digits move. For a tighter estimate,
  run the eval 3× and average `results/results.json`.

## 7. Where things live

```
src/config.py        model, effort, pricing, safety caps
src/schema.py        the Finding / Evidence / TriageResult contract
src/llm.py           the agentic loop + trajectory recorder
src/tools.py         on-demand repo tools over a case
src/router.py        item classification
src/specialists/     changelog_auditor.py (G), review_resolver.py (E)
src/verifier.py      grounding + soundness
src/agent.py         the full pipeline (solution arm)
src/baseline.py      the flat single-prompt arm
src/scoring.py       F1-over-problems, verified-only for the agent
eval.py / run_one.py entrypoints
evalcases/cases/     the 10 ground-truth cases
```
