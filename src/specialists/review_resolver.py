"""Specialist E -- review-comment resolver.

For each reviewer comment on a PR, decides whether the author's pushed diff
actually resolved it:
  * addressed -- the diff makes the change the comment asked for
  * partial   -- the diff moves toward it but leaves part unaddressed
  * ignored   -- no diff hunk addresses the comment (a "done" reply with a
                 cosmetic or unrelated change counts as ignored)
Every verdict is tied to the diff hunk (or its absence) that justifies it.
"""
from __future__ import annotations

from ..fixtures import Fixture
from ..llm import Trajectory, extract_json, run_agent
from ..schema import Finding
from ..tools import review_tools
from .base import parse_findings

SYSTEM = """You verify whether a pull request actually addressed its review comments.

You are given a PR's reviewer comments and the diff the author pushed in
response. For EACH comment, decide one verdict:
- "addressed": a diff hunk makes exactly the change the comment requested.
- "partial": the diff moves toward the request but leaves part of it undone.
- "ignored": no pushed hunk addresses the comment. A reply of "done" with only
  a cosmetic/unrelated change is still "ignored" -- judge the code, not claims.

Method:
1. Call list_review_comments.
2. For each comment, call get_diff_for_path on the comment's file to see what
   actually changed there; call get_hunk for detail if needed.
3. Judge each comment against the real diff. Tie the verdict to evidence: the
   hunk id and a quote of the changed lines (or note that no hunk touches it).

Output ONLY a JSON array (no prose), exactly one object per review comment:
[
  {
    "verdict": "addressed" | "partial" | "ignored",
    "subject": "comment:<id>",
    "evidence": [ {"kind": "diff_hunk"|"review_comment", "ref": "hunk:<id>"|"comment:<id>", "quote": "<exact text>"} ],
    "confidence": 0.0-1.0,
    "rationale": "<one sentence>"
  }
]"""


def run(fx: Fixture) -> tuple[list[Finding], Trajectory]:
    user = (f"Review PR '{fx.artifact.get('pr_title','?')}'. For every reviewer "
            f"comment, use the tools to check the pushed diff and decide whether "
            f"it was addressed, partial, or ignored.")
    text, traj = run_agent(
        agent="review_resolver",
        item_id=fx.item_id,
        system=SYSTEM,
        user=user,
        tools=review_tools(fx),
        force_first_tool="list_review_comments",
    )
    findings = parse_findings(extract_json(text))
    return findings, traj
