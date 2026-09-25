# OhabTech Host Webkit — r6 Stability Audit

## Scope

This pass reviewed the orchestration layer plus the `slopkit`, `css`, `700`, and `900` trees for failure paths, duplicate execution, stale/mismatched payloads, retry hazards, cache hazards, and unbounded browser-side state.

The exploit algorithms, firmware offsets, kernel patch bytes, ROP chains, and payload bytes were **not modified**. Changes in r6 are defensive/orchestration changes only.

## Findings

### 1. Already-loaded state could look like a hang — fixed

The 700/900 Lapse routes intentionally leave their exploit promise pending after detecting that GoldHEN is already loaded. The chain emits an `already-loaded` stage signal, but the host previously did not treat that signal as terminal unless it came from the DOM heuristic.

**r6 fix:** the host now converts an explicit `payload / already-loaded` stage signal into the existing `Already Loaded` terminal state immediately.

### 2. A late kernel-stage failure could theoretically enter the pre-kernel retry path — hardened

The host normally marks `kernelTouched` when stage progression reaches `kernel`. r6 additionally treats an explicit chain failure reported as `kernel` or `payload` as kernel-touched before entering the central failure handler.

**Result:** a late stage-reporting race cannot accidentally request a page reload after the chain has reported that kernel work began.

### 3. Stale/corrupted GoldHEN file — hardened

The previous preflight only rejected very small payloads. A truncated or stale file larger than 1 KiB could still pass the host preflight.

**r6 fix:** the packaged GoldHEN payload must be exactly 293120 bytes. The exploit code's existing loader-byte sanity check remains in place as a second guard.

Packaged SHA-256:
`df3f27c1b35bc7c40e3a08caab948930914dc7d0301a73b68945cf6ffe40ea12`

### 4. Stale/corrupted CSS/slopkit patch blobs — hardened

The host already checked that patch files existed and were not tiny. r6 additionally verifies the exact expected byte length for every CSS/slopkit patch selected by the supported firmware table.

This does not change patch contents or execution timing; it prevents a stale-cache or accidental file replacement from reaching the kernel-patching stage.

### 5. Internal retry logic in `slopkit/core.js` — reviewed, not rewritten

The core contains an internal retry mechanism. It is already guarded by `retrySafe`, candidate-state checks, mutation checks, persisted attempt state, and an attempt ceiling. Re-timing or removing it without hardware measurements could reduce success rate rather than improve it.

**Decision:** keep the exploit's internal retry state machine unchanged and keep the host-level retry conservative.

### 6. Heavy allocation/spray loops — reviewed, not re-timed

`slopkit/chain_lapse.js` and `chain_poops.js` contain deliberate allocation, socket, AIO, and kernel-memory grooming loops. These are timing-sensitive. Changing loop counts, worker counts, or delays from static inspection alone would be unsafe for stability.

**Decision:** no timing changes were made.

### 7. 13.50 / 13.52 confidence labels need caution

The bundled `slopkit/ps4_offsets.js` itself distinguishes hardware status:

- 13.50: jailbreak state is described as hardware-proven, while the 1350 kernel patch is explicitly marked `UNTESTED-on-hw`.
- 13.52: the status says the chain is live on hardware through shared 13.50 components, while the 1352 patch verification is marked `OFFLINE-ONLY`.
- 12.50/12.52 and 11.52 also contain `UNTESTED-on-hardware` notes.

Therefore the host should not describe every firmware in the 5.05–13.52 range as equally hardware-verified. r6 keeps the routes available but does not silently convert those source-level caveats into a claim of universal hardware stability.

## Static validation

- All JavaScript files pass `node --check` syntax validation.
- Cache manifest entries were checked against files present in the package.
- GoldHEN and patch file sizes were checked.
- No exploit offsets or kernel patch bytes were changed in this audit.

## Firmware coverage represented by this package

The host has explicit routes for:

5.05, 5.07; 7.00, 7.01, 7.02, 7.50, 7.51, 7.55, 8.00, 8.01, 8.03, 8.50, 8.52; 9.00, 9.03, 9.04, 9.50, 9.51, 9.60; 10.00, 10.50, 11.00, 11.02; 11.50, 11.52; 12.00, 12.02, 12.50, 12.52; 13.00, 13.02, 13.04, 13.50, 13.52.

The package intentionally does not invent routes for gaps such as 10.01, 10.70, 10.71, 11.03–11.49, 12.03–12.49, or 13.01.

## r6 conclusion

The largest stability improvements available from static inspection are now in the **host boundary**: correct terminal handling, conservative post-kernel failure behavior, and protection against stale/mismatched payload/patch files.

The remaining instability risk is inside the firmware-specific exploit chains themselves and is timing/hardware dependent. Those parts should be changed only with controlled per-firmware test results.
