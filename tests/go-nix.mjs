import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { resolve } from "node:path";
import { pathToFileURL } from "node:url";

const packageDir = process.env.RENOVATE_PACKAGE_DIR;
if (!packageDir) {
  throw new Error("Set RENOVATE_PACKAGE_DIR to the Renovate package directory.");
}
const renovate = (path) => import(pathToFileURL(resolve(packageDir, "dist", path)));
const { init: initLogger } = await renovate("logger/index.js");
await initLogger();
const { init: initCache, set } = await renovate("util/cache/memory/index.js");
initCache();
const { resolveConfigPresets } = await renovate("config/presets/index.js");
const { applyPackageRules } = await renovate("util/package-rules/index.js");

const preset = "github>adamcik/renovate-config";
const load = async (name) => JSON.parse(await readFile(`${name}.json`, "utf8"));
const modulePreset = await load("go-nix-module");

// Fixture preset transport keeps resolution and parameter substitution real without
// fetching the not-yet-published policy or executing repository-controlled builds.
for (const [reference, config] of [
  [`${preset}:go-nix`, await load("go-nix")],
  [`${preset}//go-nix-module(.,default)`, modulePreset],
  [`${preset}:go-nix-module(.,default demo)`, modulePreset],
  [`${preset}:go-nix-module(packages/caddy,caddy)`, modulePreset],
  [`${preset}:application`, await load("application")],
  [`${preset}:library`, await load("library")],
  [preset, await load("default")],
]) {
  set(`preset:${reference}`, config);
}

const resolvePolicy = async (extendsList) =>
  (await resolveConfigPresets({ extends: extendsList })).config;
const task = async (config, packageFile, manager = "gomod", security = false) =>
  (
    await applyPackageRules({
      ...config,
      manager,
      packageFile,
      depName: "example.com/module",
      updateType: "patch",
      isVulnerabilityAlert: security,
    })
  ).postUpgradeTasks;

for (const profile of [preset, `${preset}:application`, `${preset}:library`]) {
  assert.equal(await task(await resolvePolicy([profile]), "go.mod"), undefined);
}

const root = await resolvePolicy([`${preset}:go-nix`]);
const expected = {
  commands: [
    "/opt/nix-post-upgrade update-go-checksums .",
    "/opt/nix-post-upgrade update-go-hashes default",
    "/opt/nix-post-upgrade fmt",
  ],
  executionMode: "branch",
  fileFilters: ["**/*"],
};
assert.deepEqual(await task(root, "go.mod"), expected);
assert.deepEqual(await task(root, "go.mod", "gomod", true), expected);
assert.equal(await task(root, "packages/caddy/go.mod"), undefined);
assert.equal(await task(root, "go.mod", "npm"), undefined);

const multiple = await resolvePolicy([`${preset}:go-nix-module(.,default demo)`]);
assert.deepEqual(await task(multiple, "go.mod"), {
  ...expected,
  commands: [
    expected.commands[0],
    "/opt/nix-post-upgrade update-go-hashes default demo",
    expected.commands[2],
  ],
});

const caddy = await resolvePolicy([`${preset}:go-nix-module(packages/caddy,caddy)`]);
assert.deepEqual(await task(caddy, "packages/caddy/go.mod"), {
  ...expected,
  commands: [
    "/opt/nix-post-upgrade update-go-checksums packages/caddy",
    "/opt/nix-post-upgrade update-go-hashes caddy",
    expected.commands[2],
  ],
});
assert.equal(await task(caddy, "go.mod"), undefined);
assert.equal(await task(caddy, "packages/other/go.mod"), undefined);

const combined = await resolvePolicy([
  `${preset}:go-nix`,
  `${preset}:go-nix-module(packages/caddy,caddy)`,
]);
assert.deepEqual(await task(combined, "go.mod"), expected);
assert.deepEqual(
  await task(combined, "packages/caddy/go.mod"),
  await task(caddy, "packages/caddy/go.mod"),
);
console.log(
  "Go artifact policy: opt-in, root/nested modules, security, and package targets passed.",
);
