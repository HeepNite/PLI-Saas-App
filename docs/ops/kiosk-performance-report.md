# Kiosk Performance Report — PIN pad / check-in flow

**Date:** 2026-11-07
**App:** `com.pli.kiosk.livefoundation` v1.3.6 (`com.pli.kiosk.android.KioskWebActivity`, WebView-based)
**Device:** Samsung Galaxy Tab S4 (SM-T727V), Android 11, 3.7 GB RAM, Adreno 512 GPU, 2560x1600
**WebView:** 156.0.8078.47

## TL;DR

The device is healthy; the web UI is too expensive to render on this GPU.
During real use of the PIN pad and payment flow, **89% of frames were janky** and
1166 frames had high input latency. Taps feel delayed. The fix belongs in the
web front-end (CSS and input handling), not in Android.

## Device state ruled out

Measured right after a device cleanup (42 unused or bloat apps removed, kiosk exempted from battery optimization):

| Check | Value | Verdict |
|---|---|---|
| Free RAM | ~1.2–1.5 GB available | OK |
| Battery / power saver | 70%, charging, saver off | OK |
| Thermal | AP 36 °C, status 0 | OK, no throttling |
| CPU frequency | at max (1.7 GHz) | OK |
| Cold start (`am start -W`, 3 runs) | 531 / 517 / 486 ms | OK |
| Kiosk memory (PSS) | 225–296 MB, no swap | OK |
| Crashes / ANRs | none | OK |

## Measurement: real usage (60 s, 49 taps, PIN pad + payment flow)

`dumpsys gfxinfo com.pli.kiosk.livefoundation`:

| Metric | Value | Target |
|---|---|---|
| Total frames | 1385 | — |
| Janky frames | **1231 (88.9%)** | < 10% |
| Frame time p50 / p90 / p95 / p99 | 20 / 42 / 53 / 73 ms | < 16.7 ms |
| High input latency | **1166** | ~0 |
| Slow UI thread | 116 | low |
| Slow issue draw commands | 206 | low |
| Frame deadline missed | 208 | low |
| Missed vsync | 63 | low |

SurfaceFlinger: 1606 frames, 23 missed.
For comparison, the idle check-in screen produced only 17 frames in 40 s, so the cost comes from interaction and overlays, not from idle animation.

## Causes (verified against the source)

The hypotheses came from screenshots of the running app. Each one was then checked against the code on 2026-11-07.

| # | Cause | Status | Evidence |
|---|---|---|---|
| 1 | `backdrop-filter: blur(...)` on overlay backdrops | **Confirmed** | `components/front/checkin/KioskPinModal.tsx:47` (`backdrop-blur-sm`), `components/front/payments/StripePaymentModal.tsx:20` (`backdrop-blur-md`). 78 files use backdrop blur, several in `components/front/checkin/`. |
| 2 | Large shadows, gradients and translucent layers over the blur | **Confirmed** | `KioskPinModal.tsx:52`: three stacked gradients, a large `box-shadow` and a `ring`. `KioskPinModal.tsx:150`: the caret uses `animate-pulse`, which repaints continuously under the blur. |
| 3 | PIN pad keys react on `click` | **Confirmed** | `components/front/checkin/KioskNumericKeypad.tsx`: every key uses `onClick`, with no `touch-action` and no `pointerdown`. The pressed state animates `box-shadow` and `scale` through a generic `transition` (all properties). |
| 4 | Native keyboard opens on numeric fields | **Partly wrong** | The PIN display in `KioskPinModal.tsx` is a `div`, not an input, so the native keyboard never opens there. Phone and code inputs already set `inputMode` (`lib/checkin/sign-in-inputs.ts`). The coupon field (`components/front/courses/enroll/steps/StepPayments.tsx:210`) opens QWERTY, which is expected because coupon codes contain letters. |
| 5 | Each keypress re-renders a large tree | **Likely, not measured** | The phone state and `onPinDigitInput` live above `CheckInQrShell.tsx` (570 lines), and `KioskNumericKeypad` is not memoized. Confirm with the React Profiler before changing it. |
| 6 | Hardware acceleration in the Android activity | **Out of scope here** | It lives in the Android wrapper repository, not in this web repository. |

Why 1 to 3 matter on this device: a backdrop blur is recomputed every frame where something under or over it changes (key highlight, caret). This is very expensive on Adreno 512 and matches the slow draw commands and missed deadlines. Keys that wait for `click` add gesture-disambiguation delay, which matches the high-input-latency count.

## Recommended changes (in priority order)

1. Replace `backdrop-filter` blur on overlays with a plain semi-transparent background, for example `background: rgba(0,0,0,.6)`. Check every modal, dialog and sheet.
2. On the PIN pad keys and container:
   - add `touch-action: manipulation`;
   - handle `pointerdown` (or `touchstart`) instead of `click`, so feedback is immediate;
   - use `transform` and `opacity` for the pressed-state animation, never `box-shadow`, `filter` or layout properties.
3. Reduce or simplify large `box-shadow` values and continuously animated elements (such as the pulsing caret). Add `will-change: transform` only to elements that actually animate, not globally.
4. Profile first, then memoize or isolate the PIN pad if a keypress re-renders the modal or page.
5. No change needed for numeric inputs: PIN, phone and code fields already avoid or configure the native keyboard. Keep the coupon field as free text.
6. Optional, in the Android repository: confirm hardware acceleration is on (`android:hardwareAccelerated="true"`, default on API 14+).

## Acceptance criteria

Run the same 60 s real-usage measurement (PIN entry plus payment flow) after the changes:

- Janky frames under **15%** (ideally under 10%).
- Frame time p90 at or under **20 ms**.
- High input latency count drops by an order of magnitude.
- No visual regression the operator would notice.

## How to re-measure

```bash
ADB=~/Library/Android/sdk/platform-tools/adb
PKG=com.pli.kiosk.livefoundation

# Reset counters, then use the PIN pad for ~60 s on the tablet
$ADB shell dumpsys gfxinfo $PKG reset
# ... interact ...
$ADB shell dumpsys gfxinfo $PKG | grep -E 'Total frames|Janky|percentile|Number'

# Cold start
$ADB shell am force-stop $PKG
$ADB shell am start -W -n $PKG/com.pli.kiosk.android.KioskWebActivity | grep TotalTime

# Inspect the live WebView from desktop Chrome (Performance + Rendering > Paint flashing / Layer borders):
# chrome://inspect  (requires WebView debugging enabled in the app)
```

For deeper analysis, use the Chrome DevTools Performance panel over `chrome://inspect`. That needs `WebView.setWebContentsDebuggingEnabled(true)` in debug builds. Look for long "Paint" and "Composite Layers" tasks, and for "Raster" on the GPU thread while typing.

## Raw data

Saved on the Mac in `~/tablet-backup-20261107/`:

- `gfx-pad.txt`: full `dumpsys gfxinfo` from the real-usage run
- `ts-pad.txt`: SurfaceFlinger timestats from the same run
- `touch.txt`: raw touch events (`getevent -lt`)
- `timestats.txt`: idle check-in screen baseline
