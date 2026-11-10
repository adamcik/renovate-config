# Release-age controls and lock maintenance

The shared preset exempts only Nix lock maintenance from the release-age check. Other
managers keep positive age settings. npm uses that value for its resolver cutoff, so
zero removes the generated observation period unless native configuration supplies
another cutoff. [44.167.7 source][NPM-R1], [44.224.2 source][NPM-R2]

This note compares Renovate 44.167.7, the pinned runner, with 44.224.2. The latter is a
source comparison, not a proposed upgrade. The investigation did not run Docker or
package-manager integration tests. [44.167.7 archive][ARCHIVE1],
[44.224.2 archive][ARCHIVE2]

## Candidate age does not establish the resolved graph's age

Renovate checks timestamps on proposed dependency versions and digests. The result
depends on datasource timestamps, `internalChecksFilter`, and
`minimumReleaseAgeBehaviour`. These checks do not inspect every package that a resolver
selects. [Candidate checks][CANDIDATES]

A native cutoff can restrict newly resolved direct and transitive packages. It does not
necessarily recheck entries already in a lockfile. Each tool has different exemptions
and rules for missing timestamps.

For lock maintenance, Renovate constructs a synthetic update without a release
timestamp. In 44.167.7, a positive age with `timestamp-required` leaves that update
pending. The status does not identify a package that is too young.
[Update construction][FLATTEN], [status calculation][STATUS1]

Renovate 44.224.2 adds `enforcesMinimumReleaseAge`, which lets a manager skip this
synthetic check. None of the managers in this note implements the hook. They also do not
use `minimumReleaseAgeExtracted` to feed native settings into candidate checks.
`minimumReleaseAgeSupport` describes support but does not implement enforcement.
[Manager hook][HOOK], [status calculation][STATUS2], [manager contract][TYPES],
[published manager sources][ARCHIVE2]

## uv

uv reads `exclude-newer` from `uv.toml` or `[tool.uv]` in `pyproject.toml`. It also
accepts `--exclude-newer` and `UV_EXCLUDE_NEWER`. Absolute-date filtering appeared in
0.1.15, and 0.2.22 extended the installer arguments. Relative delays require 0.9.17.
[Settings][UV-DOC], [early changelog][UV-EARLY], [0.9.17 changelog][UV-RELATIVE]

The cutoff compares distribution-file upload times. When a cutoff applies, uv excludes
index files that lack upload times. Git and path dependencies are outside that check.
`exclude-newer-package` provides package-specific overrides. Current docs also allow
`false` exemptions, but support in every older uv was not verified. [Settings][UV-DOC],
[resolver implementation][UV-RESOLVER]

Renovate's `pep621` manager runs `uv lock --upgrade` for maintenance. It neither
translates its age setting to `--exclude-newer` nor extracts uv's cutoff into candidate
checks. uv can still read the committed native configuration. [44.167.7 source][UV-R1],
[44.224.2 source][UV-R2]

## npm

npm supports `before` and `--before` from 6.9.0. Version 11.10.0 adds `min-release-age`,
measured in days and configurable in `.npmrc`. These cutoffs constrain the resolved tree
using registry publication times. They are not a general age check for Git or direct URL
dependencies. [6.9.0 changelog][NPM-BEFORE], [11.10.0 definitions][NPM-AGE],
[current config reference][NPM-DOC]

npm 11.10.0 treats `before` and `min-release-age` as mutually exclusive. Current docs
allow both with configuration-source precedence and describe package exclusions. The
behavior therefore depends on the installed npm version. [11.10.0 definitions][NPM-AGE],
[current config reference][NPM-DOC]

Both Renovate versions calculate `--before` by subtracting `minimumReleaseAge` from the
current time. A stricter valid `.npmrc` `before` takes precedence. If Renovate
recognizes `.npmrc` `min-release-age`, it omits its generated flag and leaves the cutoff
to npm. Recognition does not prove that the installed CLI supports the setting.
[44.167.7 source][NPM-R1], [44.224.2 source][NPM-R2]

After a matching date-related `ETARGET` error, Renovate can retry without its generated
`--before` flag and emit a notice. A successful update does not prove that the generated
cutoff remained in use. [44.167.7 source][NPM-R1], [44.224.2 source][NPM-R2]

