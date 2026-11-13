// Rewrites every "resolved" tarball URL in package-lock.json to the public npm registry.
// Local installs may go through a registry mirror; the committed lockfile should not
// depend on (or reveal) that mirror. Integrity hashes are identical, so this is safe.
import { readFileSync, writeFileSync } from 'node:fs';

const file = new URL('../package-lock.json', import.meta.url);
const before = readFileSync(file, 'utf8');
const after = before.replace(
  /"resolved": "https?:\/\/[^"]*?\/((?:@[^/"]+\/)?[^/"@]+\/-\/[^"]+\.tgz)"/g,
  '"resolved": "https://registry.npmjs.org/$1"',
);
writeFileSync(file, after);
const left = after.match(/"resolved": "(?!https:\/\/registry\.npmjs\.org\/)[^"]+"/g) ?? [];
console.log(left.length ? `Not rewritten:\n${left.join('\n')}` : 'package-lock.json: all resolved URLs point to registry.npmjs.org');
process.exit(left.length ? 1 : 0);
