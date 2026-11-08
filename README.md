# Renovate config

Shared [Renovate](https://docs.renovatebot.com/) presets for my repositories. Choose a
profile, then add optional presets for auto-merge or Nix artifact updates. Keep
repository-specific rules in the repository that uses the presets.

## Choose a profile

Choose by what the repository publishes or deploys, not by its language.

| Profile       | Use for                                         | Version ranges                                                                   |
| ------------- | ----------------------------------------------- | -------------------------------------------------------------------------------- |
| `application` | Services, apps, CLIs, and system configurations | Advance the declared range when the latest release falls outside it              |
| `library`     | Packages consumed by other projects             | Preserve published ranges, with lower bounds set to the oldest supported release |

Both profiles inherit the [baseline policy](docs/policy.md): monthly routine updates,
dependency grouping, a seven-day release delay, and immediate security PRs. Neither
profile enables auto-merge.

## Add the preset

Create `renovate.json` in your repository:

```json
{
  "$schema": "https://docs.renovatebot.com/renovate-schema.json",
  "extends": ["github>adamcik/renovate-config:application"]
}
```

For a library, replace `:application` with `:library`. Enable GitHub's dependency graph
and Dependabot alerts to receive Renovate's GitHub vulnerability alerts.

## Add optional behavior

The profiles do not regenerate checksums or Nix hashes, configure runner permissions, or
change GitHub branch protections. Use the guides for the behavior you need:

- [Enable auto-merge](docs/automerge.md) for eligible updates after required GitHub
  checks pass.
- [Update Nix artifacts](docs/nix.md) for Go or npm dependencies built with Nix.
- [Group a shared-lockfile workspace](docs/workspaces.md) instead of grouping each
  manifest separately.

See the [policy reference](docs/policy.md) for grouping rules, security behavior, and
release-delay limits.

## Override local policy

Set the cadence and exceptional package rules in your repository. For weekly updates
with the inherited grouping, use:

```json
{
  "extends": ["github>adamcik/renovate-config:application"],
  "schedule": ["* * * * 6"],
  "lockFileMaintenance": {
    "enabled": true,
    "schedule": ["* * * * 6"]
  }
}
```

Use a full-day window so delayed runner starts do not skip the week's updates. Local
rules do not bypass CI, scheduling, or branch protection unless they explicitly override
those settings.
