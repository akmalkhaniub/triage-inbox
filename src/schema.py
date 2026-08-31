"""The one output contract every specialist speaks.

A specialist looks at one queue item and returns a list of Findings. Each Finding
is a single claim ("this changelog line is phantom", "review comment #3 was
ignored") bound to a piece of Evidence pointing at a real repo artifact. The
verifier re-checks each Finding against that same artifact. Because every
specialist -- current or future (A/D/F) -- returns this shape, the router,
verifier, memory, and scorer are all specialist-agnostic.
"""
from __future__ import annotations
from dataclasses import dataclass, field, asdict
from typing import Any, Literal

# Item types the router can route. G and E are implemented; the rest are stubbed
# behind this same contract to show the architecture generalizes.
ItemType = Literal[
    "changelog_audit",     # G  (implemented)
    "review_resolution",   # E  (implemented)
    "dep_bump",            # A  (stub)
    "flaky_test",          # D  (stub)
    "issue_triage",        # F  (stub)
    "unknown",
]

EvidenceKind = Literal["commit", "changelog_line", "review_comment", "diff_hunk", "file"]


@dataclass
class Evidence:
    """A pointer into a concrete repo artifact, plus the exact text it refers to."""
    kind: EvidenceKind
    ref: str          # stable id: commit sha, "changelog:12", comment id, hunk id...
    quote: str = ""   # the artifact text the claim rests on (verifier re-reads it)


@dataclass
class Finding:
    """One atomic, verdict-bearing claim about a queue item."""
    claim_id: str                       # stable id, unique within the item
    verdict: str                        # e.g. missing/misclassified/phantom, addressed/partial/ignored
    subject: str                        # what the verdict is about (a changelog line, a comment)
    evidence: list[Evidence] = field(default_factory=list)
    confidence: float = 0.5             # 0..1 the specialist's self-reported confidence
    rationale: str = ""
    # Verifier signals (set by src.verifier). Kept as two distinct layers so the
    # UI can show WHY a finding was surfaced or suppressed:
    grounded: bool | None = None        # layer 1: refs resolve AND quotes exist (deterministic)
    sound: bool | None = None           # layer 2: verdict follows from full artifact (LLM)
    verified: bool | None = None        # grounded AND sound -- the gate the scorer trusts
    verifier_note: str = ""             # human-readable reason for the decision

    def to_dict(self) -> dict[str, Any]:
        d = asdict(self)
        return d


@dataclass
class TriageResult:
    """Everything the agent concluded about one queue item."""
    item_id: str
    item_type: ItemType
    findings: list[Finding] = field(default_factory=list)
    recommended_action: str = "needs_human"   # auto_ok | needs_human | escalate
    summary: str = ""

    def to_dict(self) -> dict[str, Any]:
        return {
            "item_id": self.item_id,
            "item_type": self.item_type,
            "recommended_action": self.recommended_action,
            "summary": self.summary,
            "findings": [f.to_dict() for f in self.findings],
        }
