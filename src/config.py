"""Central configuration + provider registry.

Everything a reproducer might change lives here. The provider layer lets the same
agent run on different backends so the eval can compare models/providers:
set TRIAGE_PROVIDER (+ optionally TRIAGE_MODEL) and re-run.

Supported providers:
  anthropic   native Anthropic Messages API (Claude) -- full features (effort).
  openai      OpenAI chat completions (gpt-*).
  groq        Groq (OpenAI-compatible), often free.
  openrouter  OpenRouter (OpenAI-compatible); can route to many models incl. Claude.
The last three share one OpenAI-compatible adapter (kind="openai").
"""
import os
from pathlib import Path

_ROOT = Path(__file__).parent.parent


def _load_dotenv() -> None:
    """Minimal .env loader: KEY=VALUE lines, '#' comments, no override of real env."""
    env = _ROOT / ".env"
    if not env.exists():
        return
    for line in env.read_text(encoding="utf-8").splitlines():
        line = line.strip()
        if not line or line.startswith("#") or "=" not in line:
            continue
        key, _, val = line.partition("=")
        key, val = key.strip(), val.strip().strip('"').strip("'")
        if key and key not in os.environ:
            os.environ[key] = val


_load_dotenv()

# --- provider registry ---------------------------------------------------
PROVIDERS = {
    "anthropic": {
        "kind": "anthropic", "base_url": None,
        "key_env": "ANTHROPIC_API_KEY", "default_model": "claude-opus-5",
    },
    "openai": {
        "kind": "openai", "base_url": "https://api.openai.com/v1",
        "key_env": "OPENAI_API_KEY", "default_model": "gpt-4o-mini",
    },
    "groq": {
        "kind": "openai", "base_url": "https://api.groq.com/openai/v1",
        "key_env": "GROQ_API_KEY", "default_model": "openai/gpt-oss-120b",
    },
    "openrouter": {
        "kind": "openai", "base_url": "https://openrouter.ai/api/v1",
        "key_env": "OPENROUTER_API_KEY", "default_model": "anthropic/claude-sonnet-4.5",
    },
}

# Default to openai: it is the provider the headline results were measured on, so
# a clean `python eval.py` reproduces the documented run. Switch with TRIAGE_PROVIDER.
PROVIDER = os.environ.get("TRIAGE_PROVIDER", "openai")
if PROVIDER not in PROVIDERS:
    raise ValueError(f"Unknown TRIAGE_PROVIDER '{PROVIDER}'. Choose: {list(PROVIDERS)}")

_P = PROVIDERS[PROVIDER]
MODEL = os.environ.get("TRIAGE_MODEL", _P["default_model"])
PROVIDER_KIND = _P["kind"]
BASE_URL = _P["base_url"]
KEY_ENV = _P["key_env"]

# effort applies only to the Anthropic backend; ignored elsewhere.
EFFORT = os.environ.get("TRIAGE_EFFORT", "high")


def set_runtime_config(provider: str, model: str | None = None, api_key: str | None = None, effort: str | None = None) -> None:
    """Dynamically switch provider, model, and key for live UI requests."""
    global PROVIDER, MODEL, PROVIDER_KIND, BASE_URL, KEY_ENV, EFFORT
    if provider not in PROVIDERS:
        raise ValueError(f"Unknown TRIAGE_PROVIDER '{provider}'. Choose: {list(PROVIDERS)}")
    PROVIDER = provider
    _p = PROVIDERS[provider]
    PROVIDER_KIND = _p["kind"]
    BASE_URL = _p["base_url"]
    KEY_ENV = _p["key_env"]
    MODEL = model if model else _p["default_model"]
    if effort:
        EFFORT = effort
    if api_key:
        os.environ[KEY_ENV] = api_key


# Per-1M-token USD prices for cost reporting. Unknown models -> $0 (see eval.py).
PRICING = {
    "claude-opus-5":   {"input": 5.00, "output": 25.00},
    "claude-opus-4-8": {"input": 5.00, "output": 25.00},
    "claude-sonnet-5": {"input": 2.00, "output": 10.00},
    "claude-haiku-4-5": {"input": 1.00, "output": 5.00},
    "gpt-4o-mini":     {"input": 0.15, "output": 0.60},
    "gpt-4o":          {"input": 2.50, "output": 10.00},
    "openai/gpt-oss-120b": {"input": 0.15, "output": 0.75},  # Groq; ~free in practice
    "anthropic/claude-sonnet-4.5": {"input": 3.00, "output": 15.00},  # via OpenRouter
}

# Safety rail so a mis-behaving loop can't spin forever (ground rule #4: controlled).
MAX_AGENT_STEPS = 12

# Max tokens per model response. Findings JSON is small; keep this modest so it
# fits tight free-tier per-minute token budgets (e.g. Groq's 8k TPM).
MAX_TOKENS = 2000
