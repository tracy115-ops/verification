import fs from 'node:fs';

const read = (file) => fs.readFileSync(file, 'utf8');
const json = (file) => JSON.parse(read(file));
const manifest = json('package.json');
const requested = process.argv[2];
const version = requested ?? manifest.version;
if (!/^(0|[1-9]\d*)\.(0|[1-9]\d*)\.(0|[1-9]\d*)(?:-(?:alpha|beta|rc)\.(0|[1-9]\d*))?$/.test(version)) {
  throw new Error('Expected MAJOR.MINOR.PATCH or MAJOR.MINOR.PATCH-alpha|beta|rc.N');
}
const files = new Map();
const packageLock = json('package-lock.json');
const tauri = json('src-tauri/tauri.conf.json');
const workspace = read('Cargo.toml');
const cargoLock = read('Cargo.lock');
const localPackages = ['agent-runtime', 'execution-runtime', 'process-runtime', 'verification-desktop'];
const versions = [
  manifest.version,
  packageLock.version,
  packageLock.packages[''].version,
  tauri.version,
  workspace.match(/\[workspace\.package\]\s+version = "([^"]+)"/)?.[1],
  ...localPackages.map(
    (name) => cargoLock.match(new RegExp(`name = "${name}"\\r?\\nversion = "([^"]+)"`))?.[1],
  ),
];
if (!requested) {
  if (versions.some((value) => value !== version)) {
    throw new Error(`Version mismatch: ${JSON.stringify(versions)}`);
  }
  const tag = process.env.GITHUB_REF;
  if (tag?.startsWith('refs/tags/v') && tag !== `refs/tags/v${version}`) {
    throw new Error(`Tag ${tag} does not match v${version}`);
  }
  console.log(`Version contracts passed: ${version}`);
} else {
  manifest.version = version;
  packageLock.version = version;
  packageLock.packages[''].version = version;
  tauri.version = version;
  for (const [file, value] of [
    ['package.json', manifest],
    ['package-lock.json', packageLock],
    ['src-tauri/tauri.conf.json', tauri],
  ])
    files.set(file, `${JSON.stringify(value, null, 2)}\n`);
  files.set('Cargo.toml', workspace.replace(/(\[workspace\.package\]\s+version = ")[^"]+"/, `$1${version}"`));
  let updatedLock = cargoLock;
  for (const name of localPackages) {
    updatedLock = updatedLock.replace(
      new RegExp(`(name = "${name}"\\r?\\nversion = ")[^"]+"`),
      `$1${version}"`,
    );
  }
  files.set('Cargo.lock', updatedLock);
  for (const [file, content] of files) fs.writeFileSync(file, content);
  console.log(`Synchronized application version: ${version}`);
}
