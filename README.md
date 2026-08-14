# Renovate config

Shared Renovate policy for `adamcik` repositories. Presets describe repository
intent rather than implementation language; manager-specific behavior belongs
inside the application or library profile when it is needed.

## Baseline

All managed repositories extend the baseline:

```json
{
  "$schema": "https://docs.renovatebot.com/renovate-schema.json",
  "extends": [
    "github>adamcik/renovate-config",
    "github>adamcik/renovate-config:application"
  ]
}
```

`default.json`:

- Uses Renovate's `config:best-practices` preset.
- Groups non-major updates to avoid a stream of individual pull requests.
- Creates routine updates and lock-file maintenance monthly.
- Waits seven days after publication before proposing routine updates.
- Limits routine dependency pull requests to three at a time.
- Raises known-vulnerability fixes immediately, outside the normal schedule and
  cooldown, but never automerges them.

GitHub's dependency graph and Dependabot alerts must be enabled for Renovate's
GitHub vulnerability alerts. OSV alerts are also enabled for supported extracted
dependencies.

## Application profile

Use `application.json` for software deployed and operated as a complete system.
This includes services, command-line applications, and system configurations.

Application manifests describe acceptable inputs while committed resolution
files describe the exact deployed graph. Examples include `pyproject.toml` with
`uv.lock`, `Cargo.toml` with `Cargo.lock`, and `flake.nix` with `flake.lock`. Go
is different: `go.mod` participates in version selection and `go.sum` provides
integrity hashes rather than a complete lock.

The profile prefers resolution-only updates while the existing manifest range
accepts a release. Digest, pin, patch, minor, and lock-file-maintenance pull
requests are eligible for automerge.

Automerge eligibility is not an approval policy. Each consuming GitHub
repository must have a ruleset that requires at least one approval and the
relevant status checks. Renovate then enables platform automerge and GitHub
merges only after those requirements pass. Without that ruleset, eligible pull
requests can merge without human approval.

## Library profile

Use `library.json` for packages consumed as dependencies by other projects.
Published ranges communicate compatibility intent, so Renovate preserves those
ranges instead of routinely raising their lower bounds. A range should normally
use the oldest intentionally supported version as its lower bound and a natural
compatibility boundary, not the latest known release, as its upper bound.

Releases already accepted by a manifest range flow through lock-file
maintenance. Crossing an upper compatibility boundary remains a visible,
manual manifest change. Library updates are not automerged by this profile.

## Local policy

Cadence and trust exceptions stay in the consuming repository. For example,
`nix-config` can update weekly and exempt explicitly listed, self-maintained
flake inputs from the publication cooldown:

```json
{
  "extends": [
    "github>adamcik/renovate-config",
    "github>adamcik/renovate-config:application"
  ],
  "schedule": ["before 06:00 on Saturday"],
  "lockFileMaintenance": {
    "enabled": true,
    "schedule": ["before 06:00 on Saturday"]
  },
  "packageRules": [
    {
      "description": "Inputs maintained in this account do not need a publication cooldown",
      "matchManagers": ["nix"],
      "matchPackageNames": ["adamcik/example"],
      "minimumReleaseAge": null
    }
  ]
}
```

List trusted inputs explicitly. A cooldown exemption does not bypass CI,
approval, scheduling, or branch protection.
