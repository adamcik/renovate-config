# Renovate config

Shared Renovate policy for my repositories. Choose a preset by what the repository
publishes or deploys, not by its language. The baseline supplies common policy,
including dependency grouping; keep repository-specific rules in the consuming
repository.

## Start here

Deployed software should use the application profile:

```json
{
  "$schema": "https://docs.renovatebot.com/renovate-schema.json",
  "extends": ["github>adamcik/renovate-config:application"]
}
```

| Profile       | Use for                                     | Version-range policy                                                           | Automerge                                                                                         |
| ------------- | ------------------------------------------- | ------------------------------------------------------------------------------ | ------------------------------------------------------------------------------------------------- |
| `application` | Services, apps, CLIs, system configurations | Advance the declared range when the latest release falls outside it            | Off by default                                                                                    |
| `library`     | Packages consumed by other projects         | Preserve published ranges; lower bounds represent the oldest supported version | Off by default                                                                                    |
| `automerge`   | An opt-in composed with either profile      | No range changes                                                               | GitHub-native rebase auto-merge for eligible routine updates, subject to required approval and CI |

```json
{
  "extends": [
    "github>adamcik/renovate-config:application",
    "github>adamcik/renovate-config:automerge"
  ]
}
```

`automerge` opts in patch updates, version pins, digest updates, minor updates from
versions at or above 1.0.0, lock-file maintenance, and security fixes. Routine major
updates and pre-1.0 minor updates remain manual. Pre-1.0 minor updates have their own
group per manager and project so they do not hold up eligible routine updates. Unknown or
unsupported current versions do not qualify for minor-update auto-merge. Local rules
can override this policy; review those overrides before adoption.

Security PRs, including breaking major fixes, remain eligible for auto-merge. With an
approval-only bypass, those fixes can merge on green required CI without human review;
CI is not a guarantee of compatibility. Security updates still bypass the routine
schedule and release-age delay.

For eligible updates, it enables GitHub auto-merge while creating or updating the PR, so
GitHub can merge after applicable approval rules and required CI without another
Renovate run. Configured reviewers and assignees are still requested for automerging PRs.

Before opting in, enable repository auto-merge and require named CI checks in GitHub's
branch rules. Pin checks to their expected GitHub App where appropriate. Keep Renovate
out of any bypass list covering required CI, branch freshness, or history protections.
`ignoreTests: false` is retained, but GitHub's required checks are the authoritative
merge gate; a workflow that merely runs is not a required check.

This preset does not grant approval or change branch protections. For repositories
controlled by one owner, approval can live in a separate ruleset that permits only the
Renovate App to bypass it through PRs, alongside any existing administrator exception.
Other actors still need latest-push approval, while required CI remains independently
enforced. Do not enable this bypass on repositories without required CI. This trusts
Renovate's configuration to decide eligibility rather than duplicating it in an approval
bot. Verify the App's GitHub-native merge behavior on one repository before wider rollout.

GitHub owns merge timing, so Renovate's `automergeSchedule` does not delay a
platform-native merge once its requirements are met. Conflicts or
required updates from the base branch can still need a Renovate rerun, new CI results,
and fresh approval of the latest push where approval is required.

The baseline, application, and library profiles do not opt repositories in. Repositories
with different merge conventions, such as the merge-only `sbctl-debian` fork, should not
extend this preset. Apply and verify required CI rules for existing consumers before
rolling out a broader automerge policy.

When narrowing an existing policy, inspect PRs already queued for GitHub auto-merge;
do not assume a preset edit revokes an existing merge request. Recheck those PRs before
approving them under the new policy.

## Baseline policy

All profiles extend `default.json`, which:

- Uses Renovate's `config:best-practices` and runs routine updates monthly.
- Groups patch, minor, pin, and digest updates by manager and update type, except Go,
  npm, PEP 621, and Cargo minor and patch updates, which share one group per manifest.
  Known upstream release families retain their major-update groups; other routine major
  updates remain individual. The opt-in automerge preset separates pre-1.0 minor
  updates from its eligible routine groups. Any other mixed-policy group needs every
  update to qualify before Renovate enables auto-merge.
