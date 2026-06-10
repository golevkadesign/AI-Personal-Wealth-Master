import fs from 'node:fs';
import path from 'node:path';

const root = process.cwd();
const srcDir = path.join(root, 'src');
const strict = process.argv.includes('--strict');
const cjkPattern = /[\u3400-\u9fff]/;
const jsxTextPattern = />[^<]*[\u3400-\u9fff][^<]*</;
const stringPattern = /(['"`])(?:(?!\1).)*[\u3400-\u9fff](?:(?!\1).)*\1/;
const ignoredFiles = new Set([
  path.join(srcDir, 'i18n', 'translations.ts'),
]);

function walk(dir) {
  return fs.readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    const fullPath = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      return walk(fullPath);
    }
    if (!/\.(ts|tsx)$/.test(entry.name) || entry.name.endsWith('.d.ts')) {
      return [];
    }
    if (ignoredFiles.has(fullPath)) {
      return [];
    }
    return [fullPath];
  });
}

const findings = [];

for (const file of walk(srcDir)) {
  const rel = path.relative(root, file);
  const lines = fs.readFileSync(file, 'utf8').split('\n');

  lines.forEach((line, index) => {
    const trimmed = line.trim();
    if (!cjkPattern.test(line)) return;
    if (trimmed.startsWith('//') || trimmed.startsWith('*')) return;
    if (!jsxTextPattern.test(line) && !stringPattern.test(line)) return;

    findings.push({
      file: rel,
      line: index + 1,
      text: trimmed.slice(0, 180),
    });
  });
}

if (findings.length === 0) {
  console.log('i18n hardcoded text check passed.');
  process.exit(0);
}

console.log(`i18n hardcoded text check found ${findings.length} candidate line(s).`);
for (const finding of findings.slice(0, 80)) {
  console.log(`${finding.file}:${finding.line} ${finding.text}`);
}

if (findings.length > 80) {
  console.log(`...and ${findings.length - 80} more.`);
}

if (strict) {
  process.exit(1);
}
