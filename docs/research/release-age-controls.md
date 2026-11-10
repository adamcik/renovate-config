# Release-age controls and lock maintenance

## Conclusion

Do **not** make `lockFileMaintenance.minimumReleaseAge: "0 days"` a shared,
manager-independent default. Both examined Renovate versions translate a positive age
into npm's resolver cutoff; zero removes that protection unless repository npm
configuration supplies its own cutoff. Conversely, zero does **not** erase uv, pnpm,
Yarn, Bun, or mise configuration. Native support and Renovate integration are different
questions. [NPM-R1], [NPM-R2]

This is source research, not a Docker/integration test. Docker was unavailable. The
published packages inspected were **44.167.7** (pinned runner) and **44.224.2**
(comparison only), not a proposed runtime rollout. [44.167.7 archive][ARCHIVE1],
[44.224.2 archive][ARCHIVE2] PR #24 is closed and outside this recommendation.

## Three separate mechanisms

1. **Renovate candidate checks:** age-check the timestamp of an extracted dependency's
   proposed release/digest, subject to datasource timestamps, `internalChecksFilter`,
   and `minimumReleaseAgeBehaviour`. This is not a general audit of every dependency
   selected by a package-manager solver. [Candidate checks][CANDIDATES]
2. **Native resolution cutoffs:** constrain newly resolved direct **and transitive**
   packages when the underlying tool supports and receives/configures a cutoff. They are
   not necessarily retroactive checks of an existing lockfile; scope, exemptions, and
   missing timestamps differ below.
3. **Synthetic lock-maintenance status:** Renovate constructs a maintenance upgrade
   without selecting a release or attaching its timestamp. In 44.167.7, a positive age
   plus `timestamp-required` therefore produces a pending branch status; this does
   **not** mean a newly locked package was inspected and found too young.
   [Construction][FLATTEN], [status calculation][STATUS1]

44.224.2 adds a manager enforcement hook which can skip this synthetic check, but none
of the seven examined managers exports an `enforcesMinimumReleaseAge` implementation.
Its new `minimumReleaseAgeExtracted` infrastructure likewise does not mean these
managers extract native cutoff settings into candidate checks. The new
`minimumReleaseAgeSupport` declarations are documentation metadata, not automatic
translation/enforcement. [Hook][HOOK], [status use][STATUS2], [manager contract][TYPES],
[published manager sources][ARCHIVE2]

## Native controls: verified versions and limits