- Updates lock files on the first Saturday and allows at most three routine dependency
  pull requests at once.
- Waits seven days before proposing direct dependency releases.
- Creates non-automergeable security pull requests immediately, bypassing the schedule
  and release-age delay. Go, npm, PEP 621, and Cargo security fixes available on the
  same run share one security PR per manifest, separate from routine updates. A single
  fix is enough; there is no batching delay.
- Enables the Nix manager and OSV alerts for supported extracted dependencies.

Enable GitHub's dependency graph and Dependabot alerts to receive Renovate's GitHub
vulnerability alerts.

## Dependency grouping

All profiles inherit these project boundaries:

| Manager  | Default boundary                            |
| -------- | ------------------------------------------- |
| `gomod`  | One `go.mod`, including Go/toolchain edits  |
| `npm`    | One `package.json` for npm, Yarn, or pnpm   |
| `pep621` | One `pyproject.toml`, including uv projects |
| `cargo`  | One `Cargo.toml` for Rust crates            |

Manifest paths scope routine, security, and major-update branches. Different projects
stay separate even when they use the same dependencies. Other managers retain the
existing manager/update-type grouping. A shared `flake.nix` is not a grouping boundary:
it can build several independent applications.

The inherited `config:best-practices` preset already supplies upstream monorepo groups,
including React, typescript-eslint, and OpenTelemetry. These retain their major-update
groups within each project. Core and contrib OpenTelemetry families remain distinct; the
policy does not require their stable and beta version numbers to match. Ordinary
minor/patch updates join the project's routine group. Pydantic and pydantic-settings are
not artificially coupled.

Grouping is not a compatibility solver: major and minor updates can still land in
different PRs, even within one release family. A migration that needs both should use an
explicit local group. Resolver constraints and CI remain required.

Security fixes, including major fixes, share a separate project security branch. One
incompatible fix can block the other fixes in that project; split a blocked update
manually when necessary. "Immediately" means the next runner execution, not an extra
scheduled run.

Renovate forces `vulnerabilityAlerts` settings over normal package rules and disables
named security groups by default. The baseline therefore assigns these managers a common
security branch topic within each project prefix. Other managers retain Renovate's
default security topic. Raw manifest paths keep `foo/bar/go.mod` distinct from
`foobar/go.mod`; avoid `branchNameStrict` or custom branch naming without checking for
collisions.

Existing dependency PRs may be replaced when Renovate next processes a repository after
this policy changes. The baseline does not regenerate checksums or Nix hashes and does
not change runner permissions. Artifact generation requires explicit opt-in below.

### npm dependencies fetched with Nix

Use `npm-nix(manifest-directory,dependency-package)` when npm's lockfile also feeds a
Nix fixed-output dependency derivation:

```json
{
  "extends": [
    "github>adamcik/renovate-config:application",
    "github>adamcik/renovate-config:npm-nix(web,npm-deps)"
  ]
}
```

