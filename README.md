# Renovate config

Shared Renovate policy for my repositories. Choose a preset by what the
repository publishes or deploys, not by its language. Keep manager-specific and
repository-specific rules in the consuming repository.

## Start here

Deployed software should use the application profile:

```json
{
  "$schema": "https://docs.renovatebot.com/renovate-schema.json",
  "extends": ["github>adamcik/renovate-config:application"]
}
```

| Profile       | Use for                                      | Version-range policy                                                              | Automerge                                                                                               |
| ------------- | -------------------------------------------- | --------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------- |
| `application` | Services, apps, CLIs, system configurations | Advance the declared range when the latest release falls outside it               | Off by default                                                                                          |
| `library`     | Packages consumed by other projects          | Preserve published ranges; lower bounds represent the oldest supported version    | Off by default                                                                                          |
| `automerge`   | An opt-in composed with either profile       | No range changes                                                                  | Lock-file maintenance and lock-only Dockerfile, GitHub Actions, and Nix digest updates after CI passes |

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
- Groups patch, minor, pin, and digest updates by manager and update type, so
  automergeable and manual work do not share a pull request.
- Updates lock files on the first Saturday and allows at most three routine
  dependency pull requests at once.
- Waits seven days before proposing direct dependency releases.
- Creates non-automergeable security pull requests immediately, bypassing the
  schedule and release-age delay.
- Enables the Nix manager and OSV alerts for supported extracted dependencies.

Enable GitHub's dependency graph and Dependabot alerts to receive Renovate's
GitHub vulnerability alerts.

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
example, this runs weekly while keeping a generated Caddy bundle together:

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

Local rules do not bypass CI, scheduling, or branch protection unless they
explicitly override those settings.
