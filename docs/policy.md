# Preset policy

The `application` and `library` profiles inherit [`default.json`](../default.json). The
optional [`automerge` preset](../automerge.json) changes merge eligibility when composed
with either profile. Repository rules can override these defaults.

## Baseline

The baseline has these defaults:

- Renovate's `config:best-practices` preset.
- Monthly routine updates in the `Europe/Oslo` timezone.
- At most three routine dependency PRs open at once.
- A seven-day release-age delay for direct dependency releases.
- Lock-file maintenance on the first Saturday of the month.
- Immediate security PRs, without auto-merge.
- The Nix manager and OSV alerts for supported extracted dependencies.

Lock-maintenance titles list every manager on the branch because one branch can refresh
locks from several managers, including all inputs in `flake.lock`. A branch with one
maintenance update also names its manifest to distinguish independent projects.

GitHub vulnerability alerts require GitHub's dependency graph and Dependabot alerts.
Security PRs bypass the routine schedule and release-age delay. "Immediate" means the
next runner execution, not an extra scheduled run.

## Version ranges

The `application` profile advances a declared range when the latest release falls
outside it. Application lock files record a deployable dependency graph; manifest ranges
express which versions are acceptable.

The `library` profile preserves published ranges. Those ranges are part of the package's
compatibility contract. The lower bound represents the oldest supported release, and the
upper bound represents a compatibility boundary, not merely the latest release.

## Dependency groups

The baseline groups patch, minor, pin, and digest updates by manager and update type.
These managers instead share one routine minor-and-patch group per manifest:

| Manager  | Project boundary                               |
| -------- | ---------------------------------------------- |
| `gomod`  | One `go.mod`, including Go and toolchain edits |
| `npm`    | One `package.json` for npm, Yarn, or pnpm      |
| `pep621` | One `pyproject.toml`, including uv projects    |
| `cargo`  | One `Cargo.toml` for Rust crates               |

Manifest paths scope routine, security, and major-update branches. Different projects
stay separate even when they use the same dependencies. A shared `flake.nix` is not a
grouping boundary because it can build several independent applications.
[Shared-lockfile workspaces need an explicit override](workspaces.md).

The inherited `config:best-practices` preset supplies upstream monorepo groups,
including React, typescript-eslint, and OpenTelemetry. These retain their major-update
groups within each project. Other routine major updates remain individual.

Core and contrib OpenTelemetry families remain distinct. Their stable and beta version
numbers do not have to match. Ordinary minor and patch updates join the project's
routine group. The policy does not couple Pydantic and pydantic-settings.

Grouping does not solve compatibility constraints. Major and minor updates can land in
different PRs, even within one release family. A migration that needs both requires an
explicit local group. Resolver constraints and CI remain required.

### Security groups

Go, npm, PEP 621, and Cargo security fixes available on the same run share one security
PR per manifest, separate from routine updates. This includes major fixes. A single fix
is enough; there is no batching delay. One incompatible fix can block the other fixes in
that project, so a blocked update may need a manual split.

Renovate forces `vulnerabilityAlerts` settings over normal package rules and disables
named security groups by default. The baseline assigns these managers a common security
branch topic within each project prefix. Other managers retain Renovate's default
security topic.

Raw manifest paths keep `foo/bar/go.mod` distinct from `foobar/go.mod`.
`branchNameStrict` or custom branch naming can cause collisions unless checked. Renovate
may replace existing dependency PRs when it next processes a repository after a policy
change.

## Auto-merge eligibility

The baseline and both profiles leave auto-merge off. The optional `automerge` preset
enables GitHub rebase auto-merge for these updates:

- Patch updates, version pins, and digest updates.
- Minor updates from versions at or above 1.0.0.
- Lock-file maintenance, including Nix flake refreshes.
- Security fixes, including major upgrades.

Outside security PRs, major upgrades and pre-1.0 minor upgrades stay manual. The preset
groups pre-1.0 minor upgrades separately so they do not block other updates in the same
manifest. Minor updates with unknown or unsupported current versions do not qualify.
Renovate enables auto-merge for a group only if every update qualifies. The preset does
not change version ranges.

Renovate enables GitHub auto-merge when it creates or updates an eligible PR. GitHub
merges after its requirements pass, without another Renovate run. Renovate still
requests configured reviewers and assignees. `automergeSchedule` does not delay GitHub
auto-merge.

Conflicts or updates from the base branch can require another Renovate run and new CI
results. Approval rules can also require a new review of the latest push.

The preset keeps `ignoreTests: false`, but GitHub enforces required CI. A workflow
without a required check does not prevent merging. With an approval-only bypass,
breaking security fixes can merge on green CI without human review. Passing CI does not
guarantee compatibility.

See [Enable auto-merge](automerge.md) for the required GitHub setup.

## Release-delay limits

Nix lock maintenance uses `minimumReleaseAgeBehaviour: "timestamp-optional"` because its
synthetic update has no release timestamp. This clears the false pending check but
permits fresh flake revisions. Other managers keep their existing age settings.

The `automerge` preset allows lock-file maintenance to auto-merge, including Nix flake
refreshes. Required CI must test the changed dependency graph and toolchain.
Repositories without that coverage need `"lockFileMaintenance": { "automerge": false }`
to keep lock refreshes manual.

Git references have no release timestamp, so Nix git-ref updates may proceed without the
seven-day delay. They remain subject to CI and scheduling.

## Validation scope

CI tests alert generation and branch assembly with fixture GitHub and OSV feeds against
the pinned Renovate version. It does not test live advisory lookup, version selection,
or package builds.