## pnpm

pnpm 10.16.0 adds `minimumReleaseAge` and `minimumReleaseAgeExclude` in
`pnpm-workspace.yaml`. The age is measured in minutes and includes transitive
dependencies. [10.16.0 changelog][PNPM-INTRO], [resolver settings][PNPM-DOC]

Current docs describe `minimumReleaseAgeIgnoreMissingTime`, which lets undated registry
entries pass by default. They also distinguish strict explicit settings from the
built-in default, which can fall back to younger versions. Registries with
`serverType: pnpr` limit the delay to 30 days. These newer settings and defaults were
not verified for 10.16.0. [Resolver settings][PNPM-DOC]

Renovate's `npm` manager neither translates its age to pnpm settings nor extracts the
native cutoff into candidate checks. pnpm can read the workspace settings. For
vulnerability updates, Renovate can add version exemptions to
`minimumReleaseAgeExclude`. That exception does not disable ordinary maintenance
controls. [44.167.7 source][PNPM-R1], [44.224.2 source][PNPM-R2],
[security exemptions][PNPM-EXEMPT]

## Yarn

Yarn Berry 4.10.0 has `npmMinimalAgeGate` and `npmPreapprovedPackages` in `.yarnrc.yml`.
At that version, the age is numeric minutes and defaults to zero. Current docs describe
duration strings. Yarn Classic support was not established.
[4.10.0 configuration][YARN-CONFIG], [current docs][YARN-DOC]

The npm semver resolver filters candidates, including transitive versions. Undated
versions pass the age comparison. This is an npm-specific check, not a general check for
every protocol. [Resolver][YARN-RESOLVER], [age comparison][YARN-GATE]

Renovate does not translate or extract the native setting. For maintenance, it clears
`yarn.lock` and runs Yarn with `.yarnrc.yml` available. A configured Berry cutoff can
apply to the new resolutions. [44.167.7 source][YARN-R1], [44.224.2 source][YARN-R2]

## Bun

Bun 1.3 adds `--minimum-release-age` and `[install].minimumReleaseAge` in `bunfig.toml`.
The value is numeric seconds, with package exclusions available. The cutoff filters
newly resolved direct and transitive packages. Existing `bun.lock` selections remain
unchanged, and exact requests still respect the cutoff. [1.3 announcement][BUN-INTRO],
[install reference][BUN-DOC]

Current docs say packages with a missing registry `time` field pass the check. The
setting therefore does not reject every undated package. [Install reference][BUN-DOC]

Renovate neither translates its age to Bun settings nor extracts the native value.
Maintenance deletes the lockfile and invokes `bun install`, which can read the committed
`bunfig.toml`. [44.167.7 source][BUN-R1], [44.224.2 source][BUN-R2]

## mise

mise 2026.5.12 has `minimum_release_age` with relative durations, absolute dates, CLI
overrides, and per-tool overrides. Its documented timestamp-capable backends include
aqua, cargo, npm, pipx, and some core tools. Undated versions pass. The 2026.11.0
security docs describe a default 24-hour delay across backends, still limited by
available timestamps. [2026.5.12 settings][MISE-OLD],
[2026.11.0 security model][MISE-SEC]

The tool-version check filters fuzzy and latest selections. Exact versions and locked
selections bypass it. Only the npm and PyPI backends document additional cutoffs for
transitive installs. Other backends' installer dependencies are not thereby protected.
[Security model][MISE-SEC], [npm backend][MISE-NPM], [PyPI backend][MISE-PYPI]

The documented installer paths require compatible external tools. npm needs 6.9.0 for
`--before` or 11.10.0 for relative days. The other minimums are pnpm 10.16.0, Bun 1.3.0,
and uv 0.2.22. [npm backend][MISE-NPM], [PyPI backend][MISE-PYPI]

Renovate does not translate its age to mise or extract `minimum_release_age` into
candidate checks. It runs `mise lock --bump` when supported. The safe-mode path requires
mise 2026.7.12 or later. Older versions require unsafe-execution allowlisting.
[44.167.7 source][MISE-R1], [44.224.2 source][MISE-R2]

