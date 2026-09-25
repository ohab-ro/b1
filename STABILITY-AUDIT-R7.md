# OhabTech Host Webkit — r7 Full Static Audit

## Scope

This pass reviewed all 96 packaged files (JavaScript, HTML, manifests, ELF/patch blobs and documentation) for:
- syntax errors;
- manifest/cache consistency;
- stale AppCache versioning;
- mixed old/new resource execution;
- route/firmware gating;
- dynamic module/resource references;
- retry/watchdog state handling;
- unbounded browser-side logging/timers;
- payload/patch file size guards;
- firmware-specific configuration caveats.

The firmware offsets, ROP chains, kernel patch bytes, exploit primitives, and GoldHEN payload bytes were not altered.

## Findings fixed in r7

### 1. AppCache manifest revision was stale
All manifests still identified themselves as r4. On systems using Application Cache, that makes it easier to retain an older cached resource set after a host update.

**Fix:** all six manifests now carry an r7 cache revision marker.

### 2. UPDATE_READY cache state could be mishandled
The host did not explicitly handle an initial Application Cache status of `UPDATE_READY` before calling `cache.update()`.

**Fix:** r7 activates the ready cache and performs the controlled reload before exploit execution.

### 3. Mixed-cache execution hazard
The old host could continue after a long cache operation and then execute while an AppCache update was still unresolved. That can produce a mixed set of cached and network resources.

**Fix:** r7 no longer starts the exploit after a 60-second unresolved cache update. It stops and asks for a clean reload instead.

### 4. Obsolete cache state
An obsolete AppCache state had no explicit recovery path.

**Fix:** r7 requests a fresh cache update instead of silently proceeding with an uncertain cache state.

### 5. Stale visible version strings
The page metadata and preflight banner still said r4 while the code identified itself as r6.

**Fix:** visible and internal host version is now r7.

### 6. Unsupported-firmware notice was incomplete
The previous notice listed only some gaps and could be read as if all other unlisted gaps were harmless.

**Fix:** wording now states that only firmware versions explicitly present in the route table are eligible; non-exact family matches remain blocked before launch.

## Findings intentionally not changed

### 7. Exploit timing loops
`slopkit/chain_lapse.js`, `slopkit/chain_poops.js`, `slopkit/jb.js`, `700/lapse.js`, `900/lapse.js`, and the PSFree modules contain deliberate allocation, race, socket/AIO, worker and kernel-memory timing. Static editing cannot establish a better timing profile for real PS4 hardware.

### 8. Firmware offsets and patch data
The offset tables and binary patches are firmware-specific. Changing them without matching dumps or hardware test results would be unsafe.

### 9. 13.50/13.52 confidence caveats
`slopkit/ps4_offsets.js` itself marks parts of the 13.50/13.52 kernel patch verification as not hardware-verified/offline-only. r7 does not relabel those claims as universal hardware verification.

## Static validation

- JavaScript files: `node --check` passes.
- Inline JavaScript extracted from `index.html`: syntax-valid.
- AppCache manifest revision: r7 on all six manifests.
- Payload size: 293120 bytes.
- CSS/slopkit patch sizes match the host's expected-size table.
- Package contains 96 files, approximately 2.43 MB.
- No firmware offsets, ROP chains, kernel patch bytes, or payload bytes were changed by the r7 stability pass.

## Important remaining risk

The remaining failure modes are primarily hardware/timing-dependent inside the firmware-specific exploit chains. The host layer can prevent stale/mixed resources and unsafe retries, but it cannot prove a kernel race is stable on every console without per-firmware hardware testing.
