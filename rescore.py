"""Offline re-scorer — recompute the benchmark from SAVED trajectories, no API cost.

The eval numbers depend only on (a) each arm's findings and (b) the scorer. Both
are already on disk: `trajectories/<case>/*.json` captured every model turn when
`eval.py` last ran. This script reconstructs the findings from those traces and
re-scores them with the current `src.scoring`, so you can verify the headline
table — or see the effect of a scorer change (e.g. the subject-canonicalization
fairness fix) — without spending a cent or hitting a provider.

    python rescore.py                 # rescore all cases in trajectories/
    python rescore.py --traj trajectories --cases evalcases/cases

For the agent arm it re-derives `verified` exactly as the pipeline does:
deterministic grounding (free) AND the soundness verdicts recorded in the saved
verifier trajectory. Baseline findings are counted as-is (no verifier).
"""
from __future__ import annotations
import argparse
import json
import sys
from pathlib import Path

# Windows consoles default to cp1252, which can't encode the delta glyph below.
try:
    sys.stdout.reconfigure(encoding="utf-8")
except Exception:
    pass

from src.fixtures import Fixture
from src.llm import extract_json
from src.scoring import CaseScore, micro, score_case
from src.schema import Finding, TriageResult
from src.specialists.base import parse_findings
from src.verifier import ground

ROOT = Path(__file__).parent
SPECIALIST_AGENTS = {"changelog_auditor", "review_resolver"}


def _final_text(traj: dict) -> str:
    """The last model turn's concatenated text — the arm's final answer."""
    text = ""
    for step in traj.get("steps", []):
        if step.get("kind") == "model":
            parts = [b.get("text", "") for b in step.get("content", []) if b.get("type") == "text"]
            joined = "\n".join(p for p in parts if p)
            if joined.strip():
                text = joined
    return text


def _load_traj(path: Path) -> dict:
    return json.loads(path.read_text(encoding="utf-8"))


def _baseline_findings(case_dir: Path, item_id: str) -> list[Finding]:
    p = case_dir / f"{item_id}__baseline__baseline.json"
    if not p.exists():
        return []
    return parse_findings(extract_json(_final_text(_load_traj(p))))


def _agent_findings(case_dir: Path, item_id: str, fx: Fixture) -> list[Finding]:
    """Specialist findings with `verified` re-derived (grounding AND soundness)."""
    spec = next((case_dir / f for f in
                 (f"{item_id}__agent__{a}.json" for a in SPECIALIST_AGENTS)
                 if (case_dir / f).exists()), None)
    if spec is None:
        return []
    findings = parse_findings(extract_json(_final_text(_load_traj(spec))))

    # soundness verdicts recorded by the verifier, keyed by claim_id
    sound: dict[str, bool] = {}
    vpath = case_dir / f"{item_id}__agent__verifier.json"
    if vpath.exists():
        for v in extract_json(_final_text(_load_traj(vpath))) or []:
            if isinstance(v, dict) and "claim_id" in v:
                sound[str(v["claim_id"])] = bool(v.get("sound", False))

    for f in findings:
        grounded, _ = ground(fx, f)
        # verified iff grounded AND the soundness pass accepted it. If no verifier
        # trace exists (clean case → no findings to check), grounded alone stands.
        f.verified = grounded and sound.get(f.claim_id, True if not sound else False)
        if not sound:  # verifier never ran (nothing grounded) → grounded is the gate
            f.verified = grounded
    return findings


def main() -> None:
    ap = argparse.ArgumentParser()
    ap.add_argument("--traj", default=str(ROOT / "trajectories"))
    ap.add_argument("--cases", default=str(ROOT / "evalcases" / "cases"))
    args = ap.parse_args()

    traj_root = Path(args.traj)
    cases_dir = Path(args.cases)

    b_scores: list[CaseScore] = []
    a_scores: list[CaseScore] = []
    print(f"Re-scoring saved trajectories in {traj_root} against gold in {cases_dir}\n")

    for case_path in sorted(cases_dir.glob("*.json")):
        fx = Fixture.load(case_path)
        cdir = traj_root / fx.item_id
        if not cdir.exists():
            print(f"  (skip {fx.item_id}: no trajectories)")
            continue

        bf = _baseline_findings(cdir, fx.item_id)
        af = _agent_findings(cdir, fx.item_id, fx)
        b_res = TriageResult(item_id=fx.item_id, item_type=fx.item_type, findings=bf)
        a_res = TriageResult(item_id=fx.item_id, item_type=fx.item_type, findings=af)
        bs = score_case(fx, b_res, use_verified=False)
        as_ = score_case(fx, a_res, use_verified=True)
        b_scores.append(bs)
        a_scores.append(as_)
        print(f"  {fx.item_id:44}  baseline F1={bs.f1:.2f} (tp={bs.tp} fp={bs.fp} fn={bs.fn})"
              f"   agent F1={as_.f1:.2f} (tp={as_.tp} fp={as_.fp} fn={as_.fn})")

    bm, am = micro(b_scores), micro(a_scores)
    print("\n=== Re-scored aggregate (micro), fair canonicalized subjects ===")
    for key, label in [("f1", "Problem F1"), ("precision", "Precision"),
                       ("recall", "Recall"), ("false_alarms_per_case", "False alarms/case")]:
        print(f"  {label:20} baseline={bm[key]:.3f}   agent={am[key]:.3f}   delta={am[key]-bm[key]:+.3f}")
    print(f"\n  baseline tp/fp/fn = {bm['tp']}/{bm['fp']}/{bm['fn']}"
          f"   agent tp/fp/fn = {am['tp']}/{am['fp']}/{am['fn']}")

    out = ROOT / "results" / "results_rescored.json"
    out.parent.mkdir(parents=True, exist_ok=True)
    out.write_text(json.dumps({
        "note": "offline re-score of saved trajectories with fair subject canonicalization",
        "baseline": bm, "agent": am,
    }, indent=2), encoding="utf-8")
    print(f"\nWrote {out}")


if __name__ == "__main__":
    main()
