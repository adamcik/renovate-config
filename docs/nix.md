# Update Nix artifacts

Add an artifact preset when Go or npm dependency updates also need checksum or Nix hash
changes. Neither the baseline nor the application or library profiles include these
presets.

These presets require the allowlisted `/opt/nix-post-upgrade` launcher from
[`adamcik/renovate-runner`](https://github.com/adamcik/renovate-runner). Do not add them
to repositories using another runner without equivalent support.

Before adopting a preset, remove matching local artifact tasks or replace the whole
command sequence intentionally. `postUpgradeTasks` is not mergeable in Renovate 44. The
presets include the runner's formatting step. Broad artifact filters retain checksum,
hash, and formatter changes, including unrelated formatting changes.

## Update npm dependency hashes

Use `npm-nix(manifest-directory,dependency-package)` when npm's lockfile also feeds a
Nix fixed-output dependency derivation.

1. Expose the `fetchNpmDeps` derivation as `packages.<system>.npm-deps`, or expose
   `buildNpmPackage`'s `npmDeps` under that name.
2. Add the preset with the manifest directory and dependency package name:

   ```json
   {
     "extends": [
       "github>adamcik/renovate-config:application",
       "github>adamcik/renovate-config:npm-nix(web,npm-deps)"
     ]
   }
   ```

The second parameter names the dependency derivation, not the application package. Use
`.` for a root npm manifest. Each instance matches only that directory's `package.json`,
including security updates. Add one instance per independent npm lockfile.

The runner must support the `update-npm-hash` operation. After npm updates its lockfile,
the launcher discovers the dependency hash and updates one literal `hash = "sha256-…";`
or `npmDepsHash = "sha256-…";` assignment in a tracked Nix file. It then verifies the
dependency build and formats the branch.

The assignment must be on one line and uniquely match the old hash. Computed, shared, or
ambiguous assignments fail rather than being guessed.

## Update a root Go module

Use `go-nix` only when the repository has a root `go.mod` and its default flake package
uses `buildGoModule` with a literal `vendorHash` in a tracked Nix file.

Add the preset to `renovate.json`:

```json
{
  "extends": [
    "github>adamcik/renovate-config:application",
    "github>adamcik/renovate-config:go-nix"
  ]
}
```

After each Go update branch, the launcher downloads module checksums, refreshes vendor
hashes, builds the selected packages, and formats the repository.

## Update nested Go modules or other package targets

Use `go-nix-module(module-directory,package-attributes)` for nested modules or package
targets other than the default flake package:

```json
{
  "extends": [
    "github>adamcik/renovate-config:application",
    "github>adamcik/renovate-config:go-nix-module(packages/caddy,caddy)"
  ]
}
```

Separate multiple package attributes with spaces. For a root module with two package
targets, use `go-nix-module(.,default demo)`.

Each instance matches only its module's `go.mod`. Add one instance per independent
module. Keep module-specific grouping and compatibility constraints in local rules. The
launcher validates module directories and package attributes before executing them.

## Retry failed Go artifacts

After fixing the underlying problem, use the PR's rebase or retry checkbox if artifacts
still need regeneration. A successful runner invocation alone does not mean those
artifacts were regenerated.
