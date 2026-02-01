# Development Logs

## 2026-02-01: .org.il domains incorrectly grouped together

### Bug
All URLs ending in `.org.il` are grouped under the single domain `org.il`, instead of being separated by their registrable domain (e.g. `example.org.il`, `other.org.il`).

This does not happen for `.co.il` domains, which are correctly grouped (e.g. `bank.co.il` stays separate from `shop.co.il`).

### Root Cause
The `MULTI_PART_TLDS` array includes `co.il` but does **not** include `org.il`. When a URL like `https://example.org.il/page` is processed, none of the multi-part TLD entries match, so the fallback logic `parts.slice(-2).join(".")` runs and returns `org.il` — the TLD itself — as the "domain". This collapses every `.org.il` site into one group.

### Fix
Add `"org.il"` to the `MULTI_PART_TLDS` array so that `.org.il` domains receive the same three-part extraction as `.co.il`.

### Verification
Added a test case: `extractDomain("https://example.org.il/page") === "example.org.il"`. Confirmed the test fails before the fix and passes after.
