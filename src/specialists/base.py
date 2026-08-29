"""Shared helpers so every specialist emits the same Finding shape."""
from __future__ import annotations
from typing import Any

from ..schema import Evidence, Finding


def parse_findings(raw: Any) -> list[Finding]:
    """Turn the model's JSON (a list of finding dicts) into Finding objects.

    Tolerant of missing optional keys so a slightly-off model response still
    produces scorable findings rather than crashing the run.
    """
    if isinstance(raw, dict):
        raw = raw.get("findings", raw.get("discrepancies", []))
    findings: list[Finding] = []
    for i, d in enumerate(raw or []):
        ev = [
            Evidence(
                kind=e.get("kind", "file"),
                ref=str(e.get("ref", "")),
                quote=e.get("quote", ""),
            )
            for e in d.get("evidence", [])
        ]
        subject = str(d.get("subject", d.get("ref", f"finding_{i}")))
        findings.append(Finding(
            claim_id=subject,
            verdict=str(d.get("verdict", "")).lower().strip(),
            subject=subject,
            evidence=ev,
            confidence=float(d.get("confidence", 0.5)),
            rationale=d.get("rationale", ""),
        ))
    return findings
