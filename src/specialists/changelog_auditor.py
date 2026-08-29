"""Specialist G -- CHANGELOG auditor.

Reconciles the written CHANGELOG against the actual commit range and flags three
discrepancy types, each tied to a commit or a changelog line:
  * phantom       -- a changelog line describing something no commit did
  * missing       -- a commit whose user-facing change never made the changelog
  * misclassified -- a change filed under the wrong section (esp. a breaking
                     change buried under a minor heading)
"""
from __future__ import annotations

from ..fixtures import Fixture
from ..llm import Trajectory, run_agent
from ..schema import Finding
from ..tools import changelog_tools
from .base import parse_findings

SYSTEM = """You are a release-notes auditor for a software repository.

Your job: compare the CHANGELOG **as written** against the **actual commits** in
the release, and report only the DISCREPANCIES. Do not list lines that are fine.

Discrepancy types:
- "phantom": a CHANGELOG line claims a change that no commit supports.
- "missing": a commit made a user-facing change (feat / fix / breaking) that no
  CHANGELOG line mentions. Ignore purely internal commits (chore, docs, test,
  refactor with no user impact) -- those are not expected in the changelog.
- "misclassified": a CHANGELOG line exists but sits under the wrong section for
  the commit's true impact. The most important case: a BREAKING change listed
  under an ordinary "Added"/"Fixed"/"Changed" heading instead of "Breaking".

Method:
1. Call list_commits, then read_changelog.
2. You CANNOT judge breaking-ness from a subject alone. Call get_commit to read
   the body for EVERY commit that is even possibly breaking -- specifically any
   whose subject mentions rename / remove / drop / delete / replace / change /
   migrate, and (because major releases concentrate breaking changes) every
   commit when the release version is a major bump (x.0.0). The BREAKING CHANGE
   marker usually appears only in the body.
3. Decide the discrepancies. Tie EACH to evidence: the commit sha and/or the
   changelog line, and quote the exact text you relied on.

Output ONLY a JSON array (no prose) of objects:
[
  {
    "verdict": "phantom" | "missing" | "misclassified",
    "subject": "changelog:<line>"  (for phantom/misclassified)  or  "commit:<sha>" (for missing),
    "evidence": [ {"kind": "changelog_line"|"commit", "ref": "changelog:<line>"|"commit:<sha>", "quote": "<exact text>"} ],
    "confidence": 0.0-1.0,
    "rationale": "<one sentence>"
  }
]
If there are no discrepancies, output []."""


def run(fx: Fixture) -> tuple[list[Finding], Trajectory]:
    user = (f"Audit the CHANGELOG for release {fx.artifact.get('version','?')} "
            f"of repo '{fx.artifact.get('repo','unknown')}'. Use the tools to "
            f"inspect commits and the changelog, then report discrepancies.")
    text, traj = run_agent(
        agent="changelog_auditor",
        item_id=fx.item_id,
        system=SYSTEM,
        user=user,
        tools=changelog_tools(fx),
        force_first_tool="list_commits",
    )
    from ..llm import extract_json
    findings = parse_findings(extract_json(text))
    return findings, traj
