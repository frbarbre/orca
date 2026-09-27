#!/usr/bin/env bash
# Runs the tests covering this fork's own changes, which a sync must not break.
#
# Why derived rather than listed: the fork's tests are exactly the test files its own commits
# touched, and a commit reachable from upstream/main is upstream's. A hand-kept list goes stale
# the first time a fork change adds a test and nobody remembers to add it here.
set -euo pipefail

if ! git remote get-url upstream >/dev/null 2>&1; then
  git remote add upstream https://github.com/stablyai/orca.git
fi
git fetch upstream main --quiet --no-tags

files=()
while IFS= read -r file; do
  # e2e suites need a real app and display; they are never part of Verify.
  case "$file" in tests/e2e/*) continue ;; esac
  [ -f "$file" ] && files+=("$file")
done < <(
  git log --no-merges --format= --name-only upstream/main..HEAD -- \
    '*.test.ts' '*.test.tsx' '*.test.mjs' | sort -u
)

if [ "${#files[@]}" -eq 0 ]; then
  echo "No fork-owned tests found between upstream/main and HEAD."
  exit 0
fi

echo "Running ${#files[@]} fork-owned test files."
pnpm test "${files[@]}"