Expose the `fetchNpmDeps` derivation as `packages.<system>.npm-deps` (or expose
`buildNpmPackage`'s `npmDeps` under that name). The second parameter names this
dependency derivation, not the application package. Use `.` for a root npm manifest.
Each preset instance matches only that directory's `package.json`, including security
updates; add one instance per independent npm lockfile.

This opt-in requires `adamcik/renovate-runner`'s `update-npm-hash` launcher operation.
After npm updates its lockfile, the launcher discovers the dependency hash, updates one
literal `hash = "sha256-…";` or `npmDepsHash = "sha256-…";` assignment in a tracked Nix
file, verifies the dependency build, then formats the branch. The assignment must be on
one line and uniquely match the old hash; computed, shared, or ambiguous assignments
fail rather than being guessed. Do not add this preset to repositories using another
runner without equivalent support. Remove matching local artifact tasks:
`postUpgradeTasks` is not mergeable in Renovate 44. The preset includes the runner's
default formatting step.

### Go packages built with Nix

Add `go-nix` only when the repository has a root `go.mod` and its default flake package
uses `buildGoModule` with a literal `vendorHash` in a tracked Nix file:

```json
{
  "extends": ["github>adamcik/renovate-config:application", "github>adamcik/renovate-config:go-nix"]
}
```

Neither the baseline nor the application or library profiles include this preset. It
requires the allowlisted `/opt/nix-post-upgrade` launcher from
`adamcik/renovate-runner`. After each Go update branch, it downloads module checksums,
refreshes vendor hashes, builds the selected packages, and formats the repository. Broad
artifact filters retain checksum, hash, and formatter changes, including unrelated
formatting changes.

Use `go-nix-module(module-directory,package-attributes)` for nested modules or other
package targets. Separate multiple package attributes with spaces:

```json
{
  "extends": [
    "github>adamcik/renovate-config:application",
    "github>adamcik/renovate-config:go-nix-module(packages/caddy,caddy)"
  ]
}
```

For a root module with two package targets, use `go-nix-module(.,default demo)`. Each
instance matches only its module's `go.mod`; add one instance per independent module.
Keep module-specific grouping and compatibility constraints in local rules. The launcher
validates module directories and package attributes before executing them.

`postUpgradeTasks` is not mergeable in Renovate 44. Remove matching local artifact tasks
when adopting this preset, or replace the whole command sequence intentionally. Failed
artifacts may need the PR's rebase/retry checkbox after the underlying problem is fixed;
a successful runner invocation alone does not mean those artifacts were regenerated.

### Workspaces

Renovate 44.30.3 knows the npm, uv, and Cargo lockfile paths during extraction, but does
not expose them to branch templates. The defaults cannot automatically discover
shared-lockfile workspaces; without an override, workspace manifests remain separate. Do
not infer ownership from a common parent directory alone.

If every npm manifest in a repository belongs to one workspace, give that manager a
constant project prefix:

```json
{
  "npm": {
    "additionalBranchPrefix": "web/"
  }
}
```

Use `pep621` for a single uv workspace or `cargo` for a single Cargo workspace. This
combines routine updates, security fixes, and inherited major groups across the
workspace manifests. Keep distinct prefixes for independent workspaces; repositories
with several need an explicit manifest-path mapping. Define it at manager level, not
only in `packageRules`, because Renovate's lockfile-remediation path bypasses those
rules.

Cargo dependencies declared in `[workspace.dependencies]` are updated in the root
manifest; inherited member entries are skipped. Dependencies declared directly in member
manifests remain separate unless a workspace prefix is set.

CI tests alert generation and branch assembly with fixture GitHub and OSV feeds against
the pinned Renovate version. It does not test live advisory lookup, version selection,
or package builds.

## Important constraints

Lock-file maintenance is not covered by Renovate's release-age delay. It can therefore
select a newly published transitive dependency. Use an equivalent package-manager delay,
or keep lock-file maintenance manual, when that matters.

The automerge preset keeps lock-file maintenance eligible, including Nix flake refreshes.
Required CI must cover the resulting dependency graph and toolchain; this is not a
claim that a lock refresh is low risk. Opt out locally with
`"lockFileMaintenance": { "automerge": false }` when that coverage is insufficient.

Git references have no release timestamp, so Nix git-ref updates may proceed without the
seven-day delay. They remain subject to CI and scheduling.

Application lock files record a deployable dependency graph; manifest ranges express
what is acceptable. For libraries, ranges are part of the published compatibility
contract: set the lower bound to the oldest supported release and the upper bound at a
compatibility boundary, not merely the latest release.

## Local policy

Set cadence and exceptional package rules in the consuming repository. For example, this
runs weekly while inheriting dependency grouping:

```json
{
  "extends": [
    "github>adamcik/renovate-config:application",
    "github>adamcik/renovate-config:automerge"
  ],
  "schedule": ["* * * * 6"],
  "lockFileMaintenance": {
    "enabled": true,
    "schedule": ["* * * * 6"]
  }
}
```

Use a full-day window so delayed runner starts do not skip the week's updates.

Local rules do not bypass CI, scheduling, or branch protection unless they explicitly
override those settings.
