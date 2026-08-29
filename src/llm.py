"""Provider-abstracted agentic loop over a chat model.

The loop is provider-neutral: it keeps history in a small neutral block format
(text / tool_use / tool_result) and delegates one model turn to a provider
adapter that returns a normalized `LLMResponse`. Two adapters ship:

  * anthropic  -- native Anthropic Messages API via the official SDK (Claude;
                  supports output_config effort).
  * openai     -- OpenAI-compatible chat completions via stdlib HTTP, covering
                  OpenAI, Groq, and OpenRouter (base_url + key from config).

We hand-roll the loop (rather than a beta tool runner) so we get the full,
ordered record of every request/tool call/result to emit as an Agent Trajectory
(deliverable #4). Switch backends with TRIAGE_PROVIDER / TRIAGE_MODEL.
"""
from __future__ import annotations
import json
import urllib.error
import urllib.request
from dataclasses import dataclass, field
from typing import Any, Callable

from . import config


@dataclass
class Tool:
    name: str
    description: str
    input_schema: dict[str, Any]
    fn: Callable[[dict[str, Any]], str]

    def spec(self) -> dict[str, Any]:
        return {"name": self.name, "description": self.description,
                "input_schema": self.input_schema}


@dataclass
class Step:
    kind: str                       # "model" | "tool"
    detail: dict[str, Any]


@dataclass
class Trajectory:
    agent: str
    item_id: str
    system: str = ""
    provider: str = ""
    model: str = ""
    steps: list[Step] = field(default_factory=list)
    input_tokens: int = 0
    output_tokens: int = 0


@dataclass
class LLMResponse:
    text: str
    tool_uses: list[dict[str, Any]]      # [{id, name, input}]
    assistant_blocks: list[dict[str, Any]]  # neutral blocks to append to history
    stop_reason: str                     # "tool_use" | "end_turn"
    usage_in: int
    usage_out: int


# ------------------------------------------------------------------ Anthropic
_ANTHROPIC_CLIENT = None


def _anthropic_client():
    global _ANTHROPIC_CLIENT
    if _ANTHROPIC_CLIENT is None:
        import anthropic
        _ANTHROPIC_CLIENT = anthropic.Anthropic()
    return _ANTHROPIC_CLIENT


def _anthropic_call(system, messages, tool_specs, force_tool) -> LLMResponse:
    kwargs: dict[str, Any] = dict(
        model=config.MODEL, max_tokens=config.MAX_TOKENS,
        system=system, messages=messages,
        output_config={"effort": config.EFFORT},
    )
    if tool_specs:
        kwargs["tools"] = tool_specs
    if force_tool:
        kwargs["tool_choice"] = {"type": "tool", "name": force_tool}
    resp = _anthropic_client().messages.create(**kwargs)

    text_parts, tool_uses, blocks = [], [], []
    for b in resp.content:
        if b.type == "text":
            text_parts.append(b.text)
            blocks.append({"type": "text", "text": b.text})
        elif b.type == "tool_use":
            tool_uses.append({"id": b.id, "name": b.name, "input": b.input})
            blocks.append({"type": "tool_use", "id": b.id, "name": b.name, "input": b.input})
    return LLMResponse(
        text="\n".join(text_parts), tool_uses=tool_uses, assistant_blocks=blocks,
        stop_reason="tool_use" if resp.stop_reason == "tool_use" else "end_turn",
        usage_in=getattr(resp.usage, "input_tokens", 0) or 0,
        usage_out=getattr(resp.usage, "output_tokens", 0) or 0,
    )


# ------------------------------------------------------- OpenAI-compatible
def _to_openai_messages(system, messages) -> list[dict[str, Any]]:
    out = [{"role": "system", "content": system}]
    for m in messages:
        content = m["content"]
        if m["role"] == "user":
            if isinstance(content, str):
                out.append({"role": "user", "content": content})
            else:
                # a user turn is either plain text blocks or tool_result blocks
                for blk in content:
                    if blk["type"] == "tool_result":
                        out.append({"role": "tool", "tool_call_id": blk["tool_use_id"],
                                    "content": blk["content"]})
                    elif blk["type"] == "text":
                        out.append({"role": "user", "content": blk["text"]})
        else:  # assistant
            text = "".join(b["text"] for b in content if b["type"] == "text")
            tool_calls = [{
                "id": b["id"], "type": "function",
                "function": {"name": b["name"], "arguments": json.dumps(b["input"])},
            } for b in content if b["type"] == "tool_use"]
            msg: dict[str, Any] = {"role": "assistant", "content": text or None}
            if tool_calls:
                msg["tool_calls"] = tool_calls
            out.append(msg)
    return out


