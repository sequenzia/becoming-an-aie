#!/usr/bin/env sh
# labs/check_adapter_copies.sh
# Fails when a lab's adapter.py differs from the canonical copy.
# Run it in CI and before each phase commit. It works from any directory.
set -e
cd "$(dirname "$0")/.."
canonical="labs/models-first-measurable-feature/adapter.py"
for lab in labs/tools-tool-contract labs/evals-first-grader; do
  diff -q "$canonical" "$lab/adapter.py"
done
echo "adapter copies are identical"
