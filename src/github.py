"""GitHub Live Fetcher — Ingest real open-source repos into Triage Inbox.

Fetches real GitHub PRs and releases/tags via GitHub's public REST API (with or
without a GITHUB_TOKEN) and transforms them on-the-fly into Fixture objects that
the Triage Inbox agents and verifier can evaluate.
"""
from __future__ import annotations
import base64
import json
import os
import re
import urllib.error
import urllib.request
from pathlib import Path
from typing import Any

from .fixtures import Fixture


def _github_request(endpoint: str) -> Any:
    """Make an authenticated or unauthenticated request to GitHub REST API."""
    url = f"https://api.github.com/{endpoint.lstrip('/')}"
    headers = {
        "User-Agent": "Triage-Inbox-Agent/1.0",
        "Accept": "application/vnd.github.v3+json",
    }
    token = os.environ.get("GITHUB_TOKEN") or os.environ.get("GH_TOKEN")
    if token:
        headers["Authorization"] = f"Bearer {token}"

    req = urllib.request.Request(url, headers=headers)
    try:
        with urllib.request.urlopen(req, timeout=15) as resp:
            return json.loads(resp.read().decode("utf-8"))
    except urllib.error.HTTPError as e:
        err_msg = e.read().decode("utf-8", errors="replace")
        raise RuntimeError(
            f"GitHub API error {e.code} for {url}: {err_msg}\n"
            "(Tip: If hitting rate limits, set GITHUB_TOKEN in your environment or .env)"
        ) from e


def _fetch_repo_changelog(repo: str, head_tag: str, specified_file: str = "") -> str:
    """Intelligently retrieves release notes/changelog from GitHub Releases API or multi-path discovery."""
    # 1. Check official GitHub Releases API for release notes body
    try:
        rel_data = _github_request(f"repos/{repo}/releases/tags/{head_tag}")
        body = (rel_data.get("body") or "").strip()
        if body and len(body) > 30:
            rel_name = rel_data.get("name") or head_tag
            return f"# Release {rel_name}\n\n{body}"
    except Exception:
        pass

    # 2. Candidate changelog paths across standard ecosystems
    candidates = []
    if specified_file:
        candidates.append(specified_file)
    candidates.extend([
        "CHANGELOG.md",
        "CHANGES.rst",
        "CHANGES.md",
        "HISTORY.md",
        "HISTORY.rst",
        "RELEASES.md",
        "docs/changes.rst",
        "docs/CHANGELOG.md",
        "docs/history.rst",
        "libs/langchain/CHANGELOG.md",
        "packages/core/CHANGELOG.md",
    ])

    for path in candidates:
        try:
            file_data = _github_request(f"repos/{repo}/contents/{path}?ref={head_tag}")
            raw_b64 = file_data.get("content", "")
            if raw_b64:
                decoded = base64.b64decode(raw_b64).decode("utf-8", errors="replace").strip()
                if decoded:
                    return decoded
        except Exception:
            continue

    # 3. If no file found, synthesize from release tag
    return f"# Release {head_tag}\n\n## Changes\n* Release {head_tag} notes (fetched via GitHub compare tree)."