| Tool           | Native control and important boundaries                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                            |
| -------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| **uv**         | `exclude-newer` in `[tool.uv]` / `uv.toml`, CLI `--exclude-newer`, or `UV_EXCLUDE_NEWER`. Absolute-date filtering was exposed in **0.1.15**; **0.2.22** extended installer arguments; relative cooldown durations require **0.9.17**. The cutoff compares **distribution-file upload times**, not just version release dates. Index files missing upload times are excluded when a cutoff applies; this is not a Git/path dependency age gate. Package-specific overrides exist (`exclude-newer-package`); current docs also support `false` exemptions, which should not be assumed available in every older uv. [Settings][UV-DOC], [early changelog][UV-EARLY], [0.9.17 changelog][UV-RELATIVE], [resolver implementation][UV-RESOLVER]                                                                                                                                                                                                                         |
| **npm**        | Absolute `before` / `--before` since **6.9.0**; relative `min-release-age` in **days** since **11.10.0**, configurable in `.npmrc`. These constrain npm's resolved tree, not merely Renovate's direct candidate. npm 11.10.0 declares the two options mutually exclusive; newer documentation permits coexistence with source-precedence rules, so do not project current semantics onto all npm 11 releases. Current npm also documents package exclusions. These are registry publish-time controls, not a universal age check for arbitrary URLs/Git. [6.9.0 changelog][NPM-BEFORE], [11.10.0 definition][NPM-AGE], [current config][NPM-DOC]                                                                                                                                                                                                                                                                                                                   |
| **pnpm**       | `minimumReleaseAge` in `pnpm-workspace.yaml`, in **minutes**, introduced in **10.16.0** together with `minimumReleaseAgeExclude`. It includes transitives. Current docs additionally describe missing registry times passing by default (`minimumReleaseAgeIgnoreMissingTime`), non-strict fallback when relying on the built-in age default, and a **30-day maximum for `serverType: pnpr`**. Explicitly configured age defaults to strict behavior in those docs. These newer settings/defaults must not be assumed present in 10.16.0; inspect the pinned CLI. [10.16.0 changelog][PNPM-INTRO], [official resolver settings][PNPM-DOC]                                                                                                                                                                                                                                                                                                                          |
| **Yarn**       | Modern/Berry **4.10.0** has `npmMinimalAgeGate` and `npmPreapprovedPackages` in `.yarnrc.yml`. At that tag the age is a **number of minutes**, default `0`; do not copy today's duration-string documentation into 4.10.0 blindly, or assume Yarn Classic supports the setting. The npm semver resolver filters candidates, including transitive resolution; undated versions do not fail the age comparison. This is not a gate for every non-npm protocol. [4.10.0 configuration source][YARN-CONFIG], [resolver][YARN-RESOLVER], [gate implementation][YARN-GATE], [current docs][YARN-DOC]                                                                                                                                                                                                                                                                                                                                                                     |
| **Bun**        | **1.3** introduced `--minimum-release-age` / `[install].minimumReleaseAge` in `bunfig.toml`, numeric **seconds**, plus exclusions. It filters newly resolved direct and transitive packages; existing `bun.lock` selections remain unchanged. Exact requests still respect the gate. Current docs explicitly say a missing `time` field passes; this is not fail-closed protection for every registry/source. [1.3 announcement][BUN-INTRO], [install reference][BUN-DOC]                                                                                                                                                                                                                                                                                                                                                                                                                                                                                          |
| **mise**       | Native `minimum_release_age` is verified in **2026.5.12**, accepting relative durations or an absolute date, with CLI and per-tool overrides. That version documents timestamp-capable backends including aqua, cargo, npm, pipx, and some core tools; undated versions pass. By **2026.11.0**, docs describe a default 24-hour delay across backends, still limited by available timestamps. Fuzzy/latest selection is filtered; exact versions and locked selections bypass the tool-version gate. **Only npm and PyPI/pipx backends** additionally document transitive-install cutoffs; other backend installers' dependencies are not thereby protected. External installers need compatible versions: npm >=6.9.0 (`--before`; >=11.10.0 relative days), pnpm >=10.16.0, Bun >=1.3.0, uv >=0.2.22 for the documented installer path. [2026.5.12 settings][MISE-OLD], [2026.11.0 security model][MISE-SEC], [npm backend][MISE-NPM], [PyPI backend][MISE-PYPI] |
| **Nix flakes** | No generic release-age cutoff is documented for `nix flake update` in the examined **2.31.2 source** or **2.35.5 manual**. It updates the named inputs, or all inputs, to their current references; explicit revision pins control selection but are not a relative cooldown. `--refresh` concerns cache freshness, not release age. This is a bounded finding about the native flake updater, not proof that no external Nix tooling could implement an age policy. [2.31.2 source][NIX-SOURCE], [2.35 manual][NIX-DOC]                                                                                                                                                                                                                                                                                                                                                                                                                                           |

## What Renovate actually does

The following behavior is present in **both** published versions unless stated
otherwise. “Native config retained” means the CLI can read it; it does not mean Renovate
reads its value or guarantees protection for every source/backend.

| Manager / CLI | Translation, recognition, and maintenance behavior                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                    |
| ------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `pep621` / uv | Runs `uv lock --upgrade` for maintenance. Does **not** translate Renovate age to `--exclude-newer`, or extract the native cutoff into candidate checks. A committed `[tool.uv].exclude-newer` remains available to uv. [44.167.7][UV-R1], [44.224.2][UV-R2]                                                                                                                                                                                                                                                                                                                                                           |
| `npm` / npm   | Computes `--before=<now − minimumReleaseAge>`. A valid `.npmrc` `before` chooses the older cutoff; a recognized `.npmrc` `min-release-age` suppresses the generated flag and leaves enforcement to npm. **Caveat:** on a matching date-related ETARGET error, Renovate retries without its generated `--before` and returns a notice; this is not an unconditional fail-closed guarantee. [44.167.7][NPM-R1], [44.224.2][NPM-R2]                                                                                                                                                                                      |
| `npm` / pnpm  | No automatic age translation or native-age extraction for candidate filtering. Workspace settings remain available to pnpm. Renovate **does** recognize a workspace age for a separate purpose: vulnerability updates can add version exemptions to `minimumReleaseAgeExclude`. That is not ordinary maintenance disablement. [44.167.7 resolver][PNPM-R1], [44.224.2 resolver][PNPM-R2], [security exemptions][PNPM-EXEMPT]                                                                                                                                                                                          |
| `npm` / Yarn  | No automatic age translation or native-age extraction. Renovate invokes Yarn with `.yarnrc.yml` available; for maintenance it clears `yarn.lock`, so new resolutions can use a configured Berry gate. [44.167.7][YARN-R1], [44.224.2][YARN-R2]                                                                                                                                                                                                                                                                                                                                                                        |
| `bun` / Bun   | No automatic age translation or extraction. Maintenance deletes the lockfile then invokes `bun install`; committed `bunfig.toml` can supply the native policy. [44.167.7][BUN-R1], [44.224.2][BUN-R2]                                                                                                                                                                                                                                                                                                                                                                                                                 |
| `mise` / mise | Neither translates Renovate age nor reads `minimum_release_age` into candidate filtering. Runs maintenance via `mise lock --bump` when supported. Both versions require mise >=**2026.7.12** for the safe-mode path, otherwise unsafe-execution allowlisting is required. **Safe mode ignores project `[settings]`**, so a repository's `[settings].minimum_release_age` alone is not sufficient evidence of protection in Renovate; inspect the actual mise version, global/environment configuration, per-tool policy, and backends. [44.167.7][MISE-R1], [44.224.2][MISE-R2], [safe-mode settings rule][MISE-SAFE] |
| `nix` / Nix   | Runs `nix … flake update` for maintenance, without any age cutoff or post-resolution age audit. Normal Renovate candidate checks and this native lock operation must not be conflated. [44.167.7][NIX-R1], [44.224.2][NIX-R2]                                                                                                                                                                                                                                                                                                                                                                                         |

