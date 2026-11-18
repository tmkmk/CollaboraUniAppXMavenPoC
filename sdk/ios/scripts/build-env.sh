#!/bin/bash
# Source explicitly; do not overwrite the user's shell configuration.
export DEVELOPER_DIR=/Applications/Xcode.app/Contents/Developer
export LANG=en_US.UTF-8
export LC_ALL=en_US.UTF-8
export PATH="/opt/homebrew/opt/python@3.12/bin:/opt/homebrew/opt/gettext/bin:/opt/homebrew/bin:$PATH"
export HBUILDERX_CLI="$HOME/Applications/HBuilderX.app/Contents/MacOS/cli"
export COLLABORA_BUILD_ROOT="$HOME/collabora-build"
# Proxy settings belong to each download command, not the signed application.
