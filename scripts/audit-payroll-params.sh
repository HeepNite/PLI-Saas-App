#!/usr/bin/env bash
# audit-payroll-params.sh
#
# Ensures every dynamic API route under app/api/staff/payroll/** uses the
# Next 15 `context: { params: Promise<...> }` signature with `await context.params`.
#
# Fails (exit 1) if any dynamic payroll route still uses the old Next 14
# non-Promise params shape (`params: { ... }` without `Promise<`).
#
# Part of: payroll-flow-integrity-audit (Fix #4 regression guard).

set -eu

PROJECT_ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$PROJECT_ROOT"

# Portable listing of dynamic route files under app/api/staff/payroll at any
# depth (dynamic segments are conventionally named `[name]`). We write the
# paths to a tmp file instead of using `mapfile` so this works on macOS's
# default bash 3.2 without requiring bash 4+.
TMP_LIST="$(mktemp)"
trap 'rm -f "$TMP_LIST"' EXIT

find app/api/staff/payroll -type f -name 'route.ts' -path '*\[*\]*' 2>/dev/null | sort > "$TMP_LIST"

ROUTE_COUNT="$(wc -l < "$TMP_LIST" | tr -d ' ')"

if [ "$ROUTE_COUNT" -eq 0 ]; then
  echo "WARN: No dynamic payroll route files found under app/api/staff/payroll/**/[*]/route.ts"
  echo "      (If you expected routes here, investigate before marking this audit as PASS.)"
  exit 0
fi

echo "Auditing $ROUTE_COUNT dynamic payroll route file(s) for Next 15 params signature..."

OFFENDERS_FILE="$(mktemp)"
trap 'rm -f "$TMP_LIST" "$OFFENDERS_FILE"' EXIT

while IFS= read -r file; do
  # A compliant route declares its params type as `Promise<{...}>`. We look
  # for `params: Promise<` anywhere in the file (the `:` may have optional
  # whitespace before `Promise<`). If absent, flag the file.
  if ! grep -qE 'params:[[:space:]]*Promise<' "$file"; then
    echo "$file" >> "$OFFENDERS_FILE"
  fi
done < "$TMP_LIST"

OFFENDER_COUNT="$(wc -l < "$OFFENDERS_FILE" | tr -d ' ')"

if [ "$OFFENDER_COUNT" -gt 0 ]; then
  echo "FAIL: The following dynamic payroll routes do NOT use Promise<> params:"
  while IFS= read -r f; do
    echo "  - $f"
  done < "$OFFENDERS_FILE"
  exit 1
fi

echo "PASS: All $ROUTE_COUNT dynamic payroll route(s) use Promise<> params."
while IFS= read -r f; do
  echo "  ✓ $f"
done < "$TMP_LIST"
exit 0
