"""Assemble the dashboard's data bundle from a completed eval run.

Copies results.json + every trajectory JSON into web/public/data/ and writes a
manifest the app uses to look up a case's trajectories. Run this after `python
eval.py`, then build/deploy the web app.

    python web/build_data.py            # from repo root
"""
from __future__ import annotations
import json
import shutil
from pathlib import Path

ROOT = Path(__file__).parent.parent            # triage-inbox/
WEB_DATA = ROOT / "web" / "public" / "data"
RESULTS = ROOT / "results" / "results.json"
TRAJ_SRC = ROOT / "trajectories"
CASES_SRC = ROOT / "evalcases" / "cases"

# order agents sensibly within a run
RANK = {"router": 0, "changelog_auditor": 1, "review_resolver": 1, "verifier": 2,
        "baseline": 0}


def main() -> None:
    if not RESULTS.exists():
        raise SystemExit("No results/results.json -- run `python eval.py` first.")
    WEB_DATA.mkdir(parents=True, exist_ok=True)

    shutil.copy(RESULTS, WEB_DATA / "results.json")

    # Bundle each case's ground truth + artifact so the UI can show what the
    # agent examined and what "correct" was.
    cases: dict[str, dict] = {}
    for cf in sorted(CASES_SRC.glob("*.json")):
        c = json.loads(cf.read_text(encoding="utf-8"))
        cases[c["item_id"]] = {
            "item_type": c["item_type"], "title": c.get("title", ""),
            "ground_truth": c.get("ground_truth"), "artifact": c.get("artifact"),
        }
    (WEB_DATA / "cases.json").write_text(json.dumps(cases, indent=2), encoding="utf-8")

    manifest: dict[str, dict[str, list[dict]]] = {}
    out_traj = WEB_DATA / "trajectories"
    # Clear ONLY the regenerated per-case subdirectories. Top-level files here
    # (e.g. real_gh_*.json written by live GitHub runs) are NOT rebuilt from
    # TRAJ_SRC, so a blanket rmtree would silently delete committed live-run
    # traces on every build. Preserve them.
    if out_traj.exists():
        for child in out_traj.iterdir():
            if child.is_dir():
                shutil.rmtree(child)

    for jf in sorted(TRAJ_SRC.rglob("*.json")):
        name = jf.stem                          # case__arm__agent
        parts = name.split("__")
        if len(parts) != 3:
            continue
        case, arm, agent = parts
        rel = f"trajectories/{case}/{jf.name}"
        dest = WEB_DATA / rel
        dest.parent.mkdir(parents=True, exist_ok=True)
        shutil.copy(jf, dest)
        try:
            data = json.loads(jf.read_text(encoding="utf-8"))
        except json.JSONDecodeError:
            continue
        manifest.setdefault(case, {}).setdefault(arm, []).append({
            "agent": agent, "file": rel,
            "provider": data.get("provider", ""), "model": data.get("model", ""),
            "in": data.get("input_tokens", 0), "out": data.get("output_tokens", 0),
            "steps": len(data.get("steps", [])),
        })

    for case in manifest:
        for arm in manifest[case]:
            manifest[case][arm].sort(key=lambda d: RANK.get(d["agent"], 9))

    (WEB_DATA / "manifest.json").write_text(json.dumps(manifest, indent=2),
                                            encoding="utf-8")
    n = sum(len(v) for c in manifest.values() for v in c.values())
    print(f"Wrote {WEB_DATA/'results.json'}, {WEB_DATA/'manifest.json'}, "
          f"and {n} trajectory files for {len(manifest)} cases.")


if __name__ == "__main__":
    main()
