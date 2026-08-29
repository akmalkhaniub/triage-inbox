"""Run ONE case through one arm and print the result + where the trajectory landed.

Handy for the demo/video and for eyeballing a single trajectory.

    python run_one.py evalcases/cases/case01_changelog_phantom.json
    python run_one.py evalcases/cases/case06_review_ignored.json --arm baseline
    python run_one.py evalcases/cases/case01_changelog_phantom.json --json
"""
from __future__ import annotations
import argparse
import json
import sys
from pathlib import Path

from src import agent as agent_mod
from src import baseline as baseline_mod
from src import trajectories as traj_mod
from src.fixtures import Fixture

# ANSI formatting for clean terminal presentation
BOLD = "\033[1m"
DIM = "\033[2m"
RESET = "\033[0m"
GREEN = "\033[92m"
YELLOW = "\033[93m"
RED = "\033[91m"
CYAN = "\033[96m"

ACTION_COLORS = {
    "auto_ok": f"{GREEN}[AUTO_OK]{RESET}",
    "needs_human": f"{YELLOW}[NEEDS_HUMAN]{RESET}",
    "escalate": f"{RED}[ESCALATE]{RESET}",
}


def print_rich_report(fx: Fixture, result, trajs, arm: str, traj_dir: str) -> None:
    print(f"\n{BOLD}{'=' * 72}{RESET}")
    print(f"{BOLD}  TRIAGE INBOX — CASE EXECUTION REPORT{RESET}")
    print(f"{'=' * 72}")

    print(f"{BOLD}Item ID:{RESET}   {fx.item_id}")
    print(f"{BOLD}Title:{RESET}     {fx.title}")
    print(f"{BOLD}Lane:{RESET}      {fx.item_type} ({CYAN}{arm.upper()}{RESET} arm)")

    act_badge = ACTION_COLORS.get(result.recommended_action, f"[{result.recommended_action.upper()}]")
    print(f"\n{BOLD}Verdict / Action:{RESET} {act_badge}")
    print(f"{BOLD}Summary:{RESET} {result.summary}")

    print(f"\n{BOLD}Findings ({len(result.findings)} total):{RESET}")
    if not result.findings:
        print(f"  {DIM}(No issues flagged — clean queue item){RESET}")
    else:
        for idx, f in enumerate(result.findings, 1):
            v_badge = f"{GREEN}[VERIFIED \u2713]{RESET}" if f.verified else (f"{RED}[UNVERIFIED \u2717]{RESET}" if f.verified is False else f"{DIM}[UNCHECKED]{RESET}")
            print(f"  {BOLD}{idx}. [{f.verdict.upper()}]{RESET} on {CYAN}{f.subject}{RESET} — {v_badge}")
            if f.rationale:
                print(f"     {DIM}Rationale:{RESET} {f.rationale}")
            if f.evidence:
                refs = ", ".join(f"{e.kind}:{e.ref}" for e in f.evidence)
                print(f"     {DIM}Evidence:{RESET} {refs}")
            if f.verifier_note:
                print(f"     {DIM}Verifier note:{RESET} {f.verifier_note}")

    print(f"\n{BOLD}Ground Truth:{RESET} {json.dumps(fx.ground_truth)}")

    print(f"\n{BOLD}Trajectories Saved:{RESET}")
    for t in trajs:
        md = traj_mod.dump(t, Path(traj_dir) / fx.item_id, tag=arm)
        print(f"  \u2022 {t.agent:20} \u2794 {md}")
    print(f"{BOLD}{'=' * 72}{RESET}\n")


def main() -> None:
    ap = argparse.ArgumentParser(description="Run one case through Triage Inbox agent or baseline.")
    ap.add_argument("case", help="Path to case JSON fixture")
    ap.add_argument("--arm", choices=["agent", "baseline"], default="agent", help="Arm to run: agent (default) or baseline")
    ap.add_argument("--traj", default="trajectories", help="Directory where trajectories are dumped")
    ap.add_argument("--json", action="store_true", help="Output raw JSON instead of formatted report")
    args = ap.parse_args()

    fx = Fixture.load(args.case)
    triage = agent_mod.triage if args.arm == "agent" else baseline_mod.triage
    result, trajs = triage(fx)

    if args.json:
        print(json.dumps(result.to_dict(), indent=2))
        print("\nGround truth:", json.dumps(fx.ground_truth))
        print("\nTrajectories:")
        for t in trajs:
            md = traj_mod.dump(t, Path(args.traj) / fx.item_id, tag=args.arm)
            print(f"  {t.agent:18} -> {md}")
    else:
        print_rich_report(fx, result, trajs, args.arm, args.traj)


if __name__ == "__main__":
    main()

