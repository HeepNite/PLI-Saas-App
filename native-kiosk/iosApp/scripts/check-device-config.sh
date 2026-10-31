#!/usr/bin/env bash
# Build guard for the iPad kiosk reader pins. Intended as an Xcode Run Script build phase, which
# exports CONFIGURATION, PLI_M2_SERIAL and PLI_STRIPE_LOCATION from the xcconfig layers.
# Only Debug may carry placeholders; Release, AdHoc, unset or unknown configurations are strict.
set -u

serial_pattern='^STRM2[A-Z0-9]+$'
location_pattern='^tml_[A-Za-z0-9]+$'
configuration="${CONFIGURATION:-}"
serial="${PLI_M2_SERIAL:-}"
location="${PLI_STRIPE_LOCATION:-}"

valid=1
if [[ ! "$serial" =~ $serial_pattern ]]; then
  echo "error: PLI_M2_SERIAL must match $serial_pattern (set it in Config/Device-iPad.xcconfig)" >&2
  valid=0
fi
if [[ ! "$location" =~ $location_pattern ]]; then
  echo "error: PLI_STRIPE_LOCATION must match $location_pattern (set it in Config/Device-iPad.xcconfig)" >&2
  valid=0
fi

if [ "$valid" -eq 1 ]; then exit 0; fi
if [ "$configuration" = "Debug" ]; then
  echo "warning: reader pins are placeholders or malformed; allowed only for Debug" >&2
  exit 0
fi
echo "error: refusing to build configuration '${configuration:-unset}' with invalid reader pins" >&2
exit 1
