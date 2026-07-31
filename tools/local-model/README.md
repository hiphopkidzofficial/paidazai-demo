# Local model setup (M4 Mac mini, 16 GB)

A private, offline, refusal-reduced coding model for security research, code
auditing, and reverse-engineering work — served locally through
[Ollama](https://ollama.com) and reachable over an OpenAI-compatible HTTP API at
`http://localhost:11434`.

This lives beside the game and does not touch it. It is a standalone dev tool.

## Quick start

```bash
# 1. Install Ollama (once): brew install ollama  — or https://ollama.com/download
# 2. Start it: open the Ollama app, or run `ollama serve` in another terminal
# 3. Pull + alias the default model:
bash tools/local-model/setup.sh

# Optional: also pull the heavier 14B model (near the 16 GB ceiling):
bash tools/local-model/setup.sh --with-14b
```

Then query it:

```bash
python3 tools/local-model/query_example.py "Outline a Python TCP port scanner."
```

The setup script aliases the long Hugging Face model name to a stable short
name, **`paidazai-recon`**, so your own scripts and editor plugins can target a
name that never changes even if you swap the underlying model.

## Models

| Role | Model (Ollama tag) | Quant | Weights | 16 GB fit |
| --- | --- | --- | --- | --- |
| **Default** | `hf.co/BlossomsAI/Qwen2.5-Coder-7B-Instruct-Uncensored-GGUF:Q8_0` | Q8_0 | ~8 GB | Comfortable — fast, headroom for context |
| Optional | `hf.co/bartowski/Qwen2.5-Coder-14B-Instruct-abliterated-GGUF:Q4_K_M` | Q4_K_M | ~9 GB | Tight — close a few apps, keep context modest |

The 7B Q8_0 is the everyday driver: near-lossless quality at 8-bit, fast on the
M4, and leaves memory for a decent context window. Reach for the 14B only when
the 7B struggles with dense/obfuscated reverse-engineering logic — on 16 GB it
runs, but sits near the ceiling once the KV cache grows.

## Corrections to the original guide

The guide this setup came from had one command that does **not** work, plus a
repo-type mixup. Both are fixed above.

- ❌ `ollama run hf.co/mradermacher/Qwen2.5-Coder-14B-Instruct-abliterated-GGUF:Q4_K_M`
  — this repo does not exist. `mradermacher` publishes the *Uncensored* 14B, not
  an *abliterated* 14B GGUF.
- ✅ Use instead: `hf.co/bartowski/Qwen2.5-Coder-14B-Instruct-abliterated-GGUF:Q4_K_M`,
  or the Ollama-native `ollama run huihui_ai/qwen2.5-coder-abliterate:14b-instruct`.
- Note: `huihui-ai/Qwen2.5-Coder-14B-Instruct-abliterated` on Hugging Face is
  full-precision transformers weights (not GGUF), so it is not directly pullable
  with `ollama run hf.co/...`.
- ✅ The 7B default `hf.co/BlossomsAI/Qwen2.5-Coder-7B-Instruct-Uncensored-GGUF:Q8_0`
  is correct as given.

## Using the API

Ollama exposes a local HTTP API. Non-streaming chat example:

```bash
curl -s http://localhost:11434/api/chat -d '{
  "model": "paidazai-recon",
  "messages": [{"role": "user", "content": "Explain this crash dump."}],
  "stream": false
}' | python3 -m json.tool
```

It also speaks the OpenAI chat-completions format at
`http://localhost:11434/v1/chat/completions`, so most OpenAI SDKs and VS Code
plugins work by pointing their base URL there and using `paidazai-recon` as the
model name (any API key value is accepted locally).

`query_example.py` is a zero-dependency reference client (stdlib only). It reads
`OLLAMA_HOST` and `OLLAMA_MODEL` from the environment if you need to override the
endpoint or model.

## A note on these models

These are refusal-reduced ("uncensored" / "abliterated") variants: safety
guardrails have been removed, and they have not undergone safety optimization.
That makes them useful for legitimate security and reverse-engineering work
where standard models over-refuse — and it also means you own the outputs. Use
them for authorized, lawful work only.
