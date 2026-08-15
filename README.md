# Renovate config

Shared Renovate policy for `adamcik` repositories. Presets describe repository
intent, not programming language. Put manager-specific settings in the
application or library profile.

## Baseline

Use a profile in each managed repository:

```json
{
  "$schema": "https://docs.renovatebot.com/renovate-schema.json",
  "extends": ["github>adamcik/renovate-config:application"]
}
```

`default.json`:

- Uses Renovate's `config:best-practices` preset. The application and library
  profiles override its development-dependency pinning rule to preserve their
  range policies.
- Groups digest, pin, patch, and minor updates by manager and update type. An
  automerge-eligible update never shares a pull request with a manual update.
- Creates routine updates and lock-file maintenance each month.
- Runs routine updates on the first day of the month and lock-file maintenance
  on the first Saturday.
- Waits seven days after publication before proposing direct dependency
  updates.
- Limits routine dependency updates to three open pull requests.
- Creates vulnerability-fix pull requests immediately. They bypass the schedule
  and cooldown, but Renovate never automerges them.

Enable GitHub's dependency graph and Dependabot alerts for Renovate's GitHub
vulnerability alerts. Renovate also enables OSV alerts for supported extracted
dependencies.

Renovate's publication cooldown does not cover lock-file maintenance. A lock
refresh can therefore select a newly published transitive dependency. Configure
an equivalent cooldown in the package manager where it supports one, or keep
lock-file maintenance manual when that guarantee is required.

The baseline enables the Nix manager. Git refs do not provide release
timestamps, so those updates may proceed without one; the cooldown still
applies if timestamp support becomes available. CI and the configured schedule
still apply.

## Application profile

Use `application.json` for deployed systems: services, web applications,
command-line applications, and system configurations.

Application manifests define acceptable versions. Committed resolution files
record the deployed dependency graph. Examples: `pyproject.toml` with `uv.lock`,
`Cargo.toml` with `Cargo.lock`, and `flake.nix` with `flake.lock`. Go differs:
`go.mod` selects versions and `go.sum` stores integrity hashes, not a complete
lock.

Routine updates leave a manifest range unchanged while it accepts the latest
release. When a release crosses that range, Renovate proposes a manifest change
for review. Monthly lock-file maintenance updates the complete resolved graph
within the accepted ranges, including development dependencies. The profile
does not automerge updates.

Extend `automerge.json` to opt into Renovate-managed automerge after detected
CI checks pass. It automerges monthly lock-file maintenance and lock-only
Dockerfile, GitHub Actions, and Nix digest pins and updates. It never automerges
a manifest version change, so the declared compatibility policy remains a
reviewed decision:

```json
{
  "extends": [
    "github>adamcik/renovate-config:application",
    "github>adamcik/renovate-config:automerge"
  ]
}
```

GitHub approval rules are optional. Enable Dependency Dashboard approval locally
to require a human decision.

## Library profile

Use `library.json` for packages that other projects consume. Published ranges
define compatibility policy, so Renovate preserves them instead of raising
lower bounds. Set the lower bound to the oldest supported version. Set the upper
bound at a compatibility boundary, not at the latest release. This policy also
applies to development dependencies.

Routine updates leave accepted ranges alone and propose reviewed manifest
changes when a release crosses a compatibility boundary. Lock-file maintenance
updates releases already accepted by the manifest range. This profile does not
automerge library updates unless composed with `automerge.json`.

## Local policy

Set cadence and repository-specific package rules in the consuming repository.
For example, `nix-config` can run weekly while preserving its generated Caddy
dependency bundle:

```json
{
  "extends": [
    "github>adamcik/renovate-config:application",
    "github>adamcik/renovate-config:automerge"
  ],
  "schedule": ["before 06:00 on Saturday"],
  "lockFileMaintenance": {
    "enabled": true,
    "schedule": ["before 06:00 on Saturday"]
  },
  "packageRules": [
    {
      "description": "Keep the generated Caddy dependency bundle together",
      "matchFileNames": ["packages/caddy/**"],
      "groupName": "caddy bundle",
      "groupSlug": "caddy-bundle",
      "separateMultipleMajor": false,
      "prConcurrentLimit": 1,
      "prBodyNotes": ["Run `nix run .#update-caddy` after merging to update the Caddy bundle."]
    }
  ]
}
```

Local rules do not bypass CI, scheduling, or branch protection unless they say
so explicitly.
