"""The full triage agent: router -> specialist -> verifier -> recommendation.

This is the "solution" arm of the eval. Its improvement over the baseline comes
entirely from the design choices the brief names: a router that picks the right
specialist, tools that fetch artifacts on demand, and a verifier that discards
ungrounded or unsound findings before they reach the recommendation.
"""
from __future__ import annotations

from .fixtures import Fixture
from .llm import Trajectory
from .router import route
from .schema import Finding, TriageResult
from .specialists import changelog_auditor, review_resolver, stubs
from .verifier import verify

# item_type -> specialist runner. Implemented lanes only; stub lanes (A/D/F)
# are handled via specialists.stubs to keep the extension seam explicit.
SPECIALISTS = {
    "changelog_audit": changelog_auditor.run,
    "review_resolution": review_resolver.run,
}


import re

_BREAKING = re.compile(r"\bbreak(?:ing|s)?\b", re.I)


def _mentions_breaking(f: Finding) -> bool:
    """True if the finding's own rationale or cited evidence signals a breaking change."""
    if _BREAKING.search(f.rationale or ""):
        return True
    return any(_BREAKING.search(e.quote or "") for e in f.evidence)


def _recommend(findings: list[Finding]) -> str:
    """Turn verified findings into an action for the human maintainer."""
    verified = [f for f in findings if f.verified]
    if not verified:
        return "auto_ok"
    # A verified breaking-change misclassification or an ignored comment is severe.
    # Detect "breaking" on word boundaries in the rationale OR the cited evidence,
    # so a breaking marker that lives only in the commit body still escalates.
    severe = any(
        (f.verdict == "misclassified" and _mentions_breaking(f))
        or f.verdict == "ignored"
        for f in verified
    )
    return "escalate" if severe else "needs_human"


def triage(fx: Fixture) -> tuple[TriageResult, list[Trajectory]]:
    trajectories: list[Trajectory] = []

    routed, r_traj = route(fx)
    trajectories.append(r_traj)

    runner = SPECIALISTS.get(routed)
    if runner is None:
        if stubs.is_stub(routed):
            # Routed to a designed-but-not-built lane (A/D/F) -- honest no-op.
            result, s_traj = stubs.stub_result(fx, routed)
            trajectories.append(s_traj)
            return result, trajectories
        return (TriageResult(
            item_id=fx.item_id, item_type=routed,
            recommended_action="needs_human",
            summary=f"Router could not classify this item (got '{routed}').",
        ), trajectories)

    findings, s_traj = runner(fx)
    trajectories.append(s_traj)

    v_traj = verify(fx, findings)
    if v_traj is not None:
        trajectories.append(v_traj)

    action = _recommend(findings)
    n_ver = sum(1 for f in findings if f.verified)
    result = TriageResult(
        item_id=fx.item_id, item_type=routed, findings=findings,
        recommended_action=action,
        summary=f"{n_ver}/{len(findings)} findings verified; action={action}.",
    )
    return result, trajectories
