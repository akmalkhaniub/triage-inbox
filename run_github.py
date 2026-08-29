"""Triage Inbox — Live GitHub Repository CLI

Triage real open-source releases or Pull Requests directly from GitHub:

    # 1. Audit a real release CHANGELOG vs Commits:
    python run_github.py changelog pallets/flask --base 3.0.0 --head 3.1.0

    # 2. Audit a real Pull Request for unaddressed reviews:
    python run_github.py pr tiangolo/fastapi 11500

    # 3. Export real data as an offline test fixture:
    python run_github.py pr tiangolo/fastapi 11500 --save evalcases/cases/case11_fastapi_real.json
"""
from __future__ import annotations
import argparse
import json
from pathlib import Path

from src import agent as agent_mod
from src import baseline as baseline_mod
from src import trajectories as traj_mod
from src.github import fetch_pr_fixture, fetch_release_fixture
from run_one import print_rich_report


def main() -> None:
    ap = argparse.ArgumentParser(description="Run Triage Inbox on live open-source GitHub repos.")
    subparsers = ap.add_subparsers(dest="command", required=True)

    # changelog audit subcommand
    p_cl = subparsers.add_parser("changelog", help="Audit a real GitHub release changelog against git commits")
    p_cl.add_argument("repo", help="GitHub repo in 'owner/repo' format (e.g. pallets/flask)")
    p_cl.add_argument("--base", required=True, help="Base release tag (e.g. 3.0.0)")
    p_cl.add_argument("--head", required=True, help="Head release tag (e.g. 3.1.0)")
    p_cl.add_argument("--file", default="CHANGELOG.md", help="Path to CHANGELOG in repo (default: CHANGELOG.md)")
    p_cl.add_argument("--arm", choices=["agent", "baseline"], default="agent")
    p_cl.add_argument("--save", help="Optional path to save fetched data as a JSON fixture")

    # PR review resolution subcommand
    p_pr = subparsers.add_parser("pr", help="Audit a real GitHub PR to verify review comments are addressed")
    p_pr.add_argument("repo", help="GitHub repo in 'owner/repo' format (e.g. tiangolo/fastapi)")
    p_pr.add_argument("pr_number", type=int, help="Pull Request number (e.g. 11500)")
    p_pr.add_argument("--arm", choices=["agent", "baseline"], default="agent")
    p_pr.add_argument("--save", help="Optional path to save fetched data as a JSON fixture")

    args = ap.parse_args()

    print(f"Fetching live data from GitHub for {args.repo}...")
    if args.command == "changelog":
        fx = fetch_release_fixture(args.repo, args.base, args.head, args.file)
    elif args.command == "pr":
        fx = fetch_pr_fixture(args.repo, args.pr_number)

    if args.save:
        save_path = Path(args.save)
        save_path.parent.mkdir(parents=True, exist_ok=True)
        save_path.write_text(json.dumps(fx.raw, indent=2), encoding="utf-8")
        print(f"Saved fixture to: {save_path}")

    print(f"Running triage ({args.arm} arm)...")
    triage = agent_mod.triage if args.arm == "agent" else baseline_mod.triage
    result, trajs = triage(fx)

    print_rich_report(fx, result, trajs, args.arm, "trajectories")


if __name__ == "__main__":
    main()
