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
"""
from __future__ import annotations
from dataclasses import dataclass

from .fixtures import Fixture
from .schema import Finding, TriageResult

CHANGELOG_LABELS = {"phantom", "missing", "misclassified"}
REVIEW_PROBLEM_LABELS = {"ignored", "partial"}


def _norm(ref: str) -> str:
    return ref.replace(" ", "").lower()


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
            preds.add((f.verdict, _norm(f.subject)))
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
