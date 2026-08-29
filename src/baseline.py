"""The fair baseline: one general-purpose agent, one prompt, no tools, no verifier.

It gets the SAME task and the SAME output contract as the full agent -- the only
things removed are the design choices we are testing (routing, on-demand tools,
verification). The whole artifact is dumped into the prompt, exactly how a
reasonable person would first attempt this with a single Claude call. Keeping the
contract identical is what makes the eval comparison fair.
"""
from __future__ import annotations
import json

from .fixtures import Fixture
from .llm import Trajectory, extract_json, run_agent
from .schema import Finding, TriageResult
from .specialists.base import parse_findings

SYSTEM = """You are a repository maintainer's assistant. You will be given one
queue item -- either a CHANGELOG to audit against commits, or a PR whose review
comments you must check against the pushed diff. Do the appropriate task.

If it is a CHANGELOG audit, report discrepancies (phantom / missing /
misclassified). If it is a PR review check, report one verdict per review
comment (addressed / partial / ignored).

Output ONLY a JSON array of findings:
[ {"verdict": "...", "subject": "...", "evidence": [{"kind":"...","ref":"...","quote":"..."}],
   "confidence": 0.0-1.0, "rationale": "..."} ]"""


def triage(fx: Fixture) -> tuple[TriageResult, list[Trajectory]]:
    user = (f"Queue item type: {fx.item_type}\nTitle: {fx.title}\n\n"
            f"Full artifact:\n{json.dumps(fx.artifact, indent=2)}")
    text, traj = run_agent(
        agent="baseline",
        item_id=fx.item_id,
        system=SYSTEM,
        user=user,
        tools=[],
    )
    findings: list[Finding] = parse_findings(extract_json(text))
    result = TriageResult(
        item_id=fx.item_id, item_type=fx.item_type, findings=findings,
        recommended_action="needs_human" if findings else "auto_ok",
        summary=f"baseline produced {len(findings)} findings (unverified).",
    )
    return result, [traj]
