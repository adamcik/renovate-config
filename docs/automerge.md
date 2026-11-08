# Enable auto-merge

Use `automerge` with either the `application` or `library` profile. It enables GitHub
rebase auto-merge for [eligible updates](policy.md#auto-merge-eligibility), including
security fixes that require major upgrades.

Do not use this preset in merge-only repositories such as `sbctl-debian`. Required CI
must cover the changed dependency graph and toolchain, including Nix flake refreshes.
Passing CI does not guarantee compatibility.

## Configure GitHub and Renovate

1. Enable rebase merging and GitHub auto-merge in the repository settings.
2. Require named CI checks in the branch rules.
3. Pin the checks to their expected GitHub App IDs where appropriate.
4. Keep Renovate out of bypass lists for required CI, up-to-date branches, and history
   protections.
5. Add `:automerge` after the application or library profile in `renovate.json`:

   ```json
   {
     "extends": [
       "github>adamcik/renovate-config:application",
       "github>adamcik/renovate-config:automerge"
     ]
   }
   ```

If CI does not cover lock-file refreshes, keep those merges manual:

```json
{
  "extends": [
    "github>adamcik/renovate-config:application",
    "github>adamcik/renovate-config:automerge"
  ],
  "lockFileMaintenance": {
    "automerge": false
  }
}
```

Before you restrict an existing policy, inspect PRs already queued for GitHub
auto-merge. Do not assume a preset edit cancels those requests.

## Allow Renovate to bypass approval

For repositories with one owner, a separate approval ruleset can let the Renovate App
skip approval through PRs. Required CI must remain in a ruleset that Renovate cannot
bypass. This preset does not configure the bypass or change branch protections.

With this bypass, breaking security fixes can merge on green CI without human review. Do
not enable the bypass without required CI.

1. Verify GitHub auto-merge on one repository before enabling the bypass elsewhere.
2. Put approval requirements in a separate ruleset.
3. Allow the Renovate App to bypass that approval ruleset through PRs only.
4. Keep approval of the latest push required for other actors, subject to existing
   administrator exceptions.

Renovate decides which updates can merge. No approval bot needs to repeat that decision.
