"""Tiny JSON-file memory shared across triage runs.

Purpose in the design: carry a repo's recurring facts forward so the agent does
not re-derive them every run and can flag known patterns (e.g. "this section
heading has been misused before"). It is deliberately a plain file -- inspectable
and reproducible, no database. The eval runs with a fresh (empty) memory unless
seeded, so memory never leaks ground truth between cases.
"""
from __future__ import annotations
import json
from pathlib import Path
from typing import Any


class Memory:
    def __init__(self, path: str | Path):
        self.path = Path(path)
        self.data: dict[str, Any] = {}
        if self.path.exists():
            self.data = json.loads(self.path.read_text(encoding="utf-8"))

    def notes_for(self, repo: str) -> list[str]:
        return self.data.get(repo, {}).get("notes", [])

    def remember(self, repo: str, note: str) -> None:
        self.data.setdefault(repo, {}).setdefault("notes", [])
        if note not in self.data[repo]["notes"]:
            self.data[repo]["notes"].append(note)

    def save(self) -> None:
        self.path.parent.mkdir(parents=True, exist_ok=True)
        self.path.write_text(json.dumps(self.data, indent=2), encoding="utf-8")
