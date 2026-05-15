#!/bin/bash
# Vercel Ignored Build Step
# Blocks builds for the demo branch — it's local-only.
# Set this as the "Ignored Build Step" in Vercel Project Settings:
#   bash scripts/vercel-ignore-build.sh

if [[ "$VERCEL_GIT_COMMIT_REF" == "demo/es-local" ]]; then
  echo "🚫 Branch demo/es-local is local-only. Skipping Vercel build."
  exit 0  # exit 0 = skip build
fi

# All other branches: proceed with build
exit 1  # exit 1 = proceed with build
