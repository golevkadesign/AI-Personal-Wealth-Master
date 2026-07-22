import fs from 'node:fs';
import path from 'node:path';

const root = process.cwd();
const srcDir = path.join(root, 'src');
const strict = process.argv.includes('--strict');
const strictAll = process.argv.includes('--strict-all');
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

function matchesAny(value, patterns) {
  return patterns.some((pattern) => pattern.test(value));
}

function classifyFinding(file, text) {
  const normalized = `${file} ${text}`;

  const protocolPatterns = [
    /^src\/hooks\/useAiAgent\.ts /,
    /^src\/lib\/workbench-chat-bridge\.ts /,
    /^src\/types\/portfolio-review\.ts /,
  ];
  if (matchesAny(normalized, protocolPatterns)) {
    return {
      category: 'protocol',
      reason: 'legacy agent/backend protocol keys or typed server contract values',
    };
  }

  const parserDictionaryPatterns = [
    /^src\/components\/chart-configs\.ts /,
    /^src\/lib\/agent-definitions\.ts /,
    /^src\/lib\/agent-thinking-parser\.ts /,
    /^src\/lib\/chat-response-parser\.ts /,
  ];
  if (matchesAny(normalized, parserDictionaryPatterns)) {
    return {
      category: 'dictionary',
      reason: 'parser or data-matching dictionary, not rendered fixed UI copy',
    };
  }

  const generatedContentPatterns = [
    /^src\/lib\/defaultPrompts\.ts /,
    /^src\/lib\/market-context\/regime\.ts /,
    /^src\/lib\/portfolio-review\/diff\.ts /,
    /^src\/lib\/portfolio-review-memory\.ts /,
    /^src\/lib\/sovereign-profile-projection\.ts /,
    /^src\/lib\/profile-terminal-state\.ts /,
  ];
  if (matchesAny(normalized, generatedContentPatterns)) {
    return {
      category: 'generated-content',
      reason: 'domain narrative, prompt, or derived analysis content',
    };
  }

  if (/console\.(warn|error|log|info|debug)/.test(text)) {
    return {
      category: 'diagnostic',
      reason: 'developer diagnostic output',
    };
  }

  return {
    category: 'ui',
    reason: 'visible UI copy should use translations',
  };
}

const findings = [];

for (const file of walk(srcDir)) {
  const rel = path.relative(root, file);
  const lines = fs.readFileSync(file, 'utf8').split('\n');

  lines.forEach((line, index) => {
    const trimmed = line.trim();
    if (!cjkPattern.test(line)) return;
    if (trimmed.startsWith('//') || trimmed.startsWith('*') || trimmed.startsWith('/*') || trimmed.startsWith('{/*')) return;
    if (!jsxTextPattern.test(line) && !stringPattern.test(line)) return;
    const classification = classifyFinding(rel, trimmed);

    findings.push({
      file: rel,
      line: index + 1,
      text: trimmed.slice(0, 180),
      ...classification,
    });
  });
}

const uiFindings = findings.filter((finding) => finding.category === 'ui');
const grouped = findings.reduce((acc, finding) => {
  acc[finding.category] = (acc[finding.category] || 0) + 1;
  return acc;
}, {});

if (findings.length === 0 || uiFindings.length === 0) {
  console.log('i18n UI hardcoded text check passed.');
  if (findings.length > 0) {
    console.log(`Non-UI CJK entries remain classified by design: ${JSON.stringify(grouped)}`);
  }
  if (strictAll && findings.length > 0) {
    process.exit(1);
  }
  process.exit(0);
}

console.log(`i18n hardcoded UI text check found ${uiFindings.length} UI candidate line(s).`);
console.log(`All CJK entries by category: ${JSON.stringify(grouped)}`);

for (const finding of uiFindings.slice(0, 80)) {
  console.log(`${finding.file}:${finding.line} [${finding.category}] ${finding.text}`);
}

if (uiFindings.length > 80) {
  console.log(`...and ${uiFindings.length - 80} more UI candidate(s).`);
}

if (strict || strictAll) {
  process.exit(1);
}
