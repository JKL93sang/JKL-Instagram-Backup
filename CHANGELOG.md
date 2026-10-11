# Changelog

## 1.5.57 — First Public Release

- First release distributed from the public `JKL-Instagram-Backup` repository.
- Based on the validated 1.5.56 private-development codebase.
- Adds public Tampermonkey distribution metadata:
  - `@homepageURL`;
  - `@supportURL`;
  - `@source`;
  - `@updateURL`;
  - `@downloadURL`.
- Keeps the existing `@name` and `@namespace` unchanged so existing Tampermonkey installations retain the same script identity when upgraded manually to this release.
- Adds a public-distribution regression suite that locks the canonical repository and Raw update URLs.
- Imports the existing regression suites without private development history.
- Anonymizes real account names from public test fixtures.
- Publishes a clean public README, MIT license, pinned GitHub Actions workflow, and Dependabot configuration.
- No scan-engine behavior change from 1.5.56.

## 1.5.56 and earlier — Private Development

Versions up to 1.5.56 were developed and validated in a private repository.

The private commit history is intentionally not copied into this public repository. Public history starts with the distribution-ready 1.5.57 baseline.
