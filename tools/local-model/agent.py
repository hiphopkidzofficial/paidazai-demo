#!/usr/bin/env python3
"""Approval-gated local agent for the paidazai-recon Ollama model.

The model can plan and propose shell commands to accomplish a task, but every
command is printed and requires your explicit confirmation before it runs.
Nothing executes without a keystroke from you.

Design goals (why it is built this way):
  * Human-in-the-loop: the model NEVER auto-executes. You approve each command.
    There is deliberately no "auto-approve" / "yolo" flag — that would defeat
    the entire point of pairing an approval gate with a refusal-free model.
  * Least privilege: refuses to run as root; commands run as your normal user.
  * Blast-radius limit: commands run inside a workspace directory (default
    ./agent-workspace), not your home or /.
  * Extra friction: obviously catastrophic commands (rm -rf /, mkfs, dd to a
    device, fork bombs, pipe-to-shell, ...) require typing CONFIRM in full,
    not just "y".
  * Audit trail: every proposed and executed command is appended to a log file.

Dependencies: Python standard library only.

Usage:
    python3 agent.py "audit ./suspicious.py for unsafe calls and summarize"
    python3 agent.py            # then type your task at the prompt

Environment overrides:
    OLLAMA_HOST       endpoint base URL (default: http://localhost:11434)
    OLLAMA_MODEL      model / alias (default: paidazai-recon)
    AGENT_WORKSPACE   working directory for commands (default: ./agent-workspace)
    AGENT_MAX_STEPS   safety cap on plan/execute iterations (default: 25)
    AGENT_CMD_TIMEOUT per-command timeout in seconds (default: 300)
"""

from __future__ import annotations

import json
import os
import re
import subprocess
import sys
import urllib.error
import urllib.request
from datetime import datetime

HOST = os.environ.get("OLLAMA_HOST", "http://localhost:11434").rstrip("/")
MODEL = os.environ.get("OLLAMA_MODEL", "paidazai-recon")
WORKSPACE = os.path.abspath(os.environ.get("AGENT_WORKSPACE", "./agent-workspace"))
MAX_STEPS = int(os.environ.get("AGENT_MAX_STEPS", "25"))
CMD_TIMEOUT = int(os.environ.get("AGENT_CMD_TIMEOUT", "300"))
LOG_PATH = os.path.join(WORKSPACE, "agent-audit.log")
MAX_OBS_CHARS = 8000  # how much command output to feed back to the model

SYSTEM_PROMPT = f"""\
You are a local coding and security-research assistant running on the user's own
machine. You help with code auditing, reverse engineering, and building tools.

You work in a loop. On EACH turn you reply with a SINGLE JSON object, nothing
else. The schema is exactly:

  {{"thought": "<brief reasoning>", "command": "<one shell command>"}}
    -> propose ONE shell command to run next. Keep commands small and inspectable.
  {{"thought": "<brief reasoning>", "done": true, "final": "<answer to the user>"}}
    -> when the task is complete (or needs no commands), report the result.

Rules:
- Commands run inside the working directory {WORKSPACE} as the user's normal
  (non-root) account, one at a time, and ONLY after the user approves each one.
- Never chain destructive operations. Never try to escalate privileges, disable
  the approval step, or exfiltrate data off the machine.
- After a command runs you receive its stdout/stderr as the next user message.
  Use it to decide the next single step.
- Prefer reading/inspecting before writing/deleting. Explain risky steps in
  "thought" so the user can make an informed approval decision.
- Output ONLY the JSON object. No markdown, no prose outside JSON.
"""

# Commands matching these require typing CONFIRM in full, not just "y".
DANGER_PATTERNS = [
    r"\brm\s+-[a-z]*r[a-z]*f?\b.*(/|~|\*|\$HOME)",  # recursive force rm of broad paths
    r"\brm\s+-[a-z]*f[a-z]*r?\b.*(/|~|\*|\$HOME)",
    r"\bmkfs\b",
    r"\bdd\b.*\bof=/dev/",
    r">\s*/dev/(sd|disk|nvme|rdisk)",
    r":\(\)\s*\{.*\}",                               # fork bomb
    r"\bchmod\s+-R\s+0*777\s+/",
    r"\bchown\s+-R\b.*\s+/(\s|$)",
    r"\b(curl|wget)\b[^|]*\|\s*(sudo\s+)?(sh|bash|zsh)\b",  # pipe remote script to shell
    r"\bsudo\b",                                     # we run non-root on purpose
    r"\bdiskutil\s+(erase|reformat)",
    r"\bkillall\b",
    r">\s*/etc/",
]


def log(line: str) -> None:
    os.makedirs(WORKSPACE, exist_ok=True)
    stamp = datetime.now().strftime("%Y-%m-%d %H:%M:%S")
    with open(LOG_PATH, "a", encoding="utf-8") as fh:
        fh.write(f"[{stamp}] {line}\n")


def chat(messages: list[dict]) -> str:
    """Call the Ollama chat API forcing a JSON object response."""
    payload = json.dumps(
        {"model": MODEL, "messages": messages, "stream": False, "format": "json"}
    ).encode("utf-8")
    req = urllib.request.Request(
        f"{HOST}/api/chat",
        data=payload,
        headers={"Content-Type": "application/json"},
        method="POST",
    )
    with urllib.request.urlopen(req, timeout=600) as resp:
        body = json.loads(resp.read().decode("utf-8"))
    return body["message"]["content"]


