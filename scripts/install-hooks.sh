#!/usr/bin/env bash
set -euo pipefail

repo_root="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$repo_root"

# Use versioned hooks committed to the repo.
git config core.hooksPath .githooks

chmod +x .githooks/pre-commit
chmod +x scripts/bump_build.py

echo "Installed git hooks (core.hooksPath=.githooks)."
