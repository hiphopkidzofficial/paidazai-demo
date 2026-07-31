#!/usr/bin/env bash
#
# setup.sh — provision a local, refusal-reduced coding model via Ollama.
#
# Target host: Apple M4 Mac mini, 16 GB unified memory.
# Default model: Qwen2.5-Coder-7B-Instruct (Uncensored) Q8_0 — fast, fits 16 GB.
# Optional:      Qwen2.5-Coder-14B-Instruct (abliterated) Q4_K_M via --with-14b.
#
# This script does NOT auto-install Ollama or Homebrew; it checks for what it
# needs and prints guidance instead. Re-running is safe (pulls are idempotent).
#
# Usage:
#   bash tools/local-model/setup.sh            # pull + alias the 7B default
#   bash tools/local-model/setup.sh --with-14b # also pull the heavier 14B model

set -euo pipefail

# --- configuration ----------------------------------------------------------

PRIMARY_MODEL="hf.co/BlossomsAI/Qwen2.5-Coder-7B-Instruct-Uncensored-GGUF:Q8_0"
PRIMARY_ALIAS="paidazai-recon"

# Corrected 14B: the abliterated GGUF lives under bartowski, NOT mradermacher.
HEAVY_MODEL="hf.co/bartowski/Qwen2.5-Coder-14B-Instruct-abliterated-GGUF:Q4_K_M"
HEAVY_ALIAS="paidazai-recon-14b"

OLLAMA_HOST="${OLLAMA_HOST:-http://localhost:11434}"

WITH_14B=0
for arg in "$@"; do
  case "$arg" in
    --with-14b) WITH_14B=1 ;;
    -h|--help)
      sed -n '2,${/^#/!q;s/^# \{0,1\}//p}' "$0"
      exit 0
      ;;
    *)
      echo "Unknown argument: $arg (try --help)" >&2
      exit 2
      ;;
  esac
done

info()  { printf '\033[1;36m==>\033[0m %s\n' "$*"; }
warn()  { printf '\033[1;33m[warn]\033[0m %s\n' "$*" >&2; }
die()   { printf '\033[1;31m[error]\033[0m %s\n' "$*" >&2; exit 1; }

# --- preflight: ollama binary ----------------------------------------------

if ! command -v ollama >/dev/null 2>&1; then
  cat >&2 <<'EOF'
[error] Ollama is not installed.

Install it, then re-run this script:

  macOS (Homebrew):  brew install ollama
  macOS (installer): download from https://ollama.com/download

After installing, start the server (Ollama.app, or `ollama serve` in a
separate terminal) and run this script again.
EOF
  exit 1
fi

# --- preflight: ollama server reachable ------------------------------------

if ! curl -fsS "${OLLAMA_HOST}/api/tags" >/dev/null 2>&1; then
  die "Ollama server not reachable at ${OLLAMA_HOST}.
       Start it first: open the Ollama app, or run 'ollama serve' in another terminal.
       (Override the endpoint with OLLAMA_HOST=... if it runs elsewhere.)"
fi

info "Ollama server reachable at ${OLLAMA_HOST}."

# --- pull + alias helper ----------------------------------------------------

pull_and_alias() {
  local model="$1" alias="$2"
  info "Pulling ${model} ..."
  ollama pull "$model"
  info "Aliasing ${model} -> ${alias}"
  ollama cp "$model" "$alias"
}

# --- primary (default) model ------------------------------------------------

pull_and_alias "$PRIMARY_MODEL" "$PRIMARY_ALIAS"

# --- optional heavy model ---------------------------------------------------

if [ "$WITH_14B" -eq 1 ]; then
  warn "The 14B Q4_K_M model sits near the 16 GB ceiling on a Mac mini."
  warn "Keep other memory-heavy apps closed and prefer a modest context window."
  pull_and_alias "$HEAVY_MODEL" "$HEAVY_ALIAS"
fi

# --- verification / next steps ---------------------------------------------

info "Installed models:"
ollama list | sed 's/^/    /'

cat <<EOF

Done. Quick smoke test (non-streaming):

  curl -s ${OLLAMA_HOST}/api/chat -d '{
    "model": "${PRIMARY_ALIAS}",
    "messages": [{"role": "user", "content": "Outline a Python TCP port scanner."}],
    "stream": false
  }' | python3 -m json.tool

Or use the bundled client:

  python3 tools/local-model/query_example.py "Outline a Python TCP port scanner."

Point your own tools at the OpenAI-compatible endpoint:

  base URL : ${OLLAMA_HOST}
  model    : ${PRIMARY_ALIAS}$( [ "$WITH_14B" -eq 1 ] && printf '  (heavier: %s)' "$HEAVY_ALIAS" )
EOF
