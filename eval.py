"""Run the baseline and the agent over every eval case, score both, and write
the comparison. This is the single command that produces the Measured
Improvement evidence.

    python eval.py                 # all cases, both arms
    python eval.py --cases evalcases/cases --arm both
    python eval.py --limit 2       # smoke test on the first 2 cases

Outputs:
    results/results.json   full per-case + aggregate metrics and token/cost
    results/results.csv    the headline table (metric, baseline, agent, change)
    trajectories/<case>/   every agent + baseline trajectory as .md and .json
"""
from __future__ import annotations
import argparse
import csv
import json
import sys
from pathlib import Path

# Windows consoles default to cp1252, which can't encode the delta glyph below.
try:
    sys.stdout.reconfigure(encoding="utf-8")
except Exception:
    pass

from src import agent as agent_mod
from src import baseline as baseline_mod
from src import config
from src import trajectories as traj_mod
from src.fixtures import load_all
from src.scoring import CaseScore, gold_problems, micro, score_case

ROOT = Path(__file__).parent


def _cost(in_tok: int, out_tok: int) -> float:
    p = config.PRICING.get(config.MODEL, {"input": 0.0, "output": 0.0})
    return in_tok / 1e6 * p["input"] + out_tok / 1e6 * p["output"]


def run_arm(fx, arm: str):
    if arm == "agent":
        result, trajs = agent_mod.triage(fx)
    else:
        result, trajs = baseline_mod.triage(fx)
    in_tok = sum(t.input_tokens for t in trajs)
    out_tok = sum(t.output_tokens for t in trajs)
    return result, trajs, in_tok, out_tok


def main() -> None:
    ap = argparse.ArgumentParser()
    ap.add_argument("--cases", default=str(ROOT / "evalcases" / "cases"))
    ap.add_argument("--arm", choices=["both", "agent", "baseline"], default="both")
    ap.add_argument("--limit", type=int, default=0, help="only first N cases (smoke test)")
    ap.add_argument("--out", default=str(ROOT / "results"))
    ap.add_argument("--traj", default=str(ROOT / "trajectories"))
    args = ap.parse_args()

    fixtures = load_all(args.cases)
    if args.limit:
        fixtures = fixtures[: args.limit]
    arms = ["baseline", "agent"] if args.arm == "both" else [args.arm]

    per_case: dict[str, dict] = {}
    scores: dict[str, list[CaseScore]] = {a: [] for a in arms}
    tokens: dict[str, dict[str, int]] = {a: {"in": 0, "out": 0} for a in arms}

    print(f"Provider: {config.PROVIDER}  Model: {config.MODEL} "
          f"(effort={config.EFFORT}, applies to anthropic only)  "
          f"cases={len(fixtures)}  arms={arms}\n")

    for fx in fixtures:
        per_case[fx.item_id] = {"item_type": fx.item_type, "title": fx.title}
        for arm in arms:
            try:
                result, trajs, in_tok, out_tok = run_arm(fx, arm)
                sc = score_case(fx, result, use_verified=(arm == "agent"))
                action, err = result.recommended_action, None
            except Exception as e:  # one flaky case must not abort the whole run
                trajs, in_tok, out_tok = [], 0, 0
                n_gold = len(gold_problems(fx))
                sc = CaseScore(fx.item_id, fx.item_type, tp=0, fp=0, fn=n_gold)
                action, err = "error", str(e)[:200]
                print(f"  [{arm:8}] {fx.item_id}: ERROR ({err})")
            scores[arm].append(sc)
            tokens[arm]["in"] += in_tok
            tokens[arm]["out"] += out_tok
            for t in trajs:
                traj_mod.dump(t, Path(args.traj) / fx.item_id, tag=arm)
            per_case[fx.item_id][arm] = {
                "precision": round(sc.precision, 3), "recall": round(sc.recall, 3),
                "f1": round(sc.f1, 3), "tp": sc.tp, "fp": sc.fp, "fn": sc.fn,
                "action": action, "error": err,
                "tokens": {"in": in_tok, "out": out_tok}, "cost_usd": round(_cost(in_tok, out_tok), 4),
            }
            if err is None:
                print(f"  [{arm:8}] {fx.item_id}: F1={sc.f1:.2f} "
                      f"(tp={sc.tp} fp={sc.fp} fn={sc.fn})  ${_cost(in_tok, out_tok):.4f}")

    agg = {}
    for arm in arms:
        m = micro(scores[arm])
        n = len(scores[arm])
        m["cost_per_task_usd"] = round(_cost(tokens[arm]["in"], tokens[arm]["out"]) / n, 4) if n else 0.0
        m["total_cost_usd"] = round(_cost(tokens[arm]["in"], tokens[arm]["out"]), 4)
        agg[arm] = m

    out_dir = Path(args.out)
    out_dir.mkdir(parents=True, exist_ok=True)
    (out_dir / "results.json").write_text(json.dumps({
        "model": config.MODEL, "effort": config.EFFORT,
        "n_cases": len(fixtures), "aggregate": agg, "per_case": per_case,
    }, indent=2), encoding="utf-8")

    # Headline comparison table (the brief's Metric / Baseline / Agent / Change).
    print("\n=== Aggregate (micro over all cases) ===")
    rows = [("Primary: problem F1", "f1", "{:.3f}"),
            ("Precision", "precision", "{:.3f}"),
            ("Recall", "recall", "{:.3f}"),
            ("False alarms / case", "false_alarms_per_case", "{:.2f}"),
            ("Cost per task (USD)", "cost_per_task_usd", "${:.4f}")]
    csv_rows = [("metric", "baseline", "agent", "change")]
    for label, key, fmt in rows:
        b = agg.get("baseline", {}).get(key)
        a = agg.get("agent", {}).get(key)
        bs = fmt.format(b) if b is not None else "-"
        as_ = fmt.format(a) if a is not None else "-"
        change = ""
        if b is not None and a is not None:
            change = f"{a - b:+.3f}" if not fmt.startswith("$") else f"${a - b:+.4f}"
        print(f"  {label:24} baseline={bs:>10}  agent={as_:>10}  Δ={change}")
        csv_rows.append((label, bs, as_, change))
    with (out_dir / "results.csv").open("w", newline="", encoding="utf-8") as f:
        csv.writer(f).writerows(csv_rows)

    print(f"\nWrote {out_dir/'results.json'} and {out_dir/'results.csv'}")
    print(f"Trajectories under {args.traj}/<case>/")


if __name__ == "__main__":
    main()
