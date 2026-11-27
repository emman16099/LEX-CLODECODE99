#!/usr/bin/env bash
# Installs Video Vision MCP (OAMaestro/video-vision-mcp) at a reviewed commit, applies two fixes,
# downloads the Whisper model, and registers it with Claude Code as "video-vision".
# Safe to run more than once. Needs: git, node >= 18, npm. Works on Linux and macOS.
set -euo pipefail

COMMIT=cb854278518c46943a5b9e89643f2e29c7aca839   # reviewed 2026-11-27
HERE="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
DEST="${VIDEO_VISION_DIR:-$HOME/.local/share/video-vision-mcp}"
MODEL_DIR="$HOME/.oamaestro/models/Xenova/whisper-base"

# 1. Source at the pinned commit (the npm package named in its README does not exist)
if [ ! -d "$DEST/.git" ]; then
  mkdir -p "$(dirname "$DEST")"
  git clone -q https://github.com/OAMaestro/video-vision-mcp "$DEST"
fi
cd "$DEST"
git fetch -q origin "$COMMIT" 2>/dev/null || true
git checkout -q -f "$COMMIT"

# 2. Fixes: use the q8 Whisper model, and pass decoded audio (Node has no AudioContext)
git apply "$HERE/fixes.patch"

# 3. Dependencies (skip GPU-only CUDA download) and build
ONNXRUNTIME_NODE_INSTALL_CUDA=skip npm ci --no-audit --no-fund --loglevel=error
./node_modules/.bin/tsc -p .

# 4. Whisper base model (q8). Normally fetched from Hugging Face on first use;
#    here it comes from the npm package sts-whisper-base so it also works where Hugging Face is blocked.
if [ ! -f "$MODEL_DIR/onnx/encoder_model_quantized.onnx" ]; then
  TMP="$(mktemp -d)"
  (cd "$TMP" && npm pack -q sts-whisper-base@1.0.0 >/dev/null && tar xzf sts-whisper-base-1.0.0.tgz)
  mkdir -p "$(dirname "$MODEL_DIR")"
  rm -rf "$MODEL_DIR"
  cp -r "$TMP/package/models/Xenova/whisper-base" "$MODEL_DIR"
  rm -rf "$TMP"
fi

# 5. Register with Claude Code for this user (the MCP server is dist/index.js, not the CLI)
if command -v claude >/dev/null 2>&1; then
  claude mcp remove video-vision -s user >/dev/null 2>&1 || true
  claude mcp add video-vision -s user -- node "$DEST/dist/index.js"
fi
echo "video-vision MCP ready: node $DEST/dist/index.js"
