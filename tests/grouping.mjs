import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { pathToFileURL } from 'node:url';

const packageDir = process.env.RENOVATE_PACKAGE_DIR;
if (!packageDir) {
  throw new Error('Set RENOVATE_PACKAGE_DIR to the Renovate package directory.');
}

const renovate = (path) => import(pathToFileURL(resolve(packageDir, 'dist', path)));
const pkg = JSON.parse(await readFile(resolve(packageDir, 'package.json'), 'utf8'));
const { init: initLogger } = await renovate('logger/index.js');
await initLogger();

const { getConfig } = await renovate('config/defaults.js');
const { mergeChildConfig } = await renovate('config/utils.js');
const { resolveConfigPresets } = await renovate('config/presets/index.js');
const { detectVulnerabilityAlerts } = await renovate('workers/repository/init/vulnerability.js');
const { Vulnerabilities } = await renovate('workers/repository/process/vulnerabilities.js');
const { branchifyUpgrades } = await renovate('workers/repository/updates/branchify.js');
const { default: platformApis } = await renovate('modules/platform/api.js');
const { setPlatformApi } = await renovate('modules/platform/index.js');

const defaultConfig = JSON.parse(await readFile('default.json', 'utf8'));
const resolvedDefault = (await resolveConfigPresets(defaultConfig)).config;
const automergeConfig = JSON.parse(await readFile('automerge.json', 'utf8'));
const targetManagers = ['gomod', 'npm', 'pep621', 'cargo'];
const dependencyPrefixes = { gomod: 'example.com/go', npm: 'npm', pep621: 'python', cargo: 'rust' };
const securityDeps = {
  gomod: ['example.com/go-security-major', 'example.com/go-security-patch'],
  npm: ['npm-security-major', 'npm-security-patch'],
  pep621: ['python-security-major', 'python-security-patch'],
  cargo: ['rust-security-major', 'rust-security-patch'],
};

function update(
  depName,
  updateType,
  newVersion,
  { currentVersion = '1.0.0', datasource, sourceUrl, versioning = 'semver' } = {},
) {
  const [newMajor, newMinor] = newVersion.split('.').map(Number);
  return {
    depName,
    packageName: depName,
    depType: 'require',
    datasource: datasource ?? (versioning === 'pep440' ? 'pypi' : 'npm'),
    versioning,
    currentValue: currentVersion,
    currentVersion,
    sourceUrl,
    updates: [{ updateType, newValue: newVersion, newVersion, newMajor, newMinor }],
  };
}

function manifest(manager, packageFile, deps, lockFiles = []) {
  return {
    packageFile,
    deps,
    ...(manager === 'npm' ? { managerData: { npmLock: lockFiles[0] } } : {}),
    ...(manager === 'gomod' ? {} : { lockFiles }),
  };
}

function targetDeps(manager) {
  const options =
    manager === 'gomod'
      ? { datasource: 'go' }
      : manager === 'pep621'
        ? { versioning: 'pep440' }
        : manager === 'cargo'
          ? { datasource: 'crate' }
          : {};
  const prefix = dependencyPrefixes[manager];
  return [
    update(`${prefix}-security-patch`, 'patch', '1.0.1', options),
    update(`${prefix}-security-major`, 'major', '2.0.0', options),
    update(`${prefix}-patch`, 'patch', '1.0.1', options),
    update(`${prefix}-minor`, 'minor', '1.1.0', options),
    update(`${prefix}-major`, 'major', '2.0.0', options),
  ];
}

