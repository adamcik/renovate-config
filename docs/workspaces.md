# Group a shared-lockfile workspace

By default, the presets group Go, npm, PEP 621, and Cargo updates
[by manifest](policy.md#dependency-groups). Override the project prefix when several
manifests belong to one shared-lockfile workspace.

Renovate 44.30.3 knows the npm, uv, and Cargo lockfile paths during extraction but does
not expose them to branch templates. The presets cannot discover shared-lockfile
workspaces automatically. Do not infer ownership from a common parent directory alone.

## Set a workspace prefix

If every npm manifest in a repository belongs to one workspace, add a constant project
prefix at manager level in `renovate.json`:

```json
{
  "extends": ["github>adamcik/renovate-config:application"],
  "npm": {
    "additionalBranchPrefix": "web/"
  }
}
```

For a single uv workspace, use `pep621` instead of `npm`. For a single Cargo workspace,
use `cargo`.

The prefix combines routine updates, security fixes, and inherited major groups across
the workspace manifests. Define it at manager level, not only in `packageRules`, because
Renovate's lockfile-remediation path bypasses those rules.

## Keep independent workspaces separate

For repositories with several workspaces, define an explicit manifest-path mapping with
distinct prefixes for independent workspaces. Do not apply one constant prefix to the
whole manager.

Cargo dependencies declared in `[workspace.dependencies]` are updated in the root
manifest. Renovate skips inherited member entries. Dependencies declared directly in
member manifests remain separate unless a workspace prefix is set.
