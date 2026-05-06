#!/usr/bin/env bash
set -euo pipefail

BACKEND_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
VENV_DIR="$BACKEND_DIR/.venv-lvchordia"
REQUIREMENTS="$BACKEND_DIR/ml/requirements.txt"

cd "$BACKEND_DIR"

find_python() {
  for candidate in python3.12 python3.11 python3 python; do
    if command -v "$candidate" >/dev/null 2>&1; then
      "$candidate" -c 'import sys; raise SystemExit(0 if sys.version_info >= (3, 10) else 1)' && {
        command -v "$candidate"
        return 0
      }
    fi
  done
  return 1
}

if [ ! -x "$VENV_DIR/bin/python" ]; then
  PYTHON_BIN="$(find_python)" || {
    echo "Python 3.10+ is required to set up lv-chordia." >&2
    exit 1
  }
  echo "Creating lv-chordia Python environment with $PYTHON_BIN..."
  "$PYTHON_BIN" -m venv "$VENV_DIR"
fi

PYTHON_EXE="$VENV_DIR/bin/python"

"$PYTHON_EXE" -m ensurepip --upgrade
"$PYTHON_EXE" -m pip install --upgrade pip setuptools wheel
"$PYTHON_EXE" -m pip install -r "$REQUIREMENTS"

"$PYTHON_EXE" -c "import torch, lv_chordia; print('lv-chordia ready'); print('mps_available=', getattr(torch.backends, 'mps', None) is not None and torch.backends.mps.is_available()); print('cuda_available=', torch.cuda.is_available()); print('device=', torch.cuda.get_device_name(0) if torch.cuda.is_available() else 'CPU')"
