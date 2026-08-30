"""Triage Inbox — Local Live API Server

Provides local backend endpoints for the React dashboard to run live triage
audits on any real GitHub repository, with configurable model and provider settings.
"""
from __future__ import annotations
import json
import os
import urllib.parse
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path
from typing import Any

from src import agent as agent_mod
from src import baseline as baseline_mod
from src import config
from src.github import fetch_pr_fixture, fetch_release_fixture, _github_request


class TriageAPIHandler(BaseHTTPRequestHandler):
    def _send_json(self, status: int, data: Any):
        body = json.dumps(data).encode("utf-8")
        self.send_response(status)
        self.send_header("Content-Type", "application/json")
        self.send_header("Content-Length", str(len(body)))
        self.send_header("Access-Control-Allow-Origin", "*")
        self.send_header("Access-Control-Allow-Methods", "GET, POST, OPTIONS")
        self.send_header("Access-Control-Allow-Headers", "Content-Type, Authorization")
        self.end_headers()
        self.wfile.write(body)

    def do_OPTIONS(self):
        self.send_response(200)
        self.send_header("Access-Control-Allow-Origin", "*")
        self.send_header("Access-Control-Allow-Methods", "GET, POST, OPTIONS")
        self.send_header("Access-Control-Allow-Headers", "Content-Type, Authorization")
        self.end_headers()

    def do_GET(self):
        parsed = urllib.parse.urlparse(self.path)
        qs = urllib.parse.parse_qs(parsed.query)

        if parsed.path == "/api/health":
            self._send_json(200, {"status": "ok", "provider": config.PROVIDER, "model": config.MODEL})
            return

        if parsed.path == "/api/github/tags":
            repo = qs.get("repo", [""])[0]
            if not repo:
                self._send_json(400, {"error": "Missing 'repo' query param (e.g. pallets/flask)"})
                return
            try:
                tags = _github_request(f"repos/{repo}/tags?per_page=10")
                tag_names = [t["name"] for t in tags if isinstance(t, dict) and "name" in t]
                self._send_json(200, {"repo": repo, "tags": tag_names})
            except Exception as e:
                self._send_json(500, {"error": str(e)})
            return

        if parsed.path == "/api/github/prs":
            repo = qs.get("repo", [""])[0]
            if not repo:
                self._send_json(400, {"error": "Missing 'repo' query param (e.g. tiangolo/fastapi)"})
                return
            try:
                prs = _github_request(f"repos/{repo}/pulls?state=all&per_page=8")
                pr_list = [{
                    "number": p["number"],
                    "title": p["title"],
                    "user": p.get("user", {}).get("login", ""),
                    "state": p["state"],
                } for p in prs if isinstance(p, dict)]
                self._send_json(200, {"repo": repo, "prs": pr_list})
            except Exception as e:
                self._send_json(500, {"error": str(e)})
            return

        if parsed.path == "/api/models":
            models_registry = {
                "openai": [
                    {"id": "gpt-4o-mini", "name": "GPT-4o Mini (Default, Fast & Economical)"},
                    {"id": "gpt-4o", "name": "GPT-4o (Omni Flagship)"},
                    {"id": "o3-mini", "name": "o3-mini (High Reasoning)"},
                    {"id": "gpt-4-turbo", "name": "GPT-4 Turbo"},
                ],
                "anthropic": [
                    {"id": "claude-3-7-sonnet-20250219", "name": "Claude 3.7 Sonnet (Hybrid Reasoning)"},
                    {"id": "claude-3-5-sonnet-20241022", "name": "Claude 3.5 Sonnet (Coding Specialist)"},
                    {"id": "claude-3-5-haiku-20241022", "name": "Claude 3.5 Haiku (Ultra-fast)"},
                    {"id": "claude-opus-5", "name": "Claude Opus 5 (Evaluator Model)"},
                ],
                "groq": [
                    {"id": "llama-3.3-70b-versatile", "name": "Llama 3.3 70B Versatile (Free / Blazing Fast)"},
                    {"id": "llama-3.1-8b-instant", "name": "Llama 3.1 8B Instant (Ultra-low Latency)"},
                    {"id": "deepseek-r1-distill-llama-70b", "name": "DeepSeek R1 Distill Llama 70B"},
                    {"id": "mixtral-8x7b-32768", "name": "Mixtral 8x7B 32k Context"},
                ],
                "openrouter": [
                    {"id": "anthropic/claude-3.7-sonnet", "name": "Claude 3.7 Sonnet (via OpenRouter)"},
                    {"id": "openai/gpt-4o", "name": "GPT-4o (via OpenRouter)"},
                    {"id": "google/gemini-2.0-flash-001", "name": "Gemini 2.0 Flash (via OpenRouter)"},
                    {"id": "meta-llama/llama-3.3-70b-instruct", "name": "Llama 3.3 70B (via OpenRouter)"},
                ],
            }
            self._send_json(200, models_registry)
            return

        self._send_json(404, {"error": "Endpoint not found"})

    def do_POST(self):
        parsed = urllib.parse.urlparse(self.path)
        content_length = int(self.headers.get("Content-Length", 0))
        body_bytes = self.rfile.read(content_length) if content_length > 0 else b"{}"
        try:
            payload = json.loads(body_bytes.decode("utf-8"))
        except Exception:
            self._send_json(400, {"error": "Invalid JSON payload"})
            return

        if parsed.path == "/api/triage/live":
            try:
                # 1. Apply runtime provider/model/key settings (only if explicitly overridden)
                provider = payload.get("provider") or config.PROVIDER
                model = payload.get("model") or None
                api_key = payload.get("api_key") or None
                gh_token = payload.get("github_token") or None
                run_both = payload.get("run_both", True)
                selected_arm = payload.get("arm", "agent")

                if gh_token:
                    os.environ["GITHUB_TOKEN"] = gh_token

                config.set_runtime_config(provider=provider, model=model, api_key=api_key)

                # 2. Fetch live GitHub fixture
                triage_type = payload.get("type", "changelog")
                repo = payload.get("repo", "").strip()
                if not repo:
                    self._send_json(400, {"error": "Missing 'repo' parameter"})
                    return

                if triage_type == "changelog":
                    base_tag = payload.get("base_tag", "").strip()
                    head_tag = payload.get("head_tag", "").strip()
                    file_path = payload.get("changelog_file", "CHANGELOG.md").strip() or "CHANGELOG.md"
                    if not base_tag or not head_tag:
                        self._send_json(400, {"error": "Both 'base_tag' and 'head_tag' are required for release triage"})
                        return
                    fx = fetch_release_fixture(repo=repo, base_tag=base_tag, head_tag=head_tag, changelog_file=file_path)
                elif triage_type == "pr":
                    pr_number = int(payload.get("pr_number", 0))
                    if pr_number <= 0:
                        self._send_json(400, {"error": "Valid 'pr_number' is required for PR review triage"})
                        return
                    fx = fetch_pr_fixture(repo=repo, pr_number=pr_number)
                else:
                    self._send_json(400, {"error": f"Unknown triage type: {triage_type}"})
                    return

                # 3. Format fetched artifacts for rich UI inspection
                # Use the Fixture's typed accessors (fx.artifact is the raw dict,
                # fx.commits() / fx.changelog() / fx.review_comments() / fx.diff_hunks()
                # are the typed helpers).
                commits = fx.commits()           # list[dict] with sha/subject/body/author
                changelog_lines = fx.changelog() # list[dict] with line/text/heading
                review_comments = fx.review_comments()  # list[dict]
                diff_hunks = fx.diff_hunks()     # list[dict] with id/path/patch

                # Build a readable changelog preview string from structured lines
                changelog_text = "\n".join(
                    cl.get("text", "") for cl in changelog_lines
                ) if changelog_lines else ""

                artifacts_summary = {
                    "commits_count": len(commits),
                    "commits": [{
                        "sha": c.get("sha", "")[:8],
                        "full_sha": c.get("full_sha", c.get("sha", "")),
                        "message": c.get("subject", c.get("message", "")).split("\n")[0],
                        "body": c.get("body", c.get("message", "")),
                        "author": c.get("author", "unknown"),
                    } for c in commits[:25]],
                    "changelog_length": len(changelog_text),
                    "changelog_preview": changelog_text[:2000],
                    "review_comments": review_comments,
                    "diff_hunks_count": len(diff_hunks),
                    "diff_files": [h.get("path", "") for h in diff_hunks] if diff_hunks else [],
                }

                # 4. Execute triage runs
                agent_res, agent_trajs = agent_mod.triage(fx)
                
                baseline_res, baseline_trajs = None, []
                if run_both:
                    try:
                        baseline_res, baseline_trajs = baseline_mod.triage(fx)
                    except Exception as be:
                        print("Baseline run error:", be)

                # 5. Serialize trajectories
                def serialize_trajs(trajs_list):
                    out = []
                    for t in trajs_list:
                        out.append({
                            "agent": t.agent,
                            "item_id": t.item_id,
                            "system": t.system,
                            "steps": [s.detail for s in t.steps],
                            "input_tokens": t.input_tokens,
                            "output_tokens": t.output_tokens,
                        })
                    return out

                self._send_json(200, {
                    "success": True,
                    "item_id": fx.item_id,
                    "title": fx.title,
                    "item_type": fx.item_type,
                    "repo": repo,
                    "artifacts": artifacts_summary,
                    "agent": {
                        "result": agent_res.to_dict(),
                        "trajectories": serialize_trajs(agent_trajs),
                    },
                    "baseline": {
                        "result": baseline_res.to_dict() if baseline_res else None,
                        "trajectories": serialize_trajs(baseline_trajs),
                    } if run_both and baseline_res else None,
                })
            except Exception as e:
                import traceback
                traceback.print_exc()
                self._send_json(500, {"error": str(e)})
            return

        self._send_json(404, {"error": "Endpoint not found"})



def run_server(port: int = 8000):
    server = ThreadingHTTPServer(("127.0.0.1", port), TriageAPIHandler)
    print(f"Triage Inbox API Server running at http://127.0.0.1:{port}")
    try:
        server.serve_forever()
    except KeyboardInterrupt:
        print("\nShutting down server.")
        server.server_close()


if __name__ == "__main__":
    run_server()
