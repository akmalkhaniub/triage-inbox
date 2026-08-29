"""Stub lanes A / D / F — implemented only far enough to prove the seam.

These are the other three triage lanes from the design. They are intentionally
NOT built out: the hackathon deep-dive is G (changelog) and E (review). What
matters here is that adding a lane is *only* (a) a tools module over the fixture
and (b) a specialist `run()` returning the same `Finding` shape — the router,
verifier, memory, and scorer never change. Each stub below carries the real
design intent so the extension path is concrete, and returns an honest
"not-yet-implemented" result rather than pretending to triage.

To promote a stub to a real lane:
  1. add a tools factory in ../tools.py for its artifact shape,
  2. replace `run()` here (or add a module) with a specialist prompt + loop,
  3. register it in agent.SPECIALISTS.
Nothing else moves.
"""
from __future__ import annotations

from ..fixtures import Fixture
from ..llm import Step, Trajectory
from ..schema import Finding, TriageResult

# item_type -> (human title, what the real specialist would decide)
LANES: dict[str, dict[str, str]] = {
    "dep_bump": {
        "title": "Dependency-bump safety (lane A)",
        "intent": "Given a dependency-version-bump PR, decide merge / hold / "
                  "escalate by reading the dependency's changelog, checking "
                  "whether the changed API surface is used in this repo, and "
                  "whether tests cover it. Verdicts: safe / risky / breaking, "
                  "each tied to a changelog entry or a call site.",
    },
    "flaky_test": {
        "title": "Flaky-vs-real test triage (lane D)",
        "intent": "Given a failing CI test, decide real-regression / flaky / "
                  "quarantine by reading the test, the triggering diff, and its "
                  "failure history, then re-running in isolation. Each verdict "
                  "tied to a run result or the offending diff hunk.",
    },
    "issue_triage": {
        "title": "Bug-report actionability triage (lane F)",
        "intent": "Given a new issue, decide actionable / needs-info / duplicate "
                  "by checking repro steps against the repo and searching "
                  "existing issues for a true duplicate. Each verdict tied to the "
                  "missing field or the matching issue.",
    },
}


def is_stub(item_type: str) -> bool:
    return item_type in LANES


def stub_result(fx: Fixture, item_type: str) -> tuple[TriageResult, Trajectory]:
    """Honest no-op: routes correctly, does no fake work, explains the lane."""
    lane = LANES[item_type]
    traj = Trajectory(agent=f"stub:{item_type}", item_id=fx.item_id, system="(stub lane)")
    traj.steps.append(Step("model", {
        "step": 0, "stop_reason": "end_turn",
        "content": [{"type": "text",
                     "text": f"Lane '{item_type}' ({lane['title']}) is stubbed in "
                             f"this build. Intended behavior: {lane['intent']}"}],
    }))
    result = TriageResult(
        item_id=fx.item_id, item_type=item_type,
        findings=[],  # no fabricated findings from a stub lane
        recommended_action="needs_human",
        summary=f"Routed to stubbed lane '{item_type}'. {lane['title']}: not "
                f"implemented in this build (deep-dive is G + E).",
    )
    return result, traj