def fetch_release_fixture(
    repo: str,
    base_tag: str,
    head_tag: str,
    changelog_file: str = "CHANGELOG.md",
    force_refresh: bool = False,
) -> Fixture:
    repo = repo.strip("/")
    item_id = f"real_gh_{repo.replace('/', '_')}_{head_tag}"
    cache_path = Path("evalcases/saved_runs") / f"{item_id}.json"
    
    # 0. Check local cache first for instant re-evals with different models
    if not force_refresh and cache_path.exists():
        try:
            cached_data = json.loads(cache_path.read_text(encoding="utf-8"))
            if "artifacts" in cached_data or "artifact" in cached_data:
                art = cached_data.get("artifact") or cached_data.get("artifacts")
                # Ensure artifact shape
                if "commits" in art:
                    return Fixture(path=cache_path, raw={
                        "item_id": item_id,
                        "item_type": "changelog_audit",
                        "title": f"Audit real release: {repo} ({base_tag} -> {head_tag})",
                        "artifact": art,
                        "ground_truth": {"source": "cached_github", "expected_findings": []},
                    })
        except Exception:
            pass
    """Fetch real commits between base_tag and head_tag + the real CHANGELOG file."""
    repo = repo.strip("/")
    # 1. Fetch compare data
    compare_data = _github_request(f"repos/{repo}/compare/{base_tag}...{head_tag}")
    raw_commits = compare_data.get("commits", [])

    commits_list: list[dict[str, Any]] = []
    for c in raw_commits:
        msg = c.get("commit", {}).get("message", "")
        lines = msg.splitlines()
        subject = lines[0] if lines else ""
        body = "\n".join(lines[1:]).strip() if len(lines) > 1 else ""
        commits_list.append({
            "sha": c.get("sha", "")[:7],
            "full_sha": c.get("sha", ""),
            "author": c.get("commit", {}).get("author", {}).get("name", "Unknown"),
            "subject": subject,
            "body": body,
        })

    # 2. Fetch raw changelog content with multi-path & GitHub Releases discovery
    raw_content = _fetch_repo_changelog(repo, head_tag, changelog_file)

    changelog_lines: list[dict[str, Any]] = []
    current_heading = "General"
    for idx, line in enumerate(raw_content.splitlines(), start=1):
        stripped = line.strip()
        if stripped.startswith("#"):
            current_heading = stripped.lstrip("#").strip()
        changelog_lines.append({
            "line": idx,
            "text": line,
            "heading": current_heading,
        })

    fixture_raw = {
        "item_id": f"real_gh_{repo.replace('/', '_')}_{head_tag}",
        "item_type": "changelog_audit",
        "title": f"Audit real release: {repo} ({base_tag} -> {head_tag})",
        "artifact": {
            "release_tag": head_tag,
            "base_tag": base_tag,
            "commits": commits_list,
            "changelog": changelog_lines,
        },
        "ground_truth": {
            "source": "live_github",
            "repo": repo,
            "range": f"{base_tag}...{head_tag}",
        },
    }
    return Fixture(path=Path(f"live_github_{repo.replace('/', '_')}_{head_tag}.json"), raw=fixture_raw)


def fetch_pr_fixture(repo: str, pr_number: int) -> Fixture:
    """Fetch real review comments and diff hunks from a real GitHub PR."""
    repo = repo.strip("/")
    # 1. PR Details
    pr_data = _github_request(f"repos/{repo}/pulls/{pr_number}")
    title = pr_data.get("title", f"PR #{pr_number}")

    # 2. Review comments
    comments_data = _github_request(f"repos/{repo}/pulls/{pr_number}/comments")
    review_comments: list[dict[str, Any]] = []
    for c in comments_data:
        review_comments.append({
            "id": f"comment:{c.get('id')}",
            "path": c.get("path", ""),
            "line": c.get("line") or c.get("original_line", 0),
            "author": c.get("user", {}).get("login", "reviewer"),
            "body": c.get("body", ""),
        })

    # 3. PR Files / Diff hunks
    files_data = _github_request(f"repos/{repo}/pulls/{pr_number}/files")
    diff_hunks: list[dict[str, Any]] = []
    for f in files_data:
        patch = f.get("patch", "")
        filename = f.get("filename", "")
        diff_hunks.append({
            "id": f"hunk:{filename.replace('/', '_')}",
            "path": filename,
            "status": f.get("status", "modified"),
            "patch": patch,
        })

    fixture_raw = {
        "item_id": f"real_pr_{repo.replace('/', '_')}_pr{pr_number}",
        "item_type": "review_resolution",
        "title": f"Review resolution: {repo} #{pr_number} - {title}",
        "artifact": {
            "pr_number": pr_number,
            "repo": repo,
            "review_comments": review_comments,
            "diff_hunks": diff_hunks,
        },
        "ground_truth": {
            "source": "live_github_pr",
            "repo": repo,
            "pr_number": pr_number,
        },
    }
    return Fixture(path=Path(f"live_github_pr_{repo.replace('/', '_')}_{pr_number}.json"), raw=fixture_raw)