const files = {
  cargo: ['Cargo.toml', 'crates/cli/Cargo.toml'].map((packageFile) =>
    manifest('cargo', packageFile, targetDeps('cargo'), ['Cargo.lock']),
  ),
  gomod: ['go.mod', 'foo/bar/go.mod', 'foobar/go.mod'].map((packageFile) =>
    manifest('gomod', packageFile, targetDeps('gomod')),
  ),
  npm: [
    manifest(
      'npm',
      'package.json',
      [
        ...targetDeps('npm'),
        update('react', 'major', '19.0.0', {
          currentVersion: '18.3.0',
          sourceUrl: 'https://github.com/facebook/react',
        }),
        update('react-dom', 'major', '19.0.0', {
          currentVersion: '18.3.0',
          sourceUrl: 'https://github.com/facebook/react',
        }),
      ],
      ['package-lock.json'],
    ),
    manifest(
      'npm',
      'apps/web/package.json',
      [
        ...targetDeps('npm'),
        update('react', 'major', '19.0.0', {
          currentVersion: '18.3.0',
          sourceUrl: 'https://github.com/facebook/react',
        }),
        update('react-dom', 'major', '19.0.0', {
          currentVersion: '18.3.0',
          sourceUrl: 'https://github.com/facebook/react',
        }),
      ],
      ['package-lock.json'],
    ),
  ],
  pep621: [
    manifest(
      'pep621',
      'pyproject.toml',
      [
        ...targetDeps('pep621'),
        update('pydantic', 'major', '2.0.0', { versioning: 'pep440' }),
        update('pydantic-settings', 'major', '2.0.0', { versioning: 'pep440' }),
        update('opentelemetry-api', 'major', '2.0.0', {
          currentVersion: '1.28.0',
          sourceUrl: 'https://github.com/open-telemetry/opentelemetry-python',
          versioning: 'pep440',
        }),
        update('opentelemetry-sdk', 'major', '2.0.0', {
          currentVersion: '1.28.0',
          sourceUrl: 'https://github.com/open-telemetry/opentelemetry-python',
          versioning: 'pep440',
        }),
        update('opentelemetry-exporter-otlp', 'major', '2.0.0', {
          currentVersion: '1.28.0',
          sourceUrl: 'https://github.com/open-telemetry/opentelemetry-python',
          versioning: 'pep440',
        }),
        update('opentelemetry-instrumentation', 'major', '1.0.0', {
          currentVersion: '0.49b0',
          sourceUrl: 'https://github.com/open-telemetry/opentelemetry-python-contrib',
          versioning: 'pep440',
        }),
        update('opentelemetry-instrumentation-requests', 'minor', '0.50b0', {
          currentVersion: '0.49b0',
          sourceUrl: 'https://github.com/open-telemetry/opentelemetry-python-contrib',
          versioning: 'pep440',
        }),
      ],
      ['uv.lock'],
    ),
    manifest('pep621', 'tools/pyproject.toml', targetDeps('pep621'), ['uv.lock']),
  ],
  dockerfile: [
    manifest('dockerfile', 'Dockerfile', [
      update('node', 'digest', '1.0.1', { datasource: 'docker' }),
    ]),
  ],
  pip_requirements: [
    manifest('pip_requirements', 'requirements.txt', [
      update('control-security', 'patch', '1.0.1', { versioning: 'pep440' }),
    ]),
  ],
};

const securityNames = new Set([...Object.values(securityDeps).flat(), 'control-security']);
const ecosystem = (name) =>
  name.startsWith('example.com/')
    ? 'go'
    : name.startsWith('python-') || name === 'control-security'
      ? 'pip'
      : name.startsWith('rust-')
        ? 'rust'
        : 'npm';
const fixedVersion = (name) => (name.endsWith('-major') ? '2.0.0' : '1.0.1');
const githubAlerts = [...securityNames].map((name) => ({
  security_vulnerability: {
    package: { ecosystem: ecosystem(name), name },
    first_patched_version: { identifier: fixedVersion(name) },
    severity: 'high',
  },
  security_advisory: {
    identifiers: [],
    summary: 'Fixture',
    description: 'Fixture',
    severity: 'high',
    references: [],
  },
}));

platformApis.set('github', {
  ...platformApis.get('github'),
  getVulnerabilityAlerts: async () => structuredClone(githubAlerts),
});
setPlatformApi('github');
const osv = new Vulnerabilities({
  getVulnerabilities: async (ecosystem, name) =>
    securityNames.has(name)
      ? [
          {
            id: 'GHSA-fixture',
            summary: 'Fixture',
            details: 'Fixture',
            affected: [
              {
                package: { ecosystem, name },
                ranges: [
                  {
                    type: 'SEMVER',
                    events: [{ introduced: '0' }, { fixed: fixedVersion(name) }],
                  },
                ],
              },
            ],
          },
        ]
      : [],
});

function config(policy = resolvedDefault, overrides = {}) {
  return mergeChildConfig(mergeChildConfig(getConfig(), policy), {
    errors: [],
    warnings: [],
    repoIsOnboarded: true,
    semanticCommits: 'disabled',
    lockFileMaintenance: { enabled: false },
    minimumGroupSize: 3,
    ...overrides,
  });
}

async function branches(source, renovateConfig, packageFiles = files) {
  let configured = renovateConfig;
  if (source !== 'osv') configured = await detectVulnerabilityAlerts(configured);
  if (source !== 'github') {
    await osv.appendVulnerabilityPackageRules(configured, structuredClone(packageFiles));
  }
  return (await branchifyUpgrades(configured, structuredClone(packageFiles))).branches;
}

