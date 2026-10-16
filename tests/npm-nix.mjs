import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { resolve } from "node:path";
import { pathToFileURL } from "node:url";

const packageDir = process.env.RENOVATE_PACKAGE_DIR;
if (!packageDir) throw new Error("Set RENOVATE_PACKAGE_DIR to the Renovate package directory.");
const renovate = (path) => import(pathToFileURL(resolve(packageDir, "dist", path)));
const { init: initLogger } = await renovate("logger/index.js");
await initLogger();
const { init: initCache, set } = await renovate("util/cache/memory/index.js");
initCache();
const { resolveConfigPresets } = await renovate("config/presets/index.js");
const { applyPackageRules } = await renovate("util/package-rules/index.js");
const { getConfig } = await renovate("config/defaults.js");
const { mergeChildConfig } = await renovate("config/utils.js");
const { branchifyUpgrades } = await renovate("workers/repository/updates/branchify.js");
const { detectVulnerabilityAlerts } = await renovate("workers/repository/init/vulnerability.js");
const { default: platformApis } = await renovate("modules/platform/api.js");
const { setPlatformApi } = await renovate("modules/platform/index.js");

const preset = "github>adamcik/renovate-config";
const load = async (name) => JSON.parse(await readFile(`${name}.json`, "utf8"));
const npmPreset = await load("npm-nix");
// Resolve real parameterized presets without fetching unpublished configuration.
for (const [reference, config] of [
  [`${preset}:npm-nix(.,npm-deps)`, npmPreset],
  [`${preset}:npm-nix(web,web-deps)`, npmPreset],
  [`${preset}:application`, await load("application")],
  [`${preset}:library`, await load("library")],
  [preset, await load("default")],
])
  set(`preset:${reference}`, config);

const policy = async (...extendsList) =>
  (await resolveConfigPresets({ extends: extendsList })).config;
const task = async (config, packageFile, manager = "npm", security = false) =>
  (
    await applyPackageRules({
      ...config,
      manager,
      packageFile,
      depName: "example",
      updateType: "patch",
      isVulnerabilityAlert: security,
    })
  ).postUpgradeTasks;

for (const profile of [preset, `${preset}:application`, `${preset}:library`]) {
  assert.equal(await task(await policy(profile), "package.json"), undefined);
}
const root = await policy(`${preset}:npm-nix(.,npm-deps)`);
const expected = {
  commands: ["/opt/nix-post-upgrade update-npm-hash npm-deps", "/opt/nix-post-upgrade fmt"],
  executionMode: "branch",
  fileFilters: ["**/*"],
};
assert.deepEqual(await task(root, "package.json"), expected);
assert.deepEqual(await task(root, "package.json", "npm", true), expected);
assert.equal(await task(root, "web/package.json"), undefined);
assert.equal(await task(root, "package.json", "gomod"), undefined);
const nested = await policy(`${preset}:npm-nix(web,web-deps)`);
const nestedExpected = {
  ...expected,
  commands: ["/opt/nix-post-upgrade update-npm-hash web-deps", expected.commands[1]],
};
assert.deepEqual(await task(nested, "web/package.json"), nestedExpected);
assert.deepEqual(await task(nested, "web/package.json", "npm", true), nestedExpected);
assert.equal(await task(nested, "package.json"), undefined);
assert.equal(await task(nested, "other/package.json"), undefined);
const combined = await policy(`${preset}:npm-nix(.,npm-deps)`, `${preset}:npm-nix(web,web-deps)`);
assert.deepEqual(await task(combined, "package.json"), expected);
assert.deepEqual(await task(combined, "web/package.json"), nestedExpected);

// Exercise branch generation too: security alerts and lockfile maintenance take
// different paths from routine dependency updates inside Renovate.
platformApis.set("github", {
  ...platformApis.get("github"),
  getVulnerabilityAlerts: async () => [
    {
      security_vulnerability: {
        package: { ecosystem: "npm", name: "example" },
        first_patched_version: { identifier: "1.0.1" },
        severity: "high",
      },
      security_advisory: {
        identifiers: [],
        summary: "Fixture",
        description: "Fixture",
        severity: "high",
        references: [],
      },
    },
  ],
});
setPlatformApi("github");
const branchConfig = mergeChildConfig(
  mergeChildConfig(
    getConfig(),
    await policy(`${preset}:application`, `${preset}:npm-nix(web,web-deps)`),
  ),
  {
    errors: [],
    warnings: [],
    repoIsOnboarded: true,
    semanticCommits: "disabled",
    lockFileMaintenance: { enabled: true },
  },
);
const { branches } = await branchifyUpgrades(await detectVulnerabilityAlerts(branchConfig), {
  npm: [
    {
      packageFile: "web/package.json",
      lockFiles: ["web/package-lock.json"],
      managerData: { npmLock: "web/package-lock.json" },
      deps: [
        {
          depName: "example",
          packageName: "example",
          datasource: "npm",
          versioning: "semver",
          currentValue: "1.0.0",
          currentVersion: "1.0.0",
          updates: [
            {
              updateType: "patch",
              newValue: "1.0.1",
              newVersion: "1.0.1",
              newMajor: 1,
              newMinor: 0,
            },
          ],
        },
      ],
    },
  ],
});
const security = branches.find((branch) => branch.isVulnerabilityAlert);
const maintenance = branches.find((branch) => branch.isLockFileMaintenance);
assert.ok(security, "GitHub alert produces a security branch");
assert.ok(maintenance, "lockfile maintenance produces a branch");
assert.deepEqual(security.postUpgradeTasks, nestedExpected);
assert.deepEqual(maintenance.postUpgradeTasks, nestedExpected);
console.log(
  "npm artifact policy: opt-in, root/nested manifests, security branches, and lockfile maintenance passed.",
);
