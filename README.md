# Renovate config

Shared Renovate policy for my repositories. Choose a preset by what the
repository publishes or deploys, not by its language. The baseline supplies
common policy, including dependency grouping; keep repository-specific rules in
the consuming repository.

## Start here

Deployed software should use the application profile:

```json
{
  "$schema": "https://docs.renovatebot.com/renovate-schema.json",
  "extends": ["github>adamcik/renovate-config:application"]
}
```

| Profile       | Use for                                     | Version-range policy                                                           | Automerge                                                                                              |
| ------------- | ------------------------------------------- | ------------------------------------------------------------------------------ | ------------------------------------------------------------------------------------------------------ |
| `application` | Services, apps, CLIs, system configurations | Advance the declared range when the latest release falls outside it            | Off by default                                                                                         |
| `library`     | Packages consumed by other projects         | Preserve published ranges; lower bounds represent the oldest supported version | Off by default                                                                                         |
| `automerge`   | An opt-in composed with either profile      | No range changes                                                               | Lock-file maintenance and lock-only Dockerfile, GitHub Actions, and Nix digest updates after CI passes |

```json
{
  "extends": [
    "github>adamcik/renovate-config:application",
    "github>adamcik/renovate-config:automerge"
  ]
}
```

`automerge` deliberately excludes manifest version changes. Those changes alter
the declared compatibility policy and require review.

## Baseline policy

All profiles extend `default.json`, which:

- Uses Renovate's `config:best-practices` and runs routine updates monthly.
- Groups patch, minor, pin, and digest updates by manager and update type,
  except Go, npm, PEP 621, and Cargo minor and patch updates, which share one
  group per manifest. Known upstream release families retain their major-update
  groups; other routine major updates remain individual. Automergeable and
  manual work do not share a pull request.
- Updates lock files on the first Saturday and allows at most three routine
  dependency pull requests at once.
- Waits seven days before proposing direct dependency releases.
- Creates non-automergeable security pull requests immediately, bypassing the
  schedule and release-age delay. Go, npm, PEP 621, and Cargo security fixes
  available on the same run share one security PR per manifest, separate from
  routine updates. A single fix is enough; there is no batching delay.
- Enables the Nix manager and OSV alerts for supported extracted dependencies.

Enable GitHub's dependency graph and Dependabot alerts to receive Renovate's
GitHub vulnerability alerts.

## Dependency grouping

All profiles inherit these project boundaries:

| Manager  | Default boundary                            |
| -------- | ------------------------------------------- |
| `gomod`  | One `go.mod`, including Go/toolchain edits  |
| `npm`    | One `package.json` for npm, Yarn, or pnpm   |
| `pep621` | One `pyproject.toml`, including uv projects |
| `cargo`  | One `Cargo.toml` for Rust crates            |

Manifest paths scope routine, security, and major-update branches. Different
projects stay separate even when they use the same dependencies. Other managers
retain the existing manager/update-type grouping. A shared `flake.nix` is not a
grouping boundary: it can build several independent applications.

The inherited `config:best-practices` preset already supplies upstream monorepo
groups, including React, typescript-eslint, and OpenTelemetry. These retain
their major-update groups within each project. Core and contrib OpenTelemetry
families remain distinct; the policy does not require their stable and beta
version numbers to match. Ordinary minor/patch updates join the project's
routine group. Pydantic and pydantic-settings are not artificially coupled.

Grouping is not a compatibility solver: major and minor updates can still land
in different PRs, even within one release family. A migration that needs both
should use an explicit local group. Resolver constraints and CI remain required.

Security fixes, including major fixes, share a separate project security branch.
One incompatible fix can block the other fixes in that project; split a blocked
update manually when necessary. "Immediately" means the next runner execution,
not an extra scheduled run.

Renovate forces `vulnerabilityAlerts` settings over normal package rules and
disables named security groups by default. The baseline therefore assigns these
managers a common security branch topic within each project prefix. Other
managers retain Renovate's default security topic. Raw manifest paths keep
`foo/bar/go.mod` distinct from `foobar/go.mod`; avoid `branchNameStrict` or
custom branch naming without checking for collisions.

Existing dependency PRs may be replaced when Renovate next processes a
repository after this policy changes. Checksum and Nix hash generation still
belongs in local `postUpgradeTasks`, using `executionMode: "branch"` to run once
for the complete update. This preset neither regenerates hashes nor changes
runner permissions.

### Workspaces

Renovate 44.30.3 knows the npm, uv, and Cargo lockfile paths during extraction,
but does not expose them to branch templates. The defaults cannot automatically
discover shared-lockfile workspaces; without an override, workspace manifests
remain separate. Do not infer ownership from a common parent directory alone.

If every npm manifest in a repository belongs to one workspace, give that
manager a constant project prefix:

```json
{
  "npm": {
    "additionalBranchPrefix": "web/"
  }
}
```

Use `pep621` for a single uv workspace or `cargo` for a single Cargo workspace.
This combines routine updates, security fixes, and inherited major groups across
the workspace manifests. Keep distinct prefixes for independent workspaces;
repositories with several need an explicit manifest-path mapping. Define it at
manager level, not only in `packageRules`, because Renovate's
lockfile-remediation path bypasses those rules.

Cargo dependencies declared in `[workspace.dependencies]` are updated in the
root manifest; inherited member entries are skipped. Dependencies declared
directly in member manifests remain separate unless a workspace prefix is set.

CI tests alert generation and branch assembly with fixture GitHub and OSV feeds
against the pinned Renovate version. It does not test live advisory lookup,
version selection, or package builds.

## Important constraints

Lock-file maintenance is not covered by Renovate's release-age delay. It can
therefore select a newly published transitive dependency. Use an equivalent
package-manager delay, or keep lock-file maintenance manual, when that matters.

Git references have no release timestamp, so Nix git-ref updates may proceed
without the seven-day delay. They remain subject to CI and scheduling.

Application lock files record a deployable dependency graph; manifest ranges
express what is acceptable. For libraries, ranges are part of the published
compatibility contract: set the lower bound to the oldest supported release and
the upper bound at a compatibility boundary, not merely the latest release.

## Local policy

Set cadence and exceptional package rules in the consuming repository. For
example, this runs weekly while inheriting dependency grouping:

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
  }
}
```

Local rules do not bypass CI, scheduling, or branch protection unless they
explicitly override those settings.
