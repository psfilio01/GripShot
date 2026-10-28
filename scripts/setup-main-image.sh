#!/usr/bin/env bash
# Install the CPU-only background worker outside the Node/Next bundler.
set -euo pipefail
PROJECT_ROOT="$(cd "$(dirname "$0")/.." && pwd)"
RUNTIME_DIR="$PROJECT_ROOT/vendor/main-image"
SETUP_PYTHON="${MAIN_IMAGE_SETUP_PYTHON:-}"

if [[ -z "$SETUP_PYTHON" && -x "$RUNTIME_DIR/.venv/bin/python" ]]; then
  SETUP_PYTHON="$RUNTIME_DIR/.venv/bin/python"
fi
if [[ -z "$SETUP_PYTHON" ]]; then
  for candidate in python3.12 python3.11 python3.13 python3; do
    if command -v "$candidate" >/dev/null 2>&1 && "$candidate" -c 'import sys; sys.exit(not ((3, 11) <= sys.version_info[:2] <= (3, 13)))' 2>/dev/null; then
      SETUP_PYTHON="$(command -v "$candidate")"
      break
    fi
  done
fi
if [[ -z "$SETUP_PYTHON" ]]; then
  echo "Python 3.11–3.13 is required. Install Python 3.12 and retry, or set MAIN_IMAGE_SETUP_PYTHON to its executable." >&2
  exit 1
fi
"$SETUP_PYTHON" -c 'import sys; assert (3, 11) <= sys.version_info[:2] <= (3, 13), "Python 3.11–3.13 is required"'
mkdir -p "$RUNTIME_DIR"
if [[ ! -x "$RUNTIME_DIR/.venv/bin/python" ]]; then
  "$SETUP_PYTHON" -m venv "$RUNTIME_DIR/.venv"
fi
"$RUNTIME_DIR/.venv/bin/python" -m pip install --disable-pip-version-check -r "$PROJECT_ROOT/scripts/main-image/requirements.txt"
"$RUNTIME_DIR/.venv/bin/python" "$PROJECT_ROOT/scripts/main-image/worker.py" --download-model --model-dir "$RUNTIME_DIR"
"$RUNTIME_DIR/.venv/bin/python" "$PROJECT_ROOT/scripts/main-image/worker.py" --self-test --model "$RUNTIME_DIR/birefnet.onnx"
echo "Main-image worker is ready. Start GripShot with pnpm dev."
