#!/bin/bash
set -eu
source "$HOME/collabora-build/build-env.sh"
# Optional PID is the already running brew job; never start a duplicate install.
if [ -n "${1:-}" ]; then
  while kill -0 "$1" 2>/dev/null; do sleep 10; done
fi
for tool in autoconf automake libtool pkgconf cmake ninja ccache gperf nasm gettext wget python@3.12; do
  /opt/homebrew/bin/brew list --versions "$tool"
done
/opt/homebrew/opt/python@3.12/bin/python3.12 -m venv "$HOME/collabora-build/venv"
export https_proxy=http://127.0.0.1:7897
export http_proxy=http://127.0.0.1:7897
"$HOME/collabora-build/venv/bin/pip" install --timeout 30 polib lxml cryptography
"$HOME/collabora-build/venv/bin/python" -c 'import polib, lxml, cryptography; print("Python dependencies ready")'
date -u > "$HOME/collabora-build/bootstrap-tools-complete"
