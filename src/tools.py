"""Repo-inspection tools, built fresh over one loaded Fixture.

These are the "better tools" lever from the brief: instead of dumping the whole
artifact into the prompt, the agent pulls exactly the slice it needs (a commit
body, one changelog line, the diff hunks touching a file). That keeps context
small and, more importantly, forces every claim to be tied to a fetched
artifact -- which is what the verifier later re-checks.
"""
from __future__ import annotations
import json
from typing import Callable

from .fixtures import Fixture
from .llm import Tool


def _wrap(fn: Callable[..., object]) -> Callable[[dict], str]:
    def inner(inp: dict) -> str:
        out = fn(**inp)
        return out if isinstance(out, str) else json.dumps(out, indent=2)
    return inner


def changelog_tools(fx: Fixture) -> list[Tool]:
    """Tools for a changelog_audit item (specialist G)."""

    def list_commits() -> list[dict]:
        # summary view: sha + type + subject only (agent drills in as needed)
        return [{"sha": c["sha"], "type": c["type"], "subject": c["subject"]}
                for c in fx.commits()]

    def get_commit(sha: str) -> dict | str:
        c = fx.commit(sha)
        return c if c else f"Error: no commit {sha}"

    def read_changelog() -> list[dict]:
        return fx.changelog()

    return [
        Tool("list_commits",
             "List every commit in this release range (sha, type, subject). Call first.",
             {"type": "object", "properties": {}, "additionalProperties": False},
             _wrap(list_commits)),
        Tool("get_commit",
             "Get the full commit (including body) for one sha, to judge its true impact.",
             {"type": "object", "properties": {"sha": {"type": "string"}},
              "required": ["sha"], "additionalProperties": False},
             _wrap(get_commit)),
        Tool("read_changelog",
             "Read the CHANGELOG entries as written (line number, section, text).",
             {"type": "object", "properties": {}, "additionalProperties": False},
             _wrap(read_changelog)),
    ]


def review_tools(fx: Fixture) -> list[Tool]:
    """Tools for a review_resolution item (specialist E)."""

    def list_review_comments() -> list[dict]:
        return [{"id": c["id"], "path": c["path"], "line": c.get("line"),
                 "body": c["body"]} for c in fx.review_comments()]

    def get_diff_for_path(path: str) -> list[dict] | str:
        hunks = fx.hunks_for_path(path)
        return hunks if hunks else f"No diff hunks touch {path}"

    def get_hunk(hunk_id: str) -> dict | str:
        h = fx.hunk(hunk_id)
        return h if h else f"Error: no hunk {hunk_id}"

    return [
        Tool("list_review_comments",
             "List the reviewer's comments on this PR (id, path, line, body). Call first.",
             {"type": "object", "properties": {}, "additionalProperties": False},
             _wrap(list_review_comments)),
        Tool("get_diff_for_path",
             "Get the diff hunks the author pushed that touch a given file path.",
             {"type": "object", "properties": {"path": {"type": "string"}},
              "required": ["path"], "additionalProperties": False},
             _wrap(get_diff_for_path)),
        Tool("get_hunk",
             "Get one diff hunk in full by its id.",
             {"type": "object", "properties": {"hunk_id": {"type": "string"}},
              "required": ["hunk_id"], "additionalProperties": False},
             _wrap(get_hunk)),
    ]


def tools_for(fx: Fixture) -> list[Tool]:
    if fx.item_type == "changelog_audit":
        return changelog_tools(fx)
    if fx.item_type == "review_resolution":
        return review_tools(fx)
    return []