function matching(all, manager, packageFile, vulnerability) {
  return all.filter(
    (branch) =>
      branch.manager === manager &&
      Boolean(branch.isVulnerabilityAlert) === vulnerability &&
      branch.upgrades.some((upgrade) => upgrade.packageFile === packageFile),
  );
}

function branchWith(all, depName) {
  const branch = all.find((candidate) =>
    candidate.upgrades.some((upgrade) => upgrade.depName === depName),
  );
  assert.ok(branch, `branch containing ${depName}`);
  return branch;
}

function depNames(branch) {
  return branch.upgrades.map((upgrade) => upgrade.depName).sort();
}

function packageFiles(branch) {
  return [...new Set(branch.upgrades.map((upgrade) => upgrade.packageFile))].sort();
}

for (const manager of targetManagers) {
  assert.equal(resolvedDefault[manager].additionalBranchPrefix, '{{{packageFile}}}-');
  assert.equal(resolvedDefault[manager].separateMinorPatch, false);
}

for (const source of ['github', 'osv', 'both']) {
  const all = await branches(source, config());
  for (const manager of targetManagers) {
    const prefix = dependencyPrefixes[manager];
    for (const { packageFile } of files[manager]) {
      const routine = matching(all, manager, packageFile, false).find((branch) =>
        depNames(branch).includes(`${prefix}-patch`),
      );
      assert.ok(routine, `${source}: ${manager} routine branch for ${packageFile}`);
      assert.deepEqual(packageFiles(routine), [packageFile]);
      assert.ok(routine.branchName.includes(`${manager}-dependencies`));
      assert.deepEqual(
        depNames(routine).filter(
          (name) => name === `${prefix}-patch` || name === `${prefix}-minor`,
        ),
        [`${prefix}-minor`, `${prefix}-patch`],
      );
      assert.ok(!depNames(routine).includes(`${prefix}-major`));

      const security = matching(all, manager, packageFile, true);
      assert.equal(security.length, 1, `${source}: one ${manager} security branch per manifest`);
      assert.deepEqual(packageFiles(security[0]), [packageFile]);
      assert.deepEqual(depNames(security[0]), securityDeps[manager]);
      assert.ok(security[0].branchName.includes(`${manager}-security`));
      assert.equal(security[0].minimumGroupSize, 1);
      assert.equal(security[0].minimumReleaseAge, null);
      assert.deepEqual(security[0].schedule, []);
      assert.equal(security[0].prCreation, 'immediate');
      assert.equal(security[0].dependencyDashboardApproval, false);
      assert.equal(security[0].automerge, false);
      assert.ok(depNames(routine).every((name) => !depNames(security[0]).includes(name)));
    }
  }
}

const defaultBranches = await branches('github', config());
assert.equal(
  new Set(
    files.gomod.map(
      ({ packageFile }) =>
        matching(defaultBranches, 'gomod', packageFile, false).find((branch) =>
          depNames(branch).includes('example.com/go-patch'),
        ).branchName,
    ),
  ).size,
  files.gomod.length,
  'root, nested, and colliding Go module paths have distinct routine branches',
);
assert.notEqual(
  branchWith(defaultBranches, 'npm-patch').branchName,
  matching(defaultBranches, 'npm', 'apps/web/package.json', false).find((branch) =>
    depNames(branch).includes('npm-patch'),
  ).branchName,
  'npmLock metadata does not discover an npm workspace',
);

for (const source of ['github', 'osv', 'both']) {
  const workspaceBranches = await branches(
    source,
    config(resolvedDefault, {
      npm: { additionalBranchPrefix: 'web/' },
      pep621: { additionalBranchPrefix: 'web/' },
      cargo: { additionalBranchPrefix: 'rust/' },
    }),
  );
  for (const [manager, depName] of [
    ['npm', 'npm-patch'],
    ['pep621', 'python-patch'],
    ['cargo', 'rust-patch'],
  ]) {
    const routine = branchWith(workspaceBranches, depName);
    const security = branchWith(workspaceBranches, `${depName.slice(0, -5)}security-patch`);
    assert.equal(routine.upgrades.filter((upgrade) => upgrade.depName === depName).length, 2);
    assert.deepEqual(
      depNames(security),
      securityDeps[manager].flatMap((name) => [name, name]),
    );
  }
  assert.equal(
    branchWith(workspaceBranches, 'react').upgrades.filter((upgrade) => upgrade.depName === 'react')
      .length,
    2,
    `${source}: static npm workspace prefix preserves coupled React majors`,
  );
}

