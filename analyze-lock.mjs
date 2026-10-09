import fs from 'node:fs';

const lockfile = JSON.parse(fs.readFileSync('package-lock.json', 'utf8'));

console.log("Analyzing package-lock.json for vulnerabilities (heuristic)...");
const packages = lockfile.packages || {};

// Known vulnerable versions
const vulnerable = [
  { name: 'cross-spawn', max: '7.0.3', min: '7.0.0' },
  { name: 'braces', max: '3.0.2', min: '3.0.0' },
  { name: 'ws', max: '8.17.0', min: '8.0.0' },
  { name: 'cookie', max: '0.6.0', min: '0.0.0' },
  { name: 'path-to-regexp', max: '0.1.9', min: '0.1.7' },
  { name: 'micromatch', max: '4.0.5', min: '4.0.0' },
  { name: 'multer', max: '1.4.4', min: '1.0.0' },
  { name: 'axios', max: '1.7.3', min: '1.0.0' },
];

let found = 0;
for (const [path, pkg] of Object.entries(packages)) {
  if (!pkg.version) continue;
  const name = path.split('node_modules/').pop();
  if (!name) continue;

  for (const v of vulnerable) {
    if (name === v.name) {
      console.log(`Found ${name}@${pkg.version}`);
      found++;
    }
  }
}
console.log(`Found ${found} potentially vulnerable packages (shallow heuristic).`);
