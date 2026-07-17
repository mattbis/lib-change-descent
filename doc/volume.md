# Volume Management & Real-World Considerations (`libcd_Volume`)

This document preserves the core real-world design philosophy, behavioral observations, and original architectural comments for volume management across `lib-change-descent`.

---

## 1. Core Philosophy: Sympathy to the Real World

Define volume management with sympathy to the **REAL WORLD** that we are addressing.
Operating systems and physical drives behave in wildly asymmetric ways under load, across drive types, and when encountering OS/antivirus quirks.

---

## 2. Volume Species (`LIBCD_VOL_SPECIES`)

- **`fixed`**: Mark as fixed. Cannot be fixed *and* removable.
- **`removable`**: Mark as volatile. Can be removable *and* temporary.
- **`temporary`**: Mark as less important. Can be RAM, fixed, or removable — has no speed restrictions.

---

## 3. Volume Types (`LIBCD_VOL_TYPE`) & Physical Drive Behaviors

### `ram`
- Volatile, temporary. Needs to know if dynamic or fixed. Operates with similar high-speed expectations to SSD.

### `vm`
- Virtual machine volume pointing to underlying SSD or HDD. Requires careful interaction and exclusive/coordinated I/O boundaries.

### `ssd`
- Avoid writes when necessary; take advantage of speed.
- Handles many small files well.
- Can burst when bus controllers aren't busy.
- Can handle both concurrent write and read operations.

### `hdd`
- Backup is better — since if not used, it will retain data.
- Writes are mostly slower; fragmentation in some filesystems is awful for speed.
- Doesn't handle many small files well. One big file is better.
- Can burst when not busy.
- Should only be doing **one operation type at a time**: either read *or* write (exclusive I/O).

---

## 4. Discovery Strategies (`LIBCD_VOL_DISCOVER_STRATEGY`)

- **`sequential`**: One by one traversal.
- **`staggered`**: Groups of queries executed in an ordered procession.
- **`random_sample`**: Random sample of the possible total across nodes/volumes.

*Note on Redesign:* The volume discovery strategies are almost the same thing structurally. This led to redesigning them as **behavioral** driven by active Vole Masks (`busy` / `present` activity checks), since the operations share identical retry/yield boundaries.

---

## 5. OS Quirks, Drive Letters, & Identifiers (`identifiers`)

- I almost feel like `identifiers` is recreated and static (`static.identifiers`), storing all known OS-dependent volume paths/drive identifiers seen, which then serves as a metric that can be observed or queried.
- **The OS Problem:** Operating systems are stupid — Windows can arbitrarily change drive letters in certain USB/mount scenarios.
- **Internal Fingerprinting Intelligence:**
  - `TODO (matt):` We need an intelligence that knows what has not been changed for some time and uses this as an internal fingerprint of what disk it likely is.
  - However, if the user changes the contents of a disk frequently, it is very hard to infer strictly from content diffs without an imprint or persistent marker.

---

## 6. Access Control Logs (`acl_log`) & Event Log Pollution

- `acl_log` stores when something raised an exception that bubbled up and made an operation hang... or succeed.
- **Log Pollution Warning:** `TODO (matt):` Beware of log pollution and recording too many events of the same type. Windows does a ton of event logging natively, and excessive logging burns valuable CPU cycles.

---

## 7. Ownership Manifests & Virus Scanners (`lib_cd.volume.imprint`)

- **`lib_cd.volume.imprint`:** Creates a user-space marker of the disk ID that does not trip external virus detection or endpoint security for no good reason.
- **Failure Recovery & Retry Policy:**
  - If it cannot imprint right away, bubble the highest log.
  - If it cannot write due to contention or locking, **retry 3 times over a long period privately**.
- **Manifest Location:** The first imprint is an ownership manifest that lives in the volume root under `\libcd\var\db`.
- **Fixed Disk Optimization:** If you only have fixed disks, you can skip this stage entirely via profile modifiers (`+skip_fixed`) or programmatically.
- **Savvy User Assumption:** In many arguments, you could say "just disable the virus scanner if you know what you are doing." If a user has this many disks and is running `lib-change-descent`, we can assume a certain technical savvyness.
