"""Router -- classifies a queue item and dispatches it to the right specialist.

The router sees only a lightweight preview (title + the shape of the artifact),
never the ground truth. This is the orchestration seam: adding specialist A/D/F
later is just another branch here plus a tools+specialist module -- the router,
verifier, memory, and scorer do not change.
"""
from __future__ import annotations

from .fixtures import Fixture
from .llm import Trajectory, extract_json, run_agent

KNOWN = ["changelog_audit", "review_resolution", "dep_bump", "flaky_test", "issue_triage"]

SYSTEM = f"""You route items in a repository maintainer's triage queue to the
correct specialist. Given a short preview of one item, classify it as exactly one
of: {", ".join(KNOWN)}.

Guidance:
- changelog_audit: the item is about reconciling a CHANGELOG / release notes with commits.
- review_resolution: the item is about whether a PR addressed its review comments.
- dep_bump: a dependency-version-bump PR to assess for safety.
- flaky_test: a failing CI test to judge as real-vs-flaky.
- issue_triage: a new bug report to sort as actionable / needs-info / duplicate.

Output ONLY JSON: {{"item_type": "<one of the above>", "why": "<short reason>"}}"""


def _preview(fx: Fixture) -> str:
    art = fx.artifact
    shape = {k: (f"{len(v)} items" if isinstance(v, list) else type(v).__name__)
             for k, v in art.items()}
    return (f"Title: {fx.title}\n"
            f"Artifact fields: {shape}")


def route(fx: Fixture) -> tuple[str, Trajectory]:
    text, traj = run_agent(
        agent="router",
        item_id=fx.item_id,
        system=SYSTEM,
        user="Classify this queue item:\n\n" + _preview(fx),
        tools=[],
    )
    try:
        choice = extract_json(text).get("item_type", "unknown")
    except Exception:
        choice = "unknown"
    return (choice if choice in KNOWN else "unknown"), traj