def _openai_call(system, messages, tool_specs, force_tool) -> LLMResponse:
    import os
    key = os.environ.get(config.KEY_ENV, "")
    body: dict[str, Any] = {
        "model": config.MODEL,
        "max_tokens": config.MAX_TOKENS,
        "messages": _to_openai_messages(system, messages),
    }
    if tool_specs:
        body["tools"] = [{"type": "function", "function": {
            "name": t["name"], "description": t["description"],
            "parameters": t["input_schema"]}} for t in tool_specs]
        if force_tool:
            body["tool_choice"] = {"type": "function", "function": {"name": force_tool}}
    data = json.dumps(body).encode("utf-8")
    req = urllib.request.Request(
        f"{config.BASE_URL}/chat/completions", data=data, method="POST",
        headers={
            "Authorization": f"Bearer {key}", "Content-Type": "application/json",
            # Some providers (e.g. Groq) sit behind Cloudflare, which blocks the
            # default Python-urllib User-Agent (403, error 1010).
            "User-Agent": "triage-inbox/1.0",
        },
    )
    import time
    attempts = 6
    payload = None
    for attempt in range(attempts):
        last = attempt == attempts - 1
        try:
            with urllib.request.urlopen(req, timeout=180) as r:
                payload = json.loads(r.read().decode("utf-8"))
            break
        except urllib.error.HTTPError as e:  # HTTP status error (subclass of URLError)
            detail = e.read().decode("utf-8", "replace")[:500]
            # Back off on throughput rate limits / transient server errors.
            if e.code in (429, 500, 502, 503) and not last:
                retry_after = e.headers.get("retry-after")
                wait = float(retry_after) if retry_after else 2.0 * (attempt + 1)
                time.sleep(min(wait, 30.0))
                continue
            raise RuntimeError(f"{config.PROVIDER} HTTP {e.code}: {detail}") from None
        except (urllib.error.URLError, ConnectionError, TimeoutError, OSError) as e:
            # Network-level failure (dropped TLS, reset, DNS, timeout): retry.
            if not last:
                time.sleep(2.0 * (attempt + 1))
                continue
            raise RuntimeError(f"{config.PROVIDER} network error: {e}") from None
    if payload is None:
        raise RuntimeError(f"{config.PROVIDER}: no response after retries")

    choice = payload["choices"][0]["message"]
    text = choice.get("content") or ""
    tool_uses, blocks = [], []
    if text:
        blocks.append({"type": "text", "text": text})
    for tc in choice.get("tool_calls") or []:
        fn = tc["function"]
        try:
            args = json.loads(fn.get("arguments") or "{}")
        except json.JSONDecodeError:
            args = {}
        tool_uses.append({"id": tc["id"], "name": fn["name"], "input": args})
        blocks.append({"type": "tool_use", "id": tc["id"], "name": fn["name"], "input": args})
    usage = payload.get("usage", {})
    return LLMResponse(
        text=text, tool_uses=tool_uses, assistant_blocks=blocks,
        stop_reason="tool_use" if tool_uses else "end_turn",
        usage_in=usage.get("prompt_tokens", 0) or 0,
        usage_out=usage.get("completion_tokens", 0) or 0,
    )


def _call_model(system, messages, tool_specs, force_tool) -> LLMResponse:
    if config.PROVIDER_KIND == "anthropic":
        return _anthropic_call(system, messages, tool_specs, force_tool)
    return _openai_call(system, messages, tool_specs, force_tool)


# ------------------------------------------------------------------- the loop
def run_agent(*, agent: str, item_id: str, system: str, user: str,
              tools: list[Tool], force_first_tool: str | None = None) -> tuple[str, Trajectory]:
    """Run one agent to completion. Returns (final_text, trajectory)."""
    traj = Trajectory(agent=agent, item_id=item_id, system=system,
                      provider=config.PROVIDER, model=config.MODEL)
    by_name = {t.name: t for t in tools}
    tool_specs = [t.spec() for t in tools]
    messages: list[dict[str, Any]] = [{"role": "user", "content": user}]

    final_text = ""
    for step_no in range(config.MAX_AGENT_STEPS):
        force = force_first_tool if step_no == 0 else None
        resp = _call_model(system, messages, tool_specs, force)
        traj.input_tokens += resp.usage_in
        traj.output_tokens += resp.usage_out
        traj.steps.append(Step("model", {
            "step": step_no, "stop_reason": resp.stop_reason,
            "content": resp.assistant_blocks,
        }))
        if resp.text:
            final_text = resp.text

        if resp.stop_reason != "tool_use" or not resp.tool_uses:
            break

        messages.append({"role": "assistant", "content": resp.assistant_blocks})
        tool_results = []
        for tu in resp.tool_uses:
            tool = by_name.get(tu["name"])
            if tool is None:
                result, is_error = f"Error: unknown tool {tu['name']}", True
            else:
                try:
                    result, is_error = tool.fn(tu["input"]), False
                except Exception as e:
                    result, is_error = f"Error: {e}", True
            traj.steps.append(Step("tool", {
                "step": step_no, "name": tu["name"], "input": tu["input"],
                "result": result, "is_error": is_error,
            }))
            tool_results.append({"type": "tool_result", "tool_use_id": tu["id"],
                                 "content": result, "is_error": is_error})
        messages.append({"role": "user", "content": tool_results})

    return final_text, traj


def extract_json(text: str) -> Any:
    """Pull the first top-level JSON object/array from a model response."""
    text = (text or "").strip()
    if "```" in text:
        for p in text.split("```"):
            p = p.strip()
            if p.startswith("json"):
                p = p[4:].strip()
            if p and p[0] in "{[":
                try:
                    return json.loads(p)
                except json.JSONDecodeError:
                    continue
    for opener, closer in (("[", "]"), ("{", "}")):
        i, j = text.find(opener), text.rfind(closer)
        if i != -1 and j != -1 and j > i:
            try:
                return json.loads(text[i:j + 1])
            except json.JSONDecodeError:
                pass
    raise ValueError(f"No JSON found in model output:\n{text[:400]}")
