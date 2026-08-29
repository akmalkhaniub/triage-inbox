"""Verification pass -- the component that keeps the agent honest.

Two layers, cheapest first:
  1. Grounding (deterministic, no model cost): every piece of evidence must
     resolve to a real artifact, and its quote must actually appear there. This
     alone kills hallucinated evidence -- a fabricated commit sha or an invented
     quote fails immediately.
  2. Soundness (one LLM call per item): for findings that pass grounding, a
     second model instance checks that the verdict actually follows from the
     evidence, independent of the specialist that produced it.

A finding is `verified=True` only if it passes both. The orchestrator trusts
only verified findings when it recommends an action.
"""
from __future__ import annotations
import json
import re

from .fixtures import Fixture
from .llm import Trajectory, extract_json, run_agent
from .schema import Finding


def _norm(s: str) -> str:
    return re.sub(r"\s+", " ", s or "").strip().lower()


def resolve_ref(fx: Fixture, ref: str) -> str | None:
    """Return the artifact text a ref points at, or None if it doesn't exist."""
    try:
        kind, _, ident = ref.partition(":")
    except ValueError:
        return None
    kind, ident = kind.strip(), ident.strip()
    if kind == "changelog":
        line = fx.changelog_line(int(ident)) if ident.isdigit() else None
        return line["text"] if line else None
    if kind == "commit":
        c = fx.commit(ident)
        return f"{c['subject']} {c.get('body','')}" if c else None
    if kind == "comment":
        c = next((x for x in fx.review_comments() if x["id"] == ident), None)
        return c["body"] if c else None
    if kind == "hunk":
        h = fx.hunk(ident)
        return h.get("patch", "") if h else None
    return None


def ground(fx: Fixture, f: Finding) -> tuple[bool, str]:
    """Deterministic check: refs resolve and quotes appear in the artifact."""
    if not f.evidence:
        return False, "no evidence attached"
    for e in f.evidence:
        text = resolve_ref(fx, e.ref)
        if text is None:
            return False, f"evidence ref '{e.ref}' does not resolve to any artifact"
        if e.quote and _norm(e.quote) not in _norm(text):
            return False, f"quote for '{e.ref}' not found in the artifact (possible hallucination)"
    return True, "evidence grounded"


SOUNDNESS_SYSTEM = """You are an independent verifier. You are given the COMPLETE
artifact (all commits + changelog, or all review comments + diff hunks) plus a
list of findings to check. For each finding decide whether its verdict is
correct against the full artifact.

Judge each verdict type properly -- several are ABSENCE claims that can only be
confirmed by scanning the whole artifact, not a single quote:
- "phantom": correct iff NO commit in the full list supports that changelog line.
- "missing": correct iff the cited commit is user-facing (feat/fix/breaking) AND
  no changelog line mentions it.
- "misclassified": correct iff the changelog line sits under the wrong section
  for the commit's true impact (e.g. a BREAKING change under a non-breaking heading).
- "ignored": correct iff NO diff hunk addresses the comment.
- "partial": correct iff the diff partly addresses the comment but leaves some undone.
- "addressed": correct iff a diff hunk makes the requested change.

Output ONLY a JSON array, one object per finding, in the same order:
[ {"claim_id": "<id>", "sound": true|false, "note": "<one sentence>"} ]"""


def _artifact_context(fx: Fixture) -> dict:
    """The full (small) artifact, so absence claims are actually checkable."""
    if fx.item_type == "changelog_audit":
        return {"all_commits": fx.commits(), "all_changelog": fx.changelog()}
    if fx.item_type == "review_resolution":
        return {"all_review_comments": fx.review_comments(),
                "all_diff_hunks": fx.diff_hunks()}
    return {}


def verify(fx: Fixture, findings: list[Finding]) -> Trajectory | None:
    """Mutate findings in place, setting .verified and .verifier_note.

    Returns the soundness-check trajectory (or None if nothing to check).
    """
    grounded: list[Finding] = []
    for f in findings:
        ok, note = ground(fx, f)
        if not ok:
            f.verified, f.verifier_note = False, note
        else:
            grounded.append(f)

    if not grounded:
        return None

    payload = [{
        "claim_id": f.claim_id,
        "verdict": f.verdict,
        "rationale": f.rationale,
        "cited_evidence": [
            {"ref": e.ref, "artifact_text": resolve_ref(fx, e.ref)} for e in f.evidence
        ],
    } for f in grounded]

    user = ("FULL ARTIFACT:\n" + json.dumps(_artifact_context(fx), indent=2)
            + "\n\nFINDINGS TO VERIFY:\n" + json.dumps(payload, indent=2))
    text, traj = run_agent(
        agent="verifier",
        item_id=fx.item_id,
        system=SOUNDNESS_SYSTEM,
        user=user,
        tools=[],
    )
    try:
        verdicts = {v["claim_id"]: v for v in extract_json(text)}
    except Exception:
        verdicts = {}
    for f in grounded:
        v = verdicts.get(f.claim_id)
        if v is None:
            f.verified, f.verifier_note = False, "verifier returned no decision"
        else:
            f.verified = bool(v.get("sound", False))
            f.verifier_note = v.get("note", "")
    return traj
