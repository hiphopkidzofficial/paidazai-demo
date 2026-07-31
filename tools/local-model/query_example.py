#!/usr/bin/env python3
"""Minimal, dependency-free client for the local Ollama model.

Talks to the Ollama chat API (default http://localhost:11434) using only the
Python standard library, so it drops into any monitoring script or editor
plugin without a virtualenv.

Usage:
    python3 query_example.py "your prompt here"
    echo "your prompt" | python3 query_example.py

Environment overrides:
    OLLAMA_HOST    endpoint base URL (default: http://localhost:11434)
    OLLAMA_MODEL   model / alias to query (default: paidazai-recon)
"""

import json
import os
import sys
import urllib.error
import urllib.request

HOST = os.environ.get("OLLAMA_HOST", "http://localhost:11434").rstrip("/")
MODEL = os.environ.get("OLLAMA_MODEL", "paidazai-recon")


def ask(prompt: str, model: str = MODEL, host: str = HOST) -> str:
    """Send a single-turn chat request and return the assistant's reply."""
    payload = json.dumps(
        {
            "model": model,
            "messages": [{"role": "user", "content": prompt}],
            "stream": False,
        }
    ).encode("utf-8")

    req = urllib.request.Request(
        f"{host}/api/chat",
        data=payload,
        headers={"Content-Type": "application/json"},
        method="POST",
    )
    with urllib.request.urlopen(req, timeout=600) as resp:
        body = json.loads(resp.read().decode("utf-8"))
    return body["message"]["content"]


def main() -> int:
    if len(sys.argv) > 1:
        prompt = " ".join(sys.argv[1:])
    elif not sys.stdin.isatty():
        prompt = sys.stdin.read().strip()
    else:
        print(f"usage: {sys.argv[0]} \"your prompt\"", file=sys.stderr)
        return 2

    if not prompt:
        print("error: empty prompt", file=sys.stderr)
        return 2

    try:
        print(ask(prompt))
    except urllib.error.URLError as exc:
        print(
            f"error: could not reach Ollama at {HOST} ({exc}).\n"
            "Is the server running? Try: ollama serve",
            file=sys.stderr,
        )
        return 1
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