Safe mode ignores project `[settings]`. A project `minimum_release_age` alone therefore
does not establish protection under Renovate. The effective global or environment
configuration, per-tool policy, and backend determine what applies.
[Safe-mode settings][MISE-SAFE]

## Nix flakes

The examined Nix 2.31.2 source and 2.35.5 manual document no generic release-age cutoff
for `nix flake update`. The command follows current references for the named inputs, or
all inputs. Explicit revision pins select revisions but are not relative delays.
`--refresh` controls cache freshness, not release age. External tooling could implement
a different selection policy. [2.31.2 source][NIX-SOURCE], [2.35 manual][NIX-DOC]

Renovate runs the native updater without an age cutoff or a post-resolution age audit.
Its ordinary candidate checks do not establish the age of every updated input.
[44.167.7 source][NIX-R1], [44.224.2 source][NIX-R2]

## Why the exception is Nix-only

The shared rule matches both `nix` and `lockFileMaintenance`. It permits fresh flake
revisions rather than claiming equivalent age protection. Ordinary version-update
candidate ages stay unchanged. [Update construction][FLATTEN],
[status calculation][STATUS1]

A blanket zero would give npm a generated cutoff near the current time instead of the
former observation period. A stricter `.npmrc` cutoff can still apply, but the CLI must
support it. Zero does not erase the other tools' native settings, nor does Renovate
supply settings that are absent. [44.167.7 source][NPM-R1], [44.224.2 source][NPM-R2],
[11.10.0 definitions][NPM-AGE]

For a workflow with verified native protection, a scoped maintenance
`minimumReleaseAgeBehaviour: "timestamp-optional"` can retain a positive age while
allowing the synthetic update to pass. This follows from the source but has not been
verified through a package-manager integration test. Its safety depends on the actual
resolver policy. [Update construction][FLATTEN], [status calculation][STATUS1],
[npm cutoff generation][NPM-R1]

## Verification limits

This investigation did not inventory consumer CLI versions, registry timestamps, native
settings, or effective environments. The resolved graph, npm retry path, mise safe mode,
and security-remediation exceptions still need integration tests. Native cooldowns can
otherwise postpone urgent fixes despite Renovate's candidate delay exemption.

Nix is not the only path that can lack protection. Old CLIs, disabled settings,
non-registry sources, missing timestamps, exact pins, and installer dependencies outside
the supported mise backends can also leave packages unchecked. The shared rule does not
extend the exception to those cases.