const singleSecurityFiles = {
  npm: [
    manifest(
      'npm',
      'single/package.json',
      [update('npm-security-patch', 'patch', '1.0.1')],
      ['package-lock.json'],
    ),
  ],
};
for (const source of ['github', 'osv', 'both']) {
  const single = matching(
    await branches(source, config(), singleSecurityFiles),
    'npm',
    'single/package.json',
    true,
  );
  assert.equal(single.length, 1, `${source}: a single security fix creates a branch`);
  assert.equal(single[0].minimumGroupSize, 1);
  assert.equal(single[0].prCreation, 'immediate');
}

const react = branchWith(defaultBranches, 'react');
assert.ok(depNames(react).includes('react-dom'), 'inherited React major family remains grouped');
assert.deepEqual(packageFiles(react), ['package.json']);
const otelCore = branchWith(defaultBranches, 'opentelemetry-api');
assert.deepEqual(depNames(otelCore), [
  'opentelemetry-api',
  'opentelemetry-exporter-otlp',
  'opentelemetry-sdk',
]);
assert.notEqual(
  otelCore.branchName,
  branchWith(defaultBranches, 'opentelemetry-instrumentation').branchName,
  'Python OTel core and contrib major families remain separate despite different stable and beta versions',
);
const otelContribRoutine = branchWith(defaultBranches, 'opentelemetry-instrumentation-requests');
assert.ok(
  depNames(otelContribRoutine).includes('python-minor'),
  'Python OTel beta routine updates do not require a stable-family version match',
);
assert.notEqual(
  branchWith(defaultBranches, 'pydantic').branchName,
  branchWith(defaultBranches, 'pydantic-settings').branchName,
  'pydantic-settings does not imply a major-version family',
);

const caddy = await branches(
  'github',
  config(resolvedDefault, {
    packageRules: [
      {
        matchManagers: ['gomod'],
        matchFileNames: ['packages/caddy/go.mod'],
        groupName: 'Caddy',
        groupSlug: 'caddy',
        separateMultipleMajor: false,
        addLabels: ['caddy'],
        postUpgradeTasks: {
          commands: ['true'],
          fileFilters: ['go.mod'],
          executionMode: 'branch',
        },
      },
    ],
  }),
  { gomod: [manifest('gomod', 'packages/caddy/go.mod', targetDeps('gomod'))] },
);
const caddySecurity = matching(caddy, 'gomod', 'packages/caddy/go.mod', true)[0];
const caddyRoutine = matching(caddy, 'gomod', 'packages/caddy/go.mod', false).find((branch) =>
  depNames(branch).includes('example.com/go-patch'),
);
assert.deepEqual(depNames(caddySecurity), securityDeps.gomod);
assert.ok(caddyRoutine, 'Caddy retains its local routine group');
assert.ok(caddyRoutine.branchName.includes('caddy'));
assert.ok(caddySecurity.addLabels.includes('caddy'));
assert.deepEqual(caddySecurity.postUpgradeTasks.commands, ['true']);
assert.equal(caddySecurity.postUpgradeTasks.executionMode, 'branch');

const baseline = structuredClone(resolvedDefault);
delete baseline.gomod;
delete baseline.npm;
delete baseline.pep621;
delete baseline.cargo;
delete baseline.vulnerabilityAlerts.branchTopic;
delete baseline.vulnerabilityAlerts.minimumGroupSize;
baseline.packageRules = baseline.packageRules.filter(
  (rule) =>
    ![
      'Group routine minor and patch updates by target manager',
      'Configure target-manager security commits',
    ].includes(rule.description),
);
const automergePolicy = mergeChildConfig(resolvedDefault, automergeConfig);
const baselineAutomergePolicy = mergeChildConfig(baseline, automergeConfig);
const controls = await branches('github', config(automergePolicy), {
  dockerfile: files.dockerfile,
  pip_requirements: files.pip_requirements,
});
const controlBaseline = await branches('github', config(baselineAutomergePolicy), {
  dockerfile: files.dockerfile,
  pip_requirements: files.pip_requirements,
});
for (const depName of ['node', 'control-security']) {
  const current = branchWith(controls, depName);
  const previous = branchWith(controlBaseline, depName);
  assert.equal(
    current.branchName,
    previous.branchName,
    `${depName}: non-target branch naming is unchanged`,
  );
  assert.equal(
    current.automerge,
    previous.automerge,
    `${depName}: non-target automerge is unchanged`,
  );
}
assert.equal(
  branchWith(controls, 'node').automerge,
  true,
  'automerge policy still applies to docker digests',
);

// These fixtures exercise branch policy only; Renovate 44.30.3 cannot discover workspaces from metadata.
console.log(`Grouping regression checks passed for Renovate ${pkg.version}.`);