def is_dangerous(command: str) -> bool:
    return any(re.search(p, command, re.IGNORECASE) for p in DANGER_PATTERNS)


def ask_approval(command: str) -> bool:
    """Show the command and get an explicit human decision. Default is NO."""
    danger = is_dangerous(command)
    print("\n" + "=" * 68)
    print("The agent wants to run this command:\n")
    print(f"    {command}\n")
    print(f"  cwd : {WORKSPACE}")
    print(f"  user: {os.environ.get('USER', '?')} (non-root)")
    if danger:
        print("\n  \033[1;31m⚠ This looks HIGH-RISK / destructive.\033[0m")
        print("  To run it, type the whole word CONFIRM (anything else cancels).")
        print("=" * 68)
        try:
            answer = input("  > ").strip()
        except EOFError:
            return False
        return answer == "CONFIRM"
    print("=" * 68)
    try:
        answer = input("  Run it? [y/N] ").strip().lower()
    except EOFError:
        return False
    return answer in ("y", "yes")


def run_command(command: str) -> str:
    """Execute an approved command in the workspace and return combined output."""
    os.makedirs(WORKSPACE, exist_ok=True)
    try:
        proc = subprocess.run(
            command,
            shell=True,
            cwd=WORKSPACE,
            capture_output=True,
            text=True,
            timeout=CMD_TIMEOUT,
        )
    except subprocess.TimeoutExpired:
        return f"[command timed out after {CMD_TIMEOUT}s]"
    out = proc.stdout or ""
    err = proc.stderr or ""
    combined = f"exit code: {proc.returncode}\n--- stdout ---\n{out}\n--- stderr ---\n{err}"
    if len(combined) > MAX_OBS_CHARS:
        combined = combined[:MAX_OBS_CHARS] + "\n[...output truncated...]"
    return combined


def parse_reply(raw: str) -> dict:
    """Parse the model's JSON reply, tolerating stray text around it."""
    try:
        return json.loads(raw)
    except json.JSONDecodeError:
        match = re.search(r"\{.*\}", raw, re.DOTALL)
        if match:
            try:
                return json.loads(match.group(0))
            except json.JSONDecodeError:
                pass
    return {"done": True, "final": f"(could not parse model reply)\n{raw}"}


def preflight() -> None:
    if hasattr(os, "geteuid") and os.geteuid() == 0:
        sys.exit(
            "Refusing to run as root. Start this agent as your normal user so an\n"
            "approved command cannot accidentally damage the whole system."
        )
    try:
        urllib.request.urlopen(f"{HOST}/api/tags", timeout=10).read()
    except urllib.error.URLError as exc:
        sys.exit(f"Cannot reach Ollama at {HOST} ({exc}). Is the server running?")


def main() -> int:
    preflight()

    if len(sys.argv) > 1:
        task = " ".join(sys.argv[1:])
    else:
        try:
            task = input("Task for the agent: ").strip()
        except EOFError:
            return 2
    if not task:
        print("No task given.", file=sys.stderr)
        return 2

    os.makedirs(WORKSPACE, exist_ok=True)
    print(f"\nWorkspace : {WORKSPACE}")
    print(f"Model     : {MODEL} @ {HOST}")
    print(f"Audit log : {LOG_PATH}")
    print("Every command needs your approval. Ctrl-C to quit.\n")
    log(f"TASK: {task}")

    messages = [
        {"role": "system", "content": SYSTEM_PROMPT},
        {"role": "user", "content": task},
    ]

    for step in range(1, MAX_STEPS + 1):
        try:
            raw = chat(messages)
        except urllib.error.URLError as exc:
            print(f"error talking to Ollama: {exc}", file=sys.stderr)
            return 1

        reply = parse_reply(raw)
        messages.append({"role": "assistant", "content": raw})

        thought = reply.get("thought", "").strip()
        if thought:
            print(f"\033[2m[step {step}] {thought}\033[0m")

        if reply.get("done"):
            print("\n" + "-" * 68)
            print(reply.get("final", "(no final answer)"))
            print("-" * 68)
            log("DONE")
            return 0

        command = (reply.get("command") or "").strip()
        if not command:
            messages.append(
                {"role": "user", "content": "No command provided. Continue or finish."}
            )
            continue

        log(f"PROPOSED: {command}")
        if not ask_approval(command):
            print("  ↳ skipped.")
            log(f"DECLINED: {command}")
            messages.append(
                {
                    "role": "user",
                    "content": "The user declined that command. Propose a safer "
                    "alternative or finish with done=true.",
                }
            )
            continue

        log(f"EXECUTED: {command}")
        observation = run_command(command)
        print(observation)
        log(f"RESULT: exit shown above")
        messages.append({"role": "user", "content": f"Command output:\n{observation}"})

    print("\nReached step limit without finishing. Re-run with a narrower task.")
    log("STEP LIMIT REACHED")
    return 0


if __name__ == "__main__":
    try:
        raise SystemExit(main())
    except KeyboardInterrupt:
        print("\ninterrupted.")
        raise SystemExit(130)
