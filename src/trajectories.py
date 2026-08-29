"""Render Trajectory objects to disk as JSON (machine) + Markdown (human).

Deliverable #4 asks for representative trajectories that are easy to follow from
the agent instructions to the final result, showing what the agent did and how
its tools responded. The Markdown render is built for exactly that reading.
"""
from __future__ import annotations
import json
from pathlib import Path

from .llm import Trajectory


def _render_md(traj: Trajectory) -> str:
    out = [f"# Trajectory: `{traj.agent}` on `{traj.item_id}`", ""]
    out.append(f"*Backend: {traj.provider} / {traj.model}  ·  "
               f"Tokens: {traj.input_tokens} in / {traj.output_tokens} out*")
    out.append("")
    out.append("## System instructions")
    out.append("```\n" + traj.system.strip() + "\n```")
    out.append("")
    for st in traj.steps:
        if st.kind == "model":
            d = st.detail
            out.append(f"## Model turn {d['step']}  (stop: `{d['stop_reason']}`)")
            for block in d["content"]:
                if block["type"] == "text":
                    out.append(block["text"].strip())
                elif block["type"] == "thinking":
                    out.append(f"> _thinking:_ {block['thinking'][:400]}")
                elif block["type"] == "tool_use":
                    out.append(f"**calls** `{block['name']}`("
                               f"`{json.dumps(block['input'])}`)")
            out.append("")
        else:
            d = st.detail
            flag = " ❌error" if d["is_error"] else ""
            out.append(f"### tool `{d['name']}` ->{flag}")
            res = d["result"]
            res = res if len(res) < 1500 else res[:1500] + "\n…(truncated)"
            out.append("```\n" + res + "\n```")
            out.append("")
    return "\n".join(out)


def dump(traj: Trajectory, out_dir: str | Path, tag: str = "") -> Path:
    out_dir = Path(out_dir)
    out_dir.mkdir(parents=True, exist_ok=True)
    stem = f"{traj.item_id}__{tag + '__' if tag else ''}{traj.agent}"
    (out_dir / f"{stem}.json").write_text(
        json.dumps({
            "agent": traj.agent, "item_id": traj.item_id,
            "provider": traj.provider, "model": traj.model, "system": traj.system,
            "input_tokens": traj.input_tokens, "output_tokens": traj.output_tokens,
            "steps": [{"kind": s.kind, **s.detail} for s in traj.steps],
        }, indent=2), encoding="utf-8")
    md_path = out_dir / f"{stem}.md"
    md_path.write_text(_render_md(traj), encoding="utf-8")
    return md_path
