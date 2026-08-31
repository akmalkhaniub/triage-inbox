"""Scoring: one primary metric, applied identically to baseline and agent.

Both task types reduce to the same question a maintainer cares about: *did we
flag the real problems, with the right label, without crying wolf?* So the
primary metric is F1 over correctly-labelled problems.

  changelog_audit   problem = a discrepancy (phantom / missing / misclassified)
  review_resolution problem = a comment that is NOT fully addressed (ignored / partial)

Crucially, for the agent we count a finding as "flagged" ONLY if the verifier
passed it. That is what lets the verifier show up in the score: a hallucinated
finding that fails grounding is never counted as a flag, so it cannot create a
false positive. The baseline has no verifier, so all its findings count.

Fairness note (subject canonicalization)
-----------------------------------------
Gold subjects use a fixed ref convention (``changelog:<line>``, ``commit:<sha>``,
``comment:<id>``). Only the specialist prompts are told that convention; the
baseline prompt is not, so the baseline naturally emits a free-text subject (the
commit's message, or the comment body). Matching on the raw string therefore
punished the baseline for a *format* difference, not a *capability* difference,
and inflated the measured gap. `canonical_subject` resolves any finding's
subject+evidence back to the gold ref form, and is applied to BOTH arms
identically. It is idempotent on already-canonical refs, so the agent's score is
unchanged; the baseline is now credited for findings it actually got right.
"""
from __future__ import annotations
import re
from dataclasses import dataclass

from .fixtures import Fixture
from .schema import Finding, TriageResult

CHANGELOG_LABELS = {"phantom", "missing", "misclassified"}
REVIEW_PROBLEM_LABELS = {"ignored", "partial"}


def _norm(ref: str) -> str:
    return ref.replace(" ", "").lower()


def _text(s: str) -> str:
    """Whitespace-collapsed, lowercased text for fuzzy containment checks."""
    return re.sub(r"\s+", " ", s or "").strip().lower()


def _finding_blob(f: Finding) -> str:
    """All strings a finding exposes: subject + every evidence ref and quote."""
    parts = [f.subject]
    for e in f.evidence:
        parts.append(e.ref)
        parts.append(e.quote)
    return " ".join(p for p in parts if p)


def _canonical_changelog_subject(fx: Fixture, f: Finding) -> str:
    """Resolve a changelog finding's subject to ``changelog:<line>`` / ``commit:<sha>``.

    Gold convention: phantom/misclassified point at a changelog line, missing
    points at a commit. We look through the subject AND the cited evidence for a
    known commit sha or a changelog line (by explicit ``line N`` / ``changelog:N``
    or by matching the line's exact text).
    """
    blob = _finding_blob(f)
    blob_l = blob.lower()
    nblob = _text(blob)

    # commit ref: any known sha mentioned anywhere in the finding
    commit_ref = None
    for c in fx.commits():
        sha = str(c.get("sha", ""))
        if sha and sha.lower() in blob_l:
            commit_ref = f"commit:{sha}"
            break

    # changelog line ref: explicit number, else exact line-text match
    cl_ref = None
    m = re.search(r"(?:changelog|line)\D{0,3}(\d+)", blob, re.I)
    if m and fx.changelog_line(int(m.group(1))):
        cl_ref = f"changelog:{int(m.group(1))}"
    else:
        for l in fx.changelog():
            lt = _text(l.get("text", ""))
            if lt and lt in nblob:
                cl_ref = f"changelog:{l['line']}"
                break

    if f.verdict == "missing":
        return commit_ref or f.subject
    # phantom / misclassified live on a changelog line
    return cl_ref or commit_ref or f.subject


def _canonical_review_subject(fx: Fixture, f: Finding) -> str:
    """Resolve a review finding's subject to ``comment:<id>``."""
    blob = _finding_blob(f)
    blob_l = blob.lower()
    nblob = _text(blob)
    for c in fx.review_comments():
        cid = str(c.get("id", ""))
        if cid and (cid.lower() in blob_l):
            return f"comment:{cid}"
    # fall back to matching the comment body text
    for c in fx.review_comments():
        body = _text(c.get("body", ""))
        if body and body in nblob:
            return f"comment:{c.get('id','')}"
    return f.subject


def canonical_subject(fx: Fixture, f: Finding) -> str:
    """Map a finding's subject to the gold ref convention (arm-agnostic)."""
    if fx.item_type == "changelog_audit":
        return _canonical_changelog_subject(fx, f)
    if fx.item_type == "review_resolution":
        return _canonical_review_subject(fx, f)
    return f.subject


def gold_problems(fx: Fixture) -> set[tuple[str, str]]:
    if fx.item_type == "changelog_audit":
        return {(d["type"], _norm(d["ref"])) for d in fx.ground_truth}
    if fx.item_type == "review_resolution":
        return {(v, _norm(f"comment:{cid}"))
                for cid, v in fx.ground_truth.items() if v in REVIEW_PROBLEM_LABELS}
    return set()


def predicted_problems(fx: Fixture, findings: list[Finding], *, use_verified: bool) -> set[tuple[str, str]]:
    labels = CHANGELOG_LABELS if fx.item_type == "changelog_audit" else REVIEW_PROBLEM_LABELS
    preds = set()
    for f in findings:
        if use_verified and not f.verified:
            continue
        if f.verdict in labels:
            preds.add((f.verdict, _norm(canonical_subject(fx, f))))
    return preds


@dataclass
class CaseScore:
    item_id: str
    item_type: str
    tp: int
    fp: int
    fn: int

    @property
    def precision(self) -> float:
        return self.tp / (self.tp + self.fp) if (self.tp + self.fp) else 1.0

    @property
    def recall(self) -> float:
        return self.tp / (self.tp + self.fn) if (self.tp + self.fn) else 1.0

    @property
    def f1(self) -> float:
        p, r = self.precision, self.recall
        return 2 * p * r / (p + r) if (p + r) else 0.0


def score_case(fx: Fixture, result: TriageResult, *, use_verified: bool) -> CaseScore:
    gold = gold_problems(fx)
    pred = predicted_problems(fx, result.findings, use_verified=use_verified)
    tp = len(gold & pred)
    fp = len(pred - gold)
    fn = len(gold - pred)
    return CaseScore(fx.item_id, fx.item_type, tp, fp, fn)


def micro(scores: list[CaseScore]) -> dict[str, float]:
    tp = sum(s.tp for s in scores)
    fp = sum(s.fp for s in scores)
    fn = sum(s.fn for s in scores)
    p = tp / (tp + fp) if (tp + fp) else 1.0
    r = tp / (tp + fn) if (tp + fn) else 1.0
    f1 = 2 * p * r / (p + r) if (p + r) else 0.0
    return {"tp": tp, "fp": fp, "fn": fn, "precision": p, "recall": r, "f1": f1,
            "false_alarms_per_case": fp / len(scores) if scores else 0.0}
