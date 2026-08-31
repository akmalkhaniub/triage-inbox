"""Loads a self-contained eval case and exposes typed accessors.

A case is one JSON file (see evalcases/cases/*.json). It holds the repo
artifacts the agent may inspect plus the hidden ground truth used only by the
scorer -- the agent never sees `ground_truth`. Keeping cases as pure data (no
git, no network) is what makes the eval deterministic and reproducible from a
clean environment.
"""
from __future__ import annotations
import json
from dataclasses import dataclass
from pathlib import Path
from typing import Any


@dataclass
class Fixture:
    path: Path
    raw: dict[str, Any]

    @classmethod
    def load(cls, path: str | Path) -> "Fixture":
        path = Path(path)
        return cls(path=path, raw=json.loads(path.read_text(encoding="utf-8")))

    # --- identity ---------------------------------------------------------
    @property
    def item_id(self) -> str:
        return self.raw["item_id"]

    @property
    def item_type(self) -> str:
        return self.raw["item_type"]

    @property
    def title(self) -> str:
        return self.raw.get("title", "")

    @property
    def artifact(self) -> dict[str, Any]:
        return self.raw["artifact"]

    @property
    def ground_truth(self) -> Any:
        return self.raw["ground_truth"]

    # --- changelog_audit accessors (used by tools) ------------------------
    def commits(self) -> list[dict[str, Any]]:
        return self.artifact.get("commits", [])

    def changelog(self) -> list[dict[str, Any]]:
        cl = self.artifact.get("changelog")
        if isinstance(cl, list) and cl and isinstance(cl[0], dict) and "line" in cl[0]:
            return cl
        # Reconstruct line-by-line changelog structure if stored as preview or string
        text = self.artifact.get("changelog_preview") or self.artifact.get("changelog_text") or (cl if isinstance(cl, str) else "")
        if text:
            lines = []
            heading = "General"
            for i, line in enumerate(text.splitlines(), start=1):
                s = line.strip()
                if s.startswith("#"):
                    heading = s.lstrip("#").strip()
                lines.append({"line": i, "text": line, "heading": heading})
            return lines
        return []

    def commit(self, sha: str) -> dict[str, Any] | None:
        target = sha.strip().lower()
        return next((c for c in self.commits() if 
                     c.get("sha", "").lower() == target or 
                     c.get("sha", "").lower().startswith(target) or
                     c.get("full_sha", "").lower().startswith(target) or
                     target.startswith(c.get("sha", "").lower())), None)

    def changelog_line(self, n: int) -> dict[str, Any] | None:
        return next((l for l in self.changelog() if l["line"] == n), None)

    # --- review_resolution accessors --------------------------------------
    def review_comments(self) -> list[dict[str, Any]]:
        return self.artifact.get("review_comments", [])

    def diff_hunks(self) -> list[dict[str, Any]]:
        return self.artifact.get("diff_hunks", [])

    def hunks_for_path(self, path: str) -> list[dict[str, Any]]:
        return [h for h in self.diff_hunks() if h.get("path") == path]

    def hunk(self, hunk_id: str) -> dict[str, Any] | None:
        return next((h for h in self.diff_hunks() if h["id"] == hunk_id), None)


def load_all(cases_dir: str | Path) -> list[Fixture]:
    cases_dir = Path(cases_dir)
    return [Fixture.load(p) for p in sorted(cases_dir.glob("*.json"))]