## Effect of globally setting the maintenance age to zero

- **npm without native configuration:** loses the positive generated resolver window.
  The string `"0 days"` still reaches the generator and yields a cutoff near **now**,
  not the former observation period. [NPM-R1], [NPM-R2]
- **npm with valid native configuration:** an older `.npmrc` `before` remains stricter,
  and recognized `min-release-age` still delegates to npm. Zero does not erase those
  settings. Older npm may not support `min-release-age`; Renovate recognizing the text
  is not proof that the CLI supports it. [NPM-R1], [NPM-AGE]
- **uv/pnpm/Yarn/Bun/mise:** zero does not turn off their independent native settings,
  but neither runner supplies missing settings for them. Zero also does not cure backend
  gaps, missing timestamps, exact-pin bypasses, or mise's safe-mode configuration
  boundary. [Manager table above](#what-renovate-actually-does)
- **All managers:** bypasses the synthetic positive-age check for maintenance; it does
  not demonstrate that the resolved graph met any age threshold. A nested maintenance
  override does not itself change ordinary version-update candidate ages. [FLATTEN],
  [STATUS1], [STATUS2]

## Narrow policy recommendation

1. Preserve the shared positive release age, and remove the **blanket zero** from the
   proposal. Preserve/supplement native uv, npm, pnpm, Yarn, Bun, and mise policies
   rather than treating absent integration as absent support.
2. If the immediate, accepted exception is Nix lock maintenance, scope it to
   **`matchManagers: ["nix"]` plus `matchUpdateTypes: ["lockFileMaintenance"]`**. State
   plainly that it permits fresh flake revisions; it is an availability exception,
   **not** equivalent age protection. If that risk is unacceptable, leave automatic Nix
   maintenance disabled/manual until selection or verification actually checks the
   revisions. [NIX-R1], [NIX-DOC]
3. For a native-protected maintenance workflow blocked only by the missing synthetic
   timestamp, consider a **scoped maintenance
   `minimumReleaseAgeBehaviour: "timestamp-optional"`**, retaining the positive
   `minimumReleaseAge`. Unlike zero, this preserves npm's generated cutoff while
   allowing the timestamp-less synthetic upgrade. This is an inference from the source,
   not an integration-tested configuration, and is safe only to the extent the actual
   resolver policy is established. [FLATTEN], [STATUS1], [NPM-R1]

## Remaining verification

- Confirm each consumer's actual CLI version, registry timestamps, committed native
  policy, and effective environment. This research does not inventory or change live
  runners.
- Test the resolved graph and command/config boundary on the pinned runner, particularly
  npm's retry path and mise safe mode; no Docker execution is claimed.
- Test security-remediation exceptions before adding native cooldowns, so they do not
  silently postpone urgent fixes that bypass Renovate's own candidate delay.
- Nix is **not uniquely unprotected in practice**: unsupported/old CLI versions,
  disabled native settings, non-registry sources, undated mise backends, and
  non-npm/PyPI mise transitives also leave gaps. Do not broaden the exception to those
  cases without explicitly evaluating their risk.

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