[ARCHIVE1]: https://registry.npmjs.org/renovate/-/renovate-44.167.7.tgz
[ARCHIVE2]: https://registry.npmjs.org/renovate/-/renovate-44.224.2.tgz
[CANDIDATES]: https://github.com/renovatebot/renovate/blob/44.167.7/lib/workers/repository/process/lookup/filter-checks.ts
[FLATTEN]: https://github.com/renovatebot/renovate/blob/44.167.7/lib/workers/repository/updates/flatten.ts
[STATUS1]: https://github.com/renovatebot/renovate/blob/44.167.7/lib/workers/repository/update/branch/index.ts
[STATUS2]: https://github.com/renovatebot/renovate/blob/44.224.2/lib/workers/repository/update/branch/status-checks.ts
[HOOK]: https://github.com/renovatebot/renovate/blob/44.224.2/lib/modules/manager/index.ts
[TYPES]: https://github.com/renovatebot/renovate/blob/44.224.2/lib/modules/manager/types.ts
[UV-DOC]: https://docs.astral.sh/uv/reference/settings/#exclude-newer
[UV-EARLY]: https://github.com/astral-sh/uv/blob/0.2.22/CHANGELOG.md
[UV-RELATIVE]: https://github.com/astral-sh/uv/blob/main/changelogs/0.9.x.md#0917
[UV-RESOLVER]: https://github.com/astral-sh/uv/blob/0.9.17/crates/uv-resolver/src/version_map.rs
[NPM-BEFORE]: https://github.com/npm/cli/blob/v6.9.0/CHANGELOG.md
[NPM-AGE]: https://github.com/npm/cli/blob/v11.10.0/workspaces/config/lib/definitions/definitions.js
[NPM-DOC]: https://docs.npmjs.com/cli/v11/using-npm/config#min-release-age
[PNPM-INTRO]: https://github.com/pnpm/pnpm/blob/v10.16.0/pnpm/CHANGELOG.md
[PNPM-DOC]: https://pnpm.io/settings/dependency-resolution#minimumreleaseage
[YARN-CONFIG]: https://github.com/yarnpkg/berry/blob/%40yarnpkg/cli/4.10.0/packages/plugin-npm/sources/index.ts
[YARN-RESOLVER]: https://github.com/yarnpkg/berry/blob/%40yarnpkg/cli/4.10.0/packages/plugin-npm/sources/NpmSemverResolver.ts
[YARN-GATE]: https://github.com/yarnpkg/berry/blob/%40yarnpkg/cli/4.10.0/packages/plugin-npm/sources/npmConfigUtils.ts
[YARN-DOC]: https://yarnpkg.com/configuration/yarnrc#npmMinimalAgeGate
[BUN-INTRO]: https://bun.com/blog/bun-v1.3#minimum-release-age
[BUN-DOC]: https://bun.com/docs/pm/cli/install#minimum-release-age
[MISE-OLD]: https://github.com/jdx/mise/blob/v2026.5.12/settings.toml#L1313
[MISE-SEC]: https://github.com/jdx/mise/blob/v2026.11.0/docs/security.md
[MISE-NPM]: https://github.com/jdx/mise/blob/v2026.11.0/docs/dev-tools/backends/npm.md#minimum-release-age
[MISE-PYPI]: https://github.com/jdx/mise/blob/v2026.11.0/docs/dev-tools/backends/pypi.md#minimum-release-age
[MISE-SAFE]: https://mise.jdx.dev/configuration/settings.html#which-value-wins
[NIX-SOURCE]: https://github.com/NixOS/nix/blob/2.31.2/src/nix/flake-update.md
[NIX-DOC]: https://nix.dev/manual/nix/2.35/command-ref/new-cli/nix3-flake-update
[UV-R1]: https://github.com/renovatebot/renovate/blob/44.167.7/lib/modules/manager/pep621/processors/uv.ts
[UV-R2]: https://github.com/renovatebot/renovate/blob/44.224.2/lib/modules/manager/pep621/processors/uv.ts
[NPM-R1]: https://github.com/renovatebot/renovate/blob/44.167.7/lib/modules/manager/npm/post-update/npm.ts
[NPM-R2]: https://github.com/renovatebot/renovate/blob/44.224.2/lib/modules/manager/npm/post-update/npm.ts
[PNPM-R1]: https://github.com/renovatebot/renovate/blob/44.167.7/lib/modules/manager/npm/post-update/pnpm.ts
[PNPM-R2]: https://github.com/renovatebot/renovate/blob/44.224.2/lib/modules/manager/npm/post-update/pnpm.ts
[PNPM-EXEMPT]: https://github.com/renovatebot/renovate/blob/44.167.7/lib/modules/manager/npm/artifacts.ts
[YARN-R1]: https://github.com/renovatebot/renovate/blob/44.167.7/lib/modules/manager/npm/post-update/yarn.ts
[YARN-R2]: https://github.com/renovatebot/renovate/blob/44.224.2/lib/modules/manager/npm/post-update/yarn.ts
[BUN-R1]: https://github.com/renovatebot/renovate/blob/44.167.7/lib/modules/manager/bun/artifacts.ts
[BUN-R2]: https://github.com/renovatebot/renovate/blob/44.224.2/lib/modules/manager/bun/artifacts.ts
[MISE-R1]: https://github.com/renovatebot/renovate/blob/44.167.7/lib/modules/manager/mise/artifacts.ts
[MISE-R2]: https://github.com/renovatebot/renovate/blob/44.224.2/lib/modules/manager/mise/artifacts.ts
[NIX-R1]: https://github.com/renovatebot/renovate/blob/44.167.7/lib/modules/manager/nix/artifacts.ts
[NIX-R2]: https://github.com/renovatebot/renovate/blob/44.224.2/lib/modules/manager/nix/artifacts.ts
